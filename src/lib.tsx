import {createClient,Session} from '@supabase/supabase-js';
import {createContext,useContext,useEffect,useState,ReactNode} from 'react';import type {Role} from './access';
export const sb=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
export type Profile={id:string;full_name:string;email:string;role:Role;active:boolean};
type C={session:Session|null;profile:Profile|null;loading:boolean};
const Ctx=createContext<C>({session:null,profile:null,loading:true});export const useAuth=()=>useContext(Ctx);
export async function logCustomerActivity(action:'login'|'portal_access'='login'){
 try { await sb.rpc('log_customer_login_activity',{p_action:action}); } catch (err) { console.warn('customer activity log skipped',err); }
}
export function AuthProvider({children}:{children:ReactNode}){
 const [s,setS]=useState<C>({session:null,profile:null,loading:true});
 const load=async(session:Session|null)=>{if(!session){setS({session:null,profile:null,loading:false});return}
  const {data}=await sb.from('profiles').select('id,full_name,email,role,active').eq('id',session.user.id).maybeSingle();
  if(data?.role==='customer'){await logCustomerActivity('login');}
  setS({session,profile:data as Profile|null,loading:false})};
 useEffect(()=>{sb.auth.getSession().then(({data})=>load(data.session));
  const {data:sub}=sb.auth.onAuthStateChange((_e,session)=>{setTimeout(()=>load(session),0)});return()=>sub.subscription.unsubscribe()},[]);
 return <Ctx.Provider value={s}>{children}</Ctx.Provider>}
