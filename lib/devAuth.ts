import { supabase } from './supabase'

/*
 * Dev auto-login. Runs on every cold start in __DEV__ and signs the
 * app in as `dev@local.test` (pre-created in Supabase, email
 * confirmed, password `devpassword123`). Sprint Foundation makes
 * auto-login the default for fast iteration — auth real lands later.
 *
 * Reglas:
 *   - `__DEV__` gate: production builds never touch this helper.
 *   - `EXPO_PUBLIC_DISABLE_DEV_SIGNIN=true` opts out (set this when
 *     you want to QA the actual /auth screen). Default is on.
 *   - Si ya hay sesión, no hace nada — convive con el flujo real
 *     cuando entre.
 *   - Errores se loguean y se devuelven; el splash-screen no se
 *     bloquea por un dev-helper.
 */
const DEV_EMAIL = 'dev@local.test'
const DEV_PASSWORD = 'devpassword123'

export async function ensureDevUserSession(): Promise<void> {
  if (!__DEV__) return
  if (process.env.EXPO_PUBLIC_DISABLE_DEV_SIGNIN === 'true') return

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
