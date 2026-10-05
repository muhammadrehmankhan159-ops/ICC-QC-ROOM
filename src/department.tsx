import {useCallback,useEffect,useState,FormEvent} from 'react';import {Link,useParams} from 'react-router-dom';
import {sb,useAuth} from './lib';import {META,fmtStamp,summarize} from './monitor';import {useDashboard,MachineModal,DEPTS,st,cur,last,M} from './dashboard';import {FLOWS,deptSummary} from './structure';
type Proc={id:string;name:string;sort:number;department_id:string};type Dep={id:string;code:string;name:string};

function MachineCard({m,onOpen}:{m:M;onOpen:()=>void}){const s=st(m);const c=cur(m);const u=last(m);
 return <button className={`mc ${s||'NONE'}`} style={s?{borderLeftColor:META[s].color}:undefined} onClick={onOpen}><b>{m.name}</b>
 <span style={s?{color:META[s].color,fontWeight:700}:{color:'#64748b'}}>{s?`${META[s].dot} ${META[s].label} · ${META[s].sub}`:'No current status'}</span>
 <small>Customer: {c?.customer?.name||'—'}</small><small>Product/Material: {c?.product||'—'}</small><small>Batch: {c?.batch||'—'}</small>
 <small>Latest QC Update: {u?u.remark:'No update available'}</small><small>Last Updated: {c?fmtStamp(c.updated_at):'—'}</small></button>}

export function MachineForm({deptCode,procName,onDone,title}:{deptCode?:string;procName?:string|null;onDone:()=>void;title?:string}){
 const [deps,setDeps]=useState<Dep[]>([]);const [procs,setProcs]=useState<(Proc&{dept:string})[]>([]);const [name,setName]=useState('');const [dc,setDc]=useState(deptCode||'');const [pid,setPid]=useState('');const [active,setActive]=useState(true);const [err,setErr]=useState('');const [ok,setOk]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{sb.from('departments').select('id,code,name').eq('active',true).then(r=>setDeps((r.data||[]) as Dep[]));sb.from('processes').select('id,name,sort,department_id').eq('active',true).order('sort').then(r=>setProcs((r.data||[]) as any))},[]);
 const dep=deps.find(d=>d.code===dc);const opts=procs.filter(p=>p.department_id===dep?.id);
 useEffect(()=>{if(procName){const p=opts.find(x=>x.name===procName);if(p)setPid(p.id)}else if(opts.length===1)setPid(opts[0].id);else if(!opts.some(o=>o.id===pid))setPid('')},[dc,deps,procs,procName]);
 const submit=async(e:FormEvent)=>{e.preventDefault();setErr('');setOk('');if(!name.trim())return setErr('Machine name is required');if(opts.length&&!pid)return setErr('Select a process / section');
  setBusy(true);const {error}=await sb.from('machines').insert({department_id:dep!.id,process_id:opts.length?pid:null,name:name.trim(),active});setBusy(false);
  if(error)setErr(error.code==='23505'?'A machine with this name already exists in this department / process.':error.message);else{setOk(`Added ${name.trim()}`);setName('');onDone()}};
 return <form onSubmit={submit} className="addf card"><b>{title||'+ ADD MACHINE'}</b>
 <input required placeholder="Machine name" value={name} onChange={e=>setName(e.target.value)}/>
 <select required value={dc} disabled={!!deptCode} onChange={e=>setDc(e.target.value)}><option value="">Department</option>{deps.map(d=><option key={d.id} value={d.code}>{d.name}</option>)}</select>
 {opts.length>0?<select required value={pid} disabled={!!procName} onChange={e=>setPid(e.target.value)}><option value="">Process / Section</option>{opts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>:dc&&<small className="mut">This department has machines directly (no process / section).</small>}
 <label><input type="checkbox" style={{width:'auto'}} checked={active} onChange={e=>setActive(e.target.checked)}/> Active</label><button disabled={busy}>{busy?'Adding…':'Add machine'}</button>{err&&<p className="err">{err}</p>}{ok&&<p className="mut">{ok}</p>}</form>}

