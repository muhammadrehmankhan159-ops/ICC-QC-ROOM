import {describe,it,expect} from 'vitest';import {gate} from '../access';
const P=(role:any,active=true)=>({role,active});
describe('route gate',()=>{
 it('anonymous -> login',()=>expect(gate('/app/dashboard',null)).toBe('login'));
 it('inactive -> login',()=>expect(gate('/app/dashboard',P('admin',false))).toBe('login'));
 it('admin area admin only',()=>{expect(gate('/app/admin/users',P('admin'))).toBe('ok');for(const r of ['qa_qc_manager','qc_checker','qc_assistant','production','customer'])expect(gate('/app/admin',P(r))).toBe('denied')});
 it('customer cannot open dashboard',()=>expect(gate('/app/dashboard',P('customer'))).toBe('portal'));
 it('QC staff open dashboard and departments',()=>{for(const r of ['admin','qa_qc_manager','qc_checker','qc_assistant']){expect(gate('/app/dashboard',P(r))).toBe('ok');expect(gate('/app/department/CROWN',P(r))).toBe('ok')}});
 it('reports are QC staff only',()=>{for(const r of ['admin','qa_qc_manager','qc_checker','qc_assistant'])expect(gate('/app/reports/new',P(r))).toBe('ok');expect(gate('/app/reports',P('production'))).toBe('denied');expect(gate('/app/reports',P('customer'))).toBe('portal')});
 it('customer reaches portal reports',()=>expect(gate('/app/portal/reports',P('customer'))).toBe('ok'));
 it('production has no dashboard access yet',()=>expect(gate('/app/dashboard',P('production'))).toBe('denied'));
 it('customer cannot open departments',()=>expect(gate('/app/department/CROWN',P('customer'))).toBe('portal'));
 it('portal is customer only',()=>{expect(gate('/app/portal',P('customer'))).toBe('ok');expect(gate('/app/portal',P('admin'))).toBe('denied')})});
