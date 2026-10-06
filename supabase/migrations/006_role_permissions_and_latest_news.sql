-- ROLE AND PERMISSION HARDENING + LATEST NEWS
-- This migration keeps the project’s existing names and roles while enforcing the requested owner/QC/customer access model.
-- Admin == Owner in this app.

create or replace function is_owner() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(my_role() = 'admin', false)
$$;

create or replace function is_qc_manager() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(my_role() = 'qa_qc_manager', false)
$$;

create or replace function is_qc_assistant() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(my_role() = 'qc_assistant', false)
$$;

create or replace function can_view_latest_news() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select my_role() in ('admin','qa_qc_manager','qc_checker','qc_assistant')
$$;

create or replace function can_manage_latest_news() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select my_role() = 'admin'
$$;

create or replace function can_manage_users() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select my_role() = 'admin'
$$;

create or replace function can_manage_permissions() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select my_role() = 'admin'
$$;

create table if not exists latest_news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  summary text,
  content text not null check (btrim(content) <> ''),
  published boolean not null default true,
  created_by uuid not null references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function touch_latest_news()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists t_touch_latest_news on latest_news;
create trigger t_touch_latest_news before update on latest_news
for each row execute function touch_latest_news();

alter table latest_news enable row level security;

revoke all on latest_news from anon;
revoke all on latest_news from authenticated;

create policy latest_news_owner_all on latest_news
for all
using (can_manage_latest_news())
with check (can_manage_latest_news());

create policy latest_news_qc_read on latest_news
for select
using (can_view_latest_news());

-- Customers must not see admin-only internal/latest news by default.
create policy latest_news_block_customer on latest_news
for select
using (false);

-- Ensure customers never gain write access via broader table policies.
create policy latest_news_customer_block_insert on latest_news
for insert
with check (false);
create policy latest_news_customer_block_update on latest_news
for update
using (false)
with check (false);
create policy latest_news_customer_block_delete on latest_news
for delete
using (false);

-- Explicitly block auth users with no QC/admin role from reading dashboards, reports, or admin data via API access.
create policy profiles_customer_read_own_only on profiles
for select
using (id = auth.uid() or is_qc_staff());

-- Keep customer write access limited to their own profile and nowhere else.
create policy profiles_customer_self_update on profiles
for update
using (id = auth.uid())
with check (id = auth.uid() and role = old.role and active = old.active);

-- Reassert that customer accounts have no direct admin or data manipulation rights.
create policy inspections_customer_no_write on inspections
for insert with check (false);
create policy inspections_customer_no_update on inspections
for update using (false) with check (false);
create policy inspections_customer_no_delete on inspections
for delete using (false);

-- Prevent customers from reading admin/security tables.
create policy audit_logs_customer_block on audit_logs
for select using (is_admin() or is_qc_manager() or is_qc_assistant() or is_qc_staff());

-- Keep app-role enforcement consistent for direct DB listing of departments and customer access.
create policy latest_news_readonly_for_qc on latest_news
for select using (can_view_latest_news())
with check (can_manage_latest_news());
