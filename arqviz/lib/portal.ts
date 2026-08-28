// ─────────────────────────────────────────────────────────────────────────────
// Enlace del Portal del Cliente.
//
// El arquitecto presiona "Enlace para el cliente" y la app arma una URL del
// visor público con los datos del proyecto viajando en el fragmento (#).
// No hay base de datos: las imágenes y videos ya viven en el CDN de fal
// (URLs públicas https), y el enlace solo lleva la lista + los nombres.
// ─────────────────────────────────────────────────────────────────────────────

import type { Project } from './types';

/** Visor público del portal (GitHub Pages, abre en cualquier teléfono) */
export const PORTAL_URL = 'https://jejg19-wq.github.io/brief/numan/p/';

interface PortalItem { k: 'image' | 'video'; l: string; u: string }
interface PortalData { v: 1; n: string; c?: string; plan?: string; items: PortalItem[] }

/** URLs aptas para el enlace: https (fal CDN) o SVG de demo (livianos) */
function okUrl(u?: string): boolean {
  if (!u) return false;
  return u.startsWith('https://') || u.startsWith('data:image/svg+xml');
}

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface ClientLinkResult {
  url: string;
  images: number;
  videos: number;
  isDemo: boolean;
}

/**
 * Arma el enlace del portal con las generaciones listas del proyecto.
 * Devuelve null si aún no hay ninguna pieza que se pueda compartir.
 */
export function buildClientLink(project: Project): ClientLinkResult | null {
  const items: PortalItem[] = [];
  let isDemo = false;

  // en orden de creación (las más viejas primero) para que el tour se lea natural
  const gens = [...project.generations].reverse();
  for (const g of gens) {
    if (g.status !== 'done') continue;
    const u = g.resultUrls?.[0];
    if (!okUrl(u)) continue;
    if (u!.startsWith('data:')) isDemo = true;
    // los videos demo son SVG estáticos: van como imagen para que el visor no
    // intente reproducirlos
    const kind: 'image' | 'video' = g.kind === 'video' && u!.startsWith('data:') ? 'image' : g.kind;
    items.push({ k: kind, l: g.label, u: u! });
  }
  if (items.length === 0) return null;

  const data: PortalData = { v: 1, n: project.name, items };
  if (project.clientName) data.c = project.clientName;
  if (okUrl(project.planUrl) && project.planUrl!.startsWith('https://')) data.plan = project.planUrl;

  return {
    url: PORTAL_URL + '#' + toBase64Url(JSON.stringify(data)),
    images: items.filter((i) => i.k === 'image').length,
    videos: items.filter((i) => i.k === 'video').length,
    isDemo,
  };
}
