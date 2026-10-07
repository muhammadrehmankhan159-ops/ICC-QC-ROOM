import {useEffect,useRef,useState,FormEvent} from 'react';import {Navigate,NavLink,Outlet,Link,useParams} from 'react-router-dom';
import {sb,useAuth} from './lib';import {ROLE_LABEL,isQcStaff,Role,resolveSignupRole,isTemporaryAdminOverride} from './access';import {AdminMachines} from './department';

function HeroSection({onSequenceComplete}:{onSequenceComplete:()=>void}){
 const shellRef=useRef<HTMLDivElement|null>(null);
 const mapRef=useRef<HTMLVideoElement|null>(null);
 const factoryRef=useRef<HTMLVideoElement|null>(null);
 const rafRef=useRef<number|undefined>(undefined);
 const completeRef=useRef(false);

 useEffect(()=>{
  const shell=shellRef.current; const map=mapRef.current; const factory=factoryRef.current;
  if(!shell||!map||!factory)return;

  const clamp=(v:number,min:number,max:number)=>Math.min(Math.max(v,min),max);
  const sync=()=>{
   const max=Math.max(shell.offsetHeight-window.innerHeight,1);
   const progress=clamp((window.scrollY-shell.offsetTop)/max,0,1);
   const mapDuration=Math.max(map.duration||1,1);
   const factoryDuration=Math.max(factory.duration||1,1);
   const total=mapDuration+factoryDuration;
   const combined=progress*total;
   const mapTime=clamp(combined,0,mapDuration);
   const factoryTime=clamp(combined-mapDuration,0,factoryDuration);
   const factoryReveal=clamp((combined-mapDuration)/Math.max(factoryDuration,0.001),0,1);

   if(Math.abs(map.currentTime-mapTime)>0.03){map.currentTime=mapTime;}
   if(Math.abs(factory.currentTime-factoryTime)>0.03){factory.currentTime=factoryTime;}

   map.style.opacity=String(Math.max(1-(factoryReveal*1.8),0));
   factory.style.opacity=String(Math.min(Math.max(factoryReveal,0),1));

   if(!completeRef.current && combined >= total - 0.12){
    completeRef.current=true;
    onSequenceComplete();
   }

   rafRef.current=requestAnimationFrame(sync);
  };

  map.muted=true;factory.muted=true;map.pause();factory.pause();map.currentTime=0;factory.currentTime=0;
  sync();

  return()=>{
   if(rafRef.current!==undefined){cancelAnimationFrame(rafRef.current);rafRef.current=undefined;}
  };
 },[onSequenceComplete]);

 return <div ref={shellRef} className="hero-scroll-shell"><div className="hero-stage">
  <video ref={mapRef} className="hero-video hero-video-map" playsInline muted preload="auto" src="/3D_logistics_map_scroll_animation_20261006174252.mp4"/>
  <video ref={factoryRef} className="hero-video hero-video-factory" playsInline muted preload="auto" src="/Modify_factory_video_ending_20261006175035.mp4"/>
 </div></div>
}

export function Login(){const {session,profile}=useAuth();const [e,setE]=useState('');const [p,setP]=useState('');const [name,setName]=useState('');const [mode,setMode]=useState<'login'|'signup'>('login');const [err,setErr]=useState('');const [msg,setMsg]=useState('');const [busy,setBusy]=useState(false);const [sequenceComplete,setSequenceComplete]=useState(false);
 const tempAdmin=isTemporaryAdminOverride(session?.user?.email ?? profile?.email);
 if(session&&(profile?.active||tempAdmin))return <Navigate to="/app" replace/>;
 const go=async(ev:FormEvent)=>{ev.preventDefault();setBusy(true);setErr('');setMsg('');
  if(mode==='signup'){if(!name.trim())return setErr('Full name is required');const role=resolveSignupRole('customer',false);const {error}=await sb.auth.signUp({email:e.trim(),password:p,options:{data:{full_name:name.trim(),requested_role:role,signup_kind:'customer'}}});setBusy(false);if(error){setErr(error.message)}else{setMsg('Customer account created. Please verify your email, then sign in and enter your assigned Customer PIN.');setMode('login');setName('');setP('')}}
  else{const {error}=await sb.auth.signInWithPassword({email:e.trim(),password:p});setBusy(false);if(error)setErr(error.message);else sb.rpc('log_login')}
 };
 return <div className="landing-page"><HeroSection onSequenceComplete={()=>setSequenceComplete(true)}/>{sequenceComplete&&<div className="auth-page"><form onSubmit={go} className="card login"><h2 style={{margin:0}}>QC MANAGEMENT & CUSTOMER PORTAL</h2><p className="mut">Imran Crown Crok Pvt Ltd</p>
 {mode==='signup'&&<label>Full Name<input type="text" required value={name} onChange={x=>setName(x.target.value)}/></label>}
 <label>Email<input type="email" required autoComplete="username" value={e} onChange={x=>setE(x.target.value)}/></label><label>Password<input type="password" required autoComplete="current-password" value={p} onChange={x=>setP(x.target.value)}/></label>
 <button disabled={busy} style={{width:'100%'}}>{busy?mode==='signup'?'Creating account…':'Signing in…':mode==='signup'?'Create customer account':'Sign in'}</button>
 <p className="mut" style={{marginTop:10}}><button type="button" className="linkbtn" onClick={()=>{setMode(m=>m==='login'?'signup':'login');setErr('');setMsg('')}}>{mode==='login'?'Create customer account':'Back to sign in'}</button></p>
 {msg&&<p className="mut" style={{color:'#0f766e'}}>{msg}</p>}{err&&<p className="err">{err}</p>}</form></div>}</div>}
