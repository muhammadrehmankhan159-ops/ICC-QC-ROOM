export type Status='RUNNING'|'HOLD'|'STOPPED';
export const META:Record<Status,{dot:string;color:string;label:string;sub:string}>={
 RUNNING:{dot:'🟢',color:'#16a34a',label:'RUNNING',sub:'QC MONITORING'},
 HOLD:{dot:'🟡',color:'#d97706',label:'HOLD',sub:'INSPECTION PENDING'},
 STOPPED:{dot:'🔴',color:'#dc2626',label:'STOPPED',sub:'QC ATTENTION'}};
export const summarize=(list:(Status|null|undefined)[])=>{const c={RUNNING:0,HOLD:0,STOPPED:0};for(const s of list)if(s&&s in c)c[s]++;return c};
const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const fmtDay=(d:Date)=>`${String(d.getDate()).padStart(2,'0')} ${M[d.getMonth()]} ${d.getFullYear()}`;
export const fmtTime=(d:Date)=>{let h=d.getHours();const ap=h>=12?'PM':'AM';h=h%12||12;return `${String(h).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${ap}`};
export const fmtStamp=(iso?:string|null)=>iso?`${fmtDay(new Date(iso))} • ${fmtTime(new Date(iso))}`:'Not Available';
export const attentionLabel=(s:Status|null)=>s==='STOPPED'?'🔴 Machine Stopped':s==='HOLD'?'🟡 QC Hold — Inspection Pending':'';
export const needsAttention=(s:Status|null)=>s==='STOPPED'||s==='HOLD';
export const byStructure=<T extends {process:{name:string;sort?:number}|null;name:string}>(a:T[])=>[...a].sort((x,y)=>(x.process?.sort??0)-(y.process?.sort??0)||x.name.localeCompare(y.name,undefined,{numeric:true}));
