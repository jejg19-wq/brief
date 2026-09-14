import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { cargarConfig } from './config.mjs';
import { Almacen } from './store.mjs';
import { Messenger, MessengerConsola } from './messenger.mjs';
import { Cerebro } from './brain.mjs';
import { Agente } from './agent.mjs';
import { firmaValida, responderVerificacion, extraerEventos } from './webhook.mjs';
import { layout, vistaLista, vistaConversacion, vistaCopiloto, escapar } from './vistas.mjs';
import { TIPOS_IMAGEN } from './brain.mjs';

export const VERSION = '1.0.0';
const LIMITE_CUERPO = 1024 * 1024;
const LIMITE_CAPTURA = 8 * 1024 * 1024;

export function crearLogger(salida = console) {
  const marca = () => new Date().toISOString();
  return {
    info: (m) => salida.log(`${marca()} INFO ${m}`),
    warn: (m) => salida.warn(`${marca()} WARN ${m}`),
    error: (m) => salida.error(`${marca()} ERROR ${m}`),
  };
}

function leerCuerpo(req, limite = LIMITE_CUERPO) {
  return new Promise((resolve, reject) => {
    const trozos = [];
    let total = 0;
    req.on('data', (t) => {
      total += t.length;
      if (total > limite) {
        reject(Object.assign(new Error('cuerpo demasiado grande'), { status: 413 }));
        req.destroy();
        return;
      }
      trozos.push(t);
    });
    req.on('end', () => resolve(Buffer.concat(trozos)));
    req.on('error', reject);
  });
}

function responder(res, status, cuerpo, tipo = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': tipo, 'cache-control': 'no-store' });
  res.end(cuerpo);
}

function html(res, status, cuerpo) {
  responder(res, status, cuerpo, 'text/html; charset=utf-8');
}

function redirigir(res, destino) {
  res.writeHead(303, { location: destino });
  res.end();
}

