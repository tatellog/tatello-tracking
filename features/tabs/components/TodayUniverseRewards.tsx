import * as Haptics from 'expo-haptics'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  FadeIn,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import type { BriefContext } from '@/features/brief/api'
import { useSleepLog } from '@/features/sleep/hooks'
import { emitUniverseDelta } from '@/features/tabs/universe-delta-bus'
import {
  calculateTodayUniverseRewards,
  detailForAttribute,
  STATE_COPY,
  type UniverseAttribute,
  type UniverseAttributeKey,
  type UniverseInput,
  type UniverseState,
} from '@/features/tabs/universe-rewards'
import { tint, UNIVERSE_ACCENT, UNIVERSE_ICON_PATH } from '@/features/tabs/universe-visuals'
import { useWaterToday } from '@/features/water/hooks'
import { GLASS_ML, useWaterGoal } from '@/features/water/useWaterGoal'
import { useTodayWellbeing } from '@/features/wellbeing/hooks'
import { colors, duration, easing, radius, spacing, typography } from '@/theme'

/*
 * "Tu universo hoy" — the visible reward layer for the registros that
 * do NOT light constellation stars (those are exclusively "Entrené").
 * A 2×2 grid of attribute cards, each with an astral progress ring;
 * the maths live in `universe-rewards.ts` (pure), this file only
 * paints + feels.
 *
 * Reward grammar (la recompensa ocurre ARRIBA; el card es el acumulado):
 *   registro → el atributo SUBE → este componente lo detecta (es la
 *   única fuente del cálculo) y:
 *     1. emite {atributo, +delta} → UniverseDeltaToast global ("+13
 *        Claridad", 1.5 s, haptic) — funciona desde cualquier tab
 *        porque Hoy queda montado (detachInactiveScreens=false).
 *     2. dispara un vuelo de partículas desde el card hacia la
 *        constelación de arriba — registro → recompensa → universo →
 *        identidad.
 *   Los cards muestran la consecuencia: el ring se rellena, y al
 *   cerrar (complete) glow + success haptic + chip "✦ … alineada."
 *   Tap en un card → panel de detalle con las cifras reales detrás
 *   del porcentaje. Fireworks siguen reservados para "Entrené".
 *
 * Performance notes:
 *   - Autonomous: own hooks, zero imports from LunarConstellation, so
 *     its re-renders never touch the heavy SVG/Skia layers.
 *   - Ring draw is a ONE-SHOT strokeDasharray animation on change (the
 *     MacroRing lesson: never loop an animated child inside an <Svg> —
 *     on Android it invalidates the whole svg every frame). The glow
 *     pulse lives on a wrapper View's opacity (compositor-only).
 *   - Shared values are SEEDED with the current pct, so re-entering
 *     the tab never replays a 0→pct sweep; they only animate on change.
 *   - Las partículas (in-card y vuelo) son views planas one-shot con
 *     transform/opacity en UI thread, key-remontadas y auto-desmontadas
 *     — cero costo en reposo.
 *   - Las EMISIONES se arman solo cuando las queries ya asentaron: la
 *     hidratación inicial (0 → datos del server) sincroniza el snapshot
 *     sin emitir — abrir la app jamás dispara un "+87 Energía" falso.
 */

type Props = {
  ctx: BriefContext | undefined
  /** ISO yyyy-mm-dd local de hoy. */
  date: string
  restedToday: boolean
}

