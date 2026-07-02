import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg'

import { useMacroTargets } from '@/features/macros/hooks'
import { GLASS_ML, useWaterGoal } from '@/features/water/useWaterGoal'
import { todayInTimezone } from '@/lib/time'

import { DayLogModal, type DayLogKey } from './log/DayLogModal'
import { colors, typography } from '@/theme'

import { useScreenActive } from '../useScreenActive'
import { useDaySignals, useTodaySignals } from '../hooks'
import {
  buildDayGoal,
  type GoalHero,
  type GoalStatus,
  type GoalTone,
  type GoalWhy,
} from '../day-goal'
import { formatLongDate } from '../present-logic'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/*
 * Órbita · Día — "¿Cómo voy hoy?" (Stelar v2, sin IA).
 *
 * Una sola pregunta: ¿me acerco a mi objetivo hoy? El héroe es el anillo del
 * déficit del día (override consciente del manifiesto, decisión de la dueña).
 * Debajo: la evidencia que YA apareció, lo que aún no aparece (tappable →
 * registrar), hacia dónde va el día + su porqué, y un cierre que conecta con
 * Órbita Semana. Mucho aire, sin dashboard. Ver docs/orbita-dia-redesign-spec.md.
 */

// Color por estado del objetivo: déficit = magenta (rumbo), sobre objetivo =
// oro cálido (nunca rojo), aún se revela = niebla (en calma).
const STATUS_COLOR: Record<GoalStatus, string> = {
  deficit: colors.magenta,
  over: colors.oro,
  incomplete: colors.niebla,
}

// Cada evidencia se tinta al color de SU dimensión → un cielo multicolor.
const TONE_COLOR: Record<GoalTone, string> = {
  cuerpo: colors.dimension.cuerpo,
  sueno: colors.dimension.sueno,
  alimento: colors.dimension.alimento,
  ciclo: colors.dimension.ciclo,
  energia: colors.dimension.energia,
  mente: colors.dimension.mente,
  proteina: colors.signal.proteina,
  agua: colors.signal.agua,
  leche: colors.leche,
}

// A qué slide de Hoy lleva cada señal ausente (cierra el loop "no apareció →
// regístralo"). Agua no tiene slide propio → cae a Hoy (quick-log ✦).
const ABSENT_SLIDE: Record<string, string | null> = {
  sueno: 'sleep',
  animo: 'wellbeing',
  comida: 'meals',
  agua: null,
}

// Color de cada señal ausente (= su dimensión) para el latido del chip.
const ABSENT_TONE: Record<string, string> = {
  sueno: colors.dimension.sueno,
  comida: colors.dimension.alimento,
  agua: colors.signal.agua,
  animo: colors.dimension.mente,
}

const RING_SIZE = 208
const CENTER = RING_SIZE / 2 // 104
// El aura respira más allá del borde del anillo (bloom).
const GLOW_SIZE = Math.round(RING_SIZE * 1.5)

// Tres anillos concéntricos (radios de la línea media). Exterior = calorías (el
// norte de la app), medio = proteína, interior = entreno (binario). sw 8, ~9px
// de aire entre bordes → premium, sin apretar.
const RING_SW = 8
const RING_OUTER_R = 91 // calorías / déficit
const RING_MID_R = 74 // proteína
const RING_INNER_R = 57 // entreno
const C_OUTER = 2 * Math.PI * RING_OUTER_R
const C_MID = 2 * Math.PI * RING_MID_R
const C_INNER = 2 * Math.PI * RING_INNER_R

// El track tintado al estado: el vacío del anillo glow-ea suave (magenta/oro) =
// "aún tienes espacio" hecho visual, en vez de un hairline neutro que se pierde.
const TRACK_COLOR: Record<GoalStatus, string> = {
  deficit: colors.magentaTint,
  over: colors.oroTint,
  incomplete: colors.hairline,
}

// Stops del gradiente de la traza (oscuro abajo-izq → cálido arriba-der): vuelve
// el trazo plano en materia luminosa. La energía se concentra hacia la punta.
const RING_STOPS: Record<GoalStatus, [string, string, string]> = {
  deficit: [colors.magentaDeep, colors.magenta, colors.magentaHot],
  over: [colors.oro, colors.oroSoft, colors.oroLight],
  incomplete: [colors.niebla, colors.niebla, colors.niebla],
}

// Proteína (anillo medio) — derivaciones de `colors.signal.proteina` (coral).
const PROTEIN_STOPS: [string, string, string] = ['#C98F80', '#E0AEA0', '#F0CFC4']
const PROTEIN_TRACK = 'rgba(224, 174, 160, 0.12)'

