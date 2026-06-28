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
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg'
import { BlurView } from 'expo-blur'
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
            {patterns.map((p) => {
              // El dato clave AL FRENTE (la prueba que reconquista a una
              // escéptica), sin obligar a abrir el modal. Cada patrón se ancla
              // con un punto del color de SU dimensión; una línea vertical tenue
              // los conecta como una constelación de hallazgos (no filas sueltas).
              const stat = patternStat(p)
              const dotColor = stat?.color ?? colors.oro
              return (
                <Pressable
                  key={p.id}
                  style={styles.patternRow}
                  onPress={() => setEvidence(p)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver evidencia: ${p.title}`}
                >
                  <View style={styles.patternRail}>
                    <View style={styles.railLine} />
                    <View style={[styles.railDot, { backgroundColor: dotColor }]} />
                  </View>
                  <View style={styles.patternBody}>
                    <Text style={styles.patternTitle}>{p.title}</Text>
                    {stat ? (
                      <Text style={styles.patternStat}>
                        <Text style={[styles.patternStatNum, { color: stat.color }]}>
                          {stat.value}
                        </Text>
                        <Text style={styles.patternStatUnit}> {stat.unit}</Text>
                      </Text>
                    ) : null}
                    <Text style={styles.patternCta}>Ver evidencia →</Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>
      ) : null}

      {/* 4 · Tu mayor victoria — la consistencia, celebrada. */}
      {win ? (
        <View style={[styles.section, styles.victorySection]}>
          <Text style={[styles.eyebrow, styles.eyebrowWin]}>Tu mayor victoria</Text>
          <View style={styles.victoryCard}>
            {/* Estrellas-satélite dentro de la tarjeta: la frase vive en su
                propio cielo pequeño (no un campo, solo 2-3 puntos). */}
            <View style={[styles.victorySat, styles.victorySatA]} />
            <View style={[styles.victorySat, styles.victorySatB]} />
            <View style={[styles.victorySat, styles.victorySatC]} />
            <VictoryStar />
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
/** El dato clave de un patrón, inline (sin abrir el modal): el conteo de días +
 *  el color de su dimensión. El "/ N" vive SOLO en el modal (donde la barra le
 *  da contexto): inline siempre es "N días", así los patrones con ventana fija
 *  y los de conteo de presencia se leen IGUAL (antes "19 / 32 días" vs "24
 *  días" parecía un bug). */
function patternStat(p: MonthPattern): { value: number; unit: string; color: string } | null {
  const hi = p.evidence.bars.find((b) => b.highlight) ?? p.evidence.bars[0]
  if (!hi) return null
  const color = hi.colorKey ? (BAR_COLOR[hi.colorKey] ?? colors.oro) : colors.oro
  return { value: hi.value, unit: p.evidence.unit, color }
}

/** La chispa de "Tu mayor victoria": una estrella de 4 púas desiguales con un
 *  bloom dorado radial — eco del emblema del hero (la victoria es la chispa de
 *  la misma constelación que corona la vista). SVG estático, sin pulso. */
function VictoryStar() {
  return (
    <Svg width={52} height={52} viewBox="0 0 48 48" style={styles.victoryStar}>
      <Defs>
        <RadialGradient id="victory-bloom" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.oroLight} stopOpacity={0.5} />
          <Stop offset="0.55" stopColor={colors.oro} stopOpacity={0.16} />
          <Stop offset="1" stopColor={colors.oro} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={24} cy={24} r={24} fill="url(#victory-bloom)" />
      <Path
        d="M24 12 C24.6 21 27 23.4 36 24 C27 24.6 24.6 27 24 36 C23.4 27 21 24.6 12 24 C21 23.4 23.4 21 24 12 Z"
        fill={colors.oroLight}
      />
    </Svg>
  )
}

function BuiltGrid({ built }: { built: ReturnType<typeof buildMonthBuilt> }) {
  // 4 stats curadas en 2×2 (las que más importan: proteína cuidada + entrenos +
  // comida + días presentes). Agua y sueño bajan a una línea de resumen, así el
  // grid queda parejo (antes 5 cards dejaban un hueco) y respira más.
  const cards: { value: string; unit?: string; label: string }[] = [
    { value: String(built.trainedDays), label: 'Entrenamientos' },
    { value: String(built.foodDays), label: 'Días con comida' },
    {
      value: built.proteinAvgG != null ? String(built.proteinAvgG) : '·',
      unit: built.proteinAvgG != null ? 'g' : undefined,
      label: 'Proteína prom.',
    },
    { value: String(built.daysAppeared), label: 'Días presentes' },
  ]
  const summary: string[] = [
    `${built.waterGoalDays} ${built.waterGoalDays === 1 ? 'día' : 'días'} de agua`,
  ]
  if (built.sleepAvgH != null) summary.push(`${built.sleepAvgH.toFixed(1)} h de sueño en promedio`)
  return (
    <View style={styles.builtWrap}>
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
      <Text style={styles.builtSummary}>{summary.join(' · ')}</Text>
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
  // Las señales SIN registro (0) no se dibujan como barra vacía (se leería como
  // hueco/falla): bajan a una nota al pie. La evidencia muestra lo que SÍ pasó.
  const shown = ev ? ev.bars.filter((b) => b.value > 0) : []
  const zeros = ev ? ev.bars.filter((b) => b.value === 0) : []
  const max = Math.max(1, ...shown.map((b) => b.value))
  const titleColor = ev
    ? (() => {
        const hi = ev.bars.find((b) => b.highlight) ?? ev.bars[0]
        return hi?.colorKey ? (BAR_COLOR[hi.colorKey] ?? colors.oro) : colors.oro
      })()
    : colors.oro
  return (
    <Modal visible={pattern != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        {/* Fondo difuminado: la pantalla detrás se va a desenfoque, el modal
            flota. El scrim cálido encima da separación y es el respaldo si en
            algún Android el BlurView no rinde. Ambos pointerEvents none → el tap
            afuera sigue cerrando vía el Pressable contenedor. */}
        <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={[StyleSheet.absoluteFill, styles.modalScrim]} pointerEvents="none" />
        <Pressable style={styles.modalCard} onPress={() => {}}>
          {pattern && ev ? (
            <>
              <Text style={styles.modalEyebrow}>La evidencia</Text>
              <View style={styles.modalTitleRow}>
                <View style={[styles.modalTitleDot, { backgroundColor: titleColor }]} />
                <Text style={styles.modalTitle}>{pattern.title}</Text>
              </View>
              <View style={styles.bars}>
                {shown.map((b, i) => {
                  const barColor = b.colorKey ? (BAR_COLOR[b.colorKey] ?? colors.oro) : colors.oro
                  return (
                    <View key={`${b.label}-${i}`} style={styles.barRow}>
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
                              opacity: b.highlight ? 1 : 0.32,
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
              {zeros.length > 0 ? (
                <Text style={styles.modalZeroNote}>
                  {zeros.map((z) => z.label).join(' · ')}: aún sin registro este mes.
                </Text>
              ) : null}
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
  builtWrap: {
    gap: 12,
  },
  builtGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  builtCard: {
    // 2×2: dos por fila (antes 3 dejaban hueco en la última fila con 5 cards).
    width: '48%',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
  },
  builtValue: {
    fontFamily: typography.uiBold,
    fontSize: 28,
    color: colors.leche,
  },
  builtUnit: {
    fontFamily: typography.uiMedium,
    fontSize: 15,
    color: colors.niebla,
  },
  builtLabel: {
    marginTop: 6,
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  // Línea de resumen bajo el grid — agua + sueño, sin tarjeta propia.
  builtSummary: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    textAlign: 'center',
  },
  // ── Lo que descubrimos ────────────────────────────────────────
  // gap 0 + sin hairline: la línea vertical del riel (railLine) es la que
  // CONECTA los patrones (constelación), no cortes horizontales que los separan.
  patternList: {
    gap: 0,
  },
  patternRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
  },
  // Riel de constelación a la izquierda: punto de la dimensión + línea vertical.
  patternRail: {
    width: 12,
    alignItems: 'center',
  },
  // Línea continua que atraviesa el riel; al estar las filas pegadas (gap 0) se
  // lee como un solo hilo que une los puntos.
  railLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.oroHairlineSoft,
  },
  // El punto del color de la dimensión, alineado con la primera línea del título.
  railDot: {
    marginTop: 7,
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  patternBody: {
    flex: 1,
  },
  patternTitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 18,
    lineHeight: 24,
    color: colors.leche,
  },
  // El dato clave inline (la prueba): el número en el color de su dimensión (el
  // único toque de color del bloque), la unidad en niebla. El CTA queda como el
  // único oro de la fila.
  patternStat: {
    marginTop: 6,
  },
  patternStatNum: {
    fontFamily: typography.uiBold,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  patternStatUnit: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  patternCta: {
    marginTop: 7,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
    color: colors.oro,
  },
  // ── Tu mayor victoria ─────────────────────────────────────────
  // Más aire arriba: el premio llega como un beat aparte, no como el siguiente
  // ítem de la lista.
  victorySection: {
    marginTop: 38,
  },
  victoryCard: {
    borderRadius: 22,
    paddingVertical: 30,
    paddingHorizontal: 22,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: colors.oroTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
  },
  victoryStar: {
    marginBottom: 8,
  },
  // Estrellas-satélite (contención total: 3 puntos, fuera del eje del texto).
  victorySat: {
    position: 'absolute',
    borderRadius: 2,
    backgroundColor: colors.oroSoft,
  },
  victorySatA: {
    top: 22,
    left: 30,
    width: 3,
    height: 3,
    opacity: 0.7,
  },
  victorySatB: {
    top: 40,
    right: 36,
    width: 4,
    height: 4,
    opacity: 0.5,
  },
  victorySatC: {
    bottom: 26,
    left: 48,
    width: 2.5,
    height: 2.5,
    opacity: 0.6,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  // Velo cálido sobre el blur (no negro plano): mantiene la temperatura de
  // Stelar y oscurece lo justo para que el modal flote.
  modalScrim: {
    backgroundColor: 'rgba(10, 6, 8, 0.55)',
  },
  modalCard: {
    width: '100%',
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 24,
    backgroundColor: colors.bgCard2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
    // Elevación suave para que el modal se despegue del blur (iOS; en Android
    // el blur + scrim ya dan separación).
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  modalEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  // La misma estrella de la dimensión que viste en la lista te recibe en el
  // modal (continuidad de identidad por color).
  modalTitleRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  modalTitleDot: {
    marginTop: 9,
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  modalTitle: {
    flex: 1,
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
    color: colors.bone,
  },
  // Nota al pie de las señales sin registro — neutra, sin culpa.
  modalZeroNote: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 18,
    color: colors.niebla,
  },
  modalCloseBtn: {
    marginTop: 20,
    alignSelf: 'center',
    paddingVertical: 13,
    paddingHorizontal: 28,
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
