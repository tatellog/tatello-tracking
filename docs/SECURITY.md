# Pre-deploy security checks

Two cheap layers protect the beta from common foot-guns. Run them
before every deploy.

## 1. RLS smoke test

```sh
pnpm check:rls
```

Verifies that every table in the `public` schema:

- has RLS enabled, AND
- has at least one policy.

A table that fails one of these means data is exposed (RLS off →
anyone with the anon key can read everything) or silently broken
(RLS on, zero policies → the table is empty for non-service-role
callers and writes get rejected).

Implementation: the script calls
`public.check_rls_status()` (a security-definer function defined in
`supabase/migrations/20260527120000_check_rls_helper.sql`) which
reads `pg_class.relrowsecurity` and `pg_policies` directly. Service
role is required because the function is granted to `service_role`
only.

**Exempting a table.** If a table is _intentionally_ readable
without RLS (lookup tables, public catalogues), add its name to
`EXEMPT_TABLES` in `scripts/check-rls.ts` and leave a comment
explaining why. The default set is empty.

## 2. Data validation

Two layers of defence against impossible values (negative macros,
weight = 0, "extra zero" typos):

1. **Zod at the API boundary** — every write path parses input
   through a schema with realistic bounds. Examples:
   - `MacroTargetsInputSchema` (`features/macros/api.ts`):
     protein 50-300 g, calories 1000-5000.
   - `MealInputSchema` (same file): protein 0-500 g, calories
     0-5000.
   - `NewMeasurementInputSchema` (`features/progress/api.ts`):
     weight 0-500 kg, circumferences 0-300 cm (limbs 0-200 cm),
     at least one field non-null.
2. **CHECK constraints in Postgres** — the DB rejects out-of-range
   values even if a buggy client bypasses Zod. See
   `supabase/migrations/20260527120001_data_validation_checks.sql`
   for the canonical bounds.

When tightening a bound, update BOTH layers so the user gets a
helpful Spanish error before the request hits the DB AND the DB
stays a hard backstop.