// Entreno (anillo interior) — VIOLETA, distinto del magenta de calorías y del
// coral de proteína: los tres anillos se leen aparte, sin repetir el rosa.
const TRAIN_COLOR = colors.dimension.mente // #C18FFF
const TRAIN_STOPS: [string, string, string] = ['#8E5FC7', '#C18FFF', '#DABBFF']
const TRAIN_TRACK = 'rgba(193, 143, 255, 0.12)'

type RingSpec = {
  r: number
  c: number
  sw: number
  fill: number // 0..1 destino
  color: string // sólido para bloom / cometa / track encendido
  gradId: string | null // url del gradiente del arco; null → sólido (incompleto)
  trackColor: string
  bloomWidth: number
  bloomOpacity: number
  comet: 'full' | 'soft' | 'none'
  show: boolean // dibujar arco / bloom / cometa (track siempre se dibuja)
  delay: number
  overflow?: number // solo exterior: arco oro de sobre-objetivo
}

/** Un anillo concéntrico completo: track (siempre) + bloom + arco con gradiente +
 *  cabeza de cometa en la punta (+ arco oro de excedente en el exterior). Anima su
 *  propio fill al entrar (one-shot, respeta reduce-motion). Cada anillo lleva su
 *  color de dimensión. Devuelve un fragmento de elementos SVG → vive dentro del
 *  <Svg> rotado -90 del padre (arranca arriba, la punta viaja con él). */
function RingArc({ spec, reduce }: { spec: RingSpec; reduce: boolean }) {
  const { r, c } = spec

  const progress = useSharedValue(reduce ? spec.fill : 0)
  const overflow = useSharedValue(reduce ? (spec.overflow ?? 0) : 0)
  useEffect(() => {
    if (reduce) {
      progress.value = spec.fill
      overflow.value = spec.overflow ?? 0
      return
    }
    progress.value = withDelay(
      spec.delay,
      withTiming(spec.fill, { duration: 1300, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }),
    )
    overflow.value = withDelay(
      1100,
      withTiming(spec.overflow ?? 0, { duration: 700, easing: Easing.out(Easing.quad) }),
    )
  }, [progress, overflow, spec.fill, spec.overflow, spec.delay, reduce])

  const arcProps = useAnimatedProps(() => ({ strokeDasharray: [c * progress.value, c] }))
  const overflowProps = useAnimatedProps(() => ({ strokeDasharray: [c * overflow.value, c] }))
  // Cabeza de cometa — coords sin rotar; el rotate -90 del <Svg> las lleva a
  // arrancar arriba. Math.cos/sin corren en el worklet (sin helper externo).
  const tipProps = useAnimatedProps(() => {
    const t = progress.value * 2 * Math.PI
    return { cx: CENTER + r * Math.cos(t), cy: CENTER + r * Math.sin(t) }
  })

  // Vida CONTINUA (no solo el trazo de entrada): el bloom respira (breath, seno
  // ida-vuelta) y un latido pulsa desde la cabeza de cometa (beat, 0→1 en bucle).
  // Gateado en pantalla activa + reduce-motion → fuera de foco todo queda quieto.
  // Solo opacidad/radio en el worklet: no re-rasteriza el SVG.
  const active = useScreenActive()
  const breath = useSharedValue(0)
  const beat = useSharedValue(0)
  useEffect(() => {
    if (reduce || !active) {
      cancelAnimation(breath)
      cancelAnimation(beat)
      breath.value = 0.5
      beat.value = 0
      return
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    beat.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    )
    return () => {
      cancelAnimation(breath)
      cancelAnimation(beat)
    }
  }, [reduce, active, breath, beat])

  // Bloom respirando: el arco (dasharray) + una opacidad que late lento.
  const bloomProps = useAnimatedProps(() => ({
    strokeDasharray: [c * progress.value, c],
    opacity: spec.bloomOpacity * (0.6 + 0.7 * breath.value),
  }))
  // Latido: un anillo que se expande y se desvanece desde la punta del cometa.
  const beaconProps = useAnimatedProps(() => {
    const t = progress.value * 2 * Math.PI
    return {
      cx: CENTER + r * Math.cos(t),
      cy: CENTER + r * Math.sin(t),
      r: 4 + beat.value * 12,
      opacity: 0.4 * (1 - beat.value),
    }
  })

  return (
    <>
      {/* Track (siempre): tintado cuando el anillo vive, hairline en calma cuando
          no hay dato → nunca un hueco que culpe, solo reposo. */}
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={r}
        fill="none"
        stroke={spec.trackColor}
        strokeWidth={spec.sw}
      />

      {spec.show ? (
        <>
          {/* Bloom — mismo arco, más ancho y tenue: glow real cross-platform. Su
              opacidad RESPIRA (breath) → el anillo tiene vida continua. */}
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={r}
            fill="none"
            stroke={spec.color}
            strokeWidth={spec.bloomWidth}
            strokeLinecap="round"
            animatedProps={bloomProps}
          />
          {/* Arco nítido — gradiente diagonal (plano → materia luminosa) */}
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={r}
            fill="none"
            stroke={spec.gradId ? `url(#${spec.gradId})` : spec.color}
            strokeWidth={spec.sw}
            strokeLinecap="round"
            animatedProps={arcProps}
          />
          {/* Sobre-objetivo (solo exterior) — arco oro corto, sin rojo ni alarma */}
          {spec.overflow != null ? (
            <AnimatedCircle
              cx={CENTER}
              cy={CENTER}
              r={r}
              fill="none"
              stroke={colors.oroLight}
              strokeWidth={spec.sw}
              strokeLinecap="round"
              opacity={0.9}
              animatedProps={overflowProps}
            />
          ) : null}
          {/* Latido — un anillo que pulsa desde la punta del cometa (exterior /
              medio). El interior (binario, sin cometa) vive por el bloom. */}
          {spec.comet !== 'none' ? (
            <AnimatedCircle animatedProps={beaconProps} fill={spec.color} />
          ) : null}
          {/* Cabeza de cometa — llena en el exterior, sobria en el medio, ausente
              en el interior (binario: un cometa sobre lleno/vacío sería ruido). */}
          {spec.comet === 'full' ? (
            <>
              <AnimatedCircle animatedProps={tipProps} r={8} fill={spec.color} opacity={0.22} />
              <AnimatedCircle animatedProps={tipProps} r={3.2} fill={colors.oroLeche} />
            </>
          ) : spec.comet === 'soft' ? (
            <>
              <AnimatedCircle animatedProps={tipProps} r={5} fill={spec.color} opacity={0.18} />
              <AnimatedCircle animatedProps={tipProps} r={2.4} fill={colors.oroLeche} />
            </>
          ) : null}
        </>
      ) : null}
    </>
  )
}

