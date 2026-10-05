-- PHASE 4: QC inspection & report foundation + customer portal (current vs reports). NO QC parameters / specs / limits / PDF.
create type insp_status as enum ('DRAFT','INSPECTION_PENDING','PASS','HOLD','REJECT','RE_TEST','APPROVED');
create sequence inspection_report_seq;
create table inspections(
 id uuid primary key default gen_random_uuid(),
 report_id text not null unique,
 department_id uuid not null references departments,
 process_id uuid references processes,
 machine_id uuid not null references machines,
 customer_id uuid not null references customers,
 product text not null check(btrim(product)<>''),
 batch text not null check(btrim(batch)<>''),
 inspection_date date not null default current_date,
 inspection_time time not null default localtime(0),
 status insp_status not null default 'DRAFT',
 qc_assistant_id uuid not null references profiles,
 qc_checker_id uuid not null references profiles,
 qa_manager_id uuid not null references profiles,
 general_remarks text,
 created_by uuid not null default auth.uid() references profiles,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now());
-- history / filter foundation: report id (unique), department, process, machine, customer, product, batch, status, date
create index insp_status_idx on inspections(status,inspection_date desc);
create index insp_customer_date_idx on inspections(customer_id,inspection_date desc);
create index insp_date_idx on inspections(inspection_date desc);
create index insp_where_idx on inspections(department_id,process_id,machine_id);
create index insp_batch_idx on inspections(lower(batch));create index insp_product_idx on inspections(lower(product));
create index insp_assignee_idx on inspections(qc_assistant_id,qc_checker_id,qa_manager_id);

-- workflow rules (mirrored in src/workflow.ts)
create function qc_transition_ok(r app_role,uid uuid,o inspections,to_s insp_status) returns boolean language sql immutable as $$
 select case r
  when 'admin' then true
  when 'qc_assistant' then uid=o.qc_assistant_id and ((o.status='DRAFT' and to_s='INSPECTION_PENDING') or (o.status='INSPECTION_PENDING' and to_s='DRAFT') or (o.status in('HOLD','RE_TEST') and to_s='INSPECTION_PENDING'))
  when 'qc_checker' then uid=o.qc_checker_id and o.status in('INSPECTION_PENDING','HOLD','RE_TEST') and to_s in('PASS','HOLD','REJECT','RE_TEST')
  when 'qa_qc_manager' then (uid=o.qa_manager_id and o.status='PASS' and to_s='APPROVED') or (o.status in('PASS','HOLD','REJECT','RE_TEST') and to_s='INSPECTION_PENDING')
  else false end $$;

