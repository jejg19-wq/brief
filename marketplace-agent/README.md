# Agente de Marketplace con Claude

Servicio en Node.js que recibe los mensajes de compradores de Facebook Marketplace que llegan a una **Página de Facebook** y los responde con Claude: disponibilidad, precio, condición, forma de entrega y pago, regateo dentro de un límite que tú fijas, y derivación a ti cuando el comprador quiere cerrar cita, dice que pagó o pregunta algo que no está en tu información.

Antes de leer nada más, lo importante:

- **Funciona con anuncios publicados desde una Página de Facebook**, que son los que Meta entrega por la Messenger Platform. Los anuncios de un **perfil personal no tienen API**: Meta no envía esos chats a ningún webhook y automatizarlos exige un bot de navegador sobre tu cuenta, que va contra las condiciones de Facebook y puede costarte la cuenta. Ese camino no está incluido.
- Para el perfil personal (o mientras configuras la Página) está el **Copiloto**: subes una captura del chat o pegas los mensajes, Claude redacta la respuesta y tú la copias en Messenger. Sirve desde el primer minuto y no necesita nada de Meta.
- El modo por defecto es **borrador**: el agente redacta y tú apruebas cada respuesta desde el panel. Cuando confíes en él, lo pasas a **auto**.

## Cómo funciona

```
Comprador escribe en Marketplace ──▶ Meta manda el webhook ──▶ este servidor
                                                                  │
                            reglas duras (dedup, pausas, límites) │
                                                                  ▼
                       Claude decide: responder / derivar / ignorar (salida estructurada)
                                                                  │
                            reglas duras (precio mínimo, artículo vendido, longitud)
                                                                  ▼
                    modo auto ──▶ Send API de Messenger      modo borrador ──▶ panel, tú apruebas
```

Detalles que evitan sustos:

- **Si respondes tú a mano** desde la bandeja de la Página o Messenger, el agente lo detecta por el eco del webhook, descarta sus borradores y calla en ese hilo dos horas (configurable). Desde el panel puedes reanudarlo o silenciarlo del todo.
- **Precio mínimo confidencial** por artículo. El modelo lo conoce para regatear pero tiene prohibido mencionarlo; si aun así lo hace o acepta menos, la regla lo intercepta y deriva.
- **Agrupa mensajes seguidos** del mismo comprador (espera 4 s) para responder una sola vez.
- **Dedup** de los reintentos de Meta, firma HMAC de cada webhook, tope de respuestas por hora y por comprador.
- **Estafas típicas** (códigos por SMS, pago adelantado con envío por empresa, enlaces): el prompt las contempla y deriva.
- Sin `PAGE_ACCESS_TOKEN` el servicio arranca en **modo simulado**: no toca Facebook y puedes probar todo el flujo desde el panel.

## Puesta en marcha local

Requiere Node.js 22 o superior.

```bash
cd marketplace-agent
npm ci
cp .env.example .env      # rellena ANTHROPIC_API_KEY y DASHBOARD_PASSWORD como mínimo
npm start
```

Abre `http://localhost:3000`, entra con cualquier usuario y la contraseña del panel. Como aún no hay token de Meta, verás el formulario **Simular un comprador**: escribe como si fueras un comprador y mira qué redacta el agente.

Para probar la personalidad del agente en la terminal, jugando tú de comprador:

```bash
npm run probar
```

## Usarlo desde el teléfono con tu perfil personal

Marketplace se atiende desde el teléfono, así que el Copiloto tiene que estar a mano ahí:

1. Arranca `npm start` en tu computadora y averigua su IP en la red local (`ipconfig` en Windows, `ifconfig` o Ajustes de red en Mac). En el teléfono, conectado al mismo Wi-Fi, abre `http://ESA-IP:3000/copiloto` y guárdalo como acceso directo en la pantalla de inicio.
2. Cuando un comprador escriba: captura de pantalla del chat, abre el Copiloto, elige la captura, pulsa *Redactar respuesta*, *Copiar respuesta* y pégala en Messenger.
3. Si quieres que funcione fuera de casa, despliega el servicio en la nube (sección *Desplegar*) y usa esa URL. El panel pide contraseña, pero no lo dejes sin `DASHBOARD_PASSWORD`.

Lo que **no** hace en un perfil personal: responder solo. Meta no entrega esos chats a ningún webhook y automatizarlos con un bot de navegador sobre tu cuenta va contra sus condiciones y puede acabar en bloqueo.

## Configurar tu negocio

Dos archivos JSON en `config/`. Se recargan solos al guardarlos, sin reiniciar.

**`config/negocio.json`**: quién vende, ciudad, zona de entrega, envíos, métodos de pago, horario, tono, reglas extra, preguntas frecuentes y la lista `escalar_si` de situaciones en las que el agente debe pasarte el hilo.

**`config/inventario.json`**: un objeto por anuncio.

| Campo | Uso |
|---|---|
| `id` | Identificador corto (aparece en el panel y en los motivos) |
| `titulo` | Tal cual en Marketplace; sirve para reconocer de qué anuncio habla el comprador |
| `precio` | Precio publicado |
| `precio_minimo` | Lo mínimo que aceptas. Nunca se revela. Si falta, es igual al precio |
| `negociable` | `true` permite aceptar ofertas entre el mínimo y el precio |
| `estado` | `disponible`, `reservado` o `vendido` |
| `condicion`, `detalles` | Lo que el agente puede contar |
| `palabras_clave` | Ayudan a identificar el artículo cuando el comprador no viene desde el anuncio |
| `notas_para_el_agente` | Contexto interno; lo usa para responder pero no lo pega literal |

