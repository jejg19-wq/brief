// ─────────────────────────────────────────────────────────────────────────────
// Modo demo: sin FAL_KEY la app funciona completa con generaciones simuladas
// (costo $0). Los placeholders llevan la marca numan para que la demo se vea
// profesional al presentarla.
// ─────────────────────────────────────────────────────────────────────────────

const BRAND = '#0B4A3A';
const BRAND_DEEP = '#06382C';

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Placeholder de render (imagen) con la marca numan */
export function demoRenderImage(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND}"/>
      <stop offset="1" stop-color="${BRAND_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <g stroke="rgba(255,255,255,0.14)" stroke-width="2" fill="none">
    <path d="M80 470 L360 330 L680 470"/>
    <path d="M120 470 L120 560 M640 470 L640 560"/>
    <rect x="300" y="420" width="90" height="140" rx="4"/>
    <rect x="440" y="430" width="70" height="70" rx="4"/>
  </g>
  <text x="400" y="255" text-anchor="middle" fill="#fff" font-family="Nunito, sans-serif" font-size="52" font-weight="800" letter-spacing="-1">numan</text>
  <text x="400" y="292" text-anchor="middle" fill="rgba(255,255,255,0.75)" font-family="Nunito, sans-serif" font-size="19">${label}</text>
  <rect x="310" y="318" width="180" height="34" rx="17" fill="rgba(255,255,255,0.14)"/>
  <text x="400" y="341" text-anchor="middle" fill="#fff" font-family="Nunito, sans-serif" font-size="14" font-weight="700">RENDER DE MUESTRA</text>
</svg>`;
  return svgToDataUri(svg);
}

/** Placeholder de panorámica 360° (formato ancho) con la marca numan */
export function demoPanoImage(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="720" viewBox="0 0 1680 720">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0E5644"/><stop offset="0.55" stop-color="${BRAND}"/><stop offset="1" stop-color="${BRAND_DEEP}"/>
  </linearGradient></defs>
  <rect width="1680" height="720" fill="url(#g)"/>
  <g stroke="rgba(255,255,255,0.12)" stroke-width="2" fill="none">
    <path d="M0 500 L420 430 L840 500 L1260 430 L1680 500"/>
    <rect x="330" y="330" width="120" height="160" rx="4"/>
    <rect x="1180" y="340" width="150" height="120" rx="4"/>
  </g>
  <text x="840" y="300" text-anchor="middle" fill="#fff" font-family="Nunito, sans-serif" font-size="64" font-weight="800">numan</text>
  <text x="840" y="348" text-anchor="middle" fill="rgba(255,255,255,0.75)" font-family="Nunito, sans-serif" font-size="24">${label}</text>
  <rect x="732" y="380" width="216" height="40" rx="20" fill="rgba(255,255,255,0.14)"/>
  <text x="840" y="407" text-anchor="middle" fill="#fff" font-family="Nunito, sans-serif" font-size="17" font-weight="700">360° DE MUESTRA</text>
</svg>`;
  return svgToDataUri(svg);
}

/** Placeholder de video con la marca numan */
export function demoVideoImage(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND_DEEP}"/>
      <stop offset="1" stop-color="${BRAND}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <circle cx="400" cy="270" r="52" fill="rgba(255,255,255,0.16)"/>
  <path d="M385 244 L432 270 L385 296 Z" fill="#fff"/>
  <text x="400" y="378" text-anchor="middle" fill="#fff" font-family="Nunito, sans-serif" font-size="26" font-weight="800">Video recorrido</text>
  <text x="400" y="410" text-anchor="middle" fill="rgba(255,255,255,0.75)" font-family="Nunito, sans-serif" font-size="17">${label}</text>
  <rect x="308" y="436" width="184" height="34" rx="17" fill="rgba(255,255,255,0.14)"/>
  <text x="400" y="459" text-anchor="middle" fill="#fff" font-family="Nunito, sans-serif" font-size="14" font-weight="700">VIDEO DE MUESTRA</text>
</svg>`;
  return svgToDataUri(svg);
}

export const DEMO_PREFIX = 'demo-';

export function isDemoGen(id: string): boolean {
  return id.startsWith(DEMO_PREFIX);
}

/** Lee un archivo local como data URL (para subir el plano sin servidor) */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}
