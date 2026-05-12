/**
 * BREG Personal — app.js
 * Core del sistema. Conecta DB → Finance → UI → Charts.
 * Security by design: inputs sanitizados en db.js,
 * event handlers centralizados, sin eval(), sin innerHTML directo.
 */

"use strict";

import { initDB, saveRegistro, getRegistros, deleteRegistro,
         getRegistroById, getDeuda, saveDeuda,
         actualizarInteresDeuda, exportarDatos } from './db.js';
import { calcularFinanzas, calcularHoras, formatCLP, formatHoras } from './finance.js';
import { renderDashboard, renderHistorial, renderDetalle, renderAnalytics } from './ui.js';
import { renderChartNeto, renderChartZona, renderChartHoras, renderChartDeuda } from './charts.js';
import { loadTheme, toggleTheme } from './theme.js';
import { calcularEficienciaPorZona } from './finance.js';

/* ─── ESTADO ─── */
let items       = [];          // materiales del form actual
let registros   = [];
let deuda       = {};
let filtroActual = 'todos';
let detalleId   = null;        // ID del registro en detalle

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Splash
  setTimeout(() => {
    document.getElementById('splash')?.classList.add('splash--out');
    const app = document.getElementById('app');
    app.hidden = false;
    app.removeAttribute('aria-hidden');
  }, 1600);

  // 2. Cargar tema
  loadTheme();

  // 3. Inicializar DB
  await initDB();

  // 4. Cargar datos
  await cargarDatos();

  // 5. Bind de eventos
  bindEvents();

  // 6. Fecha de hoy por defecto
  const fechaInput = document.getElementById('f-fecha');
  if (fechaInput) fechaInput.value = hoy();

  // 7. Service Worker
  registrarSW();

  // 8. Actualizar interés de deuda diariamente
  await actualizarInteresDeuda();
  await cargarDatos(); // re-render tras actualizar interés
});

/* ─── DATOS ─── */
async function cargarDatos() {
  registros = await getRegistros();
  deuda     = await getDeuda();
  refreshUI();
}

function refreshUI() {
  const vista = vistaActual();
  renderDashboard(registros, deuda);
  renderChartNeto(registros);

  if (vista === 'historial') {
    renderHistorial(registros, filtroActual);
  }
  if (vista === 'analisis') {
    renderAnalytics(registros);
    const zonas = calcularEficienciaPorZona(registros);
    renderChartZona(zonas);
    renderChartHoras(registros);
    renderChartDeuda(registros);
  }
}

/* ─── EVENTOS ─── */
function bindEvents() {
  // Navegación (bottom nav + botones data-vista)
  document.querySelectorAll('[data-vista]').forEach(btn => {
    btn.addEventListener('click', () => cambiarVista(btn.dataset.vista));
  });

  // Tema
  document.getElementById('btn-theme')
    ?.addEventListener('click', () => {
      const nuevo = toggleTheme();
      mostrarToast(`Tema: ${nuevo}`, 'success');
      setTimeout(refreshUI, 50); // re-render charts con nuevo color
    });

  // Exportar
  document.getElementById('btn-exportar')
    ?.addEventListener('click', exportarJSON);

  // Formulario: agregar material
  document.getElementById('btn-agregar-item')
    ?.addEventListener('click', agregarItem);

  // Formulario: guardar
  document.getElementById('btn-guardar')
    ?.addEventListener('click', guardarRegistro);

  // Formulario: cancelar
  document.getElementById('btn-cancelar')
    ?.addEventListener('click', () => cambiarVista('inicio'));

  // Cálculo en tiempo real
  ['f-ingreso','f-transporte','f-alimentacion','f-otros',
   'f-hora-inicio','f-hora-fin'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', actualizarPreview);
  });

  // Filtros historial
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
      btn.classList.add('filter-btn--active');
      filtroActual = btn.dataset.filter;
      renderHistorial(registros, filtroActual);
    });
  });

  // Detalle: volver
  document.getElementById('btn-detalle-back')
    ?.addEventListener('click', () => cambiarVista('historial'));

  // Detalle: eliminar
  document.getElementById('btn-eliminar')
    ?.addEventListener('click', () => {
      if (detalleId) confirmarEliminar(detalleId);
    });

  // Modal: cancelar
  document.getElementById('modal-cancel')
    ?.addEventListener('click', cerrarModal);

  // Teclado: cerrar modal con Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarModal();
  });

  // Exposición de verDetalle para tarjetas (event delegation alternativo)
  window.__bregVerDetalle = verDetalle;
}

