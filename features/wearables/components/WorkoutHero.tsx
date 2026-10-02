import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeInDown,
  ZoomIn,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

import { StarGlyph } from '@/features/tabs/components/check-in-glyphs'
import { colors, typography } from '@/theme'

import { clockTime } from '../sleep-detail'
import { formatMinutes, type MovementWeek, type TodayWorkout } from '../workout-insights'
import { ActivityIcon } from './ActivityIcon'
import { WatchGlyph } from './WatchGlyph'

/*
 * El hero de Tu smartwatch (dueña 30 sep 2026): el entreno de hoy como
 * protagonista, comparado contra TI. Un anillo de duración contra tu promedio
 * de ese tipo (sin meta ni porcentaje; termina en oro si lo superas) y tu
 * marca si la hubo. La semana va en una línea (sin tira de días: el CUÁNDO vive
 * en el calendario de Descubre, que marca cada día con entreno). Sin entreno
 * hoy se nombra el último entreno, sin regaño. Las kcal van chicas:
 * procedencia, nunca comida ganada. `WorkoutSessionCard` es la misma tarjeta
 * que muestra el detalle de un día pasado en Descubre.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// Violeta: el color del entreno en el multiring y el calendario de Descubre.
const ENTRENO = colors.dimension.mente
const RING = 112
const SW = 9
const R = (RING - SW) / 2 - 2
const C = 2 * Math.PI * R

export function WorkoutHero({
  workout,
  week,
  lastWorkout,
  tz,
  onOpenMonth,
}: {
  workout: TodayWorkout | null
  week: MovementWeek
  /** "martes, fuerza 45 min" (solo sin entreno hoy). */
  lastWorkout: string | null
  tz: string
  /** Abre el calendario del mes en Descubre (el detalle de cada día). */
  onOpenMonth: () => void
}) {
  return (
    <Animated.View entering={FadeInDown.duration(320)} style={styles.wrap}>
      <LinearGradient
        colors={[`${ENTRENO}2E`, `${ENTRENO}0A`, colors.bgCard]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.card}
      >
        {workout ? (
          <WorkoutSessionCard workout={workout} tz={tz} whenPrefix="hoy · " />
        ) : (
          <>
            <View style={styles.headLeft}>
              <StarGlyph color={ENTRENO} size={14} />
              <Text style={styles.kicker}>TU MOVIMIENTO</Text>
            </View>
            <Text style={styles.emptyLine}>
              {lastWorkout
                ? `Tu último entreno: ${lastWorkout}.`
                : 'Hoy todavía no llega un entreno.'}
            </Text>
          </>
        )}

        <View style={styles.divider} />

        <Text style={styles.weekLine}>
          {week.sessions > 0
            ? `Esta semana: ${week.sessions} ${week.sessions === 1 ? 'entreno' : 'entrenos'}${
                week.strength > 0 ? ` · ${week.strength} de fuerza` : ''
              } · ${formatMinutes(week.totalMinutes)}`
            : 'Esta semana todavía no hay entrenos.'}
        </Text>
        {week.rhythm ? <Text style={styles.rhythm}>{`Tu ritmo: ${week.rhythm}`}</Text> : null}
        <Pressable
          onPress={onOpenMonth}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.monthLink, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.monthLinkText}>Ver tus entrenos en tu mes ›</Text>
        </Pressable>
      </LinearGradient>
    </Animated.View>
  )
}

/** Una sesión (o el día con varias): tipo y hora, anillo contra tu promedio,
 *  tu marca o tu promedio, procedencia. La usan el hero de hoy y el detalle de
 *  un día pasado en Descubre: un entreno se ve igual sea de hoy o del 16 sep. */
