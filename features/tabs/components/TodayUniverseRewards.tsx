import * as Haptics from 'expo-haptics'
import { useSegments } from 'expo-router'
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
import { usePressFeedback } from '@/components/ui/interaction'
import type { BriefContext } from '@/features/brief/api'
import { todayInTimezone } from '@/lib/time'
import { useSleepLog } from '@/features/sleep/hooks'
import {
  consumeUniverseDetail,
  subscribeUniverseDetailRequest,
} from '@/features/tabs/pending-universe-detail'
import { emitUniverseDelta } from '@/features/tabs/universe-delta-bus'
import {
  ACTION_LABEL,
  ATTRIBUTE_LABEL,
  calculateTodayUniverseRewards,
  detailForAttribute,
  type UniverseAttribute,
  type UniverseAttributeKey,
  type UniverseInput,
  type UniverseState,
  wellbeingAvg,
} from '@/features/tabs/universe-rewards'
import {
  tint,
  UNIVERSE_ACCENT,
  UNIVERSE_ACCENT_MUTED,
  UNIVERSE_ICON_PATH,
} from '@/features/tabs/universe-visuals'
import { useFirstSeenWindow } from '@/features/tabs/useFirstSeenWindow'
import { useWaterFromMeals, useWaterToday } from '@/features/water/hooks'
import { formatGlasses } from '@/features/water/liquid-detection'
import { GLASS_ML, useWaterGoal } from '@/features/water/useWaterGoal'
import { useTodayWellbeing } from '@/features/wellbeing/hooks'
import { colors, duration, easing, radius, spacing, typography } from '@/theme'