export function TodayUniverseRewards({ ctx, date, restedToday }: Props) {
  const water = useWaterToday(date)
  const { goalMl } = useWaterGoal()
  const sleep = useSleepLog(date)
  const wellbeing = useTodayWellbeing(date)
  const reducedMotion = useReducedMotion()
  const [openKey, setOpenKey] = useState<UniverseAttributeKey | null>(null)
  const [flight, setFlight] = useState<{ key: UniverseAttributeKey; id: number } | null>(null)
  const prevPcts = useRef<Record<UniverseAttributeKey, number> | null>(null)

  const checkin = wellbeing.data ?? null
  const input: UniverseInput | null = ctx
    ? {
        proteinG: ctx.today_macros.protein_g,
        proteinTarget: ctx.targets?.protein_g ?? null,
        mealCount: ctx.meal_count_today,
        // useWaterToday already returns GLASSES (water_intake.glasses).
        waterGlasses: water.data ?? 0,
        waterGoalGlasses: Math.max(1, Math.round(goalMl / GLASS_ML)),
        sleepMinutes: sleep.data?.duration_minutes ?? null,
        restedToday,
        energy: checkin?.energy ?? null,
        hasWellbeingSignal:
          checkin != null &&
          (checkin.energy != null || checkin.motivation != null || checkin.stress != null),
        // Gatea el faltante de proteína de noche (no empujar comida tardía).
        localHour: new Date().getHours(),
      }
    : null
  const attributes = input ? calculateTodayUniverseRewards(input) : null

  // Armed only once every query is settled — while loading, pct moves
  // are hydration, not registros.
  const ready = attributes != null && !water.isLoading && !sleep.isLoading && !wellbeing.isLoading

  // Delta watch keyed on a pct SIGNATURE, not on `attributes`: the array
  // is fresh every render (input lee new Date().getHours(), que el
  // compiler no puede memoizar), así que como dep haría correr el efecto
  // en cada render. La firma solo cambia cuando un pct cambia de verdad —
  // el efecto queda acotado a los registros, no al render loop.
  const pctSig = attributes ? attributes.map((a) => `${a.key}:${a.pct}`).join('|') : ''

  // It only acts when a pct actually ROSE since the last armed snapshot.
  // Decreases (step-back, day rollover) re-sync silently.
  useEffect(() => {
    if (!ready || !pctSig) return
    const current = {} as Record<UniverseAttributeKey, number>
    for (const pair of pctSig.split('|')) {
      const [key, pct] = pair.split(':') as [UniverseAttributeKey, string]
      current[key] = Number(pct)
    }
    const prev = prevPcts.current
    prevPcts.current = current
    if (!prev) return // arming snapshot — hydration never toasts
    for (const key of Object.keys(current) as UniverseAttributeKey[]) {
      const delta = (current[key] ?? 0) - (prev[key] ?? 0)
      if (delta > 0) {
        emitUniverseDelta({ key, delta })
        if (!reducedMotion) setFlight((f) => ({ key, id: (f?.id ?? 0) + 1 }))
      }
    }
  }, [ready, pctSig, reducedMotion])

  // Unmount the flight layer once the rise is over.
  useEffect(() => {
    if (!flight) return
    const id = setTimeout(() => setFlight(null), 1300)
    return () => clearTimeout(id)
  }, [flight])

  // Brief still over the wire → render nothing. The section simply
  // appears once the data is settled; no spinner for a reward layer.
  if (!attributes || !input) return null

  const openAttr = openKey ? (attributes.find((a) => a.key === openKey) ?? null) : null
  const flightIdx = flight ? attributes.findIndex((a) => a.key === flight.key) : -1

  return (
    <View style={styles.section}>
      <EyebrowLabel tone="magenta" style={styles.eyebrow}>
        Tu universo hoy
      </EyebrowLabel>
      <View style={styles.gridWrap}>
        <View style={styles.grid}>
          {attributes.map((attr) => (
            <AttributeCard
              key={attr.key}
              attr={attr}
              reducedMotion={reducedMotion}
              selected={openKey === attr.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {})
                setOpenKey((k) => (k === attr.key ? null : attr.key))
              }}
            />
          ))}
        </View>
        {/* El vuelo hacia Leo — partículas que salen del card que subió
            y suben más allá de la sección, hacia la constelación. Vive
            FUERA de los cards (tienen overflow hidden) en una capa
            absoluta pointer-transparente. */}
        {flight && flightIdx >= 0 ? (
          <FlightToConstellation key={flight.id} attrKey={flight.key} index={flightIdx} />
        ) : null}
      </View>
      {openAttr ? <AttributeDetail key={openAttr.key} attr={openAttr} input={input} /> : null}
    </View>
  )
}

