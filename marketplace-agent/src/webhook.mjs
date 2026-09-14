import crypto from 'node:crypto';

/**
 * Verifica la cabecera X-Hub-Signature-256 que Meta envía con cada POST.
 * `rawBody` debe ser el cuerpo exacto recibido (Buffer o string), sin re-serializar.
 */
export function firmaValida(rawBody, cabecera, appSecret) {
  if (!appSecret || typeof cabecera !== 'string' || !cabecera.startsWith('sha256=')) return false;
  const esperado = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const recibido = cabecera.slice('sha256='.length).toLowerCase();
  if (!/^[0-9a-f]+$/.test(recibido) || recibido.length !== esperado.length) return false;
  return crypto.timingSafeEqual(Buffer.from(recibido, 'hex'), Buffer.from(esperado, 'hex'));
}

/** Responde al reto de verificación del webhook (GET /webhook). */
export function responderVerificacion(query, verifyToken) {
  const modo = query.get('hub.mode');
  const token = query.get('hub.verify_token');
  const reto = query.get('hub.challenge');
  if (modo === 'subscribe' && verifyToken && token === verifyToken && reto != null) {
    return { ok: true, reto };
  }
  return { ok: false };
}

function normalizarReferral(ref) {
  if (!ref || typeof ref !== 'object') return null;
  return {
    origen: ref.source ?? null,
    tipo: ref.type ?? null,
    ref: ref.ref ?? null,
    productoId: ref.product?.id ?? null,
    anuncioId: ref.ad_id ?? null,
    titulo: ref.product?.title ?? ref.title ?? null,
    crudo: ref,
  };
}

/**
 * Convierte el cuerpo del webhook de Meta en una lista de eventos planos.
 * Tolera campos ausentes: Meta cambia el payload con el tiempo y un evento
 * desconocido no debe tumbar el servidor.
 */
export function extraerEventos(body) {
  const eventos = [];
  if (!body || body.object !== 'page' || !Array.isArray(body.entry)) return eventos;
  for (const entrada of body.entry) {
    const lista = Array.isArray(entrada?.messaging) ? entrada.messaging : [];
    for (const m of lista) {
      const evento = normalizarMessaging(m, entrada.id);
      if (evento) eventos.push(evento);
    }
  }
  return eventos;
}

function normalizarMessaging(m, pageIdEntrada) {
  if (!m || typeof m !== 'object') return null;
  const mensaje = m.message;
  const esEco = Boolean(mensaje?.is_echo);
  // En los ecos, el remitente es la Página y el destinatario es el comprador.
  const psid = esEco ? m.recipient?.id : m.sender?.id;
  const pageId = esEco ? m.sender?.id : (m.recipient?.id ?? pageIdEntrada);
  if (!psid) return null;

  const base = {
    psid: String(psid),
    pageId: pageId ? String(pageId) : null,
    timestamp: Number(m.timestamp) || Date.now(),
    referral: normalizarReferral(m.referral ?? mensaje?.referral ?? m.postback?.referral),
  };

  if (mensaje) {
    if (mensaje.is_deleted) return { ...base, tipo: 'otro', mid: mensaje.mid ?? null };
    const adjuntos = Array.isArray(mensaje.attachments)
      ? mensaje.attachments.map((a) => ({ tipo: a?.type ?? 'desconocido', url: a?.payload?.url ?? null, titulo: a?.title ?? null }))
      : [];
    return {
      ...base,
      tipo: esEco ? 'eco' : 'mensaje',
      mid: mensaje.mid ?? null,
      texto: typeof mensaje.text === 'string' ? mensaje.text : '',
      adjuntos,
      appId: mensaje.app_id != null ? String(mensaje.app_id) : null,
      quickReply: mensaje.quick_reply?.payload ?? null,
      esEco,
    };
  }
  if (m.postback) {
    return {
      ...base,
      tipo: 'postback',
      mid: m.postback.mid ?? null,
      texto: typeof m.postback.title === 'string' ? m.postback.title : '',
      payload: m.postback.payload ?? null,
      adjuntos: [],
      esEco: false,
    };
  }
  if (m.referral) {
    return { ...base, tipo: 'referral', mid: null, texto: '', adjuntos: [], esEco: false };
  }
  // read, delivery, reaction, etc.
  return { ...base, tipo: 'otro', mid: null };
}
