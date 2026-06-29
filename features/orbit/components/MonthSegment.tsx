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
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg'
import { BlurView } from 'expo-blur'
import { useIsFocused } from '@react-navigation/native'

import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry'
import { colors, typography } from '@/theme'

import { useScreenActive } from '@/features/orbit/useScreenActive'
import { useTransformProgress, useTransformProgressAsOf, withSign } from '@/features/emblem'
import { useProfile } from '@/features/profile/hooks'
import { RevealedEmblem } from '@/features/tabs/components/constellation/RevealedEmblem'
import { signName, zodiacFromDate } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { useMacroTargets } from '@/features/macros/hooks'
import { todayInTimezone } from '@/lib/time'

import { useHasAnySignals, useSignalsHistory } from '../hooks'
import {
  buildMonthBuilt,
  detectMonthPatterns,
  finalPhrase,
  habitReveal,
  type HabitReveal,
  type MonthPattern,
} from '../month-built'
import { EmptySegmentCard } from './EmptySegmentCard'
import { DiscoveryStar, PatternGlyph } from './month-glyphs'

/*
 * El segmento Mes — "¿En qué me estoy transformando?". Ver
 * docs/orbita-mes-spec.md (fuente de verdad).
 *
 * No es un dashboard: es donde la usuaria descubre en quién se está
 * convirtiendo por lo que repite. Sin IA, todo nace de contar lo registrado
 * (ver month-built.ts). El orden de la pantalla:
 *   1 · Hero — la pregunta + la constelación del signo revelándose (% revelado).
 *   2 · Así revelaste tu constelación — días por dimensión (qué la iluminó).
 *   3 · Haz visible lo invisible — descubrimientos demostrables (Ver evidencia).
 *   4 · Tus patrones — formas temporales reales (día de la semana, sueño).
 *   5 · Lo que aún no sabemos — dimensiones sin evidencia suficiente.
 *   6 · Tu evolución — barras de construcción por hábito.
 *   7 · Frase final — un cierre que la evidencia sostiene.
 */
const HERO_SIZE = Math.round(Math.min(Dimensions.get('window').width * 0.84, 360))

/** Días mínimos de evidencia para que una dimensión cuente como "revelada".
 *  Por debajo cae en "Lo que aún no sabemos" (no hay suficiente para hablar). */
const MIN_EVIDENCE_DAYS = 3

// Color por hábito para los puntos y barras de evidencia — cada uno reconocible
// por su tono de dimensión (igual que los chips de Día), no todo en oro plano.
const BAR_COLOR: Record<string, string> = {
  comida: colors.dimension.alimento,
  cuerpo: colors.dimension.cuerpo,
  sueno: colors.dimension.sueno,
  energia: colors.dimension.energia,
  ciclo: colors.dimension.ciclo,
  agua: colors.signal.agua,
  proteina: colors.signal.proteina,
}