// El susurro de bienvenida de "Tu universo hoy" se muestra los primeros 3
// días desde que la sección aparece por primera vez, luego se desvanece.
const UNIVERSE_INTRO_KEY = 'stelar.universe.first_seen'
const UNIVERSE_INTRO_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

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
  // El agua derivada de comidas se lee aparte para no tocar el optimismo del
  // stepper directo; el total que ve la usuaria = directa + comidas.
  const waterFromMeals = useWaterFromMeals(date)
  const { goalMl } = useWaterGoal()
  const sleep = useSleepLog(date)
  const wellbeing = useTodayWellbeing(date)
  const reducedMotion = useReducedMotion()
  // ¿Estamos DENTRO del tabs layout? El toast de delta vive global en
  // (tabs)/_layout, así que es visible desde CUALQUIER tab — registrar agua en
  // Órbita debe mostrar el chip ahí mismo. Pero NO debe emitirse mientras una
  // ruta full-screen cubre el tabs layout (scan-meal al crear/escanear comida,
  // log-measurement modal): ahí el toast quedaría oculto y al volver ya no
  // habría nada que mostrar. `useSegments` distingue ambos casos donde
  // `useIsFocused()` (foco de Hoy) no podía: con isFocused, registrar desde
  // OTRO tab también se bloqueaba (bug: chip solo aparecía al volver a Hoy).
  // Dentro de (tabs) emitimos al instante — Hoy queda montado (detach=false),
  // así que recalcula aunque no esté al frente; fuera de (tabs) diferimos y el
  // alza se emite al volver (insideTabs es dep → el efecto re-corre al regresar).
  const segments = useSegments()
  const insideTabs = segments[0] === '(tabs)'
  // En "modo ver día" Hoy se llena con un día PASADO (vctx): el grid muestra
  // sus pcts, pero eso NO es un registro de hoy. Sin este gate, aterrizar en
  // un día anterior emitía un "+N Claridad" falso (su pct vs el baseline de
  // hoy). Solo el día real dispara recompensa.
  const isToday = date === todayInTimezone()
  const [openKey, setOpenKey] = useState<UniverseAttributeKey | null>(null)
  const [flight, setFlight] = useState<{ key: UniverseAttributeKey; id: number } | null>(null)
  const prevPcts = useRef<Record<UniverseAttributeKey, number> | null>(null)
  const showIntro = useFirstSeenWindow(UNIVERSE_INTRO_KEY, UNIVERSE_INTRO_WINDOW_MS)

  // Tap del toast de delta ("+13 Claridad") → abre el detalle de ESE
  // atributo aquí (reusa el panel, sin UI duplicada). Hoy queda montado
  // (detachInactiveScreens=false), así que la suscripción reacciona al
  // instante; consume() cubre la petición que llegó antes del montaje.
  useEffect(() => {
    const pendingKey = consumeUniverseDetail()
    if (pendingKey) setOpenKey(pendingKey)
    return subscribeUniverseDetailRequest((key) => setOpenKey(key))
  }, [])

  const checkin = wellbeing.data ?? null
  const input: UniverseInput | null = ctx
    ? {
        proteinG: ctx.today_macros.protein_g,
        proteinTarget: ctx.targets?.protein_g ?? null,
        caloriesToday: ctx.today_macros.calories,
        mealCount: ctx.meal_count_today,
        // Total = agua directa (water_intake.glasses) + derivada de comidas.
        waterGlasses: (water.data ?? 0) + (waterFromMeals.data ?? 0),
        waterGoalGlasses: Math.max(1, Math.round(goalMl / GLASS_ML)),
        waterFromMeals: waterFromMeals.data ?? 0,
        sleepMinutes: sleep.data?.duration_minutes ?? null,
        restedToday,
        energy: checkin?.energy ?? null,
        motivation: checkin?.motivation ?? null,
        stress: checkin?.stress ?? null,
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
  const ready =
    attributes != null &&
    !water.isLoading &&
    !waterFromMeals.isLoading &&
    !sleep.isLoading &&
    !wellbeing.isLoading

  // Delta watch keyed on a pct SIGNATURE, not on `attributes`: the array
  // is fresh every render (input lee new Date().getHours(), que el
  // compiler no puede memoizar), así que como dep haría correr el efecto
  // en cada render. La firma solo cambia cuando un pct cambia de verdad —
  // el efecto queda acotado a los registros, no al render loop.
  const pctSig = attributes ? attributes.map((a) => `${a.key}:${a.pct}`).join('|') : ''

  // It only acts when a pct actually ROSE since the last armed snapshot.
  // Decreases (step-back, day rollover) re-sync silently.
  useEffect(() => {
    // Mientras una ruta full-screen cubre el tabs layout, no tocamos el
    // snapshot: el alza queda pendiente y se emite al volver a (tabs)
    // (insideTabs es dep → el efecto re-corre al regresar). Así el toast
    // siempre sale visible, nunca detrás de scan-meal. Dentro de (tabs)
    // —cualquier tab— emite al instante.
    if (!ready || !pctSig || !insideTabs || !isToday) return
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
  }, [ready, pctSig, reducedMotion, insideTabs, isToday])

  // Unmount the flight layer once the rise is over.
  useEffect(() => {
    if (!flight) return
    const id = setTimeout(() => setFlight(null), 1550)
    return () => clearTimeout(id)
  }, [flight])

  // Brief still over the wire → render nothing. The section simply
  // appears once the data is settled; no spinner for a reward layer.
  if (!attributes || !input) return null

  const openAttr = openKey ? (attributes.find((a) => a.key === openKey) ?? null) : null
  const flightIdx = flight ? attributes.findIndex((a) => a.key === flight.key) : -1

  // Estado durmiente: nada registrado aún hoy → la rejilla 2×2 mostraría
  // cuatro "0%", que lee como "examen diario en ceros" (contra el manifiesto).
  // En su lugar, UNA línea cálida que invita sin exigir; la rejilla aparece
  // sola en cuanto un registro la enciende.
  const allDormant = attributes.every((a) => a.pct <= 0)

  return (
    <View style={styles.section}>
      <EyebrowLabel tone="magenta">Tu universo hoy</EyebrowLabel>
      {allDormant ? (
        <Text style={styles.dormantLine}>
          Aún no enciendes nada hoy. En cuanto registres algo, tu universo aparece aquí.
        </Text>
      ) : (
        <>
          {/* Los primeros 3 días el susurro de bienvenida REEMPLAZA al caption
              (introduce "solo suma" en voz del coach y se desvanece solo);
              después queda el caption quieto de siempre — nunca se apilan. */}
          {showIntro ? (
            <Animated.Text entering={FadeIn.duration(400)} style={styles.introWhisper}>
              Cada registro enciende algo. Tu universo solo crece.
            </Animated.Text>
          ) : (
            <Text style={styles.sectionCaption}>Lo que tus registros hicieron florecer hoy.</Text>
          )}
          {/* Group-level affordance — the app's proven, on-brand pattern (same
              as the calendar's "toca un día…"). One quiet line teaches the
              whole grid is tappable, so the cards stay clean (no per-card
              chrome that fights the cosmos). */}
          <Text style={styles.tapHint}>Toca una categoría para ver cómo progresa.</Text>
          {/* Un SOLO panel con las 4 columnas divididas por hairlines verticales
              (ya no 4 tarjetas con borde propio). Cada columna sigue siendo
              tappable → expande su detalle abajo. */}
          <View style={styles.gridWrap}>
            <View style={styles.grid}>
              {attributes.map((attr, i) => (
                <AttributeCard
                  key={attr.key}
                  attr={attr}
                  source={input ? sourceLineFor(attr.key, input) : ''}
                  divided={i > 0}
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
        </>
      )}
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

/* ── One attribute card ────────────────────────────────────────────── */

const RING_SIZE = 64
const RING_STROKE = 4
const RING_R = RING_SIZE / 2 - RING_STROKE
const RING_C = 2 * Math.PI * RING_R
const RING_MID = RING_SIZE / 2

// Destellos de cruz del astro encendido — 4 ticks cardinales cortos
// alrededor de la corona (radio ~8–14 px). Simétrico en los 4 ejes: la
// rotación -90° del <Svg> no lo altera. Coords en el viewBox de 64.
const ASTRO_CROSS = 'M32 18 V24 M32 40 V46 M18 32 H24 M40 32 H46'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// The concrete source behind each attribute's % — what you registered today,
// in plain numbers (food count, water glasses, sleep, check-in). Replaces the
// vague "Crece con…" copy so the card answers "¿cuánto y de qué?".
function sourceLineFor(key: UniverseAttributeKey, input: UniverseInput): string {
  switch (key) {
    case 'energia':
      return input.mealCount === 0
        ? 'Aún sin comidas hoy'
        : `${input.mealCount} ${input.mealCount === 1 ? 'comida' : 'comidas'} hoy`
    case 'claridad':
      return `${formatGlasses(input.waterGlasses)} / ${Math.max(1, input.waterGoalGlasses)} vasos`
    case 'estabilidad':
      if (input.sleepMinutes != null) {
        const h = Math.floor(input.sleepMinutes / 60)
        const m = input.sleepMinutes % 60
        return m > 0 ? `${h} h ${m} min de sueño` : `${h} h de sueño`
      }
      return input.restedToday ? 'Descanso hoy' : 'Aún sin sueño'
    case 'brillo': {
      // Promedio de energía/motivación/calma (1–5). Refleja tu estado del día.
      const avg = wellbeingAvg(input)
      return avg != null ? `${Math.round(avg * 10) / 10} / 5` : 'Te espera'
    }
  }
}

type CardProps = {
  attr: UniverseAttribute
  /** Concrete source line for the closed card ("2 comidas hoy", "3 de 8 vasos"). */
  source: string
  /** Lleva divisor vertical a la izquierda (todas menos la primera columna). */
  divided: boolean
  reducedMotion: boolean
  selected: boolean
  onPress: () => void
}

function AttributeCard({ attr, source, divided, reducedMotion, selected, onPress }: CardProps) {
  const accent = UNIVERSE_ACCENT[attr.key]
  // La card LIDERA con la acción (Comida/Agua/…) — concreta, sin traducir.
  // La recompensa (Energía/…) se descubre como secundaria, "Contribuye a".
  const action = ACTION_LABEL[attr.key]
  const reward = ATTRIBUTE_LABEL[attr.key]

  // Seeded at the CURRENT pct — no mount sweep; only changes animate.
  const progress = useSharedValue(attr.pct)
  const glow = useSharedValue(0)
  const prevPctRef = useRef(attr.pct)
  const prevStateRef = useRef(attr.state)
  const [burstKey, setBurstKey] = useState(0)

  // ── Affordance: interaction system (expand). Scale-on-press from the
  // shared usePressFeedback; the ⌄/⌃ chevron + the active border (when
  // selected) are the other signals. Haptic off here — the parent already
  // fires a selection tick on press, so we don't double up.
  const { onPressIn, onPressOut, animatedStyle } = usePressFeedback({ haptic: false })

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

  // Unmount the particle layer once the drift is over (~1150 ms + delays)
  // so absolute views aren't kept alive per completed card.
  useEffect(() => {
    if (burstKey === 0) return
    const id = setTimeout(() => setBurstKey(0), 1450)
    return () => clearTimeout(id)
  }, [burstKey])

  const ringProps = useAnimatedProps(() => ({
    strokeDasharray: [(RING_C * progress.value) / 100, RING_C],
  }))
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }))

  const accentMuted = UNIVERSE_ACCENT_MUTED[attr.key]
  const complete = attr.state === 'complete'
  // El glifo es el astro: pleno al encenderse, atenuado mientras orbita,
  // apenas niebla en calma.
  const astroColor = complete ? accent : attr.pct > 0 ? accentMuted : colors.niebla

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.cardHit, divided && styles.colDivider]}
      accessibilityRole="button"
      accessibilityState={{ expanded: selected }}
      accessibilityLabel={`${action}, ${attr.pct} por ciento. Contribuye a ${reward}. ${source}`}
      accessibilityHint="Expande para ver el detalle"
    >
      <Animated.View
        style={[
          styles.card,
          complete && { borderColor: tint(accent, '4D') },
          selected && { borderColor: tint(accent, '8C') },
          animatedStyle,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.cardGlow, { backgroundColor: tint(accent, '1F') }, glowStyle]}
        />

        <View style={styles.ringZone}>
          <Svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            style={styles.ringSvg}
          >
            {/* el campo: track fino, no una barra a llenar */}
            <Circle
              cx={RING_MID}
              cy={RING_MID}
              r={RING_R}
              fill="none"
              stroke={colors.hairline}
              strokeWidth={1}
            />

            {complete ? (
              <>
                {/* anillo de luz exterior — la corona de la órbita */}
                <Circle
                  cx={RING_MID}
                  cy={RING_MID}
                  r={RING_R + 3}
                  fill="none"
                  stroke={tint(accent, '26')}
                  strokeWidth={1}
                />
                {/* órbita cerrada, color pleno */}
                <Circle
                  cx={RING_MID}
                  cy={RING_MID}
                  r={RING_R}
                  fill="none"
                  stroke={accent}
                  strokeWidth={2.5}
                />
                {/* corona difusa detrás del astro — halo dibujado, no blur */}
                <Circle cx={RING_MID} cy={RING_MID} r={9} fill={tint(accent, '1A')} />
                <Circle cx={RING_MID} cy={RING_MID} r={5.5} fill={tint(accent, '33')} />
                {/* puntas de estrella */}
                <Path
                  d={ASTRO_CROSS}
                  stroke={tint(accent, '80')}
                  strokeWidth={1}
                  strokeLinecap="round"
                />
              </>
            ) : attr.kind === 'progress' ? (
              /* órbita en progreso — arco atenuado, one-shot al subir */
              <AnimatedCircle
                cx={RING_MID}
                cy={RING_MID}
                r={RING_R}
                fill="none"
                stroke={accentMuted}
                strokeWidth={2.5}
                strokeLinecap="round"
                animatedProps={ringProps}
              />
            ) : attr.pct > 0 ? (
              /* gesto con una señal, aún no encendido: chispa tenue del
               astro, sin arco proporcional — un tap no es una barra. */
              <Circle cx={RING_MID} cy={RING_MID} r={6} fill={tint(accent, '1A')} />
            ) : null}
          </Svg>
          <View style={styles.ringCenter} pointerEvents="none">
            <AttributeIcon attrKey={attr.key} color={astroColor} size={24} />
          </View>
          {burstKey > 0 ? <ParticleBurst key={burstKey} color={accent} /> : null}
        </View>

        {/* % grande → acción → la recompensa que genera (compacto para la
            columna). El estado concreto y el resto vive al expandir (tap). */}
        <Text
          style={[styles.pctNum, { color: complete ? accent : colors.leche }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {attr.pct}
          <Text style={styles.pctSign}>%</Text>
        </Text>
        <Text style={[styles.colLabel, { color: complete ? accent : colors.bone }]}>{action}</Text>
        <Text style={[styles.colReward, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>
          {/* La recompensa "+N Atributo"; en 0 cae al estado real ("0 / 8 vasos"). */}
          {attr.pct > 0 ? `+${attr.pct} ${reward}` : source}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

/* ── Detalle al tocar un card ──────────────────────────────────────── */

// El "¿y eso qué significa?": qué representa el atributo (voz del
// coach) + las cifras reales de hoy. La matemática vive en
// detailForAttribute (pura); esto solo la pinta.
function AttributeDetail({ attr, input }: { attr: UniverseAttribute; input: UniverseInput }) {
  const accent = UNIVERSE_ACCENT[attr.key]
  const action = ACTION_LABEL[attr.key]
  const reward = ATTRIBUTE_LABEL[attr.key]
  const detail = detailForAttribute(attr.key, input)

  // Detalle CLARO, sin lore: qué acción, cuánto llevo, qué recompensa genera.
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={[styles.detail, { borderColor: tint(accent, '33') }]}
    >
      <View style={styles.detailHeader}>
        <AttributeIcon attrKey={attr.key} color={accent} />
        <Text style={[styles.detailTitle, { color: accent }]}>{action}</Text>
        <Text style={styles.detailPct}>
          {attr.pct}
          <Text style={styles.pctSign}>%</Text>
        </Text>
      </View>
      {/* Impacto — la recompensa concreta que genera la acción. */}
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Impacto</Text>
        <Text style={[styles.detailValue, { color: accent }]}>
          +{attr.pct} {reward}
        </Text>
      </View>
      {/* Cifras reales de hoy — "cuánto llevo". */}
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

function AttributeIcon({
  attrKey,
  color,
  size = 13,
}: {
  attrKey: UniverseAttributeKey
  color: string
  size?: number
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
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

export function ParticleBurst({ color }: { color: string }) {
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

export function FlightToConstellation({
  attrKey,
  index,
}: {
  attrKey: UniverseAttributeKey
  index: number
}) {
  const accent = UNIVERSE_ACCENT[attrKey]
  // Fila de 4 columnas → origen en el centro de la columna que subió
  // (12.5 / 37.5 / 62.5 / 87.5 %). El anillo vive en la franja superior.
  const baseLeft = (index + 0.5) * 25
  const baseTop = 26

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
    t.value = withDelay(delay, withTiming(1, { duration: 1150, easing: easing.out }))
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
    // s6 (no s5) para separar este bloque de "Tu transformación" de
    // arriba: son dos cosas distintas y antes se leían como una pila.
    marginTop: spacing.s6,
    marginBottom: spacing.s3,
  },
  // Una línea callada que nombra qué es la sección — la conexión
  // registro → atributo no siempre se ve (si entras a media tarde, los
  // astros ya están encendidos sin causa visible).
  sectionCaption: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    marginTop: spacing.s1,
    marginBottom: spacing.s4,
  },
  // Group-level tap hint — sits just under the caption, close to the grid it
  // describes. Quiet niebla, same register as the calendar's "toca un día…".
  tapHint: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    marginTop: -spacing.s3,
    marginBottom: spacing.s4,
  },
  // Estado durmiente — una sola línea cálida en vez de 4 tarjetas en 0%.
  // Voz del coach (serif italic), invita sin exigir.
  dormantLine: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    marginTop: spacing.s1,
  },
  // Susurro de bienvenida (≤3 días) — voz del coach, cálido, introduce
  // "nada se resta" sin enseñarlo. Se va solo cuando cierra la ventana.
  introWhisper: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    marginTop: spacing.s1,
    marginBottom: spacing.s4,
  },
  // El PANEL único: un contenedor con borde sutil que aloja las 4 columnas
  // (ya no 4 tarjetas sueltas). Es también el ancla del overlay de vuelo (las
  // partículas se desbordan hacia arriba, por eso overflow visible por default).
  gridWrap: {
    position: 'relative',
    marginTop: spacing.s2,
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingVertical: spacing.s4,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  // Cada columna ocupa un cuarto del panel (4 en fila, sin wrap).
  cardHit: {
    flex: 1,
  },
  // Divisor vertical entre columnas (todas menos la primera).
  colDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.hairline,
  },
  // La columna ya no es tarjeta: sin fondo ni borde, solo centra su contenido.
  card: {
    alignItems: 'center',
    paddingVertical: spacing.s1,
    paddingHorizontal: spacing.s1,
    overflow: 'hidden',
  },
  // The pulse wash — fills the column, pulses once on upgrade.
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
  ringZone: {
    width: RING_SIZE,
    height: RING_SIZE,
    marginBottom: spacing.s2,
  },
  ringSvg: {
    transform: [{ rotate: '-90deg' }],
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctSign: {
    fontSize: 11,
    color: colors.niebla,
  },
  // The explicit % — a number, not just the ring. Earned progress in leche /
  // accent when complete.
  pctNum: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.deltaNum,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  // La acción (Sueño/Comida/Agua/Ánimo) bajo el número.
  colLabel: {
    marginTop: spacing.s1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: typography.letterSpacing.bodyLoose,
    textAlign: 'center',
  },
  // La recompensa que genera ("+100 Estabilidad"), en su acento.
  colReward: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    textAlign: 'center',
  },
  particle: {
    position: 'absolute',
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
