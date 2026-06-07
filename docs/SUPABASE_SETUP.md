# Supabase Dev Setup — Module Repository Milestone 1

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name it `modulerepo-dev`, choose a region close to you, set a strong DB password
3. Wait for the project to provision (~2 min)

## 2. Apply migrations

Open **SQL Editor** in the Supabase dashboard and run each file in order.
Paste the contents of each file and click **Run**. Do not skip or reorder.

| Order | File | What it does |
|-------|------|--------------|
| 1 | `migrations/001_lookup_tables.sql` | Lookup tables + all seed data (categories, geometries, industry types, car types) |
| 2 | `migrations/002_profiles_grants_audit.sql` | owner_profiles, show_master_grants, audit_log |
| 3 | `migrations/003_modules_endplates_images.sql` | freemon_modules (+ sequence), freemon_endplates, module_images |
| 4 | `migrations/004_industries.sql` | freemon_industries, freemon_industry_car_types |
| 5 | `migrations/005_triggers.sql` | All triggers (updated_at, record_number, endplate_count, industry_number, etc.) |
| 6 | `migrations/006_rls.sql` | Row-Level Security on all tables |
| 7 | `migrations/007_seed_samples.sql` | 5 sample modules for dev testing (**dev only**) |

> **Tip:** If you prefer the Supabase CLI, place the files in `supabase/migrations/`
> with timestamps (`20260606000001_lookup_tables.sql`, etc.) and run `supabase db push`.

## 3. Create the Storage bucket

In the Supabase dashboard → **Storage** → **New bucket**:
- Name: `module-images`
- Public: No (access via signed URLs or RLS)

## 4. Verify with test queries

Run these in the SQL Editor to confirm everything landed correctly.

### Lookup data
```sql
SELECT * FROM module_categories ORDER BY value;
SELECT * FROM module_geometries ORDER BY value;
SELECT * FROM industry_types ORDER BY value;
SELECT COUNT(*) FROM rail_car_types WHERE status = 'active';  -- expect 14
```

### Modules + trigger output
```sql
SELECT record_number, module_name, endplate_count, status
FROM freemon_modules
ORDER BY record_number;
-- Expect FMN-0001 through FMN-0005, endplate_count = 2 for each
```

### Full nesting check
```sql
SELECT
    m.record_number,
    m.module_name,
    m.endplate_count,
    COUNT(DISTINCT ind.id)  AS industry_count,
    COUNT(DISTINCT ict.id)  AS car_type_assignments
FROM freemon_modules m
LEFT JOIN freemon_industries ind ON ind.module_id = m.id
LEFT JOIN freemon_industry_car_types ict ON ict.industry_id = ind.id
GROUP BY m.record_number, m.module_name, m.endplate_count
ORDER BY m.record_number;
```

Expected results:

| record_number | module_name | endplate_count | industry_count | car_type_assignments |
|---------------|-------------|----------------|----------------|----------------------|
| FMN-0001 | Columbia River Gorge | 2 | 0 | 0 |
| FMN-0002 | Cascade Lumber & Grain | 2 | 2 | 5 |
| FMN-0003 | Multnomah Curve | 2 | 0 | 0 |
| FMN-0004 | Willamette Fuel Depot | 2 | 1 | 1 |
| FMN-0005 | Portland Classification Yard | 2 | 0 | 0 |

### Geometry constraint check (should error)
```sql
-- This should FAIL — curve requires geometry_degrees
INSERT INTO freemon_modules
    (module_name, owner_id, category, geometry_type, length_feet, length_inches, has_mss)
VALUES
    ('Bad Curve', '00000000-0000-0000-0000-000000000001',
     'scenic', 'curve', 2, 0, false);
```

### Industry business rule check (should error)
```sql
-- This should FAIL — spur_capacity_scale_feet must be > 0
INSERT INTO freemon_industries
    (module_id, industry_name, industry_type, spur_capacity_scale_feet)
VALUES
    (1, 'Bad Industry', 'lumber_yard', 0);
```

### RLS smoke test
Run as `anon` role (set in SQL Editor role picker):
```sql
-- Should return only 'active' modules
SELECT record_number, status FROM freemon_modules;

-- Should return only 'active' car types
SELECT value, status FROM rail_car_types;

-- Should return nothing (show_master_grants is auth-only)
SELECT * FROM show_master_grants;
```

## 5. Next step — Milestone 2

Once all checks pass, move to Milestone 2:
- Build the Edge Functions
- Implement `GET /api/v1/modules/full` returning modules → endplates + industries → car_types nested JSON
- Add `GET /api/v1/car-types`, `GET /api/v1/industry-types`, `POST /api/v1/car-types/suggest`

## Milestone 1 task checklist status

| Task | Status |
|------|--------|
| M1-03 module_standards | ✅ Done (001) |
| M1-04 module_categories + seed | ✅ Done (001) |
| M1-05 module_geometries + seed | ✅ Done (001) |
| M1-06 industry_types + seed | ✅ Done (001) |
| M1-07 rail_car_types + seed | ✅ Done (001) |
| M1-08 freemon_modules + CHECKs | ✅ Done (003) |
| M1-09 freemon_endplates | ✅ Done (003) |
| M1-10 freemon_industries | ✅ Done (004) |
| M1-11 freemon_industry_car_types | ✅ Done (004) |
| M1-12 module_images | ✅ Done (003) |
| M1-13 FMN sequence + function | ✅ Done (003 + 005) |
| M1-14 updated_at triggers | ✅ Done (005) |
| M1-15 endplate_count trigger | ✅ Done (005) |
| M1-16 industry_number trigger | ✅ Done (005) |
| M1-17 RLS on all tables | ✅ Done (006) |
| M1-18 RLS on rail_car_types | ✅ Done (006) |
| M1-19 Storage bucket | ⬜ Manual step (section 3 above) |
| M1-20 Sample data | ✅ Done (007) |
| M1-21 Validate constraints/triggers | ⬜ Run test queries (section 4) |
| M1-22 Document schema | ⬜ Pending (README) |
| M1-23 Schema review sign-off | ⬜ Will |
| M1-01 / M1-02 Create Supabase projects | ⬜ Manual step (section 1) |
