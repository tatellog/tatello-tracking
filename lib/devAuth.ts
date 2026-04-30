import { supabase } from './supabase'

/*
 * Opt-in dev shortcut.
 *
 * When `EXPO_PUBLIC_USE_DEV_SIGNIN=true` AND we're in __DEV__, this
 * helper signs the app in as `dev@local.test` (pre-created in
 * Supabase, email confirmed) so we can bypass the magic-link
 * round-trip while iterating on the wizard/home/photos.
 *
 * Default behaviour (flag unset / false): NO-OP. The user lands on
 * /auth and goes through the real magic-link flow — that's the path
 * production users take, so it's the path we test by default.
 *
 * Reglas:
 *   - `__DEV__` gate: production builds never touch this helper.
 *   - `USE_DEV_SIGNIN` is independent of `SKIP_AUTH`. Combine them as
 *     needed:
 *       USE_DEV_SIGNIN=true  + SKIP_AUTH=true   → fastest dev loop.
 *       USE_DEV_SIGNIN=false + SKIP_AUTH=false  → full real flow.
 *       USE_DEV_SIGNIN=true  + SKIP_AUTH=false  → real auth screen
 *           never shown but session exists (uncommon).
 *   - Si ya hay sesión, no hace nada — convive con el flujo real.
 *   - Errores se loguean y se devuelven; el splash-screen no se
 *     bloquea por un dev-helper.
 */
const DEV_EMAIL = 'dev@local.test'
const DEV_PASSWORD = 'devpassword123'

export async function ensureDevUserSession(): Promise<void> {
  if (!__DEV__) return
  if (process.env.EXPO_PUBLIC_USE_DEV_SIGNIN !== 'true') return

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session) {
    return
  }

  console.log('[devAuth] Signing in dev user...')

  // signInWithPassword can hang silently (no resolve / no reject) when
  // the user doesn't exist or there's a credential mismatch in some
  // supabase-js + browser setups. We wrap it with a timeout so the
  // log surfaces a clear failure instead of a frozen "Signing in..."
  // hint forever.
  const SIGNIN_TIMEOUT_MS = 8000
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`signInWithPassword timed out after ${SIGNIN_TIMEOUT_MS}ms`)),
      SIGNIN_TIMEOUT_MS,
    )
  })

  try {
    const result = await Promise.race([
      supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD }),
      timeoutPromise,
    ])
    if (timer) clearTimeout(timer)

    if (result.error) {
      console.warn(
        '[devAuth] Failed to sign in:',
        result.error.message,
        '\n→ ¿Existe el user dev@local.test en Supabase con email confirmado?',
      )
      return
    }
    console.log('[devAuth] Signed in as', result.data.user?.email)
  } catch (err) {
    if (timer) clearTimeout(timer)
    console.warn(
      '[devAuth]',
      err instanceof Error ? err.message : String(err),
      '\n→ Verificá que dev@local.test exista con email auto-confirmed en el dashboard.',
    )
  }
}
