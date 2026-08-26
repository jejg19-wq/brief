'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Generation, Project } from '@/lib/types';
import { loadProjects, saveProjects, uid, useMargin } from '@/lib/store';
import {
  IMAGE_MODEL, VIDEO_MODELS, VIDEO_RESOLUTIONS, VIDEO_DURATIONS,
  estimateImageCost, estimateVideoCost,
} from '@/lib/models';
import {
  SPACES, STYLES, LIGHTING, CAMERAS,
  buildRenderPrompt, buildVideoPrompt,
} from '@/lib/prompts';

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
  const [margin, setMargin] = useMargin();
  const [showNewProject, setShowNewProject] = useState(false);
  const [videoSource, setVideoSource] = useState<Generation | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<{ url: string; kind: 'image' | 'video' } | null>(null);

  // hidratar desde localStorage
  useEffect(() => {
    const loaded = loadProjects();
    setProjects(loaded);
    if (loaded.length > 0) setActiveId(loaded[0].id);
    setHydrated(true);
  }, []);

  // persistir
  useEffect(() => {
    if (hydrated) saveProjects(projects);
  }, [projects, hydrated]);

  const active = projects.find((p) => p.id === activeId) ?? null;

  const updateProject = useCallback((projectId: string, fn: (p: Project) => Project) => {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? fn(p) : p)));
  }, []);

  // ── polling de generaciones pendientes ──
  useEffect(() => {
    const pending = projects.flatMap((p) =>
      p.generations
        .filter((g) => g.status === 'queued' || g.status === 'running')
        .map((g) => ({ projectId: p.id, gen: g })),
    );
    if (pending.length === 0) return;

    const timer = setInterval(async () => {
      for (const { projectId, gen } of pending) {
        try {
          const res = await fetch(
            `/api/status?endpoint=${encodeURIComponent(gen.endpoint)}&requestId=${encodeURIComponent(gen.id)}`,
          );
          const data = await res.json();
          if (data.status === 'done') {
            updateProject(projectId, (p) => ({
              ...p,
              generations: p.generations.map((g) =>
                g.id === gen.id ? { ...g, status: 'done', resultUrls: data.urls } : g,
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
    }, 4000);
    return () => clearInterval(timer);
  }, [projects, updateProject]);

  // ── acciones ──
  const createProject = (name: string, clientName: string) => {
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
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'arqviz-costos.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!hydrated) return null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-name">Arq<em>Viz</em></span>
          <span className="brand-tag">studio</span>
        </div>
        <div className="side-label">Proyectos</div>
        {projects.map((p) => (
          <button
            key={p.id}
            className={`proj-item ${p.id === activeId ? 'active' : ''}`}
            onClick={() => setActiveId(p.id)}
          >
            <div className="p-name">{p.name}</div>
            <div className="p-client">{p.clientName || 'Sin cliente'} · {p.generations.length} generaciones</div>
          </button>
        ))}
        <button className="btn-new-proj" onClick={() => setShowNewProject(true)}>
          + Nuevo proyecto
        </button>
      </aside>

      <main className="main">
        {!active ? (
          <EmptyState onCreate={() => setShowNewProject(true)} />
        ) : (
          <ProjectView
            key={active.id}
            project={active}
            onUpdate={(fn) => updateProject(active.id, fn)}
            onAddGeneration={(g) => addGeneration(active.id, g)}
            onDelete={() => deleteProject(active.id)}
            onMakeVideo={(g) => setVideoSource(g)}
            onOpen={(url, kind) => setLightboxUrl({ url, kind })}
          />
        )}
      </main>

      <div className="cost-bar">
        <div className="cost-item">
          <span className="c-label">Costo API total</span>
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

      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} onCreate={createProject} />
      )}
      {videoSource && active && (
        <VideoModal
          source={videoSource}
          onClose={() => setVideoSource(null)}
          onQueued={(g) => { addGeneration(active.id, g); setVideoSource(null); }}
        />
      )}
      {lightboxUrl && (
        <div className="lightbox" onClick={() => setLightboxUrl(null)}>
          {lightboxUrl.kind === 'video'
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
  project, onUpdate, onAddGeneration, onDelete, onMakeVideo, onOpen,
}: {
  project: Project;
  onUpdate: (fn: (p: Project) => Project) => void;
  onAddGeneration: (g: Generation) => void;
  onDelete: () => void;
  onMakeVideo: (g: Generation) => void;
  onOpen: (url: string, kind: 'image' | 'video') => void;
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{project.name}</h1>
          {project.clientName && <div className="empty-note">Cliente: {project.clientName}</div>}
        </div>
        <button className="btn-ghost" onClick={onDelete}>Eliminar proyecto</button>
      </div>

      <PlanSection project={project} onUpdate={onUpdate} />
      <RenderSection project={project} onAddGeneration={onAddGeneration} />
      <GallerySection project={project} onMakeVideo={onMakeVideo} onOpen={onOpen} />
    </>
  );
}

// ── paso 1: plano ────────────────────────────────────────────────────────────

function PlanSection({
  project, onUpdate,
}: { project: Project; onUpdate: (fn: (p: Project) => Project) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir');
      onUpdate((p) => ({ ...p, planUrl: data.url }));
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
        <span className="hint">PNG, JPG o WebP · exporta el PDF como imagen</span>
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
  project, onAddGeneration,
}: { project: Project; onAddGeneration: (g: Generation) => void }) {
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
    if (!project.planUrl) { setError('Primero sube el plano del proyecto.'); return; }
    if (spaceIds.length === 0) { setError('Elige al menos un espacio.'); return; }
    setError('');
    setSubmitting(true);
    try {
      for (const spaceId of spaceIds) {
        const space = SPACES.find((s) => s.id === spaceId)!;
        const prompt = buildRenderPrompt({ space, style, lighting, extra });
        const { requestId } = await postJSON<{ requestId: string }>('/api/generate', {
          endpoint: IMAGE_MODEL.id,
          input: {
            prompt,
            image_urls: [project.planUrl],
            num_images: 1,
            output_format: 'png',
            resolution,
            aspect_ratio: '4:3',
          },
        });
        onAddGeneration({
          id: requestId,
          endpoint: IMAGE_MODEL.id,
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
        <h2>Renders fotorrealistas</h2>
        <span className="hint">{IMAGE_MODEL.label} · desde {usd(0.15)} por imagen</span>
      </div>
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field">
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
          <div className="field" style={{ maxWidth: 160 }}>
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
          <button className="btn" onClick={generate} disabled={submitting || !project.planUrl}>
            {submitting ? 'Encolando…' : `Generar ${spaceIds.length} render${spaceIds.length === 1 ? '' : 's'}`}
          </button>
          <span className="empty-note">Costo estimado: <strong>{usd(estCost)}</strong></span>
          {!project.planUrl && <span className="empty-note">⚠ Sube el plano primero</span>}
        </div>
        {error && <div className="error-note">{error}</div>}
      </div>
    </section>
  );
}

// ── paso 3: galería ──────────────────────────────────────────────────────────

function GallerySection({
  project, onMakeVideo, onOpen,
}: {
  project: Project;
  onMakeVideo: (g: Generation) => void;
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
            <GenerationCard key={g.id} gen={g} onMakeVideo={onMakeVideo} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

function GenerationCard({
  gen, onMakeVideo, onOpen,
}: {
  gen: Generation;
  onMakeVideo: (g: Generation) => void;
  onOpen: (url: string, kind: 'image' | 'video') => void;
}) {
  const url = gen.resultUrls?.[0];
  const statusLabel: Record<string, string> = {
    queued: 'En cola', running: 'Generando…', done: 'Listo', error: 'Error',
  };
  return (
    <div className="card">
      <div
        className="media"
        style={{ cursor: url ? 'zoom-in' : 'default' }}
        onClick={() => url && onOpen(url, gen.kind)}
      >
        {gen.status === 'done' && url ? (
          gen.kind === 'video'
            ? <video src={url} muted loop playsInline onMouseEnter={(e) => e.currentTarget.play()} onMouseLeave={(e) => e.currentTarget.pause()} />
            : <img src={url} alt={gen.label} loading="lazy" />
        ) : gen.status === 'error' ? (
          <span style={{ fontSize: 26 }}>⚠️</span>
        ) : (
          <div className="spinner" />
        )}
      </div>
      <div className="meta">
        <span className="g-label">{gen.kind === 'video' ? '🎬 ' : ''}{gen.label}</span>
        <span className="g-sub">
          <span className={`status-pill status-${gen.status}`}>{statusLabel[gen.status]}</span>
          <span>{usd(gen.costUsd)}</span>
        </span>
      </div>
      {gen.status === 'done' && url && (
        <div className="actions">
          {gen.kind === 'image' && (
            <button className="btn-ghost" onClick={() => onMakeVideo(gen)}>🎬 Crear video</button>
          )}
          <a className="btn-ghost" href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            Descargar
          </a>
        </div>
      )}
      {gen.status === 'error' && gen.error && (
        <div className="error-note" style={{ padding: '0 12px 12px', marginTop: 0 }}>{gen.error}</div>
      )}
    </div>
  );
}

// ── modal de video ───────────────────────────────────────────────────────────

function VideoModal({
  source, onClose, onQueued,
}: {
  source: Generation;
  onClose: () => void;
  onQueued: (g: Generation) => void;
}) {
  const [cameraId, setCameraId] = useState('recorrido');
  const [modelKey, setModelKey] = useState('seedance');
  const [resolution, setResolution] = useState('1080p');
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
      const prompt = buildVideoPrompt({ camera, durationSec: duration, extra });
      const { requestId } = await postJSON<{ requestId: string }>('/api/generate', {
        endpoint: model.id,
        input: {
          prompt,
          image_url: sourceUrl,
          resolution,
          duration: String(duration),
        },
      });
      onQueued({
        id: requestId,
        endpoint: model.id,
        kind: 'video',
        label: `Video: ${source.label} — ${camera.label}`,
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
        <h3>🎬 Video recorrido — {source.label}</h3>
        {sourceUrl && (
          <img src={sourceUrl} alt={source.label} style={{ borderRadius: 8, marginBottom: 14, maxHeight: 180, objectFit: 'cover', width: '100%' }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
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
              <select value={modelKey} onChange={(e) => setModelKey(e.target.value)}>
                {Object.entries(VIDEO_MODELS).map(([key, m]) => (
                  <option key={key} value={key}>{m.label} — {m.description}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ maxWidth: 130 }}>
              <label>Resolución</label>
              <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                {VIDEO_RESOLUTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="field" style={{ maxWidth: 130 }}>
              <label>Duración</label>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {VIDEO_DURATIONS.map((d) => <option key={d} value={d}>{d} segundos</option>)}
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
            Costo estimado: <strong>{usd(estCost)}</strong>
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
