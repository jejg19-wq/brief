export type GenerationStatus = 'queued' | 'running' | 'done' | 'error';

export interface Generation {
  id: string;              // request_id de fal
  endpoint: string;        // endpoint fal usado
  kind: 'image' | 'video';
  label: string;           // ej. "Sala — Moderno cálido"
  prompt: string;
  status: GenerationStatus;
  createdAt: number;
  costUsd: number;         // costo estimado registrado al encolar
  resultUrls?: string[];   // urls de imagenes o video al terminar
  pano?: boolean;          // true si es panorámica 360° (equirectangular)
  sourceImageUrl?: string; // render base (para videos) o plano (para renders)
  error?: string;
}

export interface SkpView {
  id: string;
  url: string;    // fal storage (real) o dataURL (demo)
  label: string;  // nombre del ambiente que escribe el arquitecto
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  createdAt: number;
  planUrl?: string;        // plano subido a fal storage
  skpViews?: SkpView[];    // vistas del modelo SketchUp subidas
  generations: Generation[];
}