/* ── Attribute identity ────────────────────────────────────────────── */

const STATE_RANK: Record<UniverseState, number> = {
  empty: 0,
  partial: 1,
  almost: 2,
  complete: 3,
}

// Chip de "complete" — Nivel 2 del sistema de recompensas: cada
// atributo se nombra alineado (copy del spec, concordancia por género:
// tres femeninos + Brillo masculino). El glifo abre, como en el spec.
const ALIGNED_COPY: Record<UniverseAttributeKey, string> = {
  energia: '✦ Energía alineada.',
  claridad: '✦ Claridad alineada.',
  estabilidad: '✦ Estabilidad alineada.',
  brillo: '✦ Brillo alineado.',
}

/* ── One attribute card ────────────────────────────────────────────── */

const RING_SIZE = 64
const RING_STROKE = 4
const RING_R = RING_SIZE / 2 - RING_STROKE
const RING_C = 2 * Math.PI * RING_R

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type CardProps = {
  attr: UniverseAttribute
  reducedMotion: boolean
  selected: boolean
  onPress: () => void
}

function AttributeCard({ attr, reducedMotion, selected, onPress }: CardProps) {
  const accent = UNIVERSE_ACCENT[attr.key]

  // Seeded at the CURRENT pct — no mount sweep; only changes animate.
  const progress = useSharedValue(attr.pct)
  const glow = useSharedValue(0)
  const prevPctRef = useRef(attr.pct)
  const prevStateRef = useRef(attr.state)
  const [burstKey, setBurstKey] = useState(0)

  // Ring fill — one-shot withTiming toward the new pct when it changes
  // post-mount; the <Svg> is static at rest.
  useEffect(() => {
    if (prevPctRef.current === attr.pct) return
    prevPctRef.current = attr.pct
    progress.value = reducedMotion
      ? attr.pct
      : withTiming(attr.pct, { duration: duration.languid, easing: easing.out })
  }, [attr.pct, reducedMotion, progress])

  // State transitions — milestone feedback ONLY on an UPGRADE into
  // complete (the ref is seeded with the mount state, so first render
  // never fires; coming back to the tab already-complete is silent).
  // El haptic de `almost` se retiró: el toast de delta ya vibra Light
  // con cada subida — apilar otro Light leía a doble buzz.
  useEffect(() => {
    const prev = prevStateRef.current
    if (prev === attr.state) return
    prevStateRef.current = attr.state
    if (STATE_RANK[attr.state] <= STATE_RANK[prev]) return
    if (attr.state !== 'complete') return

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    if (reducedMotion) return

    // A brief wash over the card — pulses once, never stays lit.
    glow.value = withSequence(
      withTiming(1, { duration: duration.standard, easing: easing.out }),
      withTiming(0, { duration: duration.languid, easing: easing.out }),
    )
    setBurstKey((k) => k + 1)
  }, [attr.state, reducedMotion, glow])

  // Unmount the particle layer once the drift is over (~800 ms + delays)
  // so absolute views aren't kept alive per completed card.
  useEffect(() => {
    if (burstKey === 0) return
    const id = setTimeout(() => setBurstKey(0), 1100)
    return () => clearTimeout(id)
  }, [burstKey])

  const ringProps = useAnimatedProps(() => ({
    strokeDasharray: [(RING_C * progress.value) / 100, RING_C],
  }))
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }))

  const complete = attr.state === 'complete'
  const chip = complete
    ? ALIGNED_COPY[attr.key]
    : attr.state === 'almost'
      ? 'Casi se alinea ✦'
      : null
  // The line under the ring: quiet state copy for empty/partial; the
  // concrete faltante (coach voice) in almost. When the microcopy is
  // just the generic state line AND a chip already says it, the chip
  // carries it alone — never the same words twice on one card.
  const isGenericCopy = attr.microcopy === STATE_COPY[attr.state]
  const showLine = !chip || !isGenericCopy
  // Serif italic is reserved for coach voice — the faltante IS a coach
  // line; empty/partial stay in quiet upright Hanken.
  const coachVoice = attr.state === 'almost' && !isGenericCopy

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        complete && { borderColor: tint(accent, '4D') },
        selected && { borderColor: tint(accent, '8C') },
      ]}
      accessibilityRole="button"
      accessibilityState={{ expanded: selected }}
      accessibilityLabel={`${attr.label}, ${attr.pct} por ciento. ${attr.microcopy}`}
      accessibilityHint="Muestra de dónde viene"
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.cardGlow, { backgroundColor: tint(accent, '1F') }, glowStyle]}
      />

      <View style={styles.cardHeader}>
        <AttributeIcon attrKey={attr.key} color={accent} />
        <Text style={[styles.label, { color: accent }]}>{attr.label}</Text>
      </View>

      <View style={styles.ringZone}>
        <Svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          style={styles.ringSvg}
        >
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            fill="none"
            stroke={colors.hairline}
            strokeWidth={RING_STROKE}
          />
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            fill="none"
            stroke={accent}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            animatedProps={ringProps}
          />
        </Svg>
        <View style={styles.ringCenter} pointerEvents="none">
          <Text style={styles.pct}>
            {attr.pct}
            <Text style={styles.pctSign}>%</Text>
          </Text>
        </View>
        {burstKey > 0 ? <ParticleBurst key={burstKey} color={accent} /> : null}
      </View>

      <View style={styles.cardFooter}>
        {showLine ? (
          <Text
            style={coachVoice ? styles.microCoach : styles.microQuiet}
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            {attr.microcopy}
          </Text>
        ) : null}
        {chip ? (
          <View
            style={[
              styles.chip,
              { borderColor: tint(accent, '59'), backgroundColor: tint(accent, '14') },
            ]}
          >
            <Text style={[styles.chipText, { color: accent }]}>{chip}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

/* ── Detalle al tocar un card ──────────────────────────────────────── */

// El "¿y eso qué significa?": qué representa el atributo (voz del
// coach) + las cifras reales de hoy. La matemática vive en
// detailForAttribute (pura); esto solo la pinta.
function AttributeDetail({ attr, input }: { attr: UniverseAttribute; input: UniverseInput }) {
  const accent = UNIVERSE_ACCENT[attr.key]
  const detail = detailForAttribute(attr.key, input)

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={[styles.detail, { borderColor: tint(accent, '33') }]}
    >
      <View style={styles.detailHeader}>
        <AttributeIcon attrKey={attr.key} color={accent} />
        <Text style={[styles.detailTitle, { color: accent }]}>{attr.label}</Text>
        <Text style={styles.detailPct}>
          {attr.pct}
          <Text style={styles.pctSign}>%</Text>
        </Text>
      </View>
      <Text style={styles.detailEssence}>{detail.essence}</Text>
      {detail.lines.map((line) => (
        <View key={line.label} style={styles.detailRow}>
          <Text style={styles.detailLabel}>{line.label}</Text>
          <Text style={styles.detailValue}>{line.value}</Text>
        </View>
      ))}
    </Animated.View>
  )
}

/* ── Attribute icons ───────────────────────────────────────────────── */

function AttributeIcon({ attrKey, color }: { attrKey: UniverseAttributeKey; color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path
        d={UNIVERSE_ICON_PATH[attrKey]}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/* ── Completion particles (in-card) ────────────────────────────────── */

// Four 3 px points that drift up from the ring toward the Leo hero
// above. Plain RN views + transform/opacity on the UI thread — no
// Lottie, no confetti. The burst remounts per completion (keyed), so
// each particle's mount effect is its own one-shot timeline.
const PARTICLES = [
  { leftPct: 22, delay: 0, rise: 34 },
  { leftPct: 46, delay: 110, rise: 46 },
  { leftPct: 64, delay: 50, rise: 38 },
  { leftPct: 80, delay: 170, rise: 30 },
] as const

function ParticleBurst({ color }: { color: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {PARTICLES.map((p) => (
        <Particle
          key={p.leftPct}
          leftPct={p.leftPct}
          delay={p.delay}
          rise={p.rise}
          color={color}
          size={3}
        />
      ))}
    </View>
  )
}

/* ── El vuelo hacia la constelación ────────────────────────────────── */

// Cinco puntos que salen del card que subió y SUPERAN la sección hacia
// arriba (overflow visible, new arch) — el ojo los sigue hacia Leo.
// One-shot, key-remontado por delta, auto-desmontado por el padre.
const FLIGHT_SPARKS = [
  { dxPct: -8, delay: 0, rise: 150 },
  { dxPct: -3, delay: 90, rise: 200 },
  { dxPct: 1, delay: 40, rise: 170 },
  { dxPct: 5, delay: 140, rise: 215 },
  { dxPct: 9, delay: 60, rise: 135 },
] as const

function FlightToConstellation({
  attrKey,
  index,
}: {
  attrKey: UniverseAttributeKey
  index: number
}) {
  const accent = UNIVERSE_ACCENT[attrKey]
  // 2×2 grid → quadrant origin of the card that rose.
  const col = index % 2
  const row = index < 2 ? 0 : 1
  const baseLeft = col === 0 ? 25 : 75
  const baseTop = row === 0 ? 22 : 72

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {FLIGHT_SPARKS.map((s) => (
        <Particle
          key={s.dxPct}
          leftPct={baseLeft + s.dxPct}
          topPct={baseTop}
          delay={s.delay}
          rise={s.rise}
          color={accent}
          size={4}
        />
      ))}
    </View>
  )
}

/* ── Shared one-shot particle ──────────────────────────────────────── */

function Particle({
  leftPct,
  topPct,
  delay,
  rise,
  color,
  size,
}: {
  leftPct: number
  topPct?: number
  delay: number
  rise: number
  color: string
  size: number
}) {
  const t = useSharedValue(0)

  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 800, easing: easing.out }))
  }, [t, delay])

  const style = useAnimatedStyle(() => ({
    // Pop in fast, fade out over the rise. `interpolate` is itself a
    // worklet — no extra 'worklet' helper needed inside this closure.
    opacity: interpolate(t.value, [0, 0.18, 1], [0, 1, 0]),
    transform: [{ translateY: -rise * t.value }],
  }))

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: `${leftPct}%`,
          top: topPct != null ? `${topPct}%` : -1,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  )
}

