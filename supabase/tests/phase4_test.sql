begin;
do $$declare ad uuid:=gen_random_uuid();mg uuid:=gen_random_uuid();ch uuid:=gen_random_uuid();a1 uuid:=gen_random_uuid();a2 uuid:=gen_random_uuid();pc uuid:=gen_random_uuid();cc uuid:=gen_random_uuid();pr uuid:=gen_random_uuid();
 pl uuid;pid uuid;m3 uuid;m1 uuid;pep uuid;coke uuid;rid text;rid2 text;iid uuid;n int;
begin
 insert into auth.users(id,email) values(ad,'ad@t'),(mg,'mg@t'),(ch,'ch@t'),(a1,'a1@t'),(a2,'a2@t'),(pc,'pc@t'),(cc,'cc@t'),(pr,'pr@t');
 update profiles set role='admin',active=true where id=ad;update profiles set role='qa_qc_manager',active=true where id=mg;update profiles set role='qc_checker',active=true where id=ch;
 update profiles set role='qc_assistant',active=true where id in(a1,a2);update profiles set role='customer',active=true where id in(pc,cc);update profiles set role='production',active=true where id=pr;
 select id into pl from departments where code='PLASTIC';select id into pid from processes where name='CCM CLOSURE';select id into m3 from machines where name='CCM 03';select id into m1 from machines where name='CCM 01';
 select id into pep from customers where name='Pepsi';select id into coke from customers where name='Coca-Cola';
 insert into customer_department_access(customer_id,department_id) values(pep,pl),(coke,pl);insert into customer_users(user_id,customer_id) values(pc,pep),(cc,coke);
 assert (select count(*) from inspections)=0,'no fake inspections';
 -- assistant creates
 perform set_config('request.jwt.claim.sub',a1::text,true);set local role authenticated;
 insert into inspections(report_id,status,department_id,process_id,machine_id,customer_id,product,batch,qc_assistant_id,qc_checker_id,qa_manager_id) values('HACK','APPROVED',pl,pid,m3,pep,'Cap','B-77',a1,ch,mg) returning id,report_id into iid,rid;
 assert rid ~ '^QCR-[0-9]{4}-[0-9]{6}$','report id generated, client value ignored';assert (select status from inspections where id=iid)='DRAFT','starts as DRAFT';
 insert into inspections(department_id,process_id,machine_id,customer_id,product,batch,qc_assistant_id,qc_checker_id,qa_manager_id) values(pl,pid,m3,coke,'Cap','B-77',a1,ch,mg) returning report_id into rid2;assert rid2<>rid,'unique ids';
 begin insert into inspections(department_id,process_id,machine_id,customer_id,product,batch,qc_assistant_id,qc_checker_id,qa_manager_id) values(pl,pid,m3,(select id from customers where name='Dew'),'Cap','B',a1,ch,mg);assert false,'X1';exception when others then assert sqlerrm like 'Customer is not authorized%',sqlerrm;end;
 begin insert into inspections(department_id,process_id,machine_id,customer_id,product,batch,qc_assistant_id,qc_checker_id,qa_manager_id) values(pl,pid,m3,pep,'Cap','B',a1,a2,mg);assert false,'X2';exception when others then assert sqlerrm like 'QC Checker must be%',sqlerrm;end;
 begin insert into inspections(department_id,process_id,machine_id,customer_id,product,batch,qc_assistant_id,qc_checker_id,qa_manager_id) values((select id from departments where code='CROWN'),pid,m3,pep,'Cap','B',a1,ch,mg);assert false,'X3';exception when others then assert sqlerrm like 'Invalid department%',sqlerrm;end;
 begin insert into inspections(department_id,process_id,machine_id,customer_id,product,batch,qc_assistant_id,qc_checker_id,qa_manager_id) values(pl,pid,m3,pep,'Cap','  ',a1,ch,mg);assert false,'X4';exception when check_violation then null;end;
 -- workflow
 begin update inspections set status='PASS' where id=iid;assert false,'X5';exception when others then assert sqlerrm like 'Role qc_assistant may not change status%',sqlerrm;end;
 update inspections set status='INSPECTION_PENDING',product='Cap B' where id=iid;
 reset role;perform set_config('request.jwt.claim.sub',a2::text,true);set local role authenticated;
 assert (select count(*) from inspections)=0,'other assistant sees nothing';update inspections set product='x' where id=iid;get diagnostics n=row_count;assert n=0,'other assistant cannot edit';
 reset role;perform set_config('request.jwt.claim.sub',ch::text,true);set local role authenticated;
 assert (select count(*) from inspections)=2,'checker sees assigned';
 begin update inspections set status='APPROVED' where id=iid;assert false,'X6';exception when others then assert sqlerrm like 'Role qc_checker may not change status%',sqlerrm;end;
 begin update inspections set batch='ZZ' where id=iid;assert false,'X7';exception when others then assert sqlerrm like 'Role may not change inspection details%',sqlerrm;end;
 update inspections set status='PASS',general_remarks='ok' where id=iid;
 reset role;perform set_config('request.jwt.claim.sub',a1::text,true);set local role authenticated;
 begin update inspections set status='INSPECTION_PENDING' where id=iid;assert false,'X8';exception when others then assert sqlerrm like 'Role qc_assistant may not change status%',sqlerrm;end;
 reset role;perform set_config('request.jwt.claim.sub',mg::text,true);set local role authenticated;
 assert (select count(*) from inspections)=2,'manager sees all';update inspections set status='APPROVED' where id=iid;
 begin update inspections set product='Y' where id=iid;assert false,'X9';exception when others then assert sqlerrm like 'Approved reports are locked%',sqlerrm;end;
 begin delete from inspections where id=iid;assert false,'X10';exception when others then null;end;
 reset role;
 -- audit trail
 assert exists(select 1 from audit_logs where action='report_created' and entity_id=rid),'created audited';assert exists(select 1 from audit_logs where action='status_changed' and entity_id=rid),'status audited';
 assert exists(select 1 from audit_logs where action='checker_review' and entity_id=rid),'checker review audited';assert exists(select 1 from audit_logs where action='manager_approval' and entity_id=rid),'approval audited';assert exists(select 1 from audit_logs where action='report_updated' and entity_id=rid),'update audited';
 -- admin approves the Coke report
 perform set_config('request.jwt.claim.sub',ad::text,true);set local role authenticated;update inspections set status='APPROVED' where report_id=rid2;
 delete from inspections where report_id=rid2;get diagnostics n=row_count;assert n=0,'approved cannot be deleted';reset role;
 -- customers: no table access; portal functions isolate by authenticated customer
 perform set_config('request.jwt.claim.sub',pc::text,true);set local role authenticated;
 assert (select count(*) from inspections)=0,'customer sees no inspections table';assert (select count(*) from audit_logs)=0,'customer no audit';
 assert (select count(*) from customer_reports())=1 and (select product from customer_reports())='Cap B','pepsi sees only own approved';
 assert (select count(*) from customer_reports(null,null,rid2))=0,'pepsi cannot search by coke report id';assert (select count(*) from customer_report_detail(rid2))=0,'pepsi cannot open coke report';assert (select count(*) from customer_report_detail(rid))=1,'pepsi opens own';
 assert (select count(*) from customer_reports(null,null,null,'B-77'))=1,'same batch label still isolated';assert (select count(*) from customer_reports(current_date+1,current_date+2))=0,'date filter';
 assert (select count(*) from customer_report_filters())=1,'filters only own';assert my_customer_name()='Pepsi','name';
 assert (select count(*) from customer_current())=0,'pepsi has no active material';
 begin update inspections set status='DRAFT';assert false,'X11';exception when others then null;end;
 begin insert into inspections(department_id,machine_id,customer_id,product,batch,qc_assistant_id,qc_checker_id,qa_manager_id) values(pl,m3,pep,'a','b',a1,ch,mg);assert false,'X12';exception when others then assert sqlerrm not like 'X12',sqlerrm;end;
 reset role;
 -- Coke active on CCM 01 (job context) -> CURRENT works; Pepsi unaffected; REPORTS independent of CURRENT
 perform set_config('request.jwt.claim.sub',ch::text,true);set local role authenticated;insert into qc_updates(machine_id,status,remark,customer_id,product,batch) values(m1,'RUNNING','Coke running',coke,'Cap','C-1');reset role;
 perform set_config('request.jwt.claim.sub',cc::text,true);set local role authenticated;assert (select count(*) from customer_current())=1,'coke active';assert (select count(*) from customer_reports())=1,'coke reports';reset role;
 perform set_config('request.jwt.claim.sub',pc::text,true);set local role authenticated;assert (select count(*) from customer_current())=0,'pepsi still none';assert (select count(*) from customer_reports())=1,'pepsi reports available without current';reset role;
 perform set_config('request.jwt.claim.sub',pr::text,true);set local role authenticated;assert (select count(*) from inspections)=0,'production sees none';reset role;
 raise notice 'PHASE 4 TESTS PASSED';
end$$;
rollback;
