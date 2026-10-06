-- CUSTOMER LOGIN ACTIVITY + SECURE OWNER/ADMIN SIGNUP GUARD
create table if not exists customer_login_activity(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references profiles on delete cascade,
 email text,
 customer_name text,
 action text not null check (action in ('login','portal_access')),
 created_at timestamptz not null default now());

create index if not exists customer_login_activity_user_idx on customer_login_activity(user_id, created_at desc);
create index if not exists customer_login_activity_action_idx on customer_login_activity(action, created_at desc);

alter table customer_login_activity enable row level security;
create policy customer_login_activity_self on customer_login_activity for select using(user_id=auth.uid());
create policy customer_login_activity_admin on customer_login_activity for select using(is_admin());

revoke all on customer_login_activity from anon;
revoke all on customer_login_activity from authenticated;

create or replace function log_customer_login_activity(p_action text default 'login') returns void
language plpgsql security definer set search_path=public as $$
declare
 v_action text := lower(coalesce(nullif(btrim(p_action),''),'login'));
 v_email text;
 v_name text;
 v_customer text;
begin
 if auth.uid() is null then
  return;
 end if;
 select email, full_name into v_email, v_name from profiles where id=auth.uid();
 select c.name into v_customer from customers c join customer_users cu on cu.customer_id=c.id where cu.user_id=auth.uid() and cu.active and c.active limit 1;
 insert into customer_login_activity(user_id,email,customer_name,action)
 values(auth.uid(), v_email, coalesce(v_customer, v_name, 'Unknown'), v_action);
end$$;

revoke execute on function log_customer_login_activity from public, anon;
grant execute on function log_customer_login_activity to authenticated;

create or replace function on_signup() returns trigger language plpgsql security definer set search_path=public as $$
declare requested text;
begin
 requested := lower(coalesce(new.raw_user_meta_data->>'requested_role', new.raw_user_meta_data->>'role', 'customer'));
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

create or replace trigger t_signup after insert on auth.users for each row execute function on_signup();
