import { supabase } from './supabase'

/*
 * Dev-only auto-login.
 *
 * Mientras el flujo real de magic-link / OAuth no esté validado de
 * principio a fin, en builds de desarrollo nos saltamos la pantalla
 * de auth: si no hay sesión activa, intentamos signInWithPassword
 * con un usuario de prueba pre-creado en Supabase
 * (`dev@local.test` / `devpassword123`, email ya confirmado).
 *
 * Reglas:
 *   - Solo corre cuando `__DEV__` (Metro bundler) está activo, así el
 *     builder de prod nunca lo trae embebido.
 *   - Si ya hay sesión, no hace nada. Esto convive con el flujo
 *     real de auth — si en algún momento iniciás sesión con tu user
 *     real, este helper se queda quieto.
 *   - Errores se loguean y se devuelven; el caller no los relanza
 *     porque el splash-screen del `_layout` no debe bloquearse por
 *     un dev-helper.
 */
const DEV_EMAIL = 'dev@local.test'
const DEV_PASSWORD = 'devpassword123'

export async function ensureDevUserSession(): Promise<void> {
  if (!__DEV__) return

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