/* ─── NAVEGACIÓN ─── */
function cambiarVista(vista) {
  const vistas = document.querySelectorAll('.vista');
  vistas.forEach(v => {
    v.classList.remove('vista--activa');
    v.hidden = true;
  });
  const target = document.getElementById(`vista-${vista}`);
  if (!target) return;
  target.hidden = false;
  target.classList.add('vista--activa');

  // Actualizar nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const active = btn.dataset.vista === vista;
    btn.classList.toggle('nav-btn--active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });

  refreshUI();

  // Scroll top
  document.querySelector('.main-content')?.scrollTo(0, 0);
}

function vistaActual() {
  const activa = document.querySelector('.vista--activa');
  return activa?.id?.replace('vista-', '') || 'inicio';
}

/* ─── FORM: AGREGAR ITEM ─── */
function agregarItem() {
  const catEl  = document.getElementById('f-cat');
  const cantEl = document.getElementById('f-cant');
  if (!catEl || !cantEl) return;

  const cat  = catEl.value;
  const cant = parseFloat(cantEl.value);

  if (!cant || cant <= 0) {
    mostrarToast('Ingresa una cantidad válida', 'warn');
    cantEl.focus();
    return;
  }
  if (cant > 99999) {
    mostrarToast('Cantidad demasiado grande', 'warn');
    return;
  }

  items.push({ categoria: cat, cantidad: cant });
  cantEl.value = '';
  cantEl.focus();
  renderItems();
}

function renderItems() {
  const cont = document.getElementById('lista-items');
  if (!cont) return;
  if (!items.length) {
    cont.innerHTML = '<p class="lista-vacia">Sin materiales agregados</p>';
    return;
  }
  cont.innerHTML = items.map((item, i) => `
    <div class="item-produccion" role="listitem">
      <span>${escapeHTML(item.categoria)}</span>
      <strong>${item.cantidad} kg</strong>
      <button class="del-btn" data-idx="${i}" aria-label="Eliminar ${escapeHTML(item.categoria)}">✕</button>
    </div>
  `).join('');

  cont.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      items.splice(idx, 1);
      renderItems();
    });
  });
}

/* ─── FORM: PREVIEW EN TIEMPO REAL ─── */
function actualizarPreview() {
  const d = leerFormData();
  const f = calcularFinanzas(d);

  setText('prev-gastos',    formatCLP(f.gastos));
  setText('prev-neto',      formatCLP(f.neto));
  setText('prev-semilla',   formatCLP(f.semilla));
  setText('prev-disponible',formatCLP(f.disponible));

  const horaRow = document.getElementById('prev-hora-row');
  if (f.horas > 0 && horaRow) {
    horaRow.hidden = false;
    setText('prev-xhora', formatCLP(f.xhora) + '/h');
  }

  // Mostrar horas calculadas
  const horasEl = document.getElementById('horas-calc');
  const horasVal = document.getElementById('horas-calc-val');
  if (horasEl && horasVal && f.horas > 0) {
    horasEl.hidden = false;
    horasVal.textContent = `${formatHoras(f.horas)} trabajadas`;
  }
}

