# numan estudio 3D versión 2

Actualización del código original para conservar el diseño arquitectónico al aplicar materiales, revisar resultados y preparar entregas. La aplicación necesita un servidor Next.js. Abrir un HTML o subirla a GitHub Pages no activa la generación.

## Estado de esta entrega

- Código basado en `arqviz/` del repositorio `jejg19-wq/brief`. Se verificó que esa carpeta era idéntica en la rama documentada y en el commit de producción `10debee7c4e42dacc5e9d87a30400c263239f9b0`.
- Versión 2 implementada y compilada; pruebas automatizadas incluidas.
- La web `https://arqviz-zeta.vercel.app` respondió `demo:false` el 11 de septiembre de 2026. Eso demuestra que tiene una clave configurada, no que disponga de saldo ni que todos los modelos respondan.
- **Esta entrega no se ha publicado.** GitHub rechazó crear una rama con HTTP 403 `Resource not accessible by integration`. No se cambió el sitio actual.
- No se incluyeron claves ni se realizaron generaciones facturables. Se necesita una prueba real tras publicar para verificar saldo, acceso a modelos y calidad con un proyecto del arquitecto.

## Puesta en marcha

Requiere Node.js 22 o posterior y una cuenta fal.ai con acceso a los modelos y saldo.

```bash
npm ci
```

Crear `.env.local` a partir de `.env.example` y configurar `FAL_KEY`. El estudio y sus rutas de generación salen protegidos de fábrica con la contraseña `decostone` (usuario libre, por ejemplo `numan`); para cambiarla, definir `STUDIO_PASSWORD`. Nunca usar `NEXT_PUBLIC_FAL_KEY`.

```bash
npm run build
npm run start
```

Abrir `http://localhost:3000`. Sin `FAL_KEY`, la app funciona en demo; sus resultados son muestras, no renders reales. Los proyectos se guardan en ese navegador y origen.

## Actualizar la instalación existente en Vercel

1. Hacer un respaldo de los proyectos desde el navegador habitual. Conservar una copia del código actual y anotar el despliegue anterior para poder revertirlo.
2. Sustituir únicamente la carpeta `arqviz` del repositorio por esta carpeta. No sustituir la raíz del repositorio ni los otros proyectos.
3. Publicar los cambios en la rama que Vercel utiliza realmente para producción. La última producción consultada corresponde al commit de `claude/brief-dinamico-humanizado-o0m3gw`, aunque el informe inicial indicaba otra rama. Verificar la configuración en Vercel antes del despliegue.
4. Mantener `Root Directory: arqviz` y la variable `FAL_KEY` ya configurada. La contraseña de fábrica es `decostone`; para usar otra, añadir `STUDIO_PASSWORD` en el entorno de producción y redesplegar.
5. Verificar `/api/health` tras autenticarse: debe mostrar `version: 2.0.0`, `fidelity: server-enforced` y `demo: false`.
6. Probar una vista real en 1K o 2K, revisar geometría y materiales, aprobarla y probar su enlace. Después probar un video de 5 segundos. Los precios de la interfaz son estimaciones, no límites de gasto ni cargos confirmados.

Mantener el mismo dominio conserva el acceso a los proyectos de ese navegador. Si se cambia el dominio, exportar e importar el respaldo. Los enlaces del portal son públicos para quien los tenga; no incluyen los planos fuente por defecto.

## Mejoras principales

