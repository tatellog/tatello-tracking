import { type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import type { WeeklyMealStats } from '@/features/macros/logic'
import { colors, typography } from '@/theme'

/*
 * "Esta semana" — a calm weekly read of food, living in the Comidas tab
 * (its natural home; NOT a stats tab, NOT Progreso — that's the body).
 * Manifesto-safe by construction: it surfaces PROTEIN (the cared metric)
 * and logging CONSISTENCY as plain counts, in coach voice, opening with a
 * warm line before any number. It never counts "good/bad" foods, never
 * shows a %-to-goal, never a calorie headline, never a "/7" quota.
 *
 * Three stats in a row — comidas · días con registro · proteína/día — in
 * a NEUTRAL data language (line icons, not moon/star glyphs): the Cielo's
 * moon and the Estela's stars already carry meaning, so this module reads
 * as the observatory's instrument panel, not a third constellation. It
 * REGISTERS, it does not interpret — the weekly reading lives in Órbita.
 */

// Comidas RECUENTA, no interpreta — un encabezado FIJO que abre el recuento
// sin calificar el volumen ni afirmar efectos en el cuerpo (eso es la Lectura
// Semanal de Órbita). Agnóstico al número de días para no "premiar" cierto
// conteo: deja que los tres stats hablen.
const WEEK_HEADER = 'Esto es lo que sumaste esta semana.'

// ── Íconos de dato · estilo de línea neutro, hermanos de CameraIcon /
//    BowlIcon. Tintados por prop (niebla), NO glifos celestes. ──

// Bowl — réplica del glifo canónico de comida (MealCard).
function BowlIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11 H21" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path
        d="M4.2 11 C 4.6 16.6 7.8 20 12 20 C 16.2 20 19.4 16.6 19.8 11"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.4 4.6 c1.1 1.3 1.1 2 0 3.3 M14 4.6 c1.1 1.3 1.1 2 0 3.3"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  )
}

// Calendario — días con registro. Sin números dentro; el dato vive afuera.
function DaysIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={5} width={17} height={15.5} rx={2.6} stroke={color} strokeWidth={1.8} />
      <Path d="M3.5 9.5 H20.5" stroke={color} strokeWidth={1.8} />
      <Path d="M8 3.2 V6.4 M16 3.2 V6.4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={8.4} cy={14.4} r={1.05} fill={color} />
    </Svg>
  )
}

// Diana calma — proteína. Anillos concéntricos, sin flecha ni cruz: lee
// como "referencia", no como blanco de tiro / cuota.
function TargetIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.2} stroke={color} strokeWidth={1.8} />
      <Circle cx={12} cy={12} r={4.3} stroke={color} strokeWidth={1.8} />
      <Circle cx={12} cy={12} r={1.5} fill={color} />
    </Svg>
  )
}

function Stat({
  icon,
  value,
  label,
  a11y,
}: {
  icon: ReactNode
  value: string
  label: string
  a11y: string
}) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={a11y}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statNum}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  )
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
  const proteinPerDay = Math.round(stats.proteinAvgPerLoggedDay ?? 0)

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
            <Text style={styles.coach}>{WEEK_HEADER}</Text>

            <View style={styles.statsRow}>
              <Stat
                icon={<BowlIcon color={colors.niebla} />}
                value={`${stats.totalMeals}`}
                label="comidas"
                a11y={`${stats.totalMeals} comidas sumadas esta semana`}
              />
              <View style={styles.divider} />
              <Stat
                icon={<DaysIcon color={colors.niebla} />}
                value={`${stats.daysLogged}`}
                label="días con registro"
                a11y={`${stats.daysLogged} días con registro esta semana`}
              />
              <View style={styles.divider} />
              <Stat
                icon={<TargetIcon color={colors.niebla} />}
                value={`${proteinPerDay}`}
                label="g proteína/día"
                a11y={`${proteinPerDay} gramos de proteína promedio por día`}
              />
            </View>
          </>
        ) : (
          <Text style={styles.empty}>
            Tu semana apenas comienza. Con unos días de registro aparece tu rastro.
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
    paddingBottom: 18,
  },
  // The warm line opens the card, before any number.
  coach: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.bone,
    marginBottom: 16,
  },
  // Three instruments in a row — icon, number, label.
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  statIcon: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Present, not protagonist — 20px Hanken, not the 30/48 of hero numbers.
  statNum: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.niebla,
    textAlign: 'center',
    lineHeight: 15,
  },
  // Partial hairline between instruments — breathes, doesn't reach the edges.
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'center',
    height: 42,
    backgroundColor: colors.hairline,
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
