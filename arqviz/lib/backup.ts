import type { Project } from './types';
export function parseBackup(raw: string): Project[] {
  const data = JSON.parse(raw);
  if (data.version !== 2 || !Array.isArray(data.projects) || data.projects.length > 500) throw new Error('El respaldo no es válido.');
  const safeUrl = (u: unknown) => u === undefined || (typeof u === 'string' && (/^https:\/\//.test(u) || /^data:image\/(png|jpeg|webp);base64,/.test(u) || /^data:image\/svg\+xml/.test(u)));
  const text = (v: unknown, max = 20000) => typeof v === 'string' && v.length <= max;
  for (const p of data.projects) {
    if (!p || !text(p.id,200) || !text(p.name,500) || !text(p.clientName,500) || !Number.isFinite(p.createdAt) || !Array.isArray(p.generations) || !safeUrl(p.planUrl)) throw new Error('Proyecto inválido en el respaldo.');
    for (const views of [p.skpViews, p.materialRefs]) if (views !== undefined && (!Array.isArray(views) || views.some((v:any) => !v || !text(v.id,200) || !text(v.label,500) || !safeUrl(v.url)))) throw new Error('Referencias inválidas.');
    if (p.materials !== undefined && !text(p.materials)) throw new Error('Materiales inválidos.');
    for (const g of p.generations) {
      if (!g || !text(g.id,200) || !text(g.endpoint,500) || !text(g.label,1000) || !text(g.prompt,40000) || !['image','video'].includes(g.kind) || !['queued','running','done','error'].includes(g.status) || !Number.isFinite(g.createdAt) || !Number.isFinite(g.costUsd) || g.costUsd < 0 || !safeUrl(g.sourceImageUrl) || !safeUrl(g.originalUrl) || !safeUrl(g.maskUrl) || (g.resultUrls !== undefined && (!Array.isArray(g.resultUrls) || g.resultUrls.some((u:unknown) => !safeUrl(u))))) throw new Error('Resultado inválido en el respaldo.');
      // Imported work must be reviewed again on this installation.
      g.review = 'pending'; delete g.reviewedAt;
    }
  }
  return data.projects;
}
