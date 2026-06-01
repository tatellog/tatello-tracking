import { supabase } from '@/lib/supabase'

/*
 * Client-side auth surface for the login / sign-up / reset screens.
 *
 * No edge function, no migration, no RLS — supabase.auth handles
 * everything and persists the session itself (persistSession is on in
 * lib/supabase.ts). We deliberately do NOT navigate from here: the
 * RouteGuard in app/_layout.tsx reacts to the session change.
 *
 * Every public function returns a flat AuthResult so the screens stay
 * dumb (render message, maybe react to `code`) and never see a raw
 * supabase-js error or English string.
 */

export type AuthResult =
  | { ok: true }
  | { ok: false; message: string; code?: 'email_exists' }

/** Warm Spanish copy already signed off by voice-and-copy. */
const EMAIL_EXISTS_MESSAGE =
  'Ya existe una cuenta con este correo. ¿Quieres iniciar sesión?'

/** Confirm-email is ON: the user must check their inbox before signing in. */
const CONFIRM_EMAIL_MESSAGE =
  'Casi listo. Revisa tu correo para confirmar tu cuenta.'

/*
 * Maps a raw supabase-js error message to warm Spanish copy. We match
 * on substrings because supabase-js doesn't expose stable error codes
 * for most auth failures (the `status`/`code` fields are inconsistent
 * across versions). Order matters only where patterns could overlap.
 */
function mapAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return 'Ese correo o contraseña no coinciden. Vuelve a intentarlo.'
  }
  if (/email not confirmed/i.test(message)) {
    return 'Tu cuenta todavía no está confirmada. Revisa tu correo.'
  }
  if (/at least 6 characters|password should be/i.test(message)) {
    return 'Tu contraseña necesita al menos 6 caracteres.'
  }
  if (/invalid format|unable to validate email/i.test(message)) {
    return 'Ese correo no parece completo. Revísalo.'
  }
  if (/rate limit|over_email_send/i.test(message)) {
    return 'Espera un momento antes de volver a intentarlo.'
  }
  if (/network|fetch|timeout/i.test(message)) {
    return 'No pudimos conectar. Revisa tu conexión e intenta de nuevo.'
  }
  return 'Algo no salió bien. Intenta de nuevo en un momento.'
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  // No auto-signUp on failure — that fallback is exactly what we're
  // removing. A bad credential stays a bad credential.
  if (error) return { ok: false, message: mapAuthError(error.message) }

  return { ok: true }
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      return { ok: false, code: 'email_exists', message: EMAIL_EXISTS_MESSAGE }
    }
    return { ok: false, message: mapAuthError(error.message) }
  }

  // Anti-enumeration quirk (supabase-js v2): signing up an email that
  // already exists returns a fabricated user with an empty `identities`
  // array and a null session — instead of an explicit error. Treat it
  // as the existing-email case so the user gets routed to login.
  if ((data.user?.identities?.length ?? 0) === 0) {
    return { ok: false, code: 'email_exists', message: EMAIL_EXISTS_MESSAGE }
  }

  // A real new account. With confirm-email OFF (beta config) Supabase
  // returns a live session and the RouteGuard takes over.
  if (data.session) return { ok: true }

  // No session and not an existing email → confirm-email is ON. The
  // user needs to verify before the session exists.
  return { ok: false, message: CONFIRM_EMAIL_MESSAGE }
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email)

  // resetPasswordForEmail is anti-enumeration: it succeeds whether or
  // not the email exists, so the only errors we expect are transport
  // / rate-limit ones, which mapAuthError handles.
  if (error) return { ok: false, message: mapAuthError(error.message) }

  return { ok: true }
}
