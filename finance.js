/**
 * BREG Personal — finance.js
 * Motor financiero: Protocolo BREG (15%), Sistema de Deuda,
 * productividad por hora/zona, intereses SOFR reales.
 */

"use strict";

export const TASA_SEMILLA    = 0.15;
export const SOFR_REF        = 0.054;  // SOFR referencial
export const SPREAD_BREG     = 0.04;   // +4% spread BREG
export const TASA_ANUAL_DEUDA = SOFR_REF + SPREAD_BREG; // 9.4%

/* ─── CÁLCULO PRINCIPAL ─── */
export function calcularFinanzas(d) {
  const transporte   = parseFloat(d.transporte)   || 0;
  const alimentacion = parseFloat(d.alimentacion) || 0;
  const otros        = parseFloat(d.otros)        || 0;
  const ingreso      = parseFloat(d.ingreso)      || 0;

  const gastos     = transporte + alimentacion + otros;
  const neto       = ingreso - gastos;
  const semilla    = Math.max(0, neto * TASA_SEMILLA);
  const disponible = neto - semilla;
  const horas      = calcularHoras(d.inicio, d.fin);
  const xhora      = horas > 0 ? neto / horas : 0;

  return {
    gastos,
    neto,
    semilla,
    disponible,
    horas,
    xhora,
    netoNegativo: neto < 0,
    disponibleNegativo: disponible < 0,
  };
}

/* ─── HORAS TRABAJADAS ─── */
export function calcularHoras(inicio, fin) {
  if (!inicio || !fin) return 0;
  try {
    const [hI, mI] = inicio.split(':').map(Number);
    const [hF, mF] = fin.split(':').map(Number);
    if (isNaN(hI) || isNaN(hF)) return 0;
    let totalMin = (hF * 60 + mF) - (hI * 60 + mI);
    if (totalMin < 0) totalMin += 24 * 60; // cruce de medianoche
    return Math.min(totalMin / 60, 24); // máx 24h como guard
  } catch {
    return 0;
  }
}

/* ─── SISTEMA DE DEUDA ─── */
/**
 * Calcular interés diario basado en tasa SOFR + spread.
 * Fórmula: I_diario = Deuda × (TASA_ANUAL / 365)
 */
export function calcularInteresDiario(montoDeuda) {
  return montoDeuda * (TASA_ANUAL_DEUDA / 365);
}

export function calcularInteresAcumulado(montoDeuda, diasEnDeuda) {
  // Interés compuesto diario
  return montoDeuda * (Math.pow(1 + TASA_ANUAL_DEUDA / 365, diasEnDeuda) - 1);
}

/**
 * Generar deuda cuando disponible < 0 o retiro no permitido.
 * Penalización: deuda base + 4% inmediato.
 */
export function generarDeuda(montoBase, deudaExistente = 0) {
  const nuevaDeuda = Math.abs(montoBase);
  const penalizacion = nuevaDeuda * 0.04; // 4% inmediato
  return {
    monto: deudaExistente + nuevaDeuda + penalizacion,
    penalizacion,
    activa: true,
  };
}

/* ─── ANALYTICS ─── */
/**
 * Agrupar registros por zona y calcular métricas.
 */
export function calcularEficienciaPorZona(registros) {
  const zonas = {};
  for (const r of registros) {
    const zona = r.zona?.trim() || 'Sin zona';
    if (!zonas[zona]) zonas[zona] = { zona, count: 0, neto: 0, horas: 0 };
    zonas[zona].count++;
    zonas[zona].neto  += r.neto  || 0;
    zonas[zona].horas += r.horas || 0;
  }
  return Object.values(zonas).map(z => ({
    ...z,
    xhora: z.horas > 0 ? z.neto / z.horas : 0,
    promedio: z.count > 0 ? z.neto / z.count : 0,
  })).sort((a, b) => b.xhora - a.xhora);
}

/**
 * Métricas globales del dashboard.
 */
export function calcularMetricas(registros) {
  if (!registros.length) return {
    totalNeto: 0, totalSemilla: 0, totalHoras: 0,
    totalRegistros: 0, promedioNeto: 0, xhoraGlobal: 0,
    mejorZona: '—', tendencia: 0,
  };

  const totalNeto    = registros.reduce((a, r) => a + (r.neto || 0), 0);
  const totalSemilla = registros.reduce((a, r) => a + (r.semilla || 0), 0);
  const totalHoras   = registros.reduce((a, r) => a + (r.horas || 0), 0);
  const xhoraGlobal  = totalHoras > 0 ? totalNeto / totalHoras : 0;
  const promedioNeto = totalNeto / registros.length;

  // Mejor zona por CLP/h
  const porZona  = calcularEficienciaPorZona(registros);
  const mejorZona = porZona[0]?.zona || '—';

  // Tendencia: comparar últimos 5 vs anteriores 5
  const ultimos  = registros.slice(-5).reduce((a, r) => a + r.neto, 0);
  const previos  = registros.slice(-10, -5).reduce((a, r) => a + r.neto, 0) || ultimos;
  const tendencia = previos > 0 ? ((ultimos - previos) / previos) * 100 : 0;

  return { totalNeto, totalSemilla, totalHoras, totalRegistros: registros.length,
           promedioNeto, xhoraGlobal, mejorZona, tendencia };
}

/* ─── FORMATO ─── */
export function formatCLP(num) {
  if (typeof num !== 'number' || isNaN(num)) return '$0';
  return '$' + Math.round(num).toLocaleString('es-CL');
}
export function formatHoras(h) {
  if (!h || h <= 0) return '0h';
  const hrs = Math.floor(h);
  const min = Math.round((h - hrs) * 60);
  return min > 0 ? `${hrs}h ${min}m` : `${hrs}h`;
}
export function formatPct(n) {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}
