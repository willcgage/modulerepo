# Milestone 2 — REST API Test Plan

Manual verification steps for the REST API layer: RLS on auto-generated
PostgREST endpoints, the custom Edge Functions, and the OpenAPI contract.

Replace placeholders before running:
- `SUPABASE_URL` — e.g. `https://dpifxkipqfaxujidgjyg.supabase.co`
- `ANON_KEY` — Settings → API → `anon` `public` key
- `SERVICE_KEY` — Settings → API → `service_role` key (admin-level — keep private)
- `OWNER_JWT` / `ADMIN_JWT` — obtained by signing in as a test owner/admin (see step 0)

## 0. Get user JWTs for owner / admin testing

```bash
# Sign in as a test user (owner)
curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"<password>"}' | jq -r '.access_token'
# Save the result as OWNER_JWT. Repeat for an admin user -> ADMIN_JWT.
```

## 1. RLS — auto-generated REST endpoints (PostgREST)

### 1a. Anonymous read — should see only active modules
```bash
curl -s "$SUPABASE_URL/rest/v1/freemon_modules?select=record_number,status" \
  -H "apikey: $ANON_KEY" | jq
```
**Expect:** every row has `"status": "active"`. FMN-0001 through FMN-0005 (if seeded) all appear since they're active.

### 1b. Anonymous insert — should be rejected
```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/freemon_modules" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"module_name":"Hacked Module","owner_id":"00000000-0000-0000-0000-000000000001","category":"yard","geometry_type":"straight","length_feet":1,"length_inches":0}' \
  -i | head -1
```
**Expect:** `401` or `403` (no INSERT policy for `anon`).

### 1c. Owner read — sees own inactive/archived modules too
```bash
curl -s "$SUPABASE_URL/rest/v1/freemon_modules?select=record_number,status,owner_id" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $OWNER_JWT" | jq
```
**Expect:** active modules from all owners, PLUS the signed-in owner's own inactive/archived modules (if any).

### 1d. Owner write — can update own module, cannot update another owner's
```bash
# Own module (should succeed, 200/204)
curl -s -X PATCH "$SUPABASE_URL/rest/v1/freemon_modules?id=eq.1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $OWNER_JWT" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"description":"Updated via RLS test"}' -i | head -1

# Someone else's module (should affect 0 rows — RLS filters it out silently)
curl -s -X PATCH "$SUPABASE_URL/rest/v1/freemon_modules?id=eq.4" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $OWNER_JWT" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"description":"Should not apply"}' | jq
```
**Expect:** first call returns the updated row; second returns `[]` (zero rows matched under RLS).

### 1e. Admin — full visibility and write access
```bash
curl -s "$SUPABASE_URL/rest/v1/freemon_modules?select=record_number,status,owner_id" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ADMIN_JWT" | jq
```
**Expect:** every module regardless of owner or status.

### 1f. rail_car_types — public sees only active, owner can suggest
```bash
# Public: only active
curl -s "$SUPABASE_URL/rest/v1/rail_car_types?select=value,status" \
  -H "apikey: $ANON_KEY" | jq '.[] | .status' | sort -u
# Expect: "active" only

# Owner: insert a pending_review suggestion (must set suggested_by = self)
curl -s -X POST "$SUPABASE_URL/rest/v1/rail_car_types" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $OWNER_JWT" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"value":"test_suggestion","display_label":"Test Suggestion","status":"pending_review","suggested_by":"<owner-uuid>"}' | jq
```
**Expect:** insert succeeds when `status = pending_review` and `suggested_by = auth.uid()`; fails (RLS violation) if either differs.

## 2. Edge Functions

### 2a. GET /api/v1/modules/full
```bash
curl -s "$SUPABASE_URL/functions/v1/api/v1/modules/full" \
  -H "apikey: $ANON_KEY" | jq '.[0]'
```
**Expect:** JSON array; first module has nested `endplates[]` and `industries[]`, and each industry has a `car_types[]` array of `{ value, display_label, notes }`. Verify against the OpenAPI example in `openapi/modulerepo-openapi-v1.yaml`.

Filter checks:
```bash
curl -s "$SUPABASE_URL/functions/v1/api/v1/modules/full?category=industry_spur" -H "apikey: $ANON_KEY" | jq 'length'
curl -s "$SUPABASE_URL/functions/v1/api/v1/modules/full?updated_since=2026-06-01T00:00:00Z" -H "apikey: $ANON_KEY" | jq 'length'
```

