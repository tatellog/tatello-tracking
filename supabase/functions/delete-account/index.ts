// @ts-nocheck — typechecked by Deno (deno.json), not the app tsconfig.
// Edge function: delete-account
//
// Permanently deletes the calling user's account and ALL of their data:
//   - every row in the per-user tables (the same set scripts/
//     reset-onboarding.ts --fresh wipes, plus the rest of the schema)
//   - every object the user owns in the three storage buckets
//     (progress-photos, meal-photos, avatars), all keyed by {userId}/…
//   - finally the auth.users row itself via the admin API
//
// SECURITY MODEL
//   - The caller authenticates with their normal anon-key JWT. We read
//     the user id FROM THAT TOKEN (auth.getUser) and never from the
//     request body — a client must not be able to delete someone else.
//   - The service-role key lives ONLY here (Supabase function secret),
//     never in the app bundle. It bypasses RLS, which is exactly what's
//     needed to remove rows the anon client could only see, and to call
//     auth.admin.deleteUser.
//
// Note on FKs: every per-user table FK references auth.users(id) ON
// DELETE CASCADE, so auth.admin.deleteUser alone would cascade-delete
// the rows. We still delete table rows + storage objects explicitly
// first because:
//   1. Storage objects are NOT covered by the auth.users cascade — the
//      photos.storage_path rows cascade, but the binary objects in the
//      buckets do not. They must be removed by hand or they leak.
//   2. Explicit deletes make the teardown auditable in logs and stay
//      correct even if a future table is added without the cascade.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.23.8'

// Per-user tables, child-first. With ON DELETE CASCADE on every FK the
// order does not strictly matter, but listing them explicitly documents
// the full surface and keeps the teardown correct if a cascade is ever
// dropped. `profiles` is keyed by id (= auth.users.id), the rest by
// user_id; both are handled below.
const USER_ID_TABLES = [
  'workouts',
  'meals',
  'macro_targets',
  'body_measurements',
  'photos',
  'briefs',
  'mood_checkins',
  'water_intake',
  'rest_days',
  'sleep_logs',
  'cycle_events',
  'wellbeing_checkins',
  'analytics_events',
  'detected_patterns',
  'beta_feedback',
  'error_logs',
] as const

// Buckets whose object keys are prefixed with `${userId}/`.
const USER_BUCKETS = ['progress-photos', 'meal-photos', 'avatars'] as const

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// No body is required — the user id comes from the JWT. We still parse
// defensively so a malformed/extra payload can't surprise us; the body
// is allowed to be empty or an empty object, nothing more is read.
const BodySchema = z.object({}).passthrough().optional()

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Remove every object the user owns in one bucket. Storage `list` is
 *  paginated; we page until a short page signals the end. Returns the
 *  number of objects removed (for logging). */
async function emptyUserBucket(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  userId: string,
): Promise<number> {
  const pageSize = 100
  let removed = 0
  let offset = 0

  // Loop guarded by a generous ceiling so a bug can never spin forever.
  for (let guard = 0; guard < 1000; guard++) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(userId, { limit: pageSize, offset })
    if (error) throw error
    if (!data || data.length === 0) break

    // `list` returns folder-relative names; prefix them back to the
    // full `${userId}/name` key for removal.
    const paths = data.map((obj: { name: string }) => `${userId}/${obj.name}`)
    const { error: removeErr } = await admin.storage.from(bucket).remove(paths)
    if (removeErr) throw removeErr
    removed += paths.length

    if (data.length < pageSize) break
    offset += pageSize
  }

  return removed
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      // Misconfiguration — log the detail internally, stay generic out.
      console.error('delete-account: missing required env vars')
      return json({ error: 'server_error' }, 500)
    }

    // Validate the (optional) body. We don't trust anything inside it;
    // the id always comes from the token below.
    if (req.headers.get('content-type')?.includes('application/json')) {
      const raw = await req.json().catch(() => undefined)
      const parsed = BodySchema.safeParse(raw)
      if (!parsed.success) {
        return json({ error: 'bad_request' }, 400)
      }
    }

    // 1. Resolve the caller from their JWT. A request-scoped client that
    //    forwards the Authorization header lets auth.getUser verify the
    //    token and hand back the authenticated user. NEVER trust a body id.
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return json({ error: 'unauthorized' }, 401)
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userErr } = await authClient.auth.getUser(token)
    if (userErr || !userData.user) {
      return json({ error: 'unauthorized' }, 401)
    }
    const userId = userData.user.id

    // 2. Service-role client — bypasses RLS for the teardown + admin API.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    console.log(`delete-account: starting teardown for user ${userId}`)

    // 3. Empty the storage buckets first. (auth.users cascade does NOT
    //    reach storage objects — these would leak otherwise.)
    for (const bucket of USER_BUCKETS) {
      try {
        const count = await emptyUserBucket(admin, bucket, userId)
        console.log(`delete-account: removed ${count} objects from ${bucket}`)
      } catch (err) {
        // A bucket failure shouldn't abort the whole delete — the user
        // still wants their account gone. Log and continue; the
        // auth.users delete below is the authoritative finish.
        console.error(`delete-account: bucket ${bucket} cleanup failed`, err)
      }
    }

    // 4. Delete per-user table rows explicitly (auditable; correct even
    //    if a cascade is ever removed).
    for (const table of USER_ID_TABLES) {
      const { error } = await admin.from(table).delete().eq('user_id', userId)
      if (error) {
        console.error(`delete-account: delete from ${table} failed`, error)
      }
    }

    // profiles is keyed by `id` (= auth.users.id), not user_id.
    const { error: profileErr } = await admin
      .from('profiles')
      .delete()
      .eq('id', userId)
    if (profileErr) {
      console.error('delete-account: delete from profiles failed', profileErr)
    }

    // 5. Finally remove the auth identity. This is the point of no
    //    return; any cascade left over is cleaned here too.
    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId)
    if (deleteErr) {
      console.error('delete-account: auth.admin.deleteUser failed', deleteErr)
      return json({ error: 'server_error' }, 500)
    }

    console.log(`delete-account: completed for user ${userId}`)
    return json({ ok: true }, 200)
  } catch (err) {
    // Catch-all: log the real error internally, return a generic shape.
    console.error('delete-account: unhandled error', err)
    return json({ error: 'server_error' }, 500)
  }
})
