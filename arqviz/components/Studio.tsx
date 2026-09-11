'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Generation, Project } from '@/lib/types';
import { loadProjects, saveProjects, uid, useMargin } from '@/lib/store';
import {
  IMAGE_MODEL, VIDEO_MODELS,
  estimateImageCost, estimateVideoCost,
} from '@/lib/models';
import {
  SPACES, STYLES, LIGHTING, CAMERAS,
  buildRenderPrompt, buildVideoPrompt,
} from '@/lib/prompts';
import {
  DEMO_PREFIX, isDemoGen, demoRenderImage, demoVideoImage, demoPanoImage, fileToDataUrl,
} from '@/lib/demo';
import GenerationCard from './GenerationCard';
import { buildClientLink, type ClientLinkResult } from '@/lib/portal';
import Decostone from './Decostone';
import SketchupSection from './SketchupSection';
import ReviewDialog from './ReviewDialog';
import ProjectTools from './ProjectTools';
import MaterialSection from './MaterialSection';
import PanoramaImport from './PanoramaImport';
import { compositeMasked } from '@/lib/media';

const DECO_PROJECT_ID = 'decostone';

// ── utilidades ───────────────────────────────────────────────────────────────

const usd = (n: number) => `$${n.toFixed(2)}`;

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error de red');
  return data as T;
}

// ── componente principal ─────────────────────────────────────────────────────

