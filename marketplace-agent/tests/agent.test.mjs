import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentePrueba, mensajeComprador } from './ayuda.mjs';

test('en modo auto agrupa mensajes seguidos y envía una sola respuesta', async () => {
  const { agente, messenger, cerebro, almacen } = agentePrueba();
  await agente.procesarEvento(mensajeComprador('U1', 'hola'));
  await agente.procesarEvento(mensajeComprador('U1', 'sigue disponible el iphone?'));
  await agente.esperar();
  assert.equal(cerebro.llamadas.length, 1);
  assert.equal(messenger.enviados.length, 1);
  assert.equal(messenger.enviados[0].texto, 'Sí, disponible.');
  const conv = almacen.conversacion('U1');
  assert.equal(conv.articuloId, 'iphone-12-128');
  assert.deepEqual(conv.mensajes.map((m) => m.rol), ['comprador', 'comprador', 'vendedor']);
  assert.equal(conv.respuestasRecientes.length, 1);
  assert.ok(almacen.fueEnviadoPorNosotros(messenger.enviados[0].mid));
});

test('en modo borrador no envía nada hasta que se aprueba', async () => {
  const { agente, messenger, almacen } = agentePrueba({ env: { MODO: 'borrador' } });
  await agente.procesarEvento(mensajeComprador('U1', 'precio?'));
  await agente.esperar();
  assert.equal(messenger.enviados.length, 0);
  const conv = almacen.conversacion('U1');
  assert.equal(conv.borradores.length, 1);
  await agente.enviarBorrador('U1', conv.borradores[0].id, 'Sí, disponible. Te lo dejo en 280.');
  assert.equal(messenger.enviados.length, 1);
  assert.equal(conv.borradores.length, 0);
  assert.equal(conv.mensajes.at(-1).origen, 'humano', 'un borrador editado cuenta como respuesta humana');
});

test('los mensajes duplicados (reintentos de Meta) se procesan una sola vez', async () => {
  const { agente, cerebro } = agentePrueba();
  const ev = mensajeComprador('U1', 'hola');
  assert.equal((await agente.procesarEvento(ev)).resultado, 'programado');
  assert.equal((await agente.procesarEvento(ev)).resultado, 'duplicado');
  await agente.esperar();
  assert.equal(cerebro.llamadas.length, 1);
});

test('si el vendedor responde a mano, el bot se calla y descarta borradores', async () => {
  const { agente, almacen, messenger, config } = agentePrueba({ env: { MODO: 'borrador' } });
  await agente.procesarEvento(mensajeComprador('U1', 'hola'));
  await agente.esperar();
  assert.equal(almacen.conversacion('U1').borradores.length, 1);
  const r = await agente.procesarEvento({ tipo: 'eco', psid: 'U1', mid: 'eco-1', texto: 'Hola! sí está', appId: null, esEco: true, adjuntos: [], timestamp: Date.now() });
  assert.equal(r.resultado, 'pausado');
  const conv = almacen.conversacion('U1');
  assert.equal(conv.borradores.length, 0);
  assert.ok(conv.pausadoHasta > Date.now() + (config.pausaTrasHumanoMin - 1) * 60_000);
  assert.equal(conv.mensajes.at(-1).origen, 'humano');
  const r2 = await agente.procesarEvento(mensajeComprador('U1', 'a qué hora?'));
  assert.equal(r2.resultado, 'registrado');
  await agente.esperar();
  assert.equal(messenger.enviados.length, 0);
  agente.cambiarModo('U1', 'reanudar');
  assert.equal(conv.pausadoHasta, 0);
});

test('el eco de nuestro propio envío no pausa el bot', async () => {
  const { agente, messenger, almacen } = agentePrueba();
  await agente.procesarEvento(mensajeComprador('U1', 'hola'));
  await agente.esperar();
  const mid = messenger.enviados[0].mid;
  const r = await agente.procesarEvento({ tipo: 'eco', psid: 'U1', mid, texto: 'Sí, disponible.', appId: null, esEco: true, adjuntos: [], timestamp: Date.now() });
  assert.equal(r.resultado, 'duplicado');
  assert.equal(almacen.conversacion('U1').pausadoHasta, 0);
});

test('derivar envía el mensaje de espera y pausa el hilo para el humano', async () => {
  const { agente, messenger, almacen } = agentePrueba({ respuestas: [{ accion: 'derivar', respuesta: 'Dame un momento y te confirmo.', motivo: 'quiere fijar hora' }] });
  await agente.procesarEvento(mensajeComprador('U1', 'nos vemos hoy a las 5?'));
  await agente.esperar();
  assert.equal(messenger.enviados[0].texto, 'Dame un momento y te confirmo.');
  const conv = almacen.conversacion('U1');
  assert.ok(conv.pausadoHasta > Date.now());
  assert.match(conv.alertas.at(-1).motivo, /fijar hora/);
});

test('las reglas corrigen al modelo: aceptar bajo el mínimo se convierte en derivación', async () => {
  const { agente, messenger, almacen } = agentePrueba({ respuestas: [{ accion: 'responder', respuesta: 'Vale, 200 está bien.', articulo_id: 'iphone-12-128', motivo: 'acepta', precio_ofrecido: 200, precio_comprometido: 200 }] });
  await agente.procesarEvento(mensajeComprador('U1', 'te doy 200 por el iphone'));
  await agente.esperar();
  assert.equal(messenger.enviados[0].texto, 'Vale, 200 está bien.', 'el texto de espera se envía igual, pero…');
  assert.match(almacen.conversacion('U1').alertas.at(-1).motivo, /por debajo del mínimo/);
  assert.ok(almacen.conversacion('U1').pausadoHasta > Date.now());
});

test('un error de Claude deja alerta y no rompe el resto', async () => {
  const { agente, almacen } = agentePrueba({ respuestas: [new Error('API caída')] });
  await agente.procesarEvento(mensajeComprador('U1', 'hola'));
  await assert.rejects(agente.esperar(), /API caída/);
  assert.match(almacen.conversacion('U1').alertas.at(-1).motivo, /API caída/);
});

test('modo humano por conversación evita llamar al modelo; responderManual envía', async () => {
  const { agente, messenger, cerebro, almacen } = agentePrueba();
  agente.cambiarModo('U1', 'humano');
  const r = await agente.procesarEvento(mensajeComprador('U1', 'hola'));
  assert.equal(r.resultado, 'registrado');
  await agente.esperar();
  assert.equal(cerebro.llamadas.length, 0);
  await agente.responderManual('U1', 'Hola, dime');
  assert.equal(messenger.enviados[0].texto, 'Hola, dime');
  assert.equal(almacen.conversacion('U1').mensajes.at(-1).origen, 'humano');
  assert.throws(() => agente.cambiarModo('U1', 'raro'));
});

test('copiloto interpreta un hilo pegado y no guarda nada', async () => {
  const { agente, cerebro, almacen } = agentePrueba({ env: { MODO: 'borrador' } });
  const r = await agente.copiloto('Hola, sigue disponible el monitor?\nyo: Sí\n¿Me lo dejas en 100?');
  assert.equal(r.accion, 'responder');
  const conv = cerebro.llamadas[0].conv;
  assert.deepEqual(conv.mensajes.map((m) => m.rol), ['comprador', 'vendedor', 'comprador']);
  assert.equal(cerebro.llamadas[0].opciones.articuloSugerido.id, 'monitor-lg-27');
  assert.equal(almacen.listar().length, 0);
  await assert.rejects(agente.copiloto('   '), /al menos un mensaje/);
});