- Reglas de fidelidad construidas en el servidor y enviadas también como `system_prompt`. Se ignoran los prompts y parámetros arbitrarios enviados por el cliente.
- Cámara y proporción automática del original, una imagen por solicitud, búsqueda web desactivada y validación de los modelos y referencias admitidas.
- Original como estilo e iluminación predeterminados para fotos y vistas 3D; no se pide añadir objetos decorativos. Las muestras se usan solo para materiales.
- Nano Banana Pro y Nano Banana 2 en fotos y vistas 3D. Se puede regenerar la misma referencia con cada uno y compararlos. No se afirma que alguno sea universalmente el mejor.
- Biblioteca de hasta seis muestras reales de materiales por proyecto y especificaciones compartidas entre vistas.
- Resultados pendientes de revisión, comparador original/resultado, observaciones y aprobación o rechazo. Los resultados históricos también necesitan revisión; las muestras demo no se aprueban.
- Plano a render expresamente conceptual. No se presenta una vista inferida como reconstrucción dimensional.
- Decostone exige muestra real y selección de pared. Tras generar, compone el resultado con la foto original: fuera de la máscara conserva sus píxeles decodificados. Si falla la composición, bloquea la entrega. La IA aún puede equivocarse dentro de la zona marcada.
- Máscara a resolución natural, conservada al cambiar de modo de dibujo o al redimensionar la pantalla.
- Video generativo desde un render aprobado, cámara fija por defecto y fotograma final opcional en Seedance 2.5. Revisar todos los fotogramas; no se promete geometría exacta en movimiento.
- Exportación local de video WebM fijo de 5 segundos, sin IA ni coste de proveedor. No es un recorrido 3D. Mantener la pestaña abierta durante la exportación; requiere navegador compatible con MediaRecorder.
- Se elimina la generación de 360° desde una sola foto. Se importan panorámicas 2:1 del programa 3D, con revisión del arquitecto antes de compartir. El visor comprueba formato; no certifica por sí mismo la proyección.
- Portal incluido dentro de la aplicación en `/p/index.html`, con resultados aprobados y etiquetas para propuestas conceptuales.
- IndexedDB con migración desde localStorage sin borrar el respaldo anterior; exportación/importación JSON y aviso si falla el guardado. No es sincronización en nube.
- Firmas de trabajos para consultar la cola y tratamiento separado de fallos temporales. No se reenvían automáticamente solicitudes de generación cobrables.
- Límite de 4 MB por subida para ajustarse a las funciones de Vercel, validación de cabeceras de archivo y formatos PNG/JPG/WebP. Exportar previamente los planos PDF y las vistas de SKP/DWG/IFC a imagen; no se importan geometrías nativas.

## Exactitud y límites

Una imagen generativa no es un render CAD determinista. Para cotas, cantidades, fachadas no visibles, recorridos métricos o geometría exacta, usar el modelo 3D original y un motor de render. La aplicación aplica restricciones y exige revisión humana; no tiene un verificador automático de geometría ni un ControlNet/depth renderer.

El catálogo Decostone sigue siendo orientativo. No llegó un catálogo oficial con imágenes y medidas; la muestra real y las notas son obligatorias para el flujo de revestimientos. La foto sin calibración no permite certificar la escala del producto.

Los archivos de fal no son un archivo permanente garantizado. Descargar originales, renders y videos; el respaldo JSON contiene principalmente referencias y enlaces. En caso de fallo de subida de una composición protegida, puede quedar un PNG local y producir un enlace muy largo; descargar esa imagen o reducir la entrega en vez de confiar en un enlace que el mensajero pueda truncar.

Las aprobaciones viven en el navegador. Son un control editorial del estudio, no una firma digital ni una autorización multiusuario. La protección opcional por contraseña es para un estudio de un solo usuario; no hay cuentas, roles, revocación individual de enlaces, almacenamiento compartido en nube ni límites globales de facturación.

Los trabajos en cola anteriores a esta versión carecen de firma. Recuperar sus resultados desde el historial de fal; no regenerarlos automáticamente. Rotar la clave invalida las firmas de trabajos previos.

## Pruebas

```bash
npm test
npm run typecheck
npm run build
```

La suite verifica políticas del servidor, validación de referencias, modelos y duraciones, aprobación para compartir, firmas de cola, respaldos, preservación de píxeles fuera de la máscara, migración a IndexedDB y flujos de formularios en DOM simulado. Las pruebas no generan imágenes reales ni acreditan calidad visual de la IA.

El navegador remoto no pudo acceder al servidor local en esta sesión. No se completó una inspección visual interactiva del sitio ni una exportación de video en un navegador real. Verificar escritorio, móvil, pincel y exportación tras desplegar.

## Fuentes verificadas el 11 de septiembre de 2026

- [Nano Banana Pro API](https://fal.ai/models/fal-ai/nano-banana-pro/edit/api)
- [Nano Banana 2 API](https://fal.ai/models/fal-ai/nano-banana-2/edit/api)
- [Nano Banana Pro precios](https://fal.ai/models/fal-ai/nano-banana-pro/edit)
- [Nano Banana 2 precios](https://fal.ai/models/fal-ai/nano-banana-2/edit)
- [Seedance 2.5 API](https://fal.ai/models/bytedance/seedance-2.5/image-to-video/api)

Los precios publicados para imágenes eran: Pro 1K/2K USD 0,15 y 4K USD 0,30; Nano Banana 2 1K USD 0,08, 2K USD 0,12 y 4K USD 0,16, sin búsqueda web ni razonamiento adicional. Los importes pueden cambiar. Los videos conservan las estimaciones del código original y deben contrastarse con la facturación del proveedor antes de cotizar.
