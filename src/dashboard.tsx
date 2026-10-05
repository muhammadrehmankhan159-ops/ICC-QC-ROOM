import {useCallback,useEffect,useMemo,useState,FormEvent} from 'react';import {Link,useParams} from 'react-router-dom';
import {sb,useAuth} from './lib';import {isQcStaff} from './access';import {META,Status,summarize,attentionLabel,needsAttention,byStructure,fmtDay,fmtTime,fmtStamp} from './monitor';
type Upd={remark:string;created_at:string;poster:{full_name:string}|null};
export type M={id:string;name:string;department:{name:string;code:string};process:{name:string;sort:number}|null;current:any};
type U={id:string;machine_id:string;status:Status;remark:string;created_at:string;machine:{name:string;process:{name:string}|null}|null;poster:{full_name:string}|null};
export const cur=(m:M)=>(Array.isArray(m.current)?m.current[0]:m.current)||null;export const st=(m:M):Status|null=>cur(m)?.status??null;
export const last=(m:M):Upd|null=>{const u=cur(m)?.update;return (Array.isArray(u)?u[0]:u)||null};
export const DEPTS=[{code:'PLASTIC',name:'PLASTIC'},{code:'CROWN',name:'CROWN'},{code:'INJECTION_MOULDING',name:'INJECTION MOULDING'}];
const NA='Not Available';
export function useDashboard(){const [machines,setMachines]=useState<M[]>([]);const [updates,setUpdates]=useState<U[]>([]);const [err,setErr]=useState('');const [loaded,setLoaded]=useState(false);
 const load=useCallback(async()=>{
  const a=await sb.from('machines').select('id,name,department:departments(name,code),process:processes(name,sort),current:machine_current_status(status,updated_at,customer_id,product,batch,customer:customers(name),update:qc_updates!update_id(remark,created_at,poster:profiles!posted_by(full_name)))').eq('active',true);
  const b=await sb.from('qc_updates').select('id,machine_id,status,remark,created_at,machine:machines(name,process:processes(name)),poster:profiles!posted_by(full_name)').order('created_at',{ascending:false}).limit(50);
  if(a.error||b.error)setErr((a.error||b.error)!.message);else{setErr('');setMachines(byStructure(a.data as any));setUpdates(b.data as any)}setLoaded(true)},[]);
 useEffect(()=>{load();const t=setInterval(load,30000);
  const ch=sb.channel('qc-live').on('postgres_changes',{event:'*',schema:'public',table:'qc_updates'},load).on('postgres_changes',{event:'*',schema:'public',table:'machine_current_status'},load).subscribe();
  return()=>{clearInterval(t);sb.removeChannel(ch)}},[load]);
 return {machines,updates,err,loaded,reload:load}}
function Clock(){const [n,setN]=useState(new Date());useEffect(()=>{const t=setInterval(()=>setN(new Date()),1000);return()=>clearInterval(t)},[]);return <span className="clock">{fmtDay(n)} {fmtTime(n)}</span>}
const Count=({s,n}:{s:Status;n:number})=><span className="cnt" style={{color:META[s].color}}>{META[s].dot} {n} {META[s].label}</span>;

export function MachineModal({m,onClose}:{m:M;onClose:()=>void}){const s=st(m);const u=last(m);
 const R=({k,v}:{k:string;v:any})=><tr><th>{k}</th><td>{v||NA}</td></tr>;
 return <div className="modal" onClick={onClose}><div className="card box" onClick={e=>e.stopPropagation()}><button className="x" onClick={onClose}>✕</button><h2>{m.name}</h2>
 <table><tbody><R k="Department" v={m.department.name}/><R k="Process / Section" v={m.process?.name}/><R k="Machine" v={m.name}/><R k="Current Status" v={s?`${META[s].dot} ${META[s].label} · ${META[s].sub}`:null}/>
 <R k="Current Customer" v={cur(m)?.customer?.name}/><R k="Current Product / Material" v={cur(m)?.product}/><R k="Current Batch" v={cur(m)?.batch}/>
 <R k="Latest QC Update" v={u?`${u.remark} — ${u.poster?.full_name||'—'}, ${fmtStamp(u.created_at)}`:null}/><R k="QC Inspection Status" v={null}/><R k="Last Updated" v={cur(m)?fmtStamp(cur(m).updated_at):null}/><R k="Posted By" v={u?.poster?.full_name}/></tbody></table></div></div>}