export default function Studio() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [demo, setDemo] = useState(true);
  const [connectionReady, setConnectionReady] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [reviewTarget, setReviewTarget] = useState<{projectId: string; gen: Generation} | null>(null);
  const polling = useRef(false);
  const [margin, setMargin] = useMargin();
  const [showNewProject, setShowNewProject] = useState(false);
  const [videoSource, setVideoSource] = useState<Generation | null>(null);
  const [tab, setTab] = useState<'proyectos' | 'decostone'>('proyectos');
  const [lightboxUrl, setLightboxUrl] = useState<{ url: string; kind: 'image' | 'video' } | null>(null);

  // hidratar desde localStorage + detectar modo demo
  useEffect(() => {
    loadProjects().then(loaded => { setProjects(loaded); if (loaded.length > 0) setActiveId(loaded[0].id); setHydrated(true); }).catch(() => setStorageError('No se pudo abrir el archivo local de proyectos. Exporta un respaldo antes de cerrar.'));
    fetch('/api/health')
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setDemo(Boolean(d.demo)); setConnectionReady(true); })
      .catch(() => setConnectionError('No se pudo comprobar la conexión. Recarga la página antes de generar.'));
  }, []);

  // persistir
  useEffect(() => {
    if (hydrated) saveProjects(projects).then(() => setStorageError('')).catch(() => setStorageError('No se pudieron guardar los cambios en este navegador. Descarga un respaldo antes de cerrar.'));
  }, [projects, hydrated]);

  const visibleProjects = projects.filter((p) => p.id !== DECO_PROJECT_ID);
  const active = visibleProjects.find((p) => p.id === activeId) ?? null;
  const decoProject: Project = projects.find((p) => p.id === DECO_PROJECT_ID) ?? {
    id: DECO_PROJECT_ID, name: 'Decostone', clientName: '', createdAt: 0, generations: [],
  };

  const addDecoGeneration = (gen: Generation) => {
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === DECO_PROJECT_ID);
      const base = exists ? prev : [...prev, { ...decoProject }];
      return base.map((p) =>
        p.id === DECO_PROJECT_ID ? { ...p, generations: [gen, ...p.generations] } : p,
      );
    });
  };

  const updateProject = useCallback((projectId: string, fn: (p: Project) => Project) => {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? fn(p) : p)));
  }, []);

  // ── polling de generaciones pendientes (las demo se completan solas) ──
  useEffect(() => {
    const pending = projects.flatMap((p) =>
      p.generations
        .filter((g) => g.status === 'queued' || g.status === 'running')
        .map((g) => ({ projectId: p.id, gen: g })),
    );
    if (pending.length === 0) return;

    const timer = setInterval(async () => {
      if (polling.current) return;
      polling.current = true;
      try {
      for (const { projectId, gen } of pending) {
        // Modo demo: completar localmente con placeholder de marca
        if (isDemoGen(gen.id)) {
          const url = gen.kind === 'video' ? demoVideoImage(gen.label)
            : gen.pano ? demoPanoImage(gen.label) : demoRenderImage(gen.label);
          updateProject(projectId, (p) => ({
            ...p,
            generations: p.generations.map((g) =>
              g.id === gen.id ? { ...g, status: 'done', resultUrls: [url] } : g,
            ),
          }));
          continue;
        }
        try {
          const res = await fetch(
            `/api/status?endpoint=${encodeURIComponent(gen.endpoint)}&requestId=${encodeURIComponent(gen.id)}&token=${encodeURIComponent(gen.jobToken || '')}`,
          );
          const data = await res.json();
          if (data.status === 'done') {
            let urls = data.urls;
            let maskedComposite = false;
            if (gen.originalUrl && gen.maskUrl) {
              try {
                const protectedImage = await compositeMasked(gen.originalUrl, data.urls[0], gen.maskUrl);
                urls = [protectedImage]; maskedComposite = true;
                // Upload the finished PNG only; the unprotected AI output is never shared.
                try {
                  const blob = await (await fetch(protectedImage)).blob();
                  if (blob.size <= 4 * 1024 * 1024) {
                    const form = new FormData(); form.append('file', new File([blob], 'revestimiento-verificado.png', { type: 'image/png' }));
                    const response = await fetch('/api/upload', { method:'POST', body:form });
                    if (response.ok) urls = [(await response.json()).url];
                  }
                } catch { /* retain downloadable local PNG when upload is unavailable */ }
              }
              catch { updateProject(projectId, p => ({ ...p, generations: p.generations.map(g => g.id === gen.id ? { ...g, status: 'error', rawResultUrl: data.urls[0], error: 'La IA terminó, pero no se pudo conservar el exterior de la máscara. Resultado bloqueado; no regeneres para evitar otro cobro.' } : g) })); continue; }
            }
            updateProject(projectId, (p) => ({
              ...p,
              generations: p.generations.map((g) =>
                g.id === gen.id ? { ...g, status: 'done', resultUrls: urls, rawResultUrl: data.urls[0], maskedComposite, review: 'pending' } : g,
              ),
            }));
          } else if (data.status === 'error') {
            updateProject(projectId, (p) => ({
              ...p,
              generations: p.generations.map((g) =>
                g.id === gen.id ? { ...g, status: 'error', error: data.error } : g,
              ),
            }));
          } else if (data.status === 'running' && gen.status !== 'running') {
            updateProject(projectId, (p) => ({
              ...p,
              generations: p.generations.map((g) =>
                g.id === gen.id ? { ...g, status: 'running' } : g,
              ),
            }));
          }
        } catch {
          // error transitorio de red: se reintenta en el próximo tick
        }
      }
      } finally { polling.current = false; }
    }, 3500);
    return () => clearInterval(timer);
  }, [projects, updateProject]);

  // ── acciones ──
  const createProject = (name: string, clientName: string) => {
    setTab('proyectos');
    const p: Project = { id: uid(), name, clientName, createdAt: Date.now(), generations: [] };
    setProjects((prev) => [p, ...prev]);
    setActiveId(p.id);
    setShowNewProject(false);
  };

  const deleteProject = (id: string) => {
    if (!window.confirm('¿Eliminar este proyecto y todas sus generaciones?')) return;
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  const addGeneration = (projectId: string, gen: Generation) => {
    updateProject(projectId, (p) => ({ ...p, generations: [gen, ...p.generations] }));
  };

  // ── costos ──
  const totals = useMemo(() => {
    const all = projects.flatMap((p) => p.generations).filter((g) => g.status !== 'error');
    const total = all.reduce((sum, g) => sum + g.costUsd, 0);
    const activeGens = (active?.generations ?? []).filter((g) => g.status !== 'error');
    const activeTotal = activeGens.reduce((sum, g) => sum + g.costUsd, 0);
    return { total, activeTotal, count: all.length };
  }, [projects, active]);

  const exportCSV = () => {
    const rows = [['Proyecto', 'Cliente', 'Tipo', 'Descripción', 'Fecha', 'Costo API (USD)', `A facturar x${margin} (USD)`]];
    for (const p of projects) {
      for (const g of p.generations) {
        if (g.status === 'error') continue;
        rows.push([
          p.name, p.clientName, g.kind === 'image' ? 'Render' : 'Video',
          g.label, new Date(g.createdAt).toLocaleString('es'),
          g.costUsd.toFixed(3), (g.costUsd * margin).toFixed(2),
        ]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/^[=+@-]/, "\'$&").replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'numan-costos.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!hydrated) return null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo-mark">numan</span>
          <span className="brand-tag">estudio 3D</span>
        </div>
        <div className="side-label">Proyectos</div>
        {visibleProjects.map((p) => (
          <button
            key={p.id}
            className={`proj-item ${tab === 'proyectos' && p.id === activeId ? 'active' : ''}`}
            onClick={() => { setTab('proyectos'); setActiveId(p.id); }}
          >
            <div className="p-name">{p.name}</div>
            <div className="p-client">{p.clientName || 'Sin cliente'} · {p.generations.length} generaciones</div>
          </button>
        ))}
        <button className="btn-new-proj" onClick={() => { setTab('proyectos'); setShowNewProject(true); }}>
          + Nuevo proyecto
        </button>
        <ProjectTools projects={projects} onRestore={incoming => setProjects(previous => [...incoming.filter(p => !previous.some(old => old.id === p.id)), ...previous])} />
        <div className="side-label" style={{ marginTop: 14 }}>Fábrica</div>
        <button
          className={`proj-item ${tab === 'decostone' ? 'active' : ''}`}
          onClick={() => setTab('decostone')}
        >
          <div className="p-name">🧱 Decostone</div>
          <div className="p-client">Revestimientos · {decoProject.generations.length} trabajos</div>
        </button>
      </aside>

      <main className="main">
        {storageError && <p role="alert" className="error-note">{storageError}</p>}
        {!connectionReady && <p role="status" className="error-note">{connectionError || 'Comprobando conexión…'}</p>}
        <div className="studio-intro"><div><span className="eyebrow">NUMAN ESTUDIO 3D · 2.0</span><h2>Tu proyecto, con sus materiales.</h2><p>Referencia original → materiales → comparación → aprobación → entrega</p></div><span className="fidelity-badge">Conservación del diseño activa</span></div>
        <fieldset disabled={!connectionReady} className="workspace-fields">
        {demo && (
          <div className="demo-banner">
            <span className="demo-pill">Modo demo</span>
            <span>Explora toda la app sin pagar nada.</span>
            <span className="note">
              Las generaciones son de muestra y los costos son lo que costaría en real.
              Al configurar la clave de fal.ai se activan los renders y videos reales.
            </span>
          </div>
        )}
        {tab === 'decostone' ? (
          <Decostone
            project={decoProject}
            demo={demo}
            onAddGeneration={addDecoGeneration}
            onReview={(g) => setReviewTarget({projectId: DECO_PROJECT_ID, gen:g})}
            onOpen={(url, kind) => setLightboxUrl({ url, kind })}
          />
        ) : !active ? (
          <EmptyState onCreate={() => setShowNewProject(true)} />
        ) : (
          <ProjectView
            key={active.id}
            project={active}
            demo={demo}
            onUpdate={(fn) => updateProject(active.id, fn)}
            onAddGeneration={(g) => addGeneration(active.id, g)}
            onDelete={() => deleteProject(active.id)}
            onMakeVideo={(g) => setVideoSource(g)}
            onReview={(g) => setReviewTarget({projectId: active.id, gen:g})}
            onOpen={(url, kind) => setLightboxUrl({ url, kind })}
          />
        )}
        </fieldset>
      </main>

      <div className="cost-bar">
        <div className="cost-item">
          <span className="c-label">Costo API total{demo ? ' (simulado)' : ''}</span>
          <span className="c-value">{usd(totals.total)}</span>
        </div>
        {active && (
          <div className="cost-item">
            <span className="c-label">Este proyecto</span>
            <span className="c-value">{usd(totals.activeTotal)}</span>
          </div>
        )}
        <div className="cost-item cost-margin">
          <span className="c-label">Margen (x)</span>
          <input
            type="number" min={1} step={0.5} value={margin}
            onChange={(e) => setMargin(Number(e.target.value) || 1)}
          />
        </div>
        <div className="cost-item">
          <span className="c-label">A facturar</span>
          <span className="c-value accent">{usd(totals.total * margin)}</span>
        </div>
        <div className="cost-spacer" />
        <button className="btn-ghost" onClick={exportCSV}>Exportar CSV</button>
      </div>

      {reviewTarget && <ReviewDialog gen={reviewTarget.gen} onClose={() => setReviewTarget(null)} onSave={patch => updateProject(reviewTarget.projectId, p => ({ ...p, generations:p.generations.map(g => g.id === reviewTarget.gen.id ? {...g,...patch}:g) }))} />}
      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} onCreate={createProject} />
      )}
      {videoSource && active && (
        <VideoModal
          source={videoSource}
          project={active}
          demo={demo}
          onClose={() => setVideoSource(null)}
          onQueued={(g) => { addGeneration(active.id, g); setVideoSource(null); }}
        />
      )}
      {lightboxUrl && (
        <div className="lightbox" onClick={() => setLightboxUrl(null)}>
          {lightboxUrl.kind === 'video' && !lightboxUrl.url.startsWith('data:image')
            ? <video src={lightboxUrl.url} controls autoPlay loop onClick={(e) => e.stopPropagation()} />
            : <img src={lightboxUrl.url} alt="Vista ampliada" />}
        </div>
      )}
    </div>
  );
}

