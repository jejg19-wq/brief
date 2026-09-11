'use client';

import type { Generation } from '@/lib/types';
import { isDemoGen } from '@/lib/demo';

const usd = (n: number) => `$${n.toFixed(2)}`;

export default function GenerationCard({
  gen, onMakeVideo, onOpen, onReview,
}: {
  gen: Generation;
  onReview?: (g: Generation) => void;
  onMakeVideo?: (g: Generation) => void;
  onOpen: (url: string, kind: 'image' | 'video') => void;
}) {
  const url = gen.resultUrls?.[0];
  // Los videos demo son imágenes SVG con insignia de play
  const isStillVideo = gen.kind === 'video' && !!url && url.startsWith('data:image');
  const statusLabel: Record<string, string> = {
    queued: 'En cola', running: 'Generando…', done: gen.review === 'approved' ? 'Aprobado' : gen.review === 'rejected' ? 'Rechazado' : 'Por revisar', error: 'Error',
  };
  return (
    <div className="card">
      <div
        className="media"
        style={{ cursor: url ? 'zoom-in' : 'default' }}
        onClick={() => url && onOpen(url, gen.kind)}
      >
        {gen.status === 'done' && url ? (
          gen.kind === 'video' && !isStillVideo
            ? <video src={url} muted loop playsInline onMouseEnter={(e) => e.currentTarget.play()} onMouseLeave={(e) => e.currentTarget.pause()} />
            : <img src={url} alt={gen.label} loading="lazy" />
        ) : gen.status === 'error' ? (
          <span style={{ fontSize: 26 }}>⚠️</span>
        ) : (
          <div className="spinner" />
        )}
      </div>
      <div className="meta">
        <span className="g-label">{gen.conceptual ? 'Propuesta · ' : ''}{gen.kind === 'video' ? '🎬 ' : gen.pano ? '🌐 ' : ''}{gen.label}</span>
        <span className="g-sub">
          <span className={`status-pill status-${gen.status}`}>{statusLabel[gen.status]}</span>
          <span>{isDemoGen(gen.id) ? `${usd(gen.costUsd)} en real` : usd(gen.costUsd)}</span>
        </span>
      </div>
      {gen.status === 'done' && url && (
        <div className="actions">
          {gen.kind === 'image' && !gen.pano && gen.review === 'approved' && onMakeVideo && (
            <button className="btn-ghost" onClick={() => onMakeVideo(gen)}>🎬 Crear video</button>
          )}
          {onReview && <button className="btn-ghost" onClick={() => onReview(gen)}>Comparar y revisar</button>}
          <a className="btn-ghost" href={url} download target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
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
