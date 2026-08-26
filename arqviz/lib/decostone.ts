// ─────────────────────────────────────────────────────────────────────────────
// Catálogo Decostone — revestimientos fabricados por el cliente.
//
// ⚠ CATÁLOGO INICIAL EDITABLE: estas piezas son una base de arranque con la
// pieza Vermont confirmada. Cuando llegue el catálogo oficial en PDF, se
// reemplazan aquí los nombres, descripciones y colores reales. La UI, los
// prompts y el ledger se actualizan solos a partir de este archivo.
// ─────────────────────────────────────────────────────────────────────────────

export interface DecoPiece {
  id: string;
  name: string;
  /** Descripción de la textura en inglés (se usa en el prompt del modelo) */
  texture: string;
  /** Descripción corta en español para la UI */
  desc: string;
}

export const DECO_PIECES: DecoPiece[] = [
  {
    id: 'vermont',
    name: 'Vermont',
    texture: 'stacked stone veneer panels with irregular rectangular strips of varying depth, natural split-face texture',
    desc: 'Piedra apilada en tiras irregulares',
  },
  {
    id: 'laja',
    name: 'Laja',
    texture: 'flat flagstone slate cladding with organic irregular shapes and thin joints',
    desc: 'Lajas planas de formas orgánicas',
  },
  {
    id: 'travertino',
    name: 'Travertino',
    texture: 'travertine-look wall panels with soft horizontal veining and honed surface',
    desc: 'Vetas suaves horizontales, look mármol',
  },
  {
    id: 'cuarzo',
    name: 'Cuarzo',
    texture: 'quartzite ledger stone panels with crystalline sparkle and clean straight courses',
    desc: 'Piedra con brillo cristalino en hiladas',
  },
  {
    id: 'pizarra',
    name: 'Pizarra',
    texture: 'slate wall cladding with fine layered texture and matte finish',
    desc: 'Textura laminada fina, acabado mate',
  },
  {
    id: 'ladrillo',
    name: 'Ladrillo',
    texture: 'thin brick veneer with classic running bond pattern and recessed mortar joints',
    desc: 'Ladrillo visto con juntas rehundidas',
  },
];

export interface DecoColor { id: string; label: string; en: string; hex: string }

export const DECO_COLORS: DecoColor[] = [
  { id: 'natural',  label: 'Natural',       en: 'in its natural stone color, untinted', hex: '#A79B8A' },
  { id: 'blanco',   label: 'Blanco',        en: 'in white tone', hex: '#EDEAE3' },
  { id: 'gris',     label: 'Gris claro',    en: 'in light grey tone', hex: '#B9BCBB' },
  { id: 'grafito',  label: 'Gris grafito',  en: 'in dark graphite grey tone', hex: '#4A4E52' },
  { id: 'arena',    label: 'Beige arena',   en: 'in warm sand beige tone', hex: '#D6C6A8' },
  { id: 'terracota',label: 'Terracota',     en: 'in terracotta earth tone', hex: '#B06B4F' },
  { id: 'negro',    label: 'Negro',         en: 'in matte black tone', hex: '#26282A' },
];

export interface DecoFinish { id: string; label: string; en: string }

export const DECO_FINISHES: DecoFinish[] = [
  { id: 'natural', label: 'Natural / mate', en: 'natural matte finish' },
  { id: 'sellado', label: 'Sellado (semi-brillo)', en: 'sealed satin finish with a subtle sheen' },
  { id: 'rustico', label: 'Rústico', en: 'rustic rough-hewn finish with pronounced relief' },
];

/** Prompt para nano-banana-pro/edit: foto del cliente → pared revestida */
export function buildCladdingPrompt(opts: {
  piece: DecoPiece;
  color: DecoColor;
  finish: DecoFinish;
  hasMask: boolean;
  extra?: string;
}): string {
  const { piece, color, finish, hasMask, extra } = opts;
  const parts: string[] = [
    `The reference image is a client's photo of a real space.`,
  ];
  if (hasMask) {
    parts.push(
      `The area to modify is highlighted with a semi-transparent green overlay. ` +
        `Apply the new wall cladding ONLY inside that highlighted area and remove ` +
        `the green overlay completely in the final image.`,
    );
  } else {
    parts.push(`Apply the new cladding to the main wall surface of the photo.`);
  }
  parts.push(
    `Cover the surface with "${piece.name}" cladding panels by Decostone: ${piece.texture}, ` +
      `${color.en}, ${finish.en}.`,
    `Respect the photo's exact perspective, camera angle and vanishing lines so the ` +
      `panel courses follow the wall plane realistically. Keep the original lighting, ` +
      `shadows, reflections and every other element of the photo unchanged: furniture, ` +
      `floor, ceiling, windows, plants and people stay exactly as they are.`,
    `Photorealistic result, realistic panel scale (strips of about 10-15 cm height), ` +
      `natural texture variation between panels, no text, no watermarks.`,
  );
  if (extra?.trim()) parts.push(`Additional notes: ${extra.trim()}.`);
  return parts.join(' ');
}

/** Miniatura esquemática SVG de la textura de cada pieza (para la UI) */
export function pieceThumb(piece: DecoPiece, hex: string): string {
  const dark = shade(hex, -18);
  const light = shade(hex, 14);
  let rows = '';
  const pattern = piece.id === 'laja'
    ? [[38, 26, 36], [22, 42, 36], [30, 34, 36]]
    : piece.id === 'ladrillo'
      ? [[24, 24, 24, 28], [12, 24, 24, 24, 16], [24, 24, 24, 28]]
      : [[34, 18, 28, 20], [16, 30, 22, 32], [26, 20, 34, 20]];
  let y = 2;
  for (const row of pattern) {
    let x = 2;
    for (let i = 0; i < row.length; i++) {
      const w = row[i];
      const fill = i % 3 === 0 ? hex : i % 3 === 1 ? dark : light;
      rows += `<rect x="${x}" y="${y}" width="${w - 3}" height="17" rx="1.5" fill="${fill}"/>`;
      x += w;
    }
    y += 20;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="104" height="64" viewBox="0 0 104 64"><rect width="104" height="64" fill="${shade(hex, -30)}"/>${rows}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + (pct / 100) * 255)));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
