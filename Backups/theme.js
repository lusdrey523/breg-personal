/**
 * BREG Personal — theme.js
 * Gestión de temas: dark (default), light, zen.
 */

"use strict";

const TEMAS   = ['dark', 'light', 'zen'];
const TEMA_KEY = 'breg_theme';

export function loadTheme() {
  const saved = sanitizarTema(localStorage.getItem(TEMA_KEY));
  aplicarTema(saved);
  return saved;
}

export function setTheme(tema) {
  const t = sanitizarTema(tema);
  localStorage.setItem(TEMA_KEY, t);
  aplicarTema(t);
  return t;
}

export function getTheme() {
  return sanitizarTema(localStorage.getItem(TEMA_KEY));
}

export function toggleTheme() {
  const actual  = getTheme();
  const idx     = TEMAS.indexOf(actual);
  const siguiente = TEMAS[(idx + 1) % TEMAS.length];
  setTheme(siguiente);
  return siguiente;
}

function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema);
}
function sanitizarTema(t) {
  return TEMAS.includes(t) ? t : 'dark';
}
