import * as Haptics from 'expo-haptics'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import type { Enfoque } from '@/features/profile/calcMacros'
import { colors, radius, spacing, typography } from '@/theme'

import { ArrowUpIcon, FlameIcon, ScaleIcon } from './GoalIcons'

/*
 * "Elige tu enfoque" — three mutually exclusive cards (Déficit /
 * Mantenimiento / Superávit). Picking one re-tunes the whole macro
 * preview upstream. Selected = magenta border + tint + check; the rest
 * stay quiet (hairline on bgCard). Read-only labels — no pressure copy.
 */

type Option = {
  key: Enfoque
  label: string
  sub: string
  Icon: typeof FlameIcon
}

const OPTIONS: readonly Option[] = [
  { key: 'deficit', label: 'Déficit', sub: 'Perder grasa', Icon: FlameIcon },
  { key: 'maintain', label: 'Mantenimiento', sub: 'Mantener peso', Icon: ScaleIcon },
  { key: 'surplus', label: 'Superávit', sub: 'Ganar músculo', Icon: ArrowUpIcon },
]

type Props = {
  value: Enfoque
  onChange: (next: Enfoque) => void
}

export function EnfoqueSelector({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => {
        const selected = opt.key === value
        const tint = selected ? colors.magenta : colors.niebla
        return (
          <Pressable
            key={opt.key}
            onPress={() => {
              if (selected) return
              if (Platform.OS !== 'web') Haptics.selectionAsync()
              onChange(opt.key)
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${opt.label}. ${opt.sub}`}
            style={[styles.card, selected && styles.cardSelected]}
          >
            {selected ? (
              <View style={styles.check}>
                <Text style={styles.checkMark}>✓</Text>
              </View>
            ) : null}
            <opt.Icon color={tint} size={22} />
            <Text style={[styles.label, selected && styles.labelSelected]}>{opt.label}</Text>
            <Text style={styles.sub}>{opt.sub}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  cardSelected: {
    borderColor: colors.magenta,
    borderWidth: 1,
    backgroundColor: colors.magentaTint,
  },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.magenta,
  },
  checkMark: {
    fontSize: 9,
    lineHeight: 11,
    color: colors.leche,
    fontFamily: typography.uiSemi,
  },
  label: {
    marginTop: 2,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  labelSelected: {
    color: colors.leche,
  },
  sub: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    textAlign: 'center',
  },
})
