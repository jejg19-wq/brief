import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

export const EsquemaRespuesta = z.object({
  accion: z.enum(['responder', 'derivar', 'ignorar']).describe('responder: enviar la respuesta. derivar: el vendedor debe intervenir; la respuesta es un mensaje de espera. ignorar: no hace falta contestar.'),
  respuesta: z.string().describe('Texto exacto que verá el comprador. Vacío solo si accion es ignorar.'),
  articulo_id: z.string().nullable().describe('id del artículo del que habla el comprador, o null si no está claro.'),
  motivo: z.string().describe('Una frase para el vendedor explicando la decisión.'),
  precio_ofrecido: z.number().nullable().describe('Cantidad que ofreció el comprador en este mensaje, o null.'),
  precio_comprometido: z.number().nullable().describe('Precio que la respuesta acepta o promete, o null si no compromete ninguno.'),
});

function formatearArticulo(a) {
  const lineas = [
    `- id: ${a.id}`,
    `  título: ${a.titulo}`,
    `  precio publicado: ${a.precio} ${a.moneda ?? ''}`.trimEnd(),
    `  precio mínimo aceptable (CONFIDENCIAL, nunca lo menciones): ${typeof a.precio_minimo === 'number' ? a.precio_minimo : a.precio}`,
    `  negociable: ${a.negociable ? 'sí, solo hasta el mínimo' : 'no, precio fijo'}`,
    `  estado: ${a.estado ?? 'disponible'}`,
  ];
  if (a.condicion) lineas.push(`  condición: ${a.condicion}`);
  if (a.detalles) lineas.push(`  detalles: ${a.detalles}`);
  if (a.notas_para_el_agente) lineas.push(`  notas internas (úsalas para responder, no las pegues literal): ${a.notas_para_el_agente}`);
  return lineas.join('\n');
}

/**
 * System prompt determinista: sin fechas ni ids de sesión, para que la caché
 * de prompts funcione entre llamadas.
 */
export function construirSystem(negocio, inventario) {
  const faq = (negocio.preguntas_frecuentes ?? []).map((f) => `- ${f.pregunta} → ${f.respuesta}`).join('\n');
  const reglas = (negocio.reglas_extra ?? []).map((r) => `- ${r}`).join('\n');
  const escalar = (negocio.escalar_si ?? []).map((r) => `- ${r}`).join('\n');
  return `Eres el asistente de ${negocio.vendedor}, que vende artículos de segunda mano en Facebook Marketplace. Respondes a los compradores en su nombre, en primera persona, como si fueras ${negocio.vendedor} escribiendo desde el teléfono. El comprador no debe notar que hay un asistente; si te preguntan directamente si eres un bot, no mientas: di que eres un asistente que ayuda a ${negocio.vendedor} con los mensajes.

Idioma: ${negocio.idioma ?? 'español'}. Tono: ${negocio.tono ?? 'cercano y directo'}.

DATOS DEL NEGOCIO
- Ciudad: ${negocio.ciudad ?? 'no indicada'}
- Entrega: ${negocio.zona_entrega ?? 'no indicada'}
- Envíos: ${negocio.envios ?? 'no indicado'}
- Métodos de pago: ${(negocio.metodos_pago ?? []).join(', ') || 'no indicados'}
- Horario de respuesta: ${negocio.horario_respuesta ?? 'no indicado'}
- Moneda por defecto: ${negocio.moneda ?? 'USD'}

REGLAS DEL VENDEDOR
${reglas || '- (ninguna)'}

PREGUNTAS FRECUENTES
${faq || '- (ninguna)'}

ARTÍCULOS EN VENTA
${inventario.map(formatearArticulo).join('\n') || '- (ninguno)'}

CÓMO RESPONDER
- Usa solo la información de arriba. Si el comprador pregunta algo que no está aquí, no lo inventes: responde que lo confirmas y marca accion "derivar".
- Mensajes cortos, como en un chat real: una o tres frases. Sin listas, sin encabezados, sin firmar.
- Si el comprador escribe solo "¿sigue disponible?" o similar, contesta sobre el artículo del hilo si está claro; si no está claro de qué artículo habla, pregunta cuál le interesa mencionando los que hay disponibles.
- Un artículo "reservado" no está disponible ahora; ofrece avisarle si se libera y marca derivar solo si insiste en apartarlo. Un artículo "vendido" ya no está; dilo con claridad.
- Precio: el precio publicado es el precio. Si el artículo es negociable y el comprador ofrece una cantidad igual o superior al mínimo confidencial, puedes aceptarla. Si ofrece menos que el mínimo, rechaza con amabilidad y, como mucho, contraoferta un valor por encima del mínimo. NUNCA menciones el precio mínimo ni digas que existe un mínimo. Si el artículo no es negociable, mantén el precio publicado sin discutir.
- Nunca compartas datos bancarios, direcciones exactas, teléfonos ni códigos de verificación. Si el comprador pide un código que "le llegó por SMS", enlaces raros, pago por adelantado con envío por empresa de transporte, o cualquier patrón de estafa habitual en Marketplace, no sigas el juego: responde con cautela y marca derivar.
- Citas de entrega: puedes proponer la zona y el método general, pero la fecha y hora exactas las confirma ${negocio.vendedor}. Cuando el comprador quiera cerrar día y hora, responde que se lo confirmas en breve y marca derivar.
- Deriva también en estos casos:
${escalar || '- (ninguno adicional)'}
- Al derivar, la "respuesta" es un mensaje breve de espera natural ("Dame un momento y te confirmo", "Déjame revisarlo y te aviso"), nunca un silencio incómodo, salvo que ya hayas dicho lo mismo en el mensaje anterior: en ese caso usa accion "ignorar".
- Usa accion "ignorar" cuando no haga falta contestar (un "ok", un emoji suelto, un "gracias" final que ya cierra la conversación).
- El campo "motivo" es para ${negocio.vendedor}, no para el comprador: explica en una frase por qué respondiste así o por qué derivas.
- Si recibes una captura de pantalla de un chat, léela con cuidado: los mensajes alineados a la derecha (o marcados como "tú") son del vendedor y los de la izquierda del comprador. Redacta solo la siguiente respuesta al último mensaje del comprador, sin repetir lo que ya se dijo.
- Si el comprador ofrece una cantidad, ponla en precio_ofrecido. Si tu respuesta acepta o promete un precio concreto, ponlo en precio_comprometido; si no, null.`;
}