export function MonthSegment() {
  const { data: hasAny } = useHasAnySignals()
  const { data: history } = useSignalsHistory(31)
  const signals = useMemo(() => history ?? [], [history])

  const built = useMemo(() => buildMonthBuilt(signals), [signals])
  const reveal = useMemo(() => habitReveal(signals), [signals])
  const known = useMemo(() => reveal.filter((h) => h.count >= MIN_EVIDENCE_DAYS), [reveal])
  const unknown = useMemo(() => reveal.filter((h) => h.count < MIN_EVIDENCE_DAYS), [reveal])

  const proteinTarget = useMacroTargets().data?.protein_g ?? null
  const patterns = useMemo(
    () => detectMonthPatterns(signals, { proteinTarget }),
    [signals, proteinTarget],
  )
  const discoveries = useMemo(() => patterns.filter((p) => p.kind === 'discovery'), [patterns])
  const provenPatterns = useMemo(() => patterns.filter((p) => p.kind === 'pattern'), [patterns])
  const phrase = useMemo(() => finalPhrase(signals), [signals])

  // Hero — la constelación del signo revelándose por los puntos de
  // transformación (suma de hábitos del mes), y cuánto subió este mes.
  const { data: profile } = useProfile()
  const sign = profile ? zodiacFromDate(profile.date_of_birth) : null
  const { progress, stage } = useTransformProgress()
  const firstOfMonth = `${todayInTimezone().slice(0, 8)}01`
  // Día del mes (1..31) — denominador honesto de "Tu evolución": cuántos días
  // del mes han transcurrido, no `daysAppeared` (que inflaba todo al ~100%).
  const dayOfMonth = parseInt(todayInTimezone().slice(8, 10), 10) || 30
  const { progress: prevProgress } = useTransformProgressAsOf(firstOfMonth)
  const delta = prevProgress != null ? Math.max(0, progress - prevProgress) : null

  const [evidence, setEvidence] = useState<MonthPattern | null>(null)

  if (hasAny === false) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        <HeroHeader />
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
          body="Cada registro suma evidencia y revela un poco más tu constelación. Registra desde Hoy y el mes empieza a construirse."
          hint="La constelación nunca se reinicia: lo que revelas, queda."
        />
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {/* 1 · Hero — la pregunta + la constelación revelada. */}
      <HeroHeader />
      {sign ? (
        <EmblemHero
          sign={sign}
          progress={progress}
          delta={delta}
          message={withSign(stage.message, signName(sign))}
        />
      ) : null}

      {/* 2 · Así revelaste tu constelación — días por dimensión. */}
      {known.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Así revelaste tu constelación</Text>
          <RevealList items={known} />
          <Text style={styles.revealCaption}>
            Cada categoría ilumina una parte distinta de tu constelación.
          </Text>
        </View>
      ) : null}

      {/* 3 · Haz visible lo invisible — descubrimientos demostrables. Es LA
          sección: identidad emergente (en quién te conviertes), con cuerpo y la
          evidencia siempre visible (no escondida tras un tap). */}
      {discoveries.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Haz visible lo invisible</Text>
          <Text style={styles.sectionLede}>Lo que repetiste, sin darte cuenta.</Text>
          <DiscoveryList patterns={discoveries} />
        </View>
      ) : null}

      {/* 4 · Tus patrones — formas temporales (cuándo apareces): una carta de
          ritmos, secundaria, con la evidencia rica al tocar. */}
      {provenPatterns.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Tus patrones</Text>
          <PatternList patterns={provenPatterns} onOpen={setEvidence} />
        </View>
      ) : null}

      {/* 5 · Lo que aún no sabemos — sin evidencia suficiente, sin culpa. */}
      {unknown.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Lo que aún no sabemos</Text>
          <UnknownCard items={unknown} />
        </View>
      ) : null}

      {/* 6 · Tu evolución — el "cielo sembrado": cada día registrado es un punto
          de luz acumulado (no una barra). Lo MISMO que la sección 2, pero
          sentido como construcción, no como número. */}
      {known.length > 0 && built.daysAppeared > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Tu evolución</Text>
          <EvolutionSky items={known} daysOfMonth={dayOfMonth} />
          <Text style={styles.evoCaption}>Cada punto es un día que apareciste.</Text>
        </View>
      ) : null}

      {/* 7 · Frase final — un cierre que la evidencia sostiene. */}
      {phrase ? <FinalPhrase text={phrase} /> : null}

      <EvidenceModal pattern={evidence} onClose={() => setEvidence(null)} />
    </Animated.View>
  )
}

