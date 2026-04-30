import { Feather } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, {
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { supabase } from '@/lib/supabase'
import { colors, duration, easing, radius, shadows, spacing, typography } from '@/theme'

const enter = (delayMs: number) =>
  FadeInDown.duration(duration.slow).delay(delayMs).springify().damping(18)

const MIN_PASSWORD_LENGTH = 6

/*
 * Email + password sign-in with auto-signup as fallback.
 *
 * Flow:
 *   1. signInWithPassword(email, password)
 *   2. If Supabase reports "Invalid login credentials", treat it as
 *      "user not found" and try signUp(email, password). When the
 *      project has "Confirm email" disabled (recommended for dev),
 *      signUp returns a session immediately — RouteGuard takes over.
 *   3. If signUp says the user already exists, the original signIn
 *      failure was actually a wrong password — surface that.
 *
 * For this to work end-to-end the Supabase project needs:
 *   - Authentication → Providers → Email → enabled
 *   - Authentication → Providers → Email → "Confirm email" OFF
 *     (or signUp will return session=null and the user gets stuck on
 *     this screen waiting for an email they didn't ask for).
 *
 * Magic-link / OAuth providers are not part of this screen yet —
 * they'll come back as separate sign-in paths once the project's
 * auth providers are configured. The code from earlier is preserved
 * in git history.
 */

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const trimmedEmail = email.trim()
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
  const isPasswordValid = password.length >= MIN_PASSWORD_LENGTH
  const canSubmit = isEmailValid && isPasswordValid && !submitting

  const onSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setErrorMessage(null)

    try {
      const signIn = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (!signIn.error) {
        // RouteGuard will read the session change and redirect.
        return
      }

      // Supabase returns the same error for "user not found" and
      // "wrong password" so it can't enumerate accounts. We use
      // signUp as the disambiguator.
      const isInvalidCredentials = /invalid login credentials/i.test(signIn.error.message)
      if (!isInvalidCredentials) throw signIn.error

      const signUp = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      })

      if (signUp.error) {
        if (/already registered/i.test(signUp.error.message)) {
          throw new Error('Contraseña incorrecta para esa cuenta.')
        }
        throw signUp.error
      }

      // signUp returned. With "Confirm email" off, session is set
      // and RouteGuard takes over. With confirm on, session is null
      // and we surface a hint instead of silently doing nothing.
      if (!signUp.data.session) {
        throw new Error(
          'Tu cuenta fue creada pero falta confirmar el email. Pedile al admin desactivar "Confirm email" en Supabase.',
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No pudimos iniciar sesión.'
      setErrorMessage(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <Animated.View entering={enter(0)} style={{ gap: spacing.sm }}>
            <Text style={styles.meta}>TRACKING-APP</Text>
            <View style={styles.brandBar} />
          </Animated.View>

          <View style={styles.stack}>
            <Animated.View entering={enter(100)} style={{ gap: spacing.sm }}>
              <Text style={styles.headline}>Entrá a tracking-app</Text>
              <Text style={styles.editorial}>
                Si ya tenés cuenta, ponemos tu email y contraseña. Si es la primera vez, te creamos
                la cuenta automáticamente.
              </Text>
            </Animated.View>

            <Animated.View entering={enter(180)} style={{ gap: spacing.sm }}>
              <Text style={styles.meta}>EMAIL</Text>
              <Field
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
                icon="mail"
                disabled={submitting}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
              />
            </Animated.View>

            <Animated.View entering={enter(240)} style={{ gap: spacing.sm }}>
              <Text style={styles.meta}>CONTRASEÑA</Text>
              <Field
                value={password}
                onChangeText={setPassword}
                placeholder="Mínimo 6 caracteres"
                icon="lock"
                disabled={submitting}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                trailing={
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={18}
                      color={colors.labelMuted}
                    />
                  </Pressable>
                }
              />
            </Animated.View>

            <Animated.View entering={enter(300)}>
              <SubmitButton canSubmit={canSubmit} isSubmitting={submitting} onPress={onSubmit} />
            </Animated.View>

            {errorMessage ? (
              <Animated.View entering={enter(0)}>
                <Text style={styles.error}>{errorMessage}</Text>
              </Animated.View>
            ) : null}
          </View>

          <Animated.View entering={enter(360)}>
            <Text style={[styles.editorial, styles.footerNote]}>
              Sin verificación de email. Volvemos a entrar con esta misma combinación.
            </Text>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

type FieldIcon = 'mail' | 'lock'

type FieldProps = {
  value: string
  onChangeText: (v: string) => void
  placeholder: string
  icon: FieldIcon
  disabled: boolean
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'email-address'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoComplete?: 'email' | 'password' | 'off'
  textContentType?: 'emailAddress' | 'password'
  returnKeyType?: 'next' | 'go' | 'done' | 'send'
  onSubmitEditing?: () => void
  trailing?: React.ReactNode
}

function Field({
  value,
  onChangeText,
  placeholder,
  icon,
  disabled,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  trailing,
}: FieldProps) {
  const [focused, setFocused] = useState(false)
  const focusProgress = useSharedValue(0)

  useEffect(() => {
    focusProgress.value = withTiming(focused ? 1 : 0, {
      duration: duration.standard,
      easing: easing.standard,
    })
  }, [focusProgress, focused])

  const animatedContainer = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusProgress.value,
      [0, 1],
      [colors.borderDashed, colors.mauveDeep],
    ),
  }))

  return (
    <Animated.View style={[styles.inputContainer, animatedContainer]}>
      <Feather name={icon} size={18} color={focused ? colors.mauveDeep : colors.labelDim} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.labelDim}
        selectionColor={colors.mauveDeep}
        cursorColor={colors.mauveDeep}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        textContentType={textContentType}
        editable={!disabled}
        returnKeyType={returnKeyType}
        style={styles.input}
      />
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Animated.View>
  )
}

