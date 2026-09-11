'use client';
import { useRef, useState } from 'react';
import type { Project } from '@/lib/types';
import { downloadFile } from '@/lib/media';
import { parseBackup } from '@/lib/backup';
export default function ProjectTools({ projects, onRestore }: { projects: Project[]; onRestore: (p:Project[])=>void }) {
  const ref = useRef<HTMLInputElement>(null); const [message,setMessage] = useState('');
  return <div className="backup-tools"><button className="btn-new-proj" onClick={() => downloadFile(new Blob([JSON.stringify({version:2, exportedAt:new Date().toISOString(),projects})],{type:'application/json'}),'numan-respaldo.json')}>Descargar respaldo</button><button className="btn-new-proj" onClick={()=>ref.current?.click()}>Importar respaldo</button>
  <input type="file" ref={ref} accept="application/json,.json" hidden onChange={async e=> { const f=e.target.files?.[0]; e.target.value=''; if(!f)return; try { if(f.size>150*1024*1024)throw new Error('El respaldo supera 150 MB.'); const incoming=parseBackup(await f.text()); const additions=incoming.filter(p=>!projects.some(old=>old.id===p.id)); onRestore(additions); setMessage(`${additions.length} proyectos importados; los existentes se conservaron.`); } catch(err) {setMessage((err as Error).message);} }} />
  <small>Guardado en este navegador. El respaldo incluye enlaces: descarga también tus renders y videos.</small>{message && <small role="status">{message}</small>}</div>;
}
