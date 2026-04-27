import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radius, spacing, typography } from '@/theme'

/*
 * Two semi-transparent pills that deep-link to the progress/measure
 * flows. The target screens are placeholders in Sprint 2 — the pills
 * just need to exist, be tappable, and match the mockup's visual
 * weight (overlay-on-cream with a thin gold border).
 */
export function QuickActions() {
  const router = useRouter()

  return (
    <View style={styles.row}>
      <ActionPill icon="📸" label="Progreso" onPress={() => router.push('/(tabs)/progress')} />
      <ActionPill icon="⚖" label="Medida" onPress={() => router.push('/(tabs)/progress')} />
    </View>
  )
}

type ActionPillProps = {
  icon: string
  label: string
  onPress: () => void
}

function ActionPill({ icon, label, onPress }: ActionPillProps) {
  return (
    <Pressable onPress={onPress} style={styles.pill}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.pearlElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  icon: {
    fontSize: 14,
  },
  label: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    fontWeight: typography.fontWeight.medium,
    color: colors.inkPrimary,
  },
})
