'use strict';

/* ================= CONFIG ================= */
const CONFIG = {
  dbName: 'breg_personal_db',
  dbVersion: 1,
  storeName: 'registros',
  zivaPrefix: 'ZIVA-CL',
  capitalPct: 0.15,
  version: '1.1.0'
};

/* ================= UTILS ================= */
const Utils = {
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  zivaId() {
    return `${CONFIG.zivaPrefix}-${Date.now().toString(36).toUpperCase()}`;
  },

  formatCLP(n) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(n || 0);
  },

  today() {
    return new Date().toISOString().split('T')[0];
  },

  now() {
    return new Date().toTimeString().slice(0, 5);
  },

  horas(inicio, fin) {
    if (!inicio || !fin) return 0;
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fin.split(':').map(Number);
    const min = (h2 * 60 + m2) - (h1 * 60 + m1);
    return min > 0 ? min / 60 : 0;
  },

  toast(msg, tipo = 'ok') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast toast--${tipo} visible`;
    setTimeout(() => t.classList.remove('visible'), 3000);
  }
};

/* ================= DB ================= */
const DB = {
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(CONFIG.dbName, CONFIG.dbVersion);

      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(CONFIG.storeName)) {
          const store = db.createObjectStore(CONFIG.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('ziva_id', 'ziva_id', { unique: true });
        }
      };

      req.onsuccess = e => {
        this.db = e.target.result;
        resolve(this.db);
      };

      req.onerror = e => reject(e.target.error);
    });
  },

  guardar(data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(CONFIG.storeName, 'readwrite');
      const store = tx.objectStore(CONFIG.storeName);
      const req = store.put(data);
      req.onsuccess = () => resolve();
      req.onerror = e => reject(e.target.error);
    });
  },

  async getAll() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(CONFIG.storeName, 'readonly');
      const store = tx.objectStore(CONFIG.storeName);
      const req = store.getAll();

      req.onsuccess = e => {
        const data = e.target.result || [];
        data.sort((a, b) => b.timestamp - a.timestamp);
        resolve(data);
      };

      req.onerror = e => reject(e.target.error);
    });
  },

  eliminar(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(CONFIG.storeName, 'readwrite');
      const store = tx.objectStore(CONFIG.storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = e => reject(e.target.error);
    });
  }
};

/* ================= CALCULADORA ================= */
const Calculadora = {
  calcular(d) {
    const ingreso = parseFloat(d.ingreso) || 0;
    const gastos = (parseFloat(d.transporte) || 0)
      + (parseFloat(d.alimentacion) || 0)
      + (parseFloat(d.otros) || 0);

    const neto = ingreso - gastos;
    const semilla = neto > 0 ? neto * CONFIG.capitalPct : 0;
    const horas = Utils.horas(d.horaInicio, d.horaFin);

    return {
      ingreso,
      gastos,
      neto,
      semilla,
      disponible: neto - semilla,
      horas,
      xhora: horas > 0 ? ingreso / horas : 0
    };
  }
};

/* ================= STATE ================= */
const State = {
  registros: [],
  items: []
};

/* ================= FORM ================= */
const Form = {
  init() {
    document.getElementById('f-fecha').value = Utils.today();
    document.getElementById('f-hora-inicio').value = Utils.now();
    State.items = [];
    this.renderItems();
  },

  agregarItem() {
    const desc = document.getElementById('f-desc').value.trim();
    if (!desc) return Utils.toast('Descripción requerida', 'error');

    State.items.push({
      id: Utils.uuid(),
      descripcion: desc,
      cantidad: parseFloat(document.getElementById('f-cant').value) || 0
    });

    this.renderItems();
  },

  renderItems() {
    const el = document.getElementById('lista-items');
    if (!el) return;
    el.innerHTML = State.items.map(i => `
      <div>${i.descripcion} - ${i.cantidad}</div>
    `).join('');
  },

  leer() {
    return {
      fecha: document.getElementById('f-fecha').value,
      horaInicio: document.getElementById('f-hora-inicio').value,
      horaFin: document.getElementById('f-hora-fin').value,
      ingreso: document.getElementById('f-ingreso').value,
      transporte: document.getElementById('f-transporte').value,
      alimentacion: document.getElementById('f-alimentacion').value,
      otros: document.getElementById('f-otros').value
    };
  },

  async guardar() {
    const data = this.leer();
    if (!data.fecha) return Utils.toast('Fecha requerida', 'error');

    const breg = Calculadora.calcular(data);

    const registro = {
      id: Utils.uuid(),
      timestamp: Date.now(),
      ziva_id: Utils.zivaId(),
      data,
      breg,
      items: State.items
    };

    await DB.guardar(registro);
    Utils.toast('Guardado ✓');
  }
};

/* ================= INIT ================= */
async function iniciar() {
  await DB.init();
  State.registros = await DB.getAll();
  Form.init();

  document.getElementById('btn-guardar')
    ?.addEventListener('click', () => Form.guardar());
}

document.addEventListener('DOMContentLoaded', iniciar);