/** El hero: tres anillos concéntricos (calorías · proteína · entreno) que se
 *  dibujan al entrar, con la gramática de siempre (well, track, bloom, gradiente,
 *  cometa). El exterior (calorías) es el norte y manda; proteína y entreno
 *  acompañan más sobrios. Un aura única (color del estado de calorías) respira
 *  detrás. El campo de estrellas vive en el centro. Todo one-shot + reduce-motion.
 *  Evidencia del día, no un reto: incompleto y "sin entreno" descansan en calma. */
function GoalRing({ hero }: { hero: GoalHero }) {
  const reduce = useReducedMotion() ?? false
  const outerColor = STATUS_COLOR[hero.status]
  const isIncomplete = hero.status === 'incomplete'
  const isOver = hero.status === 'over'
  const [c0, c1, c2] = RING_STOPS[hero.status]

  const hasProtein = hero.proteinFill != null
  const trained = hero.trained

  // Especificaciones de los tres anillos. Retrasos escalonados = el exterior lidera.
  const outer: RingSpec = {
    r: RING_OUTER_R,
    c: C_OUTER,
    sw: RING_SW,
    fill: hero.fill,
    color: outerColor,
    gradId: isIncomplete ? null : 'grad-cal',
    trackColor: TRACK_COLOR[hero.status],
    bloomWidth: 16,
    bloomOpacity: isIncomplete ? 0 : 0.16,
    comet: isIncomplete ? 'none' : 'full',
    show: !isIncomplete,
    delay: 160,
    overflow: isOver ? hero.over : undefined,
  }
  const mid: RingSpec = {
    r: RING_MID_R,
    c: C_MID,
    sw: RING_SW,
    fill: hasProtein ? Math.min(1, hero.proteinFill!) : 0,
    color: colors.signal.proteina,
    gradId: 'grad-protein',
    trackColor: hasProtein ? PROTEIN_TRACK : colors.hairline,
    bloomWidth: 13,
    bloomOpacity: hasProtein ? 0.12 : 0,
    comet: hasProtein ? 'soft' : 'none',
    show: hasProtein,
    delay: 320,
  }
  const inner: RingSpec = {
    r: RING_INNER_R,
    c: C_INNER,
    sw: RING_SW,
    fill: trained ? 1 : 0,
    color: TRAIN_COLOR,
    gradId: 'grad-train',
    trackColor: trained ? TRAIN_TRACK : colors.hairline, // no entrenó = track en reposo
    bloomWidth: 13,
    bloomOpacity: trained ? 0.12 : 0,
    comet: 'none', // binario: sin cometa
    show: trained,
    delay: 480,
  }

  // Respiración del aura — vida continua SIN re-rasterizar el SVG (opacidad de una
  // View = compositor). Color del estado de calorías = el norte manda. Gateada en
  // pantalla activa + reduce-motion. Oculta en incompleto (en calma).
  const active = useScreenActive()
  const glow = useSharedValue(reduce ? 1 : 0)
  useEffect(() => {
    if (reduce || !active) {
      cancelAnimation(glow)
      glow.value = withTiming(0.6, { duration: 320, easing: Easing.out(Easing.quad) })
      return
    }
    glow.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(glow)
  }, [glow, active, reduce])
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.32 + glow.value * 0.42 }))

  return (
    <View style={[styles.ringWrap, { shadowColor: outerColor }]}>
      {/* Aura que respira detrás de los anillos (color del estado de calorías). */}
      {!isIncomplete ? (
        <Animated.View style={[styles.ringGlow, glowStyle]} pointerEvents="none">
          <Svg width={GLOW_SIZE} height={GLOW_SIZE}>
            <Defs>
              <RadialGradient id="ring-bloom" cx="50%" cy="50%" r="50%">
                <Stop offset="0.5" stopColor={outerColor} stopOpacity={0} />
                <Stop offset="0.72" stopColor={outerColor} stopOpacity={0.3} />
                <Stop offset="1" stopColor={outerColor} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle
              cx={GLOW_SIZE / 2}
              cy={GLOW_SIZE / 2}
              r={GLOW_SIZE / 2}
              fill="url(#ring-bloom)"
            />
          </Svg>
        </Animated.View>
      ) : null}

      <Svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        style={styles.ringSvg}
      >
        <Defs>
          {/* Gradiente de cada anillo (oscuro abajo-izq → cálido arriba-der). */}
          <LinearGradient id="grad-cal" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={c0} />
            <Stop offset="0.6" stopColor={c1} />
            <Stop offset="1" stopColor={c2} />
          </LinearGradient>
          <LinearGradient id="grad-protein" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={PROTEIN_STOPS[0]} />
            <Stop offset="0.6" stopColor={PROTEIN_STOPS[1]} />
            <Stop offset="1" stopColor={PROTEIN_STOPS[2]} />
          </LinearGradient>
          <LinearGradient id="grad-train" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={TRAIN_STOPS[0]} />
            <Stop offset="0.6" stopColor={TRAIN_STOPS[1]} />
            <Stop offset="1" stopColor={TRAIN_STOPS[2]} />
          </LinearGradient>
          {/* Pozo de luz interior (lit-from-within detrás de las estrellas). */}
          <RadialGradient id="ring-well" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={outerColor} stopOpacity={0.12} />
            <Stop offset="0.7" stopColor={outerColor} stopOpacity={0.025} />
            <Stop offset="1" stopColor={outerColor} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Pozo de luz — cae dentro del anillo interior, detrás de las estrellas. */}
        <Circle cx={CENTER} cy={CENTER} r={RING_INNER_R - 6} fill="url(#ring-well)" />

        {/* De adentro hacia afuera: exterior encima (el norte manda visualmente). */}
        <RingArc spec={inner} reduce={reduce} />
        <RingArc spec={mid} reduce={reduce} />
        <RingArc spec={outer} reduce={reduce} />
      </Svg>

      {/* Centro — campo de estrellas (achicado para caber en el anillo interior). */}
      <View style={styles.ringCenter} pointerEvents="none">
        <RingStars dim={isIncomplete} size={100} />
      </View>
    </View>
  )
}

