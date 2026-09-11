'use client';

import { useRef, useState } from 'react';
import type { Generation, Project, SkpView } from '@/lib/types';
import { IMAGE_MODEL, IMAGE_MODELS, estimateImageCost } from '@/lib/models';
import { STYLES, LIGHTING, buildSkpPrompt } from '@/lib/prompts';
import { DEMO_PREFIX, fileToDataUrl } from '@/lib/demo';
import { uid } from '@/lib/store';

const usd = (n: number) => `$${n.toFixed(2)}`;

/**
 * SketchUp → Realismo: el arquitecto sube las vistas de su modelo (todas las
 * que quiera), le pone nombre a cada ambiente, elige el estilo, y la IA las
 * convierte en fotografías realistas conservando la geometría exacta.
 */
export default function SketchupSection({
  project, demo, onUpdate, onAddGeneration,
}: {
  project: Project;
  demo: boolean;
  onUpdate: (fn: (p: Project) => Project) => void;
  onAddGeneration: (g: Generation) => void;
}) {
  const [styleId, setStyleId] = useState('original');
  const [lightId, setLightId] = useState('original');
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('2K');
  const [modelKey, setModelKey] = useState('pro');
  const model = IMAGE_MODELS[modelKey];
  const [extra, setExtra] = useState('');
  const [uploading, setUploading] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const views = project.skpViews ?? [];
  const style = STYLES.find((s) => s.id === styleId)!;
  const lighting = LIGHTING.find((l) => l.id === lightId)!;
  const estCost = estimateImageCost(resolution, views.length, modelKey);

  const addFiles = async (files: FileList | File[]) => {
    setError('');
    const list = Array.from(files).filter((f) => ['image/png','image/jpeg','image/webp'].includes(f.type) && f.size <= 4 * 1024 * 1024);
    if (list.length !== files.length) setError('Solo PNG, JPG o WebP de hasta 4 MB por imagen.');
    if (list.length === 0) return;
    let done = 0;
    for (const file of list) {
      done++;
      setUploading(`Subiendo vista ${done} de ${list.length}…`);
      try {
        let url: string;
        if (demo) {
          url = await fileToDataUrl(file);
        } else {
          const form = new FormData();
          form.append('file', file);
          const res = await fetch('/api/upload', { method: 'POST', body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al subir');
          url = data.url;
        }
        const view: SkpView = { id: uid(), url, label: '' };
        onUpdate((p) => ({ ...p, skpViews: [...(p.skpViews ?? []), view] }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al subir una vista');
      }
    }
    setUploading('');
  };

  const setLabel = (id: string, label: string) =>
    onUpdate((p) => ({
      ...p,
      skpViews: (p.skpViews ?? []).map((v) => (v.id === id ? { ...v, label } : v)),
    }));

  const removeView = (id: string) =>
    onUpdate((p) => ({ ...p, skpViews: (p.skpViews ?? []).filter((v) => v.id !== id) }));

  const generate = async () => {
    if (views.length === 0) { setError('Sube al menos una vista del modelo.'); return; }
    setError('');
    setSubmitting(true);
    try {
      let i = 0;
      for (const view of views) {
        i++;
        const label = view.label.trim() || `Vista ${i}`;
        let prompt = buildSkpPrompt({ label, style, lighting, extra });
        let requestId: string; let jobToken: string | undefined;
        if (demo) {
          requestId = DEMO_PREFIX + uid();
        } else {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: model.id,
              operation: 'skp',
              options: { label, styleId, lightId, extra, materials: project.materials },
              input: {
                prompt,
                image_urls: [view.url, ...(project.materialRefs ?? []).map(r => r.url)],
                num_images: 1,
                output_format: 'png',
                resolution,
              },
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al generar');
          requestId = data.requestId; jobToken = data.jobToken; prompt = data.prompt;
        }
        onAddGeneration({
          id: requestId,
          endpoint: model.id,
          jobToken, review: 'pending', policyVersion: 'numan-fidelity-2.0',
          kind: 'image',
          label: `${label} — ${style.label}`,
          prompt,
          status: 'queued',
          createdAt: Date.now(),
          costUsd: estimateImageCost(resolution, 1, modelKey),
          sourceImageUrl: view.url,
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
        <h2>Fotos y vistas 3D → Materiales</h2>
        <span className="hint">conserva el diseño y revisa el resultado contra el original</span>
      </div>
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          className={`dropzone ${drag ? 'drag' : ''}`}
          style={{ padding: '26px 16px' }}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        >
          <div className="dz-icon">🏗️</div>
          {uploading
            ? <div><strong>{uploading}</strong></div>
            : <div><strong>Arrastra aquí tus fotos o vistas 3D</strong> (PNG, JPG, WebP · máximo 4 MB cada una) o haz clic para buscarlas</div>}
        </div>
        <input
          ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
        />

        {views.length > 0 && (
          <>
            <div className="skp-grid">
              {views.map((v, i) => (
                <div key={v.id} className="skp-card">
                  <img src={v.url} alt={v.label || `Vista ${i + 1}`} />
                  <input
                    value={v.label}
                    placeholder={`Ambiente (ej.: Cocina)`}
                    onChange={(e) => setLabel(v.id, e.target.value)}
                  />
                  <button className="skp-x" title="Quitar vista" onClick={() => removeView(v.id)}>×</button>
                </div>
              ))}
            </div>

            <div className="field">
              <label>Materiales para superficies existentes</label>
              <div className="chips">
                {STYLES.map((s) => (
                  <button key={s.id} className={`chip ${styleId === s.id ? 'on' : ''}`} onClick={() => setStyleId(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field"><label>Motor de imagen</label><select value={modelKey} onChange={e => setModelKey(e.target.value)}>{Object.entries(IMAGE_MODELS).map(([key,m]) => <option key={key} value={key}>{m.label}</option>)}</select><p className="empty-note">Ambos usan las mismas restricciones. Compara resultados; ningún motor garantiza geometría exacta.</p></div>
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
                placeholder="Ej.: los gabinetes van en madera clara mate; el mesón en cuarzo blanco; grifería negra…"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <button className="btn" onClick={generate} disabled={submitting || uploading !== ''}>
                {submitting ? 'Encolando…' : `Convertir ${views.length} vista${views.length === 1 ? '' : 's'} en realismo`}
              </button>
              <span className="empty-note">
                Costo {demo ? 'que tendría en real' : 'estimado'}: <strong>{usd(estCost)}</strong>
              </span>
            </div>
          </>
        )}
        {error && <div className="error-note">{error}</div>}
      </div>
    </section>
  );
}
