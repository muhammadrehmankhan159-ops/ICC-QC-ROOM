#!/bin/sh
set -e;DB=qc_test;D=$(dirname "$0")
psql -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -d $DB -q <<'SQL'
do $$begin create role anon nologin;exception when duplicate_object then null;end$$;
do $$begin create role authenticated nologin;exception when duplicate_object then null;end$$;
create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
alter default privileges in schema public grant all on tables to authenticated,anon;
SQL
psql -d $DB -v ON_ERROR_STOP=1 -q -f "$D/../migrations/001_phase1_foundation.sql"
psql -d $DB -v ON_ERROR_STOP=1 -q -f "$D/../migrations/002_phase2_control_room.sql"
psql -d $DB -v ON_ERROR_STOP=1 -f "$D/phase1_rls_test.sql"
psql -d $DB -v ON_ERROR_STOP=1 -q -f "$D/../migrations/003_phase3_departments.sql"
psql -d $DB -v ON_ERROR_STOP=1 -f "$D/phase2_test.sql"
psql -d $DB -v ON_ERROR_STOP=1 -q -f "$D/../migrations/004_phase4_inspections.sql"
psql -d $DB -v ON_ERROR_STOP=1 -f "$D/phase3_test.sql"
psql -d $DB -v ON_ERROR_STOP=1 -f "$D/phase4_test.sql"
