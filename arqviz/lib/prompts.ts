// ─────────────────────────────────────────────────────────────────────────────
// Construcción de prompts. Los prompts van en inglés (los modelos rinden
// mejor así); la UI se mantiene en español.
// ─────────────────────────────────────────────────────────────────────────────

export interface SpacePreset { id: string; label: string; en: string; interior: boolean }

export const SPACES: SpacePreset[] = [
  { id: 'sala',      label: 'Sala',                en: 'living room', interior: true },
  { id: 'cocina',    label: 'Cocina',              en: 'kitchen', interior: true },
  { id: 'comedor',   label: 'Comedor',             en: 'dining room', interior: true },
  { id: 'principal', label: 'Habitación principal', en: 'master bedroom', interior: true },
  { id: 'bano',      label: 'Baño',                en: 'bathroom', interior: true },
  { id: 'estudio',   label: 'Estudio',             en: 'home office / study', interior: true },
  { id: 'terraza',   label: 'Terraza',             en: 'terrace', interior: false },
  { id: 'fachada',   label: 'Fachada',             en: 'front facade of the house', interior: false },
  { id: 'aerea',     label: 'Vista 3D del plano',  en: '3D isometric cutaway view of the full floor plan', interior: false },
];

export interface StylePreset { id: string; label: string; en: string }

export const STYLES: StylePreset[] = [
  { id: 'moderno',    label: 'Moderno cálido',   en: 'warm modern style: oak wood, off-white walls, matte black accents, linen textiles' },
  { id: 'minimal',    label: 'Minimalista',      en: 'minimalist style: clean lines, neutral palette, hidden storage, few carefully chosen objects' },
  { id: 'industrial', label: 'Industrial',       en: 'industrial style: exposed concrete, black steel frames, warm brick accents, leather furniture' },
  { id: 'clasico',    label: 'Clásico contemporáneo', en: 'contemporary classic style: mouldings, marble surfaces, brass details, elegant upholstery' },
  { id: 'tropical',   label: 'Tropical / mediterráneo', en: 'tropical mediterranean style: white stucco, natural rattan, indoor plants, terracotta floors' },
];

export interface LightPreset { id: string; label: string; en: string }

export const LIGHTING: LightPreset[] = [
  { id: 'dia',       label: 'Día',       en: 'bright natural daylight streaming through the windows, soft shadows' },
  { id: 'atardecer', label: 'Atardecer', en: 'golden hour light, warm low sun entering at an angle, long soft shadows' },
  { id: 'noche',     label: 'Noche',     en: 'evening scene, warm interior artificial lighting, cozy practical lamps, deep blue sky outside' },
];

/** Prompt para nano-banana-pro/edit: plano (imagen de referencia) → render fotorrealista */
export function buildRenderPrompt(opts: {
  space: SpacePreset;
  style: StylePreset;
  lighting: LightPreset;
  extra?: string;
}): string {
  const { space, style, lighting, extra } = opts;
  const base =
    `The reference image is an architectural floor plan. ` +
    `Respect its exact room layout, wall positions, door and window placement.`;

  let scene: string;
  if (space.id === 'aerea') {
    scene =
      `Generate a photorealistic ${space.en}, seen from a high three-quarter angle, ` +
      `with realistic miniature furniture, materials and lighting inside each room, ` +
      `on a clean neutral background, architectural visualization quality.`;
  } else if (!space.interior) {
    scene =
      `Generate a photorealistic exterior photograph of the ${space.en} implied by this floor plan, ` +
      `eye-level shot, 35mm lens, realistic landscaping and materials.`;
  } else {
    scene =
      `Generate a photorealistic interior photograph of the ${space.en}, ` +
      `eye-level shot from a natural standing position, 24mm lens, ` +
      `fully furnished and styled as a real lived-in home.`;
  }

  const parts = [
    base,
    scene,
    `Interior design: ${style.en}.`,
    `Lighting: ${lighting.en}.`,
    `Photorealistic, high-end architectural photography, accurate global illumination, ` +
      `realistic material textures, no people, no text, no watermarks.`,
  ];
  if (extra?.trim()) parts.push(`Additional client notes: ${extra.trim()}.`);
  return parts.join(' ');
}

export interface CameraPreset { id: string; label: string; en: string }