/** Estrellas dentro del anillo: solo estrellas, grandes y pequeñas, SIN líneas.
 *  Una o dos brillan como destello de 4 puntas (con halo); el resto son puntos
 *  tenues de tamaños variados. Estático (sin animación → barato, sin jank). En
 *  estado incompleto baja la intensidad (a la espera). */
const STAR_SPARKLE =
  'M9 2.2 C9.5 6.7 11.3 8.5 15.8 9 C11.3 9.5 9.5 11.3 9 15.8 C8.5 11.3 6.7 9.5 2.2 9 C6.7 8.5 8.5 6.7 9 2.2 Z'
// Estrellas grandes (destello). `s` escala el path de 18×18 centrado en (x,y).
const RING_BIG_STARS: { x: number; y: number; s: number }[] = [
  { x: 49, y: 31, s: 1.05 },
  { x: 39, y: 59, s: 0.66 },
]
// Estrellas pequeñas (puntos), tamaños y brillos variados.
const RING_SMALL_STARS: { x: number; y: number; r: number; o: number }[] = [
  { x: 31, y: 45, r: 1.5, o: 0.8 },
  { x: 62, y: 38, r: 1.1, o: 0.6 },
  { x: 70, y: 55, r: 1.3, o: 0.72 },
  { x: 56, y: 64, r: 1.8, o: 0.85 },
  { x: 34, y: 67, r: 1.0, o: 0.55 },
  { x: 66, y: 70, r: 0.9, o: 0.5 },
  { x: 48, y: 73, r: 1.1, o: 0.6 },
  { x: 27, y: 56, r: 0.85, o: 0.5 },
]
function RingStars({ dim, size = 100 }: { dim?: boolean; size?: number }) {
  const o = dim ? 0.5 : 1
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {RING_SMALL_STARS.map((s, i) => (
        <Circle key={`d${i}`} cx={s.x} cy={s.y} r={s.r} fill={colors.bone} opacity={s.o * o} />
      ))}
      {RING_BIG_STARS.map((b, i) => (
        <Circle
          key={`h${i}`}
          cx={b.x}
          cy={b.y}
          r={6 * b.s}
          fill={colors.oroLight}
          opacity={0.16 * o}
        />
      ))}
      {RING_BIG_STARS.map((b, i) => (
        <Path
          key={`b${i}`}
          d={STAR_SPARKLE}
          fill={colors.oroLeche}
          opacity={o}
          // translate + scale (sin rotate → seguro en Android release).
          transform={`translate(${b.x - 9 * b.s} ${b.y - 9 * b.s}) scale(${b.s})`}
        />
      ))}
    </Svg>
  )
}

