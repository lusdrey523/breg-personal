import { initDB, saveRegistro, getRegistros } from "./db.js";
import { calcularFinanzas } from "./finance.js";
import { renderDashboard, renderHistorial, renderDetalle } from "./ui.js";
import { loadTheme } from "./theme.js";

let items = [];

document.addEventListener("DOMContentLoaded", async () => {
  loadTheme();
  await initDB();
  bindEvents();
  refreshUI();
});

function bindEvents() {
  document.querySelectorAll("[data-vista]").forEach(btn => {
    btn.addEventListener("click", () => cambiarVista(btn.dataset.vista));
  });

  document.getElementById("btn-agregar-item")
    .addEventListener("click", agregarItem);

  document.getElementById("btn-guardar")
    .addEventListener("click", guardarRegistro);

  document.getElementById("btn-exportar")
    .addEventListener("click", exportarJSON);
}

function cambiarVista(vista) {
  document.querySelectorAll(".vista").forEach(v => v.classList.remove("vista--activa"));
  document.getElementById(`vista-${vista}`).classList.add("vista--activa");
}

function agregarItem() {
  const cat = f("f-cat");
  const cant = parseFloat(f("f-cant"));

  if (!cant) return;

  items.push({
    categoria: cat,
    cantidad: cant
  });

  renderItems();
}

function renderItems() {
  const cont = document.getElementById("lista-items");

  if (items.length === 0) {
    cont.innerHTML = `<p class="lista-vacia">Sin items</p>`;
    return;
  }

  cont.innerHTML = items.map(i => `
    <div class="item-produccion">
      <span>${i.categoria}</span>
      <strong>${i.cantidad}</strong>
    </div>
  `).join("");
}

async function guardarRegistro() {
  const data = {
    fecha: f("f-fecha"),
    ingreso: num("f-ingreso"),
    transporte: num("f-transporte"),
    alimentacion: num("f-alimentacion"),
    otros: num("f-otros"),
    inicio: f("f-hora-inicio"),
    fin: f("f-hora-fin"),
    zona: f("f-zona"),
    items
  };

  const finanzas = calcularFinanzas(data);

  // SISTEMA DISCIPLINA
  if (finanzas.retiroNoPermitido) {
    finanzas.deuda = finanzas.retiro * 1.04;
  }

  await saveRegistro({ ...data, ...finanzas });

  items = [];
  cambiarVista("inicio");
  refreshUI();
}

async function refreshUI() {
  const registros = await getRegistros();
  renderDashboard(registros);
  renderHistorial(registros);
}

function exportarJSON() {
  getRegistros().then(data => {
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "breg-data.json";
    a.click();
  });
}

function f(id) {
  return document.getElementById(id).value;
}

function num(id) {
  return parseFloat(f(id)) || 0;
}