import { BlurView } from 'expo-blur'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { PrimaryCta, type CtaVariant } from '@/components/PrimaryCta'
import { colors, shadows, typography } from '@/theme'

import type { ConfirmAction, ConfirmRequest } from './ConfirmProvider'

type Props = {
  request: ConfirmRequest | null
  onPick: (id: string) => void
  onDismiss: () => void
}

/* Maps an action's intent onto the app's CTA variants, so the dialog
 * buttons read identically to every other button in the app. */
function variantFor(style: ConfirmAction['style']): CtaVariant {
  if (style === 'destructive') return 'destructive'
  if (style === 'cancel') return 'ghost'
  return 'primary'
}

/*
 * Visual presentation of the confirm flow. The screen behind frosts
 * into a dark blur; the card sits over it with no motion of its own.
 * Tap the blur (or the cancel action) to dismiss; tap any other
 * action to resolve the pending promise with that action's id.
 *
 * Actions render through the shared PrimaryCta so they match the
 * app's button language. The stack is sorted so cancel sits at the
 * bottom — the iOS Action Sheet convention.
 */
export function ConfirmDialog({ request, onPick, onDismiss }: Props) {
  const visible = request !== null

  // Reorder so cancel is always last; everything else preserves the
  // caller's order. Defensive about callers that omit cancel —
  // tapping the backdrop still dismisses with null in that case.
  const orderedActions = request
    ? [
        ...request.actions.filter((a) => a.style !== 'cancel'),
        ...request.actions.filter((a) => a.style === 'cancel'),
      ]
    : []

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      {visible ? (
        <Animated.View
          style={styles.backdrop}
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(160)}
        >
          {/* Frosted blur + a warm dark scrim for card contrast. */}
          <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.scrim} />

          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />

          <View style={styles.card}>
            {request ? <Text style={styles.title}>{request.title}</Text> : null}
            {request?.description ? (
              <Text style={styles.description}>{request.description}</Text>
            ) : null}

            <View style={styles.actions}>
              {orderedActions.map((action) => (
                <PrimaryCta
                  key={action.id}
                  label={action.label}
                  variant={variantFor(action.style)}
                  onPress={() => {
                    if (action.style === 'cancel') {
                      onDismiss()
                    } else {
                      onPick(action.id)
                    }
                  }}
                />
              ))}
            </View>
          </View>
        </Animated.View>
      ) : null}
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  // Sits over the blur — deepens it and lifts the card off the frost.
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 6, 8, 0.42)',
  },
  card: {
    width: '100%',
    maxWidth: 330,
    backgroundColor: colors.bgCard2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingTop: 24,
    paddingBottom: 18,
    paddingHorizontal: 20,
    ...shadows.card,
  },
  title: {
    fontFamily: typography.displaySemi,
    fontSize: 19,
    letterSpacing: -0.4,
    color: colors.leche,
    textAlign: 'center',
  },
  description: {
    marginTop: 7,
    fontFamily: typography.ui,
    fontSize: 14,
    lineHeight: 20,
    color: colors.bone,
    textAlign: 'center',
  },
  actions: {
    marginTop: 22,
    gap: 10,
  },
})
