import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated'

import { colors, radius, shadows, spacing, typography } from '@/theme'

import type { ConfirmAction, ConfirmRequest } from './ConfirmProvider'

type Props = {
  request: ConfirmRequest | null
  onPick: (id: string) => void
  onDismiss: () => void
}

/*
 * Visual presentation of the confirm flow. Backdrop fades in over
 * the screen; the card zooms in with a soft spring. Tap the backdrop
 * (or the cancel action) to dismiss; tap any other action to resolve
 * the pending promise with that action's id.
 *
 * The action stack is sorted so cancel sits at the bottom — matches
 * the iOS Action Sheet convention so muscle memory carries over from
 * the system dialog this replaces.
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
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />

          <Animated.View
            style={styles.card}
            entering={ZoomIn.duration(220).springify().damping(16)}
            exiting={ZoomOut.duration(160)}
          >
            {request ? <Text style={styles.title}>{request.title}</Text> : null}
            {request?.description ? (
              <Text style={styles.description}>{request.description}</Text>
            ) : null}

            <View style={styles.actions}>
              {orderedActions.map((action) => (
                <ActionButton
                  key={action.id}
                  action={action}
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
          </Animated.View>
        </Animated.View>
      ) : null}
    </Modal>
  )
}

function ActionButton({ action, onPress }: { action: ConfirmAction; onPress: () => void }) {
  const variant = action.style ?? 'default'
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBase,
        variant === 'cancel' && styles.actionCancel,
        variant === 'default' && styles.actionDefault,
        variant === 'destructive' && styles.actionDestructive,
        pressed && styles.actionPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={action.label}
    >
      <Text
        style={[
          styles.actionLabel,
          variant === 'cancel' && styles.actionLabelCancel,
          (variant === 'default' || variant === 'destructive') && styles.actionLabelLight,
        ]}
      >
        {action.label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 26, 31, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.pearlElevated,
    borderRadius: radius.card,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
  },
  title: {
    fontFamily: typography.displayMedium,
    fontSize: 20,
    letterSpacing: -0.5,
    color: colors.inkPrimary,
    textAlign: 'center',
  },
  description: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    lineHeight: typography.sizes.body * typography.lineHeight.body,
    color: colors.labelMuted,
    textAlign: 'center',
  },
  actions: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  actionBase: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  actionCancel: {
    backgroundColor: colors.pearlBase,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  actionDefault: {
    backgroundColor: colors.mauveDeep,
  },
  actionDestructive: {
    backgroundColor: colors.feedbackError,
  },
  actionPressed: {
    opacity: 0.9,
  },
  actionLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
  },
  actionLabelCancel: {
    color: colors.inkPrimary,
  },
  actionLabelLight: {
    color: colors.pearlBase,
  },
})
