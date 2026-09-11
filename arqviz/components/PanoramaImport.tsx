'use client';
import { useRef,useState } from 'react';
import type {Generation} from '@/lib/types';
import {fileToDataUrl} from '@/lib/demo';
import {loadImage, prepareUpload} from '@/lib/media';
import {uid} from '@/lib/store';
export default function PanoramaImport({demo,onAddGeneration}:{demo:boolean;onAddGeneration:(g:Generation)=>void}) {
 const ref=useRef<HTMLInputElement>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function upload(file:File){setError('');setBusy(true);try{file=await prepareUpload(file,5600);const local=await fileToDataUrl(file);const img=await loadImage(local);if(Math.abs(img.naturalWidth/img.naturalHeight-2)>0.01)throw new Error('Se necesita una panorámica equirectangular 2:1 exportada desde el modelo 3D.');let url=local;if(!demo){const form=new FormData();form.append('file',file);const response=await fetch('/api/upload',{method:'POST',body:form});const data=await response.json();if(!response.ok)throw new Error(data.error);url=data.url;}onAddGeneration({id:uid(),endpoint:'import',kind:'image',label:file.name,prompt:'Panorámica importada por el arquitecto; no generada desde una sola foto.',status:'done',createdAt:Date.now(),costUsd:0,pano:true,resultUrls:[url],review:'pending'});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <details className="plan-details"><summary>Tour 360° desde una panorámica del modelo</summary><p className="empty-note">Exporta una imagen equirectangular 2:1 desde tu programa 3D. Una sola foto no documenta las paredes ocultas. El formato 2:1 se verifica; la proyección debe revisarla el arquitecto.</p><button className="btn-ghost" disabled={busy} onClick={()=>ref.current?.click()}>{busy?'Subiendo…':'Importar panorama 2:1'}</button><input ref={ref} type="file" accept="image/*" hidden onChange={e=>{if(e.target.files?.[0])upload(e.target.files[0]);e.target.value='';}}/>{error&&<p className="error-note">{error}</p>}</details>;
}
