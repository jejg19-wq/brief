import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX_MIDS = 3000;

export function conversacionVacia(psid) {
  const ahora = Date.now();
  return {
    psid,
    nombre: null,
    modo: null, // null = usar el modo global; 'auto' | 'humano'
    articuloId: null,
    pausadoHasta: 0,
    creado: ahora,
    actualizado: ahora,
    mensajes: [], // { id, rol: 'comprador'|'vendedor', texto, ts, origen }
    borradores: [], // { id, texto, motivo, accion, ts }
    alertas: [], // { ts, motivo }
    respuestasRecientes: [], // timestamps de respuestas automáticas
  };
}

/**
 * Almacén en un archivo JSON. Suficiente para un vendedor con decenas de
 * conversaciones; si crece, se cambia por SQLite sin tocar el resto.
 */
export class Almacen {
  constructor(rutaArchivo, { logger = console } = {}) {
    this.ruta = rutaArchivo;
    this.logger = logger;
    this.datos = { conversaciones: {}, midsProcesados: [], midsEnviados: [] };
    this.cargar();
  }

  cargar() {
    if (!this.ruta) return;
    try {
      const crudo = fs.readFileSync(this.ruta, 'utf8');
      const datos = JSON.parse(crudo);
      this.datos = {
        conversaciones: datos.conversaciones ?? {},
        midsProcesados: datos.midsProcesados ?? [],
        midsEnviados: datos.midsEnviados ?? [],
      };
    } catch (err) {
      if (err.code !== 'ENOENT') this.logger.warn(`No se pudo leer ${this.ruta}, se empieza vacío: ${err.message}`);
    }
  }

  guardar() {
    if (!this.ruta) return;
    fs.mkdirSync(path.dirname(this.ruta), { recursive: true });
    const tmp = `${this.ruta}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.datos, null, 2));
    fs.renameSync(tmp, this.ruta);
  }

  conversacion(psid) {
    let conv = this.datos.conversaciones[psid];
    if (!conv) {
      conv = conversacionVacia(psid);
      this.datos.conversaciones[psid] = conv;
    }
    return conv;
  }

  existe(psid) {
    return Boolean(this.datos.conversaciones[psid]);
  }

  listar() {
    return Object.values(this.datos.conversaciones).sort((a, b) => b.actualizado - a.actualizado);
  }

  yaProcesado(mid) {
    return Boolean(mid) && this.datos.midsProcesados.includes(mid);
  }

  marcarProcesado(mid) {
    if (!mid) return;
    this.datos.midsProcesados.push(mid);
    if (this.datos.midsProcesados.length > MAX_MIDS) this.datos.midsProcesados.splice(0, this.datos.midsProcesados.length - MAX_MIDS);
  }

  registrarEnviado(mid) {
    if (!mid) return;
    this.datos.midsEnviados.push(mid);
    if (this.datos.midsEnviados.length > MAX_MIDS) this.datos.midsEnviados.splice(0, this.datos.midsEnviados.length - MAX_MIDS);
  }

  fueEnviadoPorNosotros(mid) {
    return Boolean(mid) && this.datos.midsEnviados.includes(mid);
  }

  agregarMensaje(psid, { rol, texto, origen, ts = Date.now(), adjuntos = [] }) {
    const conv = this.conversacion(psid);
    const mensaje = { id: crypto.randomUUID(), rol, texto, origen, ts, adjuntos };
    conv.mensajes.push(mensaje);
    conv.actualizado = Math.max(conv.actualizado, ts);
    return mensaje;
  }

  agregarBorrador(psid, { texto, motivo, accion }) {
    const conv = this.conversacion(psid);
    const borrador = { id: crypto.randomUUID(), texto, motivo, accion, ts: Date.now() };
    conv.borradores.push(borrador);
    conv.actualizado = Date.now();
    return borrador;
  }

  quitarBorrador(psid, borradorId) {
    const conv = this.conversacion(psid);
    const idx = conv.borradores.findIndex((b) => b.id === borradorId);
    if (idx === -1) return null;
    return conv.borradores.splice(idx, 1)[0];
  }

  agregarAlerta(psid, motivo) {
    const conv = this.conversacion(psid);
    conv.alertas.push({ ts: Date.now(), motivo });
    if (conv.alertas.length > 50) conv.alertas.splice(0, conv.alertas.length - 50);
    conv.actualizado = Date.now();
  }
}
