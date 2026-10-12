import {createClient,Session} from '@supabase/supabase-js';
import {createContext,useContext,useEffect,useState,ReactNode} from 'react';import type {Role} from './access';
export const sb=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
export type Profile={id:string;full_name:string;email:string;role:Role;active:boolean};
type C={session:Session|null;profile:Profile|null;loading:boolean};
const Ctx=createContext<C>({session:null,profile:null,loading:true});export const useAuth=()=>useContext(Ctx);
const ADMIN_ROLE_ALIASES=new Set(['admin','owner','owner_admin','owner-admin']);
export async function logCustomerActivity(action:'login'|'portal_access'='login'){
 try { await sb.rpc('log_customer_login_activity',{p_action:action}); } catch (err) { console.warn('customer activity log skipped',err); }
}
async function ensureProfileForSession(session: Session): Promise<Profile | null> {
 const {data,error}=await sb.from('profiles').select('id,full_name,email,role,active').eq('id',session.user.id).maybeSingle();
 if(error && error.code !== 'PGRST116') throw error;
 if(data) return data as Profile;

 const meta=(session.user.user_metadata ?? {}) as Record<string,unknown>;
 const requested=String(meta.requested_role ?? meta.role ?? 'customer').trim().toLowerCase().replace(/[-_\s]+/g,'_');
 const role: Role = ADMIN_ROLE_ALIASES.has(requested) ? 'admin' : 'customer';
 const full_name=String(meta.full_name ?? session.user.email ?? 'User').trim() || 'User';

 const {data:upserted,error:upsertError}=await sb.from('profiles').upsert({
  id: session.user.id,
  email: session.user.email ?? '',
  full_name,
  role,
  active: true,
 }, { onConflict: 'id' }).select('id,full_name,email,role,active').single();
 if(upsertError) throw upsertError;
 return upserted as Profile;
}
export function AuthProvider({children}:{children:ReactNode}){
 const [s,setS]=useState<C>({session:null,profile:null,loading:true});
 const load=async(session:Session|null)=>{if(!session){setS({session:null,profile:null,loading:false});return}
  try {
   const profile = await ensureProfileForSession(session);
   if(profile?.role==='customer'){await logCustomerActivity('login');}
   setS({session,profile,loading:false});
  } catch (err) {
   console.error('profile load failed', err);
   setS({session,profile:null,loading:false});
  }
 };
 useEffect(()=>{sb.auth.getSession().then(({data})=>load(data.session));
  const {data:sub}=sb.auth.onAuthStateChange((_e,session)=>{setTimeout(()=>load(session),0)});return()=>sub.subscription.unsubscribe()},[]);
 return <Ctx.Provider value={s}>{children}</Ctx.Provider>}