create function inspections_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare r app_role:=my_role();uid uuid:=auth.uid();mdep uuid;mproc uuid;mact boolean;
begin
 new.product:=btrim(new.product);new.batch:=btrim(new.batch);new.general_remarks:=nullif(btrim(new.general_remarks),'');
 if (select role from profiles where id=new.qc_assistant_id and active) is distinct from 'qc_assistant' then raise exception 'QC Assistant must be an active QC Assistant';end if;
 if (select role from profiles where id=new.qc_checker_id and active) is distinct from 'qc_checker' then raise exception 'QC Checker must be an active QC Checker';end if;
 if (select role from profiles where id=new.qa_manager_id and active) is distinct from 'qa_qc_manager' then raise exception 'QA/QC Manager must be an active QA/QC Manager';end if;
 select department_id,process_id,active into mdep,mproc,mact from machines where id=new.machine_id;
 if mdep is distinct from new.department_id or mproc is distinct from new.process_id then raise exception 'Invalid department / process / machine combination';end if;
 if tg_op='INSERT' or new.machine_id<>old.machine_id then if not mact then raise exception 'Machine is not active';end if;end if;
 if not exists(select 1 from customer_department_access a join customers c on c.id=a.customer_id where a.customer_id=new.customer_id and a.department_id=new.department_id and a.active and c.active) then raise exception 'Customer is not authorized for this department';end if;
 if tg_op='INSERT' then
  if uid is not null and r not in('admin','qa_qc_manager','qc_assistant') then raise exception 'Role may not create inspections';end if;
  new.report_id:='QCR-'||to_char(now(),'YYYY')||'-'||lpad(nextval('inspection_report_seq')::text,6,'0');
  new.status:='DRAFT';new.created_by:=uid;new.created_at:=now();new.updated_at:=now();return new;
 end if;
 new.report_id:=old.report_id;new.created_by:=old.created_by;new.created_at:=old.created_at;new.updated_at:=now();
 if uid is not null and r<>'admin' then
  if old.status='APPROVED' then raise exception 'Approved reports are locked';end if;
  if (new.department_id,new.process_id,new.machine_id,new.customer_id,new.qc_assistant_id,new.qc_checker_id,new.qa_manager_id) is distinct from (old.department_id,old.process_id,old.machine_id,old.customer_id,old.qc_assistant_id,old.qc_checker_id,old.qa_manager_id) and r<>'qa_qc_manager' then
   raise exception 'Only Admin / QA-QC Manager may change machine, customer or assignments';end if;
  if (new.product,new.batch,new.inspection_date,new.inspection_time) is distinct from (old.product,old.batch,old.inspection_date,old.inspection_time) and not (r='qa_qc_manager' or (r='qc_assistant' and uid=old.qc_assistant_id and old.status in('DRAFT','INSPECTION_PENDING','HOLD','RE_TEST'))) then
   raise exception 'Role may not change inspection details at this stage';end if;
  if new.general_remarks is distinct from old.general_remarks and not (r='qa_qc_manager' or (r='qc_assistant' and uid=old.qc_assistant_id and old.status in('DRAFT','INSPECTION_PENDING','HOLD','RE_TEST')) or (r='qc_checker' and uid=old.qc_checker_id)) then
   raise exception 'Role may not change remarks at this stage';end if;
  if new.status<>old.status and not qc_transition_ok(r,uid,old,new.status) then raise exception 'Role % may not change status % -> %',r,old.status,new.status;end if;
 end if;
 return new;end$$;
create trigger t_insp_guard before insert or update on inspections for each row execute function inspections_guard();

create function inspections_audit() returns trigger language plpgsql security definer set search_path=public as $$
declare r app_role:=my_role();ch text[];
begin
 if tg_op='INSERT' then insert into audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'report_created','inspection',new.report_id,jsonb_build_object('inspection_id',new.id,'status',new.status));return new;end if;
 ch:=array(select n.key from jsonb_each(to_jsonb(new)) n where to_jsonb(old)->n.key is distinct from n.value and n.key not in('updated_at','status'));
 if cardinality(ch)>0 then insert into audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'report_updated','inspection',new.report_id,jsonb_build_object('changed_fields',ch));end if;
 if new.status<>old.status then
  insert into audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'status_changed','inspection',new.report_id,jsonb_build_object('from',old.status,'to',new.status));
  if r='qc_checker' and new.status in('PASS','HOLD','REJECT','RE_TEST') then insert into audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'checker_review','inspection',new.report_id,jsonb_build_object('result',new.status));end if;
  if new.status='APPROVED' then insert into audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'manager_approval','inspection',new.report_id,jsonb_build_object('approved',true));end if;
 end if;return new;end$$;
create trigger t_insp_audit after insert or update on inspections for each row execute function inspections_audit();

alter table inspections enable row level security;
-- Admin + QA/QC Manager: all reports. Checker / Assistant: only reports assigned to them (assistant also own-created). Production, Customer: no direct access.
create policy insp_select on inspections for select using(my_role() in('admin','qa_qc_manager') or (my_role()='qc_assistant' and (qc_assistant_id=auth.uid() or created_by=auth.uid())) or (my_role()='qc_checker' and qc_checker_id=auth.uid()));
create policy insp_insert on inspections for insert with check(my_role() in('admin','qa_qc_manager','qc_assistant'));
create policy insp_update on inspections for update using(my_role() in('admin','qa_qc_manager') or (my_role()='qc_assistant' and (qc_assistant_id=auth.uid() or created_by=auth.uid())) or (my_role()='qc_checker' and qc_checker_id=auth.uid()))
 with check(my_role() in('admin','qa_qc_manager') or (my_role()='qc_assistant' and (qc_assistant_id=auth.uid() or created_by=auth.uid())) or (my_role()='qc_checker' and qc_checker_id=auth.uid()));
