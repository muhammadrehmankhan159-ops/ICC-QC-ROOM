export type Role='admin'|'qa_qc_manager'|'qc_checker'|'qc_assistant'|'production'|'customer';
export const OWNER_ROLE='admin' as const;
export const QC_MANAGER_ROLE='qa_qc_manager' as const;
export const QC_CHECKER_ROLE='qc_checker' as const;
export const QC_ASSISTANT_ROLE='qc_assistant' as const;
export const PRODUCTION_ROLE='production' as const;
export const CUSTOMER_ROLE='customer' as const;
export const ROLE_LABEL:Record<Role,string>={admin:'Owner / Admin',qa_qc_manager:'QC Manager',qc_checker:'QC Checker',qc_assistant:'QC Assistant',production:'Production',customer:'Customer'};
export const isOwner=(r?:string)=>r===OWNER_ROLE;
export const isQcManager=(r?:string)=>r===QC_MANAGER_ROLE;
export const isQcChecker=(r?:string)=>r===QC_CHECKER_ROLE;
export const isQcAssistant=(r?:string)=>r===QC_ASSISTANT_ROLE;
export const isCustomer=(r?:string)=>r===CUSTOMER_ROLE;
export const isQcStaff=(r?:string)=>r===OWNER_ROLE||r===QC_MANAGER_ROLE||r===QC_CHECKER_ROLE||r===QC_ASSISTANT_ROLE;
export const isInternal=(r?:string)=>!!r&&r!==CUSTOMER_ROLE;
export const canViewLatestNews=(r?:string)=>isOwner(r)||isQcManager(r)||isQcChecker(r)||isQcAssistant(r);
export const canManageLatestNews=(r?:string)=>isOwner(r);
export const canManageUsers=(r?:string)=>isOwner(r);
export const canManagePermissions=(r?:string)=>isOwner(r);
export const canCreateInspection=(r?:string)=>isOwner(r)||isQcManager(r)||isQcAssistant(r)||isQcChecker(r);
export const canEditInspection=(r?:string)=>isOwner(r)||isQcManager(r)||isQcAssistant(r)||isQcChecker(r);
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: ['dashboard:view','dashboard:latest_news:view','dashboard:latest_news:manage','machines:view','machines:manage','reports:view','reports:create','reports:edit','customers:view','customers:manage','users:view','users:manage','roles:manage','permissions:manage','settings:manage','audit:view','all:full'],
  qa_qc_manager: ['dashboard:view','dashboard:latest_news:view','machines:view','reporting:view','reports:create','reports:edit','inspections:view','inspections:entry','inspections:edit'],
  qc_checker: ['dashboard:view','dashboard:latest_news:view','machines:view','reports:view','inspections:view','inspections:edit'],
  qc_assistant: ['dashboard:view','dashboard:latest_news:view','reports:view','reports:create','reports:edit'],
  production: ['dashboard:view'],
  customer: ['portal:view','customer:reports:view']
};
export function resolveSignupRole(requestedRole?:string|null,hasExistingAdmin=false):'admin'|'customer'{
 const raw=(requestedRole||'').trim().toLowerCase().replace(/[-_\s]+/g,'_');
 const adminAliases=new Set(['admin','owner','owner_admin','owner-admin']);
 return adminAliases.has(raw)&&!hasExistingAdmin?'admin':'customer';
}
export type Gate='ok'|'login'|'denied'|'portal';
export function gate(path:string,p:{role:Role;active:boolean}|null):Gate{
 if(!p||!p.active)return 'login';
 if(path.startsWith('/app/admin'))return isOwner(p.role)?'ok':'denied';
 if(path.startsWith('/app/dashboard')||path.startsWith('/app/department')||path.startsWith('/app/reports'))return isQcStaff(p.role)?'ok':p.role===CUSTOMER_ROLE?'portal':'denied';
 if(path.startsWith('/app/portal'))return p.role===CUSTOMER_ROLE?'ok':'denied';
 return 'ok'}
