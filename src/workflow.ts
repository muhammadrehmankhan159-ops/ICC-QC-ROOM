export type IStatus='DRAFT'|'INSPECTION_PENDING'|'PASS'|'HOLD'|'REJECT'|'RE_TEST'|'APPROVED';
export const ISTATUS:IStatus[]=['DRAFT','INSPECTION_PENDING','PASS','HOLD','REJECT','RE_TEST','APPROVED'];
export const ILABEL=(s:string)=>s==='RE_TEST'?'RE-TEST':s.replace('_',' ');
export const IMETA:Record<IStatus,{color:string;icon:string}>={DRAFT:{color:'#64748b',icon:'📝'},INSPECTION_PENDING:{color:'#b45309',icon:'🕒'},PASS:{color:'#15803d',icon:'✔'},HOLD:{color:'#d97706',icon:'⏸'},REJECT:{color:'#b91c1c',icon:'✖'},RE_TEST:{color:'#c2410c',icon:'↻'},APPROVED:{color:'#0f766e',icon:'🏁'}};
export type Actor={role:string;uid:string};
export type Rep={status:IStatus;qc_assistant_id:string;qc_checker_id:string;qa_manager_id:string;created_by:string};
// Mirror of SQL qc_transition_ok(); the database is the real enforcement.
export function transitionOk(a:Actor,r:Rep,to:IStatus):boolean{const f=r.status;
 if(a.role==='admin')return f!==to;
 if(f===to)return false;
 if(a.role==='qc_assistant')return a.uid===r.qc_assistant_id&&((f==='DRAFT'&&to==='INSPECTION_PENDING')||(f==='INSPECTION_PENDING'&&to==='DRAFT')||((f==='HOLD'||f==='RE_TEST')&&to==='INSPECTION_PENDING'));
 if(a.role==='qc_checker')return a.uid===r.qc_checker_id&&['INSPECTION_PENDING','HOLD','RE_TEST'].includes(f)&&['PASS','HOLD','REJECT','RE_TEST'].includes(to);
 if(a.role==='qa_qc_manager')return (a.uid===r.qa_manager_id&&f==='PASS'&&to==='APPROVED')||(['PASS','HOLD','REJECT','RE_TEST'].includes(f)&&to==='INSPECTION_PENDING');
 return false}
export const nextStatuses=(a:Actor,r:Rep)=>ISTATUS.filter(s=>transitionOk(a,r,s));
export const ACTION_LABEL=(from:IStatus,to:IStatus)=>to==='INSPECTION_PENDING'?(from==='DRAFT'?'Submit for inspection':'Send for re-inspection'):to==='DRAFT'?'Return to draft':to==='APPROVED'?'Approve report':`Mark ${ILABEL(to)}`;
export const canCreate=(role?:string)=>['admin','qa_qc_manager','qc_assistant'].includes(role||'');
export type Scope='all'|'details'|'remarks'|'none';
export function editScope(a:Actor,r:Rep):Scope{if(a.role==='admin')return 'all';if(r.status==='APPROVED')return 'none';
 if(a.role==='qa_qc_manager')return 'all';
 if(a.role==='qc_assistant'&&a.uid===r.qc_assistant_id&&['DRAFT','INSPECTION_PENDING','HOLD','RE_TEST'].includes(r.status))return 'details';
 if(a.role==='qc_checker'&&a.uid===r.qc_checker_id)return 'remarks';return 'none'}
export const isoLocal=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const isoOffset=(days:number,base=new Date())=>{const d=new Date(base);d.setDate(d.getDate()-days);return isoLocal(d)};
export const emptyReportsMessage=(name:string,from:string,to:string,filtered:boolean)=>from&&from===to?`No ${name} QC reports found for the selected date.`:(from||to)?`No ${name} QC reports found for the selected date range.`:filtered?`No ${name} QC reports match your search.`:`No ${name} QC reports available yet.`;