export function DepartmentPage(){const {code}=useParams();const d=DEPTS.find(x=>x.code===code);const {profile}=useAuth();const {machines,err,loaded,reload}=useDashboard();
 const [procs,setProcs]=useState<Proc[]>([]);const [sel,setSel]=useState<string|null>(null);const [adding,setAdding]=useState<string|null>(null);
 const loadP=useCallback(()=>{sb.from('processes').select('id,name,sort,department_id,departments!inner(code)').eq('departments.code',code!).eq('active',true).order('sort').then(r=>setProcs((r.data||[]) as any))},[code]);
 useEffect(()=>{loadP()},[loadP]);
 if(!d)return <div className="card"><h2>Department not found</h2><Link to="/app/dashboard">← QC Control Room</Link></div>;
 const ms=machines.filter(m=>m.department.code===code);const sum=deptSummary(ms.map(st));const admin=profile?.role==='admin';const selM=machines.find(m=>m.id===sel)||null;
 const groups=procs.length?procs.map(p=>p.name):[''];const flow=FLOWS[code!]||[];const isTpr=(g:string)=>g==='TPR';
 return <div><div className="card hdr"><div><h1 style={{margin:0}}>{d.name}</h1><span className="mut">QC monitoring — department</span></div><Link to="/app/dashboard" style={{color:'#cbd5e1'}}>← QC Control Room</Link></div>
 {flow.length>0&&<div className="card flow">{flow.map((f,i)=><span key={f}><b>{f}</b>{i<flow.length-1&&' → '}</span>)}</div>}
 <div className="big sum"><div style={{borderColor:META.RUNNING.color}}><span>🟢 RUNNING</span><b>{sum.RUNNING}</b></div><div style={{borderColor:META.HOLD.color}}><span>🟡 HOLD</span><b>{sum.HOLD}</b></div><div style={{borderColor:META.STOPPED.color}}><span>🔴 STOPPED</span><b>{sum.STOPPED}</b></div><div><span>⚠️ QC ATTENTION</span><b>{sum.attention}</b></div></div>
 {err&&<p className="err">{err}</p>}{loaded&&!sum.hasData&&<p className="mut">No current QC monitoring data</p>}
 {groups.map(g=>{const gm=ms.filter(m=>(m.process?.name??'')===g);const gs=summarize(gm.map(st));
  return <section key={g||'direct'} className="card"><h3 style={{marginTop:0}}>{g||'MACHINES'} <span className="mut" style={{fontSize:13,fontWeight:400}}>🟢 {gs.RUNNING} · 🟡 {gs.HOLD} · 🔴 {gs.STOPPED}</span>
  {admin&&<button className="add" onClick={()=>setAdding(adding===g?null:g)}>{adding===g?'× CLOSE':isTpr(g)?'+ ADD SECTION / MACHINE':'+ ADD MACHINE'}</button>}</h3>
  {adding===g&&<MachineForm deptCode={code} procName={g||null} title={isTpr(g)?'Add section / machine':'Add machine'} onDone={()=>{reload();loadP()}}/>}
  {loaded&&gm.length===0?<p className="mut">No machines in this section.</p>:<div className="mgrid wide">{gm.map(m=><MachineCard key={m.id} m={m} onOpen={()=>setSel(m.id)}/>)}</div>}</section>})}
 {selM&&<MachineModal m={selM} onClose={()=>setSel(null)}/>}</div>}

export function AdminMachines(){const [rows,setRows]=useState<any[]>([]);const [err,setErr]=useState('');
 const load=useCallback(()=>{sb.from('machines').select('id,name,active,department:departments(name),process:processes(name)').order('name').then(r=>r.error?setErr(r.error.message):setRows(r.data||[]))},[]);useEffect(()=>{load()},[load]);
 const upd=async(id:string,p:any)=>{const {error}=await sb.from('machines').update(p).eq('id',id);setErr(error?(error.code==='23505'?'A machine with this name already exists in this department / process.':error.message):'');load()};
 return <div><div className="card"><h2>Machines</h2><p className="mut">Admin only. Names are unique within a department / process. Deactivated machines disappear from the dashboard and department pages.</p>{err&&<p className="err">{err}</p>}
 <table><thead><tr><th>Machine</th><th>Department</th><th>Process / Section</th><th>Active</th></tr></thead><tbody>{rows.map(m=><tr key={m.id}><td><input style={{margin:0}} defaultValue={m.name} onBlur={e=>e.target.value.trim()&&e.target.value.trim()!==m.name&&upd(m.id,{name:e.target.value.trim()})}/></td><td>{m.department?.name}</td><td>{m.process?.name||'—'}</td><td><input type="checkbox" style={{width:'auto'}} checked={m.active} onChange={e=>upd(m.id,{active:e.target.checked})}/></td></tr>)}</tbody></table></div><MachineForm onDone={load}/></div>}
