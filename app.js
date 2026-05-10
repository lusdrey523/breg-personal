/**
 * ═══════════════════════════════════════════════════════════════
 *  BREG Personal – Ziva Latam Data Capture Protocol
 *  app.js – Core Application Logic
 *  Version: 1.0.0
 *  Arquitectura: Modular ES6+ Vanilla JS, IndexedDB, PWA
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

// ╔══════════════════════════════════════════════════════════╗
// ║  MÓDULO: CONFIG                                          ║
// ╚══════════════════════════════════════════════════════════╝
const CONFIG = {
  DB_NAME: 'breg_personal_db',
  DB_VERSION: 1,
  STORE_NAME: 'registros',
  ZIVA_ID_PREFIX: 'ZIVA-CL',
  CAPITAL_SEMILLA_PCT: 0.15,
  VERSION: '1.0.0'
};

// ╔══════════════════════════════════════════════════════════╗
// ║  MÓDULO: UTILIDADES                                      ║
// ╚══════════════════════════════════════════════════════════╝
const Utils = {
  /**
   * Genera un UUID v4 simple
   * @returns {string}
   */
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  /**
   * Genera un Ziva ID con timestamp
   * @returns {string}
   */
  zivaId() {
    const ts = Date.now().toString(36).toUpperCase();
    return `${CONFIG.ZIVA_ID_PREFIX}-${ts}`;
  },

  /**
   * Formatea número como moneda CLP
   * @param {number} n
   * @returns {string}
   */
  formatCLP(n) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(n || 0);
  },

  /**
   * Formatea número con 2 decimales
   * @param {number} n
   * @returns {string}
   */
  formatNum(n) {
    return (n || 0).toFixed(2);
  },

  /**
   * Fecha actual en formato YYYY-MM-DD
   * @returns {string}
   */
  todayISO() {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * Hora actual en formato HH:MM
   * @returns {string}
   */
  nowTime() {
    return new Date().toTimeString().slice(0, 5);
  },

  /**
   * Calcula horas entre dos strings HH:MM
   * @param {string} inicio
   * @param {string} fin
   * @returns {number}
   */
  horasEntre(inicio, fin) {
    if (!inicio || !fin) return 0;
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fin.split(':').map(Number);
    const minutos = (h2 * 60 + m2) - (h1 * 60 + m1);
    return minutos > 0 ? minutos / 60 : 0;
  },

  /**
   * Muestra una notificación toast en pantalla
   * @param {string} msg
   * @param {'ok'|'error'|'info'} tipo
   */
  toast(msg, tipo = 'ok') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast toast--${tipo} toast--visible`;
    setTimeout(() => t.classList.remove('toast--visible'), 3000);
  },

  /**
   * Descarga un blob como archivo
   * @param {string} filename
   * @param {string} content
   * @param {string} mimeType
   */
  downloadFile(filename, content, mimeType = 'application/json') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};

// ╔══════════════════════════════════════════════════════════╗
// ║  MÓDULO: BASE DE DATOS (IndexedDB)                       ║
// ╚══════════════════════════════════════════════════════════╝
const DB = {
  _db: null,

  /**
   * Inicializa la base de datos IndexedDB
   * @returns {Promise<IDBDatabase>}
   */
  init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(CONFIG.STORE_NAME)) {
          const store = db.createObjectStore(CONFIG.STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('ziva_id', 'ziva_id', { unique: true });
          console.log('[DB] ObjectStore creado');
        }
      };

      req.onsuccess = e => {
        this._db = e.target.result;
        console.log('[DB] Conectado:', CONFIG.DB_NAME);
        resolve(this._db);
      };

      req.onerror = e => {
        console.error('[DB] Error:', e.target.error);
        reject(e.target.error);
      };
    });
  },

  /**
   * Guarda un registro
   * @param {Object} registro
   * @returns {Promise<string>} id del registro
   */
  guardar(registro) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const req = store.put(registro);
      req.onsuccess = () => resolve(registro.id);
      req.onerror = e => reject(e.target.error);
    });
  },

  /**
   * Obtiene todos los registros ordenados por timestamp desc
   * @returns {Promise<Array>}
   */
  getAll() {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(CONFIG.STORE_NAME, 'readonly');
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const req = store.getAll();
      req.onsuccess = e => {
        const data = e.target.result || [];
        data.sort((a, b) => b.timestamp - a.timestamp);
        resolve(data);
      };
      req.onerror = e => reject(e.target.error);
    });
  },

  /**
   * Elimina un registro por id
   * @param {string} id
   * @returns {Promise}
   */
  eliminar(id) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = e => reject(e.target.error);
    });
  },

  /**
   * Cuenta total de registros
   * @returns {Promise<number>}
   */
  count() {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(CONFIG.STORE_NAME, 'readonly');
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const req = store.count();
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = e => reject(e.target.error);
    });
  }
};

// ╔══════════════════════════════════════════════════════════╗
// ║  MÓDULO: CALCULADORA BREG                                ║
// ╚══════════════════════════════════════════════════════════╝
const Calculadora = {
  /**
   * Calcula todos los valores financieros del formulario
   * @param {Object} data – valores crudos del form
   * @returns {Object} breg – resultado calculado
   */
  calcular(data) {
    const ingreso = parseFloat(data.ingreso) || 0;
    const transporte = parseFloat(data.transporte) || 0;
    const alimentacion = parseFloat(data.alimentacion) || 0;
    const otros = parseFloat(data.otros) || 0;

    const totalGastos = transporte + alimentacion + otros;
    const neto = ingreso - totalGastos;
    const capitalSemilla = neto > 0 ? neto * CONFIG.CAPITAL_SEMILLA_PCT : 0;
    const netoDisponible = neto - capitalSemilla;
    const horas = Utils.horasEntre(data.horaInicio, data.horaFin);
    const ingresoPorHora = horas > 0 ? ingreso / horas : 0;

    return {
      ingreso,
      totalGastos,
      neto,
      capitalSemilla,
      netoDisponible,
      horas: parseFloat(horas.toFixed(2)),
      ingresoPorHora: parseFloat(ingresoPorHora.toFixed(0))
    };
  }
};

// ╔══════════════════════════════════════════════════════════╗
// ║  MÓDULO: ESTADO DE LA APLICACIÓN                         ║
// ╚══════════════════════════════════════════════════════════╝
const State = {
  vistaActual: 'inicio',
  registros: [],
  itemsProduccion: [], // array de { categoria, descripcion, cantidad, unidad }
  editandoId: null
};

// ╔══════════════════════════════════════════════════════════╗
// ║  MÓDULO: ROUTER / NAVEGACIÓN                             ║
// ╚══════════════════════════════════════════════════════════╝
const Router = {
  /**
   * Navega a una vista
   * @param {string} vista – 'inicio' | 'nuevo' | 'historial' | 'detalle'
   */
  ir(vista) {
    document.querySelectorAll('.vista').forEach(v => v.classList.remove('vista--activa'));
    const el = document.getElementById(`vista-${vista}`);
    if (el) el.classList.add('vista--activa');
    State.vistaActual = vista;

    // Actualizar nav tabs
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('nav-tab--activo', t.dataset.vista === vista);
    });

    window.scrollTo(0, 0);
  }
};

// ╔══════════════════════════════════════════════════════════╗
// ║  MÓDULO: FORMULARIO DE NUEVO REGISTRO                    ║
// ╚══════════════════════════════════════════════════════════╝
const FormNuevo = {
  /**
   * Inicializa el formulario con valores por defecto
   */
  init() {
    document.getElementById('f-fecha').value = Utils.todayISO();
    document.getElementById('f-hora-inicio').value = Utils.nowTime();
    State.itemsProduccion = [];
    this.renderItems();
    this.actualizarCalculos();
  },

  /**
   * Agrega un item de producción al array
   */
  agregarItem() {
    const cat = document.getElementById('f-cat').value;
    const desc = document.getElementById('f-desc').value.trim();
    const cant = document.getElementById('f-cant').value;
    const unidad = document.getElementById('f-unidad').value.trim() || 'kg';

    if (!desc) {
      Utils.toast('Ingresa una descripción', 'error');
      return;
    }

    State.itemsProduccion.push({
      id: Utils.uuid(),
      categoria: cat,
      descripcion: desc,
      cantidad: parseFloat(cant) || 0,
      unidad
    });

    // Limpiar campos de item
    document.getElementById('f-desc').value = '';
    document.getElementById('f-cant').value = '';
    this.renderItems();
    Utils.toast('Item agregado ✓');
  },

  /**
   * Renderiza la lista de items de producción
   */
  renderItems() {
    const lista = document.getElementById('lista-items');
    if (!lista) return;

    if (State.itemsProduccion.length === 0) {
      lista.innerHTML = '<p class="lista-vacia">Sin items aún</p>';
      return;
    }

    lista.innerHTML = State.itemsProduccion.map(item => `
      <div class="item-produccion">
        <div class="item-produccion__info">
          <span class="item-badge item-badge--${item.categoria.toLowerCase().replace(/\s/g,'-')}">${item.categoria}</span>
          <span class="item-produccion__desc">${item.descripcion}</span>
          <span class="item-produccion__cant">${item.cantidad} ${item.unidad}</span>
        </div>
        <button class="btn-icon btn-icon--danger" onclick="FormNuevo.eliminarItem('${item.id}')" aria-label="Eliminar">✕</button>
      </div>
    `).join('');
  },

  /**
   * Elimina un item por id
   * @param {string} id
   */
  eliminarItem(id) {
    State.itemsProduccion = State.itemsProduccion.filter(i => i.id !== id);
    this.renderItems();
  },

  /**
   * Recalcula y actualiza los valores mostrados en pantalla
   */
  actualizarCalculos() {
    const data = this._leerForm();
    const breg = Calculadora.calcular(data);

    document.getElementById('calc-gastos').textContent = Utils.formatCLP(breg.totalGastos);
    document.getElementById('calc-neto').textContent = Utils.formatCLP(breg.neto);
    document.getElementById('calc-semilla').textContent = Utils.formatCLP(breg.capitalSemilla);
    document.getElementById('calc-disponible').textContent = Utils.formatCLP(breg.netoDisponible);
    document.getElementById('calc-horas').textContent = breg.horas + 'h';
    document.getElementById('calc-xhora').textContent = Utils.formatCLP(breg.ingresoPorHora) + '/h';
  },

  /**
   * Lee todos los valores del formulario
   * @returns {Object}
   */
  _leerForm() {
    return {
      fecha: document.getElementById('f-fecha').value,
      horaInicio: document.getElementById('f-hora-inicio').value,
      horaFin: document.getElementById('f-hora-fin').value,
      zona: document.getElementById('f-zona').value.trim(),
      ingreso: document.getElementById('f-ingreso').value,
      transporte: document.getElementById('f-transporte').value,
      alimentacion: document.getElementById('f-alimentacion').value,
      otros: document.getElementById('f-otros').value,
      nivelDia: document.querySelector('input[name="nivel"]:checked')?.value || 'Medio',
      eventos: document.getElementById('f-eventos').value.trim()
    };
  },

  /**
   * Guarda el registro completo en IndexedDB
   */
  async guardar() {
    const data = this._leerForm();

    if (!data.fecha) {
      Utils.toast('Fecha obligatoria', 'error');
      return;
    }
    if (data.ingreso === '' || isNaN(parseFloat(data.ingreso))) {
      Utils.toast('Ingresa el ingreso del día', 'error');
      return;
    }

    const breg = Calculadora.calcular(data);

    const registro = {
      id: Utils.uuid(),
      timestamp: Date.now(),
      ziva_id: Utils.zivaId(),
      type: 'CREATE',
      data: {
        ...data,
        produccion: [...State.itemsProduccion]
      },
      breg
    };

    try {
      await DB.guardar(registro);
      Utils.toast('Registro guardado ✓', 'ok');
      State.itemsProduccion = [];
      this.init();
      await Historial.cargar();
      await Dashboard.cargar();
      Router.ir('inicio');
    } catch (err) {
      console.error('[FormNuevo] Error al guardar:', err);
      Utils.toast('Error al guardar', 'error');
    }
  }
};

// ╔══════════════════════════════════════════════════════════╗
// ║  MÓDULO: HISTORIAL                                       ║
// ╚══════════════════════════════════════════════════════════╝
const Historial = {
  /**
   * Carga registros de DB y renderiza
   */
  async cargar() {
    try {
      State.registros = await DB.getAll();
      this.render();
    } catch (err) {
      console.error('[Historial] Error:', err);
    }
  },

  /**
   * Renderiza la lista de registros
   */
  render() {
    const contenedor = document.getElementById('lista-registros');
    if (!contenedor) return;

    if (State.registros.length === 0) {
      contenedor.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📋</div>
          <p>Sin registros aún</p>
          <p class="empty-state__sub">Crea tu primer registro del día</p>
        </div>`;
      return;
    }

    contenedor.innerHTML = State.registros.map(r => {
      const fecha = r.data.fecha || '—';
      const nivel = r.data.nivelDia || 'Medio';
      const nivelClass = nivel.toLowerCase();
      const neto = r.breg?.neto || 0;
      const netoStr = Utils.formatCLP(neto);
      const netoClass = neto >= 0 ? 'positivo' : 'negativo';

      return `
        <div class="registro-card" onclick="Historial.verDetalle('${r.id}')">
          <div class="registro-card__header">
            <div class="registro-card__fecha">${fecha}</div>
            <span class="nivel-badge nivel-badge--${nivelClass}">${nivel}</span>
          </div>
          <div class="registro-card__body">
            <div class="registro-card__zona">${r.data.zona || 'Sin zona'}</div>
            <div class="registro-card__neto ${netoClass}">${netoStr}</div>
          </div>
          <div class="registro-card__footer">
            <span class="ziva-tag">${r.ziva_id}</span>
            <span class="registro-card__horas">${r.breg?.horas || 0}h trabajadas</span>
          </div>
        </div>`;
    }).join('');
  },

  /**
   * Muestra el detalle de un registro
   * @param {string} id
   */
  verDetalle(id) {
    const r = State.registros.find(x => x.id === id);
    if (!r) return;

    const detalle = document.getElementById('detalle-contenido');
    const produccionHtml = (r.data.produccion || []).length > 0
      ? r.data.produccion.map(p => `
          <div class="detalle-item">
            <span class="item-badge">${p.categoria}</span>
            <span>${p.descripcion}</span>
            <span>${p.cantidad} ${p.unidad}</span>
          </div>`).join('')
      : '<p class="lista-vacia">Sin items de producción</p>';

    detalle.innerHTML = `
      <div class="detalle-header">
        <div class="detalle-ziva">${r.ziva_id}</div>
        <span class="nivel-badge nivel-badge--${(r.data.nivelDia||'medio').toLowerCase()}">${r.data.nivelDia || 'Medio'}</span>
      </div>

      <section class="detalle-seccion">
        <h3>📅 Día</h3>
        <div class="detalle-grid">
          <div class="detalle-row"><span>Fecha</span><strong>${r.data.fecha}</strong></div>
          <div class="detalle-row"><span>Horario</span><strong>${r.data.horaInicio || '—'} → ${r.data.horaFin || '—'}</strong></div>
          <div class="detalle-row"><span>Zona</span><strong>${r.data.zona || '—'}</strong></div>
        </div>
      </section>

      <section class="detalle-seccion">
        <h3>📦 Producción</h3>
        <div class="items-lista">${produccionHtml}</div>
      </section>

      <section class="detalle-seccion">
        <h3>💰 Finanzas</h3>
        <div class="detalle-grid">
          <div class="detalle-row"><span>Ingreso bruto</span><strong class="positivo">${Utils.formatCLP(r.breg?.ingreso)}</strong></div>
          <div class="detalle-row"><span>Total gastos</span><strong class="negativo">${Utils.formatCLP(r.breg?.totalGastos)}</strong></div>
          <div class="detalle-row separador"><span>Neto</span><strong>${Utils.formatCLP(r.breg?.neto)}</strong></div>
          <div class="detalle-row destacado"><span>Capital Semilla (15%)</span><strong class="semilla">${Utils.formatCLP(r.breg?.capitalSemilla)}</strong></div>
          <div class="detalle-row"><span>Disponible</span><strong>${Utils.formatCLP(r.breg?.netoDisponible)}</strong></div>
          <div class="detalle-row"><span>Horas trabajadas</span><strong>${r.breg?.horas}h</strong></div>
          <div class="detalle-row"><span>Ingreso/hora</span><strong>${Utils.formatCLP(r.breg?.ingresoPorHora)}</strong></div>
        </div>
      </section>

      ${r.data.eventos ? `
      <section class="detalle-seccion">
        <h3>📝 Eventos</h3>
        <div class="eventos-texto">${r.data.eventos}</div>
      </section>` : ''}

      <div class="detalle-acciones">
        <button class="btn btn--danger" onclick="Historial.confirmarEliminar('${r.id}')">🗑 Eliminar registro</button>
      </div>
    `;

    Router.ir('detalle');
  },

  /**
   * Confirma y elimina un registro
   * @param {string} id
   */
  async confirmarEliminar(id) {
    if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return;
    try {
      await DB.eliminar(id);
      Utils.toast('Registro eliminado', 'info');
      await this.cargar();
      await Dashboard.cargar();
      Router.ir('historial');
    } catch (err) {
      Utils.toast('Error al eliminar', 'error');
    }
  }
};

