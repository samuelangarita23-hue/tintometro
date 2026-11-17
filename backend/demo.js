// Datos simulados de las dos cafeterías de ejemplo.
// Todo es determinista: el mismo día siempre da los mismos números,
// así la demo se puede "estirar" hasta ayer sin cambiar el pasado.

const FESTIVOS = [
  "2025-11-17", "2025-12-08", "2025-12-25",
  "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01",
  "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29", "2026-07-20", "2026-08-07",
  "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25",
  "2027-01-01", "2027-01-11",
];
const FESTIVO_NOMBRE = {
  "11-17": "Independencia de Cartagena", "11-16": "Independencia de Cartagena", "12-08": "Inmaculada Concepción",
  "12-25": "Navidad", "01-01": "Año nuevo", "01-12": "Reyes Magos", "01-11": "Reyes Magos", "03-23": "San José",
  "04-02": "Jueves Santo", "04-03": "Viernes Santo", "05-01": "Día del trabajo", "05-18": "Ascensión",
  "06-08": "Corpus Christi", "06-15": "Sagrado Corazón", "06-29": "San Pedro y San Pablo",
  "07-20": "Independencia", "08-07": "Batalla de Boyacá", "08-17": "Asunción de la Virgen",
  "10-12": "Día de la Raza", "11-02": "Todos los Santos",
};

