/**
 * Cliente mínimo de la Send API de Messenger (Graph API).
 * Sin PAGE_ACCESS_TOKEN se usa MessengerConsola, que solo imprime.
 */
export class Messenger {
  constructor({ pageToken, graphVersion = 'v23.0', fetchImpl = globalThis.fetch, logger = console }) {
    if (!pageToken) throw new Error('Messenger necesita pageToken');
    this.pageToken = pageToken;
    this.base = `https://graph.facebook.com/${graphVersion}`;
    this.fetch = fetchImpl;
    this.logger = logger;
  }

  get simulado() {
    return false;
  }

  async #post(ruta, cuerpo) {
    const res = await this.fetch(`${this.base}${ruta}?access_token=${encodeURIComponent(this.pageToken)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok || datos.error) {
      const e = datos.error ?? {};
      const err = new Error(`Graph API ${res.status}: ${e.message ?? 'error desconocido'} (code ${e.code ?? '?'}, subcode ${e.error_subcode ?? '?'})`);
      err.status = res.status;
      err.graph = e;
      throw err;
    }
    return datos;
  }

  async enviarTexto(psid, texto) {
    const datos = await this.#post('/me/messages', {
      recipient: { id: psid },
      messaging_type: 'RESPONSE',
      message: { text: texto },
    });
    return { mid: datos.message_id ?? null };
  }

  async accion(psid, senderAction) {
    try {
      await this.#post('/me/messages', { recipient: { id: psid }, sender_action: senderAction });
    } catch (err) {
      this.logger.warn(`sender_action ${senderAction} falló: ${err.message}`);
    }
  }

  async perfil(psid) {
    try {
      const res = await this.fetch(`${this.base}/${psid}?fields=first_name,last_name&access_token=${encodeURIComponent(this.pageToken)}`);
      const datos = await res.json().catch(() => ({}));
      if (!res.ok || datos.error) return null;
      return { nombre: [datos.first_name, datos.last_name].filter(Boolean).join(' ') || null };
    } catch {
      return null;
    }
  }
}

/** Sustituto para desarrollo local: no llama a Meta, imprime en consola. */
export class MessengerConsola {
  constructor({ logger = console } = {}) {
    this.logger = logger;
    this.enviados = [];
  }

  get simulado() {
    return true;
  }

  async enviarTexto(psid, texto) {
    const mid = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.enviados.push({ psid, texto, mid });
    this.logger.info(`[simulado] → ${psid}: ${texto}`);
    return { mid };
  }

  async accion() {}

  async perfil() {
    return null;
  }
}
