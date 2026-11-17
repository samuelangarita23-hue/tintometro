// Rachas y resumen de una cafetería a partir de sus ventas.
const { diaNum, isoDe, diaSemana, FESTIVOS } = require("./demo");

// días abiertos hacia atrás desde "desde" (incluido)
function* abiertosHaciaAtras(desde, abiertos, limite = 800, cerrados = []) {
  let n = diaNum(desde);
  for (let i = 0; i < limite; i++, n--) {
    const iso = isoDe(n);
    if (abiertos.includes(diaSemana(iso)) && !cerrados.includes(iso)) yield iso;
  }
}

// lunes de la semana de una fecha
function lunesDe(iso) {
  const ds = diaSemana(iso);
  return isoDe(diaNum(iso) - ((ds + 6) % 7));
}

function rachaMasLarga(lista, ok) {
  let mejor = 0, act = 0;
  for (const x of lista) { act = ok(x) ? act + 1 : 0; if (act > mejor) mejor = act; }
  return mejor;
}

function calcularResumen(cafe, ventas, hoy) {
  const abiertos = cafe.diasAbiertos && cafe.diasAbiertos.length ? cafe.diasAbiertos : [0, 1, 2, 3, 4, 5, 6];
  const fechas = Object.keys(ventas).sort();
  const vacio = { registro: { actual: 0, record: 0, hoyAnotado: false }, meta: { actual: 0, record: 0 },
    semanas: { actual: 0, record: 0 }, dias: 0, total: 0, promedio: 0, ultimo: null, mejorDia: null };
  if (!fechas.length) return vacio;

  const ayer = isoDe(diaNum(hoy) - 1);
  const hoyAnotado = !!ventas[hoy];
  const meta = +cafe.meta || 0;
  const cerrados = cafe.cierraFestivos ? FESTIVOS : [];

  // 1) días seguidos anotando ventas (si hoy aún no anota, la racha sigue viva desde ayer)
  let registro = 0;
  for (const iso of abiertosHaciaAtras(hoyAnotado ? hoy : ayer, abiertos, 800, cerrados)) {
    if (iso < fechas[0]) break;
    if (ventas[iso]) registro++; else break;
  }
  // 2) días seguidos cumpliendo la meta (mismo punto de partida)
  let metaAct = 0;
  if (meta > 0) for (const iso of abiertosHaciaAtras(hoyAnotado ? hoy : ayer, abiertos, 800, cerrados)) {
    if (iso < fechas[0]) break;
    if (ventas[iso] && ventas[iso].ventas >= meta) metaAct++; else break;
  }
  // récords sobre toda la historia (solo días abiertos)
  const todosAbiertos = [];
  for (let n = diaNum(fechas[0]); n <= diaNum(hoy); n++) {
    const iso = isoDe(n); if (abiertos.includes(diaSemana(iso)) && !cerrados.includes(iso)) todosAbiertos.push(iso);
  }
  const recReg = rachaMasLarga(todosAbiertos, (i) => !!ventas[i]);
  const recMeta = meta > 0 ? rachaMasLarga(todosAbiertos, (i) => ventas[i] && ventas[i].ventas >= meta) : 0;

  // 3) semanas seguidas vendiendo más que la anterior (solo semanas completas)
  const semanal = {};
  for (const f of fechas) { const l = lunesDe(f); semanal[l] = (semanal[l] || 0) + ventas[f].ventas; }
  const lunesActual = lunesDe(hoy);
  const semanas = Object.keys(semanal).filter((l) => l < lunesActual && l > fechas[0]).sort();
  const sube = semanas.map((l, i) => i > 0 && semanal[l] > semanal[semanas[i - 1]]);
  let semAct = 0; for (let i = sube.length - 1; i >= 0 && sube[i]; i--) semAct++;
  const recSem = rachaMasLarga(sube, (x) => x);

  const total = fechas.reduce((s, f) => s + ventas[f].ventas, 0);
  const mejor = fechas.reduce((a, f) => (ventas[f].ventas > ventas[a].ventas ? f : a), fechas[0]);
  const ultimas = semanas.slice(-8).map((l) => ({ semana: l, ventas: semanal[l] }));
  return {
    registro: { actual: registro, record: Math.max(recReg, registro), hoyAnotado },
    meta: { actual: metaAct, record: Math.max(recMeta, metaAct), valor: meta },
    semanas: { actual: semAct, record: Math.max(recSem, semAct), ultimas },
    dias: fechas.length, total, promedio: Math.round(total / fechas.length),
    primero: fechas[0], ultimo: fechas[fechas.length - 1],
    mejorDia: { fecha: mejor, ventas: ventas[mejor].ventas },
  };
}

module.exports = { calcularResumen, lunesDe };