create policy insp_delete on inspections for delete using(is_admin() and status='DRAFT');
revoke all on inspections from anon;

-- Customer portal. Identity comes ONLY from auth.uid() -> customer_users. No customer id is ever accepted from the client.
create function my_customer_name() returns text language sql stable security definer set search_path=public as $$select c.name from customers c where c.id in(select my_customers()) order by c.name limit 1$$;
-- CURRENT: the customer's active job on a machine (job context set by the latest QC update). Independent from REPORTS.
create function customer_current() returns table(department text,process text,machine text,status machine_status,product text,batch text,remark text,updated_at timestamptz)
language sql stable security definer set search_path=public as $$
 select d.name,p.name,m.name,s.status,s.product,s.batch,u.remark,s.updated_at from machine_current_status s join machines m on m.id=s.machine_id and m.active join departments d on d.id=m.department_id left join processes p on p.id=m.process_id left join qc_updates u on u.id=s.update_id
 where s.customer_id in(select my_customers()) and exists(select 1 from customer_department_access a where a.customer_id=s.customer_id and a.department_id=m.department_id and a.active) order by d.name,m.name$$;
-- REPORTS: only the customer's own APPROVED reports in departments explicitly granted to them. No internal remarks/assignees/audit exposed.
create function customer_reports(p_from date default null,p_to date default null,p_report text default null,p_batch text default null,p_dept text default null,p_process text default null,p_machine text default null)
returns table(report_id text,department text,process text,machine text,product text,batch text,inspection_date date,inspection_time time,status insp_status)
language sql stable security definer set search_path=public as $$
 select i.report_id,d.name,p.name,m.name,i.product,i.batch,i.inspection_date,i.inspection_time,i.status from inspections i join departments d on d.id=i.department_id join machines m on m.id=i.machine_id left join processes p on p.id=i.process_id
 where i.customer_id in(select my_customers()) and i.status='APPROVED'
 and exists(select 1 from customer_department_access a where a.customer_id=i.customer_id and a.department_id=i.department_id and a.active)
 and (p_from is null or i.inspection_date>=p_from) and (p_to is null or i.inspection_date<=p_to)
 and (nullif(btrim(p_report),'') is null or i.report_id ilike '%'||btrim(p_report)||'%') and (nullif(btrim(p_batch),'') is null or i.batch ilike '%'||btrim(p_batch)||'%')
 and (nullif(p_dept,'') is null or d.name=p_dept) and (nullif(p_process,'') is null or p.name=p_process) and (nullif(p_machine,'') is null or m.name=p_machine)
 order by i.inspection_date desc,i.inspection_time desc,i.report_id desc limit 500$$;
create function customer_report_detail(p_report text)
returns table(report_id text,customer text,department text,process text,machine text,product text,batch text,inspection_date date,inspection_time time,status insp_status)
language sql stable security definer set search_path=public as $$
 select i.report_id,c.name,d.name,p.name,m.name,i.product,i.batch,i.inspection_date,i.inspection_time,i.status from inspections i join customers c on c.id=i.customer_id join departments d on d.id=i.department_id join machines m on m.id=i.machine_id left join processes p on p.id=i.process_id
 where i.report_id=p_report and i.customer_id in(select my_customers()) and i.status='APPROVED'
 and exists(select 1 from customer_department_access a where a.customer_id=i.customer_id and a.department_id=i.department_id and a.active)$$;
-- filter dropdown values: only departments / processes / machines that appear in the customer's own reports
create function customer_report_filters() returns table(department text,process text,machine text)
language sql stable security definer set search_path=public as $$
 select distinct d.name,p.name,m.name from inspections i join departments d on d.id=i.department_id join machines m on m.id=i.machine_id left join processes p on p.id=i.process_id
 where i.customer_id in(select my_customers()) and i.status='APPROVED' and exists(select 1 from customer_department_access a where a.customer_id=i.customer_id and a.department_id=i.department_id and a.active)$$;
revoke execute on function my_customer_name,customer_current,customer_reports,customer_report_detail,customer_report_filters from public,anon;
grant execute on function my_customer_name,customer_current,customer_reports,customer_report_detail,customer_report_filters to authenticated;
