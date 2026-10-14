/*
 * El detalle de "Lo que no sabías" (ST-006 · D-03) como MOMENTO de
 * descubrimiento (dueña 13 oct 2026: "se supone que es un nuevo
 * descubrimiento"; revisión UX): pantalla completa, un solo héroe.
 *
 *   · Eyebrow en el color del dato: la primera vez "Nuevo patrón encontrado";
 *     después, su etiqueta de evidencia.
 *   · Íconos de lo que se cruza (gramática de Destacados de Salud).
 *   · HÉROE: un anillo grande en el color del dato con el número que cuenta
 *     ("9 de 11 días"). El otro lado baja a una fila chica, sin pelear.
 *     Hallazgos de promedio (kcal, g): el valor fuerte como héroe numérico.
 *   · La frase, luego HOY (lo que puedes hacer con esto), luego la evidencia en
 *     una línea, y "Lo que todavía no sabemos" al pie.
 *
 * Primera vez: el anillo se llena mientras el número cuenta; al cerrar, una
 * corona de chispas en el color del dato + háptico, y entra el resto. Un toque
 * en el héroe salta la secuencia; reduce-motion la quita. Visitas siguientes:
 * todo ya dibujado. Sin ✦: lo encontró el motor (regla IA visible). Copy plano,
 * evidencia primero, sin cierre poético.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import { colors, typography } from '@/theme'

import { EVIDENCE_LABEL_TEXT, type EvidenceLabel, type PatternSample } from '../evidence-label'
import { evidenceLook, type EvidenceIcon, type EvidenceLook } from '../evidence-highlight'
import type { Surprise, SurpriseSide, SurpriseToday } from '../surprise'

import { InsightFeedback, type InsightFeedbackProps } from './InsightFeedback'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const HERO = 232
const HERO_STROKE = 22
const MINI = 40
const MINI_STROKE = 5
const FILL_MS = 1100
const FILL_DELAY = 350
const SPARKS = 16
const HALO = HERO * 1.5

/* ── Anillo ─────────────────────────────────────────────────────────── */

function Ring({
  size,
  stroke,
  color,
  track,
  progress,
  pct,
}: {
  size: number
  stroke: number
  color: string
  track: string
  progress: SharedValue<number>
  pct: number
}) {
  const r = size / 2 - stroke / 2 - 1
  const c = 2 * Math.PI * r
  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [c * pct * progress.value, c],
  }))
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: [{ rotate: '-90deg' }] }}
    >
      <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        animatedProps={animatedProps}
      />
    </Svg>
  )
}

/* ── Corona de chispas (solo la primera vez) ─────────────────────────── */

function Spark({
  t,
  angle,
  color,
  radius,
}: {
  t: SharedValue<number>
  angle: number
  color: string
  radius: number
}) {
  const style = useAnimatedStyle(() => {
    const d = radius + t.value * 46
    return {
      opacity: t.value <= 0 ? 0 : 1 - t.value,
      transform: [
        { translateX: Math.cos(angle) * d },
        { translateY: Math.sin(angle) * d },
        { scale: 1 - t.value * 0.5 },
      ],
    }
  })
  return <Animated.View style={[styles.spark, { backgroundColor: color }, style]} />
}

function SparkCrown({ t, color }: { t: SharedValue<number>; color: string }) {
  const radius = HERO / 2 - HERO_STROKE / 2
  return (
    <View style={styles.sparkLayer} pointerEvents="none">
      {Array.from({ length: SPARKS }, (_, i) => (
        <Spark
          key={i}
          t={t}
          angle={(i / SPARKS) * Math.PI * 2 - Math.PI / 2}
          color={i % 3 === 0 ? colors.oroLeche : color}
          radius={radius}
        />
      ))}
    </View>
  )
}

/* ── Héroe ──────────────────────────────────────────────────────────── */

