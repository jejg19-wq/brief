'use client';

import { useEffect, useRef, useState } from 'react';
import type { Generation, Project } from '@/lib/types';
import { IMAGE_MODEL, estimateImageCost } from '@/lib/models';
import {
  DECO_PIECES, DECO_COLORS, DECO_FINISHES,
  buildCladdingPrompt, pieceThumb,
} from '@/lib/decostone';
import { DEMO_PREFIX, fileToDataUrl } from '@/lib/demo';
import { uid } from '@/lib/store';
import GenerationCard from './GenerationCard';

const usd = (n: number) => `$${n.toFixed(2)}`;

/**
 * Módulo Decostone: el cliente envía la foto de una pared/espacio,
 * el arquitecto elige la pieza del catálogo, color y acabado, puede
 * dibujar la zona exacta a revestir, y la IA entrega la foto revestida.
 */
export default function Decostone({
  project, demo, onAddGeneration, onOpen, onReview,
}: {
  project: Project;
  onReview: (g:Generation)=>void;
  demo: boolean;
  onAddGeneration: (g: Generation) => void;
  onOpen: (url: string, kind: 'image' | 'video') => void;
}) {
  const [sampleUrl, setSampleUrl] = useState('');
  const sampleInput = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [pieceId, setPieceId] = useState('vermont');
  const [colorId, setColorId] = useState('natural');
  const [finishId, setFinishId] = useState('natural');
  const [extra, setExtra] = useState('');
  const [drawMode, setDrawMode] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [brush, setBrush] = useState(34);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);

  const piece = DECO_PIECES.find((p) => p.id === pieceId)!;
  const color = DECO_COLORS.find((c) => c.id === colorId)!;
  const finish = DECO_FINISHES.find((f) => f.id === finishId)!;
  const estCost = estimateImageCost('2K', 1);

  const loadPhoto = async (file: File) => {
    setError('');
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>4*1024*1024){setError('Sube PNG, JPG o WebP de hasta 4 MB.');return;}
    const dataUrl = await fileToDataUrl(file);
    setPhotoUrl(dataUrl);
    setHasMask(false);
    setDrawMode(false);
  };

  // dimensionar el canvas de máscara al tamaño mostrado de la foto
  useEffect(() => {
    if (!photoUrl) return;
    const img = imgRef.current;
    const canvas = maskRef.current;
    if (!img || !canvas) return;
    const sync = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    };
    if (img.complete) sync();
    img.addEventListener('load', sync);

    return () => {
      img.removeEventListener('load', sync);

    };
  }, [photoUrl]);

  const paint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!painting.current || !drawMode) return;
    const canvas = maskRef.current!;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * canvas.width / rect.width;
    const y = (e.clientY - rect.top) * canvas.height / rect.height;
    ctx.fillStyle = 'rgba(46, 230, 140, 0.45)';
    ctx.beginPath();
    ctx.arc(x, y, brush / 2 * canvas.width / rect.width, 0, Math.PI * 2);
    ctx.fill();
    setHasMask(true);
  };

  const clearMask = () => {
    const canvas = maskRef.current;
    if (canvas) canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasMask(false);
  };

  /** Combina la foto original con la máscara dibujada, a resolución natural */
  const compositeImage = async (): Promise<string> => {
    if (!hasMask) return photoUrl;
    const img = imgRef.current!;
    const mask = maskRef.current!;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    ctx.drawImage(mask, 0, 0, mask.width, mask.height, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  };

  const generate = async () => {
    if (!photoUrl) { setError('Primero sube la foto del cliente.'); return; }
    if (!hasMask || !sampleUrl) { setError('Marca la pared y sube una muestra real del revestimiento.'); return; }
    setError('');
    setSubmitting(true);
    try {
      const savedOriginal = photoUrl;
      const savedMask = maskRef.current!.toDataURL('image/png');
      let prompt = buildCladdingPrompt({ piece, color, finish, hasMask, extra });
      const label = `${piece.name} — ${color.label}${finish.id !== 'natural' ? ` — ${finish.label}` : ''}`;
      let requestId: string; let jobToken: string | undefined;
      const composed = await compositeImage();

      if (demo) {
        requestId = DEMO_PREFIX + uid();
      } else {
        async function uploadData(value:string,name:string) {
          const blob=await(await fetch(value)).blob();
          if(blob.size>4*1024*1024)throw new Error('La imagen preparada supera 4 MB. Reduce la resolución de la foto.');
          const form=new FormData();form.append('file',new File([blob],name,{type:blob.type}));
          const response=await fetch('/api/upload',{method:'POST',body:form});const data=await response.json();
          if(!response.ok)throw new Error(data.error||'Error al subir');return data.url;
        }
        const originalRemote=await uploadData(photoUrl,'original.png');
        const overlayRemote=await uploadData(composed,'seleccion.png');
        const sampleRemote=await uploadData(sampleUrl,'muestra.png');

        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: IMAGE_MODEL.id, operation:'cladding', options:{pieceId,colorId,finishId,hasMask,extra},
            input: {
              prompt,
              image_urls: [originalRemote,overlayRemote,sampleRemote],
              num_images: 1,
              output_format: 'png',
              resolution: '2K',
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al generar');
        requestId = data.requestId; jobToken=data.jobToken;prompt=data.prompt;
      }

      onAddGeneration({
        id: requestId,
        endpoint: IMAGE_MODEL.id,
        kind: 'image',
        label,
        prompt,
        status: 'queued',
        createdAt: Date.now(),
        costUsd: estCost,
        sourceImageUrl: savedOriginal, originalUrl:savedOriginal, maskUrl:savedMask, jobToken, review:'pending', policyVersion:'numan-fidelity-2.0',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 23, fontWeight: 800 }}>Decostone</h1>
        <div className="empty-note">
          Revestimientos fabricados por numan: la foto del cliente, revestida con la pieza que elijas.
        </div>
      </div>

      <div className="panel" style={{marginBottom:20}}><h2>Muestra real del revestimiento</h2><p className="empty-note">El catálogo de abajo es orientativo. Sube la pieza real y escribe sus medidas y acabado en las notas; así evitamos sustituirla por una textura inventada.</p>{sampleUrl && <img src={sampleUrl} alt="Muestra real del material" style={{width:140,maxHeight:140,objectFit:'contain'}}/>}<button className="btn-ghost" onClick={()=>sampleInput.current?.click()}>Subir muestra de material</button><input ref={sampleInput} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>4*1024*1024){setError('Sube una muestra de hasta 4 MB.');return;}setSampleUrl(await fileToDataUrl(f));}}/></div>
      {/* Paso 1: foto del cliente */}
      <section className="section">
        <div className="section-head">
          <div className="step-num">1</div>
          <h2>La foto del cliente</h2>
          <span className="hint">la pared o el espacio que quiere revestir</span>
        </div>
        <div className="panel">
          {photoUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ position: 'relative', alignSelf: 'flex-start', maxWidth: '100%' }}>
                <img
                  ref={imgRef} src={photoUrl} alt="Foto del cliente"
                  style={{ maxHeight: 380, borderRadius: 9, border: '1px solid var(--border)', display: 'block' }}
                />
                <canvas
                  ref={maskRef}
                  style={{
                    position: 'absolute', inset: 0, width:'100%',height:'100%',
                    cursor: drawMode ? 'crosshair' : 'default',
                    pointerEvents: drawMode ? 'auto' : 'none',
                    touchAction: drawMode ? 'none' : 'auto',
                  }}
                  onPointerDown={(e) => { painting.current = true; (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId); paint(e); }}
                  onPointerMove={paint}
                  onPointerUp={() => { painting.current = false; }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className={drawMode ? 'btn' : 'btn-ghost'}
                  onClick={() => setDrawMode(!drawMode)}
                >
                  🖌 {drawMode ? 'Dibujando la pared…' : 'Dibujar la pared a revestir'}
                </button>
                {drawMode && (
                  <>
                    <label style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      Pincel
                      <input type="range" min={12} max={80} value={brush} onChange={(e) => setBrush(Number(e.target.value))} />
                    </label>
                    <button className="btn-ghost" onClick={clearMask}>Borrar marca</button>
                  </>
                )}
                <button className="btn-ghost" onClick={() => inputRef.current?.click()}>Cambiar foto</button>
                {hasMask && <span className="status-pill status-done">Zona marcada ✓</span>}
              </div>
              {!hasMask && (
                <div className="empty-note" style={{ padding: 0 }}>
                  Marca la superficie exacta: fuera de ella se conservarán los píxeles originales.
                </div>
              )}
            </div>
          ) : (
            <div
              className={`dropzone ${drag ? 'drag' : ''}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault(); setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) loadPhoto(f);
              }}
            >
              <div className="dz-icon">📷</div>
              <div><strong>Arrastra la foto aquí</strong> o haz clic para buscarla</div>
            </div>
          )}
          <input
            ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadPhoto(f); e.target.value = ''; }}
          />
        </div>
      </section>

      {/* Paso 2: pieza, color y acabado */}
      <section className="section">
        <div className="section-head">
          <div className="step-num">2</div>
          <h2>Pieza, color y acabado</h2>
          <span className="hint">catálogo Decostone</span>
        </div>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label>Pieza</label>
            <div className="deco-pieces">
              {DECO_PIECES.map((p) => (
                <button
                  key={p.id}
                  className={`deco-piece ${pieceId === p.id ? 'on' : ''}`}
                  onClick={() => setPieceId(p.id)}
                >
                  <img src={pieceThumb(p, color.hex)} alt={p.name} />
                  <span className="dp-name">{p.name}</span>
                  <span className="dp-desc">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Color</label>
            <div className="chips">
              {DECO_COLORS.map((c) => (
                <button
                  key={c.id}
                  className={`chip deco-color ${colorId === c.id ? 'on' : ''}`}
                  onClick={() => setColorId(c.id)}
                >
                  <span className="swatch" style={{ background: c.hex }} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Acabado</label>
              <div className="chips">
                {DECO_FINISHES.map((f) => (
                  <button key={f.id} className={`chip ${finishId === f.id ? 'on' : ''}`} onClick={() => setFinishId(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="field">
            <label>Notas adicionales (opcional)</label>
            <textarea
              value={extra} onChange={(e) => setExtra(e.target.value)}
              placeholder="Ej.: la pieza va hasta media pared; dejar el zócalo blanco…"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button className="btn" onClick={generate} disabled={submitting || !photoUrl || !hasMask || !sampleUrl}>
              {submitting ? 'Encolando…' : `Revestir con ${piece.name}`}
            </button>
            <span className="empty-note">
              Costo {demo ? 'que tendría en real' : 'estimado'}: <strong>{usd(estCost)}</strong>
            </span>
            {!photoUrl && <span className="empty-note">⚠ Sube la foto primero</span>}
          </div>
          {error && <div className="error-note">{error}</div>}
        </div>
      </section>

      {/* Paso 3: resultados */}
      <section className="section">
        <div className="section-head">
          <div className="step-num">3</div>
          <h2>Paredes revestidas</h2>
          <span className="hint">listas para enviar al cliente</span>
        </div>
        {project.generations.length === 0 ? (
          <div className="empty-note">Aún no hay trabajos Decostone. Sube una foto y elige la pieza.</div>
        ) : (
          <div className="grid">
            {project.generations.map((g) => (
              <GenerationCard key={g.id} gen={g} onOpen={onOpen} onReview={onReview} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