/* ─── FORM: GUARDAR REGISTRO ─── */
async function guardarRegistro() {
  const d = leerFormData();

  // Validación mínima
  if (!d.fecha) {
    mostrarToast('Selecciona una fecha', 'warn');
    document.getElementById('f-fecha')?.focus();
    return;
  }
  if (d.ingreso <= 0) {
    mostrarToast('Ingresa un ingreso bruto', 'warn');
    document.getElementById('f-ingreso')?.focus();
    return;
  }

  const f = calcularFinanzas(d);

  // SISTEMA DE DISCIPLINA: deuda si neto < 0
  if (f.netoNegativo) {
    deuda = await getDeuda();
    const montoDeuda = Math.abs(f.neto);
    const penalizacion = montoDeuda * 0.04;
    deuda.monto   = (deuda.monto || 0) + montoDeuda + penalizacion;
    deuda.activa  = true;
    deuda.dias    = (deuda.dias || 0) + 1;
    if (!deuda.inicio) deuda.inicio = new Date().toISOString();
    await saveDeuda(deuda);
    mostrarToast(`⚠ Deuda generada: ${formatCLP(montoDeuda + penalizacion)}`, 'error');
  }

  const reg = {
    ...d,
    ...f,
    items,
    deudaGenerada: f.netoNegativo,
  };

  await saveRegistro(reg);
  items = [];
  renderItems();
  resetForm();
  await cargarDatos();
  cambiarVista('inicio');
  mostrarToast('✓ Registro guardado', 'success');
}

/* ─── HISTORIAL: VER DETALLE ─── */
async function verDetalle(id) {
  const reg = await getRegistroById(id);
  if (!reg) { mostrarToast('Registro no encontrado', 'error'); return; }
  detalleId = id;
  renderDetalle(reg);
  cambiarVista('detalle');
}

/* ─── HISTORIAL: ELIMINAR ─── */
function confirmarEliminar(id) {
  document.getElementById('modal-body').textContent =
    '¿Eliminar este registro? Esta acción no se puede deshacer.';
  document.getElementById('modal-confirm').hidden = false;

  const btn = document.getElementById('modal-confirm-btn');
  // Limpiar listeners previos clonando
  const btnNew = btn.cloneNode(true);
  btn.replaceWith(btnNew);
  btnNew.addEventListener('click', async () => {
    await deleteRegistro(id);
    cerrarModal();
    await cargarDatos();
    cambiarVista('historial');
    mostrarToast('Registro eliminado', 'success');
  });
}
function cerrarModal() {
  document.getElementById('modal-confirm').hidden = true;
}

/* ─── EXPORTAR ─── */
async function exportarJSON() {
  const payload = await exportarDatos();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `breg-data-${hoy()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  mostrarToast('Datos exportados ✓', 'success');
}

/* ─── SERVICE WORKER ─── */
function registrarSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .catch(e => console.warn('[BREG] SW no registrado:', e));
  }
}

/* ─── TOAST ─── */
export function mostrarToast(msg, tipo = 'success') {
  const cont  = document.getElementById('toast-container');
  if (!cont) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${tipo}`;
  const iconos = { success: '✓', error: '✕', warn: '⚠' };
  toast.innerHTML = `<span>${iconos[tipo] || '•'}</span><span>${escapeHTML(msg)}</span>`;
  cont.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast--out');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

/* ─── HELPERS ─── */
function leerFormData() {
  return {
    fecha:        val('f-fecha'),
    inicio:       val('f-hora-inicio'),
    fin:          val('f-hora-fin'),
    zona:         val('f-zona'),
    notas:        val('f-notas'),
    ingreso:      num('f-ingreso'),
    transporte:   num('f-transporte'),
    alimentacion: num('f-alimentacion'),
    otros:        num('f-otros'),
  };
}
function resetForm() {
  ['f-hora-inicio','f-hora-fin','f-zona','f-notas',
   'f-ingreso','f-transporte','f-alimentacion','f-otros'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-fecha').value = hoy();
  document.getElementById('horas-calc').hidden = true;
  actualizarPreview();
}
function val(id)  { return document.getElementById(id)?.value?.trim() || ''; }
function num(id)  { return parseFloat(document.getElementById(id)?.value) || 0; }
function setText(id, t) {
  const el = document.getElementById(id);
  if (el) el.textContent = t;
}
function hoy() {
  return new Date().toISOString().slice(0, 10);
}
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