export function Inactive(){return <div className="card login"><h3>Account not active</h3><p>Your email must be verified before the Customer Portal can be accessed. If your email is already verified and you still cannot sign in, please contact the Administrator.</p><button onClick={()=>sb.auth.signOut()}>Sign out</button></div>}
export function Denied(){return <div className="card"><h2>Access denied</h2><p>You do not have permission to view this page.</p><Link to="/app">Go back</Link></div>}
export function Layout(){const {session,profile}=useAuth();const tempAdmin=isTemporaryAdminOverride(session?.user?.email ?? profile?.email);const r=(tempAdmin ? 'admin' : profile?.role ?? 'customer') as Role;
 return <div className="shell"><aside className="side"><b>QC MANAGEMENT & CUSTOMER PORTAL</b><small>Imran Crown Crok Pvt Ltd</small>
 {isQcStaff(r)&&<NavLink to="/app/dashboard">QC Control Room</NavLink>}{isQcStaff(r)&&<NavLink to="/app/reports">QC Reports</NavLink>}{r==='customer'&&<><NavLink to="/app/portal" end>Current</NavLink><NavLink to="/app/portal/reports">Reports</NavLink></>}
 {r==='admin'&&<><NavLink to="/app/admin" end>Admin</NavLink>{['departments','machines','customers','users','roles','customer-access','customer-login-activity'].map(s=><NavLink key={s} className="sub" to={`/app/admin/${s}`}>{s.replace(/-/g,' ')}</NavLink>)}</>}
 <div style={{marginTop:'auto'}}><small>{profile?.full_name ?? session?.user?.email ?? 'Admin'}<br/><span className="pill">{ROLE_LABEL[r]}</span></small><br/><button onClick={()=>sb.auth.signOut()}>Logout</button></div></aside><main><Outlet/></main></div>}
export const AdminHome=()=><div className="card"><h2>Admin</h2><p className="mut">Phase 1 foundation: read-only views of the configuration. Management screens come in later phases.</p></div>;
const Q:Record<string,{t:string;sel:string;cols:string[]}>={
 departments:{t:'departments',sel:'name,code,active',cols:['name','code','active']},
 customers:{t:'customers',sel:'name,code,active',cols:['name','code','active']},
 users:{t:'profiles',sel:'full_name,email,role,active,created_at',cols:['full_name','email','role','active','created_at']}};
