/** Vistas HTML del panel. Sin framework: el panel lo usa una sola persona desde el teléfono. */

export function escapar(texto) {
  return String(texto ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const ESTILOS = `
:root{color-scheme:light dark;--fondo:#f6f6f4;--tarjeta:#fff;--texto:#1d1d1b;--suave:#6b6b66;--borde:#e2e2dd;--acento:#1a73e8;--ok:#1e8e3e;--alerta:#c5221f;--pill:#eef1f4}
@media(prefers-color-scheme:dark){:root{--fondo:#141414;--tarjeta:#1f1f1f;--texto:#ececea;--suave:#a0a09a;--borde:#333;--acento:#8ab4f8;--ok:#81c995;--alerta:#f28b82;--pill:#2a2a2a}}
*{box-sizing:border-box}body{margin:0;background:var(--fondo);color:var(--texto);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:16px}h1{font-size:20px;margin:8px 0 12px}h2{font-size:16px;margin:20px 0 8px}
a{color:var(--acento);text-decoration:none}.tarjeta{background:var(--tarjeta);border:1px solid var(--borde);border-radius:12px;padding:14px;margin:10px 0}
.fila{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.suave{color:var(--suave);font-size:13px}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;background:var(--pill);font-size:12px}.pill.ok{color:var(--ok)}.pill.alerta{color:var(--alerta)}
.burbuja{max-width:85%;padding:9px 12px;border-radius:14px;margin:6px 0;white-space:pre-wrap;word-break:break-word}
.comprador{background:var(--pill);margin-right:auto}.vendedor{background:var(--acento);color:#fff;margin-left:auto}
.origen{font-size:11px;opacity:.75;display:block;margin-top:3px}
textarea,input[type=text],input[type=password]{width:100%;padding:10px;border:1px solid var(--borde);border-radius:8px;background:var(--fondo);color:var(--texto);font:inherit}
textarea{min-height:90px}button{padding:9px 14px;border-radius:8px;border:1px solid var(--borde);background:var(--tarjeta);color:var(--texto);font:inherit;cursor:pointer}
button.primario{background:var(--acento);color:#fff;border-color:var(--acento)}button.peligro{color:var(--alerta)}
form.inline{display:inline}.borrador{border-left:4px solid var(--acento)}.aviso{border-left:4px solid var(--alerta)}
nav{display:flex;gap:14px;margin-bottom:12px;font-size:14px}
`;

export function layout(titulo, cuerpo) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(titulo)}</title><style>${ESTILOS}</style></head><body><main><nav><a href="/">Conversaciones</a><a href="/copiloto">Copiloto</a><a href="/api/health">Estado</a></nav>${cuerpo}</main></body></html>`;
}

function fecha(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
}

function etiquetaModo(conv, config, ahora = Date.now()) {
  const modo = conv.modo ?? config.modo;
  if (modo === 'humano') return '<span class="pill alerta">manual</span>';
  if (conv.pausadoHasta && conv.pausadoHasta > ahora) return `<span class="pill alerta">pausado hasta ${escapar(fecha(conv.pausadoHasta))}</span>`;
  return modo === 'auto' ? '<span class="pill ok">automático</span>' : '<span class="pill">borradores</span>';
}

export function vistaLista({ conversaciones, config, simulado }) {
  const items = conversaciones.map((c) => {
    const ultimo = c.mensajes[c.mensajes.length - 1];
    const art = c.articuloId ? config.inventario.find((a) => a.id === c.articuloId) : null;
    return `<a class="tarjeta" style="display:block" href="/c/${encodeURIComponent(c.psid)}">
      <div class="fila"><strong>${escapar(c.nombre ?? `Comprador ${c.psid.slice(-6)}`)}</strong> ${etiquetaModo(c, config)} ${c.borradores.length ? `<span class="pill alerta">${c.borradores.length} borrador${c.borradores.length > 1 ? 'es' : ''}</span>` : ''}</div>
      <div class="suave">${art ? escapar(art.titulo) + ' · ' : ''}${escapar(fecha(c.actualizado))}</div>
      <div>${escapar(ultimo?.texto ?? '').slice(0, 140)}</div>
    </a>`;
  });
  const simular = simulado
    ? `<div class="tarjeta"><h2>Simular un comprador (modo local, sin Meta)</h2><form method="post" action="/simular"><div class="fila"><input type="text" name="psid" placeholder="id del comprador de prueba" value="prueba-1" style="max-width:220px"><input type="text" name="texto" placeholder="Hola, ¿sigue disponible?" required></div><p><button class="primario">Enviar como comprador</button></p></form></div>`
    : '';
  return layout('Marketplace · Conversaciones', `<h1>Conversaciones</h1>
    <p class="suave">Modo global: <strong>${config.modo === 'auto' ? 'automático' : 'borradores (tú apruebas cada respuesta)'}</strong> · Modelo: ${escapar(config.modelo)}${simulado ? ' · <strong>Messenger simulado</strong> (sin PAGE_ACCESS_TOKEN)' : ''}</p>
    ${simular}
    ${items.join('') || '<p class="suave">Todavía no hay conversaciones. Cuando un comprador escriba a la Página, aparecerá aquí.</p>'}`);
}

export function vistaConversacion({ conv, config, mensaje = null, error = null }) {
  const art = conv.articuloId ? config.inventario.find((a) => a.id === conv.articuloId) : null;
  const psid = encodeURIComponent(conv.psid);
  const historial = conv.mensajes.map((m) => `<div class="burbuja ${m.rol === 'vendedor' ? 'vendedor' : 'comprador'}">${escapar(m.texto || '[sin texto]')}${(m.adjuntos ?? []).map((a) => `<br><em>[adjunto ${escapar(a.tipo)}]</em>`).join('')}<span class="origen">${m.rol === 'vendedor' ? (m.origen === 'agente' ? 'agente' : 'tú') : 'comprador'} · ${escapar(fecha(m.ts))}</span></div>`).join('');
  const borradores = conv.borradores.map((b) => `<div class="tarjeta borrador"><div class="suave">Borrador ${b.accion === 'derivar' ? '(el agente sugiere que intervengas)' : ''} · ${escapar(fecha(b.ts))}<br>Motivo: ${escapar(b.motivo)}</div>
    <form method="post" action="/c/${psid}/enviar"><input type="hidden" name="borrador" value="${escapar(b.id)}"><textarea name="texto">${escapar(b.texto)}</textarea><p class="fila"><button class="primario">Enviar</button></p></form>
    <form method="post" action="/c/${psid}/descartar" class="inline"><input type="hidden" name="borrador" value="${escapar(b.id)}"><button class="peligro">Descartar</button></form></div>`).join('');
  const alertas = conv.alertas.slice(-5).reverse().map((a) => `<div class="suave">${escapar(fecha(a.ts))} · ${escapar(a.motivo)}</div>`).join('');
  return layout(`Conversación · ${conv.nombre ?? conv.psid}`, `<h1>${escapar(conv.nombre ?? `Comprador ${conv.psid.slice(-6)}`)} ${etiquetaModo(conv, config)}</h1>
    <p class="suave">PSID ${escapar(conv.psid)}${art ? ` · Artículo: <strong>${escapar(art.titulo)}</strong> (${art.precio} ${escapar(config.negocio.moneda ?? '')}, ${escapar(art.estado ?? 'disponible')})` : ' · Artículo sin identificar'}</p>
    ${mensaje ? `<div class="tarjeta" style="border-color:var(--ok)">${escapar(mensaje)}</div>` : ''}
    ${error ? `<div class="tarjeta aviso">${escapar(error)}</div>` : ''}
    <div class="fila">
      <form method="post" action="/c/${psid}/modo" class="inline"><input type="hidden" name="modo" value="humano"><button>Tomar el chat (silenciar bot)</button></form>
      <form method="post" action="/c/${psid}/modo" class="inline"><input type="hidden" name="modo" value="reanudar"><button>Reanudar bot</button></form>
      <form method="post" action="/c/${psid}/modo" class="inline"><input type="hidden" name="modo" value="auto"><button>Automático solo aquí</button></form>
    </div>
    ${borradores ? `<h2>Borradores pendientes</h2>${borradores}` : ''}
    <h2>Historial</h2><div class="tarjeta">${historial || '<span class="suave">sin mensajes</span>'}</div>
    <h2>Responder tú</h2><div class="tarjeta"><form method="post" action="/c/${psid}/manual"><textarea name="texto" placeholder="Escribe como vendedor..."></textarea><p><button class="primario">Enviar por Messenger</button></p></form></div>
    ${alertas ? `<h2>Últimas alertas</h2><div class="tarjeta">${alertas}</div>` : ''}`);
}

export function vistaCopiloto({ hilo = '', resultado = null, error = null }) {
  const salida = resultado
    ? `<div class="tarjeta borrador"><div class="suave">Acción: <strong>${escapar(resultado.accion)}</strong> · ${escapar(resultado.motivo)}${resultado.correcciones?.length ? ` · reglas: ${escapar(resultado.correcciones.join('; '))}` : ''}</div>
       <textarea id="respuesta" readonly>${escapar(resultado.respuesta)}</textarea>
       <p><button type="button" onclick="navigator.clipboard.writeText(document.getElementById('respuesta').value).then(()=>{this.textContent='Copiado'})">Copiar respuesta</button></p></div>`
    : '';
  return layout('Copiloto', `<h1>Copiloto</h1>
    <p class="suave">Pega aquí lo que te escribió el comprador (una línea por mensaje). Si quieres incluir lo que ya respondiste, empieza la línea con <code>yo:</code>. No se guarda nada ni se envía nada: es para usarlo con cualquier chat, incluso el de tu perfil personal.</p>
    ${error ? `<div class="tarjeta aviso">${escapar(error)}</div>` : ''}
    <form method="post" action="/copiloto"><textarea name="hilo" placeholder="Hola, ¿sigue disponible el iPhone?&#10;yo: Sí, disponible&#10;¿Me lo dejas en 200?">${escapar(hilo)}</textarea><p><button class="primario">Redactar respuesta</button></p></form>
    ${salida}`);
}
