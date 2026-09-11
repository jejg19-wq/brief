const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript'),assert=require('node:assert/strict');
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,parent,...rest){return resolve.call(this,name.startsWith('@/')?path.join(__dirname,'..',name.slice(2)):name,parent,...rest);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const {JSDOM}=require('jsdom'),{indexedDB,IDBKeyRange}=require('fake-indexeddb');
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Event','MouseEvent','FileReader'])global[key]=dom.window[key];
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});global.indexedDB=indexedDB;global.IDBKeyRange=IDBKeyRange;global.IS_REACT_ACT_ENVIRONMENT=true;
global.fetch=async()=>({ok:true,json:async()=>({demo:true,version:'2.0.0'})});
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
const Studio=require('../components/Studio.tsx').default, {loadProjects,saveProjects}=require('../lib/store.ts');
const root=createRoot(document.getElementById('root'));
const wait=()=>new Promise(r=>setTimeout(r,35));
const byText=(selector,text)=>Array.from(document.querySelectorAll(selector)).find(el=>el.textContent.includes(text));
async function click(el){assert(el);await act(async()=>{el.dispatchEvent(new MouseEvent('click',{bubbles:true}));await wait();});}
async function fill(el,value){assert(el);const setter=Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;await act(async()=>{setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));await wait();});}
(async()=>{
 const legacy={id:'existing',name:'Proyecto anterior',clientName:'Cliente',createdAt:1,generations:[]};window.localStorage.setItem('arqviz.projects.v1',JSON.stringify([legacy]));
 assert.deepEqual(await loadProjects(),[legacy]);console.log('PASS IndexedDB migrates existing projects without deleting localStorage');
 await act(async()=>{root.render(React.createElement(Studio));await wait();});await act(wait);
 assert(document.body.textContent.includes('Proyecto anterior'));assert(document.body.textContent.includes('Modo demo'));console.log('PASS Studio loads existing project and resolves demo mode');
 await fill(document.querySelector('textarea[placeholder^="Piso:"]'),'Piso: roble mate. Conservar geometría.');
 assert.equal((await loadProjects())[0].materials,'Piso: roble mate. Conservar geometría.');console.log('PASS Material specification edits persist');
 await click(byText('button','Enlace para el cliente'));assert(document.body.textContent.includes('aún no tiene resultados aprobados'));await click(byText('button','Entendido'));console.log('PASS Delivery requires approved results');
 await click(byText('button','+ Nuevo proyecto'));await fill(document.querySelector('input[placeholder="Casa Guayabal"]'),'Casa de prueba');await click(Array.from(document.querySelectorAll('button')).find(el=>el.textContent==='Crear'));
 assert.equal((await loadProjects()).length,2);assert(document.body.textContent.includes('Casa de prueba'));console.log('PASS New project form creates and persists project');
 await click(byText('button','Decostone'));assert(document.body.textContent.includes('Muestra real del revestimiento'));console.log('PASS Cladding workflow requires actual material reference');
 await act(async()=>{root.unmount();await wait();});
 console.log('6 UI/state checks passed');
})().catch(err=>{console.error(err);process.exitCode=1;root.unmount();});