type SubmitButtonProps = {
  canSubmit: boolean
  isSubmitting: boolean
  onPress: () => void
}

function SubmitButton({ canSubmit, isSubmitting, onPress }: SubmitButtonProps) {
  const scale = useSharedValue(1)
  const ready = useSharedValue(canSubmit ? 1 : 0)

  useEffect(() => {
    ready.value = withTiming(canSubmit ? 1 : 0, {
      duration: duration.standard,
      easing: easing.standard,
    })
  }, [ready, canSubmit])

  const animatedContainer = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(ready.value, [0, 1], [colors.pearlBase, colors.mauveDeep]),
  }))

  const onPressIn = () => {
    if (!canSubmit) return
    scale.value = withTiming(0.97, { duration: duration.quick, easing: easing.out })
  }
  const onPressOut = () => {
    scale.value = withTiming(1, { duration: duration.standard, easing: easing.out })
  }

  const showIcon = canSubmit && !isSubmitting

  return (
    <Animated.View style={[styles.submitWrap, canSubmit && shadows.card, animatedContainer]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={!canSubmit}
        style={styles.submitPressable}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit, busy: isSubmitting }}
      >
        {showIcon && <Feather name="arrow-right" size={16} color={colors.pearlBase} />}
        <Text style={[styles.submitLabel, !canSubmit && styles.submitLabelDisabled]}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.pearlBase,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: 48,
    paddingBottom: spacing.xl,
  },
  stack: {
    gap: spacing.lg,
  },
  brandBar: {
    height: 1,
    width: 48,
    backgroundColor: colors.mauveDeep,
    opacity: 0.5,
  },
  headline: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.anchor,
    color: colors.inkPrimary,
    letterSpacing: typography.letterSpacing.displayMed,
  },
  editorial: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.labelMuted,
    lineHeight: typography.sizes.bodyLarge * typography.lineHeight.body,
  },
  footerNote: {
    textAlign: 'center',
    color: colors.labelDim,
  },
  meta: {
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.labelMuted,
  },
  error: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.feedbackError,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.tile,
    borderWidth: 1,
    backgroundColor: colors.pearlBase,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  input: {
    flex: 1,
    marginLeft: spacing.sm,
    paddingVertical: 14,
    paddingRight: spacing.sm,
    fontSize: typography.sizes.body,
    color: colors.inkPrimary,
  },
  trailing: {
    paddingHorizontal: spacing.sm,
  },

  submitWrap: {
    borderRadius: radius.pill,
  },
  submitPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  submitLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.pearlBase,
  },
  submitLabelDisabled: {
    color: colors.labelDim,
  },
})
