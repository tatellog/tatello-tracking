import { useEffect, useMemo, useState } from 'react'
import { Dimensions, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
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

import { useCycleEnabled } from '@/features/cycle/useCycleEnabled'
import { useScreenActive } from '@/features/orbit/useScreenActive'
import { useTransformProgress } from '@/features/emblem'
import { useMacroTargets } from '@/features/macros/hooks'
import { useProfile } from '@/features/profile/hooks'
import { RevealedEmblem } from '@/features/tabs/components/constellation/RevealedEmblem'
import { zodiacFromDate } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { GLASS_ML, mlToLitresLabel } from '@/features/water/useWaterGoal'

import { useHasAnySignals, useSignalsHistory } from '../hooks'
import { useDailyIntelligence } from '../useDailyIntelligence'
import { buildEnLuzMes, buildMonthEvidence, buildVozMes, monthDaysLogged } from '../month-logic'
import { enLuzSentence } from '../week-logic'
import { EmptySegmentCard } from './EmptySegmentCard'
import { LiveDot } from './LiveDot'
import { PatternCard } from './PatternCard'
import { StelarVoice } from './StelarVoice'

/*
 * The Mes segment — "El Cielo" (PRD V1: ¿qué estoy construyendo?).
 *
 * El HERO es el EMBLEMA revelándose por la consistencia acumulada — la
 * respuesta literal a "¿qué construyo?". Debajo: lo más consistente del
 * mes, la evidencia acumulada (conteos contables), y la Voz de evidencia.
 *
 * Reglas del PRD: NO IA, NO correlaciones, NO causas, NO tendencias.
 * Solo acumulación y consistencia. (El cosmos MonthSky y los patrones de
 * correlación/comparación se retiraron — pertenecen a Órbita IA futura.)
 */
const HERO_SIZE = Math.round(Math.min(Dimensions.get('window').width * 0.72, 320))

export function MonthSegment() {
  const { data: hasAny } = useHasAnySignals()
  const { data: history } = useSignalsHistory(30)
  const macros = useMacroTargets()
  // Gate de ciclo: sin ciclo activo, el ciclo no entra a la evidencia.
  const cycleEnabled = useCycleEnabled()
  const dimCtx = useMemo(
    () => ({
      calorieTarget: macros.data?.calories ?? null,
      proteinTarget: macros.data?.protein_g ?? null,
      cycleEnabled,
    }),
    [macros.data?.calories, macros.data?.protein_g, cycleEnabled],
  )

  const signals = useMemo(() => history ?? [], [history])
  const daysLogged = monthDaysLogged(signals)
  const hasRealData = daysLogged > 0
  const voz = useMemo(() => buildVozMes(signals, dimCtx, daysLogged), [signals, dimCtx, daysLogged])
  const enLuz = useMemo(() => buildEnLuzMes(signals, dimCtx), [signals, dimCtx])
  const evidence = useMemo(() => buildMonthEvidence(signals), [signals])

  // Solo recurrencias PURAS: el PRD del Mes prohíbe correlaciones y
  // comparaciones ("los lunes es cuando más te mueves") — eso es Órbita IA.
  const intel = useDailyIntelligence()
  const monthPatterns = (intel.data?.month.patterns ?? []).filter(
    (p) => p.category === 'recurrencia',
  )

  // El emblema (hero) — el león/figura del signo revelándose con los puntos
  // de transformación (suma de hábitos del mes). Los 12 signos tienen arte.
  const { data: profile } = useProfile()
  const { progress, stage } = useTransformProgress()
  const sign = profile ? zodiacFromDate(profile.date_of_birth) : null

  if (hasAny === false) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        {sign ? (
          <EmblemHero sign={sign} progress={0} message="Tu emblema apenas empieza a formarse." />
        ) : null}
        <EmptySegmentCard
          eyebrow="El emblema se forma día a día"
          body="Cada registro suma puntos y revela un poco más tu emblema. Registra desde Hoy y el mes empieza a construirse."
          hint="El emblema nunca se reinicia: lo que revelas, queda."
        />
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {/* Header mínimo — solo el crédito honesto (sin tema poético). */}
      {hasRealData ? (
        <View style={styles.header}>
          <View style={styles.metaRow}>
            <LiveDot />
            <Text style={styles.meta}>
              <Text style={styles.metaNum}>{daysLogged}</Text>
              <Text> días con señales · leído por </Text>
              <Text style={styles.metaStelar}>Stelar</Text>
            </Text>
          </View>
        </View>
      ) : null}

      {/* 1 · Tu Transformación — el emblema revelándose es la respuesta a
          "¿qué estoy construyendo?". Hero del Mes. */}
      {sign ? <EmblemHero sign={sign} progress={progress} message={stage.message} /> : null}

      {/* 2 · Lo que más se repitió — el comportamiento más consistente del
          mes (≥8 días). Solo si hay constancia real. */}
      {enLuz ? (
        <View style={styles.enLuz}>
          <Text style={styles.enLuzEyebrow}>Lo que más se repitió</Text>
          <View style={styles.enLuzRow}>
            <View style={[styles.enLuzDot, { backgroundColor: colors.dimension[enLuz.key] }]} />
            <Text style={[styles.enLuzLabel, { color: colors.dimension[enLuz.key] }]}>
              {enLuz.label}
            </Text>
          </View>
          <Text style={styles.enLuzCount}>{enLuzSentence(enLuz, 'mes')}</Text>
        </View>
      ) : null}

      {/* 3 · Esto construiste — evidencia ACUMULADA (conteos contables, no
          % de brillo): la prueba tangible de "lo construí yo". */}
      {hasRealData ? (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Esto construiste</Text>
          <View style={styles.evGrid}>
            <EvTile value={String(evidence.entrenos)} label="Entrenamientos" />
            <EvTile value={String(evidence.comidas)} label="Comidas" />
            <EvTile
              value={evidence.sleepAvgMin != null ? (evidence.sleepAvgMin / 60).toFixed(1) : '—'}
              unit={evidence.sleepAvgMin != null ? 'h prom.' : undefined}
              label="Sueño"
              empty={evidence.sleepAvgMin == null}
            />
            <EvTile
              value={
                evidence.waterAvg != null ? mlToLitresLabel(evidence.waterAvg * GLASS_ML) : '—'
              }
              unit={evidence.waterAvg != null ? 'L prom.' : undefined}
              label="Agua"
              empty={evidence.waterAvg == null}
            />
          </View>
        </View>
      ) : null}

      {/* 4 · Voz de Stelar — narrativa de EVIDENCIA (consistencia en días),
          sin tendencias ni causas. */}
      <StelarVoice
        parts={voz.parts}
        tag="Este mes"
        signature={hasRealData ? voz.signature : undefined}
      />

      {/* Tus patrones del mes — SOLO recurrencias puras (repetición), nunca
          correlaciones ni comparaciones (esas son de Órbita IA). */}
      {monthPatterns.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Tus patrones del mes</Text>
          {monthPatterns.map((p) => (
            <PatternCard key={p.id} patron={p} />
          ))}
        </View>
      ) : null}
    </Animated.View>
  )
}

