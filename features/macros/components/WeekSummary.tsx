import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { WeekRing } from '@/features/macros/components/WeekRing'
import type { WeeklyMealStats } from '@/features/macros/logic'
import { colors, typography } from '@/theme'

/*
 * "Esta semana" — a calm, collapsible weekly read of food, living in the
 * Comidas tab (its natural home; NOT a stats tab, NOT Progreso — that's
 * the body). Manifesto-safe by construction: it surfaces PROTEIN (the
 * cared metric) and logging CONSISTENCY, in coach voice, opening with a
 * warm line before any number. It never counts "good/bad" foods, never
 * shows a %-to-goal, never a calorie headline.
 *
 * Collapsed by default — the day's sky stays the tab's focus; the week is
 * a layer the user opens, not one that asks for attention.
 */

// A weekly claim ("esta semana cuidaste tu proteína") needs enough days
// to be honest — 1-2 logged days isn't a week. Below this we use a gentler
// "still drawing" line so the card never over-claims from thin data.
const MIN_DAYS_FOR_WEEKLY_CLAIM = 3

/** The warm opening line — picks the sentence from the shape of the week,
 *  always observing, never racing or scolding. */
function coachLine(stats: WeeklyMealStats): string {
  const { daysLogged, daysHitProtein } = stats
  if (
    daysHitProtein != null &&
    daysLogged >= MIN_DAYS_FOR_WEEKLY_CLAIM &&
    daysHitProtein * 2 >= daysLogged
  ) {
    return 'Esta semana cuidaste tu proteína. Tu cuerpo lo nota.'
  }
  if (daysLogged >= 4) {
    return 'Vas dejando rastro. Cada registro te ayuda a verte.'
  }
  return 'Tu semana se está dibujando, día a día.'
}

function ConsistencyLine({ stats }: { stats: WeeklyMealStats }) {
  // No fixed "/7" denominator — a count, never a streak/quota (which the
  // manifesto forbids). "Registraste · N días" observes, doesn't grade.
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>Registraste</Text>
      <Text style={styles.rowValue}>
        <Text style={styles.rowNum}>{stats.daysLogged}</Text>
        <Text style={styles.rowUnit}> días</Text>
      </Text>
    </View>
  )
}

function ProteinLine({ stats }: { stats: WeeklyMealStats }) {
  if (stats.proteinTarget != null && stats.daysHitProtein != null) {
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Proteína en tu referencia</Text>
        <Text style={styles.rowValue}>
          <Text style={styles.rowNum}>{stats.daysHitProtein}</Text>
          <Text style={styles.rowUnit}> de {stats.daysLogged} días</Text>
        </Text>
      </View>
    )
  }
  if (stats.proteinAvgPerLoggedDay != null) {
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Proteína promedio</Text>
        <Text style={styles.rowValue}>
          <Text style={styles.rowNum}>{Math.round(stats.proteinAvgPerLoggedDay)}</Text>
          <Text style={styles.rowUnit}> g por día</Text>
        </Text>
      </View>
    )
  }
  return null
}

export function WeekSummary({
  stats,
  isLoading,
  isError,
}: {
  stats: WeeklyMealStats | null
  isLoading: boolean
  isError: boolean
}) {
  // Hide the section entirely while the first load is in flight or on
  // error — a weekly read is supplementary; it should never block the day.
  if (isLoading || isError || !stats) return null

  const hasData = stats.daysLogged > 0

  // Always visible (not collapsible) — the owner wants the week present,
  // not behind a tap.
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <EyebrowLabel tone="magenta" size={10}>
          Esta semana
        </EyebrowLabel>
      </View>

      <Animated.View entering={FadeIn.duration(260)} style={styles.body}>
        {hasData ? (
          <>
            <Text style={styles.coach}>{coachLine(stats)}</Text>
            <WeekRing stats={stats} />
            <ConsistencyLine stats={stats} />
            <ProteinLine stats={stats} />
          </>
        ) : (
          <Text style={styles.empty}>
            Tu semana apenas comienza. Con unos días de registro aparece tu patrón.
          </Text>
        )}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 22,
  },
  header: {
    paddingVertical: 4,
  },
  body: {
    marginTop: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  // The warm line opens the card, before any number.
  coach: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.bone,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  rowLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    flex: 1,
  },
  rowValue: {
    marginLeft: 12,
  },
  rowNum: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.heading,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  rowUnit: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  empty: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.bone,
    textAlign: 'center',
    paddingVertical: 8,
  },
})
