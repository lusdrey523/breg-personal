/**
 * BREG Personal — breg.js
 * Todo el sistema en un único archivo.
 * Sin ES modules → máxima compatibilidad móvil / GitHub Pages.
 * IIFE para evitar contaminación del scope global.
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════════
     MÓDULO: CONFIG / CONSTANTES
  ══════════════════════════════════════════ */
  var DB_KEY    = 'breg_reg_v3';
  var DEUDA_KEY = 'breg_deuda_v3';
  var CFG_KEY   = 'breg_cfg_v1';
  var TEMA_KEY  = 'breg_theme';
  var TEMAS     = ['dark', 'light', 'zen'];
  var SEMILLA   = 0.15;
  var SOFR      = 0.054;   // referencial
  var SPREAD    = 0.04;    // +4% BREG
  var TASA_ANUAL = SOFR + SPREAD; // 9.4%

  /* ══════════════════════════════════════════
     MÓDULO: UTILIDADES
  ══════════════════════════════════════════ */
  function esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function sanStr(v, max) {
    max = max || 200;
    if (typeof v !== 'string') return '';
    return v.replace(/[<>"'`]/g,'').trim().slice(0, max);
  }
  function sanNum(v, min, max) {
    min = (min === undefined) ? 0 : min;
    max = (max === undefined) ? 999999999 : max;
    var n = parseFloat(v);
    if (isNaN(n)) return 0;
    return Math.min(Math.max(n, min), max);
  }
  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }
  function getEl(id) { return document.getElementById(id); }
  function hoyISO() { return new Date().toISOString().slice(0,10); }
  function fCLP(n) {
    if (typeof n !== 'number' || isNaN(n)) return '$0';
    return '$' + Math.round(n).toLocaleString('es-CL');
  }
  function fHoras(h) {
    if (!h || h <= 0) return '0h';
    var hrs = Math.floor(h);
    var min = Math.round((h - hrs) * 60);
    return min > 0 ? hrs + 'h ' + min + 'm' : hrs + 'h';
  }

  /* ══════════════════════════════════════════
     MÓDULO: STORAGE (seguro)
  ══════════════════════════════════════════ */
  function storageGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch(e) {
      return fallback;
    }
  }
  function storageSet(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); return true; }
    catch(e) { console.warn('[BREG] storage error', e); return false; }
  }

  /* ══════════════════════════════════════════
     MÓDULO: DB
  ══════════════════════════════════════════ */
  function initDB() {
    if (!localStorage.getItem(DB_KEY))    storageSet(DB_KEY, []);
    if (!localStorage.getItem(DEUDA_KEY)) storageSet(DEUDA_KEY, {activa:false,monto:0,interes:0,dias:0,inicio:null});
    if (!localStorage.getItem(CFG_KEY))   storageSet(CFG_KEY, {sofrSpread:0.04});
  }
  function sanReg(r) {
    return {
      id:           typeof r.id === 'number' ? r.id : Date.now(),
      fecha:        sanStr(r.fecha, 10),
      zona:         sanStr(r.zona, 100),
      notas:        sanStr(r.notas, 500),
      inicio:       sanStr(r.inicio, 5),
      fin:          sanStr(r.fin, 5),
      ingreso:      sanNum(r.ingreso),
      transporte:   sanNum(r.transporte),
      alimentacion: sanNum(r.alimentacion),
      otros:        sanNum(r.otros),
      gastos:       sanNum(r.gastos),
      neto:         sanNum(r.neto, -9999999),
      semilla:      sanNum(r.semilla),
      disponible:   sanNum(r.disponible, -9999999),
      horas:        sanNum(r.horas, 0, 24),
      xhora:        sanNum(r.xhora, 0),
      items:        Array.isArray(r.items) ? r.items.map(function(i) {
                      return {categoria:sanStr(i.categoria,50), cantidad:sanNum(i.cantidad,0,99999)};
                    }) : [],
      deudaGen:     !!r.deudaGen,
      createdAt:    typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
    };
  }
  function getRegistros() { return (storageGet(DB_KEY, []) || []).map(sanReg); }
  function saveRegistro(reg) {
    var list = getRegistros();
    var nuevo = sanReg(Object.assign({}, reg, {id: Date.now(), createdAt: Date.now()}));
    list.push(nuevo);
    storageSet(DB_KEY, list);
    return nuevo;
  }
  function deleteRegistro(id) {
    storageSet(DB_KEY, getRegistros().filter(function(r){ return r.id !== id; }));
  }
  function getRegistroById(id) {
    return getRegistros().find(function(r){ return r.id === id; }) || null;
  }
  function getDeuda() { return storageGet(DEUDA_KEY, {activa:false,monto:0,interes:0,dias:0,inicio:null}); }
  function saveDeuda(d) { storageSet(DEUDA_KEY, d); }
  function actualizarInteres() {
    var d = getDeuda();
    if (!d.activa || d.monto <= 0) return d;
    var tasaDiaria = TASA_ANUAL / 365;
    d.interes = (d.interes || 0) + d.monto * tasaDiaria;
    d.dias    = (d.dias || 0) + 1;
    saveDeuda(d);
    return d;
  }
  function exportarDatos() {
    return {
      version: '2.0',
      exportadoEn: new Date().toISOString(),
      protocolo: 'BREG-Ziva-v2',
      registros: getRegistros(),
      deuda: getDeuda(),
      config: storageGet(CFG_KEY, {}),
    };
  }

  /* ══════════════════════════════════════════
     MÓDULO: FINANZAS
  ══════════════════════════════════════════ */
  function calcularHoras(inicio, fin) {
    if (!inicio || !fin) return 0;
    try {
      var pi = inicio.split(':').map(Number);
      var pf = fin.split(':').map(Number);
      var minutos = (pf[0]*60+pf[1]) - (pi[0]*60+pi[1]);
      if (minutos < 0) minutos += 24*60;
      return Math.min(minutos/60, 24);
    } catch(e) { return 0; }
  }
  function calcular(d) {
    var ingreso      = sanNum(d.ingreso);
    var transporte   = sanNum(d.transporte);
    var alimentacion = sanNum(d.alimentacion);
    var otros        = sanNum(d.otros);
    var gastos    = transporte + alimentacion + otros;
    var neto      = ingreso - gastos;
    var semilla   = Math.max(0, neto * SEMILLA);
    var disponible= neto - semilla;
    var horas     = calcularHoras(d.inicio, d.fin);
    var xhora     = horas > 0 ? neto / horas : 0;
    return {gastos:gastos, neto:neto, semilla:semilla, disponible:disponible,
            horas:horas, xhora:xhora, netoNeg: neto < 0};
  }
  function eficienciaPorZona(registros) {
    var zonas = {};
    registros.forEach(function(r) {
      var z = (r.zona && r.zona.trim()) ? r.zona.trim() : 'Sin zona';
      if (!zonas[z]) zonas[z] = {zona:z, count:0, neto:0, horas:0};
      zonas[z].count++;
      zonas[z].neto  += r.neto  || 0;
      zonas[z].horas += r.horas || 0;
    });
    return Object.values(zonas).map(function(z) {
      return Object.assign({}, z, {
        xhora:    z.horas > 0 ? z.neto / z.horas : 0,
        promedio: z.count > 0 ? z.neto / z.count : 0,
      });
    }).sort(function(a,b){ return b.xhora - a.xhora; });
  }
  function metricas(registros) {
    if (!registros.length) return {totalNeto:0,totalSemilla:0,totalHoras:0,totalRegs:0,promedioNeto:0,xhoraGlobal:0,mejorZona:'—',tendencia:0};
    var totalNeto    = registros.reduce(function(a,r){ return a+(r.neto||0); }, 0);
    var totalSemilla = registros.reduce(function(a,r){ return a+(r.semilla||0); }, 0);
    var totalHoras   = registros.reduce(function(a,r){ return a+(r.horas||0); }, 0);
    var xhoraGlobal  = totalHoras > 0 ? totalNeto/totalHoras : 0;
    var promedioNeto = totalNeto / registros.length;
    var zonas        = eficienciaPorZona(registros);
    var mejorZona    = zonas[0] ? zonas[0].zona : '—';
    var ultimos = registros.slice(-5).reduce(function(a,r){ return a+r.neto; },0);
    var previos = registros.slice(-10,-5).reduce(function(a,r){ return a+r.neto; },0) || ultimos;
    var tendencia = previos > 0 ? ((ultimos-previos)/previos)*100 : 0;
    return {totalNeto:totalNeto, totalSemilla:totalSemilla, totalHoras:totalHoras,
            totalRegs:registros.length, promedioNeto:promedioNeto, xhoraGlobal:xhoraGlobal,
            mejorZona:mejorZona, tendencia:tendencia};
  }

  /* ══════════════════════════════════════════
     MÓDULO: TEMA
  ══════════════════════════════════════════ */
  function sanTema(t) { return TEMAS.indexOf(t) >= 0 ? t : 'dark'; }
  function aplicarTema(t) { document.documentElement.setAttribute('data-theme', t); }
  function cargarTema() { aplicarTema(sanTema(localStorage.getItem(TEMA_KEY))); }
  function toggleTema() {
    var actual = sanTema(localStorage.getItem(TEMA_KEY));
    var next   = TEMAS[(TEMAS.indexOf(actual)+1) % TEMAS.length];
    localStorage.setItem(TEMA_KEY, next);
    aplicarTema(next);
    return next;
  }

  /* ══════════════════════════════════════════
     MÓDULO: TOAST
  ══════════════════════════════════════════ */
  function toast(msg, tipo) {
    tipo = tipo || 'ok';
    var cont = getEl('toasts');
    if (!cont) return;
    var el = document.createElement('div');
    var icons = {ok:'✓', err:'✕', wrn:'⚠'};
    el.className = 'toast toast-' + tipo;
    el.innerHTML = '<span>' + (icons[tipo]||'•') + '</span><span>' + esc(msg) + '</span>';
    cont.appendChild(el);
    setTimeout(function() {
      el.classList.add('out');
      setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 2800);
  }

  /* ══════════════════════════════════════════
     MÓDULO: MODAL CONFIRM
  ══════════════════════════════════════════ */
  function confirm(msg, cb) {
    setText('modal-title', 'Confirmar');
    setText('modal-msg', msg);
    getEl('modal').style.display = 'flex';
    var btnYes = getEl('modal-yes');
    var btnNo  = getEl('modal-no');
    function cerrar() { getEl('modal').style.display = 'none'; }
    var yesClone = btnYes.cloneNode(true);
    btnYes.parentNode.replaceChild(yesClone, btnYes);
    yesClone.addEventListener('click', function(){ cerrar(); cb(); });
    btnNo.onclick = cerrar;
  }

  /* ══════════════════════════════════════════
     MÓDULO: GRÁFICOS CANVAS (nativos)
  ══════════════════════════════════════════ */
  var GCYAN  = '#00C8F8';
  var GBLUE  = '#3B4FE8';
  var GPURP  = '#8B2FC9';
  var GGREEN = '#00E5A0';
  var GRED   = '#FF4747';

  function getTextC() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? '#4a5688' : '#7a8ab8';
  }
  function getBrdC() {
    return document.documentElement.getAttribute('data-theme') === 'light'
      ? 'rgba(59,79,232,.12)' : 'rgba(100,130,255,.12)';
  }
  function gradH(ctx, w, c1, c2) {
    var g = ctx.createLinearGradient(0,0,w,0);
    g.addColorStop(0,c1); g.addColorStop(1,c2); return g;
  }
  function gradV(ctx, h, c1, c2) {
    var g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,c1); g.addColorStop(1,c2); return g;
  }
  function rRect(ctx, x, y, w, h, r) {
    if (h <= 0) return;
    r = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
    ctx.closePath();
  }
  function setupCanvas(id, H) {
    var c = getEl(id);
    if (!c) return null;
    var dpr = window.devicePixelRatio || 1;
    var W   = c.parentElement ? (c.parentElement.clientWidth || 300) : 300;
    c.width  = W * dpr; c.height = H * dpr;
    c.style.width  = W + 'px'; c.style.height = H + 'px';
    var ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0,0,W,H);
    return {ctx:ctx, W:W, H:H, c:c};
  }

  function chartNeto(registros) {
    var cv = setupCanvas('chart-neto', 110);
    if (!cv) return;
    var data = registros.slice(-14);
    if (!data.length) { cv.c.style.display='none'; return; }
    cv.c.style.display='block';
    var ctx=cv.ctx, W=cv.W, H=cv.H;
    var vals = data.map(function(r){ return r.neto||0; });
    var maxV = Math.max.apply(null, vals.map(Math.abs).concat([1]));
    var pad  = {t:8,r:6,b:22,l:6};
    var cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
    var n=vals.length, barW=Math.max(4,(cW/n)-3);
    var gap=(cW-barW*n)/(n-1||1);
    var mid=pad.t+cH/2;
    ctx.strokeStyle=getBrdC(); ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad.l,mid); ctx.lineTo(W-pad.r,mid); ctx.stroke();
    vals.forEach(function(v,i) {
      var x=pad.l+i*(barW+gap);
      var h=Math.max((Math.abs(v)/maxV)*(cH/2-2),1);
      var pos=v>=0, y=pos?mid-h:mid;
      ctx.fillStyle=pos?gradV(ctx,H,GCYAN,GBLUE):GRED;
      ctx.globalAlpha=.9;
      rRect(ctx,x,y,barW,h,Math.min(3,barW/2));
      ctx.fill(); ctx.globalAlpha=1;
      if (data[i] && data[i].fecha) {
        var d=data[i].fecha.slice(8,10);
        ctx.fillStyle=getTextC(); ctx.font='9px JetBrains Mono,monospace';
        ctx.textAlign='center'; ctx.fillText(d,x+barW/2,H-pad.b+12);
      }
    });
    setText('chart-rng','últimos '+data.length+' días');
  }

  function chartZona(zonas) {
    var cv = setupCanvas('chart-zona', 140);
    if (!cv) return;
    var data=zonas.slice(0,6);
    if (!data.length) return;
    var ctx=cv.ctx, W=cv.W, H=cv.H;
    var maxX=Math.max.apply(null,data.map(function(z){return z.xhora;}));
    maxX=maxX||1;
    var rowH=H/data.length;
    data.forEach(function(z,i) {
      var y=i*rowH+2, bH=rowH-8;
      ctx.fillStyle=getBrdC();
      rRect(ctx,5,y,W-10,bH,4); ctx.fill();
      var bW=Math.max((z.xhora/maxX)*(W-10),4);
      ctx.fillStyle=gradH(ctx,W,GPURP,GCYAN);
      ctx.globalAlpha=.85;
      rRect(ctx,5,y,bW,bH,4); ctx.fill(); ctx.globalAlpha=1;
      ctx.fillStyle='rgba(255,255,255,.9)'; ctx.font='bold 10px Exo 2,sans-serif';
      ctx.textAlign='left'; ctx.fillText(z.zona.slice(0,18),10,y+bH/2+4);
    });
  }

  function chartHoras(registros) {
    var cv = setupCanvas('chart-hrs', 140);
    if (!cv) return;
    var data=registros.filter(function(r){return r.horas>0;});
    if (!data.length) return;
    var ctx=cv.ctx, W=cv.W, H=cv.H;
    var maxH=Math.max.apply(null,data.map(function(r){return r.horas;}));
    var maxN=Math.max.apply(null,data.map(function(r){return Math.abs(r.neto);}));
    maxH=maxH||1; maxN=maxN||1;
    var pad=16;
    ctx.strokeStyle=getBrdC(); ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad,pad); ctx.lineTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();
    data.forEach(function(r) {
      var x=pad+((r.horas/maxH)*(W-pad*2));
      var y=(H-pad)-((Math.abs(r.neto)/maxN)*(H-pad*2));
      ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2);
      ctx.fillStyle=r.neto>=0?GCYAN:GRED; ctx.globalAlpha=.8;
      ctx.fill(); ctx.globalAlpha=1;
    });
    ctx.fillStyle=getTextC(); ctx.font='9px JetBrains Mono,monospace';
    ctx.textAlign='left'; ctx.fillText('Horas →',W-50,H-4);
  }

  function chartDeuda(registros) {
    var cv = setupCanvas('chart-deuda', 110);
    if (!cv) return;
    var ctx=cv.ctx, W=cv.W, H=cv.H;
    var data=registros.filter(function(r){return r.deudaGen;});
    if (!data.length) {
      ctx.fillStyle=getTextC(); ctx.font='12px JetBrains Mono,monospace';
      ctx.textAlign='center'; ctx.fillText('Sin historial de deuda ✓',W/2,H/2);
      return;
    }
    var vals=data.map(function(r){return Math.abs(r.neto);});
    var maxV=Math.max.apply(null,vals.concat([1]));
    var pad=16, cW=W-pad*2, cH=H-pad*2, n=vals.length;
    ctx.beginPath();
    vals.forEach(function(v,i) {
      var x=pad+(i/(n-1||1))*cW;
      var y=(H-pad)-(v/maxV)*cH;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.strokeStyle=GRED; ctx.lineWidth=2; ctx.stroke();
    ctx.lineTo(pad+cW,H-pad); ctx.lineTo(pad,H-pad); ctx.closePath();
    ctx.fillStyle='rgba(255,71,71,.1)'; ctx.fill();
  }

  /* ══════════════════════════════════════════
     MÓDULO: RENDER UI
  ══════════════════════════════════════════ */
  function renderDashboard(registros, deuda) {
    var m = metricas(registros);
    setText('d-neto',    fCLP(m.totalNeto));
    setText('d-semilla', fCLP(m.totalSemilla));
    setText('d-regs',    String(m.totalRegs));
    setText('d-horas',   fHoras(m.totalHoras));
    setText('d-xhora',   m.xhoraGlobal > 0 ? fCLP(m.xhoraGlobal) : '—');
    setText('d-zona',    m.mejorZona);
    var tEl = getEl('d-tend');
    if (tEl && m.tendencia !== 0) {
      tEl.textContent = (m.tendencia>=0?'+':'') + m.tendencia.toFixed(1) + '%';
      tEl.style.color = m.tendencia >= 0 ? 'var(--success)' : 'var(--danger)';
    }
    var deudaMonto = deuda ? (deuda.monto||0) : 0;
    var deudaInt   = deuda ? (deuda.interes||0) : 0;
    setText('d-deuda',   fCLP(deudaMonto));
    setText('d-interes', fCLP(deudaInt));
    var banner = getEl('deuda-banner');
    if (banner) {
      if (deuda && deuda.activa && deudaMonto > 0) {
        banner.style.display = 'flex';
        setText('db-monto', fCLP(deudaMonto + deudaInt));
        var tasaDiaPct = ((TASA_ANUAL/365)*100).toFixed(4);
        setText('db-tasa', tasaDiaPct + '%/día (SOFR+4%)');
      } else {
        banner.style.display = 'none';
      }
    }
    var lastEl = getEl('last-reg');
    if (lastEl && registros.length > 0) {
      var last = registros[registros.length-1];
      lastEl.style.display = 'flex';
      setText('lr-fecha', last.fecha || '—');
      setText('lr-zona',  last.zona  || '—');
      setText('lr-neto',  fCLP(last.neto));
      var netoEl = getEl('lr-neto');
      if (netoEl) netoEl.style.color = last.neto >= 0 ? 'var(--success)' : 'var(--danger)';
    }
    chartNeto(registros);
  }

  function renderHistorial(registros, filtro) {
    filtro = filtro || 'todos';
    var filt = filtrarRegs(registros, filtro);
    var total = filt.reduce(function(a,r){return a+r.neto;},0);
    var avg   = filt.length ? total/filt.length : 0;
    setText('hs-cnt',  String(filt.length));
    setText('hs-neto', fCLP(total));
    setText('hs-avg',  fCLP(avg));
    var cont  = getEl('lista-regs');
    var empty = getEl('hist-empty');
    if (!cont) return;
    if (!filt.length) {
      if (empty) empty.style.display = 'flex';
      var prevCards = cont.querySelectorAll('.reg-card');
      prevCards.forEach(function(c){ c.parentNode.removeChild(c); });
      return;
    }
    if (empty) empty.style.display = 'none';
    var prev = cont.querySelectorAll('.reg-card');
    prev.forEach(function(c){ c.parentNode.removeChild(c); });
    var ordenados = filt.slice().sort(function(a,b){ return b.createdAt-a.createdAt; });
    ordenados.forEach(function(r) {
      var card = document.createElement('div');
      card.className = 'reg-card';
      var nc = r.neto >= 0 ? 'pos' : 'neg';
      card.innerHTML =
        '<div class="reg-top">' +
          '<div><div class="reg-fecha">' + esc(r.fecha||'—') + '</div>' +
          '<div class="reg-zona">' + esc(r.zona||'Sin zona') + '</div></div>' +
          '<div class="reg-neto ' + nc + '">' + fCLP(r.neto) + '</div>' +
        '</div>' +
        '<div class="reg-meta">' +
          '<span>⏱ ' + fHoras(r.horas) + '</span>' +
          (r.xhora > 0 ? '<span>⚡ ' + fCLP(r.xhora) + '/h</span>' : '') +
          (r.items && r.items.length ? '<span>📦 ' + r.items.length + ' items</span>' : '') +
          '<span class="reg-semilla">🌱 ' + fCLP(r.semilla) + '</span>' +
        '</div>';
      card.addEventListener('click', function(){ verDetalle(r.id); });
      cont.appendChild(card);
    });
  }

  function renderDetalle(r) {
    var cont = getEl('det-body');
    if (!cont || !r) return;
    var nc = r.neto >= 0 ? 'var(--success)' : 'var(--danger)';
    var html = '';
    html += '<div class="det-body-card det-hero">';
    html += '<div class="det-card-t">📅 ' + esc(r.fecha||'—') + ' · ' + esc(r.zona||'Sin zona') + '</div>';
    html += '<div class="det-neto">' + fCLP(r.neto) + '</div>';
    html += '<div class="det-meta">';
    if (r.horas > 0) html += '<span>⏱ ' + fHoras(r.horas) + '</span>';
    if (r.xhora > 0) html += '<span>⚡ ' + fCLP(r.xhora) + '/h</span>';
    html += '</div></div>';
    html += '<div class="det-body-card">';
    html += '<div class="det-card-t">💰 Finanzas</div>';
    html += '<div class="det-row"><span>Ingreso bruto</span><strong>' + fCLP(r.ingreso) + '</strong></div>';
    if (r.transporte) html += '<div class="det-row"><span>Transporte</span><strong class="val-red">-' + fCLP(r.transporte) + '</strong></div>';
    if (r.alimentacion) html += '<div class="det-row"><span>Alimentación</span><strong class="val-red">-' + fCLP(r.alimentacion) + '</strong></div>';
    if (r.otros) html += '<div class="det-row"><span>Otros</span><strong class="val-red">-' + fCLP(r.otros) + '</strong></div>';
    html += '<div class="det-row"><span>Total gastos</span><strong class="val-red">-' + fCLP(r.gastos) + '</strong></div>';
    html += '<div class="det-row"><span>Neto</span><strong style="color:' + nc + '">' + fCLP(r.neto) + '</strong></div>';
    html += '<div class="det-row"><span>Capital semilla (15%)</span><strong class="val-cyan">' + fCLP(r.semilla) + '</strong></div>';
    html += '<div class="det-row"><span>Disponible</span><strong class="val-green">' + fCLP(r.disponible) + '</strong></div>';
    html += '</div>';
    if (r.items && r.items.length) {
      html += '<div class="det-body-card"><div class="det-card-t">⚙ Producción (' + r.items.length + ' materiales)</div>';
      r.items.forEach(function(item) {
        html += '<div class="det-item"><span>' + esc(item.categoria) + '</span><strong>' + item.cantidad + ' kg</strong></div>';
      });
      html += '</div>';
    }
    if (r.notas) {
      html += '<div class="det-body-card"><div class="det-card-t">📝 Notas</div>';
      html += '<div class="det-notas">' + esc(r.notas) + '</div></div>';
    }
    if (r.inicio || r.fin) {
      html += '<div class="det-body-card"><div class="det-card-t">⏱ Horario</div>';
      html += '<div class="det-row"><span>Inicio</span><strong>' + (r.inicio||'—') + '</strong></div>';
      html += '<div class="det-row"><span>Fin</span><strong>' + (r.fin||'—') + '</strong></div>';
      html += '<div class="det-row"><span>Total</span><strong class="val-cyan">' + fHoras(r.horas) + '</strong></div>';
      html += '</div>';
    }
    cont.innerHTML = html;
  }

  function renderAnalytics(registros) {
    var zonas = eficienciaPorZona(registros);
    var tabla = getEl('zona-tabla');
    if (tabla) {
      if (!zonas.length) {
        tabla.innerHTML = '<p style="font-family:var(--fm);font-size:12px;color:var(--tm);text-align:center;padding:12px">Sin datos suficientes</p>';
      } else {
        var html = '';
        zonas.slice(0,5).forEach(function(z) {
          html += '<div class="zona-row"><span>' + esc(z.zona) + '</span>';
          html += '<span>' + z.count + ' días</span>';
          html += '<strong>' + (z.xhora > 0 ? fCLP(z.xhora)+'/h' : '—') + '</strong></div>';
        });
        tabla.innerHTML = html;
      }
    }
    chartZona(zonas);
    chartHoras(registros);
    chartDeuda(registros);
  }

  function filtrarRegs(registros, filtro) {
    if (filtro === 'todos') return registros;
    var hoy = new Date(), corte = new Date(hoy);
    if (filtro === 'semana') corte.setDate(hoy.getDate()-7);
    if (filtro === 'mes')    corte.setMonth(hoy.getMonth()-1);
    return registros.filter(function(r) {
      if (!r.fecha) return false;
      return new Date(r.fecha) >= corte;
    });
  }

  /* ══════════════════════════════════════════
     ESTADO GLOBAL
  ══════════════════════════════════════════ */
  var STATE = {
    registros: [],
    deuda:     {},
    items:     [],
    filtro:    'todos',
    detalleId: null,
  };

  function cargarDatos() {
    STATE.registros = getRegistros();
    STATE.deuda     = getDeuda();
    refreshUI();
  }
  function refreshUI() {
    var vista = vistaActual();
    renderDashboard(STATE.registros, STATE.deuda);
    if (vista === 'historial') renderHistorial(STATE.registros, STATE.filtro);
    if (vista === 'analisis')  renderAnalytics(STATE.registros);
  }
  function vistaActual() {
    var activa = document.querySelector('.vista.activa');
    if (!activa) return 'inicio';
    return activa.id.replace('v-','');
  }

  /* ══════════════════════════════════════════
     NAVEGACIÓN
  ══════════════════════════════════════════ */
  function irA(v) {
    var vistas = document.querySelectorAll('.vista');
    vistas.forEach(function(el) { el.classList.remove('activa'); el.style.display='none'; });
    var target = getEl('v-' + v);
    if (!target) return;
    target.style.display = 'block';
    target.classList.add('activa');
    document.querySelectorAll('.nb').forEach(function(btn) {
      btn.classList.toggle('act', btn.getAttribute('data-v') === v);
    });
    refreshUI();
    var mc = document.querySelector('.main');
    if (mc) mc.scrollTop = 0;
  }

  /* ══════════════════════════════════════════
     FORM: PREVIEW
  ══════════════════════════════════════════ */
  function actualizarPreview() {
    var d = leerForm();
    var f = calcular(d);
    setText('p-gastos',  fCLP(f.gastos));
    setText('p-neto',    fCLP(f.neto));
    setText('p-semilla', fCLP(f.semilla));
    setText('p-disp',    fCLP(f.disponible));
    var horaRow = getEl('p-hora-row');
    if (f.horas > 0 && horaRow) {
      horaRow.style.display = 'flex';
      setText('p-xhora', fCLP(f.xhora)+'/h');
    } else if (horaRow) { horaRow.style.display='none'; }
    var hl  = getEl('horas-live');
    var hlv = getEl('horas-val');
    if (hl && hlv) {
      if (f.horas > 0) { hl.style.display='flex'; hlv.textContent=fHoras(f.horas)+' trabajadas'; }
      else               hl.style.display='none';
    }
  }

  /* ══════════════════════════════════════════
     FORM: ITEMS
  ══════════════════════════════════════════ */
  function agregarItem() {
    var catEl  = getEl('f-cat');
    var cantEl = getEl('f-cant');
    if (!catEl || !cantEl) return;
    var cant = parseFloat(cantEl.value);
    if (!cant || cant <= 0) { toast('Ingresa una cantidad válida','wrn'); cantEl.focus(); return; }
    STATE.items.push({categoria: catEl.value, cantidad: cant});
    cantEl.value = '';
    cantEl.focus();
    renderItems();
  }
  function renderItems() {
    var cont = getEl('items-list');
    if (!cont) return;
    if (!STATE.items.length) {
      cont.innerHTML = '<p class="empty-items">Sin materiales agregados</p>';
      return;
    }
    cont.innerHTML = '';
    STATE.items.forEach(function(item, i) {
      var div = document.createElement('div');
      div.className = 'item-card';
      div.innerHTML = '<span>' + esc(item.categoria) + '</span><strong>' + item.cantidad + ' kg</strong><button type="button" data-idx="' + i + '">✕</button>';
      div.querySelector('button').addEventListener('click', function(e) {
        STATE.items.splice(parseInt(e.target.getAttribute('data-idx'),10), 1);
        renderItems();
      });
      cont.appendChild(div);
    });
  }

  /* ══════════════════════════════════════════
     FORM: GUARDAR
  ══════════════════════════════════════════ */
  function guardarRegistro() {
    var d = leerForm();
    if (!d.fecha)    { toast('Selecciona una fecha','wrn'); getEl('f-fecha') && getEl('f-fecha').focus(); return; }
    if (!d.ingreso)  { toast('Ingresa el ingreso bruto','wrn'); getEl('f-ingreso') && getEl('f-ingreso').focus(); return; }
    var f = calcular(d);
    if (f.netoNeg) {
      var deuda = getDeuda();
      var monto = Math.abs(f.neto);
      var pen   = monto * 0.04;
      deuda.monto  = (deuda.monto||0) + monto + pen;
      deuda.activa = true;
      deuda.dias   = (deuda.dias||0) + 1;
      if (!deuda.inicio) deuda.inicio = new Date().toISOString();
      saveDeuda(deuda);
      toast('⚠ Deuda generada: ' + fCLP(monto+pen), 'err');
    }
    saveRegistro(Object.assign({}, d, f, {items: STATE.items.slice(), deudaGen: f.netoNeg}));
    STATE.items = [];
    renderItems();
    resetForm();
    cargarDatos();
    irA('inicio');
    toast('✓ Registro guardado', 'ok');
  }

  /* ══════════════════════════════════════════
     HISTORIAL: DETALLE / ELIMINAR
  ══════════════════════════════════════════ */
  function verDetalle(id) {
    var r = getRegistroById(id);
    if (!r) { toast('Registro no encontrado','err'); return; }
    STATE.detalleId = id;
    renderDetalle(r);
    irA('detalle');
  }

  /* ══════════════════════════════════════════
     EXPORTAR
  ══════════════════════════════════════════ */
  function exportar() {
    var payload = exportarDatos();
    var blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url; a.download = 'breg-' + hoyISO() + '.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast('Datos exportados ✓','ok');
  }

  /* ══════════════════════════════════════════
     SW
  ══════════════════════════════════════════ */
  function registrarSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function(e){
        console.warn('[BREG] SW:', e);
      });
    }
  }

  /* ══════════════════════════════════════════
     HELPERS FORM
  ══════════════════════════════════════════ */
  function leerForm() {
    return {
      fecha:        valEl('f-fecha'),
      inicio:       valEl('f-inicio'),
      fin:          valEl('f-fin'),
      zona:         valEl('f-zona'),
      notas:        valEl('f-notas'),
      ingreso:      numEl('f-ingreso'),
      transporte:   numEl('f-trans'),
      alimentacion: numEl('f-alim'),
      otros:        numEl('f-otros'),
    };
  }
  function resetForm() {
    ['f-inicio','f-fin','f-zona','f-notas','f-ingreso','f-trans','f-alim','f-otros']
      .forEach(function(id){ var el=getEl(id); if(el) el.value=''; });
    var fd = getEl('f-fecha'); if (fd) fd.value = hoyISO();
    var hl = getEl('horas-live'); if (hl) hl.style.display='none';
    actualizarPreview();
  }
  function valEl(id) { var el=getEl(id); return el ? el.value.trim() : ''; }
  function numEl(id) { return parseFloat(valEl(id)) || 0; }

  /* ══════════════════════════════════════════
     INIT
  ══════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function() {

    // 1. Splash → App
    setTimeout(function() {
      var sp = getEl('splash');
      if (sp) sp.classList.add('out');
      var app = getEl('app');
      if (app) app.classList.remove('hidden');
    }, 1700);

    // 2. Tema
    cargarTema();

    // 3. DB
    initDB();
    actualizarInteres();

    // 4. Fecha de hoy
    var fd = getEl('f-fecha');
    if (fd) fd.value = hoyISO();

    // 5. Cargar datos
    cargarDatos();

    // 6. SW
    registrarSW();

    // ── EVENTOS ──

    // Navegación bottom nav + data-v
    document.querySelectorAll('[data-v]').forEach(function(btn) {
      btn.addEventListener('click', function() { irA(btn.getAttribute('data-v')); });
    });

    // Tema
    getEl('btn-theme') && getEl('btn-theme').addEventListener('click', function() {
      var t = toggleTema(); toast('Tema: ' + t, 'ok');
      setTimeout(refreshUI, 50);
    });

    // Exportar
    getEl('btn-exportar') && getEl('btn-exportar').addEventListener('click', exportar);

    // Form: inputs en tiempo real
    ['f-ingreso','f-trans','f-alim','f-otros','f-inicio','f-fin'].forEach(function(id) {
      var el = getEl(id);
      if (el) el.addEventListener('input', actualizarPreview);
    });

    // Form: agregar item
    getEl('btn-add-item') && getEl('btn-add-item').addEventListener('click', agregarItem);

    // Form: guardar
    getEl('btn-save') && getEl('btn-save').addEventListener('click', guardarRegistro);

    // Form: cancelar
    getEl('btn-cancel') && getEl('btn-cancel').addEventListener('click', function() { irA('inicio'); });

    // Ir a nuevo desde historial vacío
    getEl('btn-ir-nuevo') && getEl('btn-ir-nuevo').addEventListener('click', function() { irA('nuevo'); });

    // Filtros historial
    document.querySelectorAll('.fbtn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.fbtn').forEach(function(b){ b.classList.remove('act'); });
        btn.classList.add('act');
        STATE.filtro = btn.getAttribute('data-f');
        renderHistorial(STATE.registros, STATE.filtro);
      });
    });

    // Detalle: volver
    getEl('btn-back') && getEl('btn-back').addEventListener('click', function() { irA('historial'); });

    // Detalle: eliminar
    getEl('btn-del') && getEl('btn-del').addEventListener('click', function() {
      if (!STATE.detalleId) return;
      confirm('¿Eliminar este registro? No se puede deshacer.', function() {
        deleteRegistro(STATE.detalleId);
        STATE.detalleId = null;
        cargarDatos();
        irA('historial');
        toast('Registro eliminado','ok');
      });
    });

    // Modal cancelar
    getEl('modal-no') && getEl('modal-no').addEventListener('click', function() {
      getEl('modal').style.display = 'none';
    });

    // Cerrar modal con Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var m = getEl('modal');
        if (m) m.style.display = 'none';
      }
    });

  }); // DOMContentLoaded

})(); // IIFE