export function WorkoutSessionCard({
  workout,
  tz,
  whenPrefix = '',
}: {
  workout: TodayWorkout
  tz: string
  /** "hoy · " en el hero; vacío en un día pasado. */
  whenPrefix?: string
}) {
  const multi = workout.list.length > 1
  const first = workout.list[0]
  const last = workout.list[workout.list.length - 1]
  return (
    <>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          {multi || !first ? (
            <StarGlyph color={ENTRENO} size={14} />
          ) : (
            <ActivityIcon name={first.name} type={first.type} size={24} />
          )}
          <Text style={styles.kicker}>
            {multi
              ? `${workout.list.length} ENTRENOS`
              : (first?.name ?? workout.name).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.when}>
          {multi && first && last
            ? `${whenPrefix}${clockTime(first.startedAt, tz)} – ${clockTime(last.endedAt, tz)}`
            : `${whenPrefix}${clockTime(workout.startedAt, tz)} – ${clockTime(workout.endedAt, tz)}`}
        </Text>
      </View>
      <View style={styles.today}>
        <DurationRing minutes={workout.totalMinutes} average={workout.average} />
        <View style={styles.todayText}>
          {workout.record ? (
            <Text style={styles.record}>{workout.record}</Text>
          ) : workout.average != null ? (
            <Text style={styles.vsAvg}>
              {workout.name === 'Entreno'
                ? 'Tu promedio: '
                : `Tu promedio de ${workout.name.toLowerCase()}: `}
              <Text style={styles.vsAvgStrong}>{formatMinutes(workout.average)}</Text>
            </Text>
          ) : (
            <Text style={styles.vsAvg}>Tu reloj lo anotó por ti.</Text>
          )}
          <View style={styles.provenance}>
            <WatchGlyph color={colors.bone} size={11} />
            <Text style={styles.meta}>
              {`desde tu reloj${workout.kcal > 0 ? ` · ~${workout.kcal} kcal` : ''}`}
            </Text>
          </View>
        </View>
      </View>

      {/* Qué hiciste, sesión por sesión (como la lista de Garmin): el anillo
          suma el día; aquí se ve cada ejercicio con su hora y sus minutos. */}
      {multi ? (
        <View style={styles.sessionList}>
          {workout.list.map((x, i) => (
            // Cascada: cada fila entra un poco después de la anterior y su
            // ícono aparece con un pequeño rebote (one-shot, sin bucles).
            <Animated.View
              key={x.key}
              entering={FadeInDown.duration(320).delay(380 + i * 70)}
              style={styles.sessionRow}
            >
              <Animated.View
                entering={ZoomIn.springify()
                  .damping(12)
                  .delay(430 + i * 70)}
              >
                <ActivityIcon name={x.name} type={x.type} size={36} />
              </Animated.View>
              <View style={styles.sessionText}>
                <Text style={styles.sessionName} numberOfLines={1}>
                  {x.name}
                </Text>
                <Text style={styles.sessionMeta}>
                  {`${x.minutes} min · ${clockTime(x.startedAt, tz)}${x.kcal > 0 ? ` · ~${x.kcal} kcal` : ''}`}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>
      ) : null}
    </>
  )
}

/* El anillo: minutos de hoy sobre una escala que deja ver tu promedio como
 * una muesca. Se dibuja al entrar; si superas tu promedio el arco es oro. */
function DurationRing({ minutes, average }: { minutes: number; average: number | null }) {
  const reduce = useReducedMotion() ?? false
  const scale = Math.max(minutes, average ?? minutes) * 1.25 || 1
  const fill = Math.min(1, minutes / scale)
  const beat = average != null && minutes >= average
  const progress = useSharedValue(reduce ? fill : 0)
  useEffect(() => {
    progress.value = reduce
      ? fill
      : withDelay(180, withTiming(fill, { duration: 750, easing: Easing.out(Easing.cubic) }))
  }, [fill, reduce, progress])
  const arcProps = useAnimatedProps(() => ({ strokeDasharray: [C * progress.value, C] }))
  const mark = average != null ? (average / scale) * 2 * Math.PI - Math.PI / 2 : null
  const cx = RING / 2

  return (
    <View style={styles.ring}>
      <Svg width={RING} height={RING}>
        <Circle cx={cx} cy={cx} r={R} stroke={`${ENTRENO}24`} strokeWidth={SW} fill="none" />
        <AnimatedCircle
          cx={cx}
          cy={cx}
          r={R}
          stroke={beat ? colors.oroSoft : ENTRENO}
          strokeWidth={SW}
          strokeLinecap="round"
          fill="none"
          rotation={-90}
          originX={cx}
          originY={cx}
          animatedProps={arcProps}
        />
      </Svg>
      {mark != null ? (
        <View
          pointerEvents="none"
          style={[
            styles.mark,
            { left: cx + Math.cos(mark) * R - 6, top: cx + Math.sin(mark) * R - 6 },
          ]}
        >
          <StarGlyph color={colors.oroLeche} size={12} />
        </View>
      ) : null}
      <View style={styles.ringCenter} pointerEvents="none">
        <Text style={styles.ringValue}>{minutes}</Text>
        <Text style={styles.ringUnit}>min</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  card: {
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${ENTRENO}40`,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    letterSpacing: 1.6,
    color: ENTRENO,
  },
  when: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  today: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 18 },
  todayText: { flex: 1, gap: 6 },
  record: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.title,
    lineHeight: 21,
    color: colors.oroLight,
  },
  vsAvg: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 20,
    color: colors.bone,
  },
  vsAvgStrong: { fontFamily: typography.uiSemi, color: colors.leche },
  meta: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  provenance: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  emptyLine: {
    marginTop: 12,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.ui,
    lineHeight: 21,
    color: colors.leche,
  },
  divider: {
    marginTop: 16,
    marginBottom: 14,
    height: StyleSheet.hairlineWidth,
    backgroundColor: `${ENTRENO}33`,
  },
  ring: { width: RING, height: RING },
  mark: { position: 'absolute', width: 12, height: 12 },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringValue: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.displayLg,
    letterSpacing: -1,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  ringUnit: {
    marginTop: -4,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  weekLine: {
    marginTop: 0,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  sessionList: {
    marginTop: 16,
    gap: 12,
  },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sessionText: { flex: 1, gap: 2 },
  sessionName: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  sessionMeta: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  monthLink: { marginTop: 12, alignSelf: 'flex-start' },
  monthLinkText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.magenta,
  },
  rhythm: {
    marginTop: 4,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
})
