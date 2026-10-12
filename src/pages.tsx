import {useEffect,useRef,useState,FormEvent} from 'react';import {Navigate,NavLink,Outlet,Link,useParams} from 'react-router-dom';
import {sb,useAuth} from './lib';import {ROLE_LABEL,isQcStaff,Role,resolveSignupRole} from './access';import {AdminMachines} from './department';

function HeroMapScene(){
 const canvasRef = useRef<HTMLCanvasElement | null>(null);
 useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true });
  if (!gl) return;

  const vertexShaderSource = `
    attribute vec2 aPosition;
    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision highp float;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uScroll;

    #define PI 3.14159265359

    mat2 rot(float a){
      float s = sin(a);
      float c = cos(a);
      return mat2(c, -s, s, c);
    }

    float hash21(vec2 p){
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float sdBox(vec3 p, vec3 b){
      vec3 q = abs(p) - b;
      return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
    }

    float sdCyl(vec3 p, vec2 h){
      vec2 d = abs(vec2(length(p.xz), p.y)) - h;
      return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
    }

    float scene(vec3 p){
      float base = p.y + 1.45;
      vec3 q = p;
      q.xz *= rot(uTime * 0.12 + uScroll * 0.7);
      float grid = 999.0;
      for (int i = 0; i < 6; i++) {
        float fi = float(i);
        vec3 c = vec3((mod(fi * 1.9, 3.0) - 1.5) * 2.5, 0.0, floor(fi / 2.0) * 2.1 - 4.0);
        vec3 b = vec3(0.75 + 0.15 * sin(uTime + fi), 0.7 + fi * 0.16, 0.75 + 0.15 * cos(uTime * 1.3 + fi));
        grid = min(grid, sdBox(q - c, b));
      }
      float towerA = sdBox(p - vec3(-2.2, 0.9, -1.0), vec3(0.45, 1.1, 0.45));
      float towerB = sdBox(p - vec3(2.3, 0.75, 1.4), vec3(0.5, 0.9, 0.6));
      float towerC = sdBox(p - vec3(-0.2, 0.6, 2.3), vec3(0.6, 0.7, 0.6));
      float pipeA = sdCyl(p - vec3(0.0, 0.3, 0.8), vec2(0.14, 2.1));
      float pipeB = sdCyl(p - vec3(1.8, 0.25, -0.7), vec2(0.12, 1.5));
      float hall = sdBox(p - vec3(0.0, 0.25, 0.2), vec3(3.1, 0.45, 1.9));
      float roof = sdBox(p - vec3(0.0, 1.1, 0.15), vec3(2.5, 0.16, 1.65));
      float seam = min(base, min(min(grid, min(towerA, towerB)), min(towerC, min(pipeA, min(pipeB, min(hall, roof))))));
      return seam;
    }

    vec3 shade(vec3 ro, vec3 rd, vec3 p, float d){
      vec3 lightDir = normalize(vec3(-0.9, 0.8, 0.6));
      vec3 normal = vec3(
        scene(p + vec3(0.01, 0.0, 0.0)) - scene(p - vec3(0.01, 0.0, 0.0)),
        scene(p + vec3(0.0, 0.01, 0.0)) - scene(p - vec3(0.0, 0.01, 0.0)),
        scene(p + vec3(0.0, 0.0, 0.01)) - scene(p - vec3(0.0, 0.0, 0.01))
      );
      normal = normalize(normal);
      float diff = max(dot(normal, lightDir), 0.0);
      float fres = pow(1.0 - max(dot(-rd, normal), 0.0), 2.2);
      vec3 baseCol = mix(vec3(0.15, 0.2, 0.26), vec3(0.62, 0.72, 0.82), clamp(p.y + 1.3, 0.0, 1.0));
      float glow = 0.0;
      if (abs(mod(p.x * 3.0 + p.z * 2.6, 2.1) - 1.05) < 0.18 && p.y > -0.4) glow = 1.0;
      vec3 color = baseCol * (0.15 + diff * 1.2);
      color += vec3(0.56, 0.82, 1.0) * fres * 0.45;
      color += vec3(0.18, 0.38, 0.8) * glow * 0.6;
      float fog = 1.0 - exp(-0.22 * d * d);
      return mix(color, vec3(0.02, 0.05, 0.09), fog);
    }

    void main(){
      vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);
      vec2 p = uv * 1.85;
      vec3 ro = vec3(0.0, 1.1, 6.5 - uScroll * 1.8);
      vec3 ta = vec3(0.0, 0.8, -0.5 + uScroll * 1.3);
      vec3 ww = normalize(ta - ro);
      vec3 uu = normalize(cross(vec3(0.0, 1.0, 0.0), ww));
      vec3 vv = normalize(cross(ww, uu));
      vec3 rd = normalize(uu * p.x + vv * p.y + ww * 1.8);

      float dist = 0.0;
      vec3 pos = ro;
      float glowAccum = 0.0;
      vec3 color = vec3(0.02, 0.05, 0.09);
      for (int i = 0; i < 72; i++) {
        float d = scene(pos);
        if (d < 0.001) {
          color = shade(ro, rd, pos, dist);
          break;
        }
        glowAccum += 0.015 / (0.1 + abs(d));
        dist += d * 0.7;
        pos = ro + rd * dist;
        if (dist > 12.0) break;
      }

      float horizon = 1.0 - smoothstep(-1.0, 1.2, uv.y);
      vec3 sky = mix(vec3(0.02, 0.04, 0.08), vec3(0.17, 0.26, 0.4), horizon);
      sky += vec3(0.08, 0.14, 0.22) * (1.0 - length(uv) * 0.7);
      sky += glowAccum * vec3(0.28, 0.42, 0.95) * 0.7;
      color = mix(sky, color, 0.85);

      float vignette = 1.0 - smoothstep(1.2, 1.7, length(uv));
      color *= vignette;
      color += vec3(0.04, 0.1, 0.15) * (0.5 + 0.5 * sin(uTime * 0.8 + uv.x * 3.0));

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const compileShader = (type:number, source:string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  };

  const program = gl.createProgram();
  if (!program) return;
  const vShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
  const fShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vShader || !fShader) return;

  gl.attachShader(program, vShader);
  gl.attachShader(program, fShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const vertices = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1,
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const location = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);

  const resolutionLocation = gl.getUniformLocation(program, 'uResolution');
  const timeLocation = gl.getUniformLocation(program, 'uTime');
  const scrollLocation = gl.getUniformLocation(program, 'uScroll');

  const resize = () => {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(canvas.clientWidth * ratio));
    const height = Math.max(220, Math.floor(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  let raf = 0;
  const animate = (now:number) => {
    resize();
    const t = now * 0.001;
    const scrollProgress = Math.min(window.scrollY / 500, 1.0);
    gl.useProgram(program);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, t);
    gl.uniform1f(scrollLocation, scrollProgress + Math.sin(t * 0.6) * 0.08);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    raf = window.requestAnimationFrame(animate);
  };

  resize();
  raf = window.requestAnimationFrame(animate);

  return () => {
    window.cancelAnimationFrame(raf);
    gl.deleteBuffer(buffer);
    gl.deleteShader(vShader);
    gl.deleteShader(fShader);
    gl.deleteProgram(program);
  };
 }, []);

 return <div className="hero-map-panel"><canvas ref={canvasRef} className="hero-canvas" aria-label="3D industrial factory animation" /></div>;
}

export function Login(){const {session,profile}=useAuth();const [e,setE]=useState('');const [p,setP]=useState('');const [name,setName]=useState('');const [mode,setMode]=useState<'login'|'signup'>('login');const [err,setErr]=useState('');const [msg,setMsg]=useState('');const [busy,setBusy]=useState(false);
 if(session&&profile?.active)return <Navigate to="/app" replace/>;
 const go=async(ev:FormEvent)=>{ev.preventDefault();setBusy(true);setErr('');setMsg('');
  if(mode==='signup'){if(!name.trim())return setErr('Full name is required');const role=resolveSignupRole('customer',false);const {error}=await sb.auth.signUp({email:e.trim(),password:p,options:{data:{full_name:name.trim(),requested_role:role,signup_kind:'customer'}}});setBusy(false);if(error){setErr(error.message)}else{setMsg('Customer account created. Please verify your email, then sign in and enter your assigned Customer PIN.');setMode('login');setName('');setP('')}}
  else{const {error}=await sb.auth.signInWithPassword({email:e.trim(),password:p});setBusy(false);if(error)setErr(error.message);else sb.rpc('log_login')}
 };
 return <div className="landing-page"><div className="auth-page"><HeroMapScene/><form onSubmit={go} className="card login"><h2 style={{margin:0}}>QC MANAGEMENT & CUSTOMER PORTAL</h2><p className="mut">Imran Crown Crok Pvt Ltd</p>
 {mode==='signup'&&<label>Full Name<input type="text" required value={name} onChange={x=>setName(x.target.value)}/></label>}
 <label>Email<input type="email" required autoComplete="username" value={e} onChange={x=>setE(x.target.value)}/></label><label>Password<input type="password" required autoComplete="current-password" value={p} onChange={x=>setP(x.target.value)}/></label>
 <button disabled={busy} style={{width:'100%'}}>{busy?mode==='signup'?'Creating account…':'Signing in…':mode==='signup'?'Create customer account':'Sign in'}</button>
 <p className="mut" style={{marginTop:10}}><button type="button" className="linkbtn" onClick={()=>{setMode(m=>m==='login'?'signup':'login');setErr('');setMsg('')}}>{mode==='login'?'Create customer account':'Back to sign in'}</button></p>
 {msg&&<p className="mut" style={{color:'#0f766e'}}>{msg}</p>}{err&&<p className="err">{err}</p>}</form></div></div>}
export function Inactive(){return <div className="card login"><h3>Account access required</h3><p>Please sign in again or contact the Administrator to confirm the account is correctly linked to the ICC QC ROOM system.</p><button onClick={()=>sb.auth.signOut()}>Sign out</button></div>}
export function Denied(){return <div className="card"><h2>Access denied</h2><p>You do not have permission to view this page.</p><Link to="/app">Go back</Link></div>}
export function Layout(){const {profile}=useAuth();const r=profile!.role as Role;
 const canSeeDashboard = r === 'admin' || isQcStaff(r);
 const showPortalForOwnerTesting = r === 'admin';
 const navPrimary=[
  canSeeDashboard ? {to:'/app/dashboard',label:'Dashboard',icon:'⌂'} : null,
  isQcStaff(r) ? {to:'/app/reports',label:'Reports',icon:'▣'} : null,
  r==='customer' || showPortalForOwnerTesting ? {to:'/app/portal',label:'Current',icon:'◫'} : null,
  r==='customer' || showPortalForOwnerTesting ? {to:'/app/portal/reports',label:'Reports',icon:'▤'} : null,
  r==='admin' ? {to:'/app/admin',label:'Admin',icon:'⚙'} : null,
 ].filter(Boolean) as {to:string;label:string;icon:string}[];
 return <div className="shell"><aside className="side"><div className="brand"><div className="brand-mark"><span>IC</span></div><div className="brand-copy"><strong>IMRAN</strong><strong>CROWN</strong><strong>CORK</strong></div></div>
  <nav className="nav-list">{navPrimary.map(item => <NavLink key={item.to} to={item.to} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}><span className="nav-icon">{item.icon}</span><span>{item.label}</span></NavLink>)}
   {r==='admin' && ['departments','machines','customers','users','roles','customer-access','customer-login-activity'].map(s => <NavLink key={s} className="sub" to={`/app/admin/${s}`}>{s.replace(/-/g,' ')}</NavLink>)}
  </nav>
  <div className="side-footer"><small>{profile!.full_name}<br/><span className="pill">{ROLE_LABEL[r]}</span></small><br/><button onClick={()=>sb.auth.signOut()}>Logout</button></div></aside><main><Outlet/></main></div>}
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