function autorizado(req, password) {
  const cab = req.headers.authorization ?? '';
  if (!cab.startsWith('Basic ')) return false;
  const decodificado = Buffer.from(cab.slice(6), 'base64').toString('utf8');
  const idx = decodificado.indexOf(':');
  const clave = idx === -1 ? decodificado : decodificado.slice(idx + 1);
  const a = Buffer.from(clave);
  const b = Buffer.from(password);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Lee el formulario del copiloto: texto pegado y, opcionalmente, una captura del chat. */
async function leerFormularioCopiloto(req) {
  const tipo = req.headers['content-type'] ?? '';
  if (!tipo.startsWith('multipart/form-data')) {
    const form = new URLSearchParams((await leerCuerpo(req)).toString('utf8'));
    return { hilo: form.get('hilo') ?? '', imagen: null };
  }
  const raw = await leerCuerpo(req, LIMITE_CAPTURA);
  const form = await new Response(raw, { headers: { 'content-type': tipo } }).formData();
  const hilo = String(form.get('hilo') ?? '');
  const archivo = form.get('captura');
  if (!archivo || typeof archivo === 'string' || !archivo.size) return { hilo, imagen: null };
  if (!TIPOS_IMAGEN.includes(archivo.type)) return { hilo, imagen: null, error: `formato ${archivo.type || 'desconocido'} no admitido; usa PNG, JPG o WebP` };
  if (archivo.size > 5 * 1024 * 1024) return { hilo, imagen: null, error: 'la captura supera 5 MB; recórtala o bájale la calidad' };
  const data = Buffer.from(await archivo.arrayBuffer()).toString('base64');
  return { hilo, imagen: { media_type: archivo.type, data } };
}

/**
 * Crea el servidor HTTP. No escucha: el que llama decide el puerto.
 * Todas las dependencias se inyectan para poder probarlo sin red.
 */
export function crearServidor({ config, agente, almacen, logger = crearLogger(), messengerSimulado = false }) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      // Webhook de Meta
      if (url.pathname === '/webhook' && req.method === 'GET') {
        const r = responderVerificacion(url.searchParams, config.verifyToken);
        if (r.ok) return responder(res, 200, r.reto);
        logger.warn('verificación del webhook rechazada (VERIFY_TOKEN no coincide)');
        return responder(res, 403, 'token incorrecto');
      }
      if (url.pathname === '/webhook' && req.method === 'POST') {
        const raw = await leerCuerpo(req);
        if (!firmaValida(raw, req.headers['x-hub-signature-256'], config.appSecret)) {
          logger.warn(`POST /webhook con firma inválida${config.appSecret ? '' : ' (APP_SECRET no configurado)'}`);
          return responder(res, 403, 'firma inválida');
        }
        let body;
        try {
          body = JSON.parse(raw.toString('utf8'));
        } catch {
          return responder(res, 400, 'json inválido');
        }
        const eventos = extraerEventos(body);
        // Meta reintenta si no recibe 200 rápido: respondemos primero, procesamos después.
        responder(res, 200, 'EVENT_RECEIVED');
        for (const evento of eventos) {
          agente.procesarEvento(evento).catch((err) => logger.error(`evento de ${evento.psid} falló: ${err.stack ?? err.message}`));
        }
        return undefined;
      }
      if (url.pathname === '/api/health') {
        return responder(res, 200, JSON.stringify({
          ok: true,
          version: VERSION,
          modo: config.modo,
          modelo: config.modelo,
          messenger: messengerSimulado ? 'simulado' : 'graph-api',
          webhook: { verifyToken: Boolean(config.verifyToken), appSecret: Boolean(config.appSecret) },
          conversaciones: almacen.listar().length,
          borradoresPendientes: almacen.listar().reduce((n, c) => n + c.borradores.length, 0),
          articulos: config.inventario.length,
        }, null, 2), 'application/json; charset=utf-8');
      }

      // Panel (protegido con contraseña)
      if (!config.dashboardPassword) {
        return html(res, 503, layout('Panel desactivado', '<h1>Panel desactivado</h1><p>Define <code>DASHBOARD_PASSWORD</code> en el entorno para activar el panel.</p>'));
      }
      if (!autorizado(req, config.dashboardPassword)) {
        res.writeHead(401, { 'www-authenticate': 'Basic realm="Marketplace agente", charset="UTF-8"', 'content-type': 'text/plain; charset=utf-8' });
        return res.end('Necesitas la contraseña del panel');
      }

      if (url.pathname === '/' && req.method === 'GET') {
        return html(res, 200, vistaLista({ conversaciones: almacen.listar(), config, simulado: messengerSimulado }));
      }
      if (url.pathname === '/copiloto' && req.method === 'GET') {
        return html(res, 200, vistaCopiloto({}));
      }
      if (url.pathname === '/copiloto' && req.method === 'POST') {
        const { hilo, imagen, error } = await leerFormularioCopiloto(req);
        if (error) return html(res, 200, vistaCopiloto({ hilo, error }));
        try {
          const resultado = await agente.copiloto(hilo, imagen);
          return html(res, 200, vistaCopiloto({ hilo, resultado, conCaptura: Boolean(imagen) }));
        } catch (err) {
          return html(res, 200, vistaCopiloto({ hilo, error: err.message }));
        }
      }
      if (url.pathname === '/simular' && req.method === 'POST') {
        if (!messengerSimulado) return responder(res, 403, 'solo disponible con Messenger simulado');
        const form = new URLSearchParams((await leerCuerpo(req)).toString('utf8'));
        const psid = (form.get('psid') || 'prueba-1').trim();
        const texto = (form.get('texto') || '').trim();
        if (!texto) return redirigir(res, '/');
        await agente.procesarEvento({ tipo: 'mensaje', psid, pageId: 'local', mid: `sim-in-${crypto.randomUUID()}`, texto, adjuntos: [], timestamp: Date.now(), esEco: false, referral: null, appId: null });
        return redirigir(res, `/c/${encodeURIComponent(psid)}`);
      }
      const m = url.pathname.match(/^\/c\/([^/]+)(?:\/(enviar|manual|modo|descartar))?$/);
      if (m) {
        const psid = decodeURIComponent(m[1]);
        const accion = m[2];
        if (!almacen.existe(psid)) return html(res, 404, layout('No encontrada', '<h1>Conversación no encontrada</h1><p><a href="/">Volver</a></p>'));
        const conv = almacen.conversacion(psid);
        if (!accion && req.method === 'GET') {
          return html(res, 200, vistaConversacion({ conv, config, mensaje: url.searchParams.get('ok'), error: url.searchParams.get('error') }));
        }
        if (accion && req.method === 'POST') {
          const form = new URLSearchParams((await leerCuerpo(req)).toString('utf8'));
          let ok = '';
          try {
            if (accion === 'enviar') {
              await agente.enviarBorrador(psid, form.get('borrador'), form.get('texto'));
              ok = 'Respuesta enviada';
            } else if (accion === 'manual') {
              await agente.responderManual(psid, form.get('texto'));
              ok = 'Mensaje enviado';
            } else if (accion === 'modo') {
              agente.cambiarModo(psid, form.get('modo'));
              ok = 'Modo actualizado';
            } else if (accion === 'descartar') {
              agente.descartarBorrador(psid, form.get('borrador'));
              ok = 'Borrador descartado';
            }
            return redirigir(res, `/c/${encodeURIComponent(psid)}?ok=${encodeURIComponent(ok)}`);
          } catch (err) {
            return redirigir(res, `/c/${encodeURIComponent(psid)}?error=${encodeURIComponent(err.message)}`);
          }
        }
      }
      return html(res, 404, layout('No encontrado', `<h1>No encontrado</h1><p>${escapar(url.pathname)}</p>`));
    } catch (err) {
      logger.error(`${req.method} ${url.pathname}: ${err.stack ?? err.message}`);
      if (!res.headersSent) responder(res, err.status ?? 500, 'error interno');
      else res.end();
      return undefined;
    }
  });
}

