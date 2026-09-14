#!/usr/bin/env node
/**
 * Chat de prueba en la terminal: tú haces de comprador y ves qué decide el agente.
 * No toca Facebook ni guarda nada. Necesita ANTHROPIC_API_KEY.
 *
 *   npm run probar
 *   /articulo iphone-12-128   fija el artículo del hilo
 *   /reset                    empieza un hilo nuevo
 *   /salir
 */
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { cargarConfig } from '../src/config.mjs';
import { Cerebro } from '../src/brain.mjs';
import { validarSalida, detectarArticulo } from '../src/policy.mjs';

const config = cargarConfig();
const cerebro = new Cerebro({ config });
const rl = readline.createInterface({ input: stdin, output: stdout });

let conv = { psid: 'prueba', mensajes: [], articuloId: null };
let totalIn = 0;
let totalOut = 0;

console.log(`Agente de ${config.negocio.vendedor} · modelo ${config.modelo} · ${config.inventario.length} artículos`);
console.log('Escribe como comprador. Comandos: /articulo <id>, /reset, /salir\n');

for (;;) {
  const linea = (await rl.question('comprador> ')).trim();
  if (!linea) continue;
  if (linea === '/salir') break;
  if (linea === '/reset') {
    conv = { psid: 'prueba', mensajes: [], articuloId: null };
    console.log('(hilo nuevo)\n');
    continue;
  }
  if (linea.startsWith('/articulo ')) {
    const id = linea.slice(10).trim();
    const art = config.inventario.find((a) => a.id === id);
    if (!art) {
      console.log(`no existe "${id}". Ids: ${config.inventario.map((a) => a.id).join(', ')}\n`);
      continue;
    }
    conv.articuloId = art.id;
    console.log(`(artículo del hilo: ${art.titulo})\n`);
    continue;
  }
  conv.mensajes.push({ rol: 'comprador', texto: linea, origen: 'manual', ts: Date.now() });
  if (!conv.articuloId) {
    const art = detectarArticulo({ texto: linea, inventario: config.inventario });
    if (art) conv.articuloId = art.id;
  }
  const articulo = conv.articuloId ? config.inventario.find((a) => a.id === conv.articuloId) : null;
  const inicio = Date.now();
  const { salida: cruda, uso } = await cerebro.decidir(conv, { articuloSugerido: articulo });
  const salida = validarSalida({ salida: cruda, articulo, config });
  if (uso) {
    totalIn += uso.input_tokens ?? 0;
    totalOut += uso.output_tokens ?? 0;
  }
  console.log(`\n  [${salida.accion}] ${salida.motivo}${salida.correcciones.length ? ` · reglas: ${salida.correcciones.join('; ')}` : ''}`);
  if (salida.precio_ofrecido != null) console.log(`  oferta detectada: ${salida.precio_ofrecido}`);
  if (uso) console.log(`  tokens: entrada ${uso.input_tokens} (caché ${uso.cache_read_input_tokens ?? 0}) · salida ${uso.output_tokens} · ${Date.now() - inicio} ms`);
  if (salida.respuesta) {
    console.log(`\nvendedor> ${salida.respuesta}\n`);
    conv.mensajes.push({ rol: 'vendedor', texto: salida.respuesta, origen: 'agente', ts: Date.now() });
  } else {
    console.log('\n(sin respuesta)\n');
  }
}
rl.close();
console.log(`Tokens totales: entrada ${totalIn}, salida ${totalOut}`);
