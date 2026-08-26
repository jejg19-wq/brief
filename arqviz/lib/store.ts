'use client';

import { useEffect, useState } from 'react';
import type { Project } from './types';

const KEY = 'arqviz.projects.v1';
const MARGIN_KEY = 'arqviz.margin.v1';

export function loadProjects(): Project[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(projects));
  } catch {
    // almacenamiento lleno o bloqueado: la app sigue funcionando en memoria
  }
}

/** Multiplicador de facturación (ej. 3 = cobrar 3x el costo de API) */
export function useMargin(): [number, (n: number) => void] {
  const [margin, setMargin] = useState(3);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MARGIN_KEY);
      if (raw) setMargin(Number(raw) || 3);
    } catch { /* ignorar */ }
  }, []);
  const update = (n: number) => {
    setMargin(n);
    try { window.localStorage.setItem(MARGIN_KEY, String(n)); } catch { /* ignorar */ }
  };
  return [margin, update];
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