// generador pseudoaleatorio con semilla (mulberry32)
function rng(semilla) {
  let a = semilla >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const normal = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
const diaNum = (iso) => Math.round(Date.parse(iso + "T00:00:00Z") / 864e5);
const isoDe = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
const diaSemana = (iso) => new Date(iso + "T00:00:00Z").getUTCDay(); // 0 = domingo

function esVacaciones(iso) {
  const md = iso.slice(5);
  return md >= "12-15" || md <= "01-15" || (md >= "06-15" && md <= "07-15");
}

// clima de la Sabana, el mismo para las dos (cambia la semilla por ciudad)
function clima(iso, semilla, tBase = 14.3) {
  const r = rng(diaNum(iso) * 7919 + semilla);
  const mes = +iso.slice(5, 7);
  const lluvioso = [4, 5, 10, 11].includes(mes) ? 0.62 : [3, 9, 12].includes(mes) ? 0.42 : 0.28;
  const lluvia = r() < lluvioso ? 1 : 0;
  const T = Math.round((tBase + 1.4 * normal(r) - 1.1 * lluvia) * 10) / 10;
  return { temperatura: T, lluvia };
}

const CAFES = [
  {
    slug: "cafe-la-esquina", nombre: "Café La Esquina", ciudad: "Chía", producto: "tinto",
    meta: 100, diasAbiertos: [1, 2, 3, 4, 5, 6], desde: "2025-11-17", semilla: 101,
    correo: "demo@laesquina.co",
    // días que "no anotó" (para que las rachas tengan historia)
    faltas: ["2025-12-09", "2025-12-27", "2026-01-24", "2026-02-14", "2026-03-30", "2026-05-02", "2026-06-20", "2026-08-08", "2026-09-19", "2026-10-17"],
    precio(iso, r) { // la carta cambia por temporadas y a veces prueba precios
      const base = iso < "2026-02-01" ? 2500 : iso < "2026-06-01" ? 2800 : iso < "2026-09-01" ? 3000 : 3200;
      const prueba = r() < 0.25 ? (r() < 0.5 ? -500 : 500) : 0;
      return Math.min(4200, Math.max(2200, base + prueba));
    },
    ventas(iso, d, c, r) {
      const p = d.precio / 1000, ds = diaSemana(iso);
      let y = 262 - 70 * p + 6 * p * p - 3 * (c.temperatura - 14) + 18 * c.lluvia + 28 * (d.promo ? 1 : 0);
      if (ds === 6) y -= 22;            // sábado flojo
      if (ds === 1) y += 6;             // lunes de oficina
      if (d.tipo === "Festivo") y -= 38;
      if (d.tipo === "Vacaciones") y -= 24;
      if (iso >= "2026-07-01") y += 6;  // ya la conoce más gente
      return Math.max(15, Math.round(y + 9 * normal(r)));
    },
    promo: (iso, r) => (diaSemana(iso) === 2 ? r() < 0.7 : r() < 0.18),
  },
  {
    slug: "tinto-y-pan", nombre: "Tinto & Pan", ciudad: "Zipaquirá", producto: "café con leche",
    meta: 85, diasAbiertos: [0, 1, 2, 3, 4, 5, 6], desde: "2026-03-02", semilla: 202,
    correo: "demo@tintoypan.co",
    faltas: ["2026-04-05", "2026-05-24", "2026-07-12", "2026-08-30", "2026-10-04", "2026-11-09"],
    precio(iso, r) {
      const base = iso < "2026-07-01" ? 3500 : 3800;
      const prueba = r() < 0.3 ? (r() < 0.5 ? -500 : 700) : 0;
      return base + prueba;
    },
    ventas(iso, d, c, r) {
      const p = d.precio / 1000, ds = diaSemana(iso);
      let y = 205 - 46 * p + 4 * p * p - 2 * (c.temperatura - 14) + 12 * c.lluvia + 22 * (d.promo ? 1 : 0);
      if (ds === 0 || ds === 6) y += 26;  // turistas de fin de semana
      if (d.tipo === "Festivo") y += 30;
      if (d.tipo === "Vacaciones") y += 12;
      return Math.max(10, Math.round(y + 8 * normal(r)));
    },
    promo: (iso, r) => ((diaSemana(iso) === 3) ? r() < 0.6 : r() < 0.15),
  },
  {
    slug: "granos-del-parque", nombre: "Granos del Parque", ciudad: "Bogotá", producto: "capuchino",
    meta: 120, diasAbiertos: [1, 2, 3, 4, 5], desde: "2026-01-13", semilla: 303, tBase: 14.0, cierraFestivos: true,
    correo: "demo@granosdelparque.co",
    faltas: ["2026-02-20", "2026-04-28", "2026-07-03", "2026-09-11"],
    precio(iso, r) { const base = iso < "2026-08-01" ? 6000 : 6500; return base + (r() < 0.2 ? (r() < 0.5 ? -800 : 500) : 0); },
    ventas(iso, d, c, r) { // zona de oficinas: lunes y viernes flojos, vacaciones muy flojas
      const p = d.precio / 1000, ds = diaSemana(iso);
      let y = 330 - 52 * p + 3 * p * p - 3 * (c.temperatura - 14) + 16 * c.lluvia + 25 * (d.promo ? 1 : 0);
      if (ds === 1) y -= 15; if (ds === 5) y -= 22; if (ds === 3) y += 10;
      if (d.tipo === "Vacaciones") y -= 45;
      return Math.max(20, Math.round(y + 10 * normal(r)));
    },
    promo: (iso, r) => (diaSemana(iso) === 4 ? r() < 0.5 : r() < 0.1),
  },
  {
    slug: "la-tostadora", nombre: "La Tostadora", ciudad: "Chía", producto: "café de origen",
    meta: 70, diasAbiertos: [3, 4, 5, 6, 0], desde: "2026-06-03", semilla: 404, tBase: 14.3,
    correo: "demo@latostadora.co",
    faltas: ["2026-07-26", "2026-09-06", "2026-10-25"],
    precio(iso, r) { return 7000 + (r() < 0.25 ? (r() < 0.5 ? -1000 : 1000) : 0); },
    ventas(iso, d, c, r) { // tienda de especialidad: fin de semana fuerte y creciendo
      const p = d.precio / 1000, ds = diaSemana(iso), meses = (diaNum(iso) - diaNum("2026-06-03")) / 30;
      let y = 120 - 14 * p + 0.6 * p * p - 2 * (c.temperatura - 14) + 6 * c.lluvia + 15 * (d.promo ? 1 : 0) + 4 * meses;
      if (ds === 6) y += 28; if (ds === 0) y += 34;
      if (d.tipo === "Festivo") y += 20;
      return Math.max(8, Math.round(y + 7 * normal(r)));
    },
    promo: (iso, r) => r() < 0.12,
  },
  {
    slug: "montana-fria", nombre: "Montaña Fría", ciudad: "Tunja", producto: "tinto",
    meta: 110, diasAbiertos: [1, 2, 3, 4, 5, 6], desde: "2025-12-01", semilla: 505, tBase: 12.8,
    correo: "demo@montanafria.co",
    faltas: ["2025-12-24", "2025-12-31", "2026-03-14", "2026-06-27", "2026-08-22", "2026-11-07"],
    precio(iso, r) { return (iso < "2026-05-01" ? 2200 : 2500) + (r() < 0.2 ? 300 : 0); },
    ventas(iso, d, c, r) { // ciudad fría: el frío y la lluvia pesan mucho
      const p = d.precio / 1000, ds = diaSemana(iso);
      let y = 230 - 60 * p + 5 * p * p - 7 * (c.temperatura - 13) + 26 * c.lluvia + 20 * (d.promo ? 1 : 0);
      if (ds === 6) y += 12; if (d.tipo === "Festivo") y -= 20; if (d.tipo === "Vacaciones") y -= 18;
      return Math.max(15, Math.round(y + 9 * normal(r)));
    },
    promo: (iso, r) => r() < 0.2,
  },
  {
    slug: "cafe-laureles", nombre: "Café Laureles", ciudad: "Medellín", producto: "café helado",
    meta: 95, diasAbiertos: [0, 1, 2, 3, 4, 5, 6], desde: "2026-04-06", semilla: 606, tBase: 23.5,
    correo: "demo@cafelaureles.co",
    faltas: ["2026-05-10", "2026-08-09", "2026-10-18"],
    precio(iso, r) { return 9000 + (r() < 0.3 ? (r() < 0.5 ? -1500 : 1000) : 0); },
    ventas(iso, d, c, r) { // en Medellín el calor SUBE las ventas de café helado
      const p = d.precio / 1000, ds = diaSemana(iso);
      let y = 150 - 9 * p + 0.3 * p * p + 6 * (c.temperatura - 23) - 18 * c.lluvia + 18 * (d.promo ? 1 : 0);
      if (ds === 0 || ds === 6) y += 22; if (d.tipo === "Festivo") y += 18;
      if (iso >= "2026-08-01" && iso <= "2026-08-12") y += 30; // Feria de las Flores
      return Math.max(10, Math.round(y + 7 * normal(r)));
    },
    promo: (iso, r) => (diaSemana(iso) === 2 ? r() < 0.6 : r() < 0.1),
  },
];

function tipoDia(iso) {
  if (FESTIVOS.includes(iso)) return "Festivo";
  if (esVacaciones(iso)) return "Vacaciones";
  return "Normal";
}

// fila simulada de un día (null si cerró o "no anotó")
function filaDemo(cafe, iso) {
  if (!cafe.diasAbiertos.includes(diaSemana(iso))) return null;
  if (cafe.faltas.includes(iso)) return null;
  if (cafe.cierraFestivos && FESTIVOS.includes(iso)) return null;
  const r = rng(diaNum(iso) * 104729 + cafe.semilla);
  const c = clima(iso, cafe.semilla, cafe.tBase);
  const d = { precio: cafe.precio(iso, r), promo: cafe.promo(iso, r), tipo: tipoDia(iso) };
  return {
    precio: d.precio, ventas: cafe.ventas(iso, d, c, r), promo: d.promo, tipo: d.tipo,
    temperatura: c.temperatura, lluvia: c.lluvia, origen: "simulado",
  };
}

function eventosDemo(cafe) {
  const ev = FESTIVOS.filter((f) => f >= cafe.desde).map((f) => ({
    fecha: f, tipo: "festivo", titulo: FESTIVO_NOMBRE[f.slice(5)] || "Festivo",
  }));
  const extra = {
    "granos-del-parque": [
      { fecha: "2026-01-13", tipo: "nota", titulo: "Abrimos frente al parque de la 93" },
      { fecha: "2026-08-01", tipo: "nota", titulo: "Capuchino a $6.500" },
      { fecha: "2026-11-19", tipo: "promocion", titulo: "Jueves de capuchino + croissant" },
      { fecha: "2026-12-11", tipo: "evento", titulo: "Fiesta de fin de año de las oficinas" },
    ],
    "la-tostadora": [
      { fecha: "2026-06-03", tipo: "nota", titulo: "Inauguración" },
      { fecha: "2026-09-12", tipo: "evento", titulo: "Cata de cafés de Huila" },
      { fecha: "2026-11-21", tipo: "evento", titulo: "Mercado campesino en la plaza" },
      { fecha: "2026-11-28", tipo: "promocion", titulo: "Black Friday: 2x1 en bolsas de café" },
    ],
    "montana-fria": [
      { fecha: "2026-05-01", tipo: "nota", titulo: "Tinto a $2.500" },
      { fecha: "2026-10-15", tipo: "evento", titulo: "Festival de la Ruana" },
      { fecha: "2026-12-04", tipo: "evento", titulo: "Aguinaldo boyacense" },
    ],
    "cafe-laureles": [
      { fecha: "2026-04-06", tipo: "nota", titulo: "Abrimos en Laureles" },
      { fecha: "2026-08-01", tipo: "evento", titulo: "Feria de las Flores" },
      { fecha: "2026-11-24", tipo: "promocion", titulo: "Martes de café helado a mitad de precio" },
      { fecha: "2026-12-01", tipo: "evento", titulo: "Alborada y alumbrados" },
    ],
  }[cafe.slug];
  if (extra) return [...ev, ...extra];
  const propios = cafe.slug === "cafe-la-esquina" ? [
    { fecha: "2026-02-01", tipo: "nota", titulo: "Subimos el tinto a $2.800" },
    { fecha: "2026-06-01", tipo: "nota", titulo: "Nueva carta: tinto a $3.000" },
    { fecha: "2026-09-01", tipo: "nota", titulo: "Tinto a $3.200" },
    { fecha: "2026-08-08", tipo: "nota", titulo: "Cerramos por arreglo de la máquina" },
    { fecha: "2026-10-31", tipo: "evento", titulo: "Halloween: decoración y combo" },
    { fecha: "2026-11-24", tipo: "promocion", titulo: "Martes de 2x1 en tinto" },
    { fecha: "2026-12-16", tipo: "evento", titulo: "Empieza la novena" },
    { fecha: "2026-12-20", tipo: "promocion", titulo: "Combo navideño: tinto + buñuelo" },
  ] : [
    { fecha: "2026-03-02", tipo: "nota", titulo: "Abrimos" },
    { fecha: "2026-04-02", tipo: "evento", titulo: "Semana Santa: muchos turistas" },
    { fecha: "2026-07-01", tipo: "nota", titulo: "Café con leche a $3.800" },
    { fecha: "2026-08-15", tipo: "evento", titulo: "Concierto en la plaza" },
    { fecha: "2026-11-21", tipo: "evento", titulo: "Feria gastronómica en la Catedral de Sal" },
    { fecha: "2026-11-25", tipo: "promocion", titulo: "Miércoles de pan gratis con el café" },
    { fecha: "2026-12-07", tipo: "evento", titulo: "Noche de velitas" },
  ];
  return [...ev, ...propios];
}

module.exports = { CAFES, FESTIVOS, filaDemo, eventosDemo, diaNum, isoDe, diaSemana };