// ╔══════════════════════════════════════════════════════════╗
// ║  MÓDULO: DASHBOARD / INICIO                              ║
// ╚══════════════════════════════════════════════════════════╝
const Dashboard = {
  /**
   * Carga stats del dashboard
   */
  async cargar() {
    const registros = State.registros.length > 0 ? State.registros : await DB.getAll();
    State.registros = registros;

    const totalRegistros = registros.length;
    const totalNeto = registros.reduce((acc, r) => acc + (r.breg?.neto || 0), 0);
    const totalSemilla = registros.reduce((acc, r) => acc + (r.breg?.capitalSemilla || 0), 0);
    const totalHoras = registros.reduce((acc, r) => acc + (r.breg?.horas || 0), 0);

    // Último registro
    const ultimo = registros[0];

    document.getElementById('dash-registros').textContent = totalRegistros;
    document.getElementById('dash-neto').textContent = Utils.formatCLP(totalNeto);
    document.getElementById('dash-semilla').textContent = Utils.formatCLP(totalSemilla);
    document.getElementById('dash-horas').textContent = Utils.formatNum(totalHoras) + 'h';

    const ultimoEl = document.getElementById('dash-ultimo');
    if (ultimoEl) {
      if (ultimo) {
        ultimoEl.innerHTML = `
          <div class="ultimo-registro">
            <span>${ultimo.data.fecha}</span>
            <span class="nivel-badge nivel-badge--${(ultimo.data.nivelDia||'medio').toLowerCase()}">${ultimo.data.nivelDia || '—'}</span>
            <span class="positivo">${Utils.formatCLP(ultimo.breg?.neto)}</span>
          </div>`;
      } else {
        ultimoEl.innerHTML = '<p class="lista-vacia">Sin registros</p>';
      }
    }
  }
};

