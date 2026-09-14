import { cargarConfig } from '../src/config.mjs';
import { Almacen } from '../src/store.mjs';
import { MessengerConsola } from '../src/messenger.mjs';
import { Agente } from '../src/agent.mjs';

export const silencio = { info() {}, warn() {}, error() {}, log() {} };

export function configPrueba(env = {}, extra = {}) {
  return cargarConfig({ MODO: 'auto', DEBOUNCE_MS: '5', APP_SECRET: 'secreto', VERIFY_TOKEN: 'verif', DASHBOARD_PASSWORD: 'clave', ...env }, extra);
}

/** Cerebro falso: devuelve lo que le programes, en orden. */
export class CerebroFalso {
  constructor(respuestas = []) {
    this.respuestas = respuestas;
    this.llamadas = [];
  }

  actualizarConfig() {}

  async decidir(conv, opciones) {
    this.llamadas.push({ conv: structuredClone(conv), opciones });
    const siguiente = this.respuestas.shift();
    if (siguiente instanceof Error) throw siguiente;
    const salida = siguiente ?? { accion: 'responder', respuesta: 'Sí, disponible.', articulo_id: null, motivo: 'prueba', precio_ofrecido: null, precio_comprometido: null };
    return { salida: { articulo_id: null, precio_ofrecido: null, precio_comprometido: null, ...salida }, uso: { input_tokens: 10, output_tokens: 5 } };
  }
}

export function agentePrueba({ env = {}, respuestas = [], ahora } = {}) {
  const config = configPrueba(env);
  const almacen = new Almacen(null, { logger: silencio });
  const messenger = new MessengerConsola({ logger: silencio });
  const cerebro = new CerebroFalso(respuestas);
  const agente = new Agente({ config, almacen, cerebro, messenger, logger: silencio, ahora });
  return { config, almacen, messenger, cerebro, agente };
}

export function mensajeComprador(psid, texto, extra = {}) {
  return { tipo: 'mensaje', psid, pageId: 'p', mid: `m-${Math.random().toString(36).slice(2)}`, texto, adjuntos: [], timestamp: Date.now(), esEco: false, referral: null, appId: null, ...extra };
}
