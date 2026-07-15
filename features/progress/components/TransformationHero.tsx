import { useRouter } from 'expo-router'
import { useEffect, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry/four-point-star-path'
import { colors, typography } from '@/theme'

import { LinkCta } from './LinkCta'

import { useBodyCheckins, useMeasurements } from '../hooks'
import { mergeWeightSeries, recoveryFact, smoothWeightPoints } from '../logic'

/*
 * "Tu transformación · Tu camino" (F2 · Cuerpo) — la PORTADA del segmento,
 * rediseño uxui+illustrator 14 jul 2026. Decisiones:
 *
 * - GEOMETRÍA HONESTA: el arco ya no es una colina fija — es una cúbica cuya
 *   forma depende del modo. Con rebote: DESCENSO desde el pico (hoy termina
 *   más abajo = menos peso). Sin rebote: baja, sube o se aplana según el
 *   delta real. El trazo desemboca con un hilo vertical en el número de hoy.
 * - El trazo lleva GRADIENTE estático (el pasado se apaga al 8%, el presente
 *   arde al 95%) + un refuerzo de grosor en el último 28% del camino.
 * - SEMÁNTICA de estrellas: el pico es una estrella HUECA (contorno bone,
 *   "lo que ya ardió"); las partículas intermedias crecen y se calientan
 *   acercándose a hoy Y viven en fechas reales de registros (t proporcional
 *   al tiempo); hoy = estrella oroLeche con núcleo rosaLuz, nebulosa magenta
 *   tenue detrás (el único magenta de la pieza) y respiración de DOBLE halo
 *   en contrafase (solo opacity — expansión percibida sin animar radios).
 * - UNA sola lectura numérica: from → to anclados a los extremos del arco
 *   con micro-etiquetas (EL PICO / HOY), delta una vez; la frase serif ya no
 *   repite números (voz de coach, no re-lectura).
 * - Todo el bloque es TAPPABLE → /body-story (quirk-safe: layout en el View,
 *   el Pressable solo envuelve). El LinkCta explícito se queda.
 *
 * Reanimated animatedProps sobre SVG; bezier CÚBICO inline en worklets
 * (regla del repo: helpers JS planos en worklets truenan release). Gradientes
 * SOLO estáticos en Defs. Peso SUAVIZADO (media 7d).
 */

const ARC_W = 300
const ARC_H = 140

type ArcGeom = {
  p0x: number
  p0y: number
  c1x: number
  c1y: number
  c2x: number
  c2y: number
  p1x: number
  p1y: number
  d: string
  len: number
  sparks: { x: number; y: number; t: number; r: number; peak: number }[]
}

/** Punto de la cúbica en t (JS puro, fuera de worklets). */
const cubicAt = (g: Omit<ArcGeom, 'd' | 'len' | 'sparks'>, t: number): [number, number] => {
  const mt = 1 - t
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const e = t * t * t
  return [
    a * g.p0x + b * g.c1x + c * g.c2x + e * g.p1x,
    a * g.p0y + b * g.c1y + c * g.c2y + e * g.p1y,
  ]
}

const SPARK_R = [2.2, 2.6, 3.2] as const
const SPARK_PEAK = [0.35, 0.5, 0.65] as const

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function TransformationHero() {
  const router = useRouter()
  const measurements = useMeasurements(null)
  const checkins = useBodyCheckins()

  const hero = useMemo(() => {
    // UNA sola serie (app + coach): arranca en tu primera medición real.
    const fused = mergeWeightSeries(measurements.data ?? [], checkins.data ?? [])
    const smoothed = smoothWeightPoints(fused)
    const first = smoothed[0]
    const last = smoothed[smoothed.length - 1]
    if (!first || !last || smoothed.length < 2) return null
    // La historia de recuperación (pico → hoy): narra lo recorrido, nunca lo
    // que falta (cero countdown). Cuando existe, ES el ancla del hero.
    const recovery = recoveryFact(smoothed)
    const peakPoint = recovery
      ? smoothed.reduce((a, b) => (b.weight > a.weight ? b : a), first)
      : null
    const from = recovery ? recovery.peakKg : first.weight
    const deltaKg = Number((last.weight - from).toFixed(1))

    // Las partículas del arco viven en FECHAS reales: puntos intermedios de
    // la serie entre el ancla (pico o inicio) y hoy, t proporcional al
    // tiempo. Si la serie es corta, caen en posiciones decorativas fijas.
    const t0 = (peakPoint ?? first).t
    const t1 = last.t
    const inner = smoothed.filter((p) => p.t > t0 && p.t < t1)
    const sparkTs: number[] = []
    if (t1 > t0 && inner.length >= 3) {
      for (const q of [0.25, 0.5, 0.75]) {
        const p = inner[Math.min(inner.length - 1, Math.round((inner.length - 1) * q))]
        if (p) sparkTs.push(Math.min(0.9, Math.max(0.12, (p.t - t0) / (t1 - t0))))
      }
    }
    if (sparkTs.length < 3) {
      sparkTs.length = 0
      sparkTs.push(0.28, 0.52, 0.76)
    }

    return {
      from,
      to: last.weight,
      deltaKg,
      count: smoothed.length,
      lastT: last.t,
      recovery,
      sparkTs,
    }
  }, [measurements.data, checkins.data])

  // Geometría por modo: la FORMA del arco corresponde a la historia.
  const geom = useMemo<ArcGeom | null>(() => {
    if (!hero) return null
    const base = hero.recovery
      ? // Descenso desde el pico: arranca ya en lo alto, cae con rebote suave.
        { p0x: 20, p0y: 22, c1x: 110, c1y: 26, c2x: 190, c2y: 60, p1x: 280, p1y: 106 }
      : hero.deltaKg < 0
        ? // Inicio → hoy bajando: leve alzamiento inicial y la caída real.
          { p0x: 20, p0y: 34, c1x: 100, c1y: 14, c2x: 190, c2y: 52, p1x: 280, p1y: 106 }
        : hero.deltaKg > 0
          ? // Subiendo: hoy queda arriba (sin juicio: es la forma verdadera).
            { p0x: 20, p0y: 106, c1x: 110, c1y: 102, c2x: 190, c2y: 58, p1x: 280, p1y: 30 }
          : // Estable: casi llano.
            { p0x: 20, p0y: 72, c1x: 110, c1y: 62, c2x: 190, c2y: 62, p1x: 280, p1y: 72 }
    const d = `M ${base.p0x} ${base.p0y} C ${base.c1x} ${base.c1y}, ${base.c2x} ${base.c2y}, ${base.p1x} ${base.p1y}`
    let len = 0
    let [px, py] = cubicAt(base, 0)
    for (let i = 1; i <= 32; i += 1) {
      const [x, y] = cubicAt(base, i / 32)
      len += Math.hypot(x - px, y - py)
      px = x
      py = y
    }
    const sparks = hero.sparkTs.map((t, i) => {
      const [x, y] = cubicAt(base, t)
      return { x, y, t, r: SPARK_R[i] ?? 2.6, peak: SPARK_PEAK[i] ?? 0.5 }
    })
    return { ...base, d, len, sparks }
  }, [hero])

  // Draw del arco + estrella viajera (0 → 1). Se re-dibuja SOLO si cambia el
  // ancla (from/to) — con el objeto `hero` en deps, cada refetch reiniciaba
  // el dibujo aunque los números fueran los mismos (reanimated-guardian).
  const hasHero = hero != null
  const draw = useSharedValue(0)
  useEffect(() => {
    if (!hasHero) return
    draw.value = 0
    draw.value = withDelay(250, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }))
  }, [hero?.from, hero?.to, hasHero, draw])

  // Respiración del presente (lenta, elegante): un solo valor mueve los DOS
  // halos en contrafase. Cancelar al desmontar (regla de loops del repo).
  const breath = useSharedValue(0)
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [breath])

  const len = geom?.len ?? 1
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: len * (1 - draw.value),
  }))
  // El refuerzo del último tramo y el hilo de aterrizaje llegan CON el trazo.
  const tailProps = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [0.82, 1], [0, 0.35]),
  }))
  const landProps = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [0.9, 1], [0, 0.5]),
  }))
  // La estrella que recorre el camino: cúbica inline (worklet-safe), se
  // funde al llegar. Captura números planos de geom (estables por modo).
  const g0x = geom?.p0x ?? 0
  const g0y = geom?.p0y ?? 0
  const g1x = geom?.c1x ?? 0
  const g1y = geom?.c1y ?? 0
  const g2x = geom?.c2x ?? 0
  const g2y = geom?.c2y ?? 0
  const g3x = geom?.p1x ?? 0
  const g3y = geom?.p1y ?? 0
  const cometProps = useAnimatedProps(() => {
    const t = draw.value
    const mt = 1 - t
    const a = mt * mt * mt
    const b = 3 * mt * mt * t
    const c = 3 * mt * t * t
    const e = t * t * t
    return {
      cx: a * g0x + b * g1x + c * g2x + e * g3x,
      cy: a * g0y + b * g1y + c * g2y + e * g3y,
      opacity: interpolate(t, [0, 0.06, 0.92, 1], [0, 0.9, 0.9, 0]),
    }
  })
  const st0 = geom?.sparks[0]?.t ?? 0.28
  const st1 = geom?.sparks[1]?.t ?? 0.52
  const st2 = geom?.sparks[2]?.t ?? 0.76
  const sp0 = geom?.sparks[0]?.peak ?? 0.35
  const sp1 = geom?.sparks[1]?.peak ?? 0.5
  const sp2 = geom?.sparks[2]?.peak ?? 0.65
  const spark0 = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [st0, st0 + 0.12], [0, sp0]),
  }))
  const spark1 = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [st1, st1 + 0.12], [0, sp1]),
  }))
  const spark2 = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [st2, st2 + 0.12], [0, sp2]),
  }))
  const sparkProps = [spark0, spark1, spark2]
  // Doble halo en contrafase: A se enciende cuando B se apaga — el ojo
  // percibe expansión sin animar radios ni scale.
  const haloAProps = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [0.85, 1], [0, 1]) * (0.3 + breath.value * 0.25),
  }))
  const haloBProps = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [0.85, 1], [0, 1]) * (0.35 - breath.value * 0.23),
  }))
  const endStarProps = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [0.8, 1], [0.35, 1]),
  }))

  // Placeholder de altura fija mientras cargan las queries: sin esto el hero
  // aparecía de golpe y empujaba todo el contenido (layout jump · uxui).
  if (measurements.isPending || checkins.isPending) {
    return <View style={styles.placeholder} />
  }
  if (!hero || !geom) return null

  const sign = hero.deltaKg > 0 ? '+' : hero.deltaKg < 0 ? '−' : ''
  // Fecha absoluta neutra: "hace 6 días" rozaba el reproche pasivo (uxui).
  const lastDate = new Date(hero.lastT)
  const lastLabel = `el ${lastDate.getDate()} ${MESES[lastDate.getMonth()]}${
    lastDate.getFullYear() !== new Date().getFullYear() ? ` ${lastDate.getFullYear()}` : ''
  }`
  const fromLabel = hero.recovery ? 'El pico' : 'Empezaste'

  return (
    <Animated.View
      entering={FadeInDown.duration(520).easing(Easing.out(Easing.cubic))}
      style={styles.wrap}
    >
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Tu transformación
      </EyebrowLabel>
      <Text style={styles.sub}>{hero.recovery ? 'Tu camino, desde el pico' : 'Tu camino'}</Text>

      {/* Todo el bloque arco+números navega a la historia (quirk-safe: el
          layout vive en el View; el Pressable solo envuelve). */}
      <View style={styles.heroTapWrap}>
        <Pressable
          onPress={() => router.push('/body-story')}
          accessibilityRole="button"
          accessibilityLabel="Tu transformación, ver la historia completa"
          style={({ pressed }) => pressed && { opacity: 0.85 }}
        >
          <View style={styles.arcWrap}>
            <Svg width="100%" height={ARC_H} viewBox={`0 0 ${ARC_W} ${ARC_H}`}>
              <Defs>
                {/* El pasado se apaga, el presente arde (estático). */}
                <LinearGradient id="heroTrail" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={colors.oro} stopOpacity={0.08} />
                  <Stop offset="0.55" stopColor={colors.oro} stopOpacity={0.35} />
                  <Stop offset="0.85" stopColor={colors.oroSoft} stopOpacity={0.7} />
                  <Stop offset="1" stopColor={colors.oroLeche} stopOpacity={0.95} />
                </LinearGradient>
                <RadialGradient id="heroNebula" cx="0.5" cy="0.5" r="0.5">
                  <Stop offset="0" stopColor={colors.magenta} stopOpacity={0.1} />
                  <Stop offset="0.6" stopColor={colors.magenta} stopOpacity={0.04} />
                  <Stop offset="1" stopColor={colors.magenta} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              {/* Nebulosa del presente: el único magenta de la pieza. */}
              <Circle cx={geom.p1x} cy={geom.p1y} r={34} fill="url(#heroNebula)" />
              {/* El trazo con gradiente (dash-draw de siempre). */}
              <AnimatedPath
                d={geom.d}
                stroke="url(#heroTrail)"
                strokeWidth={1}
                fill="none"
                strokeDasharray={geom.len}
                animatedProps={arcProps}
              />
              {/* Refuerzo de cuerpo en el último 28% del camino. */}
              <AnimatedPath
                d={geom.d}
                stroke={colors.oroLeche}
                strokeWidth={1.6}
                fill="none"
                strokeDasharray={`${geom.len * 0.28} ${geom.len}`}
                strokeDashoffset={-geom.len * 0.72}
                animatedProps={tailProps}
              />
              {/* El hilo de aterrizaje: el trazo desemboca en el número. */}
              <AnimatedLine
                x1={geom.p1x}
                y1={geom.p1y + 12}
                x2={geom.p1x}
                y2={ARC_H - 2}
                stroke={colors.oroHairline}
                strokeWidth={0.75}
                animatedProps={landProps}
              />
              {/* Partículas en fechas reales: crecen acercándose a hoy. */}
              {geom.sparks.map((s, i) => (
                <AnimatedPath
                  key={`${s.t}-${i}`}
                  d={fourPointStarPath(s.x, s.y, s.r)}
                  fill={colors.oroSoft}
                  animatedProps={sparkProps[i]}
                />
              ))}
              {/* El ancla: estrella HUECA si es el pico (lo que ya ardió);
                  tenue si es el inicio (empezar no es haberse apagado). */}
              {hero.recovery ? (
                <Path
                  d={fourPointStarPath(geom.p0x, geom.p0y, 4.5)}
                  fill="none"
                  stroke={colors.bone}
                  strokeWidth={0.8}
                  opacity={0.7}
                />
              ) : (
                <Path
                  d={fourPointStarPath(geom.p0x, geom.p0y, 4.5)}
                  fill={colors.oroSoft}
                  opacity={0.6}
                />
              )}
              {/* La viajera. */}
              <AnimatedCircle r={3} fill={colors.oroLeche} animatedProps={cometProps} />
              {/* Hoy: doble halo respirando + estrella encendida + núcleo. */}
              <AnimatedCircle
                cx={geom.p1x}
                cy={geom.p1y}
                r={19}
                fill={colors.oroBloom}
                animatedProps={haloBProps}
              />
              <AnimatedCircle
                cx={geom.p1x}
                cy={geom.p1y}
                r={13}
                fill={colors.oroGlow}
                animatedProps={haloAProps}
              />
              <AnimatedPath
                d={fourPointStarPath(geom.p1x, geom.p1y, 6.5)}
                fill={colors.oroLeche}
                animatedProps={endStarProps}
              />
              <Circle cx={geom.p1x} cy={geom.p1y} r={2.2} fill={colors.rosaLuz} />
            </Svg>
          </View>

          {/* UNA lectura numérica, anclada a los extremos del arco. */}
          <View style={styles.numbersRow}>
            <View>
              <Text style={styles.from}>{hero.from.toFixed(1)} kg</Text>
              <Text style={styles.endLabel}>{fromLabel}</Text>
            </View>
            <View style={styles.toBlock}>
              <View style={styles.toRow}>
                <Text style={styles.to}>{hero.to.toFixed(1)}</Text>
                <Text style={styles.toUnit}>kg</Text>
              </View>
              <Text style={[styles.endLabel, styles.endLabelRight]}>Hoy</Text>
            </View>
          </View>
          {hero.deltaKg !== 0 ? (
            <Text style={styles.delta}>
              {sign}
              {Math.abs(hero.deltaKg).toFixed(1)} kg
            </Text>
          ) : null}
        </Pressable>
      </View>

      {/* Voz de coach: agrega significado, NO re-lee los números de arriba
          (antes el mismo hecho se enunciaba tres veces · uxui). Desaparece
          (no regaña) si la tendencia se invierte. */}
      {hero.recovery ? (
        <Text style={styles.recovery}>Ya vas de regreso. Esta vez con evidencia.</Text>
      ) : null}

      {/* "Registros de peso", no "mediciones": la tabla llama mediciones a los
          check-ins y este conteo incluye los pesajes de la app. */}
      <Text style={styles.meta}>
        {hero.count} {hero.count === 1 ? 'registro' : 'registros'} de peso · último {lastLabel}
      </Text>

      {/* Epic 08: los capítulos completos viven en su pantalla. */}
      {/* "Capítulos", no "historia": Historia ya nombra el otro segmento del
          tab y la misma palabra con dos destinos rompía el mapa mental
          (target-user). "Capítulo" es el vocabulario que ella ya ama. */}
      <LinkCta
        label="Ver tus capítulos →"
        onPress={() => router.push('/body-story')}
        accessibilityLabel="Ver los capítulos de tu peso"
        style={styles.storyLink}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Portada: aire arriba, números anclados a los extremos del arco.
  wrap: { alignItems: 'center', paddingTop: 16 },
  // Altura ≈ la del hero renderizado: evita el salto de layout al cargar.
  placeholder: { height: 300 },
  eyebrow: { alignSelf: 'flex-start', marginBottom: 2 },
  sub: {
    alignSelf: 'flex-start',
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    marginBottom: 14,
  },
  heroTapWrap: { width: '100%' },
  arcWrap: { width: '100%', marginBottom: -4 },
  numbersRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  toBlock: { alignItems: 'flex-end' },
  toRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  // Inicial atenuado: el viaje importa más que el punto de partida.
  from: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.segmentTitle,
    color: colors.niebla,
    opacity: 0.85,
    fontVariant: ['tabular-nums'],
  },
  // El HOY domina la portada (46pt, con un halo de luz sutil).
  to: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.statHero,
    color: colors.leche,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(252, 246, 235, 0.22)',
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  toUnit: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.headingLg,
    color: colors.bone,
  },
  endLabel: {
    marginTop: 2,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  endLabelRight: { textAlign: 'right' },
  // Delta en ORO (sin juicio): el cambio como hecho, UNA vez.
  delta: {
    marginTop: 8,
    alignSelf: 'center',
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displayMd,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  // La frase de recuperación — voz del coach, sin números.
  recovery: {
    marginTop: 16,
    paddingHorizontal: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 25,
    color: colors.leche,
    textAlign: 'center',
  },
  meta: {
    marginTop: 14,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  storyLink: { alignSelf: 'center', marginTop: 2 },
})
