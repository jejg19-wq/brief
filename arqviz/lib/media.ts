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
