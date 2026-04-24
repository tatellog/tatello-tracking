import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radius, shadows, spacing, typography } from '@/theme'

type Props = {
  onUndo: () => void
}

/*
 * Custom toast body for the 'sealed' type registered in the root
 * layout. Renders a check + 'Entreno sellado' + a Deshacer pill.
 *
 * The library auto-dismisses the toast after `visibilityTime`;
 * the onUndo callback should also call Toast.hide() so the user
 * doesn't keep staring at a toast that no longer represents reality.
 */
export function SealedToast({ onUndo }: Props) {
  return (
    <View style={styles.toast}>
      <Text style={styles.check}>✓</Text>
      <Text style={styles.text}>Entreno sellado</Text>
      <Pressable
        onPress={onUndo}
        accessibilityRole="button"
        accessibilityLabel="Deshacer entreno"
        style={styles.undoBtn}
      >
        <Text style={styles.undoLabel}>Deshacer</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.forestDeep,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    marginHorizontal: spacing.xl,
    ...shadows.card,
  },
  check: {
    color: colors.copperBright,
    fontSize: 18,
    fontWeight: '700',
  },
  text: {
    flex: 1,
    fontFamily: typography.prose,
    fontSize: typography.sizes.body,
    fontStyle: 'italic',
    color: colors.creamWarm,
  },
  undoBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.copperVivid,
  },
  undoLabel: {
    fontFamily: typography.prose,
    fontSize: typography.sizes.smallLabel + 1,
    fontStyle: 'italic',
    color: colors.creamWarm,
    fontWeight: '600',
  },
})
