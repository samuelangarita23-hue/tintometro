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
function clima(iso, semilla) {
  const r = rng(diaNum(iso) * 7919 + semilla);
  const mes = +iso.slice(5, 7);
  const lluvioso = [4, 5, 10, 11].includes(mes) ? 0.62 : [3, 9, 12].includes(mes) ? 0.42 : 0.28;
  const lluvia = r() < lluvioso ? 1 : 0;
  const T = Math.round((14.3 + 1.4 * normal(r) - 1.1 * lluvia) * 10) / 10;
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
  const r = rng(diaNum(iso) * 104729 + cafe.semilla);
  const c = clima(iso, cafe.semilla);
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

module.exports = { CAFES, filaDemo, eventosDemo, diaNum, isoDe, diaSemana };
