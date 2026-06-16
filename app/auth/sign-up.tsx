import { Feather } from '@expo/vector-icons'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { signUp } from '@/features/auth/api'
import { colors, duration, spacing, typography } from '@/theme'

import { AuthScreenLayout } from './components/AuthScreenLayout'
import { Field } from './components/Field'
import { SubmitButton } from './components/SubmitButton'

const enter = (delayMs: number) =>
  FadeInDown.duration(duration.slow).delay(delayMs).springify().damping(18)

const MIN_PASSWORD = 6
const isEmailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

export default function SignUpScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState(params.email ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [emailExists, setEmailExists] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  // Chain focus on returnKeyType="next": email → password → confirm.
  const passwordRef = useRef<TextInput>(null)
  const confirmRef = useRef<TextInput>(null)

  const trimmedEmail = email.trim()
  // Inline hints appear only after the user has left the field (blur),
  // so we never nag mid-typing.
  const emailError = emailTouched && trimmedEmail.length > 0 && !isEmailValid(trimmedEmail)
  const passwordError = passwordTouched && password.length > 0 && password.length < MIN_PASSWORD
  const passwordsMatch = confirm.length > 0 && password === confirm
  const canSubmit =
    isEmailValid(trimmedEmail) && password.length >= MIN_PASSWORD && passwordsMatch && !submitting

  // Match feedback only appears once the user has left the confirm field.
  const showMatch = confirmTouched && confirm.length > 0

  const onSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setErrorMessage(null)
    setEmailExists(false)
    const result = await signUp(trimmedEmail, password)
    if (result.ok) {
      // pending confirm-email → the account exists but there's no session
      // yet, so RouteGuard won't move us. Show the warm "check your inbox"
      // state. A live-session success navigates on its own — nothing to do.
      if (result.pending === 'confirm_email') {
        setConfirmSent(true)
        setSubmitting(false)
      }
      return
    }
    setErrorMessage(result.message)
    setEmailExists(result.code === 'email_exists')
    setSubmitting(false)
  }

  // Success without a live session: the account was created and a
  // confirmation email is on its way. Warm, never an error red.
  if (confirmSent) {
    return (
      <AuthScreenLayout anchorPulseOnce>
        <Animated.View entering={enter(80)} style={styles.headerBlock}>
          <Text style={styles.headline}>Casi lista</Text>
        </Animated.View>

        <Animated.View entering={enter(160)} style={styles.sentBody}>
          {/* Voice moment — Cormorant italic is allowed here. */}
          <Text style={styles.serifBody}>
            Creé tu cuenta. Te mandé un correo para confirmarla — ábrelo y volvemos a empezar
            juntas.
          </Text>
        </Animated.View>

        <Animated.View entering={enter(240)} style={styles.form}>
          <SubmitButton
            label="Volver a iniciar sesión"
            submittingLabel="Volver a iniciar sesión"
            canSubmit
            isSubmitting={false}
            onPress={() => router.replace({ pathname: '/auth', params: { email: trimmedEmail } })}
          />
        </Animated.View>
      </AuthScreenLayout>
    )
  }

  return (
    <AuthScreenLayout>
      <Animated.View entering={enter(80)} style={styles.headerBlock}>
        <Text style={styles.headline}>Crea tu cuenta</Text>
        <Text style={styles.editorial}>Solo tu cuenta por ahora. Lo demás lo vemos juntas.</Text>
      </Animated.View>

      <View style={styles.form}>
        <Animated.View entering={enter(160)} style={styles.fieldBlock}>
          <Field
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            icon="mail"
            accessibilityLabel="Correo electrónico"
            disabled={submitting}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onBlur={() => setEmailTouched(true)}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          {emailError ? (
            <Text style={styles.helper}>Revisa tu correo, parece incompleto.</Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={enter(220)} style={styles.fieldBlock}>
          <Field
            ref={passwordRef}
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 6 caracteres"
            icon="lock"
            accessibilityLabel="Contraseña"
            disabled={submitting}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password-new"
            textContentType="newPassword"
            returnKeyType="next"
            onBlur={() => setPasswordTouched(true)}
            onSubmitEditing={() => confirmRef.current?.focus()}
            trailing={
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={16}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.niebla} />
              </Pressable>
            }
          />
          {passwordError ? (
            <Text style={styles.helper}>Te faltan caracteres — mínimo 6.</Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={enter(280)} style={styles.fieldBlock}>
          <Field
            ref={confirmRef}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Confirma tu contraseña"
            icon="lock"
            accessibilityLabel="Confirmar contraseña"
            disabled={submitting}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password-new"
            textContentType="newPassword"
            returnKeyType="go"
            onBlur={() => setConfirmTouched(true)}
            onSubmitEditing={onSubmit}
          />
          {showMatch ? (
            <Text style={passwordsMatch ? styles.matchOk : styles.matchError}>
              {passwordsMatch ? 'Coinciden' : 'Aún no coinciden.'}
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={enter(320)}>
          <SubmitButton
            label="Crear cuenta"
            submittingLabel="Creando tu cuenta…"
            canSubmit={canSubmit}
            isSubmitting={submitting}
            onPress={onSubmit}
          />
        </Animated.View>

        {/* Error below the button so it never shifts under the finger. */}
        {errorMessage ? (
          <Animated.View entering={enter(0)} style={styles.errorBlock}>
            <Text style={styles.error}>{errorMessage}</Text>
            {emailExists ? (
              <Pressable
                hitSlop={12}
                style={styles.linkTap}
                accessibilityRole="link"
                onPress={() => router.push({ pathname: '/auth', params: { email: trimmedEmail } })}
              >
                <Text style={styles.link}>Iniciar sesión</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}
      </View>

      <Animated.View entering={enter(380)} style={styles.links}>
        <Link href={{ pathname: '/auth', params: { email: trimmedEmail } }} asChild>
          <Pressable hitSlop={12} style={styles.linkTap} accessibilityRole="link">
            <Text style={styles.link}>Ya tengo cuenta</Text>
          </Pressable>
        </Link>
      </Animated.View>
    </AuthScreenLayout>
  )
}

const styles = StyleSheet.create({
  headerBlock: { gap: spacing.sm },
  form: { gap: spacing.md },
  fieldBlock: { gap: spacing.xs },
  sentBody: { gap: spacing.md },
  errorBlock: { gap: spacing.xs },
  headline: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.displaySm,
    color: colors.leche,
    letterSpacing: typography.letterSpacing.displayMed,
  },
  editorial: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
    lineHeight: typography.sizes.bodyLarge * typography.lineHeight.body,
  },
  serifBody: {
    fontFamily: typography.serif,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    lineHeight: typography.sizes.headingLg * typography.lineHeight.statement,
  },
  helper: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    paddingLeft: spacing.xs,
  },
  matchOk: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.feedbackSuccess,
    paddingLeft: spacing.xs,
  },
  matchError: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.feedbackError,
    paddingLeft: spacing.xs,
  },
  error: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.feedbackError,
  },
  links: {
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  linkTap: {
    minHeight: 44,
    justifyContent: 'center',
  },
  link: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
})
