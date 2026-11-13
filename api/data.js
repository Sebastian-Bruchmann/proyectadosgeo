// Proyectados GEO: objetivos y avances guardados en Upstash Redis (REST), con candados por contraseña.
// GET  /api/data            -> estado completo (sin los números de los objetivos bloqueados)
// GET  /api/data?rev=N      -> { igual: true } si nada cambió (1 sola consulta a la base)
// POST /api/data {ops}      -> aplica cambios y devuelve el estado nuevo
// POST /api/data {accion}   -> bloquear | desbloquear | modo | quitar
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[A-Za-z0-9_.:-]{1,120}$/;
const LIMITS = { metas: 2000, avances: 20000 };
// En los links de prueba (deploys de vista previa) se usa una copia aparte de los datos, así nada de lo que se pruebe toca lo real.
const PRUEBA = process.env.VERCEL_ENV === 'preview';
const PRE = PRUEBA ? 'proyectados-prueba:' : 'proyectados:';
const K = { rev: PRE + 'rev', metas: PRE + 'metas', avances: PRE + 'avances', ajustes: PRE + 'ajustes', try: 'proyectados:intentos:' };
const MODOS = ['ver', 'editar'];

/* ---------- conexión a Redis ---------- */
function envFind(re, not) {
  const k = Object.keys(process.env).find(n => re.test(n) && !(not && not.test(n)) && process.env[n]);
  return k ? process.env[k] : '';
}
const REDIS_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || envFind(/(REST_API_URL|REDIS_REST_URL)$/)).replace(/\/$/, '');
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || envFind(/(REST_API_TOKEN|REDIS_REST_TOKEN)$/, /READ_ONLY/);
const SECRET = createHash('sha256').update('proyectados-candado:' + (process.env.CANDADO_SECRETO || REDIS_TOKEN)).digest();

async function redis(cmds) {
  if (!REDIS_URL || !REDIS_TOKEN) { const e = new Error('Falta conectar la base de datos'); e.code = 'sin-base'; throw e; }
  const r = await fetch(REDIS_URL + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('redis ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const out = await r.json();
  return out.map(x => { if (x && x.error) throw new Error('redis ' + x.error); return x ? x.result : null; });
}
const hashToObj = arr => {
  const o = {};
  if (Array.isArray(arr)) for (let i = 0; i + 1 < arr.length; i += 2) { try { o[arr[i]] = JSON.parse(arr[i + 1]); } catch { } }
  else if (arr && typeof arr === 'object') for (const [k, v] of Object.entries(arr)) { try { o[k] = JSON.parse(v); } catch { } }
  return o;
};

/* ---------- limpieza de datos ---------- */
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = v => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1e13, Math.round(v))) : 0);
const isoOr = (v, d) => (typeof v === 'string' && ISO.test(v) ? v : d);
const ts = v => (typeof v === 'string' && v.length <= 40 ? v : new Date().toISOString());
function cleanMeta(b) {
  const desde = isoOr(b.desde, null), hasta = isoOr(b.hasta, null);
  if (!desde || !hasta || desde > hasta) return null;
  const tipo = ['mes', 'semana', 'dia', 'custom'].includes(b.tipo) ? b.tipo : 'custom';
  const dias = Array.isArray(b.dias) ? [...new Set(b.dias.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))] : [1, 2, 3, 4, 5, 6];
  const cerrados = Array.isArray(b.cerrados) ? b.cerrados.filter(d => typeof d === 'string' && ISO.test(d)).slice(0, 100) : [];
  return {
    nombre: str(b.nombre, 120) || 'Objetivo', tipo, desde, hasta,
    objMonto: num(b.objMonto), objUnidades: num(b.objUnidades), unidad: str(b.unidad, 40) || 'Equipos',
    dias: dias.length ? dias : [1, 2, 3, 4, 5, 6], cerrados, creado: ts(b.creado), actualizado: ts(b.actualizado),
    // Gastos del local en el período (total), opcional: se descuentan de la utilidad proyectada
    ...(typeof b.gastos === 'number' && isFinite(b.gastos) ? { gastos: num(b.gastos) } : {}),
  };
}
// Ajustes generales por mes, por ahora los gastos de GEO: id "gastos-geo-AAAA-MM"
const AJ = /^gastos-geo-\d{4}-\d{2}$/;
function cleanAjuste(b) { return { monto: num(b.monto), actualizado: ts(b.actualizado) }; }
function cleanAvance(b) {
  if (typeof b.metaId !== 'string' || !ID.test(b.metaId)) return null;
  const fecha = isoOr(b.fecha, null);
  if (!fecha) return null;
  const out = { metaId: b.metaId, fecha, monto: num(b.monto), unidades: num(b.unidades), cerrado: b.cerrado === true, actualizado: ts(b.actualizado) };
  // Vendido en el día (opcional, solo para mostrar en el cierre; la proyección usa el acumulado)
  if (typeof b.diaMonto === 'number' && isFinite(b.diaMonto)) out.diaMonto = num(b.diaMonto);
  if (typeof b.diaUnidades === 'number' && isFinite(b.diaUnidades)) out.diaUnidades = num(b.diaUnidades);
  // Desglose del día: efectivo y tarjeta/QR/otros (sin descontar; diaMonto ya trae el neto)
  if (typeof b.diaEfectivo === 'number' && isFinite(b.diaEfectivo)) out.diaEfectivo = num(b.diaEfectivo);
  if (typeof b.diaOtros === 'number' && isFinite(b.diaOtros)) out.diaOtros = num(b.diaOtros);
  // Utilidad (aparte del cierre): cantidades del día de Claro, equipos y electros; y Servicios financieros: accesorios vendidos (sfEfe/sfOtr quedan por datos viejos)
  for (const k of ['utClaro', 'utEquipos', 'utElectros', 'sfAcc', 'sfEfe', 'sfOtr']) if (typeof b[k] === 'number' && isFinite(b[k])) out[k] = num(b[k]);
  return out;
}

