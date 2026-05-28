import { usePathname } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { requireUserId, supabase } from '@/lib/supabase'
import { colors, radius, spacing, typography } from '@/theme'

/*
 * Beta feedback sheet — text input + send, captured against the
 * pathname the user was on when they tapped open. Renders as a
 * RN Modal with slide-up animation; dim backdrop press dismisses.
 *
 * State machine:
 *   idle    → typing + send button enabled when ≥ 3 chars
 *   sending → button disabled, label swaps to "Enviando…"
 *   sent    → warm "gracias" confirmation, auto-closes after 1.5 s
 *   error   → inline message, sheet stays open so the text isn't lost
 *
 * Surface gating (only render for beta users) lives on the callers —
 * this component just renders; it doesn't check is_beta itself so
 * the same sheet can be reused from Settings without re-checking.
 */
type Props = {
  visible: boolean
  onClose: () => void
}

type SheetState = 'idle' | 'sending' | 'sent' | 'error'

const MAX_LENGTH = 2000

export function BetaFeedbackSheet({ visible, onClose }: Props) {
  const pathname = usePathname()
  const [capturedScreen, setCapturedScreen] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [state, setState] = useState<SheetState>('idle')

  // Capture pathname at OPEN — not at send — so if the user opens the
  // sheet on Mes and then navigates to Día before sending, the row
  // still reflects "where they were when they decided to write".
  useEffect(() => {
    if (visible) {
      setCapturedScreen(pathname || null)
    } else {
      // Reset between opens so a previous send's success state isn't
      // sitting around the next time the sheet appears.
      setMessage('')
      setState('idle')
      setCapturedScreen(null)
    }
  }, [visible, pathname])

  // After a successful send, auto-close after 1.5 s so the user
  // sees the "gracias" beat before the sheet dismisses.
  useEffect(() => {
    if (state !== 'sent') return
    const timer = setTimeout(onClose, 1500)
    return () => clearTimeout(timer)
  }, [state, onClose])

  const trimmed = message.trim()
  const canSend = trimmed.length >= 3 && state === 'idle'

  const handleSend = async () => {
    if (!canSend) return
    setState('sending')
    try {
      const userId = await requireUserId()
      const { error } = await supabase.from('beta_feedback').insert({
        user_id: userId,
        message: trimmed,
        screen: capturedScreen,
      })
      if (error) throw error
      setState('sent')
    } catch {
      setState('error')
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar feedback"
        />
        <View style={styles.sheet}>
          {state === 'sent' ? (
            <View style={styles.sentWrap}>
              <Text style={styles.sentTitle}>Gracias.</Text>
              <Text style={styles.sentBody}>Lo leemos.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Cuéntanos</Text>
              <Text style={styles.hint}>
                Lo que sea — un bug, una idea, qué te confunde, qué te enamoró.
              </Text>
              <TextInput
                value={message}
                onChangeText={(t) => setMessage(t.slice(0, MAX_LENGTH))}
                placeholder="Escribe aquí…"
                placeholderTextColor={colors.niebla}
                multiline
                autoFocus
                editable={state === 'idle' || state === 'error'}
                style={styles.input}
                textAlignVertical="top"
              />
              {state === 'error' ? (
                <Text style={styles.errorText}>
                  No se pudo enviar. Intenta otra vez en un momento.
                </Text>
              ) : null}
              <View style={styles.row}>
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar"
                  style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
                >
                  <Text style={styles.btnGhostLabel}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={handleSend}
                  disabled={!canSend}
                  accessibilityRole="button"
                  accessibilityLabel="Enviar feedback"
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnPrimary,
                    !canSend && styles.btnDisabled,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <Text style={styles.btnPrimaryLabel}>
                    {state === 'sending' ? 'Enviando…' : 'Enviar'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheet: {
    marginTop: 'auto',
    paddingHorizontal: spacing.s5,
    paddingTop: spacing.s5,
    paddingBottom: spacing.s7,
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  title: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  hint: {
    marginTop: spacing.s2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: typography.sizes.body * typography.lineHeight.body,
    color: colors.bone,
  },
  input: {
    marginTop: spacing.s4,
    minHeight: 120,
    maxHeight: 200,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
    borderRadius: radius.cell,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.bg,
    color: colors.leche,
    fontFamily: typography.ui,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: typography.sizes.bodyLarge * typography.lineHeight.body,
  },
  errorText: {
    marginTop: spacing.s2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.feedbackError,
  },
  row: {
    marginTop: spacing.s4,
    flexDirection: 'row',
    gap: spacing.s3,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.s3,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  btnPrimary: {
    backgroundColor: colors.magenta,
    borderColor: colors.magenta,
  },
  btnDisabled: { opacity: 0.4 },
  btnPressed: { opacity: 0.7 },
  btnGhostLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  btnPrimaryLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  // Sent state — warm two-line confirmation.
  sentWrap: {
    alignItems: 'center',
    paddingVertical: spacing.s5,
  },
  sentTitle: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.displaySm,
    color: colors.leche,
  },
  sentBody: {
    marginTop: spacing.s2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
})
