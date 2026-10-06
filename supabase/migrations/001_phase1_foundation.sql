-- PHASE 1: foundation, authentication, roles, departments, customers, security
create type app_role as enum ('admin','qa_qc_manager','qc_checker','qc_assistant','production','customer');

create table profiles(id uuid primary key references auth.users on delete cascade,full_name text,email text,role app_role not null default 'customer',active boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table departments(id uuid primary key default gen_random_uuid(),name text not null unique,code text not null unique,active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table customers(id uuid primary key default gen_random_uuid(),name text not null unique,code text not null unique,active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table customer_department_access(id uuid primary key default gen_random_uuid(),customer_id uuid not null references customers on delete cascade,department_id uuid not null references departments on delete cascade,active boolean not null default true,created_at timestamptz not null default now(),unique(customer_id,department_id));
create table customer_users(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,customer_id uuid not null references customers on delete cascade,active boolean not null default true,created_at timestamptz not null default now(),unique(user_id,customer_id));
create unique index one_customer_per_user on customer_users(user_id) where active;
create table audit_logs(id uuid primary key default gen_random_uuid(),user_id uuid,action text not null,entity_type text,entity_id text,details jsonb,created_at timestamptz not null default now());
create index on audit_logs(created_at desc);create index on audit_logs(entity_type,entity_id);

create function my_role() returns app_role language sql stable security definer set search_path=public as $$select role from profiles where id=auth.uid() and active$$;
create function is_admin() returns boolean language sql stable security definer set search_path=public as $$select coalesce(my_role()='admin',false)$$;
create function is_qc_staff() returns boolean language sql stable security definer set search_path=public as $$select coalesce(my_role() in('admin','qa_qc_manager','qc_checker','qc_assistant'),false)$$;
create function my_customers() returns setof uuid language sql stable security definer set search_path=public as $$select cu.customer_id from customer_users cu join customers c on c.id=cu.customer_id where cu.user_id=auth.uid() and cu.active and c.active and exists(select 1 from profiles p where p.id=auth.uid() and p.active and p.role='customer')$$;

create function on_signup() returns trigger language plpgsql security definer set search_path=public as $$
declare requested text; 
begin
 requested:=lower(coalesce(new.raw_user_meta_data->>'requested_role', new.raw_user_meta_data->>'role', 'customer'));
 if requested in ('owner','owner_admin','owner-admin','admin') then
  if exists(select 1 from profiles where role='admin') then
   raise exception 'An owner/admin account already exists. Sign in with the current owner/admin account instead.';
  end if;
  insert into profiles(id,email,full_name,role,active)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.email),'admin',true)
  on conflict (id) do update set email=excluded.email, full_name=excluded.full_name, role='admin', active=true;
  return new;
 end if;
 insert into profiles(id,email,full_name,role,active)
 values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.email),'customer',false)
 on conflict (id) do update set email=excluded.email, full_name=excluded.full_name, role='customer', active=false;
 return new;
end$$;
create trigger t_signup after insert on auth.users for each row execute function on_signup();
create function touch() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
create trigger t_touch_p before update on profiles for each row execute function touch();
create trigger t_touch_d before update on departments for each row execute function touch();
create trigger t_touch_c before update on customers for each row execute function touch();
create function protect_profile() returns trigger language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is not null and not is_admin() and (new.role<>old.role or new.active<>old.active or new.id<>old.id or new.email is distinct from old.email) then raise exception 'access denied: only Admin may change role, status or email';end if;return new;end$$;
create trigger t_protect before update on profiles for each row execute function protect_profile();
create function audit_generic() returns trigger language plpgsql security definer set search_path=public as $$begin
 if tg_table_name='profiles' then
  if new.role<>old.role then insert into audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'role_changed','profile',new.id::text,jsonb_build_object('from',old.role,'to',new.role));end if;
  if new.active<>old.active then insert into audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'user_active_changed','profile',new.id::text,jsonb_build_object('active',new.active));end if;
 else insert into audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'customer_access_'||lower(tg_op),tg_table_name,coalesce(new.id,old.id)::text,to_jsonb(coalesce(new,old)));end if;
 return coalesce(new,old);end$$;
create trigger t_aud_p after update on profiles for each row execute function audit_generic();
create trigger t_aud_cu after insert or update or delete on customer_users for each row execute function audit_generic();
create trigger t_aud_cda after insert or update or delete on customer_department_access for each row execute function audit_generic();
create function log_login() returns void language sql security definer set search_path=public as $$insert into audit_logs(user_id,action,entity_type,entity_id) select auth.uid(),'login','profile',auth.uid()::text where auth.uid() is not null$$;
revoke execute on function log_login from public,anon;grant execute on function log_login to authenticated;

alter table profiles enable row level security;alter table departments enable row level security;alter table customers enable row level security;
alter table customer_department_access enable row level security;alter table customer_users enable row level security;alter table audit_logs enable row level security;
create policy profiles_self on profiles for select using(id=auth.uid());
create policy profiles_staff on profiles for select using(is_qc_staff());
create policy profiles_admin on profiles for all using(is_admin()) with check(is_admin());
create policy profiles_self_upd on profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy dept_staff on departments for select using(is_qc_staff());
create policy dept_customer on departments for select using(exists(select 1 from customer_department_access a where a.department_id=departments.id and a.active and a.customer_id in(select my_customers())));
create policy dept_admin on departments for all using(is_admin()) with check(is_admin());
create policy cust_staff on customers for select using(is_qc_staff());
create policy cust_own on customers for select using(id in(select my_customers()));
create policy cust_admin on customers for all using(is_admin()) with check(is_admin());
create policy cda_staff on customer_department_access for select using(is_qc_staff());
create policy cda_own on customer_department_access for select using(customer_id in(select my_customers()));
create policy cda_admin on customer_department_access for all using(is_admin()) with check(is_admin());
create policy cu_self on customer_users for select using(user_id=auth.uid());
create policy cu_staff on customer_users for select using(is_qc_staff());
create policy cu_admin on customer_users for all using(is_admin()) with check(is_admin());
create policy audit_read on audit_logs for select using(my_role() in('admin','qa_qc_manager'));
revoke insert,update,delete on audit_logs from authenticated,anon;
revoke all on all tables in schema public from anon;

insert into departments(name,code) values('PLASTIC','PLASTIC'),('CROWN','CROWN'),('INJECTION MOULDING','INJECTION_MOULDING');
insert into customers(name,code) values('Pepsi','PEPSI'),('Coca-Cola','COCA_COLA'),('Dew','DEW'),('7up','7UP'),('Slice','SLICE'),('Unknown','UNKNOWN'),('Nextcola','NEXTCOLA');
