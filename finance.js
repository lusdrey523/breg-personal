export function calcularFinanzas(d) {
  const gastos = d.transporte + d.alimentacion + d.otros;
  const neto = d.ingreso - gastos;
  const semilla = neto * 0.15;
  const disponible = neto - semilla;

  const horas = calcularHoras(d.inicio, d.fin);
  const xhora = horas ? neto / horas : 0;

  return {
    gastos,
    neto,
    semilla,
    disponible,
    horas,
    xhora,

    // SISTEMA DISCIPLINA
    retiroNoPermitido: disponible < 0,
    deuda: 0
  };
}

function calcularHoras(inicio, fin) {
  if (!inicio || !fin) return 0;
  const i = new Date(`1970-01-01T${inicio}`);
  const f = new Date(`1970-01-01T${fin}`);
  return (f - i) / 1000 / 60 / 60;
}