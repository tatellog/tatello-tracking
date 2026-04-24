import { Feather } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native'
import Animated, {
  FadeInDown,
  ZoomIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { duration, easing } from '@/design/motion'
import { shadow, useColors } from '@/design/tokens'
import { Body, Editorial, Headline, Meta } from '@/design/typography'
import { supabase } from '@/lib/supabase'

type Status = 'idle' | 'sending' | 'sent' | 'error'

const enter = (delayMs: number) =>
  FadeInDown.duration(duration.slow).delay(delayMs).springify().damping(18)

/*
 * Magic-link entry point. The user types an email, we call signInWithOtp,
 * and Supabase emails a deep link back into the app. The root layout's
 * useMagicLinkHandler exchanges the tokens when they tap it.
 *
 * Motion language: every state transition carries a rose-gold signal —
 * the input border warms into accent-warm on focus, the submit capsule
 * interpolates from raised (disabled) to accent-warm (ready), and the
 * sent confirmation blooms with a spring. Tap feedback is a 0.97 scale
 * pulse on the UI thread so it never fights the JS bridge.
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
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 justify-between px-6 pb-6 pt-12">
          <BrandMark />

          <View className="gap-8">
            <Animated.View entering={enter(100)} className="gap-3">
              <Headline>Entrá con tu email</Headline>
              <Editorial className="text-secondary">
                Un link mágico. Sin passwords, sin cuentas nuevas.
              </Editorial>
            </Animated.View>

            <Animated.View entering={enter(180)} className="gap-3">
              <Meta>EMAIL</Meta>
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
                <Body className="text-accent-warm-strong">{errorMessage}</Body>
              </Animated.View>
            )}
          </View>

          <Animated.View entering={enter(340)}>
            <Editorial className="text-center text-tertiary">Nunca compartimos tu email</Editorial>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function BrandMark() {
  return (
    <Animated.View entering={enter(0)} className="gap-3">
      <Meta>TRACKING-APP</Meta>
      <View className="h-px w-12 bg-accent-warm/50" />
    </Animated.View>
  )
}

type EmailInputProps = {
  value: string
  onChangeText: (text: string) => void
  onSubmitEditing: () => void
  disabled: boolean
}

/*
 * Email input with an animated focus state. Border interpolates from
 * border-subtle (idle) to accent-warm (focused) over 250ms. The mail
 * glyph and caret both warm to rose-gold to reinforce the signal.
 */
function EmailInput({ value, onChangeText, onSubmitEditing, disabled }: EmailInputProps) {
  const colors = useColors()
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
      [colors.border.subtle, colors.accent.warm],
    ),
  }))

  return (
    <Animated.View
      style={animatedContainer}
      className="flex-row items-center rounded-lg border bg-paper pl-4"
    >
      <Feather
        name="mail"
        size={18}
        color={focused ? colors.accent.warm : colors.content.tertiary}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="tu@email.com"
        placeholderTextColor={colors.content.disabled}
        selectionColor={colors.accent.warm}
        cursorColor={colors.accent.warm}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        editable={!disabled}
        returnKeyType="send"
        className="ml-3 flex-1 py-4 pr-4 text-base text-primary"
      />
    </Animated.View>
  )
}

type SubmitButtonProps = {
  canSubmit: boolean
  isSending: boolean
  onPress: () => void
}

/*
 * Submit capsule — the one place we let the rose-gold breathe. Only the
 * background is animated (raised → accent-warm, 250ms) so the color
 * shift reads as the button "waking up" when the email is valid. Text
 * and icon swap via className for crisp state; they're always the cream
 * `on-accent` tone when the button is ready, disabled-gray otherwise.
 * Tap feedback is a 0.97 scale pulse on the UI thread.
 */
function SubmitButton({ canSubmit, isSending, onPress }: SubmitButtonProps) {
  const colors = useColors()
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
    backgroundColor: interpolateColor(
      ready.value,
      [0, 1],
      [colors.surface.raised, colors.accent.warm],
    ),
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
    <Animated.View
      style={[animatedContainer, canSubmit ? shadow.md : null]}
      className="rounded-full"
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={!canSubmit}
        className="flex-row items-center justify-center gap-2 px-5 py-4"
      >
        {showIcon && <Feather name="arrow-right" size={16} color={colors.content.onAccent} />}
        <Text
          className={
            canSubmit
              ? 'font-serif-italic text-base text-on-accent'
              : 'font-serif-italic text-base text-disabled'
          }
        >
          {isSending ? 'Enviando…' : 'Enviarme el link'}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

/*
 * Sent confirmation — the circle blooms in with a spring (ZoomIn) to make
 * the success moment feel earned. Then the headline and editorial settle
 * in a beat later for a gentle cascade.
 */
function SentState({ email }: { email: string }) {
  const colors = useColors()
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <View className="flex-1 justify-between px-6 pb-6 pt-12">
        <BrandMark />

        <View className="items-center gap-5">
          <Animated.View
            entering={ZoomIn.duration(duration.languid)
              .delay(120)
              .springify()
              .damping(12)
              .stiffness(180)}
            className="h-16 w-16 items-center justify-center rounded-full bg-accent-cool-soft"
          >
            <Feather name="mail" size={26} color={colors.accent.coolStrong} />
          </Animated.View>
          <Animated.View entering={enter(220)} className="items-center gap-3">
            <Headline className="text-center">Revisá tu email</Headline>
            <Editorial className="text-center text-secondary">
              Te mandamos un link a {email}. Abrilo desde el teléfono y te traemos de vuelta.
            </Editorial>
          </Animated.View>
        </View>

        <View />
      </View>
    </SafeAreaView>
  )
}
