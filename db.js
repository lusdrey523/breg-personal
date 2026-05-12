/**
 * BREG Personal — db.js
 * Capa de persistencia local con seguridad por diseño.
 * Fase 1: localStorage con validación e integridad de datos.
 * Fase 2: IndexedDB. Fase 3: Cloud sync.
 */

"use strict";

const DB_KEY     = 'breg_registros_v2';
const DEUDA_KEY  = 'breg_deuda_v2';
const CONFIG_KEY = 'breg_config_v1';

/* ─── Sanitización (Security by design) ─── */
function sanitizeString(val, maxLen = 200) {
  if (typeof val !== 'string') return '';
  return val.replace(/[<>"'`]/g, '').trim().slice(0, maxLen);
}
function sanitizeNumber(val, min = 0, max = 999_999_999) {
  const n = parseFloat(val);
  if (isNaN(n)) return 0;
  return Math.min(Math.max(n, min), max);
}
function sanitizeRegistro(reg) {
  return {
    id:           typeof reg.id === 'number' ? reg.id : Date.now(),
    fecha:        sanitizeString(reg.fecha, 10),
    zona:         sanitizeString(reg.zona),
    notas:        sanitizeString(reg.notas, 500),
    inicio:       sanitizeString(reg.inicio, 5),
    fin:          sanitizeString(reg.fin, 5),
    ingreso:      sanitizeNumber(reg.ingreso),
    transporte:   sanitizeNumber(reg.transporte),
    alimentacion: sanitizeNumber(reg.alimentacion),
    otros:        sanitizeNumber(reg.otros),
    gastos:       sanitizeNumber(reg.gastos),
    neto:         sanitizeNumber(reg.neto, -999_999_999),
    semilla:      sanitizeNumber(reg.semilla),
    disponible:   sanitizeNumber(reg.disponible, -999_999_999),
    horas:        sanitizeNumber(reg.horas, 0, 24),
    xhora:        sanitizeNumber(reg.xhora, 0),
    items:        Array.isArray(reg.items)
                    ? reg.items.map(i => ({
                        categoria: sanitizeString(i.categoria, 50),
                        cantidad:  sanitizeNumber(i.cantidad, 0, 99999),
                      }))
                    : [],
    deudaGenerada: !!reg.deudaGenerada,
    createdAt:    typeof reg.createdAt === 'number' ? reg.createdAt : Date.now(),
  };
}

/* ─── Storage seguro (con try/catch y validación JSON) ─── */
function leerStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    console.warn(`[BREG] Error leyendo ${key}. Usando fallback.`);
    return fallback;
  }
}
function escribirStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    // QuotaExceededError u otros
    console.error(`[BREG] Error escribiendo ${key}:`, e);
    return false;
  }
}

/* ─── INIT ─── */
export async function initDB() {
  if (!localStorage.getItem(DB_KEY))     escribirStorage(DB_KEY, []);
  if (!localStorage.getItem(DEUDA_KEY))  escribirStorage(DEUDA_KEY, { activa: false, monto: 0, interes: 0, dias: 0, inicio: null });
  if (!localStorage.getItem(CONFIG_KEY)) escribirStorage(CONFIG_KEY, { tasa: 0.04, sofrSpread: 0.04 });
}

/* ─── REGISTROS ─── */
export async function getRegistros() {
  const data = leerStorage(DB_KEY, []);
  if (!Array.isArray(data)) return [];
  return data.map(sanitizeRegistro);
}

export async function saveRegistro(reg) {
  const registros = await getRegistros();
  const nuevo = sanitizeRegistro({ ...reg, id: Date.now(), createdAt: Date.now() });
  registros.push(nuevo);
  escribirStorage(DB_KEY, registros);
  return nuevo;
}

export async function deleteRegistro(id) {
  const registros = await getRegistros();
  const filtrados = registros.filter(r => r.id !== id);
  escribirStorage(DB_KEY, filtrados);
}

export async function getRegistroById(id) {
  const registros = await getRegistros();
  return registros.find(r => r.id === id) || null;
}

/* ─── DEUDA ─── */
export async function getDeuda() {
  return leerStorage(DEUDA_KEY, { activa: false, monto: 0, interes: 0, dias: 0, inicio: null });
}
export async function saveDeuda(deuda) {
  escribirStorage(DEUDA_KEY, deuda);
}
export async function actualizarInteresDeuda() {
  const deuda = await getDeuda();
  const config = leerStorage(CONFIG_KEY, { sofrSpread: 0.04 });
  if (!deuda.activa || deuda.monto <= 0) return deuda;

  const tasaDiaria = (0.054 + config.sofrSpread) / 365; // SOFR ~5.4% + spread 4%
  deuda.interes += deuda.monto * tasaDiaria;
  deuda.dias    += 1;
  escribirStorage(DEUDA_KEY, deuda);
  return deuda;
}

/* ─── CONFIG ─── */
export async function getConfig() {
  return leerStorage(CONFIG_KEY, { tasa: 0.04, sofrSpread: 0.04 });
}

/* ─── EXPORTACIÓN segura (protocolo BREG–Ziva) ─── */
export async function exportarDatos() {
  const registros = await getRegistros();
  const deuda     = await getDeuda();
  const config    = await getConfig();

  const payload = {
    version: '2.0',
    exportadoEn: new Date().toISOString(),
    protocolo: 'BREG-Ziva-v2',
    registros,
    deuda,
    config,
    checksum: registros.length, // hash básico; en Fase 3: SHA-256 real
  };
  return payload;
}

/* ─── IMPORTACIÓN con validación ─── */
export async function importarDatos(json) {
  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if (!data.protocolo || !Array.isArray(data.registros)) {
      throw new Error('Formato inválido');
    }
    const registrosSanitizados = data.registros.map(sanitizeRegistro);
    escribirStorage(DB_KEY, registrosSanitizados);
    if (data.deuda) escribirStorage(DEUDA_KEY, data.deuda);
    return { ok: true, count: registrosSanitizados.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
