import fs from 'node:fs';
const S = '/tmp/claude-0/-home-user-brief/9fb4c168-a04d-53d0-a4bc-85681041f8c4/scratchpad';
const b64 = n => fs.readFileSync(`${S}/b64/${n}.txt`, 'utf8').trim();
const jpg = n => 'data:image/jpeg;base64,' + fs.readFileSync(`${S}/fx/${n}.jpg`).toString('base64');

const LOGO = b64('logo'), FOOT = b64('footer');
const EJ1 = b64('ej1'), EJ2 = b64('ej2'), EJ3 = b64('ej3');
const REC = ['rec1','rec2','rec3'].map(jpg);
const SALA_G = jpg('sala_gris'), SALA_F = jpg('sala_final');
const HAB_G = jpg('hab_gris'), HAB_F = jpg('hab_final');

const foot = `<div class="foot"><img src="${FOOT}" alt="Condiciones de pago y contacto Decostone"></div>`;
const head = (title, sub, h = '34mm', fs2 = '20px') => `
  <div class="head">
    <img class="logo" src="${LOGO}" alt="Decostone" style="height:${h}">
    <div class="ribbon"><div class="band" style="font-size:${fs2}">${title}<small>${sub}</small></div></div>
  </div>`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Cotización Decostone — Sr. Leonardo Arias</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
