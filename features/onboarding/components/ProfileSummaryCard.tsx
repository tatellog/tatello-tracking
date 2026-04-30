import { StyleSheet, Text, View } from 'react-native'

import type { Goal, Profile } from '@/features/profile/api'
import { colors, typography } from '@/theme'

type Props = {
  profile: Profile
  weightKg: number | null
}

const GOAL_LABEL: Record<Goal, string> = {
  recomposition: 'Recomposición',
  lose_fat: 'Bajar grasa',
  gain_muscle: 'Ganar músculo',
  maintain: 'Mantener',
}

/*
 * 2×2 grid of the four datapoints captured during the wizard. Lives
 * on Día 1 as a "this is the you we know" mirror — every label is in
 * a dim caps eyebrow and every value is in display sans, so the card
 * reads like a dossier rather than a form.
 *
 * weightKg comes from the brief's latest_measurement (the row inserted
 * by step C.6) instead of profile, because weight isn't on profile.
 */
export function ProfileSummaryCard({ profile, weightKg }: Props) {
  const age = profile.date_of_birth ? calculateAge(profile.date_of_birth) : null
  const goalLabel = profile.goal ? GOAL_LABEL[profile.goal as Goal] : '—'

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Tu perfil</Text>
      <View style={styles.grid}>
        <Item label="Edad" value={age != null ? `${age} años` : '—'} />
        <Item label="Altura" value={profile.height_cm ? `${profile.height_cm} cm` : '—'} />
        <Item label="Peso" value={weightKg != null ? `${weightKg.toFixed(1)} kg` : '—'} />
        <Item label="Objetivo" value={goalLabel} />
      </View>
    </View>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.item}>
      <Text style={styles.itemLabel}>{label}</Text>
      <Text style={styles.itemValue}>{value}</Text>
    </View>
  )
}

function calculateAge(iso: string): number {
  const parts = iso.split('-').map(Number)
  const y = parts[0] ?? 1970
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  const birth = new Date(y, m - 1, d)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const md = today.getMonth() - birth.getMonth()
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age -= 1
  return age
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.pearlElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  cardLabel: {
    fontFamily: typography.uiSemi,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.labelDim,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  item: {
    width: '50%',
    paddingRight: 8,
  },
  itemLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 9,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.labelDim,
    marginBottom: 4,
  },
  itemValue: {
    fontFamily: typography.displayMedium,
    fontSize: 13,
    letterSpacing: -0.3,
    color: colors.inkPrimary,
  },
})
