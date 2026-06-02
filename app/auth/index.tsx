import { Feather } from '@expo/vector-icons'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { signIn } from '@/features/auth/api'
import { colors, duration, spacing, typography } from '@/theme'

import { AuthScreenLayout } from './components/AuthScreenLayout'
import { Field } from './components/Field'
import { SubmitButton } from './components/SubmitButton'

const enter = (delayMs: number) =>
  FadeInDown.duration(duration.slow).delay(delayMs).springify().damping(18)

const isEmailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

export default function LoginScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState(params.email ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const trimmedEmail = email.trim()
  // Login: any non-empty password (don't enforce length on an existing
  // account — that's a sign-up rule).
  const canSubmit = isEmailValid(trimmedEmail) && password.length > 0 && !submitting

  const onSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setErrorMessage(null)
    // On ok:true we do NOT navigate — RouteGuard reacts to the session.
    const result = await signIn(trimmedEmail, password)
    if (!result.ok) {
      setErrorMessage(result.message)
      setSubmitting(false)
    }
  }

  return (
    <AuthScreenLayout>
      <Animated.View entering={enter(80)} style={styles.headerBlock}>
        <Text style={styles.headline}>Bienvenida de vuelta</Text>
        <Text style={styles.editorial}>Entra con tu correo y contraseña.</Text>
      </Animated.View>

      <View style={styles.form}>
        <Animated.View entering={enter(160)}>
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
          />
        </Animated.View>

        <Animated.View entering={enter(220)}>
          <Field
            value={password}
            onChangeText={setPassword}
            placeholder="Tu contraseña"
            icon="lock"
            accessibilityLabel="Contraseña"
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
                hitSlop={16}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.niebla} />
              </Pressable>
            }
          />
        </Animated.View>

        {errorMessage ? (
          <Animated.View entering={enter(0)}>
            <Text style={styles.error}>{errorMessage}</Text>
          </Animated.View>
        ) : null}

        <Animated.View entering={enter(280)}>
          <SubmitButton
            label="Entrar"
            submittingLabel="Entrando…"
            canSubmit={canSubmit}
            isSubmitting={submitting}
            onPress={onSubmit}
          />
        </Animated.View>
      </View>

      <Animated.View entering={enter(340)} style={styles.links}>
        <Link
          href={{ pathname: '/auth/sign-up', params: { email: trimmedEmail } }}
          asChild
          push
        >
          <Pressable hitSlop={12} style={styles.linkTap} accessibilityRole="link">
            <Text style={styles.link}>¿Primera vez? Crear cuenta</Text>
          </Pressable>
        </Link>
        <Pressable
          hitSlop={12}
          style={styles.linkTap}
          accessibilityRole="link"
          onPress={() =>
            router.push({ pathname: '/auth/reset', params: { email: trimmedEmail } })
          }
        >
          <Text style={styles.linkMuted}>¿Olvidaste tu contraseña?</Text>
        </Pressable>
      </Animated.View>
    </AuthScreenLayout>
  )
}

const styles = StyleSheet.create({
  headerBlock: { gap: spacing.sm },
  form: { gap: spacing.md },
  meta: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.oro,
  },
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
  error: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.feedbackError,
  },
  links: {
    gap: spacing.sm,
    alignItems: 'center',
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
  linkMuted: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
