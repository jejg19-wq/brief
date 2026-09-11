'use client';

import { useEffect, useState } from 'react';
import type { Project } from './types';

const KEY = 'arqviz.projects.v1';
const MARGIN_KEY = 'arqviz.margin.v1';

function database(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    const req = indexedDB.open('numan-studio-v2',1);
    req.onupgradeneeded = () => req.result.createObjectStore('studio');
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
export async function loadProjects(): Promise<Project[]> {
  const db = await database();
  const saved = await new Promise<Project[] | undefined>((resolve,reject) => {
    const tx = db.transaction('studio','readonly'); const req = tx.objectStore('studio').get('projects');
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  }); db.close();
  if (saved) return saved;
  // Migration never deletes the existing v1 backup.
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return [];
  const old = JSON.parse(raw);
  if (!Array.isArray(old)) throw new Error('Respaldo v1 inválido');
  await saveProjects(old); return old;
}
let writes = Promise.resolve();
export function saveProjects(projects: Project[]): Promise<void> {
  const snapshot = structuredClone(projects);
  const write = writes.catch(() => {}).then(async () => {
    const db = await database();
    await new Promise<void>((resolve,reject) => {
      const tx = db.transaction('studio','readwrite'); tx.objectStore('studio').put(snapshot,'projects');
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    }).finally(() => db.close());
  }); writes = write; return write;
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
