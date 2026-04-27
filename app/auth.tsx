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
  ZoomIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { supabase } from '@/lib/supabase'
import { colors, duration, easing, radius, shadows, spacing, typography } from '@/theme'

type Status = 'idle' | 'sending' | 'sent' | 'error'

const enter = (delayMs: number) =>
  FadeInDown.duration(duration.slow).delay(delayMs).springify().damping(18)

/*
 * Magic-link entry point. Typing an email + submitting fires
 * signInWithOtp; Supabase sends a link that deep-links back into the
 * app, where useMagicLinkHandler at the root exchanges the tokens.
 *
 * Motion language: the input border warms into copper on focus, the
 * submit capsule interpolates from raised (disabled) to copper (ready),
 * and the sent confirmation blooms with a spring. Tap feedback is a
 * 0.97 scale pulse on the UI thread so it never fights the JS bridge.
 */
export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const trimmed = email.trim()
  const canSubmit = trimmed.length > 0 && status !== 'sending'
  const isSending = status === 'sending'

  const onSubmit = async () => {
    if (!canSubmit) return
    setStatus('sending')
    setErrorMessage(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: 'tracking-app://auth/callback',
        shouldCreateUser: true,
      },
    })
    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
      return
    }
    setStatus('sent')
  }

  if (status === 'sent') {
    return <SentState email={trimmed} />
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <BrandMark />

          <View style={styles.stack}>
            <Animated.View entering={enter(100)} style={{ gap: spacing.sm }}>
              <Text style={styles.headline}>Entrá con tu email</Text>
              <Text style={styles.editorial}>
                Un link mágico. Sin passwords, sin cuentas nuevas.
              </Text>
            </Animated.View>

            <Animated.View entering={enter(180)} style={{ gap: spacing.sm }}>
              <Text style={styles.meta}>EMAIL</Text>
              <EmailInput
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={onSubmit}
                disabled={isSending}
              />
            </Animated.View>

            <Animated.View entering={enter(260)}>
              <SubmitButton canSubmit={canSubmit} isSending={isSending} onPress={onSubmit} />
            </Animated.View>

            {errorMessage && (
              <Animated.View entering={enter(0)}>
                <Text style={styles.error}>{errorMessage}</Text>
              </Animated.View>
            )}
          </View>

          <Animated.View entering={enter(340)}>
            <Text style={[styles.editorial, styles.footerNote]}>Nunca compartimos tu email</Text>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function BrandMark() {
  return (
    <Animated.View entering={enter(0)} style={{ gap: spacing.sm }}>
      <Text style={styles.meta}>TRACKING-APP</Text>
      <View style={styles.brandBar} />
    </Animated.View>
  )
}

type EmailInputProps = {
  value: string
  onChangeText: (text: string) => void
  onSubmitEditing: () => void
  disabled: boolean
}

function EmailInput({ value, onChangeText, onSubmitEditing, disabled }: EmailInputProps) {
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
      <Feather name="mail" size={18} color={focused ? colors.mauveDeep : colors.labelDim} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="tu@email.com"
        placeholderTextColor={colors.labelDim}
        selectionColor={colors.mauveDeep}
        cursorColor={colors.mauveDeep}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        editable={!disabled}
        returnKeyType="send"
        style={styles.input}
      />
    </Animated.View>
  )
}

type SubmitButtonProps = {
  canSubmit: boolean
  isSending: boolean
  onPress: () => void
}

function SubmitButton({ canSubmit, isSending, onPress }: SubmitButtonProps) {
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

  const showIcon = canSubmit && !isSending

  return (
    <Animated.View style={[styles.submitWrap, canSubmit && shadows.card, animatedContainer]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={!canSubmit}
        style={styles.submitPressable}
      >
        {showIcon && <Feather name="arrow-right" size={16} color={colors.pearlBase} />}
        <Text style={[styles.submitLabel, !canSubmit && styles.submitLabelDisabled]}>
          {isSending ? 'Enviando…' : 'Enviarme el link'}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

function SentState({ email }: { email: string }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <BrandMark />

        <View style={styles.sentBlock}>
          <Animated.View
            entering={ZoomIn.duration(duration.languid)
              .delay(120)
              .springify()
              .damping(12)
              .stiffness(180)}
            style={styles.sentIcon}
          >
            <Feather name="mail" size={26} color={colors.mauveDeep} />
          </Animated.View>
          <Animated.View entering={enter(220)} style={styles.sentText}>
            <Text style={[styles.headline, styles.centered]}>Revisá tu email</Text>
            <Text style={[styles.editorial, styles.centered]}>
              Te mandamos un link a {email}. Abrilo desde el teléfono y te traemos de vuelta.
            </Text>
          </Animated.View>
        </View>

        <View />
      </View>
    </SafeAreaView>
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
    gap: spacing.xxl,
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
    color: colors.mauveDeep,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.tile,
    borderWidth: 1,
    backgroundColor: colors.pearlBase,
    paddingLeft: spacing.md,
  },
  input: {
    flex: 1,
    marginLeft: spacing.sm,
    paddingVertical: 14,
    paddingRight: spacing.md,
    fontSize: typography.sizes.body,
    color: colors.inkPrimary,
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

  sentBlock: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  sentIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.pearlBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentText: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  centered: {
    textAlign: 'center',
  },
})
