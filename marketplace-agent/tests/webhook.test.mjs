import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { firmaValida, responderVerificacion, extraerEventos } from '../src/webhook.mjs';

const firmar = (cuerpo, secreto) => `sha256=${crypto.createHmac('sha256', secreto).update(cuerpo).digest('hex')}`;

test('firmaValida acepta la firma correcta y rechaza el resto', () => {
  const cuerpo = Buffer.from('{"object":"page"}');
  assert.equal(firmaValida(cuerpo, firmar(cuerpo, 'abc'), 'abc'), true);
  assert.equal(firmaValida(cuerpo, firmar(cuerpo, 'otra'), 'abc'), false);
  assert.equal(firmaValida(cuerpo, 'sha256=zz', 'abc'), false);
  assert.equal(firmaValida(cuerpo, undefined, 'abc'), false);
  assert.equal(firmaValida(cuerpo, firmar(cuerpo, ''), ''), false, 'sin APP_SECRET nunca valida');
});

test('responderVerificacion devuelve el reto solo con el token correcto', () => {
  const q = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': 'v', 'hub.challenge': '123' });
  assert.deepEqual(responderVerificacion(q, 'v'), { ok: true, reto: '123' });
  assert.equal(responderVerificacion(q, 'x').ok, false);
  assert.equal(responderVerificacion(q, '').ok, false);
});

test('extraerEventos normaliza mensajes, ecos, adjuntos, postbacks y referrals', () => {
  const body = {
    object: 'page',
    entry: [{
      id: 'PAGE',
      time: 1,
      messaging: [
        { sender: { id: 'U1' }, recipient: { id: 'PAGE' }, timestamp: 10, message: { mid: 'm1', text: 'hola' } },
        { sender: { id: 'PAGE' }, recipient: { id: 'U1' }, timestamp: 11, message: { mid: 'm2', text: 'respondo yo', is_echo: true, app_id: 999 } },
        { sender: { id: 'U2' }, recipient: { id: 'PAGE' }, timestamp: 12, message: { mid: 'm3', attachments: [{ type: 'image', payload: { url: 'http://x/y.jpg' } }] } },
        { sender: { id: 'U3' }, recipient: { id: 'PAGE' }, timestamp: 13, postback: { mid: 'm4', title: 'Empezar', payload: 'GET_STARTED' } },
        { sender: { id: 'U4' }, recipient: { id: 'PAGE' }, timestamp: 14, message: { mid: 'm5', text: '¿Sigue?', referral: { source: 'MARKETPLACE', type: 'OPEN_THREAD', product: { id: 'prod-1' } } } },
        { sender: { id: 'U5' }, recipient: { id: 'PAGE' }, timestamp: 15, read: { watermark: 1 } },
        { sender: { id: 'U6' }, recipient: { id: 'PAGE' }, timestamp: 16, message: { mid: 'm6', is_deleted: true } },
      ],
    }],
  };
  const ev = extraerEventos(body);
  assert.equal(ev.length, 7);
  assert.deepEqual([ev[0].tipo, ev[0].psid, ev[0].texto, ev[0].mid], ['mensaje', 'U1', 'hola', 'm1']);
  assert.deepEqual([ev[1].tipo, ev[1].psid, ev[1].appId, ev[1].esEco], ['eco', 'U1', '999', true]);
  assert.deepEqual([ev[2].tipo, ev[2].texto, ev[2].adjuntos[0].tipo, ev[2].adjuntos[0].url], ['mensaje', '', 'image', 'http://x/y.jpg']);
  assert.deepEqual([ev[3].tipo, ev[3].texto, ev[3].payload], ['postback', 'Empezar', 'GET_STARTED']);
  assert.deepEqual([ev[4].referral.origen, ev[4].referral.productoId], ['MARKETPLACE', 'prod-1']);
  assert.equal(ev[5].tipo, 'otro');
  assert.equal(ev[6].tipo, 'otro');
});

test('extraerEventos ignora cuerpos que no son de página', () => {
  assert.deepEqual(extraerEventos({ object: 'user' }), []);
  assert.deepEqual(extraerEventos(null), []);
  assert.deepEqual(extraerEventos({ object: 'page', entry: [{ messaging: [{ sender: {} }] }] }), []);
});
