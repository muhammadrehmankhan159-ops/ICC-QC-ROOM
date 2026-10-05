-- PHASE 3: department pages data support. Structure (processes/machines) was seeded in 002 and is verified by tests/phase3_test.sql.
-- Future-ready job context on a machine: Customer -> Product/Material -> Batch (recorded with QC updates; no QC report system yet).
alter table qc_updates add column customer_id uuid references customers,add column product text,add column batch text;
alter table machine_current_status add column customer_id uuid references customers,add column product text,add column batch text;

create or replace function before_update_insert() returns trigger language plpgsql security definer set search_path=public as $$
declare dep uuid;begin
 new.created_at:=now();new.posted_by:=auth.uid();new.remark:=btrim(new.remark);new.product:=nullif(btrim(new.product),'');new.batch:=nullif(btrim(new.batch),'');
 select department_id into dep from machines where id=new.machine_id and active;
 if dep is null then raise exception 'machine is not active';end if;
 if new.customer_id is not null and not exists(select 1 from customer_department_access a join customers c on c.id=a.customer_id where a.customer_id=new.customer_id and a.department_id=dep and a.active and c.active) then
  raise exception 'customer is not authorized for this department';end if;
 return new;end$$;
create or replace function after_update_insert() returns trigger language plpgsql security definer set search_path=public as $$begin
 insert into machine_current_status(machine_id,status,update_id,updated_at,customer_id,product,batch) values(new.machine_id,new.status,new.id,new.created_at,new.customer_id,new.product,new.batch)
 on conflict(machine_id) do update set status=excluded.status,update_id=excluded.update_id,updated_at=excluded.updated_at,customer_id=excluded.customer_id,product=excluded.product,batch=excluded.batch;
 insert into audit_logs(user_id,action,entity_type,entity_id,details) values(new.posted_by,'machine_status_update','machine',new.machine_id::text,jsonb_build_object('status',new.status,'update_id',new.id));
 return new;end$$;

create function audit_machines() returns trigger language plpgsql security definer set search_path=public as $$begin
 insert into audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),case tg_op when 'INSERT' then 'machine_created' else 'machine_updated' end,'machine',new.id::text,jsonb_build_object('name',new.name,'department_id',new.department_id,'process_id',new.process_id,'active',new.active));
 return new;end$$;
create trigger t_aud_machines after insert or update on machines for each row execute function audit_machines();
-- Machines/processes are writable by Admin only (policies mach_admin / proc_admin from 002); customers have no access to either table.
