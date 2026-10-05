import {summarize,type Status} from './monitor';
// Process flow shown on department pages (labels only; PACKING / FINAL PACKING are not machines or processes).
export const FLOWS:Record<string,string[]>={PLASTIC:['CCM CLOSURE','SLITTING','PRINTING','PACKING'],CROWN:['TPR','PRESS','PMC','FINAL PACKING'],INJECTION_MOULDING:[]};
export const EXPECTED:Record<string,Record<string,string[]>>={
 PLASTIC:{'CCM CLOSURE':['CCM 01','CCM 02','CCM 03','CCM 04','CCM 05','CCM 06','CCM 07','CCM 08'],SLITTING:['SCM 01','SFM 01','SFM 02','SFM 03','PMV 02'],PRINTING:['PRINTING 01','PRINTING 02','PRINTING 03']},
 CROWN:{TPR:['COATING SECTION','PRINTING SECTION'],PRESS:['PRESS 01','PRESS 02','PRESS 03'],PMC:['PMC 01','PMC 02']},
 INJECTION_MOULDING:{'':['IMM 01','IMM 02','IMM 03','IMM 04']}};
export const deptSummary=(statuses:(Status|null)[])=>{const c=summarize(statuses);return {...c,attention:c.HOLD+c.STOPPED,hasData:statuses.some(s=>!!s)}};
