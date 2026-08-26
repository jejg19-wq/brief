# numan estudio 3D 📐✨

**Del plano al render fotorrealista y al video recorrido, en minutos.**

Aplicación web personalizada para el estudio de arquitectura **numan**
(verde de marca `#0B4A3A`): sube un plano arquitectónico (PNG/JPG) y genera
renders fotorrealistas por ambiente y videos recorrido con IA, listos para
presentar al cliente. Incluye un panel de costos que registra cuánto gasta cada
generación en USD y calcula cuánto facturar con tu margen.

| Función | Modelo | Vía | Costo aprox. |
|---|---|---|---|
| Plano → render fotorrealista | Nano Banana Pro (Google Gemini 3 Pro Image) | fal.ai | $0.15/imagen ($0.30 en 4K) |
| Render → video recorrido | Seedance Pro (ByteDance) | fal.ai | ≈ $0.74 por 5 s en 1080p |
| Video borrador (rápido/barato) | Seedance Pro Fast | fal.ai | ≈ $0.24 por 5 s en 1080p |

> Los costos son estimaciones según el pricing publicado por fal.ai y se
> configuran en [`lib/models.ts`](lib/models.ts). El panel inferior de la app
> suma todo y exporta un CSV para facturar.

## Modo demo (ver la app sin pagar nada)

Si la variable `FAL_KEY` **no** está configurada, la app arranca en **modo
demo**: todo el flujo funciona — proyectos, plano, renders, videos, panel de
costos — con generaciones de muestra con la marca numan y costo $0. Cada
tarjeta muestra cuánto costaría esa generación en real, así puedes presentar
la app y proyectar el gasto antes de activar nada. Para pasar a real solo hay
que agregar la `FAL_KEY`; no se toca código.

## Cómo funciona

1. **Crea un proyecto** (nombre + cliente).
2. **Sube el plano** — se almacena en fal storage y sirve como imagen de
   referencia para los modelos.
3. **Elige espacios, estilo e iluminación** — la app construye prompts
   profesionales de visualización arquitectónica y genera un render por espacio.
4. **Convierte cualquier render en video** — recorrido, órbita, paneo o
   revelación, con prompts que siguen las buenas prácticas de Seedance
   (cámara separada del sujeto, timeline, constraints anti-morphing).
5. **Panel de costos** — costo API real, margen configurable (x3 por defecto)
   y exportación a CSV.

Los proyectos se guardan en el navegador (`localStorage`): no hay base de
datos que mantener y los datos del arquitecto no salen de su máquina
(las imágenes generadas viven en el CDN de fal).

## Puesta en marcha

### 1. Clave de fal.ai

Crea una cuenta en [fal.ai](https://fal.ai), agrega un método de pago y genera
una clave en **Dashboard → Keys**.

### 2. Desarrollo local

```bash
cd arqviz
cp .env.example .env.local   # y pega tu FAL_KEY
npm install
npm run dev                  # http://localhost:3000
```

### 3. Deploy en Vercel (el hosting es gratis; solo se paga lo que se genera en fal)

1. Importa este repositorio en [vercel.com/new](https://vercel.com/new).
2. En **Root Directory** selecciona `arqviz`.
3. En **Environment Variables** agrega `FAL_KEY` con tu clave.
4. Deploy. Sin `FAL_KEY` el sitio queda en modo demo (ideal para
   enseñárselo al cliente); al agregarla se activa el modo real. La clave
   vive solo en el servidor, nunca en el navegador.

## Arquitectura

```
arqviz/
├── app/
│   ├── page.tsx              # entrada → <Studio />
│   ├── layout.tsx            # metadata + estilos globales
│   └── api/
│       ├── upload/route.ts   # plano → fal storage (valida tipo y tamaño)
│       ├── generate/route.ts # encola la generación (whitelist de modelos)
│       └── status/route.ts   # polling del estado + URLs del resultado
├── components/Studio.tsx     # toda la UI (proyectos, renders, videos, costos)
└── lib/
    ├── models.ts             # registro de modelos fal + costos configurables
    ├── prompts.ts            # constructores de prompts (render y video)
    ├── store.ts              # persistencia en localStorage
    ├── demo.ts               # modo demo: placeholders de marca sin costo
    ├── fal.ts                # cliente fal server-side
    └── types.ts
```

Las generaciones usan la **cola** de fal (`queue.submit` → `queue.status`), así
los videos largos no chocan con el límite de tiempo de las funciones de Vercel.

## Ajustar modelos o precios

Todo vive en `lib/models.ts`. Para cambiar de versión de Seedance (por ejemplo
a Seedance 2.0 cuando quieras 4K) basta cambiar el `id` del endpoint y las
tarifas; la whitelist del server y el ledger se actualizan solos.

## Roadmap sugerido

- [ ] Análisis automático del plano (detectar ambientes con un modelo de visión)
- [ ] Variantes A/B del mismo espacio con distintos estilos en un clic
- [ ] Página pública de presentación por proyecto para compartir con el cliente
- [ ] Login multi-usuario + base de datos si el estudio crece
