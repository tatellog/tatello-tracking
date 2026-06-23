import { useEffect, useMemo, useState } from 'react'
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import { useIsFocused } from '@react-navigation/native'

import { colors, typography } from '@/theme'

import { useScreenActive } from '@/features/orbit/useScreenActive'
import { useTransformProgress, useTransformProgressAsOf, withSign } from '@/features/emblem'
import { useProfile } from '@/features/profile/hooks'
import { RevealedEmblem } from '@/features/tabs/components/constellation/RevealedEmblem'
import { signName, zodiacFromDate } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { useMacroTargets } from '@/features/macros/hooks'
import { GLASS_ML, useWaterGoal } from '@/features/water/useWaterGoal'
import { todayInTimezone } from '@/lib/time'

import { useHasAnySignals, useSignalsHistory } from '../hooks'
import { biggestWin, buildMonthBuilt, detectMonthPatterns, type MonthPattern } from '../month-built'
import { EmptySegmentCard } from './EmptySegmentCard'

/*
 * El segmento Mes — "El Cielo": ¿qué estoy construyendo con lo que repito?
 *
 * La vista más transformacional de Órbita. Conecta hábitos con transformación:
 *   1 · Hero — la CONSTELACIÓN zodiacal revelándose por la consistencia
 *       acumulada (% revelado + cuánto subió este mes). El resultado visible.
 *   2 · "Esto construiste" — conteos acumulados (la prueba tangible).
 *   3 · "Lo que descubrimos" — patrones REALES con "Ver evidencia" (las barras
 *       que los sostienen). Sin IA, sin inventar: todo nace de contar lo
 *       registrado (ver month-built.ts).
 *   4 · "Tu mayor victoria" — la consistencia, celebrada.
 */
const HERO_SIZE = Math.round(Math.min(Dimensions.get('window').width * 0.84, 360))

// Color por hábito para las barras de evidencia — cada uno reconocible por su
// tono de dimensión (igual que los chips de Día), no todo en oro plano.
const BAR_COLOR: Record<string, string> = {
  comida: colors.dimension.alimento,
  cuerpo: colors.dimension.cuerpo,
  sueno: colors.dimension.sueno,
  energia: colors.dimension.energia,
  agua: colors.signal.agua,
  proteina: colors.signal.proteina,
}

