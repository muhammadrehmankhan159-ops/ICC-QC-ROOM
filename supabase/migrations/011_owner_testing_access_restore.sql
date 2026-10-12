-- RESTORE THE CUSTOMER-RESTRICTED POLICIES AFTER OWNER TESTING IS COMPLETE.
-- This file restores the original protection model without touching the existing data.

drop policy if exists latest_news_block_customer on latest_news;
drop policy if exists latest_news_customer_block_insert on latest_news;
drop policy if exists latest_news_customer_block_update on latest_news;
drop policy if exists latest_news_customer_block_delete on latest_news;
drop policy if exists profiles_customer_read_own_only on profiles;
drop policy if exists profiles_customer_self_update on profiles;
drop policy if exists inspections_customer_no_write on inspections;
drop policy if exists inspections_customer_no_update on inspections;
drop policy if exists inspections_customer_no_delete on inspections;
drop policy if exists audit_logs_customer_block on audit_logs;

drop policy if exists latest_news_owner_testing_read on latest_news;
drop policy if exists latest_news_owner_testing_admin_write on latest_news;
drop policy if exists profiles_owner_testing_read on profiles;
drop policy if exists profiles_owner_testing_update on profiles;
drop policy if exists inspections_owner_testing_admin on inspections;
drop policy if exists audit_logs_owner_testing_select on audit_logs;

create policy latest_news_block_customer on latest_news
for select
using (false);

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

create policy profiles_customer_read_own_only on profiles
for select
using (id = auth.uid() or is_qc_staff());

create policy profiles_customer_self_update on profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy inspections_customer_no_write on inspections
for insert with check (false);

create policy inspections_customer_no_update on inspections
for update using (false) with check (false);

create policy inspections_customer_no_delete on inspections
for delete using (false);

create policy audit_logs_customer_block on audit_logs
for select using (is_admin() or is_qc_manager() or is_qc_assistant() or is_qc_staff());

-- Drop the temporary testing policies after restoring the original restrictions.
drop policy if exists latest_news_owner_testing_read on latest_news;
drop policy if exists latest_news_owner_testing_admin_write on latest_news;
drop policy if exists profiles_owner_testing_read on profiles;
drop policy if exists profiles_owner_testing_update on profiles;
drop policy if exists inspections_owner_testing_admin on inspections;
drop policy if exists audit_logs_owner_testing_select on audit_logs;
