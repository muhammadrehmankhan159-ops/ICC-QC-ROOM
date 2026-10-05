import {describe,it,expect} from 'vitest';
import {summarize,fmtDay,fmtTime,fmtStamp,attentionLabel,needsAttention,byStructure} from '../monitor';

describe('monitor',()=>{
  it('counts statuses, ignores machines without status',()=>expect(summarize(['RUNNING','RUNNING','HOLD','STOPPED',null,undefined])).toEqual({RUNNING:2,HOLD:1,STOPPED:1}));
  it('empty -> zeros',()=>expect(summarize([])).toEqual({RUNNING:0,HOLD:0,STOPPED:0}));
  it('formats date/time',()=>{const d=new Date(2026,8,18,12,42);expect(fmtDay(d)).toBe('18 Sep 2026');expect(fmtTime(d)).toBe('12:42 PM');expect(fmtTime(new Date(2026,8,18,0,5))).toBe('12:05 AM');});
  it('missing stamp',()=>expect(fmtStamp(null)).toBe('Not Available'));
  it('attention only for stopped/hold',()=>{expect(needsAttention('STOPPED')).toBe(true);expect(needsAttention('HOLD')).toBe(true);expect(needsAttention('RUNNING')).toBe(false);expect(needsAttention(null)).toBe(false);expect(attentionLabel('STOPPED')).toContain('Machine Stopped');});
  it('sorts by process then numeric name',()=>{const r=byStructure([{name:'CCM 10',process:{name:'A',sort:1}},{name:'CCM 2',process:{name:'A',sort:1}},{name:'X',process:{name:'B',sort:2}}]);expect(r.map(x=>x.name)).toEqual(['CCM 2','CCM 10','X']);});
});
