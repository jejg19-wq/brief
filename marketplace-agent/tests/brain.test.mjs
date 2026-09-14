import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirSystem, construirMensajes, Cerebro, EsquemaRespuesta } from '../src/brain.mjs';
import { configPrueba } from './ayuda.mjs';

const config = configPrueba();

test('el system prompt es determinista e incluye negocio e inventario', () => {
  const a = construirSystem(config.negocio, config.inventario);
  const b = construirSystem(config.negocio, config.inventario);
  assert.equal(a, b);
  assert.match(a, /iPhone 12 128GB negro/);
  assert.match(a, /CONFIDENCIAL/);
  assert.match(a, /precio mínimo aceptable \(CONFIDENCIAL, nunca lo menciones\): 250/);
  assert.match(a, /No acepto cambios/);
  assert.doesNotMatch(a, /2026|\d{4}-\d{2}-\d{2}/, 'sin fechas para no romper la caché');
});

test('construirMensajes alterna roles, empieza y termina con el comprador', () => {
  const conv = {
    mensajes: [
      { rol: 'vendedor', texto: 'huérfano' },
      { rol: 'comprador', texto: 'hola' },
      { rol: 'comprador', texto: '', adjuntos: [{ tipo: 'image' }] },
      { rol: 'vendedor', texto: 'sí' },
      { rol: 'vendedor', texto: 'disponible' },
      { rol: 'comprador', texto: 'precio?' },
    ],
  };
  const t = construirMensajes(conv, { articuloSugerido: config.inventario[0] });
  assert.deepEqual(t.map((x) => x.role), ['user', 'assistant', 'user']);
  assert.match(t[0].content, /^\[Contexto: el comprador escribió desde el anuncio "iPhone 12 128GB negro"/);
  assert.match(t[0].content, /adjunto de tipo image/);
  assert.equal(t[1].content, 'sí\ndisponible');
  const cerrado = construirMensajes({ mensajes: [{ rol: 'comprador', texto: 'a' }, { rol: 'vendedor', texto: 'b' }] });
  assert.equal(cerrado[cerrado.length - 1].role, 'user');
  assert.equal(construirMensajes({ mensajes: [] })[0].role, 'user');
});

test('construirMensajes respeta historialMax', () => {
  const mensajes = Array.from({ length: 51 }, (_, i) => ({ rol: i % 2 ? 'vendedor' : 'comprador', texto: `m${i}` }));
  const t = construirMensajes({ mensajes }, { historialMax: 5 });
  assert.equal(t.length, 5);
  assert.equal(t[0].content, 'm46');
  assert.equal(t.at(-1).content, 'm50');
});

function clienteFalso(respuesta) {
  const llamadas = [];
  return {
    llamadas,
    beta: { messages: { parse: async (params) => { llamadas.push(params); return typeof respuesta === 'function' ? respuesta(params) : respuesta; } } },
  };
}

test('Cerebro envía el prompt cacheado, el formato estructurado y los fallbacks', async () => {
  const client = clienteFalso({ stop_reason: 'end_turn', model: 'claude-opus-5', usage: { input_tokens: 1, output_tokens: 1 }, parsed_output: { accion: 'responder', respuesta: 'Sí', articulo_id: 'iphone-12-128', motivo: 'ok', precio_ofrecido: null, precio_comprometido: null } });
  const cerebro = new Cerebro({ config, client });
  const r = await cerebro.decidir({ mensajes: [{ rol: 'comprador', texto: 'sigue disponible el iphone?' }] });
  assert.equal(r.salida.respuesta, 'Sí');
  const p = client.llamadas[0];
  assert.equal(p.model, 'claude-opus-5');
  assert.deepEqual(p.system[0].cache_control, { type: 'ephemeral' });
  assert.equal(p.output_config.effort, 'medium');
  assert.ok(p.output_config.format, 'lleva formato estructurado');
  assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(p.fallbacks, 'default');
  assert.equal(p.thinking, undefined, 'thinking adaptativo por defecto: no se envía el parámetro');
});

test('Cerebro sin fallbacks para modelos que no son Opus 5/Fable', async () => {
  const client = clienteFalso({ stop_reason: 'end_turn', usage: {}, parsed_output: { accion: 'ignorar', respuesta: '', articulo_id: null, motivo: 'x', precio_ofrecido: null, precio_comprometido: null } });
  const cerebro = new Cerebro({ config: configPrueba({ CLAUDE_MODEL: 'claude-sonnet-5' }), client });
  await cerebro.decidir({ mensajes: [{ rol: 'comprador', texto: 'ok' }] });
  assert.equal(client.llamadas[0].fallbacks, undefined);
  assert.equal(client.llamadas[0].betas, undefined);
});

test('Cerebro deriva ante un rechazo o una salida no interpretable', async () => {
  const rechazo = new Cerebro({ config, client: clienteFalso({ stop_reason: 'refusal', stop_details: { category: 'cyber' }, usage: {}, parsed_output: null }) });
  const r1 = await rechazo.decidir({ mensajes: [{ rol: 'comprador', texto: 'x' }] });
  assert.equal(r1.salida.accion, 'derivar');
  assert.match(r1.salida.motivo, /rechazó/);
  const rota = new Cerebro({ config, client: clienteFalso({ stop_reason: 'max_tokens', usage: {}, parsed_output: null }) });
  const r2 = await rota.decidir({ mensajes: [{ rol: 'comprador', texto: 'x' }] });
  assert.equal(r2.salida.accion, 'derivar');
  assert.match(r2.salida.motivo, /max_tokens/);
});

test('EsquemaRespuesta valida la forma esperada', () => {
  assert.ok(EsquemaRespuesta.safeParse({ accion: 'responder', respuesta: 'hola', articulo_id: null, motivo: 'm', precio_ofrecido: 10, precio_comprometido: null }).success);
  assert.equal(EsquemaRespuesta.safeParse({ accion: 'otra', respuesta: 'hola', articulo_id: null, motivo: 'm', precio_ofrecido: null, precio_comprometido: null }).success, false);
});

test('construirMensajes incluye la captura como bloque de imagen antes del texto', () => {
  const conv = { mensajes: [{ rol: 'comprador', texto: 'mira', imagen: { media_type: 'image/png', data: 'AAAA' } }, { rol: 'comprador', texto: 'y esto' }] };
  const t = construirMensajes(conv, { articuloSugerido: config.inventario[1] });
  assert.equal(t.length, 1);
  assert.ok(Array.isArray(t[0].content));
  assert.equal(t[0].content[0].type, 'image');
  assert.deepEqual(t[0].content[0].source, { type: 'base64', media_type: 'image/png', data: 'AAAA' });
  assert.equal(t[0].content[1].type, 'text');
  assert.match(t[0].content[1].text, /^\[Contexto: .*Monitor LG/);
  assert.match(t[0].content[1].text, /mira\ny esto$/);
  const vendedorConImagen = construirMensajes({ mensajes: [{ rol: 'comprador', texto: 'a' }, { rol: 'vendedor', texto: 'b', imagen: { media_type: 'image/png', data: 'x' } }, { rol: 'comprador', texto: 'c' }] });
  assert.equal(vendedorConImagen[1].content, 'b', 'las imágenes solo van en turnos del comprador');
});
