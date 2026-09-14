import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(aqui, '..');

export const ESTADOS_ARTICULO = ['disponible', 'reservado', 'vendido'];

function leerJson(ruta) {
  let crudo;
  try {
    crudo = fs.readFileSync(ruta, 'utf8');
  } catch (err) {
    throw new Error(`No se pudo leer ${ruta}: ${err.message}`);
  }
  try {
    return JSON.parse(crudo);
  } catch (err) {
    throw new Error(`JSON inválido en ${ruta}: ${err.message}`);
  }
}

export function validarInventario(inventario) {
  if (!Array.isArray(inventario)) throw new Error('inventario.json debe ser una lista de artículos');
  const ids = new Set();
  for (const art of inventario) {
    if (!art || typeof art !== 'object') throw new Error('Cada artículo debe ser un objeto');
    if (!art.id || typeof art.id !== 'string') throw new Error('Cada artículo necesita un "id" de texto');
    if (ids.has(art.id)) throw new Error(`El id de artículo "${art.id}" está repetido`);
    ids.add(art.id);
    if (!art.titulo) throw new Error(`El artículo "${art.id}" necesita "titulo"`);
    if (typeof art.precio !== 'number' || art.precio < 0) throw new Error(`El artículo "${art.id}" necesita un "precio" numérico`);
    if (art.precio_minimo != null) {
      if (typeof art.precio_minimo !== 'number') throw new Error(`"precio_minimo" de "${art.id}" debe ser numérico`);
      if (art.precio_minimo > art.precio) throw new Error(`"precio_minimo" de "${art.id}" no puede superar el precio`);
    }
    if (art.estado && !ESTADOS_ARTICULO.includes(art.estado)) {
      throw new Error(`"estado" de "${art.id}" debe ser uno de: ${ESTADOS_ARTICULO.join(', ')}`);
    }
  }
  return inventario;
}

export function validarNegocio(negocio) {
  if (!negocio || typeof negocio !== 'object') throw new Error('negocio.json debe ser un objeto');
  if (!negocio.vendedor) throw new Error('negocio.json necesita "vendedor"');
  return negocio;
}

function entero(valor, porDefecto) {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : porDefecto;
}

/**
 * Carga la configuración desde variables de entorno y los JSON de config/.
 * Se puede inyectar `env` y `configDir` para pruebas.
 */
export function cargarConfig(env = process.env, opciones = {}) {
  const configDir = opciones.configDir ?? (env.CONFIG_DIR ? path.resolve(env.CONFIG_DIR) : path.join(RAIZ, 'config'));
  const negocio = validarNegocio(opciones.negocio ?? leerJson(path.join(configDir, 'negocio.json')));
  const inventario = validarInventario(opciones.inventario ?? leerJson(path.join(configDir, 'inventario.json')));
  const modelo = env.CLAUDE_MODEL || 'claude-opus-5';
  const fallbacksAuto = /^claude-(opus-5|fable)/.test(modelo);
  return {
    negocio,
    inventario,
    configDir,
    modo: env.MODO === 'auto' ? 'auto' : 'borrador',
    modelo,
    esfuerzo: env.CLAUDE_EFFORT || 'medium',
    fallbacks: env.CLAUDE_FALLBACKS ? env.CLAUDE_FALLBACKS !== 'off' : fallbacksAuto,
    puerto: entero(env.PORT, 3000),
    verifyToken: env.VERIFY_TOKEN || '',
    pageToken: env.PAGE_ACCESS_TOKEN || '',
    appSecret: env.APP_SECRET || '',
    appId: env.APP_ID || '',
    graphVersion: env.GRAPH_VERSION || 'v23.0',
    dashboardPassword: env.DASHBOARD_PASSWORD || '',
    dataDir: env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(RAIZ, 'data'),
    debounceMs: entero(env.DEBOUNCE_MS, 4000),
    pausaTrasHumanoMin: entero(env.PAUSA_TRAS_HUMANO_MIN, 120),
    pausaTrasDerivarMin: entero(env.PAUSA_TRAS_DERIVAR_MIN, 120),
    maxRespuestasPorHora: entero(env.MAX_RESPUESTAS_POR_HORA, 20),
    historialMax: entero(env.HISTORIAL_MAX, 30),
  };
}
