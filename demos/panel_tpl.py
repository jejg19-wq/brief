# -*- coding: utf-8 -*-
"""Panel de control de prospeccion. Lo usa generar.py."""
import json, html

def render(ps, wa_jackson, base_url):
    datos = json.dumps(ps, ensure_ascii=False)
    return TPL.replace("/*__DATOS__*/", datos).replace("__BASE__", base_url)

TPL = r"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Panel de prospección · Jackson</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#0a0c0f;--card:#12161b;--card2:#1a1f26;--ink:#eef1f5;--mute:#8a939f;
  --line:rgba(238,241,245,.10);--n:#c4f542;--wa:#25D366;--warn:#f0a13c;--r:12px}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font-family:Inter,system-ui,sans-serif;font-weight:400;
  line-height:1.55;-webkit-font-smoothing:antialiased;padding-bottom:40px}
.wrap{max-width:900px;margin:0 auto;padding:0 14px}
a{color:inherit}
header{border-bottom:1px solid var(--line);padding:20px 0;margin-bottom:16px;background:var(--card);position:sticky;top:0;z-index:20}
h1{font-size:19px;font-weight:700;letter-spacing:-.02em;margin-bottom:3px}
h1 span{color:var(--n)}
.sub{font-size:12.5px;color:var(--mute)}
.stats{display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:12px}
.stats b{color:var(--n);font-weight:600}
.tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.tools input,.tools select{background:var(--card2);border:1px solid var(--line);color:var(--ink);
  border-radius:100px;padding:9px 15px;font-family:inherit;font-size:13.5px;flex:1;min-width:130px}
.tools input:focus,.tools select:focus{outline:0;border-color:var(--n)}

.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:16px;margin-bottom:11px}
.card.done{opacity:.42}
.top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px}
.name{font-size:16.5px;font-weight:600;letter-spacing:-.01em}
.meta{font-size:12.5px;color:var(--mute);margin-top:2px}
.meta a{color:var(--n);text-decoration:none}
.prio{flex:0 0 auto;font-size:10px;letter-spacing:.13em;text-transform:uppercase;font-weight:600;
  padding:4px 9px;border-radius:100px;white-space:nowrap}