// ── vista vacía ──────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📐</div>
      <h2 style={{ marginBottom: 8 }}>Del plano al render en minutos</h2>
      <p className="empty-note" style={{ maxWidth: 460, margin: '0 auto 20px' }}>
        Crea un proyecto, sube el plano arquitectónico y genera renders fotorrealistas
        y videos recorrido listos para presentar a tu cliente.
      </p>
      <button className="btn" onClick={onCreate}>Crear mi primer proyecto</button>
    </div>
  );
}

// ── modal nuevo proyecto ─────────────────────────────────────────────────────

function NewProjectModal({
  onClose, onCreate,
}: { onClose: () => void; onCreate: (name: string, client: string) => void }) {
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Nuevo proyecto</h3>
        <div className="field-row">
          <div className="field">
            <label>Nombre del proyecto</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Casa Guayabal" autoFocus />
          </div>
          <div className="field">
            <label>Cliente</label>
            <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Familia Pérez" />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" disabled={!name.trim()} onClick={() => onCreate(name.trim(), client.trim())}>
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}

// ── vista de proyecto ────────────────────────────────────────────────────────

function ProjectView({
  project, demo, onUpdate, onAddGeneration, onDelete, onMakeVideo, onReview, onOpen,
}: {
  project: Project;
  demo: boolean;
  onUpdate: (fn: (p: Project) => Project) => void;
  onAddGeneration: (g: Generation) => void;
  onDelete: () => void;
  onMakeVideo: (g: Generation) => void;
  onReview: (g: Generation) => void;
  onOpen: (url: string, kind: 'image' | 'video') => void;
}) {
  const [showLink, setShowLink] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 800 }}>{project.name}</h1>
          {project.clientName && <div className="empty-note">Cliente: {project.clientName}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setShowLink(true)}>🔗 Enlace para el cliente</button>
          <button className="btn-ghost" onClick={onDelete}>Eliminar proyecto</button>
        </div>
      </div>
      {showLink && <ClientLinkModal project={project} onClose={() => setShowLink(false)} />}

      <div className="project-guidance"><strong>Empieza por una vista 3D o una foto para conservar el encuadre.</strong><p>Si solo tienes un plano, el resultado será conceptual: faltan alturas, cámara y superficies ocultas. Para exactitud dimensional, utiliza el modelo 3D del arquitecto.</p></div>
      <MaterialSection project={project} demo={demo} onUpdate={onUpdate} />
      <SketchupSection project={project} demo={demo} onUpdate={onUpdate} onAddGeneration={onAddGeneration} />
      <details className="plan-details"><summary>Trabajar desde un plano · propuesta conceptual</summary>
      <PlanSection project={project} demo={demo} onUpdate={onUpdate} />
      <RenderSection project={project} demo={demo} onAddGeneration={onAddGeneration} />
      </details>
      <PanoramaImport demo={demo} onAddGeneration={onAddGeneration} />
      <GallerySection project={project} onMakeVideo={onMakeVideo} onReview={onReview} onOpen={onOpen} />
    </>
  );
}

