// ─────────────────────────────────────────────────────────────────────────────
// Registro de modelos de IA conectados vía fal.ai.
// Los costos son estimaciones en USD según el pricing publicado por fal.ai
// (agosto 2026). Si fal cambia precios, se ajustan aquí y toda la app
// (ledger, facturación) queda al día.
// ─────────────────────────────────────────────────────────────────────────────

export type ModelKind = 'image' | 'video';

export interface ModelDef {
  id: string;            // endpoint de fal.ai
  kind: ModelKind;
  label: string;
  description: string;
  /** Costo estimado en USD por generación (imagen) o por segundo (video) */
  cost: { perImage?: number; perImage4K?: number; perSecond?: Record<string, number> };
}

export const IMAGE_MODEL: ModelDef = {
  id: 'fal-ai/nano-banana-pro/edit',
  kind: 'image',
  label: 'Nano Banana Pro',
  description: 'Renders fotorrealistas a partir del plano (Google Gemini 3 Pro Image)',
  cost: { perImage: 0.15, perImage4K: 0.3 },
};

export const VIDEO_MODELS: Record<string, ModelDef & { resolutions: string[]; durations: number[] }> = {
  seedance25: {
    id: 'bytedance/seedance-2.5/image-to-video',
    kind: 'video',
    label: 'Seedance 2.5',
    description: 'El más reciente: mejor movimiento, hasta 30 s, sonido ambiente (máx. 720p)',
    // pricing fal: $0.0214 / 1000 tokens → ≈ $0.473/s en 720p, $0.2205/s en 480p
    cost: { perSecond: { '720p': 0.473, '480p': 0.2205 } },
    resolutions: ['480p', '720p'],
    durations: [5, 10, 15, 30],
  },
  seedance20hd: {
    id: 'bytedance/seedance-2.0/image-to-video',
    kind: 'video',
    label: 'Seedance 2.0 HD',
    description: 'Máxima resolución 1080p',
    // pricing fal: $0.014 / 1000 tokens → ≈ $0.682/s en 1080p, $0.3034/s en 720p
    cost: { perSecond: { '1080p': 0.682, '720p': 0.3034 } },
    resolutions: ['720p', '1080p'],
    durations: [5, 10],
  },
  seedance_fast: {
    id: 'fal-ai/bytedance/seedance/v1/pro/fast/image-to-video',
    kind: 'video',
    label: 'Seedance Fast (borrador)',
    description: 'Rápido y barato para probar encuadres antes del video final',
    // ≈ $0.243 por video 1080p de 5 s
    cost: { perSecond: { '1080p': 0.049, '720p': 0.022, '480p': 0.01 } },
    resolutions: ['480p', '720p', '1080p'],
    durations: [5, 10],
  },
};

export const VIDEO_RESOLUTIONS = ['480p', '720p', '1080p'] as const;
export const VIDEO_DURATIONS = [5, 10] as const;

export function estimateImageCost(resolution: '1K' | '2K' | '4K', numImages: number): number {
  const per = resolution === '4K' ? (IMAGE_MODEL.cost.perImage4K ?? 0.3) : (IMAGE_MODEL.cost.perImage ?? 0.15);
  return per * numImages;
}

export function estimateVideoCost(modelKey: string, resolution: string, durationSec: number): number {
  const model = VIDEO_MODELS[modelKey] ?? VIDEO_MODELS.seedance25;
  const perSec = model.cost.perSecond?.[resolution] ?? 0.473;
  return perSec * durationSec;
}

/** Lista blanca de endpoints que el server acepta encolar */
export const ALLOWED_ENDPOINTS = new Set<string>([
  IMAGE_MODEL.id,
  ...Object.values(VIDEO_MODELS).map((m) => m.id),
]);