/* ── Styles ────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.s5,
    marginBottom: spacing.s3,
  },
  eyebrow: {
    marginBottom: spacing.s4,
  },
  gridWrap: {
    // Anchor for the flight overlay; particles overflow upward.
    position: 'relative',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s3,
  },
  card: {
    // Two per row: half the width minus half the gap.
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingTop: spacing.s3,
    paddingBottom: spacing.s3,
    paddingHorizontal: spacing.s2,
    overflow: 'hidden',
  },
  // The pulse wash — fills the card, pulses once on upgrade.
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.card,
    opacity: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s1,
    marginBottom: spacing.s3,
  },
  label: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: typography.letterSpacing.bodyLoose,
  },
  ringZone: {
    width: RING_SIZE,
    height: RING_SIZE,
    marginBottom: spacing.s3,
  },
  ringSvg: {
    transform: [{ rotate: '-90deg' }],
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pct: {
    fontFamily: typography.uiSemi,
    fontSize: 17,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  pctSign: {
    fontSize: 11,
    color: colors.niebla,
  },
  cardFooter: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.s2,
  },
  particle: {
    position: 'absolute',
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.s3,
    paddingVertical: 3,
  },
  chipText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.3,
  },
  microQuiet: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    textAlign: 'center',
  },
  microCoach: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13,
    color: colors.bone,
    textAlign: 'center',
  },
  detail: {
    marginTop: spacing.s3,
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    borderWidth: 1,
    paddingVertical: spacing.s4,
    paddingHorizontal: spacing.s4,
    gap: spacing.s2,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s1,
  },
  detailTitle: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: typography.letterSpacing.bodyLoose,
  },
  detailPct: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.title,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  detailEssence: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  detailLabel: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  detailValue: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
})
