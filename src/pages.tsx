import {useEffect,useState,FormEvent} from 'react';import {Navigate,NavLink,Outlet,Link,useParams} from 'react-router-dom';
import {sb,useAuth} from './lib';import {ROLE_LABEL,isQcStaff,Role} from './access';import {AdminMachines} from './department';
export function Login(){const {session,profile}=useAuth();const [e,setE]=useState('');const [p,setP]=useState('');const [err,setErr]=useState('');const [busy,setBusy]=useState(false);
 if(session&&profile?.active)return <Navigate to="/app" replace/>;
 const go=async(ev:FormEvent)=>{ev.preventDefault();setBusy(true);setErr('');const {error}=await sb.auth.signInWithPassword({email:e.trim(),password:p});setBusy(false);if(error)setErr(error.message);else sb.rpc('log_login')};
 return <form onSubmit={go} className="card login"><h2 style={{margin:0}}>QC MANAGEMENT & CUSTOMER PORTAL</h2><p className="mut">Imran Crown Crok Pvt Ltd</p>
 <label>Email<input type="email" required autoComplete="username" value={e} onChange={x=>setE(x.target.value)}/></label><label>Password<input type="password" required autoComplete="current-password" value={p} onChange={x=>setP(x.target.value)}/></label>
 <button disabled={busy} style={{width:'100%'}}>{busy?'Signing in…':'Sign in'}</button>{err&&<p className="err">{err}</p>}</form>}
export function Inactive(){return <div className="card login"><h3>Account not active</h3><p>Your account has not been activated. Please contact the Administrator.</p><button onClick={()=>sb.auth.signOut()}>Sign out</button></div>}
export function Denied(){return <div className="card"><h2>Access denied</h2><p>You do not have permission to view this page.</p><Link to="/app">Go back</Link></div>}
export function Layout(){const {profile}=useAuth();const r=profile!.role as Role;
 return <div className="shell"><aside className="side"><b>QC MANAGEMENT & CUSTOMER PORTAL</b><small>Imran Crown Crok Pvt Ltd</small>
 {isQcStaff(r)&&<NavLink to="/app/dashboard">QC Control Room</NavLink>}{isQcStaff(r)&&<NavLink to="/app/reports">QC Reports</NavLink>}{r==='customer'&&<><NavLink to="/app/portal" end>Current</NavLink><NavLink to="/app/portal/reports">Reports</NavLink></>}
 {r==='admin'&&<><NavLink to="/app/admin" end>Admin</NavLink>{['departments','machines','customers','users','roles','customer-access'].map(s=><NavLink key={s} className="sub" to={`/app/admin/${s}`}>{s.replace('-',' ')}</NavLink>)}</>}
 <div style={{marginTop:'auto'}}><small>{profile!.full_name}<br/><span className="pill">{ROLE_LABEL[r]}</span></small><br/><button onClick={()=>sb.auth.signOut()}>Logout</button></div></aside><main><Outlet/></main></div>}
export const AdminHome=()=><div className="card"><h2>Admin</h2><p className="mut">Phase 1 foundation: read-only views of the configuration. Management screens come in later phases.</p></div>;
const Q:Record<string,{t:string;sel:string;cols:string[]}>={
 departments:{t:'departments',sel:'name,code,active',cols:['name','code','active']},
 customers:{t:'customers',sel:'name,code,active',cols:['name','code','active']},
 users:{t:'profiles',sel:'full_name,email,role,active,created_at',cols:['full_name','email','role','active','created_at']}};
const T=({cols,data}:{cols:string[];data:any[]})=><table><thead><tr>{cols.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{data.map((r,i)=><tr key={i}>{cols.map(c=><td key={c}>{String(r[c]??'')}</td>)}</tr>)}</tbody></table>;
export function AdminSection(){const {section}=useParams();if(section==='machines')return <AdminMachines/>;const [rows,setRows]=useState<any[]>([]);const [err,setErr]=useState('');const [rows2,setRows2]=useState<any[]>([]);
 useEffect(()=>{setRows([]);setRows2([]);setErr('');
  if(section&&Q[section])sb.from(Q[section].t).select(Q[section].sel).order(Q[section].cols[0]).then(r=>r.error?setErr(r.error.message):setRows(r.data||[]));
  if(section==='customer-access'){sb.from('customer_department_access').select('active,customers(name),departments(name)').then(r=>r.error?setErr(r.error.message):setRows(r.data||[]));
   sb.from('customer_users').select('active,customers(name),profiles(full_name,email)').then(r=>setRows2(r.data||[]))}},[section]);
 if(section==='roles')return <div className="card"><h2>Roles & Permissions</h2><p className="mut">Roles are stored in the database (profiles.role) and enforced by RLS.</p><table><thead><tr><th>Role</th><th>Type</th></tr></thead><tbody>{(Object.keys(ROLE_LABEL) as Role[]).map(r=><tr key={r}><td>{ROLE_LABEL[r]}</td><td>{r==='customer'?'Customer (customer-specific access)':'Internal'}</td></tr>)}</tbody></table></div>;
 if(section==='customer-access')return <div className="card"><h2>Customer Access</h2><h4>Customer → Department</h4><table><tbody>{rows.length===0&&<tr><td className="mut">No access assigned yet.</td></tr>}{rows.map((r,i)=><tr key={i}><td>{r.customers?.name}</td><td>{r.departments?.name}</td><td>{r.active?'active':'inactive'}</td></tr>)}</tbody></table>
  <h4>Login accounts → Customer</h4><table><tbody>{rows2.length===0&&<tr><td className="mut">No customer users linked yet.</td></tr>}{rows2.map((r,i)=><tr key={i}><td>{r.profiles?.email}</td><td>{r.customers?.name}</td><td>{r.active?'active':'inactive'}</td></tr>)}</tbody></table>{err&&<p className="err">{err}</p>}</div>;
 if(!section||!Q[section])return <Navigate to="/app/admin" replace/>;
 return <div className="card"><h2 style={{textTransform:'capitalize'}}>{section}</h2>{err&&<p className="err">{err}</p>}<T cols={Q[section].cols} data={rows}/></div>}
