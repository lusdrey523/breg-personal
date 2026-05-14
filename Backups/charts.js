/**
 * BREG Personal — charts.js
 * Gráficos canvas nativos, sin dependencias externas.
 * Diseño alineado con la paleta BREG.
 */

"use strict";

const BREG_PURPLE = '#8B2FC9';
const BREG_BLUE   = '#3B4FE8';
const BREG_CYAN   = '#00C8F8';
const SUCCESS     = '#00E5A0';
const DANGER      = '#FF4747';
const WARN        = '#FFB020';

function getTextColor() {
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'light' ? '#0f1525' : '#7a8ab8';
}
function getBorderColor() {
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'light' ? 'rgba(59,79,232,0.12)' : 'rgba(100,130,255,0.12)';
}

/* ── Gradiente helper ── */
function gradH(ctx, w, c1, c2) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  return g;
}
function gradV(ctx, h, c1, c2) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  return g;
}

/* ── CHART NETO (barras en dashboard) ── */
export function renderChartNeto(registros) {
  const canvas = document.getElementById('chart-neto');
  if (!canvas) return;

  const data = registros.slice(-14); // últimos 14
  if (!data.length) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';

  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.parentElement.clientWidth || 320;
  const H   = 120;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const values = data.map(r => r.neto || 0);
  const maxV   = Math.max(...values.map(Math.abs), 1);

  const pad  = { t: 10, r: 8, b: 24, l: 8 };
  const cW   = W - pad.l - pad.r;
  const cH   = H - pad.t - pad.b;
  const n    = values.length;
  const barW = Math.max(4, (cW / n) - 3);
  const gap  = (cW - barW * n) / (n - 1 || 1);
  const mid  = pad.t + cH / 2;

  // Línea base
  ctx.strokeStyle = getBorderColor();
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, mid); ctx.lineTo(W - pad.r, mid);
  ctx.stroke();

  // Barras
  values.forEach((v, i) => {
    const x   = pad.l + i * (barW + gap);
    const h   = (Math.abs(v) / maxV) * (cH / 2 - 2);
    const pos = v >= 0;
    const y   = pos ? mid - h : mid;

    ctx.fillStyle = pos ? gradV(ctx, H, BREG_CYAN, BREG_BLUE) : DANGER;
    ctx.globalAlpha = 0.9;
    const r = Math.min(3, barW / 2);
    roundRect(ctx, x, y, barW, h, r);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Label fecha (dia)
    if (data[i]?.fecha) {
      const d = data[i].fecha.slice(8, 10);
      ctx.fillStyle  = getTextColor();
      ctx.font       = `9px JetBrains Mono, monospace`;
      ctx.textAlign  = 'center';
      ctx.fillText(d, x + barW / 2, H - pad.b + 12);
    }
  });

  // Rango en label
  const rangeEl = document.getElementById('chart-range');
  if (rangeEl) rangeEl.textContent = `últimos ${data.length} días`;
}

/* ── CHART ZONA (barras horizontales) ── */
export function renderChartZona(zonas) {
  const canvas = document.getElementById('chart-zona');
  if (!canvas || !zonas.length) return;

  const data = zonas.slice(0, 6);
  const dpr  = window.devicePixelRatio || 1;
  const W    = canvas.parentElement.clientWidth || 300;
  const H    = 150;
  canvas.width  = W * dpr; canvas.height = H * dpr;
  canvas.style.width  = W + 'px'; canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const maxXhora = Math.max(...data.map(z => z.xhora), 1);
  const rowH     = H / data.length;

  data.forEach((z, i) => {
    const y   = i * rowH + 2;
    const barH = rowH - 8;
    const pct  = z.xhora / maxXhora;
    const barW = (W - 10) * pct;

    // Fondo
    ctx.fillStyle = getBorderColor();
    roundRect(ctx, 5, y, W - 10, barH, 4);
    ctx.fill();

    // Barra coloreada
    const grad = gradH(ctx, W, BREG_PURPLE, BREG_CYAN);
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.85;
    roundRect(ctx, 5, y, Math.max(barW, 4), barH, 4);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Texto
    ctx.fillStyle = '#fff';
    ctx.font = `bold 10px Exo 2, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(z.zona.slice(0, 18), 10, y + barH / 2 + 4);
  });
}

/* ── CHART HORAS vs INGRESO (scatter) ── */
export function renderChartHoras(registros) {
  const canvas = document.getElementById('chart-horas');
  if (!canvas) return;

  const data = registros.filter(r => r.horas > 0);
  if (!data.length) return;

  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.parentElement.clientWidth || 300;
  const H   = 150;
  canvas.width  = W * dpr; canvas.height = H * dpr;
  canvas.style.width  = W + 'px'; canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const maxH = Math.max(...data.map(r => r.horas), 1);
  const maxN = Math.max(...data.map(r => Math.abs(r.neto)), 1);
  const pad  = 16;

  // Ejes
  ctx.strokeStyle = getBorderColor();
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad); ctx.lineTo(pad, H - pad);
  ctx.lineTo(W - pad, H - pad);
  ctx.stroke();

  // Puntos
  data.forEach(r => {
    const x = pad + ((r.horas / maxH) * (W - pad * 2));
    const y = (H - pad) - ((Math.abs(r.neto) / maxN) * (H - pad * 2));

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = r.neto >= 0 ? BREG_CYAN : DANGER;
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // Labels ejes
  ctx.fillStyle  = getTextColor();
  ctx.font       = '9px JetBrains Mono, monospace';
  ctx.textAlign  = 'left';
  ctx.fillText('Horas →', W - 50, H - 4);
  ctx.save();
  ctx.translate(4, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Neto ↑', 0, 0);
  ctx.restore();
}

/* ── CHART DEUDA (línea) ── */
export function renderChartDeuda(registros) {
  const canvas = document.getElementById('chart-deuda');
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.parentElement.clientWidth || 320;
  const H   = 120;
  canvas.width  = W * dpr; canvas.height = H * dpr;
  canvas.style.width  = W + 'px'; canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  // Simular evolución de deuda por días
  const conDeuda = registros.filter(r => r.deudaGenerada);
  if (!conDeuda.length) {
    ctx.fillStyle  = getTextColor();
    ctx.font       = '12px JetBrains Mono, monospace';
    ctx.textAlign  = 'center';
    ctx.fillText('Sin historial de deuda ✓', W / 2, H / 2);
    return;
  }

  const values = conDeuda.map(r => Math.abs(r.neto));
  const maxV   = Math.max(...values, 1);
  const pad    = 16;
  const cW     = W - pad * 2;
  const cH     = H - pad * 2;
  const n      = values.length;

  ctx.beginPath();
  values.forEach((v, i) => {
    const x = pad + (i / (n - 1 || 1)) * cW;
    const y = (H - pad) - (v / maxV) * cH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = DANGER;
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Área
  ctx.lineTo(pad + cW, H - pad);
  ctx.lineTo(pad, H - pad);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,71,71,0.1)';
  ctx.fill();
}

/* ── Polyfill roundRect ── */
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, Math.max(h, 0), r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