/** El número que cuenta hasta `to` en `ms` (JS, una sola vez). */
function useCountUp(to: number, ms: number, delay: number, run: boolean): number {
  const [n, setN] = useState(run ? 0 : to)
  useEffect(() => {
    if (!run) {
      setN(to)
      return
    }
    let raf = 0
    const start = Date.now() + delay
    const tick = () => {
      const k = Math.min(1, Math.max(0, (Date.now() - start) / ms))
      setN(Math.round(to * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, ms, delay, run])
  return n
}

function RateHero({
  strong,
  other,
  accent,
  reveal,
  onRevealed,
}: {
  strong: SurpriseSide
  other: SurpriseSide
  accent: string
  reveal: boolean
  onRevealed: () => void
}) {
  const pct = strong.total > 0 ? Math.min(1, strong.hits / strong.total) : 0
  const otherPct = other.total > 0 ? Math.min(1, other.hits / other.total) : 0
  const fill = useSharedValue(reveal ? 0 : 1)
  const burst = useSharedValue(0)
  const shown = useCountUp(strong.hits, FILL_MS, FILL_DELAY, reveal)
  const done = useRef(false)

  useEffect(() => {
    if (!reveal) return
    fill.value = withDelay(
      FILL_DELAY,
      withTiming(1, { duration: FILL_MS, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }),
    )
    const timer = setTimeout(() => {
      if (done.current) return
      done.current = true
      burst.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      onRevealed()
    }, FILL_DELAY + FILL_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal])

  return (
    <View style={styles.heroCol}>
      <View style={styles.heroRing}>
        {/* Halo estático en el color del dato (degradado fijo: animar colores
            de un gradiente crashea en device). */}
        <Svg width={HALO} height={HALO} style={styles.halo} pointerEvents="none">
          <Defs>
            <RadialGradient id="surpriseHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={accent} stopOpacity={0.28} />
              <Stop offset="0.55" stopColor={accent} stopOpacity={0.08} />
              <Stop offset="1" stopColor={accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={HALO / 2} cy={HALO / 2} r={HALO / 2} fill="url(#surpriseHalo)" />
        </Svg>
        <Ring
          size={HERO}
          stroke={HERO_STROKE}
          color={accent}
          track={`${accent}26`}
          progress={fill}
          pct={pct}
        />
        <View style={styles.heroCenter} pointerEvents="none">
          <Text style={styles.heroNum}>{shown}</Text>
          <Text style={styles.heroOf}>{`de ${strong.total} días`}</Text>
          <Text style={[styles.heroSub, { color: accent }]}>en déficit</Text>
        </View>
        {reveal ? <SparkCrown t={burst} color={accent} /> : null}
      </View>
      <Text style={styles.heroLabel}>{strong.label}</Text>
      <View
        style={styles.otherRow}
        accessible
        accessibilityLabel={`${other.label}: ${other.hits} de ${other.total} días en déficit`}
      >
        <Ring
          size={MINI}
          stroke={MINI_STROKE}
          color={colors.niebla}
          track={colors.hairline}
          progress={fill}
          pct={otherPct}
        />
        <Text style={styles.otherText}>
          {`${other.label}: `}
          <Text style={styles.otherNum}>{`${other.hits} de ${other.total}`}</Text>
        </Text>
      </View>
    </View>
  )
}

/** Hallazgo de promedio (kcal, g): el valor fuerte como héroe numérico. */
function AverageHero({ rows, accent }: { rows: Surprise['rows']; accent: string }) {
  const strong = rows.find((r) => r.strong) ?? rows[0]
  const other = rows.find((r) => r !== strong)
  if (!strong) return null
  return (
    <View style={styles.heroCol}>
      <Text style={[styles.avgNum, { color: accent }]}>{strong.value}</Text>
      <Text style={styles.heroLabel}>{strong.label}</Text>
      {other ? (
        <Text style={[styles.otherText, styles.avgOther]}>
          {`${other.label}: `}
          <Text style={styles.otherNum}>{other.value}</Text>
        </Text>
      ) : null}
    </View>
  )
}

/* ── Piezas compartidas con el modal de patrones ──────────────────────── */

/** La comparación de un hallazgo de promedio: dos filas, la fuerte primero. */
export function SurpriseRows({ rows }: { rows: Surprise['rows'] }) {
  return (
    <View style={styles.rows}>
      {rows.map((r) => (
        <View key={r.label} style={styles.row}>
          <Text style={[styles.rowLabel, r.strong && styles.rowStrong]}>{r.label}</Text>
          <Text style={[styles.rowValue, r.strong && styles.rowValueStrong]}>{r.value}</Text>
        </View>
      ))}
    </View>
  )
}

/** "Lo que todavía no sabemos": los límites del hallazgo. `footnote` = al pie,
 *  en letra chica (detalle de sorpresa); si no, bloque normal. */
export function EvidenceUnknowns({
  lines,
  footnote = false,
}: {
  lines: readonly string[] | undefined
  footnote?: boolean
}) {
  if (!lines || lines.length === 0) return null
  return (
    <View style={[styles.unknowns, footnote && styles.unknownsFootnote]}>
      <Text style={styles.unknownsTitle}>Lo que todavía no sabemos</Text>
      {lines.map((u) => (
        <Text key={u} style={[styles.unknown, footnote && styles.unknownFootnote]}>
          {u}
        </Text>
      ))}
    </View>
  )
}

/** Hoy frente al corte del hallazgo: tu dato real y lo que falta. En curso =
 *  color del dato; alcanzado = oro (oro = lo que ya hiciste). */
function TodayBlock({ today, look }: { today: SurpriseToday; look: EvidenceLook }) {
  const pct = Math.min(1, today.value / today.target)
  const icon = look.icons[0]
  return (
    <View style={styles.today} accessible accessibilityLabel={today.text}>
      <View style={styles.todayHead}>
        {icon ? <MaterialCommunityIcons name={icon.name} size={16} color={icon.color} /> : null}
        <Text style={[styles.todayKicker, { color: look.accent }]}>Hoy</Text>
      </View>
      <Text style={styles.todayText}>{today.text}</Text>
      <View style={styles.todayTrack}>
        <View
          style={[
            styles.todayFill,
            { backgroundColor: today.reached ? colors.oro : look.accent },
            { width: `${Math.max(3, Math.round(pct * 100))}%` },
          ]}
        />
      </View>
    </View>
  )
}

/* ── La tarjeta del feed ─────────────────────────────────────────────── */

const CARD_RING = 84
const CARD_STROKE = 9

/** La tarjeta de un hallazgo: íconos + eyebrow en el color del dato, anillo
 *  chico (o valor de promedio) junto a la frase, el otro lado, dónde vas HOY y
 *  el CTA. Se lee en ~3 s (dueña 14 oct 2026: "demasiada lectura"): la muestra
 *  y la fuente viven en el detalle, a un toque. */
export function DiscoveryCard({
  look,
  eyebrow,
  title,
  ring,
  avgValue,
  otherLine,
  todayLine,
  ctaLabel,
  onOpen,
  compact = false,
}: {
  look: EvidenceLook
  eyebrow: string
  title: string
  ring?: { hits: number; total: number } | null
  avgValue?: string | null
  otherLine?: string | null
  /** Dónde vas hoy frente al hallazgo (solo con dato de hoy). */
  todayLine?: string | null
  ctaLabel: string
  onOpen: () => void
  /** Hoy: sin márgenes del feed de Descubre. */
  compact?: boolean
}) {
  const full = useSharedValue(1)
  return (
    <Animated.View entering={FadeIn.duration(420)} style={!compact && styles.cardWrap}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={[eyebrow, title, otherLine, todayLine, ctaLabel]
          .filter(Boolean)
          .join('. ')}
        style={({ pressed }) => [
          styles.card,
          { borderColor: `${look.accent}40` },
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardIcons}>
            {look.icons.map((icon, i) => (
              <View
                key={icon.name}
                style={[
                  styles.cardIconDisc,
                  { backgroundColor: `${icon.color}33` },
                  i > 0 && styles.cardIconOverlap,
                ]}
              >
                <MaterialCommunityIcons name={icon.name} size={17} color={icon.color} />
              </View>
            ))}
          </View>
          <Text style={[styles.cardEyebrow, { color: look.accent }]} numberOfLines={2}>
            {eyebrow}
          </Text>
        </View>
        <View style={styles.cardBody}>
          {ring ? (
            <View style={{ width: CARD_RING, height: CARD_RING }}>
              <Ring
                size={CARD_RING}
                stroke={CARD_STROKE}
                color={look.accent}
                track={`${look.accent}26`}
                progress={full}
                pct={ring.total > 0 ? ring.hits / ring.total : 0}
              />
              <View style={styles.heroCenter} pointerEvents="none">
                <Text style={styles.cardRingNum}>
                  {ring.hits}
                  <Text style={styles.cardRingOf}>{`/${ring.total}`}</Text>
                </Text>
              </View>
            </View>
          ) : avgValue ? (
            <Text style={[styles.cardAvg, { color: look.accent }]}>{avgValue}</Text>
          ) : null}
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        {otherLine ? <Text style={styles.cardOther}>{otherLine}</Text> : null}
        {todayLine ? <Text style={styles.cardToday}>{todayLine}</Text> : null}
        <View style={styles.cardCta}>
          <Text style={[styles.cardCtaText, { color: look.accent }]}>{ctaLabel}</Text>
          <Text style={[styles.cardCtaText, { color: look.accent }]}>→</Text>
        </View>
      </Pressable>
    </Animated.View>
  )
}

/** "N días comparados · con tus registros…": la evidencia en una línea. */
export function evidenceLineOf(sample: PatternSample | undefined, source: string): string {
  const total = sample ? (sample.total ?? sample.groups.reduce((a, g) => a + g.days, 0)) : null
  return [total ? `${total} días comparados` : null, source.toLowerCase()]
    .filter(Boolean)
    .join(' · ')
}

/** "Lo que no sabías" en el feed: la misma gramática que su detalle (íconos,
 *  color del dato, anillo) en chico, para que tocarla abra lo que promete. */
export function SurpriseCard({
  surprise,
  label,
  today,
  onOpen,
  ctaLabel = 'Ver el detalle',
  compact = false,
}: {
  surprise: Surprise
  label: EvidenceLabel
  /** Dónde va hoy frente al corte (surpriseToday); null sin dato de hoy. */
  today?: SurpriseToday | null
  onOpen: () => void
  ctaLabel?: string
  compact?: boolean
}) {
  const compare = surprise.compare
  const strongRow = surprise.rows.find((r) => r.strong) ?? surprise.rows[0]
  const otherRow = surprise.rows.find((r) => r !== strongRow)
  return (
    <DiscoveryCard
      look={evidenceLook(surprise.id, colors.oro)}
      eyebrow={`Lo que no sabías · ${EVIDENCE_LABEL_TEXT[label]}`}
      title={surprise.headline}
      ring={compare ? { hits: compare.strong.hits, total: compare.strong.total } : null}
      avgValue={compare ? null : (strongRow?.value ?? null)}
      otherLine={
        compare
          ? `${compare.other.label}: ${compare.other.hits}\u00a0de\u00a0${compare.other.total}`
          : otherRow
            ? `${otherRow.label}: ${otherRow.value}`
            : null
      }
      todayLine={today?.text ?? null}
      ctaLabel={ctaLabel}
      onOpen={onOpen}
      compact={compact}
    />
  )
}

/* ── La pantalla ────────────────────────────────────────────────────── */

export function SurpriseDetailModal({
  visible,
  surprise,
  label,
  source,
  unknowns,
  today,
  firstTime,
  feedback,
  onClose,
}: {
  visible: boolean
  surprise: Surprise
  label: EvidenceLabel
  source: string
  unknowns: string[]
  today: SurpriseToday | null
  /** Primera apertura de este hallazgo: la revelación completa. */
  firstTime: boolean
  /** "¿Esto coincide con tus días?" (ST-008); sin él, no se pregunta. */
  feedback?: InsightFeedbackProps
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const reduce = useReducedMotion() ?? false
  const look = evidenceLook(surprise.id, colors.oro)
  const compare = surprise.compare
  const [skipped, setSkipped] = useState(false)
  const reveal = visible && firstTime && !reduce && !skipped && compare != null
  // El resto entra cuando el anillo cerró (o de una vez si no hay revelación).
  const [restIn, setRestIn] = useState(!reveal)
  useEffect(() => {
    if (!visible) {
      setSkipped(false)
      return
    }
    setRestIn(!reveal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const eyebrow = firstTime
    ? label === 'patron'
      ? 'Nuevo patrón encontrado'
      : 'Nueva observación'
    : EVIDENCE_LABEL_TEXT[label]
  const evidenceLine = evidenceLineOf(surprise.sample, source)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 120 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.eyebrow, { color: look.accent }]}>{eyebrow}</Text>
          <View style={styles.icons}>
            {look.icons.map((icon, i) => (
              <View
                key={icon.name}
                style={[
                  styles.iconDisc,
                  { backgroundColor: `${icon.color}33` },
                  i > 0 && styles.iconOverlap,
                ]}
              >
                <MaterialCommunityIcons name={icon.name} size={26} color={icon.color} />
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => {
              if (reveal) {
                setSkipped(true)
                setRestIn(true)
              }
            }}
            accessibilityRole={reveal ? 'button' : undefined}
            accessibilityLabel={reveal ? 'Saltar animación' : undefined}
          >
            {compare ? (
              <RateHero
                key={reveal ? 'reveal' : 'calm'}
                strong={compare.strong}
                other={compare.other}
                accent={look.accent}
                reveal={reveal}
                onRevealed={() => setRestIn(true)}
              />
            ) : (
              <AverageHero rows={surprise.rows} accent={look.accent} />
            )}
          </Pressable>

          {restIn ? (
            <Animated.View entering={FadeIn.duration(firstTime ? 420 : 200)} style={styles.rest}>
              <Text style={styles.title}>{surprise.headline}</Text>
              {today ? <TodayBlock today={today} look={look} /> : null}
              <Text style={styles.evidence}>{evidenceLine}</Text>
              <EvidenceUnknowns lines={unknowns} footnote />
              {feedback ? <InsightFeedback {...feedback} /> : null}
            </Animated.View>
          ) : null}
        </ScrollView>

        <Pressable
          onPress={onClose}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={[styles.close, { top: insets.top + 12 }]}
        >
          <Text style={styles.closeX}>✕</Text>
        </Pressable>
        <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaText}>Listo</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

/* ── "Tu día fuerte" a pantalla completa ──────────────────────────────── */

export type ComboDetailHero =
  | {
      kind: 'gap'
      /** "350 kcal" */
      value: string
      /** "más abajo que tus otros días" */
      caption: string
      bars: { label: string; value: string; pct: number; strong: boolean }[]
    }
  | { kind: 'rate'; strong: SurpriseSide; other: SurpriseSide }

/**
 * El detalle de "Tu día fuerte" con la MISMA gramática que el de la sorpresa
 * (dueña 14 oct 2026: "si nos inspiramos en Fitness y Salud, esta view también
 * debe sentirse así"): etiqueta en el color del dato, íconos de lo que se
 * cruza, UN héroe (la diferencia en kcal con sus dos barras, estilo Destacados
 * de Salud; sin kcal, el anillo de días en déficit), la frase, HOY, la
 * evidencia en una línea, tus días, los límites y "¿Coincide?". Presentacional:
 * los números llegan calculados por el motor.
 */
export function ComboDetailModal({
  visible,
  eyebrow,
  icons,
  hero,
  title,
  today,
  evidenceLine,
  daysLine,
  unknowns,
  feedback,
  onClose,
}: {
  visible: boolean
  eyebrow: string
  icons: EvidenceIcon[]
  hero: ComboDetailHero
  title: string
  /** Los hábitos del combo hoy: "Sueño · 6 h", hecho o no. */
  today: { label: string; value: string; on: boolean }[]
  evidenceLine: string | null
  daysLine: string | null
  unknowns: string[]
  feedback?: InsightFeedbackProps
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const accent = colors.oro
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 120 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow}</Text>
          <View style={styles.icons}>
            {icons.map((icon, i) => (
              <View
                key={icon.name}
                style={[
                  styles.iconDisc,
                  { backgroundColor: `${icon.color}33` },
                  i > 0 && styles.iconOverlap,
                ]}
              >
                <MaterialCommunityIcons name={icon.name} size={26} color={icon.color} />
              </View>
            ))}
          </View>

          {hero.kind === 'gap' ? (
            <View
              style={styles.heroCol}
              accessible
              accessibilityLabel={`${hero.value} ${hero.caption}. ${hero.bars
                .map((b) => `${b.label}: ${b.value}`)
                .join(', ')}.`}
            >
              <Text style={[styles.avgNum, { color: accent }]}>{hero.value}</Text>
              <Text style={styles.heroLabel}>{hero.caption}</Text>
              <View style={styles.comboBars}>
                {hero.bars.map((b) => (
                  <View key={b.label} style={styles.comboBarRow}>
                    <View style={styles.comboBarHead}>
                      <Text style={[styles.comboBarLabel, b.strong && styles.comboBarStrong]}>
                        {b.label}
                      </Text>
                      <Text style={[styles.comboBarValue, b.strong && { color: accent }]}>
                        {b.value}
                      </Text>
                    </View>
                    <View style={styles.comboBarTrack}>
                      <View
                        style={[
                          styles.comboBarFill,
                          { width: `${Math.max(3, Math.round(b.pct * 100))}%` },
                          { backgroundColor: b.strong ? accent : colors.niebla },
                        ]}
                      />
                    </View>
                  </View>
                ))}
                <Text style={styles.comboBarCaption}>Contra tu meta de calorías, en promedio</Text>
              </View>
            </View>
          ) : (
            <RateHero
              strong={hero.strong}
              other={hero.other}
              accent={accent}
              reveal={false}
              onRevealed={() => {}}
            />
          )}

          <Animated.View entering={FadeIn.duration(200)} style={styles.rest}>
            <Text style={styles.title}>{title}</Text>
            {today.length > 0 ? (
              <View style={styles.today}>
                <View style={styles.todayHead}>
                  <MaterialCommunityIcons name="white-balance-sunny" size={16} color={accent} />
                  <Text style={[styles.todayKicker, { color: accent }]}>Hoy</Text>
                </View>
                <View style={styles.comboChips}>
                  {today.map((h) => (
                    <View
                      key={h.label}
                      style={[styles.comboChip, h.on && styles.comboChipOn]}
                      accessible
                      accessibilityLabel={`${h.label}: ${h.on ? 'hecho, ' : ''}${h.value}`}
                    >
                      <Text style={styles.comboChipLabel}>{h.label}</Text>
                      <Text style={[styles.comboChipValue, h.on && { color: colors.oroLeche }]}>
                        {h.on ? `${h.value} ✓` : h.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {evidenceLine ? <Text style={styles.evidence}>{evidenceLine}</Text> : null}
            {daysLine ? <Text style={[styles.evidence, styles.comboDays]}>{daysLine}</Text> : null}
            <EvidenceUnknowns lines={unknowns} footnote />
            {feedback ? <InsightFeedback {...feedback} /> : null}
          </Animated.View>
        </ScrollView>

        <Pressable
          onPress={onClose}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={[styles.close, { top: insets.top + 12 }]}
        >
          <Text style={styles.closeX}>✕</Text>
        </Pressable>
        <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaText}>Listo</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  comboBars: { alignSelf: 'stretch', marginTop: 24, gap: 14 },
  comboBarRow: { gap: 6 },
  comboBarHead: { flexDirection: 'row', justifyContent: 'space-between' },
  comboBarLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  comboBarStrong: { color: colors.leche },
  comboBarValue: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  comboBarTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.hairline,
    overflow: 'hidden',
  },
  comboBarFill: { height: 12, borderRadius: 6 },
  comboBarCaption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  comboChips: { flexDirection: 'row', gap: 8, marginTop: 10 },
  comboChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.bgCard2,
    gap: 2,
  },
  comboChipOn: { backgroundColor: 'rgba(217, 174, 111, 0.16)' },
  comboChipLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  comboChipValue: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.bone,
  },
  comboDays: { marginTop: 4 },
  cardWrap: { marginTop: 4, marginBottom: 36 },
  card: {
    padding: 20,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(244, 236, 222, 0.04)',
    gap: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcons: { flexDirection: 'row' },
  cardIconDisc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  cardIconOverlap: { marginLeft: -8 },
  cardEyebrow: {
    flex: 1,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cardRingNum: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displaySm,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  cardRingOf: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  cardAvg: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displaySm,
    fontVariant: ['tabular-nums'],
  },
  cardTitle: {
    flex: 1,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.heading,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: colors.leche,
  },
  cardOther: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  cardToday: {
    marginTop: -6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  cardCta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  cardCtaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.4,
  },
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, alignItems: 'center' },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.eyebrow,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  icons: { flexDirection: 'row', marginTop: 16, marginBottom: 22 },
  iconDisc: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  iconOverlap: { marginLeft: -10 },
  heroCol: { alignItems: 'center' },
  heroRing: {
    width: HERO,
    height: HERO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: { position: 'absolute', left: (HERO - HALO) / 2, top: (HERO - HALO) / 2 },
  heroCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroNum: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.wheelNum,
    lineHeight: 60,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  heroOf: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  heroSub: {
    marginTop: 2,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.microCaption,
    textTransform: 'uppercase',
  },
  heroLabel: {
    marginTop: 16,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.title,
    color: colors.leche,
    textAlign: 'center',
  },
  avgNum: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.heroNum,
    fontVariant: ['tabular-nums'],
  },
  avgOther: { marginTop: 10 },
  otherRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(244, 236, 222, 0.04)',
  },
  otherText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  otherNum: { fontFamily: typography.uiBold, color: colors.bone },
  sparkLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  rest: { alignSelf: 'stretch', marginTop: 26, gap: 18 },
  title: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.displayMd,
    lineHeight: 32,
    letterSpacing: -0.4,
    color: colors.leche,
    textAlign: 'center',
  },
  evidence: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 17,
    color: colors.niebla,
    textAlign: 'center',
  },
  rows: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rowLabel: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  rowStrong: { color: colors.leche },
  rowValue: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  rowValueStrong: { color: colors.oroLight },
  today: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(244, 236, 222, 0.04)',
    gap: 8,
  },
  todayHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayKicker: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  todayText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.ui,
    lineHeight: 20,
    color: colors.leche,
  },
  todayTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.hairline,
    overflow: 'hidden',
  },
  todayFill: { height: 8, borderRadius: 4 },
  unknowns: {
    marginTop: 2,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    gap: 8,
  },
  unknownsFootnote: { paddingTop: 12, gap: 4 },
  unknownsTitle: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  unknown: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
  },
  unknownFootnote: {
    fontSize: typography.sizes.label,
    lineHeight: 17,
    color: colors.niebla,
  },
  close: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 236, 222, 0.08)',
  },
  closeX: { fontSize: typography.sizes.title, color: colors.leche },
  ctaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: colors.bg,
  },
  cta: {
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.leche,
  },
  ctaText: { fontFamily: typography.uiBold, fontSize: typography.sizes.ui, color: colors.bg },
})
