begin;
do $$declare ad uuid:=gen_random_uuid();ch uuid:=gen_random_uuid();cu uuid:=gen_random_uuid();pep uuid;coke uuid;pl uuid;cr uuid;im uuid;mid uuid;pid uuid;n int;
begin
 insert into auth.users(id,email) values(ad,'ad@t'),(ch,'ch@t'),(cu,'cu@t');
 update profiles set role='admin',active=true where id=ad;update profiles set role='qc_checker',active=true where id=ch;update profiles set role='customer',active=true where id=cu;
 -- exact structure
 assert (select count(*) from departments)=3,'exactly 3 departments';
 assert (select array_agg(code order by code) from departments)=array['CROWN','INJECTION_MOULDING','PLASTIC'],'department codes';
 assert not exists(select 1 from processes where name ilike '%liner%') and not exists(select 1 from machines where name ilike '%liner%'),'no liner';
 assert (select array_agg(name order by sort) from processes p where department_id=(select id from departments where code='PLASTIC'))=array['CCM CLOSURE','SLITTING','PRINTING'],'plastic processes';
 assert (select array_agg(name order by sort) from processes p where department_id=(select id from departments where code='CROWN'))=array['TPR','PRESS','PMC'],'crown processes';
 assert (select count(*) from processes where department_id=(select id from departments where code='INJECTION_MOULDING'))=0,'IMM has no processes';
 assert (select array_agg(m.name order by m.name) from machines m join processes p on p.id=m.process_id where p.name='CCM CLOSURE')=array['CCM 01','CCM 02','CCM 03','CCM 04','CCM 05','CCM 06','CCM 07','CCM 08'],'CCM';
 assert (select array_agg(m.name order by m.name) from machines m join processes p on p.id=m.process_id where p.name='SLITTING')=array['PMV 02','SCM 01','SFM 01','SFM 02','SFM 03'],'SLITTING';
 assert (select array_agg(m.name order by m.name) from machines m join processes p on p.id=m.process_id where p.name='PRINTING')=array['PRINTING 01','PRINTING 02','PRINTING 03'],'PRINTING';
 assert (select array_agg(m.name order by m.name) from machines m join processes p on p.id=m.process_id where p.name='TPR')=array['COATING SECTION','PRINTING SECTION'],'TPR';
 assert (select array_agg(m.name order by m.name) from machines m join processes p on p.id=m.process_id where p.name='PRESS')=array['PRESS 01','PRESS 02','PRESS 03'],'PRESS';
 assert (select array_agg(m.name order by m.name) from machines m join processes p on p.id=m.process_id where p.name='PMC')=array['PMC 01','PMC 02'],'PMC';
 assert (select array_agg(name order by name) from machines where process_id is null)=array['IMM 01','IMM 02','IMM 03','IMM 04'],'IMM machines direct';
 assert (select count(*) from machines m join departments d on d.id=m.department_id where d.code='INJECTION_MOULDING')=4,'IMM separate';
 assert (select count(*) from qc_updates)=0 and (select count(*) from machine_current_status)=0,'no fake data';
 select id into pl from departments where code='PLASTIC';select id into cr from departments where code='CROWN';select id into im from departments where code='INJECTION_MOULDING';
 select id into pid from processes where name='CCM CLOSURE';select id into pep from customers where name='Pepsi';select id into coke from customers where name='Coca-Cola';
 insert into customer_department_access(customer_id,department_id) values(pep,pl);insert into customer_users(user_id,customer_id) values(cu,pep);
 -- admin can add; duplicate rejected; process must match department
 perform set_config('request.jwt.claim.sub',ad::text,true);set local role authenticated;
 insert into machines(department_id,process_id,name) values(pl,pid,'CCM 09');
 begin insert into machines(department_id,process_id,name) values(pl,pid,'ccm 09');assert false,'duplicate allowed';exception when unique_violation then null;end;
 begin insert into machines(department_id,process_id,name) values(cr,pid,'BAD');assert false,'cross-dept process';exception when others then assert sqlerrm like 'process does not belong%',sqlerrm;end;
 insert into machines(department_id,name) values(im,'IMM 05');
 assert exists(select 1 from audit_logs where action='machine_created'),'machine creation audited';
 reset role;
 -- non-admin QC staff cannot add/edit machines
 perform set_config('request.jwt.claim.sub',ch::text,true);set local role authenticated;
 begin insert into machines(department_id,process_id,name) values(pl,pid,'CCM 10');assert false,'checker added machine';exception when others then assert sqlerrm not like 'checker added%',sqlerrm;end;
 update machines set name='X' where name='CCM 01';get diagnostics n=row_count;assert n=0,'checker edited machine';
 -- job context with updates; customer must be authorized for the department
 select id into mid from machines where name='CCM 01';
 insert into qc_updates(machine_id,status,remark,customer_id,product,batch) values(mid,'RUNNING','Running',pep,' Cap A ','B-1');
 assert (select customer_id from machine_current_status where machine_id=mid)=pep and (select product from machine_current_status where machine_id=mid)='Cap A','job context stored';
 begin insert into qc_updates(machine_id,status,remark,customer_id) values(mid,'RUNNING','x',coke);assert false,'unauthorized customer';exception when others then assert sqlerrm like 'customer is not authorized%',sqlerrm;end;
 reset role;
 -- customer: no machines, processes, status
 perform set_config('request.jwt.claim.sub',cu::text,true);set local role authenticated;
 assert (select count(*) from machines)=0 and (select count(*) from processes)=0 and (select count(*) from machine_current_status)=0,'customer sees no machines';
 begin insert into machines(department_id,name) values(im,'IMM 06');assert false,'customer added machine';exception when others then assert sqlerrm not like 'customer added%',sqlerrm;end;
 update machines set active=false;get diagnostics n=row_count;assert n=0,'customer edited machine';
 reset role;
 raise notice 'PHASE 3 TESTS PASSED';
end$$;
rollback;