// ╔══════════════════════════════════════════════════════════╗
// ║  MÓDULO: EXPORTACIÓN                                     ║
// ╚══════════════════════════════════════════════════════════╝
const Exportar = {
  /**
   * Exporta todos los registros como JSON
   */
  async json() {
    try {
      const registros = await DB.getAll();
      if (registros.length === 0) {
        Utils.toast('Sin registros para exportar', 'info');
        return;
      }

      const payload = {
        exportado: new Date().toISOString(),
        version: CONFIG.VERSION,
        protocolo: 'BREG-ZIVA-1.0',
        total_registros: registros.length,
        registros
      };

      const filename = `BREG_export_${Utils.todayISO()}.json`;
      Utils.downloadFile(filename, JSON.stringify(payload, null, 2));
      Utils.toast(`Exportado: ${filename}`, 'ok');
    } catch (err) {
      console.error('[Exportar] Error:', err);
      Utils.toast('Error al exportar', 'error');
    }
  }
};

// ╔══════════════════════════════════════════════════════════╗
// ║  MÓDULO: SERVICE WORKER REGISTRATION                     ║
// ╚══════════════════════════════════════════════════════════╝
const SW = {
  async registrar() {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js');
        console.log('[SW] Registrado:', reg.scope);
      } catch (err) {
        console.warn('[SW] Error al registrar:', err);
      }
    }
  }
};