/* ---------- candados ---------- */
const hashClave = (clave, salt) => scryptSync(String(clave).normalize('NFC'), Buffer.from(salt, 'hex'), 32, { N: 16384, r: 8, p: 1 }).toString('hex');
const llaveDe = (id, lock) => createHmac('sha256', SECRET).update(id + ':' + lock.hash).digest('base64url').slice(0, 32);
const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const abierto = (id, meta, llaves) => !meta || !meta.lock || (typeof llaves[id] === 'string' && igual(llaves[id], llaveDe(id, meta.lock)));
function claveOk(clave, lock) { try { return igual(hashClave(clave, lock.salt), lock.hash); } catch { return false; } }
function leerLlaves(v) {
  if (!v) return {};
  try {
    const o = typeof v === 'string' ? JSON.parse(decodeURIComponent(v)) : v;
    const out = {};
    if (o && typeof o === 'object') for (const [k, t] of Object.entries(o).slice(0, 500)) if (ID.test(k) && typeof t === 'string' && t.length <= 64) out[k] = t;
    return out;
  } catch { return {}; }
}

/* Lo que ve cada uno: los objetivos bloqueados "para ver" salen sin números ni avances. */
function vista(rev, metas, avances, llaves, extra, ajustes) {
  const outM = {}, ocultos = new Set();
  for (const [id, m] of Object.entries(metas)) {
    if (!m || typeof m !== 'object') continue;
    const { lock, ...pub } = m;
    if (!lock) { outM[id] = pub; continue; }
    const ok = abierto(id, m, llaves);
    if (!ok && lock.modo === 'ver') {
      ocultos.add(id);
      outM[id] = { nombre: pub.nombre, tipo: pub.tipo, desde: pub.desde, hasta: pub.hasta, creado: pub.creado, candado: 'ver', abierto: false };
    } else outM[id] = { ...pub, candado: lock.modo, abierto: ok };
  }
  const outA = {};
  for (const [id, a] of Object.entries(avances)) if (a && !ocultos.has(a.metaId)) outA[id] = a;
  return { rev: +rev || 0, metas: outM, avances: outA, ajustes: ajustes || {}, ...(PRUEBA ? { prueba: true } : {}), ...extra };
}
async function estado(llaves, extra) {
  const [rev, m, a, j] = await redis([['GET', K.rev], ['HGETALL', K.metas], ['HGETALL', K.avances], ['HGETALL', K.ajustes]]);
  return vista(rev, hashToObj(m), hashToObj(a), llaves, { ...(rev == null ? { nuevo: true } : {}), ...extra }, hashToObj(j));
}
/* Link de prueba: la primera vez copia los datos reales a la copia de prueba (y carga los gastos de noviembre para verlos). */
async function copiaDePrueba() {
  if (!PRUEBA) return;
  const [rev] = await redis([['GET', K.rev]]);
  if (rev != null) return;
  const [r, m, a, j] = await redis([['GET', 'proyectados:rev'], ['HGETALL', 'proyectados:metas'], ['HGETALL', 'proyectados:avances'], ['HGETALL', 'proyectados:ajustes']]);
  const flat = x => Array.isArray(x) ? x : Object.entries(x || {}).flat();
  const metas = hashToObj(m);
  const G = { 'plaza': 10111000, 'ruta 9': 5710000, '9 de julio 1': 4600000, 'general paz': 7500000 };
  const nrm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [id, mt] of Object.entries(metas)) {
    if (!mt || mt.desde > '2026-11-30' || mt.hasta < '2026-11-01' || mt.gastos != null) continue;
    const k = Object.keys(G).find(g => new RegExp('^' + g + '(\\b|\\s|$)').test(nrm(mt.nombre).replace(/\(.*?\)|noviembre|2026/g, '').trim()));
    if (k) metas[id] = { ...mt, gastos: G[k] };
  }
  const cmds = [];
  const mf = Object.entries(metas).flatMap(([id, v]) => [id, JSON.stringify(v)]);
  if (mf.length) cmds.push(['HSET', K.metas, ...mf]);
  const af = flat(a); if (af.length) cmds.push(['HSET', K.avances, ...af]);
  const jf = flat(j); if (jf.length) cmds.push(['HSET', K.ajustes, ...jf]);
  cmds.push(['HSETNX', K.ajustes, 'gastos-geo-2026-11', JSON.stringify({ monto: 56000000, actualizado: new Date().toISOString() })]);
  cmds.push(['SET', K.rev, String((+r || 0) + 1)]);
  await redis(cmds);
}

