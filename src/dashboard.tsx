import {useCallback,useEffect,useMemo,useRef,useState,FormEvent} from 'react';import {Link,useParams} from 'react-router-dom';
import {sb,useAuth} from './lib';import {canManageLatestNews,canViewLatestNews,isQcStaff} from './access';import {META,Status,summarize,attentionLabel,needsAttention,byStructure,fmtDay,fmtTime,fmtStamp} from './monitor';

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
function LatestNews(){const {profile}=useAuth();const [items,setItems]=useState<any[]>([]);const [err,setErr]=useState('');const canView=canViewLatestNews(profile?.role);const canManage=canManageLatestNews(profile?.role);
 useEffect(()=>{if(!canView){setItems([]);return;}let active=true;const load=async()=>{try{const {data,error}=await sb.from('latest_news').select('id,title,summary,content,created_at,updated_at').order('created_at',{ascending:false}).limit(3);if(!active)return;if(error){setErr(error.message);return;}setItems(data||[]);setErr('');}catch{if(active)setErr('Latest News unavailable.');}};void load();return()=>{active=false;};},[canView,profile?.role]);
 if(!canView)return null;
 return <section className="card"><h3>📰 Latest News</h3>{err&&<p className="err">{err}</p>}{items.length===0?<p className="mut">No recent updates available.</p>:items.map(item=><div key={item.id} className="feed" style={{borderLeftColor:'#0f766e'}}><b>{item.title}</b><p>{item.summary || item.content}</p><small className="mut">{fmtStamp(item.created_at)}</small>{canManage&&<Link to="/app/admin" className="more">Manage latest news →</Link>}</div>)}</section>}
export function Dashboard(){const {profile}=useAuth();const rc=useReportCounts();const {machines,updates,err,loaded,reload}=useDashboard();const [sel,setSel]=useState<string|null>(null);const [adding,setAdding]=useState(false);const [tab,setTab]=useState('ALL');
 const tot=useMemo(()=>summarize(machines.map(st)),[machines]);const attn=machines.filter(m=>needsAttention(st(m)));const selM=machines.find(m=>m.id===sel)||null;const anyStatus=machines.some(m=>st(m));
 const Counts=()=><><Count s="RUNNING" n={tot.RUNNING}/><Count s="HOLD" n={tot.HOLD}/><Count s="STOPPED" n={tot.STOPPED}/></>;
 const factoryRows = DEPTS.filter(d=>tab==='ALL'||tab===d.code).flatMap(d => machines.filter(m=>m.department.code===d.code).map(m => ({ ...m, status: st(m) })));
 const newsItems = updates.slice(0,3).map((u)=>({
   key: u.id,
   title: `${u.machine?.name ?? 'Machine'} ${u.status}`,
   time: fmtTime(new Date(u.created_at)),
   detail: u.remark,
   color: META[u.status].color,
 }));
 return <div className="qc-dashboard">
  <header className="qc-topbar">
   <div className="qc-branding"><h1>QC CONTROL ROOM</h1><span>Imran Crown Cork Pvt Ltd</span></div>
   <div className="qc-header-stats">
    <span className="qc-status-pill stop"><span className="dot red" />3 STOPPED</span>
    <span className="qc-status-pill run"><span className="dot green" />18 RUNNING</span>
    <div className="qc-timebox"><span className="mini-grid" /><Clock/></div>
   </div>
  </header>
  <div className="qc-dashboard-grid">
   <section className="qc-panel factory-panel">
    <div className="panel-heading"><span className="panel-mark">🏭</span><h2>LIVE FACTORY</h2></div>
    <div className="summary-row"><div className="summary-card run"><span className="dot green"/> <strong>{tot.RUNNING}</strong><small>RUNNING</small></div><div className="summary-card stop"><span className="dot red"/> <strong>{tot.STOPPED}</strong><small>STOPPED</small></div><div className="summary-card hold"><span className="dot amber"/> <strong>{tot.HOLD}</strong><small>HOLD</small></div></div>
    <div className="factory-table">
      <div className="factory-row header-row"><span>Machine / Line</span><span>Status</span></div>
      {factoryRows.length === 0 ? <div className="factory-row empty">No machine status available.</div> : factoryRows.map((m)=>{const s=m.status; return <div key={m.id} className="factory-row"><span className="machine-name"><span className="machine-icon">🏭</span>{m.name}</span><span className={`status-badge ${s ? s.toLowerCase() : 'none'}`}>{s ? META[s].dot + ' ' + META[s].label : 'NO STATUS'}</span></div>})}
    </div>
   </section>
   <aside className="qc-panel news-panel">
    <div className="panel-heading"><span className="panel-mark">📰</span><h2>LATEST NEWS</h2></div>
    <div className="news-list">
      {newsItems.length === 0 ? <p className="mut">No recent updates available.</p> : newsItems.map((item)=> <div key={item.key} className="news-item"><div className="news-head"><span className="dot" style={{background:item.color}} /> <strong>{item.title}</strong><small>{item.time} • QC</small></div><p>{item.detail}</p></div>)}
      {isQcStaff(profile?.role) && <button className="add" onClick={()=>setAdding(!adding)}>{adding?'× CLOSE':'+ ADD UPDATE'}</button>}
      {adding && <AddUpdate machines={machines} onDone={()=>{setAdding(false);reload()}}/>}
    </div>
   </aside>
   <section className="qc-product-grid">
    {DEPTS.map((d)=>{const c=summarize(machines.filter(m=>m.department.code===d.code).map(st)); return <div key={d.code} className="qc-product-card">
      <div className="product-header"><span className="product-name">{d.name}</span></div>
      <div className="product-stats">
       <div className="mini-stat run"><span className="dot green" /> {c.RUNNING}<small>Running</small></div>
       <div className="mini-stat stop"><span className="dot red" /> {c.STOPPED}<small>Stopped</small></div>
      </div>
      <div className="product-visual product-visual--plastic" aria-hidden="true" />
    </div>})}
   </section>
  </div>
  {err && <p className="err" style={{marginTop:8}}>{err}</p>}
  {selM&&<MachineModal m={selM} onClose={()=>setSel(null)}/>}</div>}
