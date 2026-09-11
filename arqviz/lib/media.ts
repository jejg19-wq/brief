export function preserveOutsideMask(original: Uint8ClampedArray, generated: Uint8ClampedArray, mask: Uint8ClampedArray) {
  if(original.length !== generated.length || original.length !== mask.length) throw new Error('Dimensiones de máscara incompatibles.');
  for(let i=0;i<original.length;i+=4) if(mask[i+3]>0) for(let c=0;c<4;c++) original[i+c]=generated[i+c];
  return original;
}
export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const image = new Image(); image.crossOrigin = 'anonymous'; image.onload = () => resolve(image); image.onerror = () => reject(new Error('No se pudo abrir la imagen. Descarga una copia desde fal si el enlace ha caducado.')); image.src = url; });
}
export function downloadFile(contents: Blob, filename: string) {
  const url = URL.createObjectURL(contents); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function compositeMasked(original: string, generated: string, mask: string): Promise<string> {
  const [source, result, selection] = await Promise.all([loadImage(original), loadImage(generated), loadImage(mask)]);
  const canvas = document.createElement('canvas'); canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0); const base = ctx.getImageData(0, 0, canvas.width, canvas.height);
  ctx.drawImage(result, 0, 0, canvas.width, canvas.height); const edit = ctx.getImageData(0, 0, canvas.width, canvas.height);
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(selection, 0, 0, canvas.width, canvas.height);
  const alpha = ctx.getImageData(0, 0, canvas.width, canvas.height);
  preserveOutsideMask(base.data, edit.data, alpha.data);
  ctx.putImageData(base, 0, 0); return canvas.toDataURL('image/png');
}
export async function presentationVideo(url: string): Promise<void> {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error('Este navegador no permite exportar video local. Usa Chrome o Edge.');
  const image = await loadImage(url); const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1920 / image.naturalWidth, 1080 / image.naturalHeight);
  canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  const stream = canvas.captureStream(24);
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(x => MediaRecorder.isTypeSupported(x));
  if (!mime) { stream.getTracks().forEach(t => t.stop()); throw new Error('Exportación WebM no compatible.'); }
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 }); const chunks: BlobPart[] = [];
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  await new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setInterval>;
    const cleanup = () => { clearInterval(timer); stream.getTracks().forEach(t => t.stop()); };
    recorder.onstop = () => { cleanup(); downloadFile(new Blob(chunks, { type: mime }), 'numan-presentacion-fiel.webm'); resolve(); };
    recorder.onerror = () => { cleanup(); reject(new Error('No se pudo exportar el video.')); };
    recorder.start(); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const start = Date.now(); timer = setInterval(() => { ctx.drawImage(image, 0, 0, canvas.width, canvas.height); if (Date.now() - start >= 5000 && recorder.state === 'recording') recorder.stop(); }, 1000 / 24);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Ajuste automático de fotos antes de subir.
//
// Vercel limita el cuerpo de cada petición a ~4.5 MB, así que /api/upload
// acepta hasta 4 MB. Para que el arquitecto pueda usar cualquier foto (las
// del teléfono suelen pesar 8-15 MB), la app la reduce y comprime en el
// navegador antes de enviarla. Las imágenes que ya caben se envían intactas.
// ─────────────────────────────────────────────────────────────────────────────

export const UPLOAD_LIMIT = 4 * 1024 * 1024;
const SAFE_LIMIT = Math.floor(3.8 * 1024 * 1024);
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const IMAGE_NAME = /\.(heic|heif|jpe?g|png|webp|bmp|tiff?|gif|avif)$/i;

type Decoded = ImageBitmap | HTMLImageElement;

async function decodeImage(source: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(source); } catch { /* algunos formatos no decodifican aquí */ }
  }
  const url = URL.createObjectURL(source);
  try { return await loadImage(url); } finally { URL.revokeObjectURL(url); }
}

function decodedSize(img: Decoded): [number, number] {
  return 'naturalWidth' in img ? [img.naturalWidth, img.naturalHeight] : [img.width, img.height];
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo codificar la imagen.'))), type, quality));
}

/**
 * Devuelve una versión de la imagen que cabe en el límite de subida.
 * Reduce el lado mayor a `maxEdge` píxeles y comprime en JPEG (o PNG si se
 * pide y cabe). Repite reduciendo el tamaño hasta lograrlo.
 */
export async function shrinkImage(source: Blob, opts: { maxEdge?: number; preferPng?: boolean } = {}): Promise<Blob> {
  const maxEdge = opts.maxEdge ?? 4000;
  let img: Decoded;
  try { img = await decodeImage(source); } catch { throw new Error('No se pudo leer esta imagen. Guárdala como JPG o PNG e inténtalo de nuevo.'); }
  const [w, h] = decodedSize(img);
  if (!w || !h) throw new Error('La imagen está vacía o dañada.');
  let scale = Math.min(1, maxEdge / Math.max(w, h));
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (opts.preferPng) {
      const png = await canvasToBlob(canvas, 'image/png');
      if (png.size <= SAFE_LIMIT) return png;
    }
    for (const quality of [0.92, 0.86, 0.8, 0.72]) {
      const jpg = await canvasToBlob(canvas, 'image/jpeg', quality);
      if (jpg.size <= SAFE_LIMIT) return jpg;
    }
    scale *= 0.7;
  }
  throw new Error('La imagen es demasiado grande incluso reducida. Prueba con una foto más pequeña.');
}

function renamed(name: string, type: string): string {
  return name.replace(/\.[^.]+$/, '') + (type === 'image/png' ? '.png' : '.jpg');
}

/**
 * Prepara un archivo elegido por el arquitecto: acepta cualquier foto que el
 * navegador pueda abrir y la deja lista para /api/upload. Si ya es PNG/JPG/WebP
 * y pesa menos del límite, se devuelve sin tocar.
 */
export async function prepareUpload(file: File, maxEdge = 4000): Promise<File> {
  if (IMAGE_TYPES.includes(file.type) && file.size <= SAFE_LIMIT) return file;
  if (!file.type.startsWith('image/') && !IMAGE_NAME.test(file.name)) {
    throw new Error('Ese archivo no es una imagen. Sube una foto en JPG, PNG o WebP.');
  }
  const blob = await shrinkImage(file, { maxEdge, preferPng: file.type === 'image/png' });
  return new File([blob], renamed(file.name, blob.type), { type: blob.type });
}

/** Igual que prepareUpload pero partiendo de un data URL generado en la app (composiciones, máscaras). */
export async function fitDataUrl(dataUrl: string, name: string, maxEdge = 4000): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  if (IMAGE_TYPES.includes(blob.type) && blob.size <= SAFE_LIMIT) return new File([blob], name, { type: blob.type });
  const shrunk = await shrinkImage(blob, { maxEdge });
  return new File([shrunk], renamed(name, shrunk.type), { type: shrunk.type });
}