:root { --black:#0D0D0D; --lime:#A4C424; --lime-soft:#EFF5D8; --text:#1A1A1A; --dim:#555; --border:#E2E2DC; }
* { box-sizing:border-box; margin:0; padding:0; }
@page { size: A4; margin: 0; }
body { font-family:'Montserrat','Segoe UI',sans-serif; color:var(--text); background:#fff; font-size:12.5px; line-height:1.5; }
.page { width:210mm; height:296mm; overflow:hidden; page-break-after:always; position:relative; background:#fff; display:flex; flex-direction:column; }
.page:last-child { page-break-after:auto; }

.head { background:var(--black); display:flex; align-items:stretch; }
.head img.logo { display:block; }
.head .ribbon { flex:1; display:flex; align-items:center; margin:6mm 0 8mm; }
.head .ribbon .band { background:var(--lime); color:var(--black); font-weight:800;
  letter-spacing:0.04em; padding:5mm 10mm 5mm 8mm; width:100%; text-transform:uppercase; }
.head .ribbon .band small { display:block; font-size:10px; font-weight:700; letter-spacing:0.14em; color:rgba(13,13,13,0.65); }

.body { padding:8mm 13mm 10mm; flex:1; }

.meta { display:flex; flex-wrap:wrap; gap:4mm 9mm; border:2px solid var(--black); border-radius:4px;
  padding:4mm 6mm; margin-bottom:6mm; }
.meta div { min-width:32mm; }
.meta .k { font-size:8.5px; text-transform:uppercase; letter-spacing:0.12em; color:var(--dim); font-weight:800; }
.meta .v { font-size:12.5px; font-weight:800; }

.svc { border:1.5px solid var(--border); border-left:5px solid var(--black); border-radius:4px;
  padding:4mm 6mm; margin-bottom:4mm; display:flex; gap:6mm; align-items:flex-start; page-break-inside:avoid; }
.svc .num { width:9mm; height:9mm; background:var(--black); color:var(--lime); flex-shrink:0;
  display:grid; place-items:center; font-weight:800; font-size:13px; }
.svc h3 { font-size:13.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.02em; }
.svc .inc { margin:2mm 0 0 4mm; color:var(--dim); font-size:11.5px; }
.svc .inc li { margin:1mm 0; }
.svc .price-col { margin-left:auto; text-align:right; flex-shrink:0; }
.svc .price { font-size:19px; font-weight:800; color:var(--black); white-space:nowrap;
  border-bottom:3.5px solid var(--lime); display:inline-block; }
.svc .pay { font-size:9px; color:var(--dim); max-width:34mm; margin-top:1.5mm; }
.svc.star { border-left-color:var(--lime); background:var(--lime-soft); border-color:var(--lime); }
.svc.star .num { background:var(--lime); color:var(--black); }
.svc .badge { display:inline-block; background:var(--black); color:var(--lime); font-size:8.5px; font-weight:800;
  letter-spacing:0.1em; padding:1mm 3mm; text-transform:uppercase; margin-bottom:1.5mm; }

.sub { display:flex; align-items:baseline; justify-content:flex-end; gap:5mm;
  border-top:2px solid var(--black); padding-top:2.5mm; margin-bottom:4mm; }
.sub .lbl { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.12em; color:var(--dim); }
.sub .val { font-size:17px; font-weight:800; }

.pack { background:var(--black); color:#fff; border-radius:4px; padding:5mm 6mm; margin-bottom:4mm; page-break-inside:avoid; }
.pack-head { display:flex; gap:6mm; align-items:center; }
.pack-badge { display:inline-block; background:var(--lime); color:var(--black); font-size:9.5px; font-weight:800;
  letter-spacing:0.1em; padding:1mm 3mm; text-transform:uppercase; margin-bottom:1.5mm; }
.pack-title { font-size:15px; font-weight:800; text-transform:uppercase; letter-spacing:0.02em; }
.pack-inc { font-size:10.5px; color:rgba(255,255,255,0.75); margin-top:1mm; }
.pack-price { margin-left:auto; text-align:right; flex-shrink:0; }
.pack-price .was { font-size:12px; color:rgba(255,255,255,0.55); text-decoration:line-through; }
.pack-price .now { font-size:26px; font-weight:800; color:var(--lime); line-height:1.1; }
.pack-price .save { font-size:10px; font-weight:800; color:var(--black); background:var(--lime);
  text-transform:uppercase; letter-spacing:0.06em; padding:0.8mm 2.5mm; display:inline-block; margin-top:1mm; }
.pack-foot { display:flex; flex-wrap:wrap; gap:2mm 8mm; border-top:1px solid rgba(255,255,255,0.2);
  margin-top:3mm; padding-top:2.5mm; font-size:9.5px; color:rgba(255,255,255,0.75); }
.pack-foot strong { color:var(--lime); }

.terms { border:1.5px dashed var(--border); border-radius:4px; padding:3.5mm 5mm; font-size:10.5px; color:var(--dim); }
.terms strong { color:var(--text); }

.foot { margin-top:auto; padding:0 8mm 6mm; }
.foot img { width:100%; display:block; }

.sec-title { font-size:16px; font-weight:800; text-transform:uppercase; letter-spacing:0.03em;
  border-left:6px solid var(--lime); padding-left:4mm; margin-bottom:5mm; }
.exp-grid { display:grid; grid-template-columns:1fr 1fr; gap:4mm; margin-bottom:5mm; }
.exp { border:1.5px solid var(--border); border-top:4px solid var(--lime); border-radius:4px; padding:4mm 5mm; page-break-inside:avoid; }
.exp .ico { font-size:17px; }
.exp h4 { font-size:12px; font-weight:800; margin:1mm 0; text-transform:uppercase; }
.exp p { font-size:10.5px; color:var(--dim); }
.example-card { border:2px solid var(--black); border-radius:4px; overflow:hidden;
  display:flex; justify-content:center; background:#fff; }
.example-card img { max-width:100%; max-height:225mm; width:auto; height:auto; display:block; }

/* ---- fotogramas de video ---- */
.lead { font-size:11.5px; color:var(--dim); margin-bottom:5mm; }
.lead strong { color:var(--text); }
.strip { display:grid; grid-template-columns:1fr 1fr 1fr; gap:4mm; }
.shot { border:1.5px solid var(--border); border-radius:4px; overflow:hidden; background:var(--black); position:relative; }
.shot img { width:100%; display:block; }
.shot .tag { position:absolute; left:0; bottom:0; background:rgba(13,13,13,0.88); color:var(--lime);
  font-size:8.5px; font-weight:800; letter-spacing:0.1em; padding:1.2mm 3mm; text-transform:uppercase; }
.stamp { display:inline-flex; align-items:center; gap:2mm; background:var(--black); color:var(--lime);
  font-size:9px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; padding:1.5mm 4mm; margin-bottom:4mm; }

.ba { display:grid; grid-template-columns:1fr 1fr; gap:3mm; margin-bottom:5mm; }
.ba .cap { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2mm; }
.ba .cap.gris { color:var(--dim); }
.ba .cap.fin  { color:var(--black); }
.ba .cap span { display:inline-block; width:4mm; height:4mm; margin-right:2mm; vertical-align:-0.5mm; }
.ba .cap.gris span { background:#B9B9B0; }
.ba .cap.fin  span { background:var(--lime); }
.ba figure { border:1.5px solid var(--border); border-radius:4px; overflow:hidden; }
.ba.hi figure { border-color:var(--lime); border-width:2px; }
.ba img { width:100%; display:block; }
.specs { display:grid; grid-template-columns:repeat(4,1fr); gap:3mm; margin-top:5mm; }
.spec { border:1.5px solid var(--border); border-top:4px solid var(--lime); border-radius:4px; padding:3.5mm 4mm; text-align:center; }
.spec .n { font-size:15px; font-weight:800; color:var(--black); }
.spec .l { font-size:8.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; color:var(--dim); margin-top:1mm; }
.rowtitle { font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em;
  border-left:4px solid var(--lime); padding-left:3mm; margin-bottom:3mm; }
</style></head><body>

<!-- PÁGINA 1 · SERVICIOS -->
<div class="page">
  ${head('Cotización', 'Proyecto arquitectónico · Vivienda 455 m²')}
  <div class="body">
    <div class="meta">
      <div><div class="k">Fecha</div><div class="v">29/08/2026</div></div>
      <div><div class="k">Nombre</div><div class="v">Sr. Leonardo Arias</div></div>
      <div><div class="k">Dirección</div><div class="v">La Fría</div></div>
      <div><div class="k">Validez</div><div class="v">30 días</div></div>
    </div>

    <div class="svc">
      <div class="num">1</div>
      <div>
        <h3>Planimetría 2D (455 m²)</h3>
        <ul class="inc">
          <li>Planos arquitectónicos: distribución, fachada, cortes y planta techo</li>
          <li>Planos de ingeniería civil: estructura, aguas blancas, aguas negras y pluviales</li>
          <li>Planos de ingeniería eléctrica e internet</li>
        </ul>
      </div>
      <div class="price-col"><div class="price">$1.500</div><div class="pay">70% para iniciar · 30% al entregar</div></div>
    </div>

    <div class="svc">
      <div class="num">2</div>
      <div>
        <h3>Volumetría 3D sin texturas</h3>
        <ul class="inc"><li>Volumetría en 3D completa de la vivienda</li></ul>
      </div>
      <div class="price-col"><div class="price">$500</div><div class="pay">70% para iniciar · 30% al entregar</div></div>
    </div>

    <div class="svc star">
      <div class="num">3</div>
      <div>
        <span class="badge">★ Nuevo · Exclusivo Decostone</span>
        <h3>Volumetría 3D con texturas + Experiencia Inmersiva 3D</h3>
        <ul class="inc">
          <li>3 renders fotorrealistas de cada área con detalles decorativos</li>
          <li><strong>Video recorrido</strong> en calidad cinematográfica con sonido ambiente</li>
          <li><strong>Tour virtual 360°</strong>: recorra su casa desde el teléfono, ambiente por ambiente</li>
          <li><strong>La vista real</strong>: desde su balcón y ventanas se ve su entorno verdadero</li>
          <li>Entrega en un enlace privado, listo para ver y compartir desde cualquier teléfono</li>
        </ul>
      </div>
      <div class="price-col"><div class="price">$1.200</div><div class="pay">70% para iniciar · 30% al entregar</div></div>
    </div>

    <div class="sub"><div class="lbl">Suma de los servicios por separado</div><div class="val">$3.200</div></div>

    <div class="pack">
      <div class="pack-head">
        <div>
          <div class="pack-badge">🏆 Paquete Completo</div>
          <div class="pack-title">De los planos a caminar por su casa</div>
          <div class="pack-inc">Servicios 1 + 2 + 3 contratados en conjunto</div>
        </div>
        <div class="pack-price">
          <div class="was">$3.200</div>
          <div class="now">$2.700</div>
          <div class="save">Descuento $500</div>
        </div>
      </div>
      <div class="pack-foot">
        <span><strong>Bono:</strong> 1 ronda adicional de modificaciones y enlace del tour activo por 12 meses</span>
        <span><strong>Pago:</strong> 50% al iniciar · 30% al entregar volumetría · 20% a la entrega final</span>
      </div>
    </div>

    <div class="terms">
      <strong>Nota:</strong> máximo 3 modificaciones por servicio. Los servicios pueden contratarse por
      separado o en conjunto; el descuento de $500 aplica únicamente al Paquete Completo.
      Cotización válida por 30 días calendario.
    </div>
  </div>
  ${foot}
</div>

<!-- PÁGINA 2 · VIDEO RECORRIDO (fotogramas reales) -->
<div class="page">
  ${head('Así se verá el video de su casa', 'Fotogramas reales de un recorrido entregado', '26mm', '15px')}
  <div class="body" style="padding-left:9mm; padding-right:9mm">
    <div class="stamp">▶ Fotogramas tomados de un video real, sin retoque</div>
    <p class="lead">Estas tres imágenes son <strong>cuadros congelados de un video recorrido</strong> que ya entregamos.
      La cámara entra por la puerta principal y avanza hacia la sala: cada reflejo del piso, cada sombra y cada
      textura se calculan con calidad fotográfica. <strong>Su video se verá exactamente con este nivel de realismo</strong>,
      con movimiento suave y sonido ambiente.</p>
    <div class="strip">
      <div class="shot"><img src="${REC[0]}" alt="Fotograma 1"><div class="tag">00:00 · Acceso</div></div>
      <div class="shot"><img src="${REC[1]}" alt="Fotograma 2"><div class="tag">00:02 · Entrada</div></div>
      <div class="shot"><img src="${REC[2]}" alt="Fotograma 3"><div class="tag">00:04 · Sala</div></div>
    </div>
    <div class="specs">
      <div class="spec"><div class="n">4K</div><div class="l">Resolución</div></div>
      <div class="spec"><div class="n">Vertical</div><div class="l">Formato teléfono</div></div>
      <div class="spec"><div class="n">Con sonido</div><div class="l">Ambiente real</div></div>
      <div class="spec"><div class="n">Enlace</div><div class="l">Listo para WhatsApp</div></div>
    </div>
    <div class="terms" style="margin-top:5mm; background:var(--lime-soft); border-style:solid; border-color:var(--lime)">
      <strong>Nota importante:</strong> el video es vertical, pensado para verse a pantalla completa desde el teléfono
      y para compartirlo por WhatsApp con su familia. Va incluido en el servicio 3, junto con el tour 360°
      y los renders — todo por <strong>$1.200</strong>.
    </div>
  </div>
  ${foot}
</div>

<!-- PÁGINA 3 · ANTES Y DESPUÉS -->
<div class="page">
  ${head('De la obra gris a su casa terminada', 'El mismo espacio, el mismo ángulo', '26mm', '15px')}
  <div class="body">
    <p class="lead">Así trabajamos: partimos del <strong>espacio real de su obra</strong> y lo entregamos terminado,
      respetando las medidas, ventanas y ángulos exactos. Nada se inventa — lo que usted ve a la derecha
      es su mismo espacio, amueblado y con acabados.</p>

    <div class="rowtitle">Sala · Comedor · Cocina</div>
    <div class="ba hi">
      <div>
        <div class="cap gris"><span></span>Obra gris — hoy</div>
        <figure><img src="${SALA_G}" alt="Sala en obra gris"></figure>
      </div>
      <div>
        <div class="cap fin"><span></span>Render Decostone — así quedará</div>
        <figure><img src="${SALA_F}" alt="Sala terminada"></figure>
      </div>
    </div>

    <div class="rowtitle">Habitación principal</div>
    <div class="ba hi">
      <div>
        <div class="cap gris"><span></span>Obra gris — hoy</div>
        <figure><img src="${HAB_G}" alt="Habitación en obra gris"></figure>
      </div>
      <div>
        <div class="cap fin"><span></span>Render Decostone — así quedará</div>
        <figure><img src="${HAB_F}" alt="Habitación terminada"></figure>
      </div>
    </div>

    <div class="terms" style="background:var(--lime-soft); border-style:solid; border-color:var(--lime)">
      <strong>Fíjese en la ventana de la habitación:</strong> en el render se ve la misma construcción vecina
      y la misma montaña que hay hoy en su terreno. No es una imagen genérica de catálogo — es
      <strong>su espacio, con su vista real</strong>.
    </div>
  </div>
  ${foot}
</div>

<!-- PÁGINA 4 · EXPERIENCIA INMERSIVA -->
<div class="page">
  ${head('Qué incluye la Experiencia Inmersiva 3D', 'Va dentro del servicio 3, sin costo adicional', '26mm', '15px')}
  <div class="body">
    <div class="exp-grid">
      <div class="exp"><div class="ico">🏠</div><h4>Recorrido ambiente por ambiente</h4>
        <p>Desde su teléfono, usted "entra" a su sala, cocina y habitaciones. Gira el teléfono y ve todo alrededor en 360°, con acabados y decoración fotorrealista.</p></div>
      <div class="exp"><div class="ico">🎬</div><h4>Video recorrido cinematográfico</h4>
        <p>Un video con movimiento de cámara profesional y sonido ambiente que recorre su vivienda terminada — ideal para compartir con su familia.</p></div>
      <div class="exp"><div class="ico">🌅</div><h4>Su vista real, integrada</h4>
        <p>Fotografiamos el entorno real de su terreno: al asomarse al balcón del tour, usted ve su propia calle y su paisaje verdadero.</p></div>
      <div class="exp"><div class="ico">📱</div><h4>Un enlace privado, sin instalar nada</h4>
        <p>Todo se entrega en un enlace con su nombre que abre en cualquier teléfono o computadora. Su proyecto, siempre a la mano.</p></div>
      <div class="exp"><div class="ico">🎨</div><h4>Decida los acabados viéndolos</h4>
        <p>¿Piso más claro? ¿Cocina en otro tono? Vea variantes de materiales y colores sobre su propio diseño antes de comprar un solo material.</p></div>
      <div class="exp"><div class="ico">📐</div><h4>Fiel a su proyecto</h4>
        <p>Cada imagen parte del modelo real de su vivienda: las medidas, ventanas y espacios son los de sus planos, no una ilustración genérica.</p></div>
    </div>
    <div class="terms" style="background:var(--lime-soft); border-style:solid; border-color:var(--lime)">
      La Experiencia Inmersiva 3D <strong>ya viene incluida</strong> en la Volumetría 3D con texturas: es un solo
      servicio de <strong>$1.200</strong>. Con el <strong>Paquete Completo por $2.700</strong> usted pasa del terreno vacío a
      caminar virtualmente por su casa terminada — planos, modelo 3D, renders, video y tour 360°, todo en un solo proyecto.
    </div>
  </div>
  ${foot}
</div>

<!-- EJEMPLOS -->
<div class="page"><div class="body" style="padding-top:10mm">
  <div class="sec-title">Ejemplo de trabajo — Planimetría 2D</div>
  <div class="example-card"><img src="${EJ1}" alt="Ejemplo planimetría 2D"></div>
</div>${foot}</div>

<div class="page"><div class="body" style="padding-top:10mm">
  <div class="sec-title">Ejemplo de trabajo — Volumetría 3D</div>
  <div class="example-card"><img src="${EJ2}" alt="Ejemplo volumetría 3D"></div>
</div>${foot}</div>

<div class="page"><div class="body" style="padding-top:10mm">
  <div class="sec-title">Ejemplo de trabajo — Volumetría 3D con texturas</div>
  <div class="example-card"><img src="${EJ3}" alt="Ejemplo volumetría con texturas"></div>
</div>${foot}</div>

</body></html>`;

fs.writeFileSync(`${S}/cotizacion-arias.html`, html);
console.log('OK', (html.length / 1e6).toFixed(2), 'MB');