/** Un punto de la leyenda de anillos: color + label. `dim` (entreno sin registrar)
 *  lo apaga → reposo, no reproche. */
/** Una columna de la leyenda de anillos: punto + label arriba, el dato debajo
 *  (kcal / g / si entrenó). `dim` (entreno sin registrar) la apaga → reposo. */
function LegendStat({
  color,
  label,
  value,
  dim,
}: {
  color: string
  label: string
  value: string
  dim?: boolean
}) {
  return (
    <View style={styles.legendItem}>
      <View style={styles.legendHead}>
        <View style={[styles.legendDot, { backgroundColor: color }, dim && styles.legendDotDim]} />
        <Text style={[styles.legendLabel, dim && styles.legendLabelDim]}>{label}</Text>
      </View>
      <Text style={[styles.legendValue, dim && styles.legendValueDim]}>{value}</Text>
    </View>
  )
}

/** La evidencia como ESTRELLA ENCENDIDA tintada a su dimensión: un halo tenue
 *  bajo el path la vuelve punto de luz, no icono plano. `major` (la primera
 *  evidencia del día) brilla un poco mayor → constelación, no checklist. La
 *  punta apunta arriba en el path (sin rotación → seguro en Android release). */
function EvidenceStar({ color, major }: { color: string; major?: boolean }) {
  const s = major ? 17 : 13
  return (
    <Svg width={s} height={s} viewBox="0 0 18 18">
      <Circle cx={9} cy={9} r={6.5} fill={color} opacity={0.16} />
      <Path
        d="M9 2.2 C9.5 6.7 11.3 8.5 15.8 9 C11.3 9.5 9.5 11.3 9 15.8 C8.5 11.3 6.7 9.5 2.2 9 C6.7 8.5 8.5 6.7 9 2.2 Z"
        fill={color}
      />
    </Svg>
  )
}

/** Un chip de "lo que aún no aparece": tappable, con un FONDO que palpita (respira
 *  en el color de la señal) como afordancia viva de "tócame". Sin "+". Gateado en
 *  pantalla activa + reduce-motion. Al tocar abre su modal de registro. */
