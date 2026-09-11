'use client';
import { useRef, useState } from 'react';
import type { Project, SkpView } from '@/lib/types';
import { fileToDataUrl } from '@/lib/demo';
import { prepareUpload } from '@/lib/media';
import { uid } from '@/lib/store';
export default function MaterialSection({project,demo,onUpdate}:{project:Project;demo:boolean;onUpdate:(fn:(p:Project)=>Project)=>void}) {
 const input=useRef<HTMLInputElement>(null); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 async function upload(file:File) { setError('');setBusy(true);try { file=await prepareUpload(file,2500); let url:string;
 if(demo)url=await fileToDataUrl(file);else{const form=new FormData();form.append('file',file);const response=await fetch('/api/upload',{method:'POST',body:form});const data=await response.json();if(!response.ok)throw new Error(data.error);url=data.url;}
 const ref:SkpView={id:uid(),label:file.name,url};onUpdate(p=>({...p,materialRefs:[...(p.materialRefs||[]),ref].slice(0,6)}));
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="section"><div className="section-head"><div className="step-num">1</div><h2>Materiales del proyecto</h2><span className="hint">se aplican a todas las vistas</span></div><div className="panel">
 <label className="field">Especificaciones y superficies<textarea value={project.materials||''} maxLength={6000} onChange={e=>onUpdate(p=>({...p,materials:e.target.value}))} placeholder="Piso: porcelanato gris 60 × 120 cm. Gabinetes existentes: roble mate. Muestra 1: revestimiento de la pared del fondo. Mantener todas las demás superficies." /></label>
 <div className="material-samples">{(project.materialRefs||[]).map((v,i)=><div key={v.id}><img src={v.url} alt={v.label}/><span>Muestra {i+1}</span><button className="btn-ghost" aria-label={`Quitar muestra ${i+1}`} onClick={()=>onUpdate(p=>({...p,materialRefs:p.materialRefs?.filter(x=>x.id!==v.id)}))}>Quitar</button></div>)}</div>
 <button className="btn-ghost" disabled={busy||(project.materialRefs?.length||0)>=6} onClick={()=>input.current?.click()}>{busy?'Subiendo…':'+ Añadir muestra real de material'}</button><input ref={input} type="file" accept="image/*" hidden onChange={e=>{if(e.target.files?.[0])upload(e.target.files[0]);e.target.value='';}}/>
 <p className="empty-note">Las muestras definen texturas, nunca la distribución del espacio. Sin especificación, se conserva el acabado original o neutro.</p>{error&&<p className="error-note">{error}</p>}
 </div></section>;
}
