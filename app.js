(() => {
  'use strict';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- utilidades ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const dow = s => parse(s).getDay();
  const todayISO = () => iso(new Date());
  const isISO = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const clampD = (s, a, b) => s < a ? a : s > b ? b : s;
  const eachDay = (a, b) => { const out = []; if (!isISO(a) || !isISO(b) || a > b) return out; let s = a, g = 0; while (s <= b && g < 400) { out.push(s); s = addDays(s, 1); g++; } return out; };
  const weekStart = s => { const w = dow(s); return addDays(s, w === 0 ? -6 : 1 - w); };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DOW_S = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const DOW_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const CHIPS = [[1, 'L', 'lunes'], [2, 'M', 'martes'], [3, 'X', 'miércoles'], [4, 'J', 'jueves'], [5, 'V', 'viernes'], [6, 'S', 'sábado'], [0, 'D', 'domingo']];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const fShort = s => { const d = parse(s); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`; };
  const fDow = s => `${DOW_S[dow(s)]} ${fShort(s)}`;
  const fNum = s => { const d = parse(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
  const fDM = s => { const d = parse(s); return `${d.getDate()}/${d.getMonth() + 1}`; };
  function fRange(a, b) {
    const A = parse(a), B = parse(b);
    if (a === b) return `${fShort(a)} ${A.getFullYear()}`;
    if (A.getFullYear() === B.getFullYear()) {
      if (A.getMonth() === B.getMonth()) return `${A.getDate()} al ${B.getDate()} de ${MESES[A.getMonth()]} ${A.getFullYear()}`;
      return `${fShort(a)} al ${fShort(b)} ${A.getFullYear()}`;
    }
    return `${fShort(a)} ${A.getFullYear()} al ${fShort(b)} ${B.getFullYear()}`;
  }
  /* Números con punto de miles y coma decimal */
  const grp = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const nf0 = { format: n => { const r = Math.round(+n || 0); return (r < 0 ? '-' : '') + grp(String(Math.abs(r))); } };
  const nf1 = { format: n => { const v = Math.round((+n || 0) * 10) / 10; const [i, d] = Math.abs(v).toFixed(1).split('.'); return (v < 0 ? '-' : '') + grp(i) + ',' + d; } };
  const money = n => '$ ' + nf0.format(n);
  const pct = x => (x == null || !isFinite(x)) ? '—' : nf1.format(x * 100) + ' %';
  const uSmart = n => { if (n == null || !isFinite(n)) return '—'; const r = Math.round(n * 10) / 10; return Number.isInteger(r) ? nf0.format(r) : nf1.format(r); };
  const FMT = { pct, money, units: uSmart };
  function parseNum(str) {
    if (str == null) return null;
    let s = String(str).trim().toLowerCase();
    if (!s) return null;
    let mult = 1;
    if (/m$/.test(s)) mult = 1e6; else if (/k$/.test(s)) mult = 1e3;
    s = s.replace(/[^\d.,-]/g, '');
    if (!s || s === '-') return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s) * mult;
    return isFinite(n) ? n : null;
  }
  function liveFormat(el) {
    const v = el.value;
    if (/[a-z]/i.test(v)) return;
    const caret = el.selectionStart == null ? v.length : el.selectionStart;
    const before = (v.slice(0, caret).match(/[\d,]/g) || []).length;
    const parts = v.replace(/[^\d,]/g, '').split(',');
    let out = grp(parts[0].replace(/^0+(?=\d)/, ''));
    if (parts.length > 1) out += ',' + parts.slice(1).join('').slice(0, 2);
    if (out === v) return;
    el.value = out;
    let pos = 0, seen = 0;
    while (pos < out.length && seen < before) { if (/[\d,]/.test(out[pos])) seen++; pos++; }
    try { el.setSelectionRange(pos, pos); } catch (e) { }
  }
  const uName = (unidad, n) => { const b = (unidad || 'Equipos').toLowerCase(); return (n != null && Math.round(n * 10) === 10 && b.endsWith('s')) ? b.slice(0, -1) : b; };
  function fromLabel(s) {
    if (!s) return '';
    const t = todayISO();
    if (s === t) return 'desde hoy';
    if (s === addDays(t, 1)) return 'desde mañana';
    return `desde el ${fDow(s)}`;
  }
  function diasTxt(d) {
    const k = [...d].sort().join('');
    if (k === '123456') return 'lun a sáb';
    if (k === '12345') return 'lun a vie';
    if (k === '0123456') return 'todos los días';
    return CHIPS.filter(c => d.includes(c[0])).map(c => DOW_S[c[0]]).join(', ');
  }

  /* ---------- estado ---------- */
  const S = {
    loaded: false, online: true, rev: 0, metas: new Map(), avances: new Map(),
    sel: null, plan: 'dia', chart: 'monto',
    formFecha: null, formEstado: null, formErr: '', confirmDel: null,
    enter: true, draw: true, bump: false, celebrate: false,
    llaves: {}, unlockErr: '', unlockBusy: false,
  };
  let lastModel = null, rendering = false, needsRender = false;
  const PREF_KEY = 'proyectados-prefs', CACHE_KEY = 'proyectados-cache', PEND_KEY = 'proyectados-pendientes', KEYS_KEY = 'proyectados-llaves', MIG_KEY = 'proyectados-base-nueva';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  function loadLlaves() { try { const o = JSON.parse(lsGet(KEYS_KEY) || '{}'); if (o && typeof o === 'object') S.llaves = o; } catch (e) { } }
  const saveLlaves = () => lsSet(KEYS_KEY, JSON.stringify(S.llaves));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function restorePrefs() { try { const p = JSON.parse(lsGet(PREF_KEY) || '{}'); if (p.sel) S.sel = p.sel; if (['dia', 'semana'].includes(p.plan)) S.plan = p.plan; if (['monto', 'unidades'].includes(p.chart)) S.chart = p.chart; } catch (e) { } }
  const savePrefs = () => lsSet(PREF_KEY, JSON.stringify({ sel: S.sel, plan: S.plan, chart: S.chart }));

  /* ---------- servidor ---------- */
  const API = '/api/data';
  const pendingOps = new Map(); // "col/id" -> body | null
  let inflight = false, retryT = null;
  function loadPending() { try { const a = JSON.parse(lsGet(PEND_KEY) || '[]'); a.forEach(([k, v]) => pendingOps.set(k, v)); } catch (e) { } }
  const savePending = () => lsSet(PEND_KEY, JSON.stringify([...pendingOps]));
  function stateToMaps(st) {
    S.metas = new Map(Object.entries(st.metas || {}).map(([id, v]) => [id, { ...v, id }]));
    S.avances = new Map(Object.entries(st.avances || {}).map(([id, v]) => [id, { ...v, id }]));
    S.rev = st.rev || 0;
  }
  function applyLocal(key, body) {
    const [col, id] = key.split('/');
    const map = col === 'metas' ? S.metas : S.avances;
    if (body) map.set(id, { ...body, id }); else map.delete(id);
  }
  function cacheState() {
    const obj = m => Object.fromEntries([...m].map(([id, v]) => { const { id: _, ...rest } = v; return [id, rest]; }));
    lsSet(CACHE_KEY, JSON.stringify({ v: 3, rev: S.rev, metas: obj(S.metas), avances: obj(S.avances) }));
  }
  function receive(st) {
    stateToMaps(st);
    pendingOps.forEach((body, key) => applyLocal(key, body));
    cacheState();
  }
  const hdrs = () => ({ 'X-Cliente': '3', 'X-Llaves': encodeURIComponent(JSON.stringify(S.llaves)) });
  async function fetchState(rev) {
    const r = await fetch(API + (rev != null ? '?rev=' + rev : ''), { cache: 'no-store', headers: hdrs() });
    S.sinBase = r.status === 503;
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  /* Datos que quedaron en este dispositivo con la versión anterior (antes de la base nueva): se suben lo que falte. */
  function migrateOldCache(old, st) {
    if (!old) return 0;
    let n = 0;
    [['metas', old.metas, st.metas], ['avances', old.avances, st.avances]].forEach(([col, mine, srv]) => {
      Object.entries(mine || {}).forEach(([id, v]) => {
        if (!v || typeof v !== 'object') return;
        const key = col + '/' + id, s = (srv || {})[id];
        if (pendingOps.has(key)) return;
        if (s && String(s.actualizado || '') >= String(v.actualizado || '')) return;
        if (s && s.candado) return;
        pendingOps.set(key, v); n++;
      });
    });
    if (n) savePending();
    return n;
  }
  function put(col, id, body) {
    const key = col + '/' + id;
    applyLocal(key, body);
    pendingOps.set(key, body);
    savePending(); cacheState();
    requestRender();
    flushSoon();
  }
  let flushT = null;
  function flushSoon() { clearTimeout(flushT); flushT = setTimeout(flush, 250); updateSaving(); }
  async function flush() {
    if (inflight || !pendingOps.size) { updateSaving(); return; }
    inflight = true; updateSaving();
    const batch = [...pendingOps];
    batch.forEach(([k]) => pendingOps.delete(k));
    try {
      const r = await fetch(API, { method: 'POST', headers: { ...hdrs(), 'Content-Type': 'application/json' }, body: JSON.stringify({ llaves: S.llaves, ops: batch.map(([k, body]) => { const [col, id] = k.split('/'); return { col, id, body }; }) }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const st = await r.json();
      S.online = true;
      savePending();
      receive(st);
      if (Array.isArray(st.rechazados) && st.rechazados.length) toast('Hay cambios que no se guardaron: ese objetivo tiene contraseña');
      requestRender();
    } catch (e) {
      batch.forEach(([k, v]) => { if (!pendingOps.has(k)) pendingOps.set(k, v); });
      savePending();
      S.online = false;
      clearTimeout(retryT); retryT = setTimeout(flush, 8000);
      renderNotice();
    } finally {
      inflight = false; updateSaving();
      if (pendingOps.size && S.online) flushSoon();
    }
  }
  async function poll() {
    if (document.visibilityState !== 'visible' || inflight || pendingOps.size) return;
    try {
      const st = await fetchState(S.rev);
      S.online = true;
      if (!st.igual && st.rev !== S.rev) { receive(st); requestRender(); } else renderNotice();
    } catch (e) { S.online = false; renderNotice(); }
    updateSaving();
  }
  /* Acciones del candado: necesitan conexión, no se encolan. */
  async function lockAction(body) {
    for (let i = 0; i < 40 && (inflight || pendingOps.size); i++) { if (!inflight) await flush(); else await sleep(200); if (!S.online) break; }
    let r, out = null;
    try {
      r = await fetch(API, { method: 'POST', headers: { ...hdrs(), 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, llaves: S.llaves }) });
      try { out = await r.json(); } catch (e) { }
    } catch (e) { throw new Error('Sin conexión: probá de nuevo en un rato.'); }
    if (!r.ok) throw new Error((out && out.error) || 'No se pudo completar. Probá de nuevo.');
    S.online = true;
    if (out.llaves) { Object.assign(S.llaves, out.llaves); saveLlaves(); }
    receive(out);
    return out;
  }
  async function refetchAll() {
    try { const st = await fetchState(); S.online = true; receive(st); } catch (e) { S.online = false; }
    requestRender();
  }
  function updateSaving() {
    const el = $('#save-state');
    if (!S.loaded) { el.className = 'save-state busy'; el.innerHTML = '<i></i>Conectando…'; return; }
    if (!S.online) { el.className = 'save-state off'; el.innerHTML = `<i></i>${pendingOps.size ? 'Sin conexión: cambios sin enviar' : 'Sin conexión'}`; return; }
    if (inflight || pendingOps.size) { el.className = 'save-state busy'; el.innerHTML = '<i></i>Guardando…'; return; }
    el.className = 'save-state'; el.innerHTML = '<i></i>Sincronizado';
  }

  /* ---------- objetivo actual ---------- */
  const sortedMetas = () => [...S.metas.values()].filter(m => isISO(m.desde) && isISO(m.hasta)).sort((a, b) => (b.desde || '').localeCompare(a.desde || '') || String(b.creado || '').localeCompare(String(a.creado || '')));
  function currentMeta() {
    if (S.sel && S.metas.has(S.sel)) return S.metas.get(S.sel);
    const list = sortedMetas();
    if (!list.length) return null;
    const t = todayISO();
    const enCurso = list.filter(m => m.desde <= t && t <= m.hasta);
    const cur = enCurso.find(m => !(m.candado && m.abierto !== true && m.candado === 'ver')) || enCurso[0] || list[0];
    S.sel = cur.id;
    return cur;
  }
  const avancesOf = meta => [...S.avances.values()].filter(a => a.metaId === meta.id && isISO(a.fecha) && a.fecha >= meta.desde && a.fecha <= meta.hasta).sort((a, b) => a.fecha.localeCompare(b.fecha));

  /* ---------- cálculos ---------- */
  function buildModel(meta) {
    const dias = Array.isArray(meta.dias) && meta.dias.length ? meta.dias.map(Number) : [1, 2, 3, 4, 5, 6];
    const cerr = new Set(Array.isArray(meta.cerrados) ? meta.cerrados : []);
    const objM = Math.max(0, +meta.objMonto || 0), objU = Math.max(0, +meta.objUnidades || 0);
    const days = eachDay(meta.desde, meta.hasta);
    const isWork = s => dias.includes(dow(s)) && !cerr.has(s);
    const H = days.reduce((a, s) => a + (isWork(s) ? 1 : 0), 0);
    const habHasta = new Map(); let hh = 0;
    days.forEach(s => { if (isWork(s)) hh++; habHasta.set(s, hh); });
    const transAt = (f, cerrado) => { if (f < meta.desde) return 0; if (f > meta.hasta) return H; const prev = habHasta.get(f) - (isWork(f) ? 1 : 0); return prev + (cerrado && isWork(f) ? 1 : 0); };
    const av = avancesOf(meta);
    const t = todayISO();
    const last = av[av.length - 1] || null;
    const ref = last
      ? { fecha: last.fecha, m: +last.monto || 0, u: +last.unidades || 0, cerrado: !!last.cerrado }
      : { fecha: clampD(t, meta.desde, meta.hasta), m: 0, u: 0, cerrado: t > meta.hasta };
    const closed = s => s < ref.fecha || (s === ref.fecha && ref.cerrado);
    const habTrans = transAt(ref.fecha, ref.cerrado);
    const habRest = H - habTrans;
    const vendM = ref.m, vendU = ref.u;
    const faltaM = Math.max(0, objM - vendM), faltaU = Math.max(0, objU - vendU);
    const necM = habRest ? faltaM / habRest : null, necU = habRest ? faltaU / habRest : null;
    const open = days.filter(s => isWork(s) && !closed(s));
    let prevU = vendU;
    const plan = open.map((s, k) => {
      const cumM = vendM + necM * (k + 1);
      const cumU = k === open.length - 1 ? Math.max(vendU, objU) : Math.max(prevU, Math.ceil(vendU + necU * (k + 1) - 1e-9));
      const dayU = cumU - prevU; prevU = cumU;
      return { s, dayM: necM, dayU, cumM, cumU, pM: objM ? cumM / objM : null, pU: objU ? cumU / objU : null };
    });
    const weeks = [];
    plan.forEach(r => { const k = weekStart(r.s); const g = weeks[weeks.length - 1]; if (g && g.k === k) g.rows.push(r); else weeks.push({ k, rows: [r] }); });
    weeks.forEach(g => { g.n = g.rows.length; g.m = g.rows.reduce((x, r) => x + r.dayM, 0); g.u = g.rows.reduce((x, r) => x + r.dayU, 0); g.last = g.rows[g.rows.length - 1]; g.a = g.rows[0].s; g.b = g.last.s; });
    const hist = av.map(a => { const tr = transAt(a.fecha, !!a.cerrado); return { ...a, m: +a.monto || 0, u: +a.unidades || 0, ideal: H ? tr / H : 0, pM: objM ? (+a.monto || 0) / objM : null, pU: objU ? (+a.unidades || 0) / objU : null }; });
    return {
      meta, days, H, dias, cerr, habHasta, objM, objU, ref, last, av, hist,
      vendM, vendU, habTrans, habRest, faltaM, faltaU, necM, necU, plan, weeks,
      pM: objM ? vendM / objM : null, pU: objU ? vendU / objU : null,
      esperado: H ? habTrans / H : 0,
      ritmoM: habTrans ? vendM / habTrans : null, ritmoU: habTrans ? vendU / habTrans : null,
      proyM: habTrans ? vendM / habTrans * H : null, proyU: habTrans ? vendU / habTrans * H : null,
      firstOpen: open[0] || null,
      unidad: String(meta.unidad || '').trim() || 'Equipos',
      started: habTrans > 0, ended: H > 0 && habRest === 0,
      antes: t < meta.desde, despues: t > meta.hasta,
    };
  }
  function status(p, esperado, started, ended) {
    if (p == null) return { k: '', t: '' };
    if (p >= 1) return { k: 'ok', t: 'Cumplido' };
    if (ended) return { k: 'bad', t: 'No alcanzado' };
    if (!started || esperado <= 0) return { k: '', t: 'Recién empieza' };
    const ratio = p / esperado;
    if (ratio >= 1) return { k: 'ok', t: 'En ritmo' };
    if (ratio >= 0.9) return { k: 'warn', t: 'Cerca del ritmo' };
    return { k: 'bad', t: 'Debajo del ritmo' };
  }
  const done = M => (!M.objM || M.pM >= 1) && (!M.objU || M.pU >= 1);

  /* Número que cuenta hasta su valor */
  const num = (key, v, f) => `<span class="num" data-k="${key}" data-v="${v == null ? '' : v}" data-f="${f}">${v == null ? '—' : FMT[f](v)}</span>`;

  /* ---------- candados ---------- */
  const isLocked = m => !!(m && m.candado);
  const isOpen = m => !m || !m.candado || m.abierto === true;
  const hidden = m => isLocked(m) && !isOpen(m) && m.candado === 'ver';
  const canEdit = m => isOpen(m);
  const ICO = {
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10.5" rx="2.6"/><path class="shackle" d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.6" r="1.4" fill="currentColor" stroke="none"/></svg>',
    open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10.5" rx="2.6"/><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7"/><circle cx="12" cy="15.6" r="1.4" fill="currentColor" stroke="none"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  };
  const TIPO_L = { mes: 'Objetivo mensual', semana: 'Objetivo semanal', dia: 'Objetivo diario', custom: 'Objetivo por período' };

  function headCtrlHTML(meta) {
    const b = [];
    if (canEdit(meta)) b.push(`<button type="button" class="btn sm ghost-ico" id="btn-edit">${ICO.edit}Editar</button>`);
    if (!isLocked(meta)) b.push(`<button type="button" class="btn sm ghost-ico" id="btn-lock">${ICO.lock}Poner contraseña</button>`);
    else if (isOpen(meta)) b.push(`<button type="button" class="btn sm ghost-ico" id="btn-lock">${ICO.open}Contraseña</button><span class="chip lockchip open">${ICO.open}Desbloqueado en este dispositivo</span>`);
    else b.push(`<span class="chip lockchip">${ICO.lock}${meta.candado === 'ver' ? 'Protegido con contraseña' : 'Solo lectura sin contraseña'}</span>`);
    return `<div class="head-ctrl">${b.join('')}</div>`;
  }

  /* ---------- piezas de HTML ---------- */
  function headHTML(M, i) {
    const meta = M.meta;
    let side;
    if (M.antes) side = `<span class="flag">Arranca el ${fDow(meta.desde)}</span>`;
    else if (M.despues) side = `<span class="flag">Terminó el ${fDow(meta.hasta)}</span>`;
    else {
      const C = 2 * Math.PI * 24, p = M.H ? M.habTrans / M.H : 0;
      side = `<div class="days-ring"><svg viewBox="0 0 58 58" aria-hidden="true"><circle class="ring-bg" cx="29" cy="29" r="24"/><circle class="ring-fg" cx="29" cy="29" r="24" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - p)).toFixed(2)}" data-ring="${(C * (1 - p)).toFixed(2)}" data-c="${C.toFixed(2)}"/></svg><p class="t"><b>${M.habRest} días hábiles</b>quedan de ${M.H}</p></div>`;
    }
    const cerr = M.cerr.size ? ` · ${M.cerr.size} ${M.cerr.size === 1 ? 'feriado' : 'feriados'}` : '';
    return `<section class="head rise" style="--i:${i}">
      <div><p class="eyebrow">${TIPO_L[meta.tipo] || 'Objetivo'} · ${fRange(meta.desde, meta.hasta)}</p>
      <h2>${esc(meta.nombre || 'Sin nombre')}</h2>
      <p class="sub">${M.H} días hábiles (${diasTxt(M.dias)}${cerr}) · ${M.habTrans} transcurridos</p>
      ${headCtrlHTML(meta)}</div>
      ${side}
    </section>`;
  }
  function lockedHeadHTML(meta, i) {
    return `<section class="head rise" style="--i:${i}">
      <div><p class="eyebrow">${TIPO_L[meta.tipo] || 'Objetivo'} · ${fRange(meta.desde, meta.hasta)}</p>
      <h2>${esc(meta.nombre || 'Sin nombre')}</h2>
      ${headCtrlHTML(meta)}</div>
    </section>`;
  }
  function unlockHTML(meta, i, compact) {
    const msg = meta.candado === 'ver'
      ? 'Este objetivo tiene contraseña. Escribila para ver cuánto se vendió y cuánto falta.'
      : 'Podés ver el avance, pero para cargar ventas o cambiar el objetivo necesitás la contraseña.';
    return `<section class="glass panel lock-panel${compact ? ' compact' : ''} rise" style="--i:${i}" aria-labelledby="unlock-h">
      <div class="lock-orb" aria-hidden="true">${ICO.lock}</div>
      <div class="lock-body">
        <h2 id="unlock-h">${meta.candado === 'ver' ? 'Objetivo protegido' : 'Solo lectura'}</h2>
        <p class="muted">${msg}</p>
        <form class="unlock-row" id="unlock-form" novalidate>
          <input type="password" id="unlock-in" autocomplete="current-password" placeholder="Contraseña" aria-label="Contraseña del objetivo"${S.unlockBusy ? ' disabled' : ''}>
          <button type="submit" class="btn primary" id="unlock-go"${S.unlockBusy ? ' disabled' : ''}>${S.unlockBusy ? 'Abriendo…' : 'Desbloquear'}</button>
        </form>
        ${S.unlockErr ? `<p class="err" role="alert">${esc(S.unlockErr)}</p>` : ''}
      </div>
    </section>`;
  }

  function entryHTML(M, i) {
    const meta = M.meta;
    const t = todayISO();
    const fecha = S.formFecha && S.formFecha >= meta.desde && S.formFecha <= meta.hasta ? S.formFecha : clampD(t, meta.desde, meta.hasta);
    const there = S.avances.get(meta.id + '__' + fecha);
    const base = there || M.last;
    const cerrado = S.formEstado != null ? S.formEstado === 'cerrado' : there ? !!there.cerrado : fecha < t;
    const esHoy = fecha === t;
    const diaTxt = esHoy ? 'hoy' : `el ${fDow(fecha)}`;
    const lastTxt = M.last ? `Último dato: ${money(M.last.monto)}${M.objU ? ` y ${uSmart(M.last.unidades)} ${esc(uName(M.unidad, M.last.unidades))}` : ''} al ${fDow(M.last.fecha)}.` : 'Todavía no cargaste ningún dato para este objetivo.';
    return `<section class="glass panel entry rise" style="--i:${i}" aria-labelledby="entry-h">
      <div class="panel-head"><div><h2 id="entry-h">Vendido hasta el momento</h2><p>Poné el total acumulado desde que empezó el período. ${lastTxt}</p></div></div>
      <div class="entry-grid">
        <label class="fld date"><span>Al día</span><input type="date" id="f-fecha" min="${meta.desde}" max="${meta.hasta}" value="${fecha}"></label>
        ${M.objM ? `<label class="fld big"><span>Monto vendido acumulado</span><input id="f-m" inputmode="decimal" autocomplete="off" placeholder="$ 0" value="${base ? nf0.format(base.monto) : ''}"></label>` : ''}
        ${M.objU ? `<label class="fld big"><span>${esc(M.unidad)} vendidos acumulados</span><input id="f-u" inputmode="numeric" autocomplete="off" placeholder="0" value="${base ? nf0.format(base.unidades) : ''}"></label>` : ''}
        <button type="button" class="btn primary lg" id="f-save">Calcular</button>
      </div>
      <fieldset class="estado">
        <legend>¿${esHoy ? 'Hoy' : cap(fDow(fecha))} todavía se vende?</legend>
        <label class="opt"><input type="radio" name="f-estado" id="f-abierto" value="abierto"${cerrado ? '' : ' checked'}><span>Sí, ${diaTxt} cuenta como día para vender</span></label>
        <label class="opt"><input type="radio" name="f-estado" id="f-cerrado" value="cerrado"${cerrado ? ' checked' : ''}><span>No, ${diaTxt} ya cerró</span></label>
      </fieldset>
      ${S.formErr ? `<p class="err" role="alert">${esc(S.formErr)}</p>` : ''}
    </section>`;
  }

  function meterHTML(o) {
    const fill = o.p == null ? 0 : Math.max(0, Math.min(1, o.p)) * 100;
    const mark = o.mark != null && o.mark > 0 && o.mark < 1 ? `<span class="mark" style="left:${(o.mark * 100).toFixed(2)}%" title="Ritmo ideal a la fecha"></span>` : '';
    return `<article class="glass meter rise" style="--i:${o.i}" data-tilt>
      <header class="meter-top"><h3>${o.label}</h3>${o.st.t ? `<span class="chip ${o.st.k}">${o.st.t}</span>` : ''}</header>
      <p class="meter-big">${num(o.key, o.p, 'pct')}</p>
      <p class="meter-sub">${o.sub}</p>
      <div class="track" role="img" aria-label="${esc(o.aria || '')}"><span class="fill ${o.st.k}" data-w="${fill.toFixed(2)}" data-k="${o.key}" style="width:${fill.toFixed(2)}%"></span>${mark}</div>
      <dl class="meter-foot">${o.foot.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>
    </article>`;
  }
  const ideal = '<i class="mk" aria-hidden="true"></i>';
  function metersHTML(M, i) {
    const out = [];
    if (M.objM) out.push(meterHTML({
      i, key: 'pM', label: 'Monto vendido', p: M.pM, mark: M.esperado, st: status(M.pM, M.esperado, M.started, M.ended),
      sub: `<b>${num('vM', M.vendM, 'money')}</b> de ${money(M.objM)}`, aria: `${pct(M.pM)} del objetivo en pesos; ritmo ideal ${pct(M.esperado)}`,
      foot: [[ideal + 'Ritmo ideal a la fecha', pct(M.esperado)], ['Proyección al cierre', M.proyM != null ? `${money(M.proyM)} <small>${pct(M.proyM / M.objM)}</small>` : '—'], ['Faltan', money(M.faltaM)]],
    }));
    if (M.objU) out.push(meterHTML({
      i: i + 1, key: 'pU', label: `${esc(M.unidad)} vendidos`, p: M.pU, mark: M.esperado, st: status(M.pU, M.esperado, M.started, M.ended),
      sub: `<b>${num('vU', M.vendU, 'units')}</b> de ${uSmart(M.objU)} ${esc(uName(M.unidad, M.objU))}`, aria: `${pct(M.pU)} del objetivo en unidades`,
      foot: [[ideal + 'Ritmo ideal a la fecha', pct(M.esperado)], ['Proyección al cierre', M.proyU != null ? `${uSmart(M.proyU)} <small>${pct(M.proyU / M.objU)}</small>` : '—'], ['Faltan', `${uSmart(M.faltaU)} ${esc(uName(M.unidad, M.faltaU))}`]],
    }));
    return out.join('');
  }

  const gRow = (a, b) => `<div class="g-row"><span>${a}</span><span>${b}</span></div>`;
  function goalHTML(M, i) {
    const u = n => esc(uName(M.unidad, n));
    const orbs = '<span class="orb o1" aria-hidden="true"></span><span class="orb o2" aria-hidden="true"></span>';
    const head = `<p class="g-eyebrow">Para llegar al 100 %</p><p class="g-sub">${esc(M.meta.nombre || '')}${M.last ? ' · dato al ' + fDow(M.last.fecha) : ''}</p>`;
    const open = `<aside class="goal rise" style="--i:${i}" data-tilt aria-label="Lo que falta para el 100 %">${orbs}${head}<hr>`;
    if (M.H === 0) return `${open}<p class="g-note">Este objetivo no tiene días hábiles. Revisá los días que se trabaja.</p></aside>`;
    if (M.ended || done(M)) {
      return `${open}
        <p class="g-big">${done(M) ? '¡Objetivo cumplido!' : 'Período terminado'}</p>
        ${M.objM ? gRow('Monto', pct(M.pM)) : ''}${M.objU ? gRow(esc(M.unidad), pct(M.pU)) : ''}
        <hr>
        ${M.objM ? gRow(M.vendM >= M.objM ? 'Superado por' : 'Quedaron', money(Math.abs(M.vendM - M.objM))) : ''}
        ${M.objU ? gRow(M.vendU >= M.objU ? 'Superado por' : 'Quedaron', `${uSmart(Math.abs(M.vendU - M.objU))} ${u(Math.abs(M.vendU - M.objU))}`) : ''}
        ${!M.ended && M.habRest ? `<hr><p class="g-note">Quedan ${M.habRest} días hábiles. Todo lo que se venda ahora es extra.</p>` : ''}
      </aside>`;
    }
    const wk = M.weeks[0];
    let cmp = '';
    const rN = M.objM ? M.necM : M.necU, rR = M.objM ? M.ritmoM : M.ritmoU;
    if (rR != null && rR > 0) {
      const d = rN / rR - 1;
      cmp = d > 0.005 ? `<p class="g-note">Hay que vender <b>${pct(d)} más</b> por día que el ritmo actual.</p>` : `<p class="g-note">Con el ritmo actual <b>llegás</b> (sobra ${pct(-d)} por día).</p>`;
    }
    const uRange = M.necU != null && Math.abs(M.necU - Math.round(M.necU)) > 1e-6 ? `<p class="g-note">O sea, entre ${Math.floor(M.necU)} y ${Math.ceil(M.necU)} por día</p>` : '';
    return `${open}
      ${M.objM ? gRow('Faltan', money(M.faltaM)) : ''}
      ${M.objU ? gRow(M.objM ? '' : 'Faltan', `${uSmart(M.faltaU)} ${u(M.faltaU)}`) : ''}
      ${gRow('Días hábiles que quedan', M.habRest)}
      <hr>
      <p class="g-label">Por día, ${fromLabel(M.firstOpen)}</p>
      ${M.objM ? `<p class="g-big">${num('necM', M.necM, 'money')}</p>` : ''}
      ${M.objU ? `<p class="${M.objM ? 'g-mid' : 'g-big'}">${num('necU', M.necU, 'units')} ${u(M.necU)}</p>${uRange}` : ''}
      ${wk ? `<hr><p class="g-label">${wk.k === weekStart(todayISO()) ? 'Esta semana' : 'Semana del ' + fShort(wk.a)} · ${wk.n} ${wk.n === 1 ? 'día' : 'días'}</p>
        ${M.objM ? gRow('Vender', money(wk.m)) : ''}${M.objU ? gRow(M.objM ? '' : 'Vender', `${nf0.format(wk.u)} ${u(wk.u)}`) : ''}` : ''}
      ${M.started ? `<hr>
        ${M.objM ? gRow('Ritmo actual', money(M.ritmoM) + '/día') : ''}
        ${M.objU ? gRow(M.objM ? '' : 'Ritmo actual', uSmart(M.ritmoU) + '/día') : ''}
        ${cmp}` : ''}
    </aside>`;
  }

  function planHTML(M, i) {
    const U = esc(M.unidad);
    const tog = `<div class="seg" role="group" aria-label="Ver el plan"><button type="button" data-plan="dia" aria-pressed="${S.plan === 'dia'}">Por día</button><button type="button" data-plan="semana" aria-pressed="${S.plan === 'semana'}">Por semana</button></div>`;
    const head = `<div class="panel-head"><div><h2 id="plan-h">Lo que hay que vender para llegar al 100 %</h2><p>Lo que falta repartido en los ${M.habRest} días hábiles que quedan. El acumulado dice cuánto deberías llevar al cierre de cada ${S.plan === 'dia' ? 'día' : 'semana'}.</p></div>${tog}</div>`;
    if (!M.plan.length || done(M)) {
      const msg = done(M) ? 'El objetivo ya está cumplido: no hace falta vender más para llegar al 100 %. Todo lo que se venda ahora es extra.' : 'El período ya terminó.';
      return `<section class="glass panel rise" style="--i:${i}" aria-labelledby="plan-h">${head}<p class="muted">${msg}</p></section>`;
    }
    const t = todayISO(), wt = weekStart(t);
    const cM = (M.objM ? 1 : 0), cU = (M.objU ? 1 : 0);
    let body, cols;
    if (S.plan === 'dia') {
      cols = `<tr class="grp"><th></th><th colspan="${cM + cU}"><span>Vender ese día</span></th><th colspan="${2 * cM + 2 * cU}"><span>Acumulado al cierre del día</span></th></tr>
        <tr><th class="l" scope="col">Día</th>${cM ? '<th scope="col">Pesos</th>' : ''}${cU ? `<th scope="col">${U}</th>` : ''}${cM ? '<th scope="col">Pesos</th><th scope="col">% obj.</th>' : ''}${cU ? `<th scope="col">${U}</th><th scope="col">% obj.</th>` : ''}</tr>`;
      body = M.plan.map((r, k) => {
        const nextWk = M.plan[k + 1] ? weekStart(M.plan[k + 1].s) !== weekStart(r.s) : false;
        const cls = [r.s === t && 'hl', nextWk && 'wk-end'].filter(Boolean).join(' ');
        return `<tr class="${cls}" style="--r:${Math.min(k, 24)}"><th scope="row" class="l"><span class="d-dow">${DOW_S[dow(r.s)]}</span>${fDM(r.s)}${r.s === t ? '<span class="tag">hoy</span>' : ''}</th>
          ${cM ? `<td>${money(r.dayM)}</td>` : ''}${cU ? `<td>${nf0.format(r.dayU)}</td>` : ''}
          ${cM ? `<td>${money(r.cumM)}</td><td>${pct(r.pM)}</td>` : ''}${cU ? `<td>${nf0.format(r.cumU)}</td><td>${pct(r.pU)}</td>` : ''}</tr>`;
      }).join('');
    } else {
      cols = `<tr class="grp"><th></th><th></th><th colspan="${cM + cU}"><span>Vender en la semana</span></th><th colspan="${2 * cM + 2 * cU}"><span>Acumulado al cierre de la semana</span></th></tr>
        <tr><th class="l" scope="col">Semana</th><th scope="col">Días háb.</th>${cM ? '<th scope="col">Pesos</th>' : ''}${cU ? `<th scope="col">${U}</th>` : ''}${cM ? '<th scope="col">Pesos</th><th scope="col">% obj.</th>' : ''}${cU ? `<th scope="col">${U}</th><th scope="col">% obj.</th>` : ''}</tr>`;
      body = M.weeks.map((g, k) => `<tr class="${g.k === wt ? 'hl' : ''}" style="--r:${k}"><th scope="row" class="l">${fShort(g.a)}${g.a !== g.b ? ' – ' + fShort(g.b) : ''}${g.k === wt ? '<span class="tag">esta semana</span>' : ''}</th><td>${g.n}</td>
        ${cM ? `<td>${money(g.m)}</td>` : ''}${cU ? `<td>${nf0.format(g.u)}</td>` : ''}
        ${cM ? `<td>${money(g.last.cumM)}</td><td>${pct(g.last.pM)}</td>` : ''}${cU ? `<td>${nf0.format(g.last.cumU)}</td><td>${pct(g.last.pU)}</td>` : ''}</tr>`).join('');
    }
    const totM = M.plan.reduce((x, r) => x + r.dayM, 0), totU = M.plan.reduce((x, r) => x + r.dayU, 0);
    const foot = `<tr><th scope="row" class="l">Total a vender</th>${S.plan === 'semana' ? `<td>${M.habRest}</td>` : ''}${cM ? `<td>${money(totM)}</td>` : ''}${cU ? `<td>${nf0.format(totU)}</td>` : ''}<td colspan="${2 * cM + 2 * cU}"></td></tr>`;
    return `<section class="glass panel rise" style="--i:${i}" data-rv="plan" aria-labelledby="plan-h">${head}
      <div class="tbl-wrap"><table><thead>${cols}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>
      ${cU && M.necU != null && Math.abs(M.necU - Math.round(M.necU)) > 1e-6 ? `<p class="note">Los ${U.toLowerCase()} van en números enteros: algunos días toca ${Math.floor(M.necU)} y otros ${Math.ceil(M.necU)}, y el total da justo el objetivo.</p>` : ''}
    </section>`;
  }

  function histHTML(M, i) {
    if (!M.hist.length) return '';
    const rows = M.hist.slice().reverse().map((a, k) => {
      const st = M.objM ? status(a.pM, a.ideal, a.ideal > 0, false) : status(a.pU, a.ideal, a.ideal > 0, false);
      const del = !canEdit(M.meta) ? ''
        : S.confirmDel === a.id
        ? `<span class="del-inline"><button type="button" class="btn sm danger solid" data-del-yes="${esc(a.id)}">Sí, borrar</button><button type="button" class="btn sm" data-del-no="1">No</button></span>`
        : `<button type="button" class="btn sm danger" data-del="${esc(a.id)}">Borrar</button>`;
      return `<tr style="--r:${Math.min(k, 24)}"><th scope="row" class="l"><span class="d-dow">${DOW_S[dow(a.fecha)]}</span>${fDM(a.fecha)} <span class="muted" style="font-size:12px;font-weight:500">${a.cerrado ? 'cerrado' : 'en curso'}</span></th>
        ${M.objM ? `<td>${money(a.m)}</td><td>${pct(a.pM)}</td>` : ''}${M.objU ? `<td>${nf0.format(a.u)}</td><td>${pct(a.pU)}</td>` : ''}
        <td>${pct(a.ideal)}</td><td>${st.t ? `<span class="chip ${st.k}">${st.t}</span>` : ''}</td><td>${del}</td></tr>`;
    }).join('');
    return `<section class="glass panel rise" style="--i:${i}" data-rv="hist" aria-labelledby="hist-h">
      <div class="panel-head"><div><h2 id="hist-h">Avances cargados</h2><p>Cada vez que actualizás el acumulado queda registrado acá, con el porcentaje parcial de ese momento. Para el cálculo se usa el más reciente.</p></div></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th class="l" scope="col">Fecha</th>${M.objM ? '<th scope="col">Pesos</th><th scope="col">% obj.</th>' : ''}${M.objU ? `<th scope="col">${esc(M.unidad)}</th><th scope="col">% obj.</th>` : ''}<th scope="col">Ritmo ideal</th><th scope="col">Estado</th><th scope="col"><span class="muted">&nbsp;</span></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </section>`;
  }

  function chartCardHTML(M, i) {
    if (!M.H || (!M.objM && !M.objU)) return '';
    const both = M.objM && M.objU;
    if (S.chart === 'monto' && !M.objM) S.chart = 'unidades';
    if (S.chart === 'unidades' && !M.objU) S.chart = 'monto';
    return `<section class="glass panel rise" style="--i:${i}" data-rv="chart" aria-labelledby="ch-h">
      <div class="panel-head"><div><h2 id="ch-h">Acumulado contra el objetivo</h2></div>
        <div class="chart-tools">
          ${both ? `<div class="seg" role="group" aria-label="Qué graficar"><button type="button" data-chart="monto" aria-pressed="${S.chart === 'monto'}">Pesos</button><button type="button" data-chart="unidades" aria-pressed="${S.chart === 'unidades'}">${esc(M.unidad)}</button></div>` : ''}
          <span class="lgd"><i></i>Real</span><span class="lgd"><i class="ideal"></i>Ritmo ideal</span><span class="lgd"><i class="proj"></i>Proyección</span>
        </div>
      </div>
      <div id="chart-wrap"></div>
    </section>`;
  }
  function chartSVG(M, metric, W, animate) {
    const isM = metric === 'monto';
    const obj = isM ? M.objM : M.objU;
    const days = M.days, n = days.length;
    if (!n || !obj || !M.H) return '<p class="muted">No hay objetivo para graficar.</p>';
    W = Math.max(280, Math.round(W));
    const Hh = W < 480 ? 230 : 280, pl = isM ? (W < 480 ? 86 : 98) : 44, pr = 16, pt = 22, pb = 30;
    const iw = W - pl - pr, ih = Hh - pt - pb;
    const X = tt => pl + tt * iw / n;
    const val = a => isM ? (+a.monto || 0) : (+a.unidades || 0);
    const pts = [{ tt: 0, v: 0 }].concat(M.av.map(a => ({ tt: days.indexOf(a.fecha) + (a.cerrado ? 1 : 0.5), v: val(a) })));
    const lastP = pts[pts.length - 1];
    const proy = isM ? M.proyM : M.proyU;
    const maxV = Math.max(...pts.map(p => p.v));
    // Si la proyección se dispara (pocos días cargados), se recorta para no aplastar el gráfico.
    const top = Math.min(Math.max(obj, proy || 0, maxV) * 1.08, Math.max(obj, maxV) * 1.35);
    const Y = v => pt + ih * (1 - Math.min(v, top) / top);
    const f = v => isM ? money(v) : uSmart(v);
    let s = `<svg viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" class="${animate && !reduceMotion ? 'draw' : 'drawn'}" role="img" aria-label="Acumulado ${isM ? 'en pesos' : 'en unidades'} contra el ritmo ideal y el objetivo">
      <defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f97316" stop-opacity="0.38"/><stop offset="1" stop-color="#f97316" stop-opacity="0"/></linearGradient></defs>`;
    [0, .25, .5, .75, 1].forEach(fr => {
      const y = Y(obj * fr).toFixed(1);
      s += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" class="${fr === 1 ? 'g-obj' : 'g'}"/>`;
      s += `<text x="${pl - 10}" y="${(+y + 4).toFixed(1)}" text-anchor="end" class="ax${fr === 1 ? ' strong' : ''}">${f(obj * fr)}</text>`;
    });
    s += `<text x="${pl + 6}" y="${(Y(obj) - 7).toFixed(1)}" class="ax strong">Objetivo</text>`;
    let lastX = -99;
    days.forEach((d, i) => {
      if (!(i === 0 || i === n - 1 || dow(d) === 1)) return;
      const x = X(i + 0.5);
      if (x - lastX < 30) return;
      lastX = x;
      s += `<text x="${x.toFixed(1)}" y="${Hh - 8}" text-anchor="middle" class="ax">${fDM(d)}</text>`;
    });
    const idealPts = [`${X(0).toFixed(1)},${Y(0).toFixed(1)}`].concat(days.map((d, i) => `${X(i + 1).toFixed(1)},${Y(obj * M.habHasta.get(d) / M.H).toFixed(1)}`)).join(' ');
    s += `<polyline points="${idealPts}" class="l-ideal"/>`;
    if (pts.length > 1) {
      const line = pts.map(p => `${X(p.tt).toFixed(1)},${Y(p.v).toFixed(1)}`);
      s += `<path d="M${line.join(' L')} L${X(lastP.tt).toFixed(1)},${Y(0).toFixed(1)} Z" class="a-real" fill="url(#gA)"/>`;
      if (lastP.tt < n) {
        s += `<line x1="${X(lastP.tt).toFixed(1)}" x2="${X(lastP.tt).toFixed(1)}" y1="${pt}" y2="${(pt + ih).toFixed(1)}" class="l-corte"/>`;
        if (proy != null) {
          const x0 = X(lastP.tt), xN = X(n);
          const x2 = proy > top && proy > lastP.v ? x0 + (top - lastP.v) / (proy - lastP.v) * (xN - x0) : xN;
          s += `<line x1="${x0.toFixed(1)}" y1="${Y(lastP.v).toFixed(1)}" x2="${x2.toFixed(1)}" y2="${Y(proy).toFixed(1)}" class="l-proj"/>`;
          const py = Y(proy), oy = Y(obj);
          const ly = Math.abs(py - oy) < 14 ? (py <= oy ? py - 9 : py + 17) : py - 9;
          s += `<text x="${(W - pr).toFixed(1)}" y="${Math.max(14, Math.min(pt + ih - 4, ly)).toFixed(1)}" text-anchor="end" class="v-proj">Proy. ${f(proy)}${proy > top ? ' ↗' : ''}</text>`;
        }
      }
      s += `<polyline points="${line.join(' ')}" class="l-real" pathLength="1"/>`;
      pts.slice(1, -1).forEach(p => { s += `<circle cx="${X(p.tt).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="4" class="p-pt"/>`; });
      const ex = X(lastP.tt), ey = Y(lastP.v);
      s += `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="5" class="p-halo"/><circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="5.5" class="p-end"/>`;
      const right = ex > pl + iw * 0.6;
      s += `<text x="${(right ? ex - 10 : ex + 10).toFixed(1)}" y="${(ey - 12).toFixed(1)}" text-anchor="${right ? 'end' : 'start'}" class="v-lbl">${f(lastP.v)}</text>`;
    }
    return s + '</svg>';
  }
  function drawChart(animate) {
    const wrap = document.getElementById('chart-wrap');
    if (!wrap || !lastModel) return;
    wrap.innerHTML = chartSVG(lastModel, S.chart, wrap.clientWidth || 640, animate);
  }

  function emptyHTML() {
    return `<section class="glass panel empty rise">
      <p class="eyebrow">Empezá acá</p>
      <h2>Todavía no hay objetivos cargados</h2>
      <p class="muted" style="max-width:62ch">Creá un objetivo con el monto en pesos y la cantidad de equipos a vender. Después cargás cuánto llevás vendido y la página calcula el porcentaje cumplido y cuánto hay que vender por día para llegar al 100 %.</p>
      <ol class="steps">
        <li class="glass soft"><b>Definí el objetivo</b>Mensual, semanal, diario o con fechas a medida.</li>
        <li class="glass soft"><b>Poné lo vendido hasta hoy</b>Un solo número acumulado, cuando quieras.</li>
        <li class="glass soft"><b>Mirá lo que falta</b>Porcentaje parcial, proyección y lo necesario por día y por semana.</li>
      </ol>
      <div><button type="button" class="btn primary lg" id="empty-new">Crear el primer objetivo</button></div>
    </section>`;
  }
  function loadingHTML() {
    return `<section class="glass panel" aria-busy="true"><p class="eyebrow">Cargando objetivos…</p><div class="skel" style="width:60%"></div><div class="skel" style="width:40%"></div><div class="skel" style="width:75%"></div></section>`;
  }

  function mainHTML() {
    lastModel = null;
    if (!S.loaded) return loadingHTML();
    const meta = currentMeta();
    if (!meta) return emptyHTML();
    if (hidden(meta)) return lockedHeadHTML(meta, 0) + unlockHTML(meta, 1, false);
    const M = buildModel(meta);
    if (!M.days.length) return `<section class="glass panel"><h2>Este objetivo tiene fechas inválidas</h2><p class="muted">Abrí "Editar" y corregí el período.</p></section>`;
    lastModel = M;
    return headHTML(M, 0)
      + (canEdit(meta) ? entryHTML(M, 1) : unlockHTML(meta, 1, true))
      + `<section class="summary"><div class="meters">${metersHTML(M, 2)}</div>${goalHTML(M, 4)}</section>`
      + planHTML(M, 5)
      + chartCardHTML(M, 6)
      + histHTML(M, 7)
      + `<div class="actions rise" style="--i:8">
          <button type="button" class="btn" id="act-copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>Copiar resumen</button>
          <button type="button" class="btn" id="act-csv"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16"/></svg>Descargar plan (CSV)</button>
          <span class="muted" style="font-size:13px">El resumen sale listo para pegar en WhatsApp o en un mail.</span>
        </div>
        <textarea id="copy-fallback" readonly hidden aria-label="Resumen para copiar"></textarea>`;
  }

  /* ---------- animaciones de valores ---------- */
  const prevVals = new Map(), prevW = new Map();
  let firstPaint = true;
  function animateNumbers() {
    document.querySelectorAll('#main .num').forEach(el => {
      const k = el.dataset.k, raw = el.dataset.v, f = FMT[el.dataset.f];
      if (raw === '') { prevVals.delete(k); return; }
      const v = +raw;
      const from = prevVals.has(k) ? prevVals.get(k) : (firstPaint ? 0 : v);
      prevVals.set(k, v);
      if (reduceMotion || from === v) return;
      const t0 = performance.now(), dur = 1100;
      el.textContent = f(from);
      const step = now => {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = f(from + (v - from) * e);
        if (p < 1 && el.isConnected) requestAnimationFrame(step); else if (el.isConnected) el.textContent = f(v);
      };
      requestAnimationFrame(step);
    });
    document.querySelectorAll('#main .fill').forEach(el => {
      const k = el.dataset.k, w = +el.dataset.w;
      const from = prevW.has(k) ? prevW.get(k) : (firstPaint ? 0 : w);
      prevW.set(k, w);
      if (reduceMotion || from === w) return;
      el.style.transition = 'none'; el.style.width = from + '%';
      el.getBoundingClientRect();
      el.style.transition = ''; requestAnimationFrame(() => { el.style.width = w + '%'; });
    });
    document.querySelectorAll('#main .ring-fg').forEach(el => {
      if (reduceMotion || !firstPaint && !S.enterNow) return;
      const target = el.dataset.ring;
      el.style.transition = 'none'; el.style.strokeDashoffset = el.dataset.c; el.getBoundingClientRect();
      el.style.transition = ''; requestAnimationFrame(() => { el.style.strokeDashoffset = target; });
    });
  }

  /* ---------- render ---------- */
  const main = $('#main');
  function requestRender() { if (rendering) { needsRender = true; return; } render(); }
  function render() {
    rendering = true;
    try {
      currentMeta();
      renderHeader();
      renderNotice();
      const ae = document.activeElement;
      const focus = ae && ae.id && main.contains(ae) ? { id: ae.id, a: ae.selectionStart, b: ae.selectionEnd } : null;
      const dirty = {};
      main.querySelectorAll('input[data-dirty="1"]').forEach(el => { dirty[el.id] = el.value; });
      const enter = S.enter && S.loaded && !reduceMotion;
      S.enterNow = enter;
      main.classList.toggle('enter', enter);
      main.innerHTML = mainHTML();
      drawChart(S.draw && S.loaded);
      Object.entries(dirty).forEach(([id, v]) => { const el = document.getElementById(id); if (el) { el.value = v; el.dataset.dirty = '1'; } });
      if (focus) { const el = document.getElementById(focus.id); if (el && !el.disabled) { el.focus({ preventScroll: true }); try { el.setSelectionRange(focus.a, focus.b); } catch (e) { } } }
      if (S.loaded) {
        animateNumbers();
        firstPaint = false;
        if (S.bump) document.querySelectorAll('#main .meter, #main .goal').forEach(el => { el.classList.remove('bump'); el.getBoundingClientRect(); el.classList.add('bump'); });
        if (S.celebrate) confetti();
        if (enter) observeReveal();
        S.enter = false; S.draw = false; S.bump = false; S.celebrate = false;
      }
    } finally { rendering = false; }
    if (needsRender) { needsRender = false; render(); }
  }
  function renderHeader() {
    const n = sortedMetas().length;
    const badge = $('#menu-n');
    badge.textContent = n; badge.hidden = !S.loaded || n < 2;
    $('#btn-menu').disabled = !S.loaded;
    $('#btn-new').disabled = !S.loaded;
    if (!$('#drawer').hidden) renderDrawer();
    updateSaving();
  }
  function renderNotice() {
    const el = $('#notice');
    let msg = '', warn = false;
    if (!S.online && S.loaded && S.sinBase) { msg = 'La base de datos nueva todavía no está conectada. Mientras tanto, lo que cargues queda guardado en este dispositivo y se sube solo cuando esté lista.'; warn = true; }
    else if (!S.online && S.loaded) { msg = pendingOps.size ?'No hay conexión con el servidor. Lo que cargues queda guardado en este dispositivo y se envía solo cuando vuelva la conexión.' : 'No hay conexión con el servidor; lo que ves puede no estar actualizado.'; warn = true; }
    el.hidden = !msg; el.textContent = msg; el.className = 'notice' + (warn ? ' warn' : '');
  }

  /* Entrada de las secciones que están más abajo, cuando aparecen en pantalla */
  let io = null;
  function observeReveal() {
    if (!('IntersectionObserver' in window)) return;
    if (io) io.disconnect();
    const vh = innerHeight;
    io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { io.unobserve(en.target); en.target.style.animation = 'rise 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) backwards'; } });
    }, { rootMargin: '0px 0px 12% 0px' });
    main.querySelectorAll('.rise').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top > vh) { el.style.animation = 'none'; io.observe(el); }
    });
  }

  /* Confeti al cumplir el objetivo */
  function confetti() {
    if (reduceMotion) return;
    const c = document.createElement('canvas'); c.id = 'confetti';
    document.body.appendChild(c);
    const ctx = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const colors = ['#f97316', '#fdba74', '#ffffff', '#38a0f8', '#7dd3fc', '#fbbf24'];
    const P = Array.from({ length: 160 }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 5, r: 4 + Math.random() * 5, c: colors[Math.random() * colors.length | 0], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4 }));
    const t0 = performance.now();
    const tick = now => {
      const tt = now - t0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      P.forEach(p => { p.vy += 0.42; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - tt / 2600); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); });
      if (tt < 2600) requestAnimationFrame(tick); else c.remove();
    };
    requestAnimationFrame(tick);
  }

  /* ---------- guardar el acumulado ---------- */
  function saveAvance() {
    const meta = currentMeta();
    if (!meta) return;
    const M = lastModel;
    const fecha = $('#f-fecha').value;
    S.formErr = '';
    if (!isISO(fecha) || fecha < meta.desde || fecha > meta.hasta) { S.formErr = `Elegí una fecha entre el ${fDow(meta.desde)} y el ${fDow(meta.hasta)}.`; return render(); }
    const fm = $('#f-m'), fu = $('#f-u');
    const m = fm ? parseNum(fm.value) : 0, u = fu ? parseNum(fu.value) : 0;
    if (fm && m == null) { S.formErr = 'Escribí el monto vendido acumulado.'; render(); const e = $('#f-m'); if (e) e.focus(); return; }
    if (fu && u == null) { S.formErr = `Escribí los ${M.unidad.toLowerCase()} vendidos acumulados.`; render(); const e = $('#f-u'); if (e) e.focus(); return; }
    const cerrado = $('#f-cerrado').checked;
    [fm, fu].forEach(el => { if (el) el.dataset.dirty = ''; });
    const wasDone = M && done(M) && M.last;
    S.formFecha = fecha; S.formEstado = null;
    const id = meta.id + '__' + fecha;
    S.bump = true; S.draw = true;
    put('avances', id, { metaId: meta.id, fecha, monto: Math.max(0, Math.round(m || 0)), unidades: Math.max(0, Math.round(u || 0)), cerrado, actualizado: new Date().toISOString() });
    if (lastModel && done(lastModel) && !wasDone) { confetti(); toast('¡Objetivo cumplido!'); }
    else toast('Listo, recalculado');
  }

  /* ---------- resumen y CSV ---------- */
  function summaryText() {
    const M = lastModel; if (!M) return '';
    const u = n => uName(M.unidad, n);
    const both = (a, b) => [a, b].filter(Boolean).join(' y ');
    const L = [];
    L.push(`${M.meta.nombre}${M.last ? ' · vendido al ' + fNum(M.last.fecha) : ''}`);
    if (M.objM) L.push(`Monto: ${money(M.vendM)} de ${money(M.objM)} (${pct(M.pM)}) · ritmo ideal ${pct(M.esperado)}`);
    if (M.objU) L.push(`${M.unidad}: ${uSmart(M.vendU)} de ${uSmart(M.objU)} (${pct(M.pU)})`);
    if (M.plan.length) {
      L.push(`Faltan ${both(M.objM && money(M.faltaM), M.objU && `${uSmart(M.faltaU)} ${u(M.faltaU)}`)} en ${M.habRest} días hábiles`);
      L.push(`Para llegar al 100 % hay que vender por día: ${both(M.objM && money(M.necM), M.objU && `${uSmart(M.necU)} ${u(M.necU)}`)}`);
      const wk = M.weeks[0];
      if (wk) L.push(`${wk.k === weekStart(todayISO()) ? 'Esta semana' : 'Semana del ' + fShort(wk.a)} (${wk.n} días): ${both(M.objM && money(wk.m), M.objU && `${nf0.format(wk.u)} ${u(wk.u)}`)}`);
    } else L.push(done(M) ? 'Objetivo cumplido' : 'Período terminado');
    if (M.objM && M.proyM != null && M.plan.length) L.push(`Proyección al cierre: ${money(M.proyM)} (${pct(M.proyM / M.objM)})`);
    return L.join('\n');
  }
  async function copySummary() {
    const text = summaryText();
    const fb = $('#copy-fallback');
    try { await navigator.clipboard.writeText(text); toast('Resumen copiado'); }
    catch (e) { if (fb) { fb.hidden = false; fb.value = text; fb.focus(); fb.select(); } toast('Seleccioná el texto y copialo'); }
  }
  function downloadCSV() {
    const M = lastModel; if (!M) return;
    const n = x => x == null ? '' : nf0.format(x);
    const p1 = x => x == null || !isFinite(x) ? '' : nf1.format(x * 100);
    const U = M.unidad;
    const lines = [];
    lines.push(M.meta.nombre);
    lines.push(['Objetivo $', n(M.objM), 'Objetivo ' + U, n(M.objU)].join(';'));
    lines.push(['Vendido $', n(M.vendM), 'Vendido ' + U, n(M.vendU), 'Dato al', M.last ? fNum(M.last.fecha) : ''].join(';'));
    lines.push('');
    lines.push(['Fecha', 'Día', 'Vender $', 'Vender ' + U, 'Acumulado $', '% obj. $', 'Acumulado ' + U, '% obj. ' + U].join(';'));
    M.plan.forEach(r => lines.push([fNum(r.s), DOW_L[dow(r.s)], n(r.dayM), n(r.dayU), n(r.cumM), p1(r.pM), n(r.cumU), p1(r.pU)].join(';')));
    const slug = String(M.meta.nombre || 'objetivo').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'objetivo';
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `plan-${slug}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Archivo descargado');
  }

  let toastT = null;
  function toast(t) { const el = $('#toast'); el.hidden = true; el.textContent = t; el.getBoundingClientRect(); el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }

  /* ---------- eventos ---------- */
  main.addEventListener('input', e => {
    const el = e.target;
    if (!el.matches('input')) return;
    if (el.type !== 'radio' && el.type !== 'date') el.dataset.dirty = '1';
    if (el.matches('[inputmode="decimal"], [inputmode="numeric"]')) liveFormat(el);
  });
  main.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'f-fecha') { S.formFecha = isISO(el.value) ? el.value : null; S.formEstado = null; S.formErr = ''; render(); }
    else if (el.name === 'f-estado') S.formEstado = el.value;
  });
  main.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.target.id === 'f-m' || e.target.id === 'f-u')) { e.preventDefault(); saveAvance(); }
  });
  main.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.plan) { if (S.plan !== t.dataset.plan) { S.plan = t.dataset.plan; savePrefs(); render(); } return; }
    if (t.dataset.chart) { if (S.chart !== t.dataset.chart) { S.chart = t.dataset.chart; savePrefs(); S.draw = true; render(); } return; }
    if (t.dataset.del) { S.confirmDel = t.dataset.del; render(); return; }
    if (t.dataset.delNo) { S.confirmDel = null; render(); return; }
    if (t.dataset.delYes) { const id = t.dataset.delYes; S.confirmDel = null; S.draw = true; S.bump = true; put('avances', id, null); toast('Avance borrado'); return; }
    if (t.id === 'f-save') saveAvance();
    else if (t.id === 'act-copy') copySummary();
    else if (t.id === 'act-csv') downloadCSV();
    else if (t.id === 'empty-new') openEditor(null);
    else if (t.id === 'btn-edit') { const m = currentMeta(); if (m && canEdit(m)) openEditor(m); }
    else if (t.id === 'btn-lock') { const m = currentMeta(); if (m) openLock(m); }
  });
  main.addEventListener('submit', async e => {
    if (e.target.id !== 'unlock-form') return;
    e.preventDefault();
    const meta = currentMeta(), inp = $('#unlock-in');
    if (!meta || !inp) return;
    const clave = inp.value;
    if (!clave) { S.unlockErr = 'Escribí la contraseña.'; render(); const el = $('#unlock-in'); if (el) el.focus(); return; }
    S.unlockBusy = true; S.unlockErr = ''; render();
    try {
      const out = await lockAction({ accion: 'desbloquear', id: meta.id, clave });
      const n = Object.keys(out.llaves || {}).length;
      S.unlockBusy = false;
      prevVals.clear(); prevW.clear(); firstPaint = true; S.enter = true; S.draw = true;
      render();
      toast(n > 1 ? `Desbloqueado (y ${n - 1} ${n === 2 ? 'objetivo más' : 'objetivos más'} con la misma contraseña)` : 'Desbloqueado en este dispositivo');
    } catch (err) {
      S.unlockBusy = false; S.unlockErr = err.message; render();
      const el = $('#unlock-in'); if (el) { el.focus(); el.closest('.lock-panel')?.classList.add('shake'); }
    }
  });
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.btn'); if (!b || b.disabled || reduceMotion) return;
    const r = b.getBoundingClientRect(), size = Math.max(r.width, r.height);
    const s = document.createElement('span'); s.className = 'ripple';
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    b.appendChild(s); setTimeout(() => s.remove(), 700);
  });
  function selectMeta(id) {
    if (id !== S.sel) {
      S.sel = id; S.formFecha = null; S.formEstado = null; S.formErr = ''; S.confirmDel = null; S.unlockErr = '';
      S.enter = true; S.draw = true; prevVals.clear(); prevW.clear(); firstPaint = true; savePrefs();
    }
    closeDrawer();
    render();
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  $('#btn-new').addEventListener('click', () => openEditor(null));

  /* ---------- menú de objetivos (tres rayas) ---------- */
  const drawer = $('#drawer'), drList = $('#dr-list'), drQ = $('#dr-q');
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function drItem(m, k) {
    const on = m.id === S.sel;
    let right = '', bar = '', st = { k: '' };
    if (hidden(m)) right = `<span class="dr-lock" title="Con contraseña">${ICO.lock}</span>`;
    else {
      const M = buildModel(m);
      const p = M.objM ? M.pM : M.pU;
      st = status(p, M.esperado, M.started, M.ended);
      const w = Math.max(0, Math.min(1, p || 0)) * 100;
      bar = `<span class="dr-bar"><i class="${st.k}" style="width:${w.toFixed(1)}%"></i></span>`;
      right = `<span class="dr-pct">${pct(p)}</span>${isLocked(m) ? `<span class="dr-lock sm" title="Con contraseña">${isOpen(m) ? ICO.open : ICO.lock}</span>` : ''}`;
    }
    return `<button type="button" class="dr-item${on ? ' on' : ''}" data-id="${esc(m.id)}" style="--k:${Math.min(k, 14)}" aria-current="${on ? 'true' : 'false'}">
      <span class="dr-dot ${st.k}" aria-hidden="true"></span>
      <span class="dr-main"><b>${esc(m.nombre || 'Sin nombre')}</b><small>${fRange(m.desde, m.hasta)}${st.t ? ' · ' + st.t : ''}</small>${bar}</span>
      <span class="dr-right">${right}</span>
    </button>`;
  }
  function renderDrawer() {
    const t = todayISO(), q = norm(drQ.value.trim());
    const all = sortedMetas();
    $('#dr-search').hidden = all.length < 7;
    const list = q ? all.filter(m => norm(m.nombre).includes(q)) : all;
    const groups = [
      ['En curso', list.filter(m => m.desde <= t && t <= m.hasta)],
      ['Próximos', list.filter(m => m.desde > t).sort((a, b) => a.desde.localeCompare(b.desde))],
      ['Terminados', list.filter(m => m.hasta < t).sort((a, b) => b.hasta.localeCompare(a.hasta))],
    ];
    let k = 0, h = '';
    groups.forEach(([name, items]) => {
      if (!items.length) return;
      h += `<p class="dr-group">${name} <span>${items.length}</span></p>` + items.map(m => drItem(m, k++)).join('');
    });
    if (!all.length) h = '<p class="muted dr-empty">Todavía no hay objetivos. Creá el primero con el botón de abajo.</p>';
    else if (!list.length) h = `<p class="muted dr-empty">Ningún objetivo se llama "${esc(drQ.value.trim())}".</p>`;
    drList.innerHTML = h;
    $('#dr-count').textContent = all.length === 1 ? '1 objetivo' : `${all.length} objetivos`;
  }
  let drawerReturn = null;
  function openDrawer() {
    if (!S.loaded) return;
    drQ.value = '';
    renderDrawer();
    drawer.classList.remove('closing');
    drawer.hidden = false;
    $('#btn-menu').setAttribute('aria-expanded', 'true');
    $('.page').inert = true;
    drawerReturn = document.activeElement;
    setTimeout(() => { const on = drList.querySelector('.dr-item.on') || drList.querySelector('.dr-item') || $('#dr-close'); on.focus({ preventScroll: true }); on.scrollIntoView({ block: 'nearest' }); }, 30);
  }
  function closeDrawer() {
    if (drawer.hidden || drawer.classList.contains('closing')) return;
    $('#btn-menu').setAttribute('aria-expanded', 'false');
    $('.page').inert = false;
    const done = () => { drawer.hidden = true; drawer.classList.remove('closing'); drawer.querySelector('.drawer').style.transform = ''; };
    if (reduceMotion) done(); else { drawer.classList.add('closing'); setTimeout(done, 280); }
    if (drawerReturn && drawerReturn.focus) drawerReturn.focus({ preventScroll: true });
  }
  $('#btn-menu').addEventListener('click', () => drawer.hidden ? openDrawer() : closeDrawer());
  $('#dr-close').addEventListener('click', closeDrawer);
  drawer.querySelector('.drawer-scrim').addEventListener('click', closeDrawer);
  drList.addEventListener('click', e => { const b = e.target.closest('.dr-item'); if (b) selectMeta(b.dataset.id); });
  drQ.addEventListener('input', renderDrawer);
  $('#dr-new').addEventListener('click', () => { closeDrawer(); openEditor(null); });
  drawer.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); closeDrawer(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = [...drList.querySelectorAll('.dr-item')], i = items.indexOf(document.activeElement);
      if (i < 0 && !items.length) return;
      e.preventDefault();
      const n = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
      if (n) n.focus();
    }
  });
  /* Deslizar hacia la izquierda para cerrar en el celular */
  (() => {
    const panel = drawer.querySelector('.drawer');
    let x0 = null, dx = 0;
    panel.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; dx = 0; panel.style.transition = 'none'; }, { passive: true });
    panel.addEventListener('touchmove', e => { if (x0 == null) return; dx = Math.min(0, e.touches[0].clientX - x0); panel.style.transform = `translate3d(${dx}px,0,0)`; }, { passive: true });
    panel.addEventListener('touchend', () => { panel.style.transition = ''; if (dx < -70) closeDrawer(); else panel.style.transform = ''; x0 = null; });
  })();

  /* ---------- contraseña de un objetivo ---------- */
  const LK = { id: null, mode: 'poner', modo0: null };
  function openLock(meta) {
    LK.id = meta.id;
    const managing = isLocked(meta);
    LK.mode = managing ? 'gestionar' : 'poner';
    LK.modo0 = managing ? meta.candado : null;
    $('#lk-title').textContent = managing ? 'Contraseña del objetivo' : 'Proteger con contraseña';
    $('#lk-sub').textContent = meta.nombre || '';
    document.getElementById('lk-m-' + (managing ? meta.candado : 'ver')).checked = true;
    $('#lk-c1').value = ''; $('#lk-c2').value = '';
    $('#lk-l1').textContent = managing ? 'Nueva contraseña (opcional)' : 'Contraseña';
    $('#lk-note').textContent = managing
      ? 'Dejá la contraseña en blanco si solo querés cambiar qué protege. Si ponés una nueva, la anterior deja de funcionar en todos lados.'
      : 'Mínimo 4 caracteres. Anotala bien: desde la web no se puede recuperar. Si usás la misma contraseña en varios objetivos, se desbloquean todos juntos.';
    $('#lk-save').textContent = managing ? 'Guardar cambios' : 'Poner contraseña';
    $('#lk-del-zone').hidden = !managing; $('#lk-forget').hidden = !managing;
    $('#lk-quitar').hidden = false; $('#lk-quitar-confirm').hidden = true;
    $('#lk-err').hidden = true;
    setBusy(false);
    $('#lk').hidden = false;
    setTimeout(() => $('#lk-c1').focus(), 0);
  }
  const closeLock = () => { $('#lk').hidden = true; };
  function setBusy(b) { ['#lk-save', '#lk-quitar-si', '#lk-forget'].forEach(s => { $(s).disabled = b; }); $('#lk-form').classList.toggle('busy', b); }
  const lkFail = t => { const el = $('#lk-err'); el.textContent = t; el.hidden = false; };
  $('#lk-close').addEventListener('click', closeLock);
  $('#lk').addEventListener('click', e => { if (e.target.id === 'lk') closeLock(); });
  $('#lk-form').addEventListener('submit', async e => {
    e.preventDefault();
    const modo = document.querySelector('input[name="lk-modo"]:checked').value;
    const c1 = $('#lk-c1').value, c2 = $('#lk-c2').value;
    $('#lk-err').hidden = true;
    if (LK.mode === 'poner' || c1 || c2) {
      if (c1.length < 4) return lkFail('La contraseña tiene que tener al menos 4 caracteres.');
      if (c1 !== c2) return lkFail('Las dos contraseñas no coinciden.');
    }
    const body = (LK.mode === 'poner' || c1) ? { accion: 'bloquear', id: LK.id, clave: c1, modo } : modo !== LK.modo0 ? { accion: 'modo', id: LK.id, modo } : null;
    if (!body) { closeLock(); return; }
    setBusy(true);
    try {
      await lockAction(body);
      closeLock(); render();
      toast(body.accion === 'modo' ? 'Listo, cambié qué protege la contraseña' : LK.mode === 'poner' ? 'Contraseña puesta. En este dispositivo queda desbloqueado.' : 'Contraseña cambiada');
    } catch (err) { setBusy(false); lkFail(err.message); }
  });
  $('#lk-quitar').addEventListener('click', () => { $('#lk-quitar').hidden = true; $('#lk-quitar-confirm').hidden = false; $('#lk-quitar-no').focus(); });
  $('#lk-quitar-no').addEventListener('click', () => { $('#lk-quitar').hidden = false; $('#lk-quitar-confirm').hidden = true; });
  $('#lk-quitar-si').addEventListener('click', async () => {
    setBusy(true);
    try { await lockAction({ accion: 'quitar', id: LK.id }); delete S.llaves[LK.id]; saveLlaves(); closeLock(); render(); toast('Contraseña quitada'); }
    catch (err) { setBusy(false); lkFail(err.message); }
  });
  $('#lk-forget').addEventListener('click', async () => {
    delete S.llaves[LK.id]; saveLlaves();
    closeLock();
    prevVals.clear(); prevW.clear(); firstPaint = true; S.enter = true;
    await refetchAll();
    toast('Bloqueado otra vez en este dispositivo');
  });
  let resizeT = null;
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => drawChart(false), 150); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { poll(); if (pendingOps.size) flush(); } });
  addEventListener('online', () => { S.online = true; flush(); poll(); });

  /* ---------- fondo vivo, luz y relieve ---------- */
  function buildBackground() {
    const bg = $('#geo-bg');
    let motes = '';
    if (!reduceMotion) for (let i = 0; i < 14; i++) {
      const left = Math.random() * 100, duration = 24 + Math.random() * 28, delay = -Math.random() * duration;
      motes += `<span class="geo-mote" style="left:${left}%;width:${(1.5 + Math.random() * 2.5).toFixed(1)}px;height:${(1.5 + Math.random() * 2.5).toFixed(1)}px;animation-duration:${duration}s;animation-delay:${delay}s;--drift:${(Math.random() * 90 - 45).toFixed(0)}px"></span>`;
    }
    bg.innerHTML = '<div class="geo-parallax"><div class="geo-aurora"></div><span class="geo-blob b1"></span><span class="geo-blob b2"></span><span class="geo-blob b3"></span><span class="geo-blob b4"></span><span class="geo-ring r1"></span><span class="geo-ring r2"></span></div>' + motes + '<div class="geo-spot"></div><div class="geo-grain"></div>';
  }
  function trackPointer() {
    const root = document.documentElement;
    let frame = 0, last = null, tilted = null;
    const reset = el => { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); };
    const apply = () => {
      frame = 0; const e = last; if (!e) return;
      root.style.setProperty('--px', (e.clientX / innerWidth - 0.5).toFixed(3));
      root.style.setProperty('--py', (e.clientY / innerHeight - 0.5).toFixed(3));
      root.style.setProperty('--sx', e.clientX + 'px'); root.style.setProperty('--sy', e.clientY + 'px');
      const target = e.target instanceof Element ? e.target : null;
      let el = target && target.closest('.glass, .goal');
      while (el) {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px'); el.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
        el = el.parentElement && el.parentElement.closest('.glass, .goal');
      }
      const tEl = !reduceMotion && target ? target.closest('[data-tilt]') : null;
      if (tilted && tilted !== tEl) reset(tilted);
      tilted = tEl;
      if (tEl) {
        const r = tEl.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        tEl.style.setProperty('--rx', (x * 6).toFixed(2) + 'deg'); tEl.style.setProperty('--ry', (-y * 6).toFixed(2) + 'deg');
      }
    };
    addEventListener('pointermove', e => { if (e.pointerType && e.pointerType !== 'mouse') return; last = e; if (!frame) frame = requestAnimationFrame(apply); }, { passive: true });
    document.addEventListener('pointerleave', () => { if (tilted) reset(tilted); tilted = null; root.style.setProperty('--sx', '-1000px'); root.style.setProperty('--sy', '-1000px'); });
  }

  /* ---------- editor de objetivos ---------- */
  const ED = { id: null, cerrados: [], nameTouched: false, creado: null };
  const edMesM = $('#ed-mes-m');
  edMesM.innerHTML = MESES.map((m, i) => `<option value="${i}">${cap(m)}</option>`).join('');
  $('#ed-dias').innerHTML = CHIPS.map(([v, l, full]) => `<label class="opt day" title="${full}"><input type="checkbox" id="ed-d${v}" value="${v}" aria-label="${full}"><span>${l}</span></label>`).join('');
  const tipoVal = () => (document.querySelector('input[name="ed-tipo"]:checked') || {}).value || 'mes';
  function showTipo() { const t = tipoVal(); $('#ed-p-mes').hidden = t !== 'mes'; $('#ed-p-semana').hidden = t !== 'semana'; $('#ed-p-dia').hidden = t !== 'dia'; $('#ed-p-custom').hidden = t !== 'custom'; }
  function readPeriod() {
    const t = tipoVal();
    if (t === 'mes') { const m = +edMesM.value, y = +$('#ed-mes-y').value; if (!y || y < 2000 || y > 2100) return null; return { desde: iso(new Date(y, m, 1)), hasta: iso(new Date(y, m + 1, 0)) }; }
    if (t === 'semana') { const v = $('#ed-semana').value; if (!isISO(v)) return null; const a = weekStart(v); return { desde: a, hasta: addDays(a, 6) }; }
    if (t === 'dia') { const v = $('#ed-dia').value; return isISO(v) ? { desde: v, hasta: v } : null; }
    const a = $('#ed-desde').value, b = $('#ed-hasta').value;
    return isISO(a) && isISO(b) ? { desde: a, hasta: b } : null;
  }
  function autoName(t, p) {
    if (!p) return '';
    const A = parse(p.desde);
    if (t === 'mes') return `${cap(MESES[A.getMonth()])} ${A.getFullYear()}`;
    if (t === 'semana') return `Semana del ${fShort(p.desde)} al ${fShort(p.hasta)}`;
    if (t === 'dia') return `${cap(DOW_L[A.getDay()])} ${fShort(p.desde)}`;
    return `${fShort(p.desde)} al ${fShort(p.hasta)}`;
  }
  function setPeriodFields(t, desde, hasta) {
    const A = parse(desde);
    edMesM.value = String(A.getMonth()); $('#ed-mes-y').value = A.getFullYear();
    $('#ed-semana').value = desde; $('#ed-dia').value = desde; $('#ed-desde').value = desde; $('#ed-hasta').value = hasta;
    const r = document.getElementById('ed-t-' + t); if (r) r.checked = true;
    showTipo();
  }
  const readDias = () => CHIPS.map(c => c[0]).filter(v => $('#ed-d' + v).checked);
  function renderCerr() {
    const p = readPeriod();
    $('#ed-cerr-list').innerHTML = ED.cerrados.slice().sort().map(d => `<li${p && (d < p.desde || d > p.hasta) ? ' title="Fuera del período: no se tiene en cuenta"' : ''}>${fDow(d)} ${parse(d).getFullYear()}<button type="button" data-rm="${d}" aria-label="Quitar ${fDow(d)}">×</button></li>`).join('');
  }
  function updatePreview() {
    const t = tipoVal(), p = readPeriod();
    if (!ED.nameTouched) $('#ed-nombre').value = autoName(t, p);
    renderCerr();
    const el = $('#ed-preview');
    if (!p || p.desde > p.hasta) { el.textContent = 'Elegí un período válido.'; return; }
    const dias = readDias(), cerr = new Set(ED.cerrados);
    const H = eachDay(p.desde, p.hasta).filter(s => dias.includes(dow(s)) && !cerr.has(s)).length;
    const m = parseNum($('#ed-monto').value), u = parseNum($('#ed-unid').value);
    const unidad = $('#ed-unidad').value.trim() || 'Equipos';
    let txt = `${fRange(p.desde, p.hasta)} · ${H} ${H === 1 ? 'día hábil' : 'días hábiles'}.`;
    if (H && (m || u)) txt += ` Repartido parejo: ${[m ? money(m / H) : '', u ? uSmart(u / H) + ' ' + uName(unidad, u / H) : ''].filter(Boolean).join(' y ')} por día.`;
    el.textContent = txt;
  }
  function openEditor(meta) {
    ED.id = meta ? meta.id : null; ED.creado = meta ? meta.creado || null : null;
    const t = meta ? (meta.tipo || 'custom') : 'mes';
    const today = todayISO();
    let desde, hasta;
    if (meta) { desde = meta.desde; hasta = meta.hasta; }
    else { const d = parse(today); desde = iso(new Date(d.getFullYear(), d.getMonth(), 1)); hasta = iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
    setPeriodFields(t, desde, hasta);
    if (!meta) { $('#ed-semana').value = today; $('#ed-dia').value = today; }
    const last = sortedMetas()[0];
    $('#ed-monto').value = meta && meta.objMonto ? nf0.format(meta.objMonto) : '';
    $('#ed-unid').value = meta && meta.objUnidades ? nf0.format(meta.objUnidades) : '';
    $('#ed-unidad').value = meta ? (meta.unidad || 'Equipos') : (last && last.unidad) || 'Equipos';
    const dias = meta && Array.isArray(meta.dias) && meta.dias.length ? meta.dias.map(Number) : (last && Array.isArray(last.dias) ? last.dias.map(Number) : [1, 2, 3, 4, 5, 6]);
    CHIPS.forEach(([v]) => { $('#ed-d' + v).checked = dias.includes(v); });
    ED.cerrados = meta && Array.isArray(meta.cerrados) ? meta.cerrados.slice() : [];
    ED.nameTouched = !!meta;
    $('#ed-nombre').value = meta ? (meta.nombre || '') : '';
    $('#ed-title').textContent = meta ? 'Editar objetivo' : 'Nuevo objetivo';
    $('#ed-del-zone').hidden = !meta; $('#ed-dup').hidden = !meta;
    $('#ed-del').hidden = false; $('#ed-del-confirm').hidden = true; $('#ed-err').hidden = true;
    updatePreview();
    $('#editor').hidden = false;
    setTimeout(() => { (meta ? $('#ed-monto') : document.getElementById('ed-t-' + t)).focus(); }, 0);
  }
  const closeEditor = () => { $('#editor').hidden = true; };
  function shiftPeriod(t, p) {
    if (t === 'mes') { const d = parse(p.desde); return { desde: iso(new Date(d.getFullYear(), d.getMonth() + 1, 1)), hasta: iso(new Date(d.getFullYear(), d.getMonth() + 2, 0)) }; }
    if (t === 'semana') return { desde: addDays(p.desde, 7), hasta: addDays(p.hasta, 7) };
    if (t === 'dia') return { desde: addDays(p.desde, 1), hasta: addDays(p.desde, 1) };
    const len = eachDay(p.desde, p.hasta).length; return { desde: addDays(p.hasta, 1), hasta: addDays(p.hasta, len) };
  }
  $('#ed-form').addEventListener('input', e => {
    if (e.target.id === 'ed-nombre') ED.nameTouched = e.target.value.trim() !== '';
    if (e.target.id === 'ed-monto' || e.target.id === 'ed-unid') liveFormat(e.target);
    updatePreview();
  });
  $('#ed-form').addEventListener('change', e => { if (e.target.name === 'ed-tipo') showTipo(); updatePreview(); });
  $('#ed-close').addEventListener('click', closeEditor);
  $('#editor').addEventListener('click', e => { if (e.target.id === 'editor') closeEditor(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#lk').hidden) closeLock();
    else if (!$('#editor').hidden) closeEditor();
    else if (!drawer.hidden) closeDrawer();
  });
  $('#ed-cerr-add').addEventListener('click', () => {
    const v = $('#ed-cerr-in').value;
    if (!isISO(v)) { $('#ed-cerr-in').focus(); return; }
    if (!ED.cerrados.includes(v)) ED.cerrados.push(v);
    $('#ed-cerr-in').value = ''; updatePreview();
  });
  $('#ed-cerr-list').addEventListener('click', e => { const b = e.target.closest('button[data-rm]'); if (!b) return; ED.cerrados = ED.cerrados.filter(d => d !== b.dataset.rm); updatePreview(); });
  $('#ed-dup').addEventListener('click', () => {
    const t = tipoVal(), p = readPeriod(); if (!p) return;
    const np = shiftPeriod(t, p);
    setPeriodFields(t, np.desde, np.hasta);
    ED.id = null; ED.creado = null; ED.cerrados = []; ED.nameTouched = false;
    $('#ed-title').textContent = 'Nuevo objetivo (copia)';
    $('#ed-del-zone').hidden = true; $('#ed-dup').hidden = true;
    updatePreview();
    toast('Revisá los montos y guardá el nuevo objetivo');
  });
  $('#ed-del').addEventListener('click', () => { $('#ed-del').hidden = true; $('#ed-del-confirm').hidden = false; $('#ed-del-no').focus(); });
  $('#ed-del-no').addEventListener('click', () => { $('#ed-del').hidden = false; $('#ed-del-confirm').hidden = true; });
  $('#ed-del-yes').addEventListener('click', () => {
    const id = ED.id; if (!id) return;
    const avs = [...S.avances.values()].filter(v => v.metaId === id);
    closeEditor();
    S.sel = null; S.enter = true; S.draw = true; prevVals.clear(); prevW.clear(); firstPaint = true; savePrefs();
    put('metas', id, null);
    avs.forEach(v => put('avances', v.id, null));
    toast('Objetivo borrado');
  });
  $('#ed-form').addEventListener('submit', e => {
    e.preventDefault();
    const err = $('#ed-err');
    const fail = t => { err.textContent = t; err.hidden = false; };
    const t = tipoVal(), p = readPeriod();
    if (!p) return fail('Completá las fechas del período.');
    if (p.desde > p.hasta) return fail('La fecha "desde" tiene que ser anterior a "hasta".');
    if (eachDay(p.desde, p.hasta).length > 366) return fail('El período puede durar como máximo un año.');
    const dias = readDias();
    if (!dias.length) return fail('Marcá al menos un día de trabajo.');
    const cerr = new Set(ED.cerrados);
    if (!eachDay(p.desde, p.hasta).some(s => dias.includes(dow(s)) && !cerr.has(s))) return fail('El período no tiene ningún día hábil con esos días de trabajo.');
    const m = parseNum($('#ed-monto').value), u = parseNum($('#ed-unid').value);
    if (!(m > 0) && !(u > 0)) return fail('Cargá un objetivo en pesos, en unidades o en ambos.');
    const nombre = $('#ed-nombre').value.trim() || autoName(t, p);
    const body = {
      nombre, tipo: t, desde: p.desde, hasta: p.hasta,
      objMonto: m > 0 ? Math.round(m) : 0, objUnidades: u > 0 ? Math.round(u) : 0,
      unidad: $('#ed-unidad').value.trim() || 'Equipos', dias,
      cerrados: ED.cerrados.filter(d => d >= p.desde && d <= p.hasta).sort(),
      creado: ED.creado || new Date().toISOString(), actualizado: new Date().toISOString(),
    };
    const editing = !!ED.id;
    const id = ED.id || ('m' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    closeEditor();
    if (!editing) { prevVals.clear(); prevW.clear(); firstPaint = true; S.enter = true; }
    S.sel = id; S.formFecha = null; S.formEstado = null; S.formErr = ''; S.draw = true; S.bump = editing; savePrefs();
    put('metas', id, body);
    toast(editing ? 'Objetivo actualizado' : 'Objetivo creado');
  });

  /* ---------- arranque ---------- */
  async function boot() {
    restorePrefs();
    loadPending();
    loadLlaves();
    buildBackground();
    if (finePointer) trackPointer();
    // Hasta que este dispositivo no hable una vez con la base nueva, lo que tiene guardado se considera
    // pendiente de subir (eran los datos de la base anterior, que Vercel suspendió).
    const migrated = lsGet(MIG_KEY) === '1';
    let oldCache = null;
    try {
      const c = JSON.parse(lsGet(CACHE_KEY) || 'null');
      if (c && c.metas) {
        if (!migrated) oldCache = c;
        stateToMaps(c); pendingOps.forEach((body, key) => applyLocal(key, body));
        S.loaded = true;
      }
    } catch (e) { }
    render();
    try {
      const st = await fetchState();
      S.online = true;
      const had = S.loaded;
      const n = migrated ? 0 : migrateOldCache(oldCache, st);
      lsSet(MIG_KEY, '1');
      receive(st);
      S.loaded = true;
      if (!had) { S.enter = true; S.draw = true; }
      render();
      if (n) toast(`Subiendo ${n} ${n === 1 ? 'dato guardado' : 'datos guardados'} en este dispositivo…`);
    } catch (e) {
      S.online = false;
      if (!S.loaded) { S.loaded = true; S.enter = true; render(); }
      renderNotice();
    }
    updateSaving();
    if (pendingOps.size) flush();
    setInterval(poll, 30000);
  }
  boot();
})();
