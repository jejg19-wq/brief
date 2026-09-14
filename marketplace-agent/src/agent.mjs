import { evaluarEntrada, detectarArticulo, validarSalida, trocear } from './policy.mjs';

/**
 * Orquesta: evento entrante → reglas → modelo → envío o borrador.
 * Agrupa los mensajes seguidos de un mismo comprador (debounce) para
 * contestar una sola vez.
 */
export class Agente {
  constructor({ config, almacen, cerebro, messenger, logger = console, ahora = () => Date.now() }) {
    this.config = config;
    this.almacen = almacen;
    this.cerebro = cerebro;
    this.messenger = messenger;
    this.logger = logger;
    this.ahora = ahora;
    this.temporizadores = new Map();
    this.enCurso = new Map();
    this.escuchas = new Set();
  }

  onEvento(fn) {
    this.escuchas.add(fn);
    return () => this.escuchas.delete(fn);
  }

  #emitir(tipo, datos) {
    for (const fn of this.escuchas) {
      try {
        fn({ tipo, ...datos });
      } catch (err) {
        this.logger.warn(`escucha falló: ${err.message}`);
      }
    }
  }

  async procesarEvento(evento) {
    if (evento.mid && this.almacen.yaProcesado(evento.mid)) {
      return { resultado: 'duplicado' };
    }
    this.almacen.marcarProcesado(evento.mid);
    const conv = this.almacen.conversacion(evento.psid);
    const esNuestro = this.almacen.fueEnviadoPorNosotros(evento.mid);
    const decision = evaluarEntrada({ conv, evento, config: this.config, ahora: this.ahora(), esNuestro });

    switch (decision.accion) {
      case 'ignorar':
        this.almacen.guardar();
        return { resultado: 'ignorado', razon: decision.razon };
      case 'pausar': {
        // Respuesta manual del vendedor: la guardamos como parte del hilo y pausamos el bot.
        this.almacen.agregarMensaje(evento.psid, { rol: 'vendedor', texto: evento.texto, origen: 'humano', ts: evento.timestamp, adjuntos: evento.adjuntos ?? [] });
        conv.pausadoHasta = decision.hastaMs;
        conv.borradores = [];
        this.#cancelar(evento.psid);
        this.almacen.guardar();
        this.#emitir('pausa', { psid: evento.psid, hasta: decision.hastaMs });
        return { resultado: 'pausado', razon: decision.razon };
      }
      case 'registrar':
        this.almacen.agregarMensaje(evento.psid, { rol: 'comprador', texto: evento.texto, origen: 'facebook', ts: evento.timestamp, adjuntos: evento.adjuntos ?? [] });
        this.almacen.agregarAlerta(evento.psid, `mensaje sin responder: ${decision.razon}`);
        this.almacen.guardar();
        this.#emitir('sin_responder', { psid: evento.psid, razon: decision.razon });
        return { resultado: 'registrado', razon: decision.razon };
      case 'derivar':
        this.almacen.agregarMensaje(evento.psid, { rol: 'comprador', texto: evento.texto, origen: 'facebook', ts: evento.timestamp, adjuntos: evento.adjuntos ?? [] });
        this.almacen.agregarAlerta(evento.psid, decision.razon);
        conv.pausadoHasta = this.ahora() + this.config.pausaTrasDerivarMin * 60 * 1000;
        this.almacen.guardar();
        this.#emitir('derivar', { psid: evento.psid, motivo: decision.razon });
        return { resultado: 'derivado', razon: decision.razon };
      case 'procesar':
      default:
        break;
    }

    this.almacen.agregarMensaje(evento.psid, { rol: 'comprador', texto: evento.texto, origen: 'facebook', ts: evento.timestamp, adjuntos: evento.adjuntos ?? [] });
    if (!conv.articuloId) {
      const art = detectarArticulo({ texto: evento.texto, inventario: this.config.inventario, referral: evento.referral });
      if (art) conv.articuloId = art.id;
    }
    if (evento.referral) conv.referral = evento.referral;
    if (!conv.nombre) {
      const perfil = await this.messenger.perfil(evento.psid);
      if (perfil?.nombre) conv.nombre = perfil.nombre;
    }
    this.almacen.guardar();
    this.#programar(evento.psid);
    return { resultado: 'programado' };
  }

  #programar(psid) {
    this.#cancelar(psid);
    const t = setTimeout(() => {
      this.temporizadores.delete(psid);
      this.responderConversacion(psid).catch((err) => this.logger.error(`respuesta a ${psid} falló: ${err.stack ?? err.message}`));
    }, this.config.debounceMs);
    if (typeof t.unref === 'function') t.unref();
    this.temporizadores.set(psid, t);
  }

  #cancelar(psid) {
    const t = this.temporizadores.get(psid);
    if (t) {
      clearTimeout(t);
      this.temporizadores.delete(psid);
    }
  }

  /** Espera a que terminen las respuestas pendientes (útil en pruebas y al apagar). */
  async esperar() {
    for (const [psid, t] of this.temporizadores) {
      clearTimeout(t);
      this.temporizadores.delete(psid);
      await this.responderConversacion(psid);
    }
    await Promise.all([...this.enCurso.values()]);
  }

  async responderConversacion(psid) {
    if (this.enCurso.has(psid)) return this.enCurso.get(psid);
    const promesa = this.#responder(psid).finally(() => this.enCurso.delete(psid));
    this.enCurso.set(psid, promesa);
    return promesa;
  }

  async #responder(psid) {
    const conv = this.almacen.conversacion(psid);
    const ultimo = conv.mensajes[conv.mensajes.length - 1];
    if (!ultimo || ultimo.rol !== 'comprador') return { resultado: 'nada_que_responder' };
    const modo = conv.modo ?? this.config.modo;
    if (modo === 'humano' || (conv.pausadoHasta && conv.pausadoHasta > this.ahora())) return { resultado: 'pausado' };

    const articuloSugerido = conv.articuloId ? this.config.inventario.find((a) => a.id === conv.articuloId) ?? null : null;
    if (modo === 'auto') await this.messenger.accion(psid, 'typing_on');

    let decision;
    try {
      decision = await this.cerebro.decidir(conv, { articuloSugerido });
    } catch (err) {
      this.almacen.agregarAlerta(psid, `error llamando a Claude: ${err.message}`);
      this.almacen.guardar();
      this.#emitir('error', { psid, error: err.message });
      throw err;
    }
    const articulo = decision.salida.articulo_id ? this.config.inventario.find((a) => a.id === decision.salida.articulo_id) ?? articuloSugerido : articuloSugerido;
    const salida = validarSalida({ salida: decision.salida, articulo, config: this.config });
    if (articulo && !conv.articuloId) conv.articuloId = articulo.id;
    if (decision.uso) {
      this.logger.info(`[claude] ${psid} in=${decision.uso.input_tokens} cache=${decision.uso.cache_read_input_tokens ?? 0} out=${decision.uso.output_tokens} → ${salida.accion}`);
    }
    if (salida.correcciones.length) this.logger.warn(`[reglas] ${psid}: ${salida.correcciones.join('; ')}`);

    if (salida.accion === 'ignorar') {
      this.almacen.guardar();
      this.#emitir('ignorado', { psid, motivo: salida.motivo });
      return { resultado: 'ignorado', salida };
    }

    if (salida.accion === 'derivar') {
      this.almacen.agregarAlerta(psid, `${salida.motivo}${salida.correcciones.length ? ` (${salida.correcciones.join('; ')})` : ''}`);
      conv.pausadoHasta = this.ahora() + this.config.pausaTrasDerivarMin * 60 * 1000;
    }

    if (modo === 'auto' && salida.respuesta) {
      await this.#enviar(psid, salida.respuesta, 'agente');
      this.almacen.guardar();
      this.#emitir(salida.accion === 'derivar' ? 'derivar' : 'enviado', { psid, texto: salida.respuesta, motivo: salida.motivo });
      return { resultado: 'enviado', salida };
    }

    if (salida.respuesta) {
      this.almacen.agregarBorrador(psid, { texto: salida.respuesta, motivo: salida.motivo, accion: salida.accion });
    }
    this.almacen.guardar();
    if (!salida.respuesta) {
      this.#emitir('derivar', { psid, motivo: salida.motivo });
      return { resultado: 'derivado', salida };
    }
    this.#emitir('borrador', { psid, texto: salida.respuesta, motivo: salida.motivo, accion: salida.accion });
    return { resultado: 'borrador', salida };
  }

  async #enviar(psid, texto, origen) {
    const conv = this.almacen.conversacion(psid);
    for (const parte of trocear(texto)) {
      const { mid } = await this.messenger.enviarTexto(psid, parte);
      this.almacen.registrarEnviado(mid);
      if (mid) this.almacen.marcarProcesado(mid);
    }
    this.almacen.agregarMensaje(psid, { rol: 'vendedor', texto, origen, ts: this.ahora() });
    if (origen === 'agente') {
      conv.respuestasRecientes = [...(conv.respuestasRecientes ?? []).filter((ts) => this.ahora() - ts < 3600_000), this.ahora()];
    }
  }

  /** Envía un borrador aprobado desde el panel (con el texto editado, si lo hay). */
  async enviarBorrador(psid, borradorId, textoEditado = null) {
    const borrador = this.almacen.quitarBorrador(psid, borradorId);
    if (!borrador) throw new Error('borrador no encontrado');
    const texto = (textoEditado ?? borrador.texto).trim();
    if (!texto) throw new Error('el texto está vacío');
    await this.#enviar(psid, texto, textoEditado && textoEditado.trim() !== borrador.texto.trim() ? 'humano' : 'agente');
    const conv = this.almacen.conversacion(psid);
    if (borrador.accion !== 'derivar') conv.pausadoHasta = 0;
    this.almacen.guardar();
    return { texto };
  }

  async responderManual(psid, texto) {
    const limpio = String(texto ?? '').trim();
    if (!limpio) throw new Error('el texto está vacío');
    await this.#enviar(psid, limpio, 'humano');
    const conv = this.almacen.conversacion(psid);
    conv.borradores = [];
    this.almacen.guardar();
    return { texto: limpio };
  }

  descartarBorrador(psid, borradorId) {
    const b = this.almacen.quitarBorrador(psid, borradorId);
    this.almacen.guardar();
    return Boolean(b);
  }

  cambiarModo(psid, modo) {
    const conv = this.almacen.conversacion(psid);
    if (modo === 'reanudar') {
      conv.modo = null;
      conv.pausadoHasta = 0;
    } else if (modo === 'humano' || modo === 'auto') {
      conv.modo = modo;
      if (modo === 'auto') conv.pausadoHasta = 0;
      if (modo === 'humano') this.#cancelar(psid);
    } else {
      throw new Error('modo desconocido');
    }
    this.almacen.guardar();
    return conv;
  }

  /** Redacta una respuesta para un hilo pegado a mano, sin guardar nada. */
  async copiloto(textoHilo) {
    const conv = { psid: 'copiloto', mensajes: [], articuloId: null };
    const lineas = String(textoHilo ?? '').split('\n');
    for (const linea of lineas) {
      const m = linea.match(/^\s*(yo|vendedor)\s*:\s*(.*)$/i);
      if (m) conv.mensajes.push({ rol: 'vendedor', texto: m[2], origen: 'humano' });
      else if (linea.trim()) conv.mensajes.push({ rol: 'comprador', texto: linea.replace(/^\s*(comprador|cliente)\s*:\s*/i, ''), origen: 'manual' });
    }
    if (!conv.mensajes.length) throw new Error('pega al menos un mensaje del comprador');
    const articulo = detectarArticulo({ texto: conv.mensajes.map((m) => m.texto).join(' '), inventario: this.config.inventario });
    const decision = await this.cerebro.decidir(conv, { articuloSugerido: articulo });
    return validarSalida({ salida: decision.salida, articulo, config: this.config });
  }
}
