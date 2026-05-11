const KEY = "breg_registros";

export async function initDB() {
  if (!localStorage.getItem(KEY)) {
    localStorage.setItem(KEY, JSON.stringify([]));
  }
}

export async function saveRegistro(reg) {
  const data = await getRegistros();
  data.push({ ...reg, id: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(data));
}

export async function getRegistros() {
  return JSON.parse(localStorage.getItem(KEY)) || [];
}