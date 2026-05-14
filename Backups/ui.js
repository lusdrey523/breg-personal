/**
 * BREG Personal — ui.js
 * Render del DOM: Dashboard, Historial, Detalle.
 */

"use strict";

import { formatCLP, formatHoras, formatPct, calcularMetricas, calcularEficienciaPorZona } from './finance.js';

/* ─── DASHBOARD ─── */
export function renderDashboard(registros, deuda) {
  const m = calcularMetricas(registros);

  setText('dash-neto',      formatCLP(m.totalNeto));
  setText('dash-semilla',   formatCLP(m.totalSemilla));
  setText('dash-registros', String(m.totalRegistros));
  setText('dash-horas',     formatHoras(m.totalHoras));
  setText('dash-xhora',     m.xhoraGlobal > 0 ? formatCLP(m.xhoraGlobal) : '—');
  setText('dash-zona',      m.mejorZona);

  // Tendencia
  const trendEl = document.getElementById('dash-neto-trend');
  if (trendEl && m.tendencia !== 0) {
    trendEl.textContent = formatPct(m.tendencia);
    trendEl.style.color = m.tendencia >= 0 ? 'var(--success)' : 'var(--danger)';
  }

  // Deuda
  const deudaMonto = deuda?.monto || 0;
  const deudaInt   = deuda?.interes || 0;
  setText('dash-deuda',   formatCLP(deudaMonto));
  setText('dash-interes', formatCLP(deudaInt));

  // Alerta de deuda visible
  const alertEl = document.getElementById('deuda-alert');
  if (alertEl) {
    const mostrar = deuda?.activa && deudaMonto > 0;
    alertEl.hidden = !mostrar;
    if (mostrar) {
      setText('deuda-alert-monto',  formatCLP(deudaMonto + deudaInt));
      const tasaDiariaPct = ((0.054 + 0.04) / 365 * 100).toFixed(4);
      setText('deuda-alert-interes', `${tasaDiariaPct}% diario (SOFR+4%)`);
    }
  }

  // Último registro
  const lastEl = document.getElementById('last-reg');
  if (lastEl && registros.length > 0) {
    const last = registros[registros.length - 1];
    lastEl.hidden = false;
    setText('last-fecha', last.fecha || '—');
    setText('last-zona',  last.zona  || '—');
    setText('last-neto',  formatCLP(last.neto));
    const netoEl = document.getElementById('last-neto');
    if (netoEl) netoEl.style.color = last.neto >= 0 ? 'var(--success)' : 'var(--danger)';
  }
}

