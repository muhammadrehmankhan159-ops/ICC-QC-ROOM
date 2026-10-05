-- PHASE 2: QC Control Room (processes, machines, QC updates, current machine status)
create type machine_status as enum ('RUNNING','HOLD','STOPPED');
create table processes(id uuid primary key default gen_random_uuid(),department_id uuid not null references departments,name text not null,sort int not null default 0,active boolean not null default true,created_at timestamptz not null default now(),unique(department_id,name));
create table machines(id uuid primary key default gen_random_uuid(),department_id uuid not null references departments,process_id uuid references processes,name text not null check(btrim(name)<>''),active boolean not null default true,created_at timestamptz not null default now());
create unique index machines_unique_name on machines(department_id,coalesce(process_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(name));
create index on machines(department_id);
create table qc_updates(id uuid primary key default gen_random_uuid(),machine_id uuid not null references machines,status machine_status not null,remark text not null check(btrim(remark)<>''),posted_by uuid not null default auth.uid() references profiles,created_at timestamptz not null default now());
create index on qc_updates(created_at desc);create index on qc_updates(machine_id,created_at desc);
create table machine_current_status(machine_id uuid primary key references machines on delete cascade,status machine_status not null,update_id uuid references qc_updates,updated_at timestamptz not null default now());

create function check_machine() returns trigger language plpgsql as $$begin
 if new.process_id is not null and not exists(select 1 from processes where id=new.process_id and department_id=new.department_id) then raise exception 'process does not belong to the department';end if;
 new.name=btrim(new.name);return new;end$$;
create trigger t_machine before insert or update on machines for each row execute function check_machine();
-- posting user and time are always set by the server; clients cannot choose them
create function before_update_insert() returns trigger language plpgsql security definer set search_path=public as $$begin
 new.created_at:=now();new.posted_by:=auth.uid();new.remark:=btrim(new.remark);
 if not exists(select 1 from machines where id=new.machine_id and active) then raise exception 'machine is not active';end if;return new;end$$;
create trigger t_qcu_before before insert on qc_updates for each row execute function before_update_insert();
create function after_update_insert() returns trigger language plpgsql security definer set search_path=public as $$begin
 insert into machine_current_status(machine_id,status,update_id,updated_at) values(new.machine_id,new.status,new.id,new.created_at)
 on conflict(machine_id) do update set status=excluded.status,update_id=excluded.update_id,updated_at=excluded.updated_at;
 insert into audit_logs(user_id,action,entity_type,entity_id,details) values(new.posted_by,'machine_status_update','machine',new.machine_id::text,jsonb_build_object('status',new.status,'update_id',new.id));
 return new;end$$;
create trigger t_qcu_after after insert on qc_updates for each row execute function after_update_insert();

alter table processes enable row level security;alter table machines enable row level security;alter table qc_updates enable row level security;alter table machine_current_status enable row level security;
create policy proc_staff on processes for select using(is_qc_staff());
create policy proc_admin on processes for all using(is_admin()) with check(is_admin());
create policy mach_staff on machines for select using(is_qc_staff());
create policy mach_admin on machines for all using(is_admin()) with check(is_admin());
create policy qcu_staff on qc_updates for select using(is_qc_staff());
create policy qcu_insert on qc_updates for insert with check(is_qc_staff() and posted_by=auth.uid());
create policy mcs_staff on machine_current_status for select using(is_qc_staff());
revoke update,delete on qc_updates from authenticated,anon;
revoke insert,update,delete on machine_current_status from authenticated,anon;
revoke all on processes,machines,qc_updates,machine_current_status from anon;
do $$begin alter publication supabase_realtime add table qc_updates,machine_current_status;exception when others then null;end$$;

-- master data only (machine list from the specification). No status, updates or QC records.
insert into processes(department_id,name,sort) select d.id,v.n,v.s from departments d join (values
 ('PLASTIC','CCM CLOSURE',1),('PLASTIC','SLITTING',2),('PLASTIC','PRINTING',3),('CROWN','TPR',1),('CROWN','PRESS',2),('CROWN','PMC',3)) v(dc,n,s) on v.dc=d.code;
insert into machines(department_id,process_id,name) select p.department_id,p.id,v.m from processes p join (values
 ('CCM CLOSURE','CCM 01'),('CCM CLOSURE','CCM 02'),('CCM CLOSURE','CCM 03'),('CCM CLOSURE','CCM 04'),('CCM CLOSURE','CCM 05'),('CCM CLOSURE','CCM 06'),('CCM CLOSURE','CCM 07'),('CCM CLOSURE','CCM 08'),
 ('SLITTING','SCM 01'),('SLITTING','SFM 01'),('SLITTING','SFM 02'),('SLITTING','SFM 03'),('SLITTING','PMV 02'),
 ('PRINTING','PRINTING 01'),('PRINTING','PRINTING 02'),('PRINTING','PRINTING 03'),
 ('TPR','COATING SECTION'),('TPR','PRINTING SECTION'),('PRESS','PRESS 01'),('PRESS','PRESS 02'),('PRESS','PRESS 03'),('PMC','PMC 01'),('PMC','PMC 02')) v(pn,m) on v.pn=p.name;
insert into machines(department_id,name) select d.id,v.m from departments d,(values('IMM 01'),('IMM 02'),('IMM 03'),('IMM 04')) v(m) where d.code='INJECTION_MOULDING';