Cuando vendes algo, cambia su `estado` a `vendido` y guarda. Listo.

## Conectar la Página de Facebook (Meta for Developers)

1. Publica los anuncios **desde la Página** (Marketplace → vender como Página). Si Marketplace no te deja vender como Página en tu país o categoría, este canal no está disponible para ti; usa el Copiloto.
2. En [developers.facebook.com](https://developers.facebook.com) crea una app de tipo **Empresa** y añade el producto **Messenger**.
3. En *Configuración de la app → Información básica* copia el **ID de la app** y la **Clave secreta** a `APP_ID` y `APP_SECRET`.
4. En *Messenger → Configuración*, vincula tu Página y **genera el token de acceso** → `PAGE_ACCESS_TOKEN`. Añade a la app los permisos `pages_messaging` y `pages_manage_metadata`.
5. Despliega este servicio en una URL pública con HTTPS (abajo). En *Webhooks* pon `https://TU-DOMINIO/webhook`, el mismo texto que pusiste en `VERIFY_TOKEN`, y suscribe los campos `messages`, `messaging_postbacks`, `message_echoes` y `messaging_referrals`. Meta hará un GET de verificación; si `VERIFY_TOKEN` coincide, queda activo.
6. Suscribe la Página a la app (botón *Añadir suscripciones* junto a la Página, o `POST /{page-id}/subscribed_apps`).
7. Mientras la app esté en modo desarrollo solo llegan mensajes de las personas con rol en la app (tú mismo y quien añadas como probador). Para atender a cualquier comprador, solicita la **revisión de la app** con el permiso `pages_messaging` explicando que es un asistente de respuestas para tu propia Página.

Comprueba `https://TU-DOMINIO/api/health`: debe mostrar `"messenger": "graph-api"` y `verifyToken` y `appSecret` en `true`.

Nota: el formato exacto con el que Meta identifica el anuncio de origen (`referral`) no está documentado de forma estable. El agente lo usa si llega y, si no, reconoce el artículo por el texto del comprador o le pregunta cuál le interesa. Cuando conectes la Página, mira en los logs qué trae el primer webhook real y, si incluye un id de producto de Meta, añádelo al artículo como `meta_id` para que la asociación sea directa.

## Desplegar

Cualquier host que ejecute un contenedor con un disco persistente sirve (Railway, Render, Fly.io, un VPS con Docker). El estado vive en `DATA_DIR/estado.json`; sin disco persistente se pierde el historial en cada despliegue, aunque el servicio sigue funcionando.

```bash
docker build -t marketplace-agent .
docker run -d --name marketplace-agent -p 3000:3000 -v marketplace-data:/data --env-file .env marketplace-agent
```

Para probar el webhook desde tu máquina antes de desplegar, expón el puerto con un túnel (`ngrok http 3000` o `cloudflared tunnel --url http://localhost:3000`) y usa esa URL en Meta.

## Panel

- **Conversaciones**: lista con estado (automático, borradores, pausado, manual) y borradores pendientes.
- **Conversación**: historial, borradores con el motivo del agente para editarlos, enviarlos o descartarlos; botones *Tomar el chat*, *Reanudar bot*, *Automático solo aquí*; caja para responder tú por Messenger; últimas alertas.
- **Copiloto**: sube una captura de pantalla del chat (PNG, JPG o WebP, hasta 5 MB) o pega los mensajes (una línea por mensaje; las tuyas empiezan por `yo:`), obtén la respuesta y cópiala. No guarda nada.
- **/api/health**: estado público sin datos personales.

## Variables de entorno

Están todas comentadas en `.env.example`. Las imprescindibles: `ANTHROPIC_API_KEY`, `DASHBOARD_PASSWORD`, y para Meta `PAGE_ACCESS_TOKEN`, `APP_SECRET`, `VERIFY_TOKEN`.

El modelo por defecto es `claude-opus-5` con esfuerzo `medium` y caché de prompt activada, y con los *fallbacks* de servidor de Anthropic activados (si Claude Opus 5 rechaza un mensaje por sus filtros, Anthropic reintenta en otro modelo dentro de la misma llamada). Para bajar coste, `CLAUDE_MODEL=claude-sonnet-5`.

## Pruebas

```bash
npm test
```

Cubren la firma y el parseo del webhook, las reglas (ecos, pausas, límites, precio mínimo, artículo vendido), la construcción del prompt y el manejo de rechazos con un cliente falso, el almacén, el orquestador (agrupación, borradores, duplicados, intervención humana) y el servidor (verificación, firma, panel, copiloto). No llaman a Claude ni a Meta.

## Límites que conviene saber

- Solo texto. Si el comprador manda una foto o un audio, el agente lo ve como "adjunto" y suele derivar.
- El panel es para una persona: contraseña única, sin cuentas ni roles.
- Ventana de 24 horas de Messenger: el agente responde al momento, así que no aplica; si tú escribes al comprador días después desde el panel, Meta puede rechazarlo.
- La calidad de las respuestas depende de lo que pongas en `negocio.json` e `inventario.json`. Lo que no esté ahí, el agente no lo inventa: deriva.