/* ---------- cambios ---------- */
async function aplicar(ops, llaves) {
  await copiaDePrueba();
  const delAv = ops.filter(o => o && o.col === 'avances' && o.body == null && typeof o.id === 'string' && ID.test(o.id)).map(o => o.id);
  const pre = await redis([['HGETALL', K.metas], ['HLEN', K.avances], ...(delAv.length ? [['HMGET', K.avances, ...delAv]] : [])]);
  const metas = hashToObj(pre[0]);
  let nAv = +pre[1] || 0;
  const avViejos = {};
  if (delAv.length) delAv.forEach((id, i) => { try { avViejos[id] = JSON.parse(pre[2][i]); } catch { } });
  const writes = [], rechazados = [];
  for (const op of ops) {
    const col = op && op.col, id = op && op.id;
    if (!['metas', 'avances', 'ajustes'].includes(col) || typeof id !== 'string' || !ID.test(id)) continue;
    const key = col + '/' + id;
    if (col === 'ajustes') {
      if (!AJ.test(id)) continue;
      if (op.body == null) writes.push(['HDEL', K.ajustes, id]);
      else if (typeof op.body === 'object') writes.push(['HSET', K.ajustes, id, JSON.stringify(cleanAjuste(op.body))]);
      continue;
    }
    if (col === 'metas') {
      const cur = metas[id];
      if (!abierto(id, cur, llaves)) { rechazados.push(key); continue; }
      if (op.body == null) { if (cur) { writes.push(['HDEL', K.metas, id]); delete metas[id]; } continue; }
      if (typeof op.body !== 'object') continue;
      const clean = cleanMeta(op.body);
      if (!clean) continue;
      if (!cur && Object.keys(metas).length >= LIMITS.metas) continue;
      if (cur && cur.lock) clean.lock = cur.lock; // el candado solo cambia con sus acciones propias
      metas[id] = clean;
      writes.push(['HSET', K.metas, id, JSON.stringify(clean)]);
    } else {
      if (op.body == null) {
        const old = avViejos[id];
        if (old && !abierto(old.metaId, metas[old.metaId], llaves)) { rechazados.push(key); continue; }
        writes.push(['HDEL', K.avances, id]);
        continue;
      }
      if (typeof op.body !== 'object') continue;
      const clean = cleanAvance(op.body);
      if (!clean) continue;
      if (!abierto(clean.metaId, metas[clean.metaId], llaves)) { rechazados.push(key); continue; }
      if (nAv >= LIMITS.avances) continue;
      nAv++;
      writes.push(['HSET', K.avances, id, JSON.stringify(clean)]);
    }
  }
  if (writes.length) await redis([...writes, ['INCR', K.rev]]);
  return estado(llaves, rechazados.length ? { rechazados } : {});
}

async function intentos(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim().slice(0, 60);
  const [n] = await redis([['INCR', K.try + ip], ['EXPIRE', K.try + ip, 900]]);
  return +n || 0;
}

