# Espacio de Ridchar 🧱

**El terreno propio de Ridchar dentro de este repositorio.** Todo lo suyo vive
aquí adentro, en `ridchar/`, separado de los otros proyectos: no comparte
archivos, ni estilos, ni configuración con el brief de Darling (raíz del repo)
ni con numan / ArqViz (`arqviz/`). Se puede borrar esta carpeta completa y
nada más del repositorio se entera.

| | |
|---|---|
| **Página** | https://jejg19-wq.github.io/brief/ridchar/ |
| **Qué es** | Un cuestionario de 18 preguntas para que Ridchar cuente qué quiere construir |
| **Cómo llega la respuesta** | Botón de WhatsApp (o copiar y pegar) |
| **Dónde quedan los reportes** | [`reportes/`](reportes/) |
| **Costo** | $0 — HTML plano en GitHub Pages, sin servidor ni base de datos |

## Cómo se usa

1. **Le mandas el enlace por WhatsApp.** Se abre en el teléfono, con vista
   previa (`og.png`) para que se vea serio y no como un link raro.
2. **Ridchar responde a su ritmo.** Cada respuesta se guarda sola en su propio
   teléfono (`localStorage`, con la clave `ridchar_*`): puede cerrar la página,
   irse a dormir y volver mañana sin perder nada. La barra de arriba va
   levantando una pared de ladrillos, uno por pregunta contestada.
3. **Al terminar toca un botón** y se abre WhatsApp con todas sus respuestas
   escritas y ordenadas, listas para enviar. Si WhatsApp no abre, el botón
   «Copiar mis respuestas» siempre funciona.
4. **Con eso se le arma su reporte** en `reportes/` (ver más abajo).

Las respuestas nunca salen de su teléfono por su cuenta: no hay formulario que
envíe a ningún servidor, no hay analítica, no hay cookies. Solo se mueven
cuando él toca el botón de enviar.

## Las 18 preguntas

| Parte | Preguntas | Para qué sirve |
|---|---|---|
| 01 · Quién eres tú | 1–2 | Con qué manos y qué talentos se construye |
| 02 · La idea | 3–7 | Qué es, de dónde salió, para quién, qué resuelve, qué existe ya |
| 03 · Cómo se ve funcionando | 8–10 | El recorrido paso a paso, la primera pieza, por dónde entra el dinero |
| 04 · Qué tienes en la mano | 11–14 | Lo hecho, horas reales, presupuesto real, nivel técnico |
| 05 · Hacia dónde vas | 15–18 | Éxito a 6 meses, miedos, por dónde empezar, cómo prefiere que le hablen |

La pregunta 09 («si solo pudiéramos construir UNA cosa este mes») es la más
importante de todas: de ahí sale el primer entregable real.

## Cambiar el número de WhatsApp

Está en una sola línea, al inicio del `<script>` de [`index.html`](index.html):

```js
const WHATSAPP = "584247481963";   // formato internacional, sin + ni ceros
```

## Los reportes

Cada vez que se haga algo para Ridchar — una idea evaluada, una página armada,
una investigación, un presupuesto — queda su reporte en
[`reportes/`](reportes/), con nombre `AAAA-MM-DD-tema.md`. La estructura está
en [`reportes/PLANTILLA-REPORTE.md`](reportes/PLANTILLA-REPORTE.md) y siempre
responde lo mismo, en este orden: qué se pidió, qué se hizo, qué encontré, qué
decidí y por qué, qué te toca a ti, y cuánto costó.

Escritos para que los entienda él, no para que suenen técnicos.

## Publicación

El workflow [`.github/workflows/ridchar-pages.yml`](../.github/workflows/ridchar-pages.yml)
publica la página en `gh-pages` bajo `/ridchar/` cada vez que se hace push a la
rama `claude/ridchar-primo-project-9mwtp8`. Sube **solo** `index.html` y
`og.png`: los reportes se quedan en el repositorio y **no** se publican en
internet. Tampoco toca nada de lo que ya vive en `gh-pages` (el brief de
Darling y `numan/`). Para dejar de publicar, basta borrar ese archivo.

## Estructura

```
ridchar/
├── index.html                    # el cuestionario (una sola página, sin dependencias)
├── og.png                        # vista previa del enlace en WhatsApp (1200×630)
└── reportes/
    ├── PLANTILLA-REPORTE.md      # estructura fija de todo reporte
    └── 2026-09-01-apertura-del-espacio.md
```