const DIRECT='__direct';
function AddUpdate({machines,onDone}:{machines:M[];onDone:()=>void}){const [d,setD]=useState('');const [p,setP]=useState('');const [mid,setMid]=useState('');const [s,setS]=useState<Status|''>('');const [r,setR]=useState('');const [err,setErr]=useState('');const [busy,setBusy]=useState(false);
 const [cid,setCid]=useState('');const [prod,setProd]=useState('');const [batch,setBatch]=useState('');const [custs,setCusts]=useState<{id:string;name:string}[]>([]);
 useEffect(()=>{if(!d){setCusts([]);return}sb.from('customer_department_access').select('customers(id,name,active),departments!inner(code)').eq('departments.code',d).eq('active',true).then(x=>setCusts(((x.data||[]) as any[]).map(a=>a.customers).filter((c:any)=>c&&c.active)))},[d]);
 const inDept=machines.filter(m=>m.department.code===d);const procs=[...new Set(inDept.map(m=>m.process?.name??DIRECT))];const list=inDept.filter(m=>(m.process?.name??DIRECT)===p);
 const pick=(v:string)=>{setD(v);const ps=[...new Set(machines.filter(m=>m.department.code===v).map(m=>m.process?.name??DIRECT))];setP(ps.length===1?ps[0]:'');setMid('');setCid('')};
 const pickM=(id:string)=>{setMid(id);const m=machines.find(x=>x.id===id);const c=m?cur(m):null;setCid(c?.customer_id||'');setProd(c?.product||'');setBatch(c?.batch||'')};
 const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setErr('');const {error}=await sb.from('qc_updates').insert({machine_id:mid,status:s,remark:r.trim(),customer_id:cid||null,product:prod.trim()||null,batch:batch.trim()||null});setBusy(false);if(error)setErr(error.message);else onDone()};
 return <form onSubmit={submit} className="addf"><select required value={d} onChange={e=>pick(e.target.value)}><option value="">Department</option>{DEPTS.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select>
 <select required value={p} disabled={!d} onChange={e=>{setP(e.target.value);setMid('')}}><option value="">Process / Section</option>{procs.map(x=><option key={x} value={x}>{x===DIRECT?'Machines (direct)':x}</option>)}</select>
 <select required value={mid} disabled={!p} onChange={e=>pickM(e.target.value)}><option value="">Machine</option>{list.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
 <select required value={s} onChange={e=>setS(e.target.value as Status)}><option value="">Status</option>{(Object.keys(META) as Status[]).map(x=><option key={x} value={x}>{META[x].dot} {META[x].label}</option>)}</select>
 <input required placeholder="Update / Remark" value={r} onChange={e=>setR(e.target.value)}/>
 <small className="mut">Current job (optional — shown on machine cards)</small>
 <select value={cid} disabled={!d} onChange={e=>setCid(e.target.value)}><option value="">Customer — none</option>{custs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
 <input placeholder="Product / Material" value={prod} onChange={e=>setProd(e.target.value)}/><input placeholder="Batch / Lot No." value={batch} onChange={e=>setBatch(e.target.value)}/>
 <p className="mut" style={{margin:'4px 0'}}>Date, time and posted-by are recorded automatically.</p>
 <button disabled={busy||!mid||!s||!r.trim()}>{busy?'Posting…':'Post update'}</button>{err&&<p className="err">{err}</p>}</form>}

const RC=['INSPECTION_PENDING','HOLD','RE_TEST','APPROVED'] as const;
function useReportCounts(){const [c,setC]=useState<Record<string,number>>({INSPECTION_PENDING:0,HOLD:0,RE_TEST:0,APPROVED:0});
 useEffect(()=>{const l=async()=>{const o:Record<string,number>={};for(const s of RC){const r=await sb.from('inspections').select('id',{count:'exact',head:true}).eq('status',s);o[s]=r.count||0}setC(o)};l();const t=setInterval(l,30000);return()=>clearInterval(t)},[]);return c}
export function Dashboard(){const {profile}=useAuth();const rc=useReportCounts();const {machines,updates,err,loaded,reload}=useDashboard();const [sel,setSel]=useState<string|null>(null);const [adding,setAdding]=useState(false);const [tab,setTab]=useState('ALL');
 const tot=useMemo(()=>summarize(machines.map(st)),[machines]);const attn=machines.filter(m=>needsAttention(st(m)));const selM=machines.find(m=>m.id===sel)||null;const anyStatus=machines.some(m=>st(m));
 const Counts=()=><><Count s="RUNNING" n={tot.RUNNING}/><Count s="HOLD" n={tot.HOLD}/><Count s="STOPPED" n={tot.STOPPED}/></>;
 return <div className="cr">
 <header className="hdr card"><div><h1>🧪 QC CONTROL ROOM</h1><span className="mut">Imran Crown Cork</span></div><div className="hr"><div className="hc"><Counts/></div><Clock/></div></header>
 <section className="pulse card"><b>FACTORY PULSE</b><div className="hc"><Counts/></div></section>
 {err&&<p className="err" style={{gridArea:'pulse'}}>{err}</p>}
 <section className="monitor card"><h3>🔎 LIVE QC MONITOR</h3><p className="mut" style={{marginTop:-6}}>QC observation panel — status shows what QC is monitoring, not production quality.</p>
  <div className="big">{(['RUNNING','STOPPED','HOLD'] as Status[]).map(s=><div key={s} style={{borderColor:META[s].color}}><span style={{color:META[s].color}}>{META[s].dot} {META[s].label}</span><b>{tot[s]}</b></div>)}</div>
  <div className="tabs">{[{code:'ALL',name:'ALL'},...DEPTS].map(t=><button key={t.code} className={tab===t.code?'on':''} onClick={()=>setTab(t.code)}>{t.name}</button>)}</div>
  {!loaded?<p className="mut">Loading…</p>:machines.length===0?<p className="mut">No machine status available</p>:<>{!anyStatus&&<p className="mut">No machine status available</p>}
  {DEPTS.filter(d=>tab==='ALL'||tab===d.code).map(d=><div key={d.code}><h4 className="dh">{d.name}</h4><div className="mgrid">{machines.filter(m=>m.department.code===d.code).map(m=>{const s=st(m);return <button key={m.id} className={`mb ${s||'NONE'}`} style={s?{borderLeftColor:META[s].color}:undefined} onClick={()=>setSel(m.id)}><small>{m.process?.name||'MACHINE'}</small><span>{s?META[s].dot:'⚪'} {m.name}</span><b style={s?{color:META[s].color}:undefined}>{s?META[s].label:'NO CURRENT STATUS'}</b><small>{s?META[s].sub:'—'}</small></button>})}</div></div>)}</>}</section>
 <section className="updates card"><h3>📰 LATEST QC UPDATES {isQcStaff(profile?.role)&&<button className="add" onClick={()=>setAdding(!adding)}>{adding?'× CLOSE':'+ ADD UPDATE'}</button>}</h3>
  {adding&&<AddUpdate machines={machines} onDone={()=>{setAdding(false);reload()}}/>}
  {loaded&&updates.length===0?<p className="mut">No live QC updates yet</p>:updates.map(u=>{const d=new Date(u.created_at);return <article key={u.id} className="feed" style={{borderLeftColor:META[u.status].color}}><b>{META[u.status].dot} {u.machine?.name}{u.machine?.process?` · ${u.machine.process.name}`:''} — {u.status}</b><p>{u.remark}</p><small className="mut">{fmtDay(d)} • {fmtTime(d)} • {u.poster?.full_name||'—'}</small></article>})}</section>
 <section className="attention card"><h3>⚠️ QC ATTENTION</h3>{attn.length===0&&!rc.INSPECTION_PENDING&&!rc.RE_TEST?(
  <p className="mut">No items requiring QC attention</p>
):(
  <>
   {rc.INSPECTION_PENDING>0&&<Link to="/app/reports?status=INSPECTION_PENDING" className="att"><b>🟡 Inspection Pending — {rc.INSPECTION_PENDING}</b></Link>}
   {rc.RE_TEST>0&&<Link to="/app/reports?status=RE_TEST" className="att"><b>🔴 Re-test Required — {rc.RE_TEST}</b></Link>}
   {attn.map(m=>{const u=last(m);return <button key={m.id} className="att" onClick={()=>setSel(m.id)}><b>{attentionLabel(st(m))} — {m.name}</b><small>{m.department.name}{m.process?` · ${m.process.name}`:''}{u?` · ${u.remark} · ${fmtStamp(u.created_at)}`:''}</small></button>})}
  </>
 )}<h4 className="dh">QC REPORTS</h4><div className="rc">{RC.map(s=><Link key={s} to={`/app/reports?status=${s}`}><b>{rc[s]}</b><span>{s==='RE_TEST'?'RE-TEST':s.replace('_',' ')}</span></Link>)}</div></section>
 <section className="depts">{DEPTS.map(d=>{const c=summarize(machines.filter(m=>m.department.code===d.code).map(st));return <Link key={d.code} to={`/app/department/${d.code}`} className="card dept"><h3>{d.name}</h3><div>🟢 Running: <b>{c.RUNNING}</b></div><div>🟡 Hold: <b>{c.HOLD}</b></div><div>🔴 Attention: <b>{c.STOPPED}</b></div><span className="more">VIEW QC STATUS →</span></Link>})}</section>
 {selM&&<MachineModal m={selM} onClose={()=>setSel(null)}/>}</div>}
