export type Role='admin'|'qa_qc_manager'|'qc_checker'|'qc_assistant'|'production'|'customer';
export const ROLE_LABEL:Record<Role,string>={admin:'Admin',qa_qc_manager:'QA/QC Manager',qc_checker:'QC Checker',qc_assistant:'QC Assistant',production:'Production',customer:'Customer'};
export const isQcStaff=(r?:string)=>['admin','qa_qc_manager','qc_checker','qc_assistant'].includes(r||'');
export const isInternal=(r?:string)=>!!r&&r!=='customer';
export type Gate='ok'|'login'|'denied'|'portal';
export function gate(path:string,p:{role:Role;active:boolean}|null):Gate{
 if(!p||!p.active)return 'login';
 if(path.startsWith('/app/admin'))return p.role==='admin'?'ok':'denied';
 if(path.startsWith('/app/dashboard')||path.startsWith('/app/department')||path.startsWith('/app/reports'))return isQcStaff(p.role)?'ok':p.role==='customer'?'portal':'denied';
 if(path.startsWith('/app/portal'))return p.role==='customer'?'ok':'denied';
 return 'ok'}
