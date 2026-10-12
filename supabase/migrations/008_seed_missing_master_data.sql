-- 008: Seed the existing master QC data only when it is missing.
-- This repair is safe: it does not overwrite production rows and it preserves any
-- manually entered or customer-specific data already in the database.

insert into departments(name, code)
values
  ('PLASTIC', 'PLASTIC'),
  ('CROWN', 'CROWN'),
  ('INJECTION MOULDING', 'INJECTION_MOULDING')
on conflict (code) do nothing;

insert into processes(department_id, name, sort)
select d.id, v.name, v.sort
from (
  values
    ('PLASTIC', 'CCM CLOSURE', 1),
    ('PLASTIC', 'SLITTING', 2),
    ('PLASTIC', 'PRINTING', 3),
    ('CROWN', 'TPR', 1),
    ('CROWN', 'PRESS', 2),
    ('CROWN', 'PMC', 3)
) as v(department_code, name, sort)
join departments d on d.code = v.department_code
on conflict (department_id, name) do nothing;

insert into machines(department_id, process_id, name)
select p.department_id, p.id, v.name
from (
  values
    ('CCM CLOSURE', 'CCM 01'),
    ('CCM CLOSURE', 'CCM 02'),
    ('CCM CLOSURE', 'CCM 03'),
    ('CCM CLOSURE', 'CCM 04'),
    ('CCM CLOSURE', 'CCM 05'),
    ('CCM CLOSURE', 'CCM 06'),
    ('CCM CLOSURE', 'CCM 07'),
    ('CCM CLOSURE', 'CCM 08'),
    ('SLITTING', 'SCM 01'),
    ('SLITTING', 'SFM 01'),
    ('SLITTING', 'SFM 02'),
    ('SLITTING', 'SFM 03'),
    ('SLITTING', 'PMV 02'),
    ('PRINTING', 'PRINTING 01'),
    ('PRINTING', 'PRINTING 02'),
    ('PRINTING', 'PRINTING 03'),
    ('TPR', 'COATING SECTION'),
    ('TPR', 'PRINTING SECTION'),
    ('PRESS', 'PRESS 01'),
    ('PRESS', 'PRESS 02'),
    ('PRESS', 'PRESS 03'),
    ('PMC', 'PMC 01'),
    ('PMC', 'PMC 02')
) as v(process_name, name)
join processes p on p.name = v.process_name
on conflict (department_id, coalesce(process_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)) do nothing;

insert into machines(department_id, name)
select d.id, v.name
from (
  values
    ('INJECTION_MOULDING', 'IMM 01'),
    ('INJECTION_MOULDING', 'IMM 02'),
    ('INJECTION_MOULDING', 'IMM 03'),
    ('INJECTION_MOULDING', 'IMM 04')
) as v(department_code, name)
join departments d on d.code = v.department_code
on conflict (department_id, coalesce(process_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)) do nothing;
