import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { crearServidor } from '../src/server.mjs';
import { agentePrueba, silencio } from './ayuda.mjs';

const firmar = (cuerpo, secreto) => `sha256=${crypto.createHmac('sha256', secreto).update(cuerpo).digest('hex')}`;
const auth = { authorization: `Basic ${Buffer.from('x:clave').toString('base64')}` };

async function conServidor(fn, opciones = {}) {
  const deps = agentePrueba(opciones);
  const server = crearServidor({ ...deps, logger: silencio, messengerSimulado: true });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn({ base, ...deps });
  } finally {
    await deps.agente.esperar().catch(() => {});
    server.close();
  }
}

test('GET /webhook responde al reto solo con el token correcto', async () => {
  await conServidor(async ({ base }) => {
    const ok = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=verif&hub.challenge=4242`);
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), '4242');
    const mal = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=4242`);
    assert.equal(mal.status, 403);
  });
});

test('POST /webhook exige firma válida y procesa los mensajes', async () => {
  await conServidor(async ({ base, agente, messenger }) => {
    const body = JSON.stringify({ object: 'page', entry: [{ id: 'P', messaging: [{ sender: { id: 'U9' }, recipient: { id: 'P' }, timestamp: 1, message: { mid: 'mm', text: 'sigue disponible?' } }] }] });
    const sinFirma = await fetch(`${base}/webhook`, { method: 'POST', body, headers: { 'content-type': 'application/json' } });
    assert.equal(sinFirma.status, 403);
    const malFirma = await fetch(`${base}/webhook`, { method: 'POST', body, headers: { 'content-type': 'application/json', 'x-hub-signature-256': firmar(body, 'otro') } });
    assert.equal(malFirma.status, 403);
    const bien = await fetch(`${base}/webhook`, { method: 'POST', body, headers: { 'content-type': 'application/json', 'x-hub-signature-256': firmar(body, 'secreto') } });
    assert.equal(bien.status, 200);
    assert.equal(await bien.text(), 'EVENT_RECEIVED');
    await new Promise((r) => setTimeout(r, 30));
    await agente.esperar();
    assert.equal(messenger.enviados.length, 1);
    assert.equal(messenger.enviados[0].psid, 'U9');
    const roto = await fetch(`${base}/webhook`, { method: 'POST', body: '{', headers: { 'x-hub-signature-256': firmar('{', 'secreto') } });
    assert.equal(roto.status, 400);
  });
});

test('/api/health es público y el panel exige contraseña', async () => {
  await conServidor(async ({ base }) => {
    const salud = await fetch(`${base}/api/health`);
    assert.equal(salud.status, 200);
    const datos = await salud.json();
    assert.equal(datos.ok, true);
    assert.equal(datos.messenger, 'simulado');
    const panel = await fetch(`${base}/`);
    assert.equal(panel.status, 401);
    const malClave = await fetch(`${base}/`, { headers: { authorization: `Basic ${Buffer.from('x:mala').toString('base64')}` } });
    assert.equal(malClave.status, 401);
    const bien = await fetch(`${base}/`, { headers: auth });
    assert.equal(bien.status, 200);
    assert.match(await bien.text(), /Conversaciones/);
  });
});

