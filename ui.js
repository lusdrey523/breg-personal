export function renderDashboard(registros) {
  const total = registros.reduce((a, r) => a + r.neto, 0);
  const semilla = registros.reduce((a, r) => a + r.semilla, 0);
  const horas = registros.reduce((a, r) => a + r.horas, 0);

  set("dash-registros", registros.length);
  set("dash-neto", `$${total}`);
  set("dash-semilla", `$${semilla}`);
  set("dash-horas", `${horas}h`);
}

export function renderHistorial(registros) {
  const cont = document.getElementById("lista-registros");

  cont.innerHTML = registros.map(r => `
    <div class="registro-card" onclick="window.verDetalle(${r.id})">
      <div>${r.fecha}</div>
      <strong>$${r.neto}</strong>
    </div>
  `).join("");
}

export function renderDetalle(r) {
  document.getElementById("detalle-contenido").innerHTML = `
    <div class="detalle-row">
      <span>Neto</span>
      <strong>$${r.neto}</strong>
    </div>
    <div class="detalle-row">
      <span>Semilla</span>
      <strong>$${r.semilla}</strong>
    </div>
  `;
}

function set(id, val) {
  document.getElementById(id).innerText = val;
}