### 2b. GET /api/v1/car-types
```bash
curl -s "$SUPABASE_URL/functions/v1/api/v1/car-types" -H "apikey: $ANON_KEY" | jq
```
**Expect:** 14 active car types (or more if suggestions have been approved), sorted by `display_label`.

### 2c. GET /api/v1/industry-types
```bash
curl -s "$SUPABASE_URL/functions/v1/api/v1/industry-types" -H "apikey: $ANON_KEY" | jq 'length'
```
**Expect:** 15.

### 2d. POST /api/v1/car-types/suggest
```bash
# Happy path
curl -s -X POST "$SUPABASE_URL/functions/v1/api/v1/car-types/suggest" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $OWNER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"value":"wood_chip_car","display_label":"Wood Chip Car","suggestion_notes":"Dedicated chip service to the paper mill."}' | jq
# Expect: 201, status = "pending_review", suggested_by = owner's UUID

# Duplicate value
curl -s -X POST "$SUPABASE_URL/functions/v1/api/v1/car-types/suggest" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $OWNER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"value":"boxcar","display_label":"Box Car"}' -i | head -1
# Expect: 409 duplicate_value

# No auth
curl -s -X POST "$SUPABASE_URL/functions/v1/api/v1/car-types/suggest" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"value":"x","display_label":"X"}' -i | head -1
# Expect: 401

# Bad value format
curl -s -X POST "$SUPABASE_URL/functions/v1/api/v1/car-types/suggest" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $OWNER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"value":"Not Valid!","display_label":"Bad"}' | jq
# Expect: 400 validation_failed, details.value explains snake_case requirement
```

### 2e. POST /api/v1/modules/validate-name (duplicate name guard)
```bash
# Should flag — "Cascade Lumber & Grain" already exists for this owner (FMN-0002)
curl -s -X POST "$SUPABASE_URL/functions/v1/api/v1/modules/validate-name" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $OWNER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"module_name":"cascade lumber & grain"}' | jq
# Expect: 409 duplicate_module_name (case-insensitive match)

# Editing the module itself — exclude its own id, should pass
curl -s -X POST "$SUPABASE_URL/functions/v1/api/v1/modules/validate-name" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $OWNER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"module_name":"Cascade Lumber & Grain","exclude_module_id":2}' | jq
# Expect: { "valid": true }

# Brand new name — should pass
curl -s -X POST "$SUPABASE_URL/functions/v1/api/v1/modules/validate-name" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $OWNER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"module_name":"Totally New Module Name"}' | jq
# Expect: { "valid": true }
```

### 2f. DB-level constraint as last line of defense
```bash
# Bypass the validation endpoint and try to insert a true duplicate directly —
# the unique constraint (freemon_modules_name_owner_unique) should still block it.
curl -s -X POST "$SUPABASE_URL/rest/v1/freemon_modules" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $OWNER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"module_name":"Cascade Lumber & Grain","owner_id":"<owner-uuid>","category":"yard","geometry_type":"straight","length_feet":1,"length_inches":0}' -i | head -1
# Expect: 409 (Postgres unique_violation, code 23505)
```

## 3. Postman

If you prefer a GUI: import `openapi/modulerepo-openapi-v1.yaml` directly into Postman
(File → Import → paste the OpenAPI file). Postman will generate a collection with all
documented endpoints and example bodies. Set collection variables for `baseUrl`,
`anonKey`, `ownerJwt`, and `adminJwt` to match the curl examples above.

## 4. Pass/fail checklist

| # | Check | Expected |
|---|-------|----------|
| 1a | Anon sees only active modules | ✅ all `status = active` |
| 1b | Anon cannot insert modules | ✅ 401/403 |
| 1c | Owner sees own non-active modules | ✅ included in result set |
| 1d | Owner can edit own, not others' | ✅ own succeeds, other returns `[]` |
| 1e | Admin sees everything | ✅ all statuses, all owners |
| 1f | rail_car_types: public active-only, owner can suggest | ✅ as described |
| 2a | /modules/full nests endplates + industries + car_types | ✅ matches OpenAPI schema |
| 2b | /car-types returns 14 active | ✅ |
| 2c | /industry-types returns 15 | ✅ |
| 2d | /car-types/suggest happy path + 409 + 401 + 400 | ✅ all four cases |
| 2e | /modules/validate-name flags duplicates, allows edits & new names | ✅ all three cases |
| 2f | DB unique constraint blocks bypass attempt | ✅ 409 / 23505 |
