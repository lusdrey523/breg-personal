'use strict';

/* CONFIG */
const CONFIG = {
  DB: 'brep_v3',
  STORE: 'data',

  SEMILLA: 0.15,
  INTERES: 0.04,
  MORA: 1.5
};

/* UTILS */
const U = {
  id: () => crypto.randomUUID(),
  clp: n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP'}).format(n||0),
  toast: m=>{
    const t=document.getElementById('toast');
    t.textContent=m;
    t.style.display='block';
    setTimeout(()=>t.style.display='none',2000);
  }
};

/* DB */
const DB = {
  db:null,

  init(){
    return new Promise(res=>{
      const r=indexedDB.open(CONFIG.DB,1);
      r.onupgradeneeded=e=>{
        e.target.result.createObjectStore(CONFIG.STORE,{keyPath:'id'});
      };
      r.onsuccess=e=>{
        this.db=e.target.result;
        res();
      };
    });
  },

  save(d){
    this.db.transaction(CONFIG.STORE,'readwrite')
      .objectStore(CONFIG.STORE).put(d);
  },

  async all(){
    return new Promise(res=>{
      const r=this.db.transaction(CONFIG.STORE,'readonly')
        .objectStore(CONFIG.STORE).getAll();
      r.onsuccess=()=>res(r.result||[]);
    });
  }
};

/* FINANCE */
const Finance = {
  calc(i,g){
    i=Number(i)||0;
    g=Number(g)||0;

    const neto=i-g;
    const semilla=neto>0?neto*CONFIG.SEMILLA:0;

    return {
      ingreso:i,
      gastos:g,
      neto,
      semilla,
      disponible:neto-semilla
    };
  }
};

/* DISCIPLINA (VENTAJA CLAVE) */
const Discipline = {

  aplicar(retiro, disponible){
    if(retiro<=disponible){
      return {tipo:'ok', deuda:0};
    }

    const exceso=retiro-disponible;
    const interes=exceso*CONFIG.INTERES*CONFIG.MORA;

    return {
      tipo:'prestamo',
      deuda:exceso+interes
    };
  }
};

/* APP */
const App = {

  data:[],
  deuda:0,

  async init(){
    await DB.init();
    this.data=await DB.all();
    this.render();
    this.bind();
    this.nav();
  },

  bind(){
    document.getElementById('guardar')
      .onclick=()=>this.save();
  },

  nav(){
    document.querySelectorAll('nav button')
      .forEach(b=>{
        b.onclick=()=>{
          document.querySelectorAll('.view')
            .forEach(v=>v.classList.remove('active'));
          document.getElementById(b.dataset.view)
            .classList.add('active');
        };
      });
  },

  async save(){

    const zona=document.getElementById('zona').value;
    const horas=document.getElementById('horas').value;
    const mat=document.getElementById('material').value;
    const ingreso=document.getElementById('ingreso').value;
    const gastos=document.getElementById('gastos').value;

    const fin=Finance.calc(ingreso,gastos);

    const retiro = gastos; // simplificación estratégica

    const disc = Discipline.aplicar(retiro, fin.disponible);

    this.deuda += disc.deuda;

    const reg={
      id:U.id(),
      fecha:new Date().toISOString(),
      zona,
      horas:Number(horas)||0,
      material:mat,
      fin,
      deuda:disc.deuda
    };

    DB.save(reg);

    this.data=await DB.all();

    U.toast('Registro guardado');

    this.render();
  },

  render(){

    let total=0, semilla=0, horas=0;

    const zonas={};
    const materiales={};

    this.data.forEach(r=>{
      total+=r.fin.neto;
      semilla+=r.fin.semilla;
      horas+=r.horas;

      zonas[r.zona]=(zonas[r.zona]||0)+r.fin.neto;
      materiales[r.material]=(materiales[r.material]||0)+r.fin.neto;
    });

    const iph = horas>0 ? total/horas : 0;

    document.getElementById('total').textContent=U.clp(total);
    document.getElementById('iph').textContent=U.clp(iph);
    document.getElementById('semilla').textContent=U.clp(semilla);
    document.getElementById('deuda').textContent=U.clp(this.deuda);

    /* HISTORIAL */
    const lista=document.getElementById('lista');

    lista.innerHTML=this.data.map(r=>`
      <div class="card">
        <strong>${r.material.toUpperCase()}</strong>
        <p>${r.zona}</p>
        <p>${U.clp(r.fin.neto)}</p>
        <p>Deuda: ${U.clp(r.deuda)}</p>
      </div>
    `).join('');
  }
};

document.addEventListener('DOMContentLoaded',()=>App.init());