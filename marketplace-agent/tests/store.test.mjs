import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Almacen } from '../src/store.mjs';
import { silencio } from './ayuda.mjs';

test('el almacén persiste y recarga conversaciones y mids', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-'));
  const ruta = path.join(dir, 'sub', 'estado.json');
  const a = new Almacen(ruta, { logger: silencio });
  a.agregarMensaje('U1', { rol: 'comprador', texto: 'hola', origen: 'facebook' });
  a.agregarBorrador('U1', { texto: 'b', motivo: 'm', accion: 'responder' });
  a.marcarProcesado('m1');
  a.registrarEnviado('s1');
  a.guardar();
  const b = new Almacen(ruta, { logger: silencio });
  assert.equal(b.conversacion('U1').mensajes[0].texto, 'hola');
  assert.equal(b.conversacion('U1').borradores.length, 1);
  assert.ok(b.yaProcesado('m1'));
  assert.ok(b.fueEnviadoPorNosotros('s1'));
  assert.equal(b.yaProcesado('otro'), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('un archivo corrupto no impide arrancar', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-'));
  const ruta = path.join(dir, 'estado.json');
  fs.writeFileSync(ruta, '{ esto no es json');
  const a = new Almacen(ruta, { logger: silencio });
  assert.deepEqual(a.listar(), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('los mids procesados se recortan y las listas se ordenan por actividad', () => {
  const a = new Almacen(null, { logger: silencio });
  for (let i = 0; i < 3500; i++) a.marcarProcesado(`m${i}`);
  assert.equal(a.datos.midsProcesados.length, 3000);
  assert.equal(a.yaProcesado('m0'), false);
  assert.equal(a.yaProcesado('m3499'), true);
  const ahora = Date.now();
  a.agregarMensaje('A', { rol: 'comprador', texto: '1', origen: 'f', ts: ahora + 100 });
  a.agregarMensaje('B', { rol: 'comprador', texto: '2', origen: 'f', ts: ahora + 200 });
  assert.equal(a.listar()[0].psid, 'B');
  assert.equal(a.quitarBorrador('A', 'no-existe'), null);
});
