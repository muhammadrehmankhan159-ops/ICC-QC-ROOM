import {useEffect,useMemo,useState} from 'react';
import {Link,NavLink,Outlet,useParams} from 'react-router-dom';
import {sb,logCustomerActivity} from './lib';
import {META,Status,fmtStamp} from './monitor';
import {isoOffset,emptyReportsMessage} from './workflow';
import {StatusBadge} from './reports';
import {normalizeCustomerPin,validateCustomerPin} from './customer-pin';

type CustomerPortalIdentity = { customer_id: string; customer_name: string; customer_code: string };

const useName=()=>{const [n,setN]=useState<string|null|undefined>(undefined);useEffect(()=>{sb.rpc('my_customer_name').then(r=>setN(r.data||null))},[]);return n};

export function PortalShell(){
 const [customer,setCustomer]=useState<CustomerPortalIdentity|null>(null);
 const [pin,setPin]=useState('');
 const [busy,setBusy]=useState(false);
 const [err,setErr]=useState('');
 const name=useName();

 const handlePin=async(e:React.FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  const validation=validateCustomerPin(pin);
  if(validation){ setErr(validation); return; }
  setBusy(true); setErr('');
  try {
   const {data,error}=await sb.rpc('customer_pin_auth',{p_pin:normalizeCustomerPin(pin)});
   if(error) throw error;
   const match=(data as Array<{customer_id:string;customer_name:string;customer_code:string}> | null)?.[0];
   if(!match){ setErr('That Customer PIN is incorrect, no longer active, or is not assigned to this customer account.'); return; }
   setCustomer(match); setPin('');
   await logCustomerActivity('portal_access');
  } catch (ex:any) {
   setErr(ex?.message || 'Customer PIN validation failed.');
  } finally { setBusy(false); }
 };

 if(name===undefined)return <p>Loading…</p>;
 if(name===null)return <div className="card"><h2>Customer Portal</h2><p>Your account is not linked to a customer. Please contact the Administrator.</p></div>;
 if(!customer){
  return <div className="card" style={{maxWidth:520,margin:'32px auto'}}>
   <h2>Customer Portal</h2>
   <p className="mut">Enter your Customer PIN to access your customer dashboard.</p>
   <form onSubmit={handlePin} style={{display:'grid',gap:12}}>
    <label>Customer PIN<input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="Enter your PIN" autoComplete="off" /></label>
    <button type="submit" disabled={busy}>{busy?'Accessing…':'Access Customer Portal'}</button>
   </form>
   {err&&<p className="err">{err}</p>}
  </div>;
 }
 return <div>
  <div className="card hdr"><div><h1 style={{margin:0}}>{customer.customer_name.toUpperCase()}</h1><span className="mut">Customer ID: {customer.customer_code}</span><p className="mut" style={{margin:'8px 0 0'}}>Customer portal authenticated successfully.</p></div></div>
  <div className="tabs rtabs"><NavLink to="/app/portal" end className={({isActive})=>isActive?'on':''}>CURRENT</NavLink><NavLink to="/app/portal/reports" className={({isActive})=>isActive?'on':''}>REPORTS</NavLink></div>
  <PortalCtx customer={customer}/></div>;
}

import {createContext,useContext} from 'react';
const Ctx=createContext<CustomerPortalIdentity|null>(null);
const PortalCtx=({customer}:{customer:CustomerPortalIdentity})=><Ctx.Provider value={customer}><Outlet/></Ctx.Provider>;
const useCust=()=>useContext(Ctx) as CustomerPortalIdentity;

export function PortalCurrent(){const customer=useCust();const [rows,setRows]=useState<any[]|null>(null);const [err,setErr]=useState('');
 useEffect(()=>{sb.rpc('customer_current').then(r=>r.error?setErr(r.error.message):setRows(r.data||[]))},[]);
 if(err)return <p className="err">{err}</p>;if(!rows)return <p>Loading…</p>;
 if(rows.length===0)return <div className="card"><h2>No {customer.customer_name} production is currently running</h2><p>Your products are not currently in production at this time. Production status will be updated here when your item enters production.</p><p className="mut">Your <Link to="/app/portal/reports">REPORTS</Link> remain available.</p></div>;
 return <div>{rows.map((c,i)=>{const s=c.status as Status;return <div key={i} className="card" style={{borderLeft:`5px solid ${META[s].color}`}}><h3 style={{marginTop:0}}>{c.department} · {c.process||'Machines'} · {c.machine}</h3>
 <table><tbody><tr><th>Current QC status</th><td style={{color:META[s].color,fontWeight:700}}>{META[s].dot} {META[s].label} · {META[s].sub}</td></tr><tr><th>Product / Material</th><td>{c.product||'—'}</td></tr><tr><th>Batch</th><td>{c.batch||'—'}</td></tr><tr><th>Latest QC update</th><td>{c.remark||'No update available'}</td></tr><tr><th>Last updated</th><td>{fmtStamp(c.updated_at)}</td></tr></tbody></table></div>})}</div>}