async function accion(req, b, llaves) {
  const id = typeof b.id === 'string' && ID.test(b.id) ? b.id : null;
  const getMeta = async () => { if (!id) return null; const [raw] = await redis([['HGET', K.metas, id]]); try { return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const guardar = (meta, extra = []) => redis([['HSET', K.metas, id, JSON.stringify(meta)], ...extra, ['INCR', K.rev]]);

  if (b.accion === 'desbloquear') {
    if ((await intentos(req)) > 15) return [429, { error: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' }];
    const clave = typeof b.clave === 'string' ? b.clave : '';
    const [raw] = await redis([['HGETALL', K.metas]]);
    const metas = hashToObj(raw);
    const nuevas = {};
    if (id) {
      const m = metas[id];
      if (!m || !m.lock) return [404, { error: 'Ese objetivo no tiene candado.' }];
      if (!claveOk(clave, m.lock)) return [401, { error: 'Contraseña incorrecta.' }];
      nuevas[id] = llaveDe(id, m.lock);
    }
    // La misma contraseña abre también los otros objetivos que la usan.
    for (const [mid, m] of Object.entries(metas)) {
      if (!m || !m.lock || nuevas[mid] || abierto(mid, m, llaves)) continue;
      if (claveOk(clave, m.lock)) nuevas[mid] = llaveDe(mid, m.lock);
    }
    if (!Object.keys(nuevas).length) return [401, { error: 'Contraseña incorrecta.' }];
    return [200, await estado({ ...llaves, ...nuevas }, { llaves: nuevas })];
  }

  const meta = await getMeta();
  if (!meta) return [404, { error: 'No encontré ese objetivo.' }];
  if (!abierto(id, meta, llaves)) return [403, { error: 'Primero desbloqueá el objetivo con su contraseña.' }];

  if (b.accion === 'bloquear') {
    const clave = typeof b.clave === 'string' ? b.clave : '';
    if (clave.length < 4 || clave.length > 100) return [400, { error: 'La contraseña tiene que tener al menos 4 caracteres.' }];
    const salt = randomBytes(16).toString('hex');
    meta.lock = { modo: MODOS.includes(b.modo) ? b.modo : 'ver', salt, hash: hashClave(clave, salt) };
    await guardar(meta);
    const nueva = { [id]: llaveDe(id, meta.lock) };
    return [200, await estado({ ...llaves, ...nueva }, { llaves: nueva })];
  }
  if (b.accion === 'modo') {
    if (!meta.lock) return [400, { error: 'Ese objetivo no tiene candado.' }];
    meta.lock.modo = MODOS.includes(b.modo) ? b.modo : meta.lock.modo;
    await guardar(meta);
    return [200, await estado(llaves)];
  }
  if (b.accion === 'quitar') {
    delete meta.lock;
    await guardar(meta);
    return [200, await estado(llaves)];
  }
  return [400, { error: 'Acción desconocida' }];
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url || '/', 'http://local');
  // Las pestañas abiertas con la versión anterior de la página no deben pisar nada: se les pide recargar.
  if (req.headers['x-cliente'] !== '3' && url.searchParams.get('c') !== '3') {
    return res.status(409).json({ error: 'Hay una versión nueva de la página. Recargala para seguir.', recargar: true });
  }
  try {
    if (req.method === 'GET') {
      await copiaDePrueba();
      const llaves = leerLlaves(req.headers['x-llaves'] || url.searchParams.get('llaves'));
      const rev = url.searchParams.get('rev');
      if (rev != null && /^\d+$/.test(rev)) {
        const [cur] = await redis([['GET', K.rev]]);
        if (String(+cur || 0) === rev) return res.status(200).json({ rev: +rev, igual: true });
      }
      return res.status(200).json(await estado(llaves));
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
      if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Formato inválido' });
      const llaves = leerLlaves(body.llaves);
      if (typeof body.accion === 'string') { const [code, out] = await accion(req, body, llaves); return res.status(code).json(out); }
      const ops = Array.isArray(body.ops) ? body.ops.slice(0, 1000) : null;
      if (!ops) return res.status(400).json({ error: 'Formato inválido' });
      return res.status(200).json(await aplicar(ops, llaves));
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    console.error('api/data', e);
    return res.status(e && e.code === 'sin-base' ? 503 : 500).json({ error: e && e.code === 'sin-base' ? 'Falta conectar la base de datos' : 'No se pudo acceder a los datos guardados' });
  }
}
