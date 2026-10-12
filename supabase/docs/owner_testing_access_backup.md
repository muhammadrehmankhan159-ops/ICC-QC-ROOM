# Owner testing access backup and restore

This document records the temporary Owner/Admin testing override that was added so the authenticated Owner can inspect the portal without having to decide final customer permissions yet. The goal is to keep access narrow and reversible without exposing the database to the public or removing authentication.

## What was temporarily relaxed

The following customer-blocking and role-based restrictions were intentionally loosened for the authenticated Owner/Admin only:

- `latest_news_block_customer` and the related `latest_news_customer_block_*` policies
- `profiles_customer_read_own_only` and `profiles_customer_self_update`
- `inspections_customer_no_write`, `inspections_customer_no_update`, and `inspections_customer_no_delete`
- `audit_logs_customer_block`
- the front-end route gate in `src/access.ts` and the sidebar nav in `src/pages.tsx`

These are not broad public or anonymous openings. The app still requires an authenticated session and the Owner/Admin account remains the only account with this temporary bypass.

## Why the data is safe

- No records were deleted, moved, or overwritten.
- No user, customer, machine, report, or profile rows were removed.
- The current Supabase project was not replaced and no new project was created.
- The Owner/Admin login remains the existing authenticated account; no new Owner account was created.
- RLS was not globally disabled for the whole database.

## Restore steps later

After the testing phase, restore the original restrictions by running the SQL in `supabase/migrations/011_owner_testing_access_restore.sql` in the Supabase SQL editor and then remove the temporary front-end override in `src/access.ts` by setting `OWNER_TESTING_MODE` to `false`.

This keeps the portal easy to re-lock down once you choose the final customer permissions.