const T=({cols,data}:{cols:string[];data:any[]})=><table><thead><tr>{cols.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{data.map((r,i)=><tr key={i}>{cols.map(c=><td key={c}>{String(r[c]??'')}</td>)}</tr>)}</tbody></table>;
export function CustomerLoginActivity(){const [rows,setRows]=useState<any[]>([]);const [err,setErr]=useState('');const load=async()=>{const [acc,act,maps]=await Promise.all([
 sb.from('profiles').select('id,full_name,email,created_at,active').eq('role','customer').order('created_at',{ascending:false}),
 sb.from('customer_login_activity').select('user_id,email,customer_name,action,created_at').order('created_at',{ascending:false}),
 sb.from('customer_users').select('user_id,customer_id,customers(name)').eq('active',true)
 ]);if(acc.error){setErr(acc.error.message);return}if(act.error){setErr(act.error.message);return}if(maps.error){setErr(maps.error.message);return}
 const map=new Map<string,string>();for(const row of maps.data||[]){const c=(row as any).customers; if((row as any).user_id && c?.name) map.set((row as any).user_id,c.name);}const byUser=new Map<string,any[]>();for(const row of act.data||[]){const list=byUser.get((row as any).user_id)||[];list.push(row);byUser.set((row as any).user_id,list)};setRows((acc.data||[]).map((p:any)=>{const latest=(byUser.get(p.id)||[]).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0];return {user_id:p.id,email:p.email,customer_name:map.get(p.id)||'Unassigned',customer_mapping:map.get(p.id) || '—',account_created: p.created_at,last_login: latest?.created_at || null,activity: latest?.action || 'No login yet',history: (byUser.get(p.id)||[]).slice(0,5).map((x:any)=>`${x.action} • ${x.created_at}`) };}));setErr('')}; useEffect(()=>{load();},[]); return <div className="card"><h2>Customer Login Activity</h2><p className="mut">Customer account creation, mapping and portal access history. Customers can only see their own data.</p>{err&&<p className="err">{err}</p>}<table><thead><tr><th>Email</th><th>Customer Name</th><th>Account Created</th><th>Last Login</th><th>Recent Activity</th></tr></thead><tbody>{rows.length===0&&<tr><td colSpan={5} className="mut">No customer activity yet.</td></tr>}{rows.map(r=><tr key={r.user_id}><td>{r.email}</td><td>{r.customer_name}</td><td>{r.account_created ? new Date(r.account_created).toLocaleString() : '—'}</td><td>{r.last_login ? new Date(r.last_login).toLocaleString() : 'No login yet'}</td><td>{r.history?.length ? r.history.join(' / ') : r.activity}</td></tr>)}</tbody></table></div>}
export function AdminSection(){const {section}=useParams();if(section==='machines')return <AdminMachines/>;if(section==='customer-login-activity')return <CustomerLoginActivity/>;const [rows,setRows]=useState<any[]>([]);const [err,setErr]=useState('');const [rows2,setRows2]=useState<any[]>([]);
 useEffect(()=>{setRows([]);setRows2([]);setErr('');
  if(section&&Q[section])sb.from(Q[section].t).select(Q[section].sel).order(Q[section].cols[0]).then(r=>r.error?setErr(r.error.message):setRows(r.data||[]));
  if(section==='customer-access'){sb.from('customer_department_access').select('active,customers(name),departments(name)').then(r=>r.error?setErr(r.error.message):setRows(r.data||[]));
   sb.from('customer_users').select('active,customers(name),profiles(full_name,email)').then(r=>setRows2(r.data||[]))}},[section]);
 if(section==='roles')return <div className="card"><h2>Roles & Permissions</h2><p className="mut">Roles are stored in the database (profiles.role) and enforced by RLS.</p><table><thead><tr><th>Role</th><th>Type</th></tr></thead><tbody>{(Object.keys(ROLE_LABEL) as Role[]).map(r=><tr key={r}><td>{ROLE_LABEL[r]}</td><td>{r==='customer'?'Customer (customer-specific access)':'Internal'}</td></tr>)}</tbody></table></div>;
 if(section==='customer-access')return <div className="card"><h2>Customer Access</h2><h4>Customer → Department</h4><table><tbody>{rows.length===0&&<tr><td className="mut">No access assigned yet.</td></tr>}{rows.map((r,i)=><tr key={i}><td>{r.customers?.name}</td><td>{r.departments?.name}</td><td>{r.active?'active':'inactive'}</td></tr>)}</tbody></table>
  <h4>Login accounts → Customer</h4><table><tbody>{rows2.length===0&&<tr><td className="mut">No customer users linked yet.</td></tr>}{rows2.map((r,i)=><tr key={i}><td>{r.profiles?.email}</td><td>{r.customers?.name}</td><td>{r.active?'active':'inactive'}</td></tr>)}</tbody></table>{err&&<p className="err">{err}</p>}</div>;
 if(!section||!Q[section])return <Navigate to="/app/admin" replace/>;
 return <div className="card"><h2 style={{textTransform:'capitalize'}}>{section}</h2>{err&&<p className="err">{err}</p>}<T cols={Q[section].cols} data={rows}/></div>}