.p1{background:var(--n);color:#0b1400}
.p2{background:rgba(196,245,66,.16);color:var(--n)}
.p3{background:var(--card2);color:var(--mute)}
.tanda{flex:0 0 auto;font-size:10px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;
  padding:4px 9px;border-radius:100px;white-space:nowrap;border:1px solid var(--line);color:var(--mute)}
.t1{border-color:var(--n);color:var(--n)}
.top{background:var(--n);color:#0b1400;border-color:var(--n);font-weight:700}
.badges{display:flex;gap:6px;flex-direction:column;align-items:flex-end}
.warn{font-size:12px;color:var(--warn);background:rgba(240,161,60,.10);border:1px solid rgba(240,161,60,.28);
  border-radius:8px;padding:8px 11px;margin:9px 0}
.msg{background:var(--card2);border:1px solid var(--line);border-radius:9px;padding:12px;font-size:13px;
  color:#cfd6de;white-space:pre-wrap;max-height:106px;overflow:hidden;position:relative;cursor:pointer;margin:9px 0;line-height:1.6}
.msg.open{max-height:none}
.msg::after{content:'';position:absolute;left:0;right:0;bottom:0;height:38px;
  background:linear-gradient(transparent,var(--card2))}
.msg.open::after{display:none}
.acts{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
.b{border:0;cursor:pointer;font-family:inherit;font-size:13px;font-weight:500;padding:10px 15px;
  border-radius:100px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:filter .15s,transform .12s}
.b:active{transform:scale(.97)}
.b:hover{filter:brightness(1.14)}
.bn{background:var(--n);color:#0b1400;font-weight:600}
.bw{background:var(--wa);color:#052b10;font-weight:600}
.bg{background:var(--card2);color:var(--ink);border:1px solid var(--line)}
.bg.on{background:var(--n);color:#0b1400;border-color:var(--n);font-weight:600}
.b[disabled]{opacity:.4;cursor:not-allowed}
.estado{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}
.e{background:transparent;border:1px solid var(--line);color:var(--mute);border-radius:100px;padding:6px 12px;
  font-family:inherit;font-size:12px;cursor:pointer;transition:all .15s}
.e:hover{border-color:var(--mute)}
.e[aria-pressed="true"]{background:var(--n);border-color:var(--n);color:#0b1400;font-weight:600}
.vacio{text-align:center;color:var(--mute);padding:44px 0;font-size:14px}
.toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(120%);background:var(--n);color:#0b1400;
  padding:12px 24px;border-radius:100px;font-weight:600;font-size:14px;z-index:60;transition:transform .3s cubic-bezier(.2,.9,.3,1.2);
  box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;pointer-events:none}
.toast.show{transform:translateX(-50%) translateY(0);opacity:1}
.aviso{background:rgba(240,161,60,.09);border:1px solid rgba(240,161,60,.26);border-radius:var(--r);
  padding:14px 16px;font-size:13px;color:#e8d5b8;margin-bottom:16px;line-height:1.65}
.aviso b{color:var(--warn)}
</style>
</head>
<body>

<header>
  <div class="wrap">
    <h1>Panel de prospección<span>.</span></h1>
    <p class="sub">San Cristóbal · cada uno con su página personalizada y su mensaje</p>
    <div class="stats">
      <span><b id="sTotal">0</b> en total</span>
      <span><b id="sT1">0</b> en tanda 1</span>
      <span><b id="sPend">0</b> por enviar</span>
      <span><b id="sEnv">0</b> enviados</span>
      <span><b id="sResp">0</b> respondieron</span>
      <span><b id="sCerr">0</b> cerrados</span>
    </div>
    <div class="tools">
      <input id="q" placeholder="Buscar negocio…" autocomplete="off">
      <select id="fNicho"><option value="">Todos los rubros</option></select>
      <select id="fTanda">
        <option value="">Todas las tandas</option>
        <option value="1">Tanda 1 · empezar por aquí</option>
        <option value="2">Tanda 2 · después</option>
        <option value="3">Tanda 3 · cuando tengas casos</option>
      </select>
      <select id="fEstado">
        <option value="">Todos los estados</option>
        <option value="pendiente">Por enviar</option>
        <option value="enviado">Enviados</option>
        <option value="respondio">Respondieron</option>
        <option value="cerrado">Cerrados</option>
        <option value="descartado">Descartados</option>
      </select>
    </div>
  </div>
</header>

<div class="wrap">
  <div class="aviso">
    <b>Antes de enviar:</b> verifica el número abriendo el Instagram del negocio — los teléfonos vienen de directorios públicos y pueden estar desactualizados.
    Máximo <b>20–30 mensajes nuevos al día</b> y desde un número aparte del personal, o WhatsApp te bloquea.
    Los pedidos de prueba que haga el prospecto <b>te llegan a ti</b>: eso te avisa quién está interesado.
  </div>
  <div id="lista"></div>
  <p class="vacio" id="vacio" hidden>No hay nada con ese filtro.</p>
</div>

<div class="toast" id="toast">Mensaje copiado</div>

<script>
(function(){
  'use strict';
  var P = /*__DATOS__*/;
  var CLAVE = 'jackson_prospeccion_v1';
  var estado = {};
  function safe(f){ try{ f(); }catch(e){} }
  safe(function(){ estado = JSON.parse(localStorage.getItem(CLAVE) || '{}'); });
  function guardar(){ safe(function(){ localStorage.setItem(CLAVE, JSON.stringify(estado)); }); }
  var $ = function(id){ return document.getElementById(id); };
  var esc = function(s){ return String(s).replace(/[&<>"]/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };

  var NICHOS = {restaurante:'Comida y comercio', barberia:'Barbería, salón y gimnasio', clinica:'Salud'};
  var ESTADOS = [['pendiente','Por enviar'],['enviado','Enviado'],['respondio','Respondió'],['cerrado','Cerrado'],['descartado','Descartar']];

  safe(function(){
    var vistos = {}, h = '';
    for(var i=0;i<P.length;i++){ vistos[P[i].base] = 1; }
    for(var k in vistos) h += '<option value="'+k+'">'+NICHOS[k]+'</option>';
    $('fNicho').innerHTML += h;
  });

  function est(p){ return estado[p.slug] || 'pendiente'; }

  function pintar(){
    var q = ($('q').value || '').toLowerCase().trim();
    var fn = $('fNicho').value, fe = $('fEstado').value, ft = $('fTanda').value;
    var h = '', n = 0;
    var orden = P.slice().sort(function(a,b){ return ((b.top?1:0)-(a.top?1:0)) || (a.tanda - b.tanda) || (a.prio - b.prio) || a.nombre.localeCompare(b.nombre); });

    for(var i=0;i<orden.length;i++){
      var p = orden[i], e = est(p);
      if(q && p.nombre.toLowerCase().indexOf(q) < 0 && (p.ig||'').toLowerCase().indexOf(q) < 0) continue;
      if(fn && p.base !== fn) continue;
      if(ft && String(p.tanda) !== ft) continue;
      if(fe && e !== fe) continue;
      n++;

      var tel = (p.tel && p.tel.length) ? p.tel[0] : '';
      var waUrl = tel ? 'https://wa.me/'+tel+'?text='+encodeURIComponent(p.msg) : '';
      var apagado = (e === 'cerrado' || e === 'descartado');

      h += '<article class="card'+(apagado?' done':'')+'" data-s="'+p.slug+'">'
        +   '<div class="top"><div>'
        +     '<div class="name">'+esc(p.nombre)+'</div>'
        +     '<div class="meta">'+esc(p.tipo)+' · '+esc(p.zona)
        +       (p.ig ? ' · <a href="https://instagram.com/'+esc(p.ig)+'" target="_blank" rel="noopener">@'+esc(p.ig)+'</a>' : '')
        +     '</div>'
        +   '</div><div class="badges">'
        +     '<span class="prio p'+p.prio+'">'+(p.prio===1?'Caliente':(p.prio===2?'Medio':'Frío'))+'</span>'
        +     '<span class="tanda t'+p.tanda+'">Tanda '+p.tanda+'</span>'
        +     (p.top ? '<span class="tanda top">Prioridad</span>' : '')
        +   '</div></div>';

      if(!tel){
        h += '<div class="warn">Sin número publicado. Ábrele el Instagram, copia el WhatsApp de la bio y escríbele desde ahí.</div>';
      } else if(p.verificar){
        h += '<div class="warn">Número sin verificar: '+esc(tel.replace(/^58/,'0'))+' — confírmalo en su perfil antes de escribir.</div>';
      }

      h += '<div class="msg" data-msg>'+esc(p.msg)+'</div>'
        +  '<div class="acts">'
        +    '<a class="b bn" href="'+p.link+'" target="_blank" rel="noopener">Ver su página</a>'
        +    '<button class="b bg" data-copiar="'+i+'">Copiar mensaje</button>'
        +    (waUrl ? '<a class="b bw" href="'+waUrl+'" target="_blank" rel="noopener" data-wa="'+i+'">Abrir WhatsApp</a>'
                    : '<button class="b bw" disabled>Abrir WhatsApp</button>')
        +    '<a class="b bg" href="'+p.brief+'" target="_blank" rel="noopener">Brief</a>'
        +    '<button class="b bg" data-seg="'+i+'">Copiar seguimiento</button>'
        +  '</div>'
        +  '<div class="estado">';
      for(var j=0;j<ESTADOS.length;j++){
        h += '<button class="e" data-est="'+ESTADOS[j][0]+'" data-slug="'+p.slug+'" aria-pressed="'+(e===ESTADOS[j][0])+'">'+ESTADOS[j][1]+'</button>';
      }
      h += '</div></article>';
    }

    $('lista').innerHTML = h;
    $('vacio').hidden = n > 0;
    conectar(orden);
    contar();
  }

  function conectar(orden){
    var msgs = document.querySelectorAll('[data-msg]');
    for(var i=0;i<msgs.length;i++) msgs[i].addEventListener('click', function(){ this.classList.toggle('open'); });

    var cop = document.querySelectorAll('[data-copiar]');
    for(var j=0;j<cop.length;j++) cop[j].addEventListener('click', function(){
      copiar(orden[+this.dataset.copiar].msg, 'Mensaje copiado');
    });
    var seg = document.querySelectorAll('[data-seg]');
    for(var k=0;k<seg.length;k++) seg[k].addEventListener('click', function(){
      copiar(orden[+this.dataset.seg].msg2, 'Seguimiento copiado');
    });
    var was = document.querySelectorAll('[data-wa]');
    for(var w=0;w<was.length;w++) was[w].addEventListener('click', function(){
      var p = orden[+this.dataset.wa];
      if(est(p) === 'pendiente'){ estado[p.slug] = 'enviado'; guardar(); setTimeout(pintar, 400); }
    });
    var ests = document.querySelectorAll('[data-est]');
    for(var e=0;e<ests.length;e++) ests[e].addEventListener('click', function(){
      var s = this.dataset.slug;
      estado[s] = (estado[s] === this.dataset.est) ? 'pendiente' : this.dataset.est;
      guardar(); pintar();
    });
  }

  function copiar(texto, aviso){
    var ok = function(){ toast(aviso); };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(texto).then(ok, function(){ fallback(texto, ok); });
    } else fallback(texto, ok);
  }
  function fallback(texto, ok){
    try{
      var t = document.createElement('textarea');
      t.value = texto; t.style.position='fixed'; t.style.opacity='0';
      document.body.appendChild(t); t.select(); document.execCommand('copy');
      document.body.removeChild(t); ok();
    }catch(e){ toast('No se pudo copiar — selecciona el texto a mano'); }
  }
  var tid = null;
  function toast(txt){
    var t = $('toast'); t.textContent = txt; t.classList.add('show');
    clearTimeout(tid); tid = setTimeout(function(){ t.classList.remove('show'); }, 1900);
  }

  function contar(){
    var c = {pendiente:0, enviado:0, respondio:0, cerrado:0, descartado:0};
    for(var i=0;i<P.length;i++) c[est(P[i])]++;
    $('sTotal').textContent = P.length;
    var t1 = 0;
    for(var k=0;k<P.length;k++) if(P[k].tanda === 1) t1++;
    $('sT1').textContent = t1;
    $('sPend').textContent  = c.pendiente;
    $('sEnv').textContent   = c.enviado;
    $('sResp').textContent  = c.respondio;
    $('sCerr').textContent  = c.cerrado;
  }

  $('q').addEventListener('input', pintar);
  $('fNicho').addEventListener('change', pintar);
  $('fTanda').addEventListener('change', pintar);
  $('fEstado').addEventListener('change', pintar);
  safe(pintar);
})();
</script>
</body>
</html>
"""