/* ── Hero — la pregunta que abre la pantalla ─────────────────────────── */
function HeroHeader() {
  return (
    <View style={styles.heroHeader}>
      <Text style={styles.heroQuestion}>¿Qué estás construyendo?</Text>
      <Text style={styles.heroSubtitle}>
        No es una meta. Es lo que tus acciones empezaron a construir.
      </Text>
    </View>
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
          juntos competían y confundían cuál era cuál. El número héroe es el %
          revelado; esto solo dice cuánto de ese avance ocurrió este mes. */}
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

/* ── "Así revelaste tu constelación" — días por dimensión ────────────── */
function RevealList({ items }: { items: HabitReveal[] }) {
  return (
    <View style={styles.revealList}>
      {items.map((h) => {
        const dot = BAR_COLOR[h.colorKey] ?? colors.oro
        return (
          <View key={h.key} style={styles.revealRow}>
            <View style={[styles.revealDot, { backgroundColor: dot }]} />
            <Text style={styles.revealLabel} numberOfLines={1}>
              {h.label}
            </Text>
            <Text style={styles.revealCount}>
              <Text style={[styles.revealCountNum, { color: dot }]}>{h.count}</Text>
              <Text style={styles.revealCountUnit}> {h.count === 1 ? 'día' : 'días'}</Text>
            </Text>
          </View>
        )
      })}
    </View>
  )
}

/* ── "Lo que aún no sabemos" — dimensiones sin evidencia suficiente ───── */
function UnknownCard({ items }: { items: HabitReveal[] }) {
  return (
    <View style={styles.unknownCard}>
      <Text style={styles.unknownLead}>Todavía no hay suficiente información para entender:</Text>
      <View style={styles.unknownChips}>
        {items.map((h) => (
          <View key={h.key} style={styles.unknownChip}>
            <View style={styles.unknownRing} />
            <Text style={styles.unknownChipLabel}>{h.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.unknownHint}>Sigue registrando.</Text>
    </View>
  )
}

/* ── "Tu evolución" — el cielo sembrado ──────────────────────────────── */
/* Cada día registrado = un punto de luz; el último, una estrella-frontera (la
 * chispa del emblema); los días que faltan, puntos apagados (cielo por sembrar).
 * Sin números (los tiene la sección 2): aquí la MISMA data se siente como
 * construcción. Todo SVG estático. */
const EVO_ROW_H = 22
const EVO_LABEL_W = 92
const EVO_GAP = 12

function EvolutionSky({ items, daysOfMonth }: { items: HabitReveal[]; daysOfMonth: number }) {
  const [w, setW] = useState(0)
  const onLayout = (e: LayoutChangeEvent): void => {
    const next = e.nativeEvent.layout.width
    setW((p) => (Math.abs(p - next) < 1 ? p : next))
  }
  // Denominador = días del mes, pero nunca menor que el conteo más alto (para no
  // desbordar cuando la ventana rodante de 31 días excede el día del mes).
  const maxCount = Math.max(1, ...items.map((h) => h.count))
  const denom = Math.max(maxCount, daysOfMonth)
  const fieldW = Math.max(0, w - EVO_LABEL_W - EVO_GAP)
  return (
    <View style={styles.evoWrap} onLayout={onLayout}>
      {items.map((h) => (
        <View key={h.key} style={styles.evoRow}>
          <Text style={styles.evoLabel} numberOfLines={1}>
            {h.shortLabel}
          </Text>
          {fieldW > 0 ? (
            <EvolutionField
              count={h.count}
              denom={denom}
              color={BAR_COLOR[h.colorKey] ?? colors.oro}
              width={fieldW}
              fieldKey={h.key}
            />
          ) : (
            <View style={{ flex: 1 }} />
          )}
        </View>
      ))}
    </View>
  )
}

function EvolutionField({
  count,
  denom,
  color,
  width,
  fieldKey,
}: {
  count: number
  denom: number
  color: string
  width: number
  fieldKey: string
}) {
  const cy = EVO_ROW_H / 2
  const pitch = width / denom
  const gid = `evo-${fieldKey}`
  return (
    <Svg width={width} height={EVO_ROW_H} pointerEvents="none">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.32} />
          <Stop offset="0.5" stopColor={color} stopOpacity={0.1} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {Array.from({ length: denom }, (_, i) => {
        const x = pitch * (i + 0.5)
        // Jitter vertical determinista — rompe la rejilla tipo "contribution
        // graph" (que se leería como gamificación). Asimetría intencional.
        const y = cy + (((i * 37) % 7) - 3) * 0.7
        if (i < count - 1) {
          const r = 1.4 + ((i * 13) % 3) * 0.22
          return <Circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.85} />
        }
        if (i === count - 1) {
          // Frontera viva: halo + chispa de 4 púas + núcleo leche (eco del
          // emblema y de DiscoveryStar).
          return (
            <G key={i}>
              <Circle cx={x} cy={y} r={8} fill={`url(#${gid})`} />
              <Path d={fourPointStarPath(x, y, 3)} fill={color} />
              <Circle cx={x} cy={y} r={1} fill={colors.leche} opacity={0.9} />
            </G>
          )
        }
        // Cielo por sembrar — presente pero apagado, sin culpa.
        return <Circle key={i} cx={x} cy={y} r={1.2} fill={colors.bruma} opacity={0.5} />
      })}
    </Svg>
  )
}

/* ── "Frase final" — un cierre que la evidencia sostiene ─────────────── */
function FinalPhrase({ text }: { text: string }) {
  return (
    <View style={styles.finalWrap}>
      <View style={styles.finalRule} />
      <Text style={styles.finalText}>{text}</Text>
    </View>
  )
}

/* ── "Haz visible lo invisible" — descubrimientos ────────────────────── */
/** La barra que sostiene un descubrimiento, lista para mostrarse inline (la
 *  resaltada: días vs ventana). La evidencia vive a la vista, no tras un tap. */
function discoveryEvidence(
  p: MonthPattern,
): { value: number; total: number | null; color: string } | null {
  const hi = p.evidence.bars.find((b) => b.highlight) ?? p.evidence.bars[0]
  if (!hi) return null
  const color = hi.colorKey ? (BAR_COLOR[hi.colorKey] ?? colors.oro) : colors.oro
  return { value: hi.value, total: hi.total ?? null, color }
}

function DiscoveryList({ patterns }: { patterns: MonthPattern[] }) {
  // mag relativo entre los descubrimientos (días/máx): la constante más fuerte
  // del mes es la estrella más brillante. Jerarquía honesta por evidencia.
  const counts = patterns.map((p) => discoveryEvidence(p)?.value ?? 0)
  const maxCount = Math.max(1, ...counts)
  return (
    <View style={styles.discoveryList}>
      {patterns.map((p, i) => (
        <DiscoveryCard key={p.id} pattern={p} maxCount={maxCount} index={i} />
      ))}
    </View>
  )
}

function DiscoveryCard({
  pattern,
  maxCount,
  index,
}: {
  pattern: MonthPattern
  maxCount: number
  index: number
}) {
  const ev = discoveryEvidence(pattern)
  const color = ev?.color ?? colors.oro
  const mag = ev ? ev.value / maxCount : 0.5
  const pct = ev?.total ? Math.max(8, Math.round((ev.value / ev.total) * 100)) : 0
  // Entrada escalonada (solo opacidad → segura con reduced-motion): aparecen de
  // a uno, como la constelación revelándose.
  return (
    <Animated.View
      entering={FadeIn.duration(360).delay(index * 90)}
      style={[styles.discoveryCard, { borderLeftColor: color }]}
    >
      <View style={styles.discoveryHead}>
        <DiscoveryStar color={color} mag={mag} size={30} />
        <Text style={styles.discoveryKicker}>{pattern.label}</Text>
      </View>
      {/* La frase serif (voz de coach) es la protagonista: aquí nace la
          revelación. */}
      <Text style={styles.discoveryTitle}>{pattern.title}</Text>
      {ev?.total ? (
        <View style={styles.discoveryEvidence}>
          <View style={styles.discoveryTrack}>
            <View style={[styles.discoveryFill, { width: `${pct}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.discoveryStat}>
            <Text style={[styles.discoveryStatNum, { color }]}>{ev.value}</Text>
            <Text style={styles.discoveryStatRest}> de {ev.total} días</Text>
          </Text>
        </View>
      ) : null}
    </Animated.View>
  )
}

/* ── "Tus patrones" — formas temporales (lista con riel) ─────────────── */
/** Inicial del día de la semana, alineada con el orden Lun→Dom de las barras. */
const WK_INITIAL = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const

/** El color del marcador/evidencia del patrón: la dimensión si la hay (sueño),
 *  o el oro neutro (patrones de día-de-semana, que no son una sola dimensión). */
function patternColor(p: MonthPattern): string {
  const hi = p.evidence.bars.find((b) => b.highlight) ?? p.evidence.bars[0]
  return hi?.colorKey ? (BAR_COLOR[hi.colorKey] ?? colors.oro) : colors.oro
}

/** La FORMA del patrón, inline (la prueba que hace clic): un patrón es una
 *  forma temporal, no un número suelto. 7 barras → tira de semana (los días
 *  pico encendidos); si no → barra dividida (ej. noches ≥7 h). El detalle
 *  etiquetado vive en el modal al tocar la fila. */
function PatternEvidenceInline({ pattern }: { pattern: MonthPattern }) {
  const bars = pattern.evidence.bars
  if (bars.length === 7) {
    const max = Math.max(1, ...bars.map((b) => b.value))
    return (
      <View style={styles.wkStrip}>
        {bars.map((b, i) => (
          <View key={i} style={styles.wkCol}>
            <View style={styles.wkBarTrack}>
              <View
                style={[
                  styles.wkBar,
                  {
                    height: `${Math.max(10, Math.round((b.value / max) * 100))}%`,
                    backgroundColor: b.highlight ? colors.oro : colors.oroHairline,
                  },
                ]}
              />
            </View>
            <Text style={[styles.wkDay, b.highlight && styles.wkDayHi]}>{WK_INITIAL[i]}</Text>
          </View>
        ))}
      </View>
    )
  }
  // Barra dividida (proporción): la resaltada sobre el total.
  const hi = bars.find((b) => b.highlight) ?? bars[0]
  if (!hi) return null
  const color = hi.colorKey ? (BAR_COLOR[hi.colorKey] ?? colors.oro) : colors.oro
  const total = hi.total ?? bars.reduce((s, b) => s + b.value, 0)
  const pct = total ? Math.max(8, Math.round((hi.value / total) * 100)) : 0
  return (
    <View style={styles.ratioRow}>
      <View style={styles.ratioTrack}>
        <View style={[styles.ratioFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.ratioStat}>
        <Text style={[styles.ratioNum, { color }]}>{hi.value}</Text>
        <Text style={styles.ratioRest}>
          {' '}
          de {total} {pattern.evidence.unit}
        </Text>
      </Text>
    </View>
  )
}

function PatternList({
  patterns,
  onOpen,
}: {
  patterns: MonthPattern[]
  onOpen: (p: MonthPattern) => void
}) {
  return (
    <View style={styles.patternList}>
      {patterns.map((p) => {
        // Cada patrón se ancla con un anillo de ritmo; una línea vertical tenue
        // los conecta como una carta de ritmos. La FORMA va inline (la prueba a
        // la vista); la fila completa abre el detalle etiquetado.
        const markColor = patternColor(p)
        return (
          <Pressable
            key={p.id}
            style={styles.patternRow}
            onPress={() => onOpen(p)}
            accessibilityRole="button"
            accessibilityLabel={`Ver detalle: ${p.title}`}
          >
            <View style={styles.patternRail}>
              <View style={styles.railLine} />
              <View style={styles.patternNode}>
                <PatternGlyph color={markColor} size={26} />
              </View>
            </View>
            <View style={styles.patternBody}>
              <View style={styles.patternHead}>
                <Text style={styles.patternLabel}>{p.label}</Text>
                <Text style={styles.patternChevron}>›</Text>
              </View>
              <Text style={styles.patternTitle}>{p.title}</Text>
              <PatternEvidenceInline pattern={p} />
            </View>
          </Pressable>
        )
      })}
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
  // ── Hero header ───────────────────────────────────────────────
  // Mismo tratamiento que Día ("¿Quién fuiste hoy?"): título de página en
  // tipografía display (Hanken) alineado a la izquierda, y la línea secundaria
  // en Hanken medium / niebla (como la fecha de Día), no serif italic.
  heroHeader: {
    alignItems: 'flex-start',
  },
  heroQuestion: {
    fontFamily: typography.displaySemi,
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: colors.leche,
  },
  heroSubtitle: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // ── Hero constelación ─────────────────────────────────────────
  heroWrap: {
    alignItems: 'center',
    marginTop: 18,
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
  // Línea serif (voz de coach) que corona la sección protagonista: la enmarca
  // sin gritar. Se sienta justo bajo el eyebrow (que ya trae su marginBottom).
  sectionLede: {
    marginTop: -8,
    marginBottom: 18,
    marginLeft: 2,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 21,
    color: colors.bone,
  },
  // ── Así revelaste tu constelación ─────────────────────────────
  revealList: {
    gap: 2,
  },
  revealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 12,
  },
  revealDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  revealLabel: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  revealCount: {
    fontVariant: ['tabular-nums'],
  },
  revealCountNum: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
  },
  revealCountUnit: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  revealCaption: {
    marginTop: 12,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 20,
    color: colors.niebla,
    paddingHorizontal: 2,
  },
  // ── Haz visible lo invisible — descubrimientos ────────────────
  discoveryList: {
    gap: 12,
  },
  // Tarjeta con cuerpo: superficie tenue + acento de barra izquierda en el color
  // de la dimensión. La identidad merece peso, no una fila plana.
  discoveryCard: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 16,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderLeftWidth: 2,
  },
  discoveryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 8,
  },
  discoveryKicker: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  // La frase serif protagonista (voz de coach): aquí nace la revelación.
  discoveryTitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 21,
    lineHeight: 28,
    color: colors.leche,
  },
  // Evidencia SIEMPRE visible: ver la prueba ES la revelación (sin tap, sin CTA).
  discoveryEvidence: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  discoveryTrack: {
    flex: 1,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(244, 236, 222, 0.06)',
    overflow: 'hidden',
  },
  discoveryFill: {
    height: '100%',
    borderRadius: 3.5,
  },
  discoveryStat: {
    fontVariant: ['tabular-nums'],
  },
  discoveryStatNum: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
  },
  discoveryStatRest: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  // ── Tus patrones — lista con riel ─────────────────────────────
  // gap 0 + hairline vertical: el riel CONECTA los patrones (constelación de
  // ritmos), no cortes horizontales que los separan.
  patternList: {
    gap: 0,
  },
  patternRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
  },
  // Riel a la izquierda: hilo vertical + el anillo de ritmo (PatternGlyph).
  patternRail: {
    width: 26,
    alignItems: 'center',
  },
  // Hilo tenue que atraviesa el riel; con las filas pegadas (gap 0) se lee como
  // un solo trazo que une los anillos.
  railLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 13, // centro del riel de 26px
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.oroHairlineSoft,
  },
  // El anillo, alineado con la primera línea del bloque; fondo del color del
  // sky para que el hilo no lo cruce por dentro.
  patternNode: {
    marginTop: 1,
    borderRadius: 13,
    backgroundColor: colors.bg,
  },
  patternBody: {
    flex: 1,
  },
  // Cabecera: kicker (dimensión) + chevron tenue de "abre detalle".
  patternHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  // Kicker corto (la dimensión): el "título" del spec; la frase observacional
  // es la "descripción".
  patternLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  // Afordancia tenue de "toca para el detalle" (sin el oro repetido del CTA).
  patternChevron: {
    fontFamily: typography.ui,
    fontSize: 18,
    lineHeight: 18,
    color: colors.niebla,
  },
  patternTitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 18,
    lineHeight: 24,
    color: colors.leche,
  },
  // ── Forma del patrón inline ───────────────────────────────────
  // Tira de semana: 7 columnas L M M J V S D, altura ∝ días, picos en oro.
  wkStrip: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingRight: 8,
  },
  wkCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  wkBarTrack: {
    width: 6,
    height: 30,
    justifyContent: 'flex-end',
  },
  wkBar: {
    width: 6,
    borderRadius: 3,
  },
  wkDay: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  wkDayHi: {
    fontFamily: typography.uiBold,
    color: colors.oroSoft,
  },
  // Barra dividida: la proporción resaltada sobre el total (ej. noches ≥ 7 h).
  ratioRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ratioTrack: {
    flex: 1,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(244, 236, 222, 0.06)',
    overflow: 'hidden',
  },
  ratioFill: {
    height: '100%',
    borderRadius: 3.5,
  },
  ratioStat: {
    fontVariant: ['tabular-nums'],
  },
  ratioNum: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
  },
  ratioRest: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  // ── Lo que aún no sabemos ─────────────────────────────────────
  unknownCard: {
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 18,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  unknownLead: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
  },
  unknownChips: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  unknownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  // Anillo vacío (○) — el espacio aún sin llenar, sin culpa.
  unknownRing: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.4,
    borderColor: colors.niebla,
  },
  unknownChipLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  unknownHint: {
    marginTop: 16,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 21,
    color: colors.bone,
  },
  // ── Tu evolución — el cielo sembrado ──────────────────────────
  evoWrap: {
    gap: 6,
  },
  evoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // Etiqueta más callada que en la sección 2 (niebla, no bone): aquí el campo de
  // luz es el protagonista, no el texto.
  evoLabel: {
    width: 92,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  evoCaption: {
    marginTop: 14,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 20,
    color: colors.niebla,
    paddingHorizontal: 2,
  },
  // ── Frase final ───────────────────────────────────────────────
  finalWrap: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  finalRule: {
    width: 36,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.oroHairline,
    marginBottom: 18,
  },
  finalText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 20,
    lineHeight: 28,
    color: colors.bone,
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
  // El denominador va atenuado para que el número grande pese.
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
