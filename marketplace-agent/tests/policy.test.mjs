import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarEntrada, detectarArticulo, validarSalida, trocear } from '../src/policy.mjs';
import { conversacionVacia } from '../src/store.mjs';
import { configPrueba } from './ayuda.mjs';

const config = configPrueba();
const ahora = 1_000_000_000_000;

test('un eco de un mensaje nuestro se ignora; un eco humano pausa el bot', () => {
  const conv = conversacionVacia('U');
  const eco = { tipo: 'eco', psid: 'U', texto: 'hola', appId: '1', mid: 'x' };
  assert.equal(evaluarEntrada({ conv, evento: eco, config, ahora, esNuestro: true }).accion, 'ignorar');
  const r = evaluarEntrada({ conv, evento: eco, config, ahora, esNuestro: false });
  assert.equal(r.accion, 'pausar');
  assert.equal(r.hastaMs, ahora + config.pausaTrasHumanoMin * 60_000);
  const conAppId = configPrueba({ APP_ID: '1' });
  assert.equal(evaluarEntrada({ conv, evento: eco, config: conAppId, ahora }).accion, 'ignorar');
});

test('modo humano y pausas solo registran; el límite por hora deriva', () => {
  const conv = conversacionVacia('U');
  const msg = { tipo: 'mensaje', psid: 'U', texto: 'hola', adjuntos: [] };
  assert.equal(evaluarEntrada({ conv, evento: msg, config, ahora }).accion, 'procesar');
  conv.modo = 'humano';
  assert.equal(evaluarEntrada({ conv, evento: msg, config, ahora }).accion, 'registrar');
  conv.modo = null;
  conv.pausadoHasta = ahora + 1;
  assert.equal(evaluarEntrada({ conv, evento: msg, config, ahora }).accion, 'registrar');
  conv.pausadoHasta = 0;
  conv.respuestasRecientes = Array.from({ length: config.maxRespuestasPorHora }, () => ahora - 1000);
  assert.equal(evaluarEntrada({ conv, evento: msg, config, ahora }).accion, 'derivar');
  conv.respuestasRecientes = Array.from({ length: config.maxRespuestasPorHora }, () => ahora - 2 * 3600_000);
  assert.equal(evaluarEntrada({ conv, evento: msg, config, ahora }).accion, 'procesar');
});

test('eventos sin contenido se ignoran', () => {
  const conv = conversacionVacia('U');
  assert.equal(evaluarEntrada({ conv, evento: { tipo: 'mensaje', texto: '', adjuntos: [] }, config, ahora }).accion, 'ignorar');
  assert.equal(evaluarEntrada({ conv, evento: { tipo: 'otro' }, config, ahora }).accion, 'ignorar');
  assert.equal(evaluarEntrada({ conv, evento: { tipo: 'mensaje', texto: '', adjuntos: [{ tipo: 'image' }] }, config, ahora }).accion, 'procesar');
});

test('detectarArticulo usa referral, título o palabras clave y no adivina en empates', () => {
  const inv = config.inventario;
  assert.equal(detectarArticulo({ texto: 'hola', inventario: inv, referral: { productoId: 'monitor-lg-27' } })?.id, 'monitor-lg-27');
  assert.equal(detectarArticulo({ texto: '', inventario: inv, referral: { titulo: 'iphone 12 128gb negro' } })?.id, 'iphone-12-128');
  assert.equal(detectarArticulo({ texto: '¿Sigue disponible el iPhone?', inventario: inv })?.id, 'iphone-12-128');
  assert.equal(detectarArticulo({ texto: 'me interesa la bici', inventario: inv })?.id, 'bici-trek');
  assert.equal(detectarArticulo({ texto: 'hola, sigue disponible?', inventario: inv }), null);
  assert.equal(detectarArticulo({ texto: 'el monitor o el iphone?', inventario: inv }), null);
});

test('validarSalida bloquea precios bajo el mínimo y filtraciones del mínimo', () => {
  const art = config.inventario.find((a) => a.id === 'iphone-12-128'); // 280, mínimo 250
  const base = { accion: 'responder', respuesta: 'Te lo dejo en 260.', articulo_id: art.id, motivo: 'ok', precio_ofrecido: 260, precio_comprometido: 260 };
  assert.equal(validarSalida({ salida: base, articulo: art, config }).accion, 'responder');
  const bajo = validarSalida({ salida: { ...base, respuesta: 'Vale, 240.', precio_comprometido: 240 }, articulo: art, config });
  assert.equal(bajo.accion, 'derivar');
  assert.match(bajo.correcciones.join(), /por debajo del mínimo/);
  const filtra = validarSalida({ salida: { ...base, respuesta: 'Lo mínimo que acepto son 250.', precio_comprometido: null }, articulo: art, config });
  assert.equal(filtra.accion, 'derivar');
  assert.match(filtra.correcciones.join(), /precio mínimo/);
  const noFiltra = validarSalida({ salida: { ...base, respuesta: 'Cuesta 280 y tiene 2500 mAh.', precio_comprometido: null }, articulo: art, config });
  assert.equal(noFiltra.accion, 'responder');
});

test('validarSalida convierte respuestas vacías en ignorar y recorta textos largos', () => {
  const vacia = validarSalida({ salida: { accion: 'responder', respuesta: '   ', motivo: 'x' }, articulo: null, config });
  assert.equal(vacia.accion, 'ignorar');
  const larga = validarSalida({ salida: { accion: 'responder', respuesta: 'a'.repeat(3000), motivo: 'x' }, articulo: null, config });
  assert.equal(larga.respuesta.length, 1900);
  const rara = validarSalida({ salida: { accion: 'volar', respuesta: 'x', motivo: 'x' }, articulo: null, config });
  assert.equal(rara.accion, 'derivar');
});

test('validarSalida no deja afirmar disponibilidad de un artículo vendido', () => {
  const vendido = { ...config.inventario[1], estado: 'vendido' };
  const r = validarSalida({ salida: { accion: 'responder', respuesta: 'Sí, está disponible.', motivo: 'x' }, articulo: vendido, config });
  assert.equal(r.accion, 'derivar');
  const ok = validarSalida({ salida: { accion: 'responder', respuesta: 'No, ya se vendió.', motivo: 'x' }, articulo: vendido, config });
  assert.equal(ok.accion, 'responder');
});

test('trocear respeta el límite de Messenger', () => {
  const partes = trocear(`${'palabra '.repeat(300)}\n${'otra '.repeat(300)}`, 500);
  assert.ok(partes.length >= 2);
  assert.ok(partes.every((p) => p.length <= 500));
  assert.deepEqual(trocear('corto'), ['corto']);
});