// ── paso 1: plano ────────────────────────────────────────────────────────────

function PlanSection({
  project, demo, onUpdate,
}: { project: Project; demo: boolean; onUpdate: (fn: (p: Project) => Project) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 4*1024*1024) throw new Error('Sube PNG, JPG o WebP de hasta 4 MB.');
      if (demo) {
        // En demo el plano se queda en el navegador, no se sube a ningún lado
        const dataUrl = await fileToDataUrl(file);
        onUpdate((p) => ({ ...p, planUrl: dataUrl }));
      } else {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al subir');
        onUpdate((p) => ({ ...p, planUrl: data.url }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir el plano');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="section">
      <div className="section-head">
        <div className="step-num">1</div>
        <h2>El plano</h2>
        <span className="hint">PNG, JPG o WebP · opcional si vas a trabajar desde vistas de SketchUp</span>
      </div>
      <div className="panel">
        {project.planUrl ? (
          <div className="plan-preview">
            <img src={project.planUrl} alt="Plano del proyecto" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="status-pill status-done" style={{ alignSelf: 'flex-start' }}>Plano cargado</span>
              <button className="btn-ghost" onClick={() => inputRef.current?.click()} disabled={uploading}>
                {uploading ? 'Subiendo…' : 'Reemplazar plano'}
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`dropzone ${drag ? 'drag' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault(); setDrag(false);
              const file = e.dataTransfer.files?.[0];
              if (file) upload(file);
            }}
          >
            <div className="dz-icon">📄</div>
            {uploading
              ? <div>Subiendo el plano…</div>
              : <div><strong>Arrastra el plano aquí</strong> o haz clic para buscarlo</div>}
          </div>
        )}
        <input
          ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
        />
        {error && <div className="error-note">{error}</div>}
      </div>
    </section>
  );
}

// ── paso 2: generar renders ──────────────────────────────────────────────────

function RenderSection({
  project, demo, onAddGeneration,
}: { project: Project; demo: boolean; onAddGeneration: (g: Generation) => void }) {
  const [conceptAcknowledged, setConceptAcknowledged] = useState(false);
  const [spaceIds, setSpaceIds] = useState<string[]>(['sala']);
  const [styleId, setStyleId] = useState('moderno');
  const [lightId, setLightId] = useState('dia');
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('2K');
  const [extra, setExtra] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleSpace = (id: string) =>
    setSpaceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const style = STYLES.find((s) => s.id === styleId)!;
  const lighting = LIGHTING.find((l) => l.id === lightId)!;
  const estCost = estimateImageCost(resolution, spaceIds.length);

  const generate = async () => {
    if (!conceptAcknowledged) { setError('Confirma que se trata de una propuesta conceptual.'); return; }
    if (!project.planUrl) { setError('Primero sube el plano del proyecto.'); return; }
    if (spaceIds.length === 0) { setError('Elige al menos un espacio.'); return; }
    setError('');
    setSubmitting(true);
    try {
      for (const spaceId of spaceIds) {
        const space = SPACES.find((s) => s.id === spaceId)!;
        let prompt = buildRenderPrompt({ space, style, lighting, extra });
        let requestId: string; let jobToken: string | undefined;
        if (demo) {
          requestId = DEMO_PREFIX + uid();
        } else {
          const res = await postJSON<{ requestId: string; jobToken: string; prompt: string }>('/api/generate', {
            endpoint: IMAGE_MODEL.id, operation: 'render', options: { spaceId, styleId, lightId, extra, materials: project.materials, conceptAcknowledged },
            input: {
              prompt,
              image_urls: [project.planUrl, ...(project.materialRefs ?? []).map(r => r.url)],
              num_images: 1,
              output_format: 'png',
              resolution,
              aspect_ratio: '4:3',
            },
          });
          requestId = res.requestId; jobToken = res.jobToken; prompt = res.prompt;
        }
        onAddGeneration({
          id: requestId,
          endpoint: IMAGE_MODEL.id, jobToken, conceptual: true, review: 'pending', policyVersion: 'numan-fidelity-2.0',
          kind: 'image',
          label: `${space.label} — ${style.label}`,
          prompt,
          status: 'queued',
          createdAt: Date.now(),
          costUsd: estimateImageCost(resolution, 1),
          sourceImageUrl: project.planUrl,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="section">
      <div className="section-head">
        <div className="step-num">2</div>
        <h2>Propuestas desde el plano</h2>
        <span className="hint">{IMAGE_MODEL.label} · desde {usd(0.15)} por imagen</span>
      </div>
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field">
          <label className="acknowledge"><input type="checkbox" checked={conceptAcknowledged} onChange={e => setConceptAcknowledged(e.target.checked)} />Entiendo que un plano no define toda la geometría ni los materiales. Revisaré esta propuesta conceptual.</label>
          <label>Espacios a renderizar (elige varios)</label>
          <div className="chips">
            {SPACES.map((s) => (
              <button key={s.id} className={`chip ${spaceIds.includes(s.id) ? 'on' : ''}`} onClick={() => toggleSpace(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Estilo</label>
          <div className="chips">
            {STYLES.map((s) => (
              <button key={s.id} className={`chip ${styleId === s.id ? 'on' : ''}`} onClick={() => setStyleId(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Iluminación</label>
            <div className="chips">
              {LIGHTING.map((l) => (
                <button key={l.id} className={`chip ${lightId === l.id ? 'on' : ''}`} onClick={() => setLightId(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ maxWidth: 190 }}>
            <label>Resolución</label>
            <select value={resolution} onChange={(e) => setResolution(e.target.value as '1K' | '2K' | '4K')}>
              <option value="1K">1K — borrador</option>
              <option value="2K">2K — presentación</option>
              <option value="4K">4K — impresión (2x costo)</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Notas adicionales (opcional)</label>
          <textarea
            value={extra} onChange={(e) => setExtra(e.target.value)}
            placeholder="Ej.: la cocina lleva isla central en granito negro; el cliente quiere piso de porcelanato gris…"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button className="btn" onClick={generate} disabled={submitting || !project.planUrl || !conceptAcknowledged}>
            {submitting ? 'Encolando…' : `Generar ${spaceIds.length} render${spaceIds.length === 1 ? '' : 's'}`}
          </button>
          <span className="empty-note">
            Costo {demo ? 'que tendría en real' : 'estimado'}: <strong>{usd(estCost)}</strong>
          </span>
          {!project.planUrl && <span className="empty-note">⚠ Sube el plano primero</span>}
        </div>
        {error && <div className="error-note">{error}</div>}
      </div>
    </section>
  );
}

// ── paso 3: galería ──────────────────────────────────────────────────────────

function GallerySection({
  project, onMakeVideo, onReview, onOpen,
}: {
  project: Project;
  onMakeVideo: (g: Generation) => void;
  onReview: (g: Generation) => void;
  onOpen: (url: string, kind: 'image' | 'video') => void;
}) {
  const gens = project.generations;
  return (
    <section className="section">
      <div className="section-head">
        <div className="step-num">3</div>
        <h2>Galería del proyecto</h2>
        <span className="hint">renders y videos listos para mostrar al cliente</span>
      </div>
      {gens.length === 0 ? (
        <div className="empty-note">Aún no hay generaciones. Configura los renders arriba y presiona Generar.</div>
      ) : (
        <div className="grid">
          {gens.map((g) => (
            <GenerationCard key={g.id} gen={g} onMakeVideo={onMakeVideo} onReview={onReview} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── modal de video ───────────────────────────────────────────────────────────

function VideoModal({
  source, project, demo, onClose, onQueued,
}: {
  source: Generation;
  project: Project;
  demo: boolean;
  onClose: () => void;
  onQueued: (g: Generation) => void;
}) {
  const [endId, setEndId] = useState('');
  const [audio, setAudio] = useState(false);
  const [cameraId, setCameraId] = useState('fija');
  const [modelKey, setModelKey] = useState('seedance25');
  const [resolution, setResolution] = useState('720p');
  const [duration, setDuration] = useState<number>(5);
  const [extra, setExtra] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const camera = CAMERAS.find((c) => c.id === cameraId)!;
  const model = VIDEO_MODELS[modelKey];
  const estCost = estimateVideoCost(modelKey, resolution, duration);
  const sourceUrl = source.resultUrls?.[0];

  const generate = async () => {
    if (!sourceUrl) return;
    setError('');
    setSubmitting(true);
    try {
      let videoInputUrl = sourceUrl;
      if (!demo && sourceUrl.startsWith('data:')) {
        const blob = await (await fetch(sourceUrl)).blob();
        const form = new FormData(); form.append('file', new File([blob], 'render-aprobado.png', { type: blob.type }));
        const response = await fetch('/api/upload', { method: 'POST', body: form }); const data = await response.json();
        if (!response.ok) throw new Error(data.error); videoInputUrl = data.url;
      }
      let prompt = buildVideoPrompt({ camera, durationSec: duration, extra });
      let requestId: string; let jobToken: string | undefined;
      if (demo) {
        requestId = DEMO_PREFIX + uid();
      } else {
        const res = await postJSON<{ requestId: string; jobToken: string; prompt: string }>('/api/generate', {
          endpoint: model.id, operation: 'video', options: { cameraId, extra, audio },
          input: {
            prompt,
            image_url: videoInputUrl,
            ...(endId && modelKey === 'seedance25' ? { end_image_url: project.generations.find(g => g.id === endId)?.resultUrls?.[0] } : {}),
            resolution,
            duration: String(duration),
          },
        });
        requestId = res.requestId; jobToken = res.jobToken; prompt = res.prompt;
      }
      onQueued({
        id: requestId,
        endpoint: model.id, jobToken, review: 'pending', conceptual: source.conceptual, policyVersion: 'numan-fidelity-2.0',
        kind: 'video',
        label: `${source.label} — ${camera.label}`,
        prompt,
        status: 'queued',
        createdAt: Date.now(),
        costUsd: estCost,
        sourceImageUrl: sourceUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar el video');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="empty-note">Para máxima conservación, exporta un video fijo sin IA desde la revisión. Los movimientos generativos pueden revelar o deformar zonas no documentadas: revisa el clip completo.</p>
        <h3>🎬 Video recorrido — {source.label}</h3>
        {sourceUrl && (
          <img src={sourceUrl} alt={source.label} style={{ borderRadius: 8, marginBottom: 14, maxHeight: 180, objectFit: 'cover', width: '100%' }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            {modelKey === 'seedance25' && <><label>Fotograma final aprobado del mismo ambiente (opcional)</label><select value={endId} onChange={e => setEndId(e.target.value)}><option value="">Solo imagen inicial</option>{project.generations.filter(g => g.id !== source.id && g.kind === 'image' && !g.pano && g.review === 'approved' && g.resultUrls?.[0]?.startsWith('https://')).map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</select><label><input type="checkbox" checked={audio} onChange={e => setAudio(e.target.checked)} /> Sonido ambiente</label></>}
            <label>Movimiento de cámara</label>
            <div className="chips">
              {CAMERAS.map((c) => (
                <button key={c.id} className={`chip ${cameraId === c.id ? 'on' : ''}`} onClick={() => setCameraId(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Calidad</label>
              <select
                value={modelKey}
                onChange={(e) => {
                  const key = e.target.value;
                  setModelKey(key);
                  const m = VIDEO_MODELS[key];
                  if (!m.resolutions.includes(resolution)) setResolution(m.resolutions[m.resolutions.length - 1]);
                  if (!m.durations.includes(duration)) setDuration(m.durations[0]);
                }}
              >
                {Object.entries(VIDEO_MODELS).map(([key, m]) => (
                  <option key={key} value={key}>{m.label} — {m.description}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ maxWidth: 130 }}>
              <label>Resolución</label>
              <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                {model.resolutions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="field" style={{ maxWidth: 140 }}>
              <label>Duración</label>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {model.durations.map((d) => <option key={d} value={d}>{d} segundos</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Notas adicionales (opcional)</label>
            <textarea value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Ej.: que el recorrido termine mirando hacia el ventanal…" />
          </div>
        </div>
        {error && <div className="error-note">{error}</div>}
        <div className="modal-actions">
          <span className="empty-note" style={{ marginRight: 'auto' }}>
            Costo {demo ? 'que tendría en real' : 'estimado'}: <strong>{usd(estCost)}</strong>
          </span>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={generate} disabled={submitting}>
            {submitting ? 'Encolando…' : 'Generar video'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── modal: enlace para el cliente ────────────────────────────────────────────

function ClientLinkModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const result: ClientLinkResult | null = buildClientLink(project);

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // navegadores sin permiso de portapapeles: seleccionar manualmente
      const box = document.getElementById('client-link-box') as HTMLTextAreaElement | null;
      box?.select();
    }
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>🔗 Enlace para el cliente</h3>
        {!result ? (
          <>
            <p className="empty-note" style={{ padding: 0 }}>
              Este proyecto aún no tiene resultados aprobados. Abre Comparar y revisar, verifica el diseño y aprueba una pieza real para compartirla.
            </p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={onClose}>Entendido</button>
            </div>
          </>
        ) : (
          <>
            <p className="empty-note" style={{ padding: 0, marginBottom: 12 }}>
              El cliente abre este enlace en su teléfono y ve su proyecto completo con la marca
              del estudio: {result.videos > 0 && <strong>{result.videos} video{result.videos === 1 ? '' : 's'} · </strong>}
              <strong>{result.images} imagen{result.images === 1 ? '' : 'es'}</strong>
              .
            </p>
            {result.isDemo && (
              <p className="error-note" style={{ marginTop: 0, marginBottom: 12 }}>
                ⚠ Incluye piezas de muestra del modo demo. Para el cliente real, genera las
                piezas con la app activada.
              </p>
            )}
            <p className="empty-note">Cualquier persona con el enlace podrá ver estos resultados. No incluye el plano original. Los archivos del proveedor pueden caducar: conserva tus descargas.</p>
            {result.url.length > 12000 && <p className="error-note">Este enlace es largo y algunos mensajeros pueden cortarlo. Comparte menos resultados o descarga los archivos.</p>}
            <textarea
              id="client-link-box"
              readOnly
              value={result.url}
              onFocus={(e) => e.currentTarget.select()}
              style={{
                width: '100%', minHeight: 74, fontSize: 12, color: 'var(--text-dim)',
                background: '#FBFAF7', border: '1px solid var(--border)', borderRadius: 8,
                padding: 10, resize: 'none', wordBreak: 'break-all',
              }}
            />
            <div className="modal-actions">
              <a className="btn-ghost" href={result.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', marginRight: 'auto' }}>
                Ver como cliente
              </a>
              <button className="btn-ghost" onClick={onClose}>Cerrar</button>
              <button className="btn" onClick={copy}>{copied ? '✓ Copiado' : 'Copiar enlace'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