// ╔══════════════════════════════════════════════════════════╗
// ║  INICIALIZACIÓN PRINCIPAL                                ║
// ╚══════════════════════════════════════════════════════════╝
async function iniciar() {
  console.log('🔷 BREG Personal v' + CONFIG.VERSION + ' – Iniciando...');

  // 1. Registrar Service Worker
  await SW.registrar();

  // 2. Inicializar IndexedDB
  try {
    await DB.init();
  } catch (err) {
    console.error('DB crítica:', err);
    Utils.toast('Error crítico de base de datos', 'error');
    return;
  }

  // 3. Cargar datos iniciales
  State.registros = await DB.getAll();
  await Dashboard.cargar();

  // 4. Inicializar formulario
  FormNuevo.init();

  // 5. Configurar listeners de navegación
  document.querySelectorAll('[data-vista]').forEach(el => {
    el.addEventListener('click', () => {
      const vista = el.dataset.vista;
      if (vista === 'nuevo') FormNuevo.init();
      if (vista === 'historial') Historial.cargar();
      Router.ir(vista);
    });
  });

  // 6. Listener del formulario de producción
  const btnAgregar = document.getElementById('btn-agregar-item');
  if (btnAgregar) btnAgregar.addEventListener('click', () => FormNuevo.agregarItem());

  // 7. Calcular en tiempo real al cambiar finanzas
  ['f-ingreso', 'f-transporte', 'f-alimentacion', 'f-otros', 'f-hora-inicio', 'f-hora-fin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => FormNuevo.actualizarCalculos());
  });

  // 8. Guardar registro
  const btnGuardar = document.getElementById('btn-guardar');
  if (btnGuardar) btnGuardar.addEventListener('click', () => FormNuevo.guardar());

  // 9. Exportar JSON
  const btnExportar = document.getElementById('btn-exportar');
  if (btnExportar) btnExportar.addEventListener('click', () => Exportar.json());

  // 10. Botón volver en detalle
  const btnVolver = document.getElementById('btn-volver-detalle');
  if (btnVolver) btnVolver.addEventListener('click', () => Router.ir('historial'));

  // 11. Vista inicial
  Router.ir('inicio');

  console.log('✅ BREG Personal listo');
}

// Arrancar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', iniciar);
