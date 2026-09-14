/**
 * Reglas duras que no dependen del modelo. Funciones puras: reciben estado y
 * devuelven decisiones; no tocan red ni disco.
 */

const HORA_MS = 60 * 60 * 1000;

/** Decide qué hacer con un evento entrante antes de llamar al modelo. */
export function evaluarEntrada({ conv, evento, config, ahora = Date.now(), esNuestro = false }) {
  if (evento.tipo === 'eco') {
    if (esNuestro || (config.appId && evento.appId && evento.appId === config.appId)) {
      return { accion: 'ignorar', razon: 'eco de un mensaje del agente' };
    }
    // Alguien respondió desde la bandeja de la Página: el humano tomó el hilo.
    return { accion: 'pausar', razon: 'el vendedor respondió a mano', hastaMs: ahora + config.pausaTrasHumanoMin * 60 * 1000 };
  }
  if (evento.tipo === 'otro' || evento.tipo === 'referral') {
    return { accion: 'ignorar', razon: `evento ${evento.tipo}` };
  }
  if (!evento.texto && !(evento.adjuntos?.length)) {
    return { accion: 'ignorar', razon: 'mensaje sin texto ni adjuntos' };
  }
  const modo = conv.modo ?? config.modo;
  if (modo === 'humano') {
    return { accion: 'registrar', razon: 'conversación en modo humano' };
  }
  if (conv.pausadoHasta && conv.pausadoHasta > ahora) {
    return { accion: 'registrar', razon: `bot pausado hasta ${new Date(conv.pausadoHasta).toISOString()}` };
  }
  const recientes = (conv.respuestasRecientes ?? []).filter((ts) => ahora - ts < HORA_MS);
  if (recientes.length >= config.maxRespuestasPorHora) {
    return { accion: 'derivar', razon: `límite de ${config.maxRespuestasPorHora} respuestas por hora alcanzado` };
  }
  return { accion: 'procesar', razon: 'mensaje del comprador' };
}

/** Busca el artículo del que habla el comprador. Devuelve null si no es claro. */
export function detectarArticulo({ texto = '', inventario, referral = null }) {
  if (referral?.productoId) {
    const porId = inventario.find((a) => a.id === referral.productoId || a.meta_id === referral.productoId);
    if (porId) return porId;
  }
  if (referral?.titulo) {
    const porTitulo = inventario.find((a) => normalizar(a.titulo) === normalizar(referral.titulo));
    if (porTitulo) return porTitulo;
  }
  const t = normalizar(texto);
  if (!t) return null;
  let mejor = null;
  let mejorPuntos = 0;
  for (const art of inventario) {
    const claves = [...(art.palabras_clave ?? []), ...normalizar(art.titulo).split(/\s+/)].map(normalizar).filter((c) => c.length > 2);
    const puntos = claves.filter((c) => t.includes(c)).length;
    if (puntos > mejorPuntos) {
      mejorPuntos = puntos;
      mejor = art;
    } else if (puntos === mejorPuntos && puntos > 0) {
      mejor = null; // empate: no adivinar
    }
  }
  return mejorPuntos >= 1 ? mejor : null;
}

export function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mencionaNumero(texto, n) {
  if (typeof n !== 'number') return false;
  const patron = new RegExp(`(^|[^0-9.,])${String(n).replace('.', '[.,]')}([^0-9]|$)`);
  return patron.test(texto);
}

/**
 * Valida y corrige la salida del modelo contra las reglas del negocio.
 * Devuelve una salida segura para enviar o convertir en borrador.
 */
export function validarSalida({ salida, articulo, config }) {
  const resultado = {
    accion: salida?.accion ?? 'derivar',
    respuesta: (salida?.respuesta ?? '').trim(),
    articulo_id: salida?.articulo_id ?? articulo?.id ?? null,
    motivo: salida?.motivo ?? 'sin motivo',
    precio_ofrecido: salida?.precio_ofrecido ?? null,
    precio_comprometido: salida?.precio_comprometido ?? null,
    correcciones: [],
  };
  if (!['responder', 'derivar', 'ignorar'].includes(resultado.accion)) {
    resultado.accion = 'derivar';
    resultado.correcciones.push('acción desconocida');
  }
  const art = articulo ?? (resultado.articulo_id ? config.inventario.find((a) => a.id === resultado.articulo_id) : null);
  const minimo = typeof art?.precio_minimo === 'number' ? art.precio_minimo : art?.precio;

  if (resultado.accion === 'responder') {
    if (!resultado.respuesta) {
      resultado.accion = 'ignorar';
      resultado.correcciones.push('respuesta vacía');
    }
    if (art && typeof resultado.precio_comprometido === 'number' && resultado.precio_comprometido < minimo) {
      resultado.accion = 'derivar';
      resultado.correcciones.push(`el modelo aceptó ${resultado.precio_comprometido} por debajo del mínimo ${minimo}`);
    }
    if (art && typeof art.precio_minimo === 'number' && art.precio_minimo !== art.precio && mencionaNumero(resultado.respuesta, art.precio_minimo)) {
      resultado.accion = 'derivar';
      resultado.correcciones.push('la respuesta menciona el precio mínimo');
    }
    if (art?.estado === 'vendido' && /\b(disponible|s[ií] est[aá]|todav[ií]a lo tengo)\b/i.test(resultado.respuesta) && !/\bno\b/i.test(resultado.respuesta)) {
      resultado.accion = 'derivar';
      resultado.correcciones.push('afirma disponibilidad de un artículo vendido');
    }
  }
  if (resultado.respuesta.length > 1900) {
    resultado.respuesta = `${resultado.respuesta.slice(0, 1897)}...`;
    resultado.correcciones.push('respuesta recortada a 1900 caracteres');
  }
  return resultado;
}

/** Separa un texto en trozos que Messenger acepta (máximo 2000 caracteres). */
export function trocear(texto, max = 1900) {
  const partes = [];
  let resto = String(texto ?? '');
  while (resto.length > max) {
    let corte = resto.lastIndexOf('\n', max);
    if (corte < max / 2) corte = resto.lastIndexOf(' ', max);
    if (corte < max / 2) corte = max;
    partes.push(resto.slice(0, corte).trimEnd());
    resto = resto.slice(corte).trimStart();
  }
  if (resto) partes.push(resto);
  return partes;
}
