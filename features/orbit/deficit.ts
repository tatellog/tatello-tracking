/* Re-export del motor compartido — fuente única en
 * supabase/functions/_shared/intelligence/deficit.ts (app + Edge Functions).
 * La regla de "día en déficit" vive ahí para que server y cliente coincidan. */
export * from '../../supabase/functions/_shared/intelligence/deficit'
