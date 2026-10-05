import {describe,it,expect} from 'vitest';import {readFileSync} from 'node:fs';import {EXPECTED,FLOWS,deptSummary} from '../structure';
const sql=readFileSync(new URL('../../supabase/migrations/002_phase2_control_room.sql',import.meta.url),'utf8');
const seeded:Record<string,string[]>={};for(const [,p,m] of sql.matchAll(/\('(CCM CLOSURE|SLITTING|PRINTING|TPR|PRESS|PMC)','([^']+)'\)/g)){(seeded[p]??=[]).push(m)}
const imm=[...sql.matchAll(/\('(IMM \d\d)'\)/g)].map(x=>x[1]);
describe('structure',()=>{
 for(const [d,ps] of Object.entries(EXPECTED))for(const [p,ms] of Object.entries(ps))it(`${d}/${p||'direct'} matches spec exactly`,()=>expect(p?seeded[p]:imm).toEqual(ms));
 it('flows',()=>{expect(FLOWS.PLASTIC).toEqual(['CCM CLOSURE','SLITTING','PRINTING','PACKING']);expect(FLOWS.CROWN).toEqual(['TPR','PRESS','PMC','FINAL PACKING']);expect(FLOWS.INJECTION_MOULDING).toEqual([])});
 it('no liner/spc in seed',()=>expect(/liner|spc/i.test(sql.replace(/ilike '%liner%'/g,''))).toBe(false));
 it('summary',()=>{expect(deptSummary(['RUNNING','HOLD','STOPPED',null])).toMatchObject({RUNNING:1,HOLD:1,STOPPED:1,attention:2,hasData:true});expect(deptSummary([null,null]).hasData).toBe(false)})});