export function MonthSegment() {
  const { data: hasAny } = useHasAnySignals()
  const { data: history } = useSignalsHistory(31)
  const signals = useMemo(() => history ?? [], [history])

  const { goalMl } = useWaterGoal()
  const waterGoalGlasses = Math.max(1, Math.round(goalMl / GLASS_ML))
  const built = useMemo(
    () => buildMonthBuilt(signals, { waterGoalGlasses }),
    [signals, waterGoalGlasses],
  )
  const proteinTarget = useMacroTargets().data?.protein_g ?? null
  const patterns = useMemo(
    () => detectMonthPatterns(signals, { proteinTarget }),
    [signals, proteinTarget],
  )
  const win = useMemo(() => biggestWin(signals), [signals])

  // Hero — la constelación del signo revelándose por los puntos de
  // transformación (suma de hábitos del mes), y cuánto subió este mes.
  const { data: profile } = useProfile()
  const sign = profile ? zodiacFromDate(profile.date_of_birth) : null
  const { progress, stage } = useTransformProgress()
  const firstOfMonth = `${todayInTimezone().slice(0, 8)}01`
  const { progress: prevProgress } = useTransformProgressAsOf(firstOfMonth)
  const delta = prevProgress != null ? Math.max(0, progress - prevProgress) : null

  const [evidence, setEvidence] = useState<MonthPattern | null>(null)

  if (hasAny === false) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        {sign ? (
          <EmblemHero
            sign={sign}
            progress={0}
            delta={null}
            message="Tu constelación apenas empieza a formarse."
          />
        ) : null}
        <EmptySegmentCard
          eyebrow="Tu constelación se forma día a día"
          body="Cada registro suma puntos y revela un poco más tu constelación. Registra desde Hoy y el mes empieza a construirse."
          hint="La constelación nunca se reinicia: lo que revelas, queda."
        />
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {/* 1 · Hero — la constelación revelada (resultado visible de la consistencia). */}
      {sign ? (
        <EmblemHero
          sign={sign}
          progress={progress}
          delta={delta}
          message={withSign(stage.message, signName(sign))}
        />
      ) : null}

      {/* 2 · Esto construiste — la prueba tangible, en conteos acumulados. */}
      {built.daysAppeared > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Esto construiste</Text>
          <BuiltGrid built={built} />
        </View>
      ) : null}

      {/* 3 · Lo que descubrimos — patrones reales, cada uno con su evidencia. */}
      {patterns.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Lo que descubrimos</Text>
          <View style={styles.patternList}>
            {patterns.map((p) => (
              <View key={p.id} style={styles.patternRow}>
                <Text style={styles.patternTitle}>{p.title}</Text>
                <Pressable
                  onPress={() => setEvidence(p)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver evidencia: ${p.title}`}
                >
                  <Text style={styles.patternCta}>Ver evidencia →</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* 4 · Tu mayor victoria — la consistencia, celebrada. */}
      {win ? (
        <View style={styles.section}>
          <Text style={[styles.eyebrow, styles.eyebrowWin]}>Tu mayor victoria</Text>
          <View style={styles.victoryCard}>
            <Text style={styles.victoryStar}>✦</Text>
            <Text style={styles.victoryHeadline}>{win.headline}</Text>
            <Text style={styles.victoryLine}>{win.line}</Text>
          </View>
        </View>
      ) : null}

      <EvidenceModal pattern={evidence} onClose={() => setEvidence(null)} />
    </Animated.View>
  )
}

/* Avance del mes en palabras (sin un segundo %): qué proporción del total
 * revelado ocurrió este mes. Mata el choque "75% vs +64%". */
function deltaPhrase(delta: number, progress: number): string {
  const ratio = progress > 0 ? delta / progress : 0
  if (ratio >= 0.6) return 'La mayor parte la revelaste este mes.'
  if (ratio >= 0.3) return 'Buena parte la revelaste este mes.'
  // "Algo se reveló" conserva el ancla de "revelar" (la constelación); un
  // genérico "Avanzaste" lo perdía (voice-and-copy).
  return 'Algo se reveló este mes.'
}

/* ── Hero — la constelación del signo revelándose ────────────────────── */
function EmblemHero({
  sign,
  progress,
  delta,
  message,
}: {
  sign: ZodiacSign
  progress: number
  delta: number | null
  message: string
}) {
  const [w, setW] = useState(0)
  const onLayout = (e: LayoutChangeEvent): void => {
    const next = e.nativeEvent.layout.width
    setW((p) => (Math.abs(p - next) < 1 ? p : next))
  }
  // Respiración del halo — un loop, gateado en foco (pausa fuera de tab/scroll)
  // + reduced-motion. Opacidad + escala en compositor; no repinta Skia ni SVG.
  const active = useScreenActive()
  const focused = useIsFocused()
  const reduce = useReducedMotion() ?? false
  const breath = useSharedValue(0)
  useEffect(() => {
    if (!active || reduce) {
      cancelAnimation(breath)
      breath.value = withTiming(0, { duration: 400 })
      return
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [active, reduce, breath])
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.28 + breath.value * 0.55,
    transform: [{ scale: 0.88 + breath.value * 0.22 }],
  }))
  return (
    <View style={styles.heroWrap}>
      <View style={styles.heroStage} onLayout={onLayout}>
        {/* Disco de vacío cálido — recorta el wash magenta justo detrás de la
            figura para que el oro del emblema no se enturbie (capa de fondo). */}
        <VoidDisc size={w || HERO_SIZE} />
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.heroGlow, glowStyle]}
          pointerEvents="none"
        >
          <EmblemGlow size={w || HERO_SIZE} />
        </Animated.View>
        <StaticField size={w || HERO_SIZE} />
        {/* En Mes el emblema NO recede (no hay constelación natal encima): es el
            protagonista, así que sube su opacidad para coronar (default = receso
            de Tab Hoy). */}
        {w > 0 && focused ? (
          <RevealedEmblem
            sign={sign}
            transformProgress={progress}
            size={w}
            masterOpacity={0.95}
            frameOpacity={0.6}
            glyphOpacity={0.78}
            bloomMaxOpacity={0.72}
          />
        ) : null}
      </View>

      {/* El signo — el nombre de lo que se está revelando. */}
      <Text style={styles.heroSign}>{signName(sign)}</Text>
      {/* % revelado — el reveal del arte ES la barra; el número acompaña. */}
      <Text style={styles.heroPct}>
        {progress}
        <Text style={styles.heroPctSign}>% revelado</Text>
      </Text>
      {/* Avance del mes en CUALITATIVO, sin un segundo "%": dos porcentajes
          juntos (75% total vs +64% del mes) competían y confundían cuál era
          cuál. El número héroe es el % revelado; esto solo dice cuánto de ese
          avance ocurrió este mes. */}
      {delta != null && delta > 0 ? (
        <Text style={styles.heroDelta}>{deltaPhrase(delta, progress)}</Text>
      ) : null}
      <Text style={styles.heroMessage}>{message}</Text>
    </View>
  )
}

/* Polvo estelar tenue detrás del emblema — estático, cero costo. */
const FIELD = [
  [0.14, 0.18, 1.4, 0.16],
  [0.82, 0.12, 1, 0.18],
  [0.68, 0.3, 0.8, 0.1],
  [0.3, 0.78, 1, 0.12],
  [0.88, 0.62, 0.7, 0.1],
  [0.1, 0.55, 0.8, 0.12],
  [0.5, 0.08, 0.7, 0.1],
  [0.92, 0.85, 0.9, 0.1],
] as const
function StaticField({ size }: { size: number }) {
  if (size <= 0) return null
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      {FIELD.map(([fx, fy, r, o], i) => (
        <Circle key={i} cx={fx * size} cy={fy * size} r={r} fill={colors.leche} opacity={o} />
      ))}
    </Svg>
  )
}

function EmblemGlow({ size }: { size: number }) {
  if (size <= 0) return null
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="emblem-breath" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.oroLight} stopOpacity={0.5} />
          <Stop offset="55%" stopColor={colors.oro} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={colors.oro} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#emblem-breath)" />
    </Svg>
  )
}

/* Disco de vacío — un radial del fondo (#0A0608) que oscurece el wash magenta
 * detrás de la figura, devolviéndole pureza al oro del emblema (iluminación
 * selectiva: una pieza brilla, el resto descansa). Capa de fondo, estática. */
function VoidDisc({ size }: { size: number }) {
  if (size <= 0) return null
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="emblem-void" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.bg} stopOpacity={0.6} />
          <Stop offset="62%" stopColor={colors.bg} stopOpacity={0.32} />
          <Stop offset="100%" stopColor={colors.bg} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#emblem-void)" />
    </Svg>
  )
}

/* ── "Esto construiste" — conteos acumulados ─────────────────────────── */
function BuiltGrid({ built }: { built: ReturnType<typeof buildMonthBuilt> }) {
  const cards: { value: string; unit?: string; label: string }[] = [
    { value: String(built.trainedDays), label: 'Entrenamientos' },
    { value: String(built.foodDays), label: 'Días con comida' },
    {
      value: built.proteinAvgG != null ? String(built.proteinAvgG) : '·',
      unit: built.proteinAvgG != null ? 'g' : undefined,
      label: 'Proteína prom.',
    },
    { value: String(built.waterGoalDays), label: 'Días de agua' },
    {
      value: built.sleepAvgH != null ? built.sleepAvgH.toFixed(1) : '·',
      unit: built.sleepAvgH != null ? 'h' : undefined,
      label: 'Sueño prom.',
    },
  ]
  return (
    <View style={styles.builtGrid}>
      {cards.map((c) => (
        <View key={c.label} style={styles.builtCard}>
          <Text style={styles.builtValue}>
            {c.value}
            {c.unit ? <Text style={styles.builtUnit}> {c.unit}</Text> : null}
          </Text>
          <Text style={styles.builtLabel}>{c.label}</Text>
        </View>
      ))}
    </View>
  )
}

/* ── "Ver evidencia" — las barras que sostienen un patrón ────────────── */
function EvidenceModal({
  pattern,
  onClose,
}: {
  pattern: MonthPattern | null
  onClose: () => void
}) {
  const ev = pattern?.evidence
  const max = ev ? Math.max(1, ...ev.bars.map((b) => b.value)) : 1
  return (
    <Modal visible={pattern != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          {pattern && ev ? (
            <>
              <Text style={styles.modalEyebrow}>La evidencia</Text>
              <Text style={styles.modalTitle}>{pattern.title}</Text>
              <View style={styles.bars}>
                {ev.bars.map((b, i) => {
                  const barColor = b.colorKey ? (BAR_COLOR[b.colorKey] ?? colors.oro) : colors.oro
                  // Una señal sin registro (0) atenúa toda la fila para que
                  // receda en vez de leerse como un hueco/falla.
                  const zero = b.value === 0
                  return (
                    <View
                      key={`${b.label}-${i}`}
                      style={[styles.barRow, zero && styles.barRowZero]}
                    >
                      <Text style={styles.barLabel} numberOfLines={1}>
                        {b.label}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${Math.round((b.value / max) * 100)}%`,
                              backgroundColor: barColor,
                              opacity: b.highlight ? 1 : 0.4,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.barValue, b.highlight ? styles.barValueHi : null]}>
                        {/* Denominador para anclar el número ("18 / 32"). */}
                        {b.value}
                        {b.total != null ? (
                          <Text style={styles.barValueTotal}> / {b.total}</Text>
                        ) : null}
                      </Text>
                    </View>
                  )
                })}
              </View>
              <Text style={styles.modalCaption}>{ev.caption}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalClose}>Cerrar</Text>
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
  },
  // ── Hero ──────────────────────────────────────────────────────
  heroWrap: {
    alignItems: 'center',
    marginTop: 14,
  },
  heroStage: {
    width: '72%',
    maxWidth: HERO_SIZE,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGlow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSign: {
    marginTop: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 34,
    lineHeight: 40,
    color: colors.leche,
    textAlign: 'center',
  },
  heroPct: {
    marginTop: 6,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    fontVariant: ['tabular-nums'],
  },
  heroPctSign: {
    fontFamily: typography.uiBold,
    color: colors.oroSoft,
  },
  heroDelta: {
    marginTop: 6,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.4,
    color: colors.magentaHot,
  },
  heroMessage: {
    marginTop: 12,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 23,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  // ── Secciones ─────────────────────────────────────────────────
  section: {
    marginTop: 30,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 14,
    marginLeft: 2,
  },
  // El eyebrow de la victoria va en oro: marca que esta sección es el premio,
  // no un dato más.
  eyebrowWin: {
    color: colors.oroSoft,
  },
  // ── Esto construiste ──────────────────────────────────────────
  builtGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  builtCard: {
    width: '31.5%',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
  },
  builtValue: {
    fontFamily: typography.uiBold,
    fontSize: 26,
    color: colors.leche,
  },
  builtUnit: {
    fontFamily: typography.uiMedium,
    fontSize: 14,
    color: colors.niebla,
  },
  builtLabel: {
    marginTop: 6,
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  // ── Lo que descubrimos ────────────────────────────────────────
  patternList: {
    gap: 2,
  },
  patternRow: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  patternTitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 18,
    lineHeight: 24,
    color: colors.leche,
  },
  patternCta: {
    marginTop: 7,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
    color: colors.oro,
  },
  // ── Tu mayor victoria ─────────────────────────────────────────
  victoryCard: {
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    backgroundColor: colors.oroTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
  },
  victoryStar: {
    fontSize: 26,
    color: colors.oro,
    marginBottom: 12,
  },
  victoryHeadline: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 24,
    lineHeight: 30,
    color: colors.leche,
    textAlign: 'center',
  },
  victoryLine: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.oroSoft,
    textAlign: 'center',
  },
  // ── Modal de evidencia ────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    width: '100%',
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 22,
    backgroundColor: colors.bgCard2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  modalEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  modalTitle: {
    marginTop: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 21,
    lineHeight: 27,
    color: colors.leche,
  },
  bars: {
    marginTop: 18,
    gap: 10,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barLabel: {
    width: 74,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(244, 236, 222, 0.06)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.oroHairline,
  },
  barRowZero: {
    opacity: 0.45,
  },
  barValue: {
    width: 52,
    textAlign: 'right',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  barValueHi: {
    fontFamily: typography.uiBold,
    color: colors.leche,
  },
  // El denominador va atenuado para que el número grande (días presentes) pese.
  barValueTotal: {
    fontFamily: typography.ui,
    color: colors.niebla,
  },
  modalCaption: {
    marginTop: 16,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 18,
    color: colors.niebla,
  },
  modalCloseBtn: {
    marginTop: 20,
    alignSelf: 'center',
    paddingVertical: 9,
    paddingHorizontal: 26,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  modalClose: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    color: colors.bone,
  },
})
