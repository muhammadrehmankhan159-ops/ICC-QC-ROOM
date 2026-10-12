-- Admin access reset for ICC QC ROOM
-- This keeps customer restrictions intact while removing the custom blockers that were preventing
-- the owner/admin account from reaching the dashboard and management pages.

-- Profiles: allow owner/admin and staff to read their account and internal data without blocking on stale active flags.
drop policy if exists profiles_customer_read_own_only on profiles;
drop policy if exists profiles_customer_self_update on profiles;

create policy profiles_owner_admin_read on profiles
for select
using (id = auth.uid() or is_admin() or is_qc_staff());

create policy profiles_owner_admin_update on profiles
for update
using (is_admin() or id = auth.uid())
with check (is_admin() or id = auth.uid());

-- Latest news: allow owner/admin and QC staff to read it while customers remain blocked.
drop policy if exists latest_news_block_customer on latest_news;
drop policy if exists latest_news_qc_read on latest_news;

create policy latest_news_owner_admin_qc_read on latest_news
for select
using (is_admin() or is_qc_staff());

-- Keep customer data in place and do not create or alter any live production user ownership.
-- This reset is intended to restore legitimate access for the existing owner/admin account.