test('el panel permite simular, ver, aprobar borradores y cambiar el modo', async () => {
  await conServidor(async ({ base, almacen, messenger, agente }) => {
    const sim = await fetch(`${base}/simular`, { method: 'POST', headers: { ...auth, 'content-type': 'application/x-www-form-urlencoded' }, body: 'psid=demo&texto=hola+precio+del+monitor', redirect: 'manual' });
    assert.equal(sim.status, 303);
    await agente.esperar();
    const conv = almacen.conversacion('demo');
    assert.equal(conv.borradores.length, 1);
    const detalle = await fetch(`${base}/c/demo`, { headers: auth });
    assert.equal(detalle.status, 200);
    const htmlDetalle = await detalle.text();
    assert.match(htmlDetalle, /Borradores pendientes/);
    assert.match(htmlDetalle, /Monitor LG/);
    const enviar = await fetch(`${base}/c/demo/enviar`, { method: 'POST', headers: { ...auth, 'content-type': 'application/x-www-form-urlencoded' }, body: `borrador=${conv.borradores[0].id}&texto=${encodeURIComponent('Cuesta 120, precio fijo.')}`, redirect: 'manual' });
    assert.equal(enviar.status, 303);
    assert.match(enviar.headers.get('location'), /ok=/);
    assert.equal(messenger.enviados[0].texto, 'Cuesta 120, precio fijo.');
    const modo = await fetch(`${base}/c/demo/modo`, { method: 'POST', headers: { ...auth, 'content-type': 'application/x-www-form-urlencoded' }, body: 'modo=humano', redirect: 'manual' });
    assert.equal(modo.status, 303);
    assert.equal(conv.modo, 'humano');
    const noExiste = await fetch(`${base}/c/nadie`, { headers: auth });
    assert.equal(noExiste.status, 404);
    const escapado = await fetch(`${base}/c/demo/manual`, { method: 'POST', headers: { ...auth, 'content-type': 'application/x-www-form-urlencoded' }, body: `texto=${encodeURIComponent('<b>hola</b>')}`, redirect: 'manual' });
    assert.equal(escapado.status, 303);
    const otraVez = await (await fetch(`${base}/c/demo`, { headers: auth })).text();
    assert.match(otraVez, /&lt;b&gt;hola&lt;\/b&gt;/);
    assert.doesNotMatch(otraVez, /<b>hola<\/b>/);
  }, { env: { MODO: 'borrador' } });
});

test('el copiloto devuelve una respuesta sin tocar el almacén', async () => {
  await conServidor(async ({ base, almacen }) => {
    const r = await fetch(`${base}/copiloto`, { method: 'POST', headers: { ...auth, 'content-type': 'application/x-www-form-urlencoded' }, body: `hilo=${encodeURIComponent('sigue disponible la bici?')}` });
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Sí, disponible\./);
    assert.equal(almacen.listar().length, 0);
  });
});

test('el copiloto acepta una captura por multipart y rechaza formatos raros', async () => {
  await conServidor(async ({ base, cerebro }) => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    const form = new FormData();
    form.set('hilo', '');
    form.set('captura', new Blob([png], { type: 'image/png' }), 'chat.png');
    const r = await fetch(`${base}/copiloto`, { method: 'POST', headers: auth, body: form });
    assert.equal(r.status, 200);
    const pagina = await r.text();
    assert.match(pagina, /leído de la captura/);
    assert.match(pagina, /Sí, disponible\./);
    const conv = cerebro.llamadas[0].conv;
    assert.equal(conv.mensajes[0].imagen.media_type, 'image/png');
    assert.equal(conv.mensajes[0].imagen.data, png.toString('base64'));

    const malo = new FormData();
    malo.set('hilo', '');
    malo.set('captura', new Blob([Buffer.from('hola')], { type: 'text/plain' }), 'nota.txt');
    const r2 = await fetch(`${base}/copiloto`, { method: 'POST', headers: auth, body: malo });
    assert.match(await r2.text(), /no admitido/);
    assert.equal(cerebro.llamadas.length, 1);

    const vacio = new FormData();
    vacio.set('hilo', '');
    const r3 = await fetch(`${base}/copiloto`, { method: 'POST', headers: auth, body: vacio });
    assert.match(await r3.text(), /al menos un mensaje/);

    const soloTexto = new FormData();
    soloTexto.set('hilo', 'precio de la bici?');
    const r4 = await fetch(`${base}/copiloto`, { method: 'POST', headers: auth, body: soloTexto });
    assert.match(await r4.text(), /Sí, disponible\./);
    assert.equal(cerebro.llamadas.at(-1).conv.mensajes[0].imagen, undefined);
  });
});