export const CAMERAS: CameraPreset[] = [
  {
    id: 'recorrido',
    label: 'Recorrido hacia adelante',
    en: 'Camera pushes in slowly at walking pace through the space, gimbal glide at chest height, and comes to a gentle stop',
  },
  {
    id: 'orbita',
    label: 'Órbita suave',
    en: 'Camera orbits slowly around the space, about 20 degrees total, at eye level, steady speed, and stops',
  },
  {
    id: 'paneo',
    label: 'Paneo lateral',
    en: 'Camera pans slowly from left to right across the space at eye level, locked height, and stops at the far side',
  },
  {
    id: 'revelacion',
    label: 'Revelación (pull-out)',
    en: 'Camera pulls out slowly from a detail to reveal the full space, steady reverse dolly, and stops on a wide shot',
  },
];

/** Prompt para Seedance image-to-video: render → video recorrido */
export function buildVideoPrompt(opts: {
  camera: CameraPreset;
  durationSec: number;
  extra?: string;
}): string {
  const { camera, durationSec, extra } = opts;
  const parts = [
    `Architectural visualization walkthrough. The scene is exactly the interior shown in the input image: ` +
      `same furniture, same materials, same lighting.`,
    `${camera.en}.`,
    `The space itself is completely static: nothing moves except subtle natural elements ` +
      `(curtains breathing slightly, soft light shifts). Real-time speed, single continuous take.`,
  ];
  if (durationSec >= 10) {
    const a = Math.round(durationSec * 0.4);
    const b = Math.round(durationSec * 0.8);
    parts.push(
      `Timeline: 0-${a}s the camera movement described above begins smoothly and steadily; ` +
        `${a}-${b}s the movement continues at the same pace, revealing more of the space; ` +
        `${b}-${durationSec}s the camera decelerates and settles on a final composed frame with no new action.`,
    );
  }
  parts.push(
    `Audio: quiet interior room tone, very soft distant ambience. No music. No dialogue.`,
    `Constraints: no cuts, no morphing, no people, no on-screen text, no logos, ` +
      `no furniture changes, no zoom, no repeated action.`,
  );
  if (extra?.trim()) parts.push(`Additional notes: ${extra.trim()}.`);
  return parts.join(' ');
}

/** Prompt para nano-banana-pro/edit: render → panorámica 360° del mismo ambiente */
export function buildPanoPrompt(sourceLabel: string): string {
  return (
    `The reference image is a photorealistic interior render. ` +
    `Generate a full 360-degree equirectangular panorama of this exact same room (${sourceLabel}), ` +
    `as seen from a camera standing at eye level in the center of the room. ` +
    `Keep the same furniture, materials, colors and lighting as the reference. ` +
    `Equirectangular projection covering the full horizontal circle: the left and right edges ` +
    `of the image must match seamlessly so the panorama wraps around without a visible seam. ` +
    `Show the complete room: all four walls, floor and ceiling, with natural perspective ` +
    `distortion typical of equirectangular photos. ` +
    `Photorealistic, high-end architectural visualization, no people, no text, no watermarks.`
  );
}

/** Prompt para nano-banana-pro/edit: vista de SketchUp → render fotorrealista fiel */
export function buildSkpPrompt(opts: {
  label: string;
  style: StylePreset;
  lighting: LightPreset;
  extra?: string;
}): string {
  const { label, style, lighting, extra } = opts;
  const parts = [
    `The reference image is a screenshot of an untextured SketchUp 3D model (${label}).`,
    `Render this EXACT same view as a photorealistic photograph. Critical: keep the camera ` +
      `angle, framing, geometry, proportions, furniture and cabinetry placement, window and ` +
      `door positions IDENTICAL to the reference — this is the architect's real design and ` +
      `nothing may move or change shape.`,
    `Replace the plain gray/white surfaces with realistic materials and finishes. ` +
      `Interior design direction: ${style.en}.`,
    `Lighting: ${lighting.en}.`,
    `Add tasteful real-life details consistent with the design (decor, plants, textiles) ` +
      `without altering the architecture or furniture layout.`,
    `Photorealistic, high-end architectural photography, accurate global illumination, ` +
      `realistic textures, no people, no text, no watermarks.`,
  ];
  if (extra?.trim()) parts.push(`Additional notes: ${extra.trim()}.`);
  return parts.join(' ');
}
