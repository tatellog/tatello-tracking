/* Re-export del detector de baseline ("como sueles / distinto en ti") que vive
 * en supabase/functions/_shared/intelligence/ para que la app (Metro) y las Edge
 * Functions compartan una sola fuente de verdad. */
export * from '../../supabase/functions/_shared/intelligence/baseline'
