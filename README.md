# QC MANAGEMENT & CUSTOMER PORTAL — Phase 1 (Foundation, Auth & Security)
Imran Crown Crok Pvt Ltd. Phase 1 only: no dashboard UI, QC reports, parameters, SPC or complaints.

## Setup
1. Create a Supabase project. In the SQL editor run `supabase/migrations/001_phase1_foundation.sql`.
2. `cp .env.example .env` and set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. `npm install && npm run dev`
4. Create users (Supabase Auth → Users). New profiles are `customer` + inactive. Bootstrap the first admin in SQL:
   `update profiles set role='admin', active=true where email='you@company.com';`
5. Link a customer login:
   `insert into customer_users(user_id,customer_id) select p.id,c.id from profiles p,customers c where p.email='x@y' and c.code='PEPSI';`
   `insert into customer_department_access(customer_id,department_id) select c.id,d.id from customers c,departments d where c.code='PEPSI' and d.code='CROWN';`

## Tests
- `npm test` — route-gate unit tests.
- `supabase/tests/run_local.sh` — migration + RLS test on a scratch local Postgres (stub auth schema).
  `supabase/tests/phase1_rls_test.sql` can also run in a Supabase dev project (it rolls back).

## Phase 2 — QC Control Room
Run `supabase/migrations/002_phase2_control_room.sql` after 001. Adds `processes`, `machines`, `qc_updates`, `machine_current_status` (RLS on all), seeds the machine list from the specification (master data only — no status, updates or QC records). Latest update becomes the machine's current status via a trigger; posted-by and time are set by the server. Dashboard access: Admin, QA/QC Manager, QC Checker, QC Assistant. Production and Customer have no dashboard access (customers are redirected to the portal).
Tests: `npm test`; `supabase/tests/run_local.sh` (runs both migrations + Phase 1 and Phase 2 SQL tests on a local Postgres), or run `phase2_test.sql` in a Supabase dev project (rolls back).

## Phase 3 — Department pages
Run `supabase/migrations/003_phase3_departments.sql` after 002. Department pages (`/app/department/PLASTIC|CROWN|INJECTION_MOULDING`): summary counts, process/section cards, full machine cards, machine detail modal, and Admin-only ADD MACHINE (also `/app/admin/machines` to add / rename / activate). Structure was seeded in 002 and is verified by `supabase/tests/phase3_test.sql` and `src/__tests__/structure.test.ts`. Customer / Product / Batch on machine cards are optional fields captured with QC updates (Customer must be authorized for the department). QC Attention on a department page = Stopped + Hold machines.

## Phase 4 — QC inspections & customer portal
Run `supabase/migrations/004_phase4_inspections.sql` after 003, then run `phase1…phase4_test.sql` (all roll back).
- **QC Reports** (`/app/reports`): All / New Inspection / Inspection Pending / Hold / Re-Test / Approved; filters for Report ID, department, process, machine, customer, product, batch, status and date range.
- **Roles:** Admin + QA/QC Manager see all reports; QC Checker / QC Assistant see only reports assigned to them. Assistant creates (starts as DRAFT) and submits; Checker records PASS / HOLD / REJECT / RE-TEST; the assigned QA/QC Manager approves (only from PASS); approved reports are locked (Admin only can change). Customers and Production have no direct access to `inspections`.
- **Customer portal** (`/app/portal`): CURRENT (the customer's active job, from the latest QC update that names the customer; post an update with Customer = none to end the job) and REPORTS (own APPROVED reports only; filters; report detail). Both use security-definer functions keyed on `auth.uid()` — no customer id is accepted from the client.
- Not built (per spec): QC parameters / specifications / limits, PDF generation, printing, complaints, SPC.
