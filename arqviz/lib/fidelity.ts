import { buildRenderPrompt, buildSkpPrompt, buildVideoPrompt, SPACES, STYLES, LIGHTING, CAMERAS } from './prompts';
import { buildCladdingPrompt, DECO_PIECES, DECO_COLORS, DECO_FINISHES } from './decostone';
import { IMAGE_MODELS, VIDEO_MODELS } from './models';

export const POLICY_VERSION = 'numan-fidelity-2.0';
export const FIDELITY_SYSTEM = `You are an architectural material visualization operator, not a designer.
REFERENCE PRIORITY: image 1 is the sole authority for geometry, camera, perspective, framing, proportions, object count, openings and occlusion. Subsequent images are material samples only; never import their layout or objects.
LOCK: do not move, add, delete, rotate, resize or reshape walls, floors, ceilings, windows, doors, stairs, furniture, cabinets, fittings or background. Do not extend or crop the frame. Preserve existing text and logos; add none.
ALLOWED: change only explicitly assigned materials, surface roughness and realistic light interaction. Preserve unassigned surfaces. Style presets never authorize extra objects. Source evidence overrides aesthetic preferences and conflicting free-form notes.
UNKNOWN: do not invent dimensions, hidden rooms, facades, landscape or unseen sides. A floor-plan interpretation is conceptual, not a measured reconstruction.
MASK: when a green overlay reference is supplied, modify only the marked surface. Preserve occluding objects. Remove the overlay. Never alter outside the selection.
NEGATIVE: no redesign, new decoration, plants, people, furniture, openings, geometry distortion, altered lens, expanded field of view, stylized illustration, captions or added watermarks.
Return one image. These instructions improve fidelity but do not constitute a geometric guarantee.`;

export type Operation = 'skp' | 'render' | 'cladding' | 'video';
export function sourceUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4096) throw new Error('Referencia inválida. Vuelve a subir la imagen.');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Referencia inválida.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !(url.hostname === 'fal.media' || url.hostname.endsWith('.fal.media'))) {
    throw new Error('La referencia debe subirse desde esta aplicación.');
  }
  return value;
}
const pick = <T extends { id: string }>(list: T[], id: unknown, fallback: string): T => {
  const value = list.find(x => x.id === (id ?? fallback));
  if (!value) throw new Error('Selección no válida.');
  return value;
};
export function prepareGeneration(body: Record<string, any>) {
  const { endpoint, operation, options = {}, input = {} } = body;
  const text = (value: unknown, max = 6000) => typeof value === 'string' ? value.slice(0, max).trim() : '';
  const extra = text(options.extra);
  if (operation === 'video') {
    const model = Object.values(VIDEO_MODELS).find(m => m.id === endpoint);
    if (!model) throw new Error('Modelo de video no permitido.');
    const duration = Number(input.duration);
    if (!model.durations.includes(duration) || !model.resolutions.includes(input.resolution)) throw new Error('Duración o resolución no válida.');
    const camera = pick(CAMERAS, options.cameraId, 'fija');
    const prompt = buildVideoPrompt({ camera, durationSec: duration, extra });
    const end = input.end_image_url ? sourceUrl(input.end_image_url) : undefined;
    if (end && endpoint !== VIDEO_MODELS.seedance25.id) throw new Error('Este modelo no admite fotograma final en la aplicación.');
    return { endpoint, input: { prompt, image_url: sourceUrl(input.image_url), resolution: input.resolution, duration: String(duration),
      ...(endpoint === VIDEO_MODELS.seedance25.id ? { generate_audio: options.audio === true, ...(end ? { end_image_url: end } : {}) } : {}) }, prompt };
  }
  if (!Object.values(IMAGE_MODELS).some(m => m.id === endpoint)) throw new Error('Modelo de imagen no permitido.');
  if (!['skp', 'render', 'cladding'].includes(operation)) throw new Error('Flujo no permitido. Actualiza la aplicación.');
  if (!Array.isArray(input.image_urls) || input.image_urls.length < 1 || input.image_urls.length > 8) throw new Error('Sube entre una y ocho referencias.');
  if (!['1K', '2K', '4K'].includes(input.resolution)) throw new Error('Resolución no válida.');
  const style = pick(STYLES, options.styleId, 'original');
  const lighting = pick(LIGHTING, options.lightId, 'original');
  let prompt: string;
  if (operation === 'render') {
    if (options.conceptAcknowledged !== true) throw new Error('El plano necesita validación dimensional; confirma que generarás una propuesta conceptual.');
    prompt = buildRenderPrompt({ space: pick(SPACES, options.spaceId, 'sala'), style, lighting, extra });
  } else if (operation === 'cladding') {
    if (options.hasMask !== true || input.image_urls.length < 3) throw new Error('Marca la pared y adjunta una muestra real del revestimiento.');
    prompt = buildCladdingPrompt({ piece: pick(DECO_PIECES, options.pieceId, 'vermont'), color: pick(DECO_COLORS, options.colorId, 'natural'), finish: pick(DECO_FINISHES, options.finishId, 'natural'), hasMask: true, extra });
  } else {
    prompt = buildSkpPrompt({ label: text(options.label, 160), style, lighting, extra });
  }
  prompt += '\nMaterial specifications: ' + text(options.materials) + '\n' + FIDELITY_SYSTEM;
  return { endpoint, prompt, input: { prompt, system_prompt: FIDELITY_SYSTEM, image_urls: input.image_urls.map(sourceUrl), resolution: input.resolution,
    aspect_ratio: 'auto', output_format: 'png', num_images: 1, limit_generations: true, enable_web_search: false } };
}