/* ─── HISTORIAL ─── */
export function renderHistorial(registros, filtro = 'todos') {
  const filtrados = filtrarRegistros(registros, filtro);
  const cont = document.getElementById('lista-registros');
  const emptyEl = document.getElementById('historial-empty');
  if (!cont) return;

  // Stats del período
  const total  = filtrados.reduce((a, r) => a + r.neto, 0);
  const avg    = filtrados.length ? total / filtrados.length : 0;
  setText('hstat-count', String(filtrados.length));
  setText('hstat-neto',  formatCLP(total));
  setText('hstat-avg',   formatCLP(avg));

  if (!filtrados.length) {
    cont.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  // Ordenar por fecha desc
  const ordenados = [...filtrados].sort((a, b) => b.createdAt - a.createdAt);

  cont.innerHTML = ordenados.map(r => {
    const netoClase = r.neto >= 0 ? 'reg-neto--pos' : 'reg-neto--neg';
    return `
    <div class="registro-card" role="listitem" tabindex="0"
         data-id="${r.id}"
         aria-label="Registro del ${r.fecha}, neto ${formatCLP(r.neto)}">
      <div class="reg-top">
        <div>
          <div class="reg-fecha">${r.fecha || '—'}</div>
          <div class="reg-zona">${escapeHTML(r.zona || 'Sin zona')}</div>
        </div>
        <div class="${'reg-neto ' + netoClase}">${formatCLP(r.neto)}</div>
      </div>
      <div class="reg-meta">
        <span>⏱ <strong>${formatHoras(r.horas)}</strong></span>
        ${r.xhora > 0 ? `<span>⚡ <strong>${formatCLP(r.xhora)}/h</strong></span>` : ''}
        ${r.items?.length ? `<span>📦 <strong>${r.items.length} items</strong></span>` : ''}
        <span class="reg-semilla-badge">🌱 ${formatCLP(r.semilla)}</span>
      </div>
    </div>`;
  }).join('');

  // Eventos de click
  cont.querySelectorAll('.registro-card').forEach(card => {
    const id = parseInt(card.dataset.id, 10);
    card.addEventListener('click', () => window.__bregVerDetalle?.(id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') window.__bregVerDetalle?.(id);
    });
  });
}

/* ─── DETALLE ─── */
export function renderDetalle(r) {
  const cont = document.getElementById('detalle-contenido');
  if (!cont || !r) return;

  const netoColor = r.neto >= 0 ? 'var(--success)' : 'var(--danger)';

  cont.innerHTML = `
    <!-- Hero: Neto -->
    <div class="detalle-card detalle-card--hero">
      <div class="detalle-card__title">📅 ${escapeHTML(r.fecha || '—')} · ${escapeHTML(r.zona || 'Sin zona')}</div>
      <div class="detalle-neto" style="color:${netoColor}">${formatCLP(r.neto)}</div>
      <div class="detalle-meta">
        ${r.horas > 0 ? `<span>⏱ ${formatHoras(r.horas)}</span>` : ''}
        ${r.xhora > 0 ? `<span>⚡ ${formatCLP(r.xhora)}/hora</span>` : ''}
      </div>
    </div>

    <!-- Breakdown financiero -->
    <div class="detalle-card">
      <div class="detalle-card__title">💰 Finanzas</div>
      <div class="detalle-row">
        <span>Ingreso bruto</span>
        <strong>${formatCLP(r.ingreso)}</strong>
      </div>
      <div class="detalle-row">
        <span>Transporte</span>
        <strong class="val--red">-${formatCLP(r.transporte)}</strong>
      </div>
      <div class="detalle-row">
        <span>Alimentación</span>
        <strong class="val--red">-${formatCLP(r.alimentacion)}</strong>
      </div>
      ${r.otros > 0 ? `<div class="detalle-row">
        <span>Otros gastos</span>
        <strong class="val--red">-${formatCLP(r.otros)}</strong>
      </div>` : ''}
      <div class="detalle-row">
        <span>Total gastos</span>
        <strong class="val--red">-${formatCLP(r.gastos)}</strong>
      </div>
      <div class="detalle-row">
        <span>Neto</span>
        <strong style="color:${netoColor}">${formatCLP(r.neto)}</strong>
      </div>
      <div class="detalle-row">
        <span>Capital semilla (15%)</span>
        <strong class="val--cyan">${formatCLP(r.semilla)}</strong>
      </div>
      <div class="detalle-row">
        <span>Disponible</span>
        <strong class="val--green">${formatCLP(r.disponible)}</strong>
      </div>
    </div>

    <!-- Producción -->
    ${r.items?.length ? `
    <div class="detalle-card">
      <div class="detalle-card__title">⚙ Producción (${r.items.length} materiales)</div>
      <div class="detalle-items-list">
        ${r.items.map(i => `
          <div class="detalle-item">
            <span>${escapeHTML(i.categoria)}</span>
            <strong>${i.cantidad} kg</strong>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <!-- Notas -->
    ${r.notas ? `
    <div class="detalle-card">
      <div class="detalle-card__title">📝 Notas</div>
      <div class="detalle-notas">${escapeHTML(r.notas)}</div>
    </div>` : ''}

    <!-- Horario -->
    ${r.inicio || r.fin ? `
    <div class="detalle-card">
      <div class="detalle-card__title">⏱ Horario</div>
      <div class="detalle-row">
        <span>Inicio</span><strong>${r.inicio || '—'}</strong>
      </div>
      <div class="detalle-row">
        <span>Fin</span><strong>${r.fin || '—'}</strong>
      </div>
      <div class="detalle-row">
        <span>Total horas</span><strong class="val--cyan">${formatHoras(r.horas)}</strong>
      </div>
    </div>` : ''}
  `;
}

/* ─── ANALYTICS ─── */
export function renderAnalytics(registros) {
  // Tabla de zonas (sin Chart.js necesario)
  const zonas = calcularEficienciaPorZona(registros);
  const tabla = document.getElementById('zona-tabla');
  if (tabla) {
    if (!zonas.length) {
      tabla.innerHTML = '<p class="lista-vacia">Sin datos suficientes</p>';
    } else {
      tabla.innerHTML = zonas.slice(0, 5).map(z => `
        <div class="zona-tabla-row" role="row">
          <span>${escapeHTML(z.zona)}</span>
          <span>${z.count} días</span>
          <strong>${z.xhora > 0 ? formatCLP(z.xhora) + '/h' : '—'}</strong>
        </div>
      `).join('');
    }
  }
}

/* ─── HELPERS ─── */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function filtrarRegistros(registros, filtro) {
  if (filtro === 'todos') return registros;
  const hoy   = new Date();
  const corte = new Date(hoy);
  if (filtro === 'semana') corte.setDate(hoy.getDate() - 7);
  if (filtro === 'mes')    corte.setMonth(hoy.getMonth() - 1);
  return registros.filter(r => {
    if (!r.fecha) return false;
    return new Date(r.fecha) >= corte;
  });
}
