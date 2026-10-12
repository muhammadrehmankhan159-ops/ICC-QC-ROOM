create extension if not exists pgcrypto;

alter table customers add column if not exists customer_pin_hash text;
alter table customers add column if not exists customer_pin_updated_at timestamptz;

create unique index if not exists customers_active_pin_unique
  on customers (customer_pin_hash)
  where active and customer_pin_hash is not null;

create or replace function normalize_customer_pin(raw text)
returns text language sql immutable set search_path=public as $$
  select upper(trim(regexp_replace(coalesce(raw, ''), '\s+', '', 'g')));
$$;

revoke execute on function normalize_customer_pin from public, anon;
grant execute on function normalize_customer_pin to authenticated;

create or replace function set_customer_pin(p_customer_id uuid, p_pin text)
returns void language plpgsql security definer set search_path=public as $$
declare v_pin text; v_hash text;
begin
  if not is_admin() then
    raise exception 'Only the Owner/Admin may manage customer PINs';
  end if;

  v_pin := normalize_customer_pin(p_pin);
  if length(v_pin) < 4 then
    raise exception 'Customer PIN must be at least 4 characters';
  end if;

  v_hash := crypt(v_pin, gen_salt('bf', 8));

  if exists (
    select 1 from customers c
    where c.id <> p_customer_id
      and c.active
      and c.customer_pin_hash is not null
      and c.customer_pin_hash = crypt(v_pin, c.customer_pin_hash)
  ) then
    raise exception 'This Customer PIN is already assigned to another active customer';
  end if;

  update customers
  set customer_pin_hash = v_hash,
      customer_pin_updated_at = now(),
      updated_at = now()
  where id = p_customer_id;

  if not found then
    raise exception 'Customer not found';
  end if;
end $$;

revoke execute on function set_customer_pin from public, anon;
grant execute on function set_customer_pin to authenticated;

create or replace function customer_pin_auth(p_pin text)
returns table(customer_id uuid, customer_name text, customer_code text)
language sql stable security definer set search_path=public as $$
  select c.id as customer_id,
         c.name as customer_name,
         c.code as customer_code
  from customers c
  join customer_users cu on cu.customer_id = c.id and cu.active and cu.user_id = auth.uid()
  where c.active
    and c.customer_pin_hash is not null
    and c.customer_pin_hash = crypt(normalize_customer_pin(p_pin), c.customer_pin_hash)
  limit 1;
$$;

revoke execute on function customer_pin_auth from public, anon;
grant execute on function customer_pin_auth to authenticated;

create or replace function sync_customer_email_verification()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.email_confirmed_at is not null and coalesce(old.email_confirmed_at, '1900-01-01 00:00:00+00'::timestamptz) is distinct from new.email_confirmed_at then
    update profiles
    set active = true,
        updated_at = now()
    where id = new.id and role = 'customer';
  end if;
  return new;
end $$;

drop trigger if exists t_customer_email_verification on auth.users;
create trigger t_customer_email_verification
after update of email_confirmed_at on auth.users
for each row execute function sync_customer_email_verification();

create or replace function on_signup()
returns trigger language plpgsql security definer set search_path=public as $$
declare requested text;
begin
  requested := lower(coalesce(new.raw_user_meta_data->>'requested_role', new.raw_user_meta_data->>'role', 'customer'));

  if requested in ('owner','owner_admin','owner-admin','admin') then
    if exists(select 1 from profiles where role='admin') then
      raise exception 'An owner/admin account already exists. Sign in with the current owner/admin account instead.';
    end if;

    insert into profiles(id,email,full_name,role,active)
    values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.email),'admin',true)
    on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, role = 'admin', active = true;
    return new;
  end if;

  insert into profiles(id,email,full_name,role,active)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.email),'customer',true)
  on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, role = 'customer', active = true;
  return new;
end $$;

drop trigger if exists t_signup on auth.users;
create trigger t_signup after insert on auth.users for each row execute function on_signup();
