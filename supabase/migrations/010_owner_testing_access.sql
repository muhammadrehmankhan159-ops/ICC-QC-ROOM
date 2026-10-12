-- TEMPORARY OWNER TESTING ACCESS OVERRIDE
-- Purpose: allow the authenticated Owner/Admin to inspect and test the full portal while keeping
-- anonymous access blocked and customer-specific restrictions in place for everyone else.
-- This is intentionally reversible. Revert with 011_owner_testing_access_restore.sql.

-- Latest news: loosen only the customer block, while leaving anonymous access blocked.
drop policy if exists latest_news_block_customer on latest_news;
drop policy if exists latest_news_customer_block_insert on latest_news;
drop policy if exists latest_news_customer_block_update on latest_news;
drop policy if exists latest_news_customer_block_delete on latest_news;

create policy latest_news_owner_testing_read on latest_news
for select
using (is_admin() or is_qc_staff());

create policy latest_news_owner_testing_admin_write on latest_news
for all
using (is_admin())
with check (is_admin());

-- Profiles: allow the authenticated owner/admin account and QC staff to inspect the current access map
-- without opening client-side read access to customers.
drop policy if exists profiles_customer_read_own_only on profiles;
drop policy if exists profiles_customer_self_update on profiles;

create policy profiles_owner_testing_read on profiles
for select
using (id = auth.uid() or is_admin() or is_qc_staff());

create policy profiles_owner_testing_update on profiles
for update
using (is_admin() or id = auth.uid())
with check (is_admin() or id = auth.uid());

-- Inspections: allow the owner/admin to test full inspection flows without allowing public or customer writes.
drop policy if exists inspections_customer_no_write on inspections;
drop policy if exists inspections_customer_no_update on inspections;
drop policy if exists inspections_customer_no_delete on inspections;

create policy inspections_owner_testing_admin on inspections
for all
using (is_admin() or is_qc_manager() or is_qc_assistant() or is_qc_checker())
with check (is_admin() or is_qc_manager() or is_qc_assistant() or is_qc_checker());

-- Audit logs: keep admin and QC staff access for debugging while keeping customers out.
drop policy if exists audit_logs_customer_block on audit_logs;

create policy audit_logs_owner_testing_select on audit_logs
for select
using (is_admin() or is_qc_manager() or is_qc_assistant() or is_qc_staff());

-- NOTE: this is only a temporary testing override for Owner/Admin access and is intentionally not
-- a public or anonymous opening. Revert with the restore migration once permission choices are finalized.