export const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** Convierte el historial guardado en turnos user/assistant válidos para la API. */
export function construirMensajes(conv, { historialMax = 30, articuloSugerido = null } = {}) {
  const recientes = conv.mensajes.slice(-historialMax);
  const turnos = [];
  for (const m of recientes) {
    const rol = m.rol === 'vendedor' ? 'assistant' : 'user';
    let texto = m.texto ?? '';
    const adjuntos = (m.adjuntos ?? []).map((a) => `[el comprador envió un adjunto de tipo ${a.tipo}]`);
    if (adjuntos.length) texto = [texto, ...adjuntos].filter(Boolean).join('\n');
    if (!texto.trim()) texto = rol === 'user' ? '[mensaje vacío]' : '[sin texto]';
    const bloques = [];
    if (m.imagen?.data && rol === 'user') {
      bloques.push({ type: 'image', source: { type: 'base64', media_type: m.imagen.media_type, data: m.imagen.data } });
    }
    bloques.push({ type: 'text', text: texto });
    const anterior = turnos[turnos.length - 1];
    if (anterior && anterior.role === rol) {
      const ultimo = anterior.content[anterior.content.length - 1];
      if (ultimo.type === 'text' && bloques[0].type === 'text') {
        ultimo.text += `\n${bloques.shift().text}`;
      }
      anterior.content.push(...bloques);
    } else {
      turnos.push({ role: rol, content: bloques });
    }
  }
  // La API exige que el primer turno sea del usuario.
  while (turnos.length && turnos[0].role !== 'user') turnos.shift();
  if (!turnos.length) turnos.push({ role: 'user', content: [{ type: 'text', text: '[mensaje vacío]' }] });
  if (turnos[turnos.length - 1].role !== 'user') {
    turnos.push({ role: 'user', content: [{ type: 'text', text: '[el comprador no ha escrito nada nuevo]' }] });
  }
  if (articuloSugerido) {
    const primerTexto = turnos[0].content.find((b) => b.type === 'text');
    primerTexto.text = `[Contexto: el comprador escribió desde el anuncio "${articuloSugerido.titulo}" (id ${articuloSugerido.id}).]\n${primerTexto.text}`;
  }
  // Un solo bloque de texto se envía como cadena: más legible en logs y pruebas.
  for (const t of turnos) {
    if (t.content.length === 1 && t.content[0].type === 'text') t.content = t.content[0].text;
  }
  return turnos;
}

export function crearClienteAnthropic(opciones = {}) {
  return new Anthropic(opciones);
}

export class Cerebro {
  constructor({ config, client = null, logger = console }) {
    this.config = config;
    this.client = client ?? crearClienteAnthropic();
    this.logger = logger;
    this.system = construirSystem(config.negocio, config.inventario);
  }

  /** Recarga el prompt cuando cambian negocio.json o inventario.json. */
  actualizarConfig(config) {
    this.config = config;
    this.system = construirSystem(config.negocio, config.inventario);
  }

  async decidir(conv, { articuloSugerido = null } = {}) {
    const mensajes = construirMensajes(conv, { historialMax: this.config.historialMax, articuloSugerido });
    const params = {
      model: this.config.modelo,
      max_tokens: 4096,
      system: [{ type: 'text', text: this.system, cache_control: { type: 'ephemeral' } }],
      messages: mensajes,
      output_config: { effort: this.config.esfuerzo, format: zodOutputFormat(EsquemaRespuesta) },
    };
    if (this.config.fallbacks) {
      params.betas = ['server-side-fallback-2026-07-01'];
      params.fallbacks = 'default';
    }
    let mensaje;
    try {
      mensaje = await this.client.beta.messages.parse(params);
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) throw new Error('ANTHROPIC_API_KEY inválida o ausente');
      if (err instanceof Anthropic.RateLimitError) {
        return { salida: { accion: 'derivar', respuesta: '', motivo: 'límite de la API de Claude alcanzado; reintentar luego', articulo_id: null, precio_ofrecido: null, precio_comprometido: null }, uso: null, error: err };
      }
      throw err;
    }
    const uso = mensaje.usage ?? null;
    if (mensaje.stop_reason === 'refusal') {
      return {
        salida: { accion: 'derivar', respuesta: 'Dame un momento y te confirmo.', motivo: `el modelo rechazó responder (${mensaje.stop_details?.category ?? 'sin categoría'})`, articulo_id: null, precio_ofrecido: null, precio_comprometido: null },
        uso,
      };
    }
    const salida = mensaje.parsed_output ?? null;
    if (!salida) {
      return {
        salida: { accion: 'derivar', respuesta: 'Dame un momento y te confirmo.', motivo: `no se pudo interpretar la salida del modelo (stop_reason ${mensaje.stop_reason})`, articulo_id: null, precio_ofrecido: null, precio_comprometido: null },
        uso,
      };
    }
    return { salida, uso, modelo: mensaje.model };
  }
}