export function arrancar(env = process.env) {
  const logger = crearLogger();
  let config = cargarConfig(env);
  const almacen = new Almacen(path.join(config.dataDir, 'estado.json'), { logger });
  const messenger = config.pageToken ? new Messenger({ pageToken: config.pageToken, graphVersion: config.graphVersion, logger }) : new MessengerConsola({ logger });
  const cerebro = new Cerebro({ config, logger });
  const agente = new Agente({ config, almacen, cerebro, messenger, logger });
  const server = crearServidor({ config, agente, almacen, logger, messengerSimulado: messenger.simulado });

  if (!env.ANTHROPIC_API_KEY && !env.ANTHROPIC_AUTH_TOKEN) logger.warn('ANTHROPIC_API_KEY no está definida: el SDK intentará usar un perfil de `ant auth login`; si no existe, las respuestas fallarán');
  if (messenger.simulado) logger.warn('PAGE_ACCESS_TOKEN no definido: Messenger simulado, nada se envía a Facebook');
  if (!config.appSecret) logger.warn('APP_SECRET no definido: todos los POST /webhook se rechazarán con 403');
  if (!config.verifyToken) logger.warn('VERIFY_TOKEN no definido: Meta no podrá verificar el webhook');
  if (!config.dashboardPassword) logger.warn('DASHBOARD_PASSWORD no definido: el panel está desactivado');

  // Recarga en caliente de negocio.json / inventario.json
  let temporizador = null;
  try {
    fs.watch(config.configDir, () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        try {
          const nueva = cargarConfig(env);
          config = nueva;
          cerebro.actualizarConfig(nueva);
          agente.config = nueva;
          logger.info(`configuración recargada (${nueva.inventario.length} artículos)`);
        } catch (err) {
          logger.error(`configuración inválida, se mantiene la anterior: ${err.message}`);
        }
      }, 300);
    });
  } catch (err) {
    logger.warn(`no se pudo vigilar ${config.configDir}: ${err.message}`);
  }

  agente.onEvento((e) => {
    if (e.tipo === 'borrador') logger.info(`[borrador] ${e.psid}: ${e.texto?.slice(0, 80) ?? ''} — ${e.motivo}`);
    if (e.tipo === 'enviado') logger.info(`[enviado] ${e.psid}: ${e.texto.slice(0, 80)}`);
    if (e.tipo === 'derivar') logger.warn(`[derivar] ${e.psid}: ${e.motivo}`);
    if (e.tipo === 'pausa') logger.info(`[pausa] ${e.psid}: respondiste a mano, bot en silencio hasta ${new Date(e.hasta).toISOString()}`);
    if (e.tipo === 'sin_responder') logger.warn(`[sin responder] ${e.psid}: ${e.razon}`);
  });

  server.listen(config.puerto, () => {
    logger.info(`marketplace-agent v${VERSION} escuchando en http://localhost:${config.puerto} · modo ${config.modo} · modelo ${config.modelo}`);
  });

  const apagar = async (senal) => {
    logger.info(`${senal}: cerrando…`);
    server.close();
    try {
      await agente.esperar();
    } catch (err) {
      logger.error(`error al vaciar pendientes: ${err.message}`);
    }
    almacen.guardar();
    process.exit(0);
  };
  process.on('SIGTERM', () => apagar('SIGTERM'));
  process.on('SIGINT', () => apagar('SIGINT'));
  return { server, agente, almacen, config };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  arrancar();
}
