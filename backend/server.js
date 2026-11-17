// Tintómetro · API
// Un solo archivo con Express y una base de datos JSON en disco.
// Guarda cafeterías, ventas diarias, eventos del calendario, historial de cargas y sesiones.

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { CAFES, filaDemo, eventosDemo, diaNum, isoDe } = require("./demo");
const { calcularResumen } = require("./rachas");

const PORT = process.env.PORT || 3000;
// Siempre en una carpeta propia: si el disco lo comparte otro servicio (Tapin), no se tocan sus archivos.
const DATA_DIR = process.env.TINTOMETRO_DATA_DIR
  || (process.env.DATA_DIR ? path.join(process.env.DATA_DIR, "tintometro") : path.join(__dirname, "data"));
const DB_FILE = path.join(DATA_DIR, "tintometro_db.json");
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const ZONA = "America/Bogota";

// ---------- utilidades ----------
const hoyBogota = () => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
const nuevoId = (n = 12) => crypto.randomBytes(n).toString("hex");
const esFecha = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
const TIPOS_DIA = ["Normal", "Festivo", "Vacaciones", "Evento"];
const TIPOS_EVENTO = ["promocion", "festivo", "evento", "nota"];

function hashClave(clave, sal = crypto.randomBytes(16).toString("hex")) {
  return { sal, hash: crypto.scryptSync(clave, sal, 64).toString("hex") };
}
function claveOk(clave, sal, hash) {
  const a = Buffer.from(crypto.scryptSync(clave, sal, 64).toString("hex"), "hex"), b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function igualSeguro(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------- base de datos ----------
// Se guarda en Supabase (Postgres) si están SUPABASE_URL y SUPABASE_KEY; si no, en un archivo JSON.
// Las ventas simuladas de las cafeterías de ejemplo no se guardan: se vuelven a generar igual al arrancar.
const SUPA_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPA_KEY = process.env.SUPABASE_KEY || "";
const SUPA_TABLA = "tintometro_estado";
const usaSupabase = !!(SUPA_URL && SUPA_KEY);
let db;

function paraGuardar() {
  const ventas = {};
  for (const [id, v] of Object.entries(db.ventas)) {
    const demo = db.cafeterias[id] && db.cafeterias[id].demo;
    ventas[id] = demo ? Object.fromEntries(Object.entries(v).filter(([, f]) => f.origen !== "simulado")) : v;
  }
  return { ...db, ventas };
}
async function supa(ruta, opc = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${ruta}`, {
    ...opc, headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", ...(opc.headers || {}) },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
let guardando = Promise.resolve();
function guardar() {
  const datos = paraGuardar();
  if (!usaSupabase) {
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(datos));
    fs.renameSync(tmp, DB_FILE);
    return Promise.resolve();
  }
  guardando = guardando.then(() => supa(SUPA_TABLA, {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: "principal", datos, actualizado: new Date().toISOString() }),
  })).catch((e) => console.error("No se pudo guardar:", e.message));
  return guardando;
}
let pendiente = null;
const guardarLuego = () => { clearTimeout(pendiente); pendiente = setTimeout(guardar, 800); };

function crearDemo() {
  const base = { version: 1, cafeterias: {}, ventas: {}, eventos: {}, cargas: {}, sesiones: {} };
  const ayer = isoDe(diaNum(hoyBogota()) - 1);
  for (const c of CAFES) {
    const id = nuevoId(6);
    const { sal, hash } = hashClave("cafe2026");
    base.cafeterias[id] = {
      id, slug: c.slug, nombre: c.nombre, ciudad: c.ciudad, producto: c.producto, meta: c.meta,
      diasAbiertos: c.diasAbiertos, cierraFestivos: !!c.cierraFestivos, correo: c.correo, sal, hash, demo: true, creada: c.desde,
    };
    base.ventas[id] = {};
    for (let n = diaNum(c.desde); n <= diaNum(ayer); n++) {
      const iso = isoDe(n), f = filaDemo(c, iso);
      if (f) base.ventas[id][iso] = f;
    }
    base.eventos[id] = eventosDemo(c).map((e) => ({ id: nuevoId(5), ...e }));
    // historial de cargas: un Excel al final de cada mes
    base.cargas[id] = [];
    for (let n = diaNum(c.desde); n <= diaNum(ayer); n++) {
      const iso = isoDe(n);
      if (iso.slice(8) === "01" && iso > c.desde) {
        const mes = iso.slice(0, 7);
        const filas = Object.keys(base.ventas[id]).filter((f) => f < iso && f >= isoDe(diaNum(iso) - 31)).length;
        base.cargas[id].push({ fecha: iso + "T19:30:00-05:00", archivo: `ventas_${mes}.xlsx`, filas, nuevas: filas, actualizadas: 0 });
      }
    }
    base.cargas[id].reverse();
  }
  return base;
}

// las cafeterías de ejemplo siguen "anotando" sus ventas hasta ayer, para que las rachas estén vivas
function extenderDemo() {
  const ayer = isoDe(diaNum(hoyBogota()) - 1);
  let cambio = false;
  for (const cafe of Object.values(db.cafeterias)) {
    if (!cafe.demo) continue;
    const conf = CAFES.find((c) => c.slug === cafe.slug); if (!conf) continue;
    const v = db.ventas[cafe.id] || (db.ventas[cafe.id] = {});
    const ult = Object.keys(v).sort().pop() || conf.desde;
    for (let n = diaNum(ult) + 1; n <= diaNum(ayer); n++) {
      const iso = isoDe(n), f = filaDemo(conf, iso);
      if (f) { v[iso] = f; cambio = true; }
    }
  }
  if (cambio) guardarLuego();
}

async function leerGuardado() {
  if (usaSupabase) {
    const filas = await supa(`${SUPA_TABLA}?id=eq.principal&select=datos`);
    return filas && filas[0] ? filas[0].datos : null;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf8")) : null;
}

async function cargarDB() {
  const guardado = await leerGuardado();
  const nuevas = crearDemo();
  if (!guardado) { db = nuevas; await guardar(); console.log("Base nueva con las cafeterías de ejemplo"); }
  else {
    db = guardado;
    for (const k of ["cafeterias", "ventas", "eventos", "cargas", "sesiones"]) db[k] ||= {};
    // las cafeterías de ejemplo: se regeneran sus ventas simuladas y se respeta lo que la gente anotó encima
    for (const nc of Object.values(nuevas.cafeterias)) {
      const vieja = Object.values(db.cafeterias).find((x) => x.demo && x.slug === nc.slug);
      if (!vieja) { db.cafeterias[nc.id] = nc; db.ventas[nc.id] = nuevas.ventas[nc.id]; db.eventos[nc.id] = nuevas.eventos[nc.id]; db.cargas[nc.id] = nuevas.cargas[nc.id]; continue; }
      db.ventas[vieja.id] = { ...nuevas.ventas[nc.id], ...(db.ventas[vieja.id] || {}) };
    }
  }
  extenderDemo();
  console.log(`Datos en ${usaSupabase ? "Supabase" : DB_FILE}: ${Object.keys(db.cafeterias).length} cafeterías`);
}

// ---------- app ----------
const app = express();
app.use(cors()); // API pública con token en el encabezado; sin cookies
app.use(express.json({ limit: "3mb" }));

// límite de intentos para entrar (por IP)
const intentos = new Map();
function limitarIntentos(req, res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress;
  const ahora = Date.now(), x = intentos.get(ip) || { n: 0, desde: ahora };
  if (ahora - x.desde > 15 * 60e3) { x.n = 0; x.desde = ahora; }
  if (x.n >= 10) return res.status(429).json({ error: "Demasiados intentos. Espera 15 minutos." });
  x.n++; intentos.set(ip, x); next();
}

function crearSesion(cafeId) {
  const token = nuevoId(24);
  db.sesiones[token] = { cafeteriaId: cafeId, expira: Date.now() + 30 * 864e5 };
  guardarLuego();
  return token;
}
function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const s = token && db.sesiones[token];
  if (!s || s.expira < Date.now()) return res.status(401).json({ error: "Tu sesión se cerró. Vuelve a entrar." });
  req.cafe = db.cafeterias[s.cafeteriaId];
  if (!req.cafe) return res.status(401).json({ error: "La cuenta ya no existe." });
  req.token = token; next();
}
// las cafeterías de ejemplo son solo para mirar
function noDemo(req, res, next) {
  if (req.cafe.demo) return res.status(403).json({ error: "Las cafeterías de ejemplo son solo para mirar. Crea tu cuenta para anotar tus propias ventas." });
  next();
}
function publico(c) {
  const { sal, hash, ...resto } = c; return resto;
}
function paraCliente(c) {
  extenderDemo();
  return { cafeteria: publico(c), resumen: calcularResumen(c, db.ventas[c.id] || {}, hoyBogota()), hoy: hoyBogota() };
}

function tipoDe(t) {
  const x = String(t || "").trim().slice(0, 20); if (!x) return "Normal";
  const igual = TIPOS_DIA.find((k) => k.toLowerCase() === x.toLowerCase());
  return igual || x.charAt(0).toUpperCase() + x.slice(1);
}
function limpiarFila(f) {
  if (!f || !esFecha(f.fecha)) return null;
  const precio = Math.round(+f.precio), ventas = Math.round(+f.ventas);
  if (!(precio > 0 && precio < 1e6) || !(ventas >= 0 && ventas < 1e5)) return null;
  const fila = { precio, ventas, promo: !!f.promo, tipo: tipoDe(f.tipo), origen: f.origen === "excel" ? "excel" : "manual" };
  if (f.temperatura !== undefined && f.temperatura !== null && f.temperatura !== "" && isFinite(+f.temperatura)) fila.temperatura = +(+f.temperatura).toFixed(1);
  if (f.lluvia !== undefined && f.lluvia !== null && f.lluvia !== "") fila.lluvia = +f.lluvia ? 1 : 0;
  return [f.fecha, fila];
}

// ---------- rutas ----------
// la página: tintometro.cafe la sirve este mismo servidor
const PUBLICO = path.join(__dirname, "public");
app.use(express.static(PUBLICO, { maxAge: "5m", extensions: ["html"] }));
app.get("/api/salud", (req, res) => res.json({ ok: true, hoy: hoyBogota() }));

// cafeterías de ejemplo (sin contraseña, como una vitrina)
app.get("/api/demo", (req, res) => {
  res.json(Object.values(db.cafeterias).filter((c) => c.demo).map((c) => ({ slug: c.slug, nombre: c.nombre, ciudad: c.ciudad, producto: c.producto })));
});
app.post("/api/demo/:slug/entrar", (req, res) => {
  const c = Object.values(db.cafeterias).find((x) => x.demo && x.slug === req.params.slug);
  if (!c) return res.status(404).json({ error: "Esa cafetería de ejemplo no existe." });
  res.json({ token: crearSesion(c.id), ...paraCliente(c) });
});

app.post("/api/registro", limitarIntentos, (req, res) => {
  const { nombre, ciudad, producto, correo, clave, meta } = req.body || {};
  const mail = String(correo || "").trim().toLowerCase();
  if (!String(nombre || "").trim()) return res.status(400).json({ error: "Escribe el nombre de la cafetería." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return res.status(400).json({ error: "Ese correo no parece válido." });
  if (String(clave || "").length < 6) return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
  if (Object.values(db.cafeterias).some((c) => c.correo === mail)) return res.status(409).json({ error: "Ya hay una cuenta con ese correo." });
  const id = nuevoId(6), { sal, hash } = hashClave(String(clave));
  db.cafeterias[id] = {
    id, slug: id, nombre: String(nombre).trim().slice(0, 40), ciudad: String(ciudad || "Chía").slice(0, 40),
    producto: String(producto || "tinto").trim().slice(0, 24), meta: Math.max(0, Math.round(+meta || 0)),
    diasAbiertos: [1, 2, 3, 4, 5, 6], correo: mail, sal, hash, demo: false, creada: hoyBogota(),
  };
  db.ventas[id] = {}; db.eventos[id] = []; db.cargas[id] = [];
  res.status(201).json({ token: crearSesion(id), ...paraCliente(db.cafeterias[id]) });
});

app.post("/api/entrar", limitarIntentos, (req, res) => {
  const mail = String(req.body?.correo || "").trim().toLowerCase(), clave = String(req.body?.clave || "");
  const c = Object.values(db.cafeterias).find((x) => x.correo === mail);
  if (!c || !claveOk(clave, c.sal, c.hash)) return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  res.json({ token: crearSesion(c.id), ...paraCliente(c) });
});

app.post("/api/salir", auth, (req, res) => { delete db.sesiones[req.token]; guardarLuego(); res.json({ ok: true }); });

app.get("/api/yo", auth, (req, res) => res.json(paraCliente(req.cafe)));
app.put("/api/yo", auth, noDemo, (req, res) => {
  const c = req.cafe, b = req.body || {};
  if (b.nombre !== undefined && String(b.nombre).trim()) c.nombre = String(b.nombre).trim().slice(0, 40);
  if (b.ciudad !== undefined) c.ciudad = String(b.ciudad).slice(0, 40);
  if (b.producto !== undefined) c.producto = String(b.producto).trim().slice(0, 24);
  if (b.meta !== undefined) c.meta = Math.max(0, Math.round(+b.meta || 0));
  if (Array.isArray(b.diasAbiertos)) {
    const d = [...new Set(b.diasAbiertos.map(Number).filter((x) => x >= 0 && x <= 6))];
    if (d.length) c.diasAbiertos = d.sort();
  }
  guardarLuego(); res.json(paraCliente(c));
});

// ventas
app.get("/api/ventas", auth, (req, res) => {
  const v = db.ventas[req.cafe.id] || {}, { desde, hasta } = req.query;
  const filas = Object.keys(v).sort().filter((f) => (!desde || f >= desde) && (!hasta || f <= hasta)).map((f) => ({ fecha: f, ...v[f] }));
  res.json(filas);
});
app.post("/api/ventas", auth, noDemo, (req, res) => {
  const x = limpiarFila(req.body);
  if (!x) return res.status(400).json({ error: "Revisa la fecha, el precio y las ventas." });
  if (x[0] > hoyBogota()) return res.status(400).json({ error: "No puedes anotar ventas de un día que no ha pasado." });
  (db.ventas[req.cafe.id] ||= {})[x[0]] = x[1];
  guardarLuego(); res.json(paraCliente(req.cafe));
});
app.delete("/api/ventas/:fecha", auth, noDemo, (req, res) => {
  delete (db.ventas[req.cafe.id] || {})[req.params.fecha];
  guardarLuego(); res.json(paraCliente(req.cafe));
});
app.post("/api/ventas/importar", auth, noDemo, (req, res) => {
  const filas = Array.isArray(req.body?.filas) ? req.body.filas : [];
  if (!filas.length || filas.length > 5000) return res.status(400).json({ error: "No llegaron filas para guardar (máximo 5.000)." });
  const v = (db.ventas[req.cafe.id] ||= {}), hoy = hoyBogota();
  let nuevas = 0, actualizadas = 0, malas = 0;
  for (const f of filas) {
    const x = limpiarFila({ ...f, origen: "excel" });
    if (!x || x[0] > hoy) { malas++; continue; }
    if (v[x[0]]) actualizadas++; else nuevas++;
    v[x[0]] = x[1];
  }
  const carga = { fecha: new Date().toISOString(), archivo: String(req.body?.archivo || "archivo").slice(0, 80), filas: nuevas + actualizadas, nuevas, actualizadas };
  (db.cargas[req.cafe.id] ||= []).unshift(carga);
  db.cargas[req.cafe.id] = db.cargas[req.cafe.id].slice(0, 100);
  guardarLuego(); res.json({ carga, malas, ...paraCliente(req.cafe) });
});

// CSV listo para la herramienta de análisis
app.get("/api/ventas.csv", auth, (req, res) => {
  const v = db.ventas[req.cafe.id] || {};
  const lineas = ["fecha;precio;ventas;promocion;tipo_dia;temperatura;lluvia"];
  for (const f of Object.keys(v).sort()) {
    const r = v[f];
    lineas.push([f, r.precio, r.ventas, r.promo ? "Sí" : "No", r.tipo || "Normal", r.temperatura ?? "", r.lluvia ?? ""].join(";"));
  }
  res.type("text/csv").send(lineas.join("\n"));
});

// calendario de eventos
app.get("/api/eventos", auth, (req, res) => {
  const mes = String(req.query.mes || "");
  res.json((db.eventos[req.cafe.id] || []).filter((e) => !mes || e.fecha.startsWith(mes)).sort((a, b) => a.fecha.localeCompare(b.fecha)));
});
app.post("/api/eventos", auth, noDemo, (req, res) => {
  const { fecha, tipo, titulo } = req.body || {};
  if (!esFecha(fecha) || !String(titulo || "").trim()) return res.status(400).json({ error: "El evento necesita fecha y nombre." });
  const e = { id: nuevoId(5), fecha, tipo: TIPOS_EVENTO.includes(tipo) ? tipo : "nota", titulo: String(titulo).trim().slice(0, 80) };
  (db.eventos[req.cafe.id] ||= []).push(e);
  guardarLuego(); res.status(201).json(e);
});
app.delete("/api/eventos/:id", auth, noDemo, (req, res) => {
  db.eventos[req.cafe.id] = (db.eventos[req.cafe.id] || []).filter((e) => e.id !== req.params.id);
  guardarLuego(); res.json({ ok: true });
});

app.get("/api/cargas", auth, (req, res) => res.json(db.cargas[req.cafe.id] || []));

// reiniciar las cafeterías de ejemplo (solo con ADMIN_KEY)
app.post("/api/admin/reiniciar-demo", (req, res) => {
  if (!ADMIN_KEY || !igualSeguro(req.headers["x-admin-key"] || "", ADMIN_KEY)) return res.status(403).json({ error: "No autorizado." });
  const nuevas = crearDemo();
  for (const c of Object.values(db.cafeterias).filter((c) => !c.demo)) {
    nuevas.cafeterias[c.id] = c; nuevas.ventas[c.id] = db.ventas[c.id]; nuevas.eventos[c.id] = db.eventos[c.id]; nuevas.cargas[c.id] = db.cargas[c.id];
  }
  db = nuevas; guardar(); res.json({ ok: true });
});

app.use("/api", (req, res) => res.status(404).json({ error: "Ruta no encontrada." }));
app.get("*", (req, res) => res.sendFile(path.join(PUBLICO, "index.html")));
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada." }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: "Algo falló en el servidor." }); });

// limpieza de sesiones vencidas cada hora
setInterval(() => {
  const ahora = Date.now(); let n = 0;
  for (const [t, s] of Object.entries(db.sesiones)) if (s.expira < ahora) { delete db.sesiones[t]; n++; }
  if (n) guardarLuego();
}, 3600e3).unref();

if (require.main === module) {
  cargarDB().then(() => app.listen(PORT, () => console.log(`Tintómetro API en el puerto ${PORT}`)))
    .catch((e) => { console.error("No se pudo cargar la base:", e.message); process.exit(1); });
}
// guarda lo pendiente antes de que Render apague el servidor
process.on("SIGTERM", async () => { clearTimeout(pendiente); await guardar(); process.exit(0); });
module.exports = app;