function AbsentChip({
  label,
  tone,
  onPress,
}: {
  label: string
  tone: string
  onPress: () => void
}) {
  const active = useScreenActive()
  const reduced = useReducedMotion() ?? false
  const pulse = useSharedValue(0)
  useEffect(() => {
    if (!active || reduced) {
      cancelAnimation(pulse)
      pulse.value = withTiming(0.45, { duration: 300, easing: Easing.out(Easing.quad) })
      return
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(pulse)
  }, [active, reduced, pulse])
  // El fondo respira en opacidad (compositor, no repinta): tinte de la señal.
  const bgStyle = useAnimatedStyle(() => ({ opacity: 0.07 + pulse.value * 0.16 }))
  return (
    <Pressable
      style={({ pressed }) => [styles.absentItem, pressed && styles.absentItemPressed]}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Registrar ${label}`}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.absentPulse, { backgroundColor: tone }, bgStyle]}
      />
      {/* Contenido en su propia fila explícita (dot + label lado a lado), aislado
          de cómo el padre resuelva su estilo → nunca se apila. */}
      <View style={styles.absentInner}>
        <View style={[styles.absentDot, { backgroundColor: tone }]} />
        <Text style={styles.absentLabel}>{label}</Text>
      </View>
    </Pressable>
  )
}

/** Una pieza del "¿Por qué?": estrella (sostiene el rumbo) o punto oro hueco
 *  (lo que va en contra). Sin culpa: informa la causa, no la juzga. */
function WhyMark({ item }: { item: GoalWhy }) {
  if (item.supports) return <EvidenceStar color={TONE_COLOR[item.tone]} />
  return <View style={styles.whyAgainst} />
}

export function DayPresent({
  viewedDay = null,
  onReturnToToday,
  onScrollTop,
}: {
  /** Día a mostrar (ISO 'YYYY-MM-DD'); null = hoy. Lo setea la tira de Semana. */
  viewedDay?: string | null
  onReturnToToday?: () => void
  onScrollTop?: () => void
} = {}) {
  const todayIso = todayInTimezone()
  const isPast = viewedDay != null && viewedDay !== todayIso
  const targetDay = viewedDay ?? todayIso

  // Hoy comparte caché con el resto de la app (useTodaySignals); un día pasado
  // usa su propia query (solo activa cuando se está viendo un día pasado).
  const todayQ = useTodaySignals()
  const pastQ = useDaySignals(targetDay, isPast)
  const { data, isLoading, isError, refetch } = isPast ? pastQ : todayQ
  const signals = data ?? null
  const targets = useMacroTargets()
  const { goalMl } = useWaterGoal()

  const ctx = {
    proteinTarget: targets.data?.protein_g ?? null,
    calorieTarget: targets.data?.calories ?? null,
    waterGoalGlasses: Math.max(1, Math.round(goalMl / GLASS_ML)),
  }
  const day = buildDayGoal(signals, ctx, { past: isPast })
  // La evidencia ya NO repite calorías / proteína / entreno: eso vive en los
  // anillos del hero. Aquí solo el resto (sueño, agua, ánimo, ciclo, peso...).
  const evidenceShown = (day?.evidence ?? []).filter(
    (e) => e.key !== 'protein' && e.key !== 'train',
  )

  const router = useRouter()
  const settled = !isLoading

  // Señales que se registran EN CONTEXTO con su propio modal (agua/ánimo/sueño),
  // sin salir de Órbita. Comida (escaneo pesado) y los días pasados siguen yendo
  // a Hoy.
  const [logKey, setLogKey] = useState<DayLogKey | null>(null)
  const MODAL_KEYS = new Set<string>(['agua', 'animo', 'sueno'])

  // Tocar una señal ausente: agua/ánimo/sueño abren su modal EN CONTEXTO (hoy o
  // un día pasado). Comida abre la cámara AI / texto (/capture-meal → /scan-meal).
  const onMissingPress = (key: string) => {
    if (MODAL_KEYS.has(key)) {
      setLogKey(key as DayLogKey)
      return
    }
    if (key === 'comida') {
      router.push('/capture-meal')
      return
    }
    const slide = ABSENT_SLIDE[key]
    router.push(slide ? `/(tabs)?slide=${slide}` : '/(tabs)')
  }

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>{isPast ? '¿Cómo fue ese día?' : '¿Cómo voy hoy?'}</Text>
      <Text style={styles.date}>{formatLongDate(targetDay)}</Text>
      {isPast && onReturnToToday ? (
        <Pressable onPress={onReturnToToday} hitSlop={8} style={styles.backToToday}>
          <Text style={styles.backToTodayText}>‹ Volver a hoy</Text>
        </Pressable>
      ) : null}
    </View>
  )

  // Primera carga sin caché — placeholder cálido, no pantalla en blanco.
  if (!settled && signals == null) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        {header}
        <View style={styles.card}>
          <Text style={styles.cardBody}>Mirando tu día…</Text>
        </View>
      </Animated.View>
    )
  }

  if (isError) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        {header}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tu día no terminó de cargar</Text>
          <Text style={styles.cardBody}>Vuelve a intentarlo en un momento.</Text>
          <Text
            style={styles.retry}
            onPress={() => void refetch()}
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
          >
            Reintentar
          </Text>
        </View>
      </Animated.View>
    )
  }

  // Sin ningún registro hoy → invitación (no hay día que leer todavía).
  if (day == null) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        {header}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tu día aún no habla</Text>
          <Text style={styles.cardBody}>
            En cuanto registres una señal (una comida, tu sueño, un entreno), aquí verás cómo va tu
            objetivo de hoy.
          </Text>
        </View>
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {header}

      {/* Hero — el anillo (con la constelación dentro) y, debajo, el estado del
          objetivo: "Hoy estás en / Déficit / −785 kcal / Aún tienes margen…".
          El número (consumido − meta) es negativo en déficit = vas bajo tu meta. */}
      <View style={styles.hero}>
        <GoalRing hero={day.hero} />
        <View style={styles.heroText}>
          {/* El eyebrow "Hoy estás en ___" solo cuando el estado COMPLETA la frase
              (Déficit / Sobre tu objetivo). En incompleto, "Tu día aún se revela"
              se lee sola (si no, "Hoy estás en tu día aún se revela" no parsea). */}
          {day.hero.status !== 'incomplete' ? (
            <Text style={styles.heroEyebrow}>{isPast ? 'Ese día estabas en' : 'Hoy estás en'}</Text>
          ) : null}
          <Text style={[styles.heroWord, day.hero.status === 'incomplete' && styles.heroWordDim]}>
            {day.hero.stateLabel}
          </Text>
          {day.hero.deltaKcal != null ? (
            // Sin signo: la palabra ("Déficit" / "Sobre tu objetivo") da el rumbo;
            // el número es la magnitud, siempre en positivo (nunca un negativo).
            <Text style={[styles.heroNumber, { color: STATUS_COLOR[day.hero.status] }]}>
              {day.hero.deltaKcal}
              <Text style={styles.heroNumberUnit}> kcal</Text>
            </Text>
          ) : null}
          <Text style={styles.heroLine}>{day.hero.line}</Text>

          {/* Leyenda — qué anillo es cuál + su dato del día (kcal / g / entreno).
              Proteína solo si hay dato; entreno tenue si no entrenó (reposo). */}
          <View style={styles.legend}>
            <LegendStat
              color={STATUS_COLOR[day.hero.status]}
              label="Calorías"
              value={day.hero.consumed != null ? `${day.hero.consumed} kcal` : '—'}
            />
            {day.hero.proteinFill != null ? (
              <LegendStat
                color={colors.signal.proteina}
                label="Proteína"
                value={day.hero.proteinG != null ? `${day.hero.proteinG} g` : '—'}
              />
            ) : null}
            <LegendStat
              color={TRAIN_COLOR}
              label="Entreno"
              value={day.hero.trained ? 'Sí' : isPast ? 'No' : 'Aún no'}
              dim={!day.hero.trained}
            />
          </View>
        </View>
      </View>

      {/* HACIA DÓNDE VA TU DÍA — la síntesis (lo más importante después del
          héroe): responde "¿cómo voy?" antes de mostrar el detalle. */}
      <View style={styles.directionCard}>
        <Text style={styles.eyebrowCard}>
          {isPast ? 'Hacia dónde fue ese día' : 'Hacia dónde va tu día'}
        </Text>
        <Text style={styles.direction}>{day.direction}</Text>
        {day.why.length > 0 ? (
          <View style={styles.whyBlock}>
            <Text style={styles.whyEyebrow}>¿Por qué?</Text>
            {day.why.map((w) => (
              <View key={w.key} style={styles.whyRow}>
                <View style={styles.whyMark}>
                  <WhyMark item={w} />
                </View>
                <Text style={[styles.whyLabel, !w.supports && styles.whyLabelAgainst]}>
                  {w.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* LA EVIDENCIA — solo lo que YA apareció hoy, como respaldo del rumbo. La
          primera estrella brilla mayor (jerarquía, no checklist). */}
      {evidenceShown.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>
            {isPast ? 'La evidencia de ese día' : 'La evidencia de hoy'}
          </Text>
          {evidenceShown.map((e, i) => (
            <Animated.View
              key={e.key}
              entering={FadeIn.duration(420).delay(i * 70)}
              style={styles.evidenceRow}
            >
              <View style={styles.evidenceStar}>
                <EvidenceStar color={TONE_COLOR[e.tone]} major={i === 0} />
              </View>
              <Text style={styles.evidenceLabel}>{e.label}</Text>
              {e.detail ? <Text style={styles.evidenceDetail}>{e.detail}</Text> : null}
            </Animated.View>
          ))}
        </View>
      ) : null}

      {/* LO QUE AÚN NO APARECE — ausencia, no error. Cada una un CTA suave. */}
      {day.missing.length > 0 ? (
        <View style={styles.sectionAbsent}>
          <Text style={styles.eyebrowQuiet}>Lo que aún no aparece</Text>
          <Text style={styles.absentHint}>Tócalas para sumarlas a tu día.</Text>
          <View style={styles.absentRow}>
            {day.missing.map((a) => (
              <AbsentChip
                key={a.key}
                label={a.label}
                tone={ABSENT_TONE[a.key] ?? colors.magentaHot}
                onPress={() => onMissingPress(a.key)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Cierre — conecta con Órbita Semana (voz del coach). */}
      <Text style={styles.closing}>{day.closing}</Text>

      {/* Fin del recorrido: volver al inicio sin hacer scroll a mano. */}
      {onScrollTop ? (
        <Pressable
          style={styles.backTop}
          onPress={onScrollTop}
          accessibilityRole="button"
          accessibilityLabel="Volver arriba"
        >
          <Text style={styles.backTopArrow}>↑</Text>
          <Text style={styles.backTopText}>Volver arriba</Text>
        </Pressable>
      ) : null}

      {/* Registro en contexto: agua / ánimo / sueño, sin salir de Órbita. */}
      <DayLogModal signalKey={logKey} date={targetDay} onClose={() => setLogKey(null)} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 6,
  },
  header: {
    marginBottom: 22,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: 30,
    letterSpacing: -1.2,
    lineHeight: 36,
    color: colors.leche,
  },
  date: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  backToToday: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  backToTodayText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
    color: colors.magenta,
  },
  // ── Estados de carga / error / vacío ─────────────────────────────
  card: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  cardTitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 20,
    lineHeight: 27,
    color: colors.leche,
  },
  cardBody: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.niebla,
  },
  retry: {
    marginTop: 14,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.oro,
  },
  // ── Hero (el anillo del objetivo) ────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: 4,
    // Margen para que el bloom del anillo no choque con el estado de abajo.
    paddingBottom: 10,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  // El aura que respira, centrada sobre el anillo (desborda el ringWrap).
  ringGlow: {
    position: 'absolute',
    top: (RING_SIZE - GLOW_SIZE) / 2,
    left: (RING_SIZE - GLOW_SIZE) / 2,
    width: GLOW_SIZE,
    height: GLOW_SIZE,
  },
  ringSvg: {
    transform: [{ rotate: '-90deg' }],
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // El bloque de texto del héroe, bajo el anillo (eyebrow / palabra / número / línea).
  heroText: {
    marginTop: 16,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  heroEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    marginBottom: 6,
  },
  // La palabra-titular ("Déficit") — serif, en leche (registro observacional).
  heroWord: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 27,
    lineHeight: 32,
    color: colors.leche,
    textAlign: 'center',
  },
  heroWordDim: {
    color: colors.niebla,
  },
  // El número del déficit ("−785 kcal") — display, en el color del estado.
  heroNumber: {
    marginTop: 4,
    fontFamily: typography.displayHeavy,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1,
  },
  heroNumberUnit: {
    fontFamily: typography.uiMedium,
    fontSize: 14,
    letterSpacing: 0.3,
    color: colors.bone,
  },
  heroLine: {
    marginTop: 10,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15.5,
    lineHeight: 22,
    color: colors.bone,
    textAlign: 'center',
  },
  // ── Leyenda de anillos ────────────────────────────────────────
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 22,
    marginTop: 18,
  },
  // Cada stat es una columna: [punto + label] arriba, el número debajo.
  legendItem: {
    alignItems: 'center',
    gap: 4,
  },
  legendHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendDotDim: {
    opacity: 0.4,
  },
  legendLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 0.4,
    color: colors.niebla,
  },
  legendLabelDim: {
    color: colors.bruma,
  },
  // El número del día bajo cada label (kcal / g / entreno). Datos = Hanken.
  legendValue: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  legendValueDim: {
    fontFamily: typography.uiMedium,
    color: colors.niebla,
  },
  // ── La evidencia ─────────────────────────────────────────────────
  section: {
    marginTop: 30,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    marginBottom: 14,
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 14,
  },
  evidenceStar: {
    width: 18,
    alignItems: 'center',
  },
  evidenceLabel: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  evidenceDetail: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  // ── Hacia dónde va tu día (dirección + por qué) ──────────────────
  directionCard: {
    marginTop: 30,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: colors.lecheTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  // Eyebrow de la tarjeta de dirección: niebla (no bruma) — es un insight, debe
  // leerse. El bruma queda solo para "Lo que aún no aparece" (secundario).
  eyebrowCard: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  direction: {
    marginTop: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 20,
    lineHeight: 28,
    color: colors.leche,
  },
  whyBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  whyEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    marginBottom: 12,
  },
  whyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 10,
  },
  whyMark: {
    width: 14,
    alignItems: 'center',
  },
  whyAgainst: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.oro,
  },
  whyLabel: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  whyLabelAgainst: {
    color: colors.niebla,
  },
  // ── Lo que aún no aparece (secundaria) ───────────────────────────
  sectionAbsent: {
    marginTop: 30,
  },
  eyebrowQuiet: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.bruma,
  },
  // Microcopy instructivo → Hanken upright (el serif italic se reserva para la
  // voz del coach, no para instrucciones de UI).
  absentHint: {
    marginTop: 6,
    marginBottom: 16,
    fontFamily: typography.uiMedium,
    fontSize: 14,
    color: colors.niebla,
  },
  absentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  // Chip tappable con FONDO que palpita: borde marcado + overflow hidden para
  // que el fondo (absoluto) respete el radio. El pulso vive en absentPulse.
  absentItem: {
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  absentInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  absentItemPressed: {
    opacity: 0.6,
  },
  // Fondo que respira, tintado a la señal (opacidad animada = compositor).
  absentPulse: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
  },
  absentDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  absentLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.leche,
  },
  // ── Cierre ───────────────────────────────────────────────────────
  closing: {
    marginTop: 32,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 25,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  // ── Volver arriba (fin del recorrido) ────────────────────────────
  backTop: {
    marginTop: 36,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  backTopArrow: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.oroSoft,
  },
  backTopText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
