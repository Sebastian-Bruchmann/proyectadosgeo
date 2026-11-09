# Proyectados · GEO

Web para seguir los objetivos de venta de GEO: porcentaje cumplido, proyección al cierre y cuánto hay que vender por día y por semana para llegar al 100 %, en pesos y en equipos.

Publicada en **https://proyectadosgeo.vercel.app**

## Qué hace

- Objetivos mensuales, semanales, diarios o con fechas a medida, con días de trabajo y feriados.
- Se carga solo el **vendido acumulado** hasta el momento (no día por día) y la web calcula:
  - % cumplido y ritmo ideal a la fecha,
  - proyección al cierre = vendido ÷ días hábiles transcurridos × días hábiles totales,
  - lo que falta por día y por semana para llegar al 100 %.
- Menú de tres rayas con todos los objetivos (en curso, próximos y terminados).
- **Utilidad** (aparte del cierre): se carga cuántos Claro, equipos y electros vendió cada local en el día y se calcula lo que dejan (Claro $ 34.388, equipo $ 85.900, electro $ 13.856), con su propia imagen y texto.
- Contraseña opcional por objetivo: "ver y editar" o "solo editar". La valida el servidor.
- Resumen para copiar a WhatsApp y descarga del plan en CSV.
- **Cierre del día**: varios locales juntos (se eligen cuáles) con lo vendido en el día, la proyección a fin de mes y cuánto hay que vender por día para llegar al 100 %. Sale como imagen o texto para WhatsApp. Al cargar se pone el acumulado (para la proyección) y, aparte, lo del día (para la imagen): efectivo entero + tarjeta/QR/otros con el 3,22 % descontado, y las operaciones del día.

## Cómo está armado

| Archivo | Para qué |
| --- | --- |
| `index.html` | Estructura de la página |
| `app.css` | Estilos base (colores GEO, liquid glass, animaciones) |
| `menu.css` | Menú de tres rayas y candados |
| `app.js` | Lógica, cálculos y sincronización (JavaScript sin frameworks) |
| `api/data.js` | Función de Vercel que guarda los datos en Upstash Redis |
| `vercel.json` | Encabezados y URLs limpias |

## Datos

Se guardan en **Upstash Redis** (Vercel → Storage), conectado al proyecto con las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`. Las variables no están en este repo: Vercel las agrega solo.

Si no hay conexión, lo que se carga queda guardado en el navegador y se envía cuando vuelve.

## Publicar

Se publica en Vercel como proyecto sin framework (`framework: null`), Node 22.
