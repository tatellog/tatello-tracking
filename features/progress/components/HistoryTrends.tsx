import { useRouter } from 'expo-router'
import { useEffect, useMemo, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { useMacroTargets } from '@/features/macros/hooks'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { track } from '@/lib/analytics'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { PROGRESS_EVENTS } from '../constants'
import { historyTrends } from '../logic'
import { CountUp } from './CountUp'
import { HealthCardHeader } from './HealthCardHeader'
import { CalendarGlyph, DumbbellGlyph, EggGlyph, ProgressRing, TargetGlyph } from './HealthGlyphs'

/*
 * Historia · Tendencias (dueña 7 oct 2026, propuesta de product estilo
 * Tendencias de Fitness). Cuatro tarjetas en orden FIJO (déficit, registro,
 * proteína, entreno), cada una con su ícono animado, su número CON
 * denominador, el "antes" en gris (solo con datos suficientes) y una línea de
 * hecho. El peso no vive aquí: su casa es Cuerpo.
 */
export function HistoryTrends() {
  const router = useRouter()
  const signals = useSignalsHistory(62)
  const targets = useMacroTargets().data
  const t = useMemo(
    () =>
      historyTrends(signals.data ?? [], {
        today: todayInTimezone(),
        calorieTarget: targets?.calories ?? null,
        proteinTarget: targets?.protein_g ?? null,
      }),
    [signals.data, targets?.calories, targets?.protein_g],
  )
  if (signals.isLoading) return null

  return (
    <View style={styles.wrap}>
      <View>
        <Text style={styles.range}>{t.range.label}</Text>
        <Text style={styles.caption}>{`Comparado con ${t.range.prevLabel}`}</Text>
      </View>

      {t.deficit ? (
        <TrendCard
          delay={0}
          icon={<TargetGlyph color={colors.magenta} />}
          title="Déficit"
          color={colors.magenta}
          right="Días con comida"
          aside={
            <ProgressRing
              pct={t.deficit.denom > 0 ? t.deficit.value / t.deficit.denom : 0}
              size={50}
              stroke={6}
              color={colors.magenta}
              track={colors.magentaTint2}
            />
          }
          value={t.deficit.value}
          unit={`de ${t.deficit.denom} días`}
          prev={t.deficit.prev ? `Antes: ${t.deficit.prev.value} de ${t.deficit.prev.denom}` : null}
          highlight={t.deficit.highlight}
        />
      ) : null}

      <TrendCard
        delay={80}
        icon={<CalendarGlyph color={colors.bone} />}
        title="Registro"
        color={colors.bone}
        right="Ver constancia ›"
        onPress={() => {
          track(PROGRESS_EVENTS.openCalendar)
          router.navigate('/movement-calendar')
        }}
        value={t.logging.value}
        unit={`de ${t.logging.denom} días`}
        prev={t.logging.prev != null ? `Antes: ${t.logging.prev} de ${t.logging.denom}` : null}
        highlight={t.logging.highlight}
      />

      {t.protein ? (
        <TrendCard
          delay={160}
          icon={<EggGlyph color={colors.signal.proteina} />}
          title="Proteína"
          color={colors.signal.proteina}
          right="Promedio al día"
          value={t.protein.avg}
          unit={`g · en ${t.protein.n} ${t.protein.n === 1 ? 'día' : 'días'}`}
          prev={t.protein.prevAvg != null ? `Antes: ${t.protein.prevAvg} g` : null}
          highlight={
            t.protein.inTarget != null && t.protein.target != null
              ? `En tu meta (${t.protein.target} g): ${t.protein.inTarget} de ${t.protein.n} días`
              : null
          }
        />
      ) : null}

      <TrendCard
        delay={240}
        icon={<DumbbellGlyph size={18} color={colors.dimension.mente} />}
        title="Entreno"
        color={colors.dimension.mente}
        right="Días con entreno"
        value={t.workouts.value}
        unit={`de ${t.workouts.denom} días`}
        prev={t.workouts.prev != null ? `Antes: ${t.workouts.prev} de ${t.workouts.denom}` : null}
        highlight={null}
        footer={<WeekBars weeks={t.workouts.weeks} color={colors.dimension.mente} />}
      />
    </View>
  )
}

function TrendCard({
  icon,
  title,
  color,
  right,
  value,
  unit,
  prev,
  highlight,
  aside,
  footer,
  onPress,
  delay,
}: {
  icon: ReactNode
  title: string
  color: string
  right: string
  value: number
  unit: string
  prev: string | null
  highlight: string | null
  aside?: ReactNode
  footer?: ReactNode
  onPress?: () => void
  delay: number
}) {
  const body = (
    <View style={styles.card}>
      <HealthCardHeader icon={icon} title={title} color={color} right={right} />
      <View style={styles.body}>
        <View style={styles.numbers}>
          <View style={styles.valueRow}>
            <CountUp value={value} style={styles.value} />
            <Text style={styles.unit}>{unit}</Text>
          </View>
          {prev ? <Text style={styles.caption}>{prev}</Text> : null}
        </View>
        {aside}
      </View>
      {footer}
      {highlight ? <Text style={styles.highlight}>{highlight}</Text> : null}
    </View>
  )
  return (
    <Animated.View entering={FadeIn.duration(320).delay(delay)}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          style={({ pressed }) => pressed && styles.pressed}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
    </Animated.View>
  )
}

/** Barras de las últimas 4 semanas (días con entreno, de 0 a 7), que crecen. */
function WeekBars({ weeks, color }: { weeks: { label: string; days: number }[]; color: string }) {
  return (
    <View style={styles.bars}>
      {weeks.map((w, i) => (
        <View key={w.label} style={styles.barCol}>
          <Text style={styles.barNum}>{w.days}</Text>
          <View style={styles.barTrack}>
            <Bar pct={w.days / 7} color={color} delay={300 + i * 80} />
          </View>
          <Text style={styles.barLabel}>{w.label}</Text>
        </View>
      ))}
    </View>
  )
}

function Bar({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  const reduce = useReducedMotion()
  const h = useSharedValue(reduce ? pct : 0)
  useEffect(() => {
    h.value = reduce ? pct : withDelay(delay, withTiming(pct, { duration: 520 }))
  }, [pct, delay, reduce, h])
  const style = useAnimatedStyle(() => ({ height: `${Math.max(0.04, h.value) * 100}%` }))
  return <Animated.View style={[styles.barFill, { backgroundColor: color }, style]} />
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  range: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
  },
  caption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  card: { borderRadius: 20, backgroundColor: colors.bgCard, padding: 16, gap: 12 },
  body: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  numbers: { gap: 2, flexShrink: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  value: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.displayLg,
    letterSpacing: -1,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontFamily: typography.uiSemi, fontSize: typography.sizes.body, color: colors.bone },
  highlight: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.leche,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingTop: 10,
  },
  pressed: { opacity: 0.75 },
  bars: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barNum: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    width: '100%',
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.bgCard2,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 8 },
  barLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
})
