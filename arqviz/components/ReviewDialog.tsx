'use client';
import { useEffect, useState } from 'react';
import type { Generation } from '@/lib/types';
import { downloadFile, presentationVideo } from '@/lib/media';
import { isDemoGen } from '@/lib/demo';
const checks = ['Muros, puertas y ventanas conservados', 'Mobiliario y proporciones conservados', 'Cámara y encuadre revisados', 'Materiales y zonas editadas revisados'];
export default function ReviewDialog({ gen, onSave, onClose }: { gen: Generation; onSave: (patch: Partial<Generation>) => void; onClose: () => void }) {
  const [split, setSplit] = useState(50); const [done, setDone] = useState<boolean[]>(checks.map(() => false));
  const [notes, setNotes] = useState(gen.reviewNotes || ''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const source = gen.originalUrl || gen.sourceImageUrl; const result = gen.resultUrls?.[0];
  useEffect(() => { const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle); }, [onClose]);
  async function video() { if (!result) return; setBusy(true); setError(''); try { await presentationVideo(result); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <div className="modal-back"><div className="modal review-modal" role="dialog" aria-modal="true" aria-label="Revisar fidelidad">
    <div className="review-title"><div><small>CONTROL DEL ARQUITECTO</small><h3>{gen.label}</h3></div><button className="btn-ghost" onClick={onClose} autoFocus>Cerrar</button></div>
    {gen.kind === 'image' && result ? <><div className="comparison">
      <img src={result} alt="Resultado generado" />
      {source && <img className="comparison-source" src={source} alt="Referencia original" style={{ clipPath: `inset(0 ${100-split}% 0 0)` }} />}
      <span className="comparison-label left">Original</span><span className="comparison-label right">Resultado</span>
    </div>{source && <label className="compare-control">Comparar original y resultado<input type="range" min="0" max="100" value={split} onChange={e => setSplit(Number(e.target.value))} /></label>}</> : result && <video src={result} controls className="review-video" />}
    <p className="empty-note">{gen.conceptual ? 'Propuesta conceptual desde un plano. La revisión no la convierte en una reconstrucción dimensional.' : 'Revisa las diferencias antes de aprobar. La IA puede modificar detalles incluso con instrucciones estrictas.'}</p>
    {gen.maskedComposite && <p className="empty-note">Los píxeles fuera de la selección proceden del original. Revisa el contorno y el revestimiento dentro de la zona.</p>}
    <div className="review-checks">{checks.map((label, i) => <label key={label}><input type="checkbox" checked={done[i]} onChange={e => setDone(done.map((v,j) => j === i ? e.target.checked : v))} />{label}</label>)}</div>
    <label className="field">Observaciones<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Indica cualquier diferencia que deba corregirse." /></label>
    {error && <p className="error-note" role="alert">{error}</p>}
    <div className="modal-actions">
      {gen.kind === 'image' && !gen.pano && gen.review === 'approved' && <button className="btn-ghost" disabled={busy} onClick={video}>{busy ? 'Exportando 5 segundos…' : 'Video fijo sin IA · gratis'}</button>}
      <button className="btn-ghost" onClick={() => downloadFile(new Blob([JSON.stringify(gen,null,2)],{type:'application/json'}),'numan-ficha-render.json')}>Ficha del resultado</button>
      <button className="btn-ghost" onClick={() => { onSave({ review:'rejected', reviewNotes:notes, reviewedAt:Date.now() }); onClose(); }}>Rechazar</button>
      <button className="btn" disabled={!done.every(Boolean) || isDemoGen(gen.id)} onClick={() => { onSave({ review:'approved', reviewNotes:notes, reviewedAt:Date.now() }); onClose(); }}>Aprobar para entregar</button>
    </div>{isDemoGen(gen.id) && <p className="empty-note">Las muestras demo no se pueden aprobar ni entregar al cliente.</p>}
  </div></div>;
}