/* ── El emblema hero — figura del signo revelándose + % sereno ───────── */
function EmblemHero({
  sign,
  progress,
  message,
}: {
  sign: ZodiacSign
  progress: number
  message: string
}) {
  const [w, setW] = useState(0)
  const onLayout = (e: LayoutChangeEvent): void => {
    const next = e.nativeEvent.layout.width
    setW((p) => (Math.abs(p - next) < 1 ? p : next))
  }
  // Respiración del emblema — un halo oro que pulsa lento, para que el
  // emblema EMITA (no flote muerto). UN solo loop, gateado en foco
  // (useScreenActive: pausa fuera de tab y en scroll) + reduced-motion.
  // Opacidad + escala en un Animated.View (compositor) → no repinta el
  // Skia del emblema ni el SVG del halo. Cero costo en reposo/off-tab.
  const active = useScreenActive()
  // Gate de MONTAJE del Canvas Skia: foco puro (no useScreenActive, que
  // se apaga en scroll y haría parpadear el emblema al desplazar). Al salir
  // de Órbita este Canvas se desmonta, así nunca coexiste con el de Hoy
  // (LunarConstellation) — dos Canvas Skia en pantallas distintas se borran.
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
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.heroGlow, glowStyle]}
          pointerEvents="none"
        >
          <EmblemGlow size={w || HERO_SIZE} />
        </Animated.View>
        <StaticField size={w || HERO_SIZE} />
        {w > 0 && focused ? (
          <RevealedEmblem sign={sign} transformProgress={progress} size={w} />
        ) : null}
      </View>
      {/* % sereno, sin barra — el reveal del arte ES la barra; el número
          acompaña, nunca como meta a alcanzar. */}
      <Text style={styles.heroPct}>
        {progress}
        <Text style={styles.heroPctSign}>%</Text>
      </Text>
      <Text style={styles.heroCaption}>transformación revelada</Text>
      <Text style={styles.heroMessage}>{message}</Text>
    </View>
  )
}

/* Polvo estelar tenue detrás del emblema — fondo, no cosmos animado
 * (estático, cero costo). Posiciones seeded relativas al tamaño. */
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

/* El halo oro detrás del emblema — SVG estático (radial); la respiración
 * la da el Animated.View que lo envuelve (opacidad + escala), no el SVG. */
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

/* ── Una ficha de evidencia (conteo acumulado) ──────────────────────── */
function EvTile({
  value,
  unit,
  label,
  empty,
}: {
  value: string
  unit?: string
  label: string
  empty?: boolean
}) {
  return (
    <View style={styles.evTile}>
      <Text style={[styles.evValue, empty ? styles.evValueEmpty : null]}>
        {value}
        {unit ? <Text style={styles.evUnit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.evLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
  },
  header: {
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  meta: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  metaNum: {
    color: colors.magenta,
  },
  metaStelar: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 12.5,
    color: colors.oroSoft,
    textTransform: 'none',
  },
  // ── Emblema hero ──────────────────────────────────────────────
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
  heroPct: {
    marginTop: 10,
    fontFamily: typography.displayHeavy,
    fontSize: 34,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  heroPctSign: {
    fontSize: 16,
    color: colors.niebla,
  },
  heroCaption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginTop: 2,
  },
  heroMessage: {
    marginTop: 10,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 23,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  // ── Lo que más se repitió ─────────────────────────────────────
  enLuz: {
    alignItems: 'center',
    marginTop: 26,
  },
  enLuzEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 10,
  },
  enLuzRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  enLuzDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  enLuzLabel: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 26,
    lineHeight: 30,
  },
  enLuzCount: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 21,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  // ── Secciones ─────────────────────────────────────────────────
  section: {
    marginTop: 26,
  },
  sectionEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 12,
    marginLeft: 2,
  },
  // ── Evidencia acumulada (tiles 2×2) ───────────────────────────
  evGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  evTile: {
    width: '50%',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  evValue: {
    fontFamily: typography.uiBold,
    fontSize: 24,
    color: colors.leche,
  },
  evValueEmpty: {
    color: colors.bruma,
  },
  evUnit: {
    fontFamily: typography.uiMedium,
    fontSize: 12,
    color: colors.niebla,
  },
  evLabel: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginTop: 4,
  },
})
