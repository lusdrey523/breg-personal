// ===== DOM =====
const zona = document.getElementById("zona");
const inicio = document.getElementById("inicio");
const fin = document.getElementById("fin");
const horasCalc = document.getElementById("horasCalc");

const categoria = document.getElementById("categoria");
const tipo = document.getElementById("tipo");
const cantidad = document.getElementById("cantidad");
const addItem = document.getElementById("addItem");
const itemsList = document.getElementById("itemsList");

const ingreso = document.getElementById("ingreso");
const transporte = document.getElementById("transporte");
const alimentacion = document.getElementById("alimentacion");
const otros = document.getElementById("otros");
const nivel = document.getElementById("nivel");
const eventos = document.getElementById("eventos");
const correctionId = document.getElementById("correctionId");

const btnGuardar = document.getElementById("btnGuardar");
const btnExport = document.getElementById("btnExport");
const registros = document.getElementById("registros");
const errorBox = document.getElementById("errorBox");

// ===== DATA =====
let db;
let items = [];
const DB_NAME = "BREG_DB";

// ===== ZivaID =====
function getZivaID() {
let id = localStorage.getItem("ziva_id");
if (!id) {
id = "ZIVA-" + crypto.randomUUID();
localStorage.setItem("ziva_id", id);
}
return id;
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
initCategorias();
initDB();
bindEvents();
});

// ===== DB =====
function initDB() {
const request = indexedDB.open(DB_NAME, 1);
request.onupgradeneeded = e => {
db = e.target.result;
db.createObjectStore("registros", { keyPath: "id" });
};
request.onsuccess = e => {
db = e.target.result;
cargarRegistros();
};
}

// ===== CATEGORÍAS =====
const categorias = {
metales: ["Aluminio Duro","Aluminio Latas","Cobre","Bronce","Chatarra","Neveras"],
cachureos: ["Pantalones","Poleras","Polerones","Zapatos","Chaquetas","Teléfonos","Laptops","Vapers","Computadores","TVs"],
pedidos: ["McDonalds","PizzaHut","KFC","Otros"]
};

function initCategorias() {
categoria.innerHTML="";
Object.keys(categorias).forEach(c=>{
let o=document.createElement("option");
o.value=c;o.textContent=c;
categoria.appendChild(o);
});
cargarTipos();
}

function cargarTipos() {
tipo.innerHTML="";
categorias[categoria.value].forEach(t=>{
let o=document.createElement("option");
o.value=t;o.textContent=t;
tipo.appendChild(o);
});
}

// ===== HORAS =====
function calcularHoras() {
if (!inicio.value || !fin.value) return 0;

let [h1,m1]=inicio.value.split(":").map(Number);
let [h2,m2]=fin.value.split(":").map(Number);

let total = (h2 + m2/60) - (h1 + m1/60);
horasCalc.textContent = "Horas: " + (total>0 ? total.toFixed(2) : 0);
return total>0 ? total : 0;
}

// ===== EVENTS =====
function bindEvents() {
categoria.onchange = cargarTipos;

inicio.oninput = calcularHoras;
fin.oninput = calcularHoras;

addItem.onclick = ()=>{
if(!cantidad.value || cantidad.value<=0){
error("Cantidad inválida"); return;
}
items.push({categoria:categoria.value,tipo:tipo.value,cantidad:Number(cantidad.value)});
cantidad.value="";
renderItems();
validar();
};

[zona, ingreso, nivel, inicio, fin].forEach(el=>el.oninput=validar);

btnGuardar.onclick = guardar;
}

// ===== VALIDACIÓN =====
function validar(){
errorBox.textContent="";

if(!zona.value.trim()) return bloquear("Zona requerida");
if(!inicio.value || !fin.value) return bloquear("Horas requeridas");

if(calcularHoras()<=0) return bloquear("Horas inválidas");

if(items.length===0) return bloquear("Agregar items");

if(!ingreso.value || ingreso.value<=0) return bloquear("Ingreso inválido");

if(!nivel.value) return bloquear("Nivel requerido");

desbloquear();
}

function bloquear(msg){
btnGuardar.disabled=true;
errorBox.textContent=msg;
}
function desbloquear(){
btnGuardar.disabled=false;
}

// ===== ITEMS =====
function renderItems(){
itemsList.innerHTML="";
items.forEach((i,idx)=>{
let li=document.createElement("li");
li.textContent=`${i.categoria}-${i.tipo} (${i.cantidad})`;

```
let b=document.createElement("button");
b.textContent="X";
b.onclick=()=>{items.splice(idx,1);renderItems();validar();};

li.appendChild(b);
itemsList.appendChild(li);
```

});
}

// ===== SAVE =====
function guardar(){

const isCorrection = correctionId.value.trim() !== "";

const record = {
id: crypto.randomUUID(),
ziva_id: getZivaID(),
timestamp: new Date().toISOString(),
type: isCorrection ? "CORRECTION" : "CREATE",

```
meta: {
  original_id: isCorrection ? correctionId.value.trim() : null
},

data: {
  zona: zona.value,
  inicio: inicio.value,
  fin: fin.value,
  horas: calcularHoras(),
  items: items,
  ingreso: Number(ingreso.value),
  gastos: {
    transporte: Number(transporte.value)||0,
    alimentacion: Number(alimentacion.value)||0,
    otros: Number(otros.value)||0
  },
  nivel: nivel.value,
  eventos: eventos.value
}
```

};

record.data.gastos.total =
record.data.gastos.transporte +
record.data.gastos.alimentacion +
record.data.gastos.otros;

record.data.neto = record.data.ingreso - record.data.gastos.total;

// 🔹 NUEVO: ingreso por hora
record.data.ingreso_por_hora = record.data.horas > 0 
  ? record.data.neto / record.data.horas 
  : 0;

// 🔹 BREG completo
record.breg = {
  reserva_15: record.data.ingreso * 0.15,
  disponible: record.data.ingreso 
    - record.data.gastos.total 
    - (record.data.ingreso * 0.15)
};
};

Object.freeze(record.data.gastos);
Object.freeze(record.data);
Object.freeze(record.breg);

const tx = db.transaction("registros","readwrite");
tx.objectStore("registros").add(record);

reset();
cargarRegistros();
}

// ===== RESET =====
function reset(){
items=[];
renderItems();
ingreso.value="";
transporte.value="";
alimentacion.value="";
otros.value="";
nivel.value="";
eventos.value="";
correctionId.value="";
validar();
}

// ===== LOAD =====
function cargarRegistros(){
const tx=db.transaction("registros","readonly");
const store=tx.objectStore("registros");
const req=store.getAll();

req.onsuccess=()=>{
registros.innerHTML="";

```
req.result.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))
.forEach(r=>{
  let li=document.createElement("li");

  li.innerHTML=`
  <strong>${r.timestamp}</strong><br>
  ${r.type} | ZivaID: ${r.ziva_id}<br>
  Neto: ${r.data.neto}<br>
  ${r.meta.original_id ? "Corrige: "+r.meta.original_id : ""}
  `;

  registros.appendChild(li);
});
```

};
}

// ===== EXPORT =====
btnExport.onclick=()=>{
const tx=db.transaction("registros","readonly");
const store=tx.objectStore("registros");
const req=store.getAll();

req.onsuccess=()=>{
const blob=new Blob([JSON.stringify(req.result,null,2)],{type:"application/json"});
const a=document.createElement("a");
a.href=URL.createObjectURL(blob);
a.download="breg_audit.json";
a.click();
};
};
