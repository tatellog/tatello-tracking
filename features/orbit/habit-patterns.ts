/* Re-export of the shared intelligence lib — the SINGLE SOURCE lives in
 * supabase/functions/_shared/intelligence/ so the app (Metro) and the
 * Edge Functions (Deno) run the exact same deterministic rules. */
export * from '../../supabase/functions/_shared/intelligence/habit-patterns'