export function PortalReports(){const customer=useCust();const [f,setF]=useState<any>({});const [rows,setRows]=useState<any[]|null>(null);const [opts,setOpts]=useState<any[]>([]);const [err,setErr]=useState('');
 useEffect(()=>{sb.rpc('customer_report_filters').then(r=>setOpts(r.data||[]))},[]);
 const run=(x=f)=>{setRows(null);sb.rpc('customer_reports',{p_from:x.from||null,p_to:x.to||null,p_report:x.rid||null,p_batch:x.batch||null,p_dept:x.dept||null,p_process:x.proc||null,p_machine:x.mach||null}).then(r=>{if(r.error)setErr(r.error.message);else{setErr('');setRows(r.data||[])}})};
 useEffect(()=>{run({})},[]);
 const apply=(p:any)=>{const n={...f,...p};setF(n);return n};
 const deps=useMemo(()=>[...new Set(opts.map(o=>o.department))],[opts]);const procs=useMemo(()=>[...new Set(opts.filter(o=>!f.dept||o.department===f.dept).map(o=>o.process).filter(Boolean))],[opts,f.dept]);
 const machs=useMemo(()=>[...new Set(opts.filter(o=>(!f.dept||o.department===f.dept)&&(!f.proc||o.process===f.proc)).map(o=>o.machine))],[opts,f.dept,f.proc]);
 const day=(o:number)=>{const d=isoOffset(o);run(apply({from:d,to:d}))};const filtered=Object.values(f).some(Boolean);
 return <div><div className="card filt"><div><button onClick={()=>day(0)}>Today</button> <button onClick={()=>day(1)}>Yesterday</button></div>
 <label>From<input type="date" value={f.from||''} onChange={e=>apply({from:e.target.value})}/></label><label>To<input type="date" value={f.to||''} onChange={e=>apply({to:e.target.value})}/></label>
 <input placeholder="Report ID" value={f.rid||''} onChange={e=>apply({rid:e.target.value})}/><input placeholder="Batch / Lot No." value={f.batch||''} onChange={e=>apply({batch:e.target.value})}/>
 <select value={f.dept||''} onChange={e=>apply({dept:e.target.value,proc:'',mach:''})}><option value="">Department</option>{deps.map(d=><option key={d}>{d}</option>)}</select>
 <select value={f.proc||''} onChange={e=>apply({proc:e.target.value,mach:''})}><option value="">Process / Section</option>{procs.map(p=><option key={p}>{p}</option>)}</select>
 <select value={f.mach||''} onChange={e=>apply({mach:e.target.value})}><option value="">Machine</option>{machs.map(m=><option key={m}>{m}</option>)}</select>
 <div><button onClick={()=>run()}>Search</button> <button className="alt" onClick={()=>{setF({});run({})}}>Clear</button></div></div>
 {err&&<p className="err">{err}</p>}{!rows?<p>Loading…</p>:rows.length===0?<p className="mut">{emptyReportsMessage(customer.customer_name,f.from||'',f.to||'',filtered)}</p>:
 <div className="card"><table><thead><tr><th>Report ID</th><th>Date</th><th>Department</th><th>Process</th><th>Machine</th><th>Product</th><th>Batch</th><th>QC Status</th></tr></thead><tbody>{rows.map(r=><tr key={r.report_id}><td><Link to={`/app/portal/report/${r.report_id}`}>{r.report_id}</Link></td><td>{r.inspection_date}</td><td>{r.department}</td><td>{r.process||'—'}</td><td>{r.machine}</td><td>{r.product}</td><td>{r.batch}</td><td><StatusBadge s={r.status}/></td></tr>)}</tbody></table></div>}</div>}

export function PortalReport(){const {rid}=useParams();const [r,setR]=useState<any>(undefined);
 useEffect(()=>{sb.rpc('customer_report_detail',{p_report:rid}).then(x=>setR(x.data?.[0]||null))},[rid]);
 if(r===undefined)return <p>Loading…</p>;if(r===null)return <div className="card"><h2>Access denied</h2><p>This report was not found in your account.</p><Link to="/app/portal/reports">← Reports</Link></div>;
 const row=(k:string,v:any)=><tr><th>{k}</th><td>{v||'—'}</td></tr>;
 return <div><div className="card"><Link to="/app/portal/reports">← Reports</Link><h2 style={{margin:'6px 0'}}>REPORT ID: {r.report_id} <StatusBadge s={r.status}/></h2><table><tbody>{row('Customer',r.customer)}{row('Department',r.department)}{row('Process / Section',r.process)}{row('Machine',r.machine)}{row('Product / Material',r.product)}{row('Batch / Lot No.',r.batch)}{row('Inspection Date',r.inspection_date)}{row('Inspection Time',String(r.inspection_time).slice(0,5))}</tbody></table></div>
 <div className="card"><h3 style={{marginTop:0}}>QC INSPECTION PARAMETERS</h3><p className="mut">QC parameters will be configured after the original QC report sheets are provided.</p></div></div>}

