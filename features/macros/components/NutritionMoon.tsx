import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  RadialGradient as SkiaRadialGradient,
  vec,
} from '@shopify/react-native-skia'
import { useEffect, useState } from 'react'
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import Svg, {
  Circle as SvgCircle,
  Defs as SvgDefs,
  Ellipse as SvgEllipse,
  G as SvgG,
  Path as SvgPath,
  RadialGradient as SvgRadialGradient,
  Stop as SvgStop,
} from 'react-native-svg'

import { subscribeMealLogged } from '../meal-logged-bus'
import { moonIllumination, moonProgressCopy } from '../moonPhase'
import { useScreenActive } from '@/features/orbit/useScreenActive'
import { colors, typography } from '@/theme'

const MOON_PHASES = [
  require('@/assets/meals/moon-phase-0.png'),
  require('@/assets/meals/moon-phase-1.png'),
  require('@/assets/meals/moon-phase-2.png'),
  require('@/assets/meals/moon-phase-3.png'),
  require('@/assets/meals/moon-phase-4.png'),
]
const PHASE_MAX = MOON_PHASES.length - 1

const HERO_H = 210
// El cielo de la luna (nebulosa + halos con blur) es más grande que el hero:
// su Canvas SANGRA arriba y abajo para que los círculos se desvanezcan solos.
// Antes el hero recortaba con overflow:hidden y el corte se leía como un
// rectángulo oscuro (dirección de arte sep 2026).
const SKY_BLEED = 90
const GUTTER = 20
const R_MOON = 67 // tamaño original
const MOON_BOX = Math.round((R_MOON * 2) / 0.78) // disc fills ~78% of the PNG

// Aros orbitales REDONDOS alrededor de la luna (círculos concéntricos, no una
// elipse plana "de lado"). rx ≈ ry y ambos > R_MOON, así rodean la luna como
// halos (no la cruzan), quedan visibles completos y leen "normales".
// Dos aros REDONDOS, juntos entre sí (outer 1.13). Concéntricos con la luna
// (justificada a la derecha), así se extienden hacia la izquierda hasta donde
// termina la barra de proteína.
const RING_RX = R_MOON * 1.34
const RING_RY = R_MOON * 1.34
const RING_ROT = -4
// Los aros se corren a la IZQUIERDA respecto a la luna (la luna queda al lado
// derecho del sistema orbital, no en su centro).
const RING_OFFSET = R_MOON * 0.18
// Distancia de la luna al borde derecho. Más alto = luna más a la izquierda.
const MOON_RIGHT_INSET = 32
const TAU = Math.PI * 2
const FILL_EASE = Easing.bezier(0.2, 0.7, 0.2, 1)

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/*
 * ── Why this is split into Sky (Skia) + Moon (RN images) ──
 * A surgical diagnostic proved BOTH a reanimated <Animated.View> AND a
 * SELF-CONTAINED Skia <Canvas> (no images) animate fine in Comidas. The
 * frozen hero was caused by Skia `useImage` (5 async decodes) re-rendering
 * the Canvas-owning tree and tearing down the reanimated→Skia subscription.
 * So: the animated atmosphere is a self-contained Skia Canvas with NO images
 * (it owns its own shared values + loop + derived values, the proven shape),
 * and the moon is plain RN <Image>s crossfaded by reanimated opacity — no
 * Skia image loading anywhere.
 */

// ── Atmosphere — self-contained Skia (own loop, no images) ──
function Sky({
  W,
  cx,
  cy,
  p,
  reduced,
}: {
  W: number
  cx: number
  cy: number
  p: SharedValue<number>
  reduced: boolean
}) {
  const screenActive = useScreenActive()
  const breath = useSharedValue(0)
  const drift = useSharedValue(0)
  useEffect(() => {
    if (!screenActive) return // pause the loops off-tab (battery)
    breath.value = withRepeat(withTiming(1, { duration: 3800, easing: Easing.linear }), -1, false)
    drift.value = withRepeat(withTiming(1, { duration: 26000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(breath)
      cancelAnimation(drift)
    }
  }, [screenActive, breath, drift])

  const Am = reduced ? 0 : 1
  // The sky WARMS with the moon: glow + gold halo bloom as protein climbs.
  // Manifesto-safe reward — the cielo gets warmer/golden when you fill the
  // moon, never a "100%!" badge. Low protein = a quieter, cooler sky.
  const glowO = useDerivedValue(() => {
    // Piso alto (0.7) para que el bloom rosa SE VEA aun con poca proteína
    // (la referencia "apenas despierta" igual brilla rosa); sube un poco más al
    // llenar la luna.
    const w = 0.7 + 0.3 * (p.value / PHASE_MAX)
    return (0.18 + 0.14 * (0.5 + 0.5 * Math.sin(breath.value * TAU))) * w
  })
  const haloO = useDerivedValue(() => {
    const w = 0.28 + 0.72 * (p.value / PHASE_MAX)
    return (0.12 + 0.24 * (0.5 + 0.5 * Math.sin(breath.value * TAU + 2))) * w
  })
  const nebTransform = useDerivedValue(() => [
    { translateX: Math.sin(drift.value * TAU) * 9 * Am },
    { translateY: Math.cos(drift.value * TAU) * 6 * Am },
  ])

  return (
    <Canvas
      style={{
        position: 'absolute',
        left: 0,
        top: -SKY_BLEED,
        width: W,
        height: HERO_H + 2 * SKY_BLEED,
      }}
      pointerEvents="none"
    >
      {/* Sin Fill ni rects de viñeta/fade: solo círculos con BlurMask, que se
          desvanecen solos sobre el SkyBackground de la pantalla. */}

      {/* Nebula — wide soft magenta field, slow drift. */}
      <Group transform={nebTransform}>
        <Circle cx={cx - R_MOON * 0.1} cy={cy} r={R_MOON * 1.75}>
          <SkiaRadialGradient
            c={vec(cx - R_MOON * 0.1, cy)}
            r={R_MOON * 1.75}
            colors={[rgba('#D1547A', 0.32), rgba(colors.magenta, 0.1), rgba(colors.magenta, 0)]}
            positions={[0, 0.5, 1]}
          />
          <BlurMask blur={28} style="normal" />
        </Circle>
      </Group>

      {/* Additive bloom — the breathing magenta glow + a small warm core at
          the lit limb, where the moon's light spills onto the nebula.
          blendMode "plus" = light SUMS (physically right, reads premium). */}
      <Group blendMode="plus">
        <Group opacity={glowO}>
          <Circle cx={cx - R_MOON * 0.18} cy={cy} r={R_MOON * 1.15}>
            <SkiaRadialGradient
              c={vec(cx - R_MOON * 0.18, cy)}
              r={R_MOON * 1.15}
              colors={[
                rgba(colors.magentaHot, 0.95),
                rgba(colors.magenta, 0.32),
                rgba(colors.magenta, 0),
              ]}
              positions={[0, 0.5, 1]}
            />
            <BlurMask blur={22} style="normal" />
          </Circle>
        </Group>
        <Circle cx={cx - R_MOON * 0.32} cy={cy - R_MOON * 0.2} r={R_MOON * 0.9}>
          <SkiaRadialGradient
            c={vec(cx - R_MOON * 0.32, cy - R_MOON * 0.2)}
            r={R_MOON * 0.9}
            colors={[rgba('#C7D2E8', 0.22), rgba(colors.magentaHot, 0.12), rgba(colors.magenta, 0)]}
            positions={[0, 0.5, 1]}
          />
          <BlurMask blur={18} style="normal" />
        </Circle>
      </Group>

      {/* Warm gold halo — breathes out of phase, blooms with the phase. */}
      <Group opacity={haloO}>
        <Circle cx={cx} cy={cy} r={R_MOON * 1.3}>
          <SkiaRadialGradient
            c={vec(cx, cy)}
            r={R_MOON * 1.3}
            colors={[
              rgba(colors.oroLight, 0.55),
              rgba(colors.magenta, 0.28),
              rgba(colors.magenta, 0),
            ]}
            positions={[0, 0.55, 1]}
          />
          <BlurMask blur={16} style="normal" />
        </Circle>
      </Group>
    </Canvas>
  )
}

// ── One phase image — RN, reanimated opacity (tent crossfade) ──
function PhaseImg({
  src,
  index,
  p,
  dim,
}: {
  src: number
  index: number
  p: SharedValue<number>
  dim: boolean
}) {
  const style = useAnimatedStyle(
    () => ({ opacity: Math.max(0, 1 - Math.abs(p.value - index)) * (dim ? 0.92 : 1) }),
    [dim],
  )
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Image source={src} resizeMode="contain" style={styles.moonImg} />
    </Animated.View>
  )
}

// ── The moon — RN images, mirrored + breathing (all reanimated) ──
function Moon({
  left,
  top,
  p,
  moonDim,
  reduced,
}: {
  left: number
  top: number
  p: SharedValue<number>
  moonDim: boolean
  reduced: boolean
}) {
  const screenActive = useScreenActive()
  const s = useSharedValue(0)
  useEffect(() => {
    if (reduced || !screenActive) return
    s.value = withRepeat(
      withTiming(1, { duration: 4500, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(s)
  }, [reduced, screenActive, s])
  const wrapStyle = useAnimatedStyle(
    () => ({ transform: [{ scaleX: -1 }, { scale: 1 + (moonDim ? 0.008 : 0.018) * s.value }] }),
    [moonDim],
  )
  return (
    <Animated.View
      style={[{ position: 'absolute', left, top, width: MOON_BOX, height: MOON_BOX }, wrapStyle]}
      pointerEvents="none"
    >
      {MOON_PHASES.map((src, i) => (
        <PhaseImg key={i} src={src} index={i} p={p} dim={moonDim} />
      ))}

      {/* Stylize the photoreal PNG toward Stelar: a wine wash so the disc
          shares the nebula's light, a faint bg knock-down to calm the bright
          amber, and a feathered limb that dissolves into the atmosphere
          instead of a hard photographic edge. Static SVG (no animation) —
          safe; only Skia useImage broke the canvas, not declarative SVG. */}
      <Svg width={MOON_BOX} height={MOON_BOX} style={StyleSheet.absoluteFill} pointerEvents="none">
        <SvgDefs>
          {/* Feather confined to the DISC (r = R_MOON): transparent core →
              soft bg darkening only at the outer rim, so the photographic
              edge melts into shadow. No ring beyond the disc. */}
          <SvgRadialGradient id="nm-moon-feather" cx="50%" cy="50%" r="50%">
            <SvgStop offset="0.6" stopColor={colors.bg} stopOpacity={0} />
            <SvgStop offset="0.88" stopColor={colors.bg} stopOpacity={0.22} />
            <SvgStop offset="1" stopColor={colors.bg} stopOpacity={0.55} />
          </SvgRadialGradient>
          {/* Enfría el sepia de la foto: lavado plata-azul, más frío al centro
              y soltándose al borde (para no aplanar la textura). Es lo que
              neutraliza el ámbar/marrón sin tocar el asset. */}
          <SvgRadialGradient id="nm-moon-cool" cx="42%" cy="40%" r="62%">
            <SvgStop offset="0" stopColor="#C7D2E8" stopOpacity={0.42} />
            <SvgStop offset="0.6" stopColor="#9FB0D8" stopOpacity={0.3} />
            <SvgStop offset="1" stopColor="#6F7BA8" stopOpacity={0.2} />
          </SvgRadialGradient>
        </SvgDefs>
        {/* 1) baja la saturación del ocre con el negro warm del fondo */}
        <SvgCircle cx={MOON_BOX / 2} cy={MOON_BOX / 2} r={R_MOON} fill={rgba(colors.bg, 0.28)} />
        {/* 2) lavado frío plata-azul — el que mata el amarillo */}
        <SvgCircle cx={MOON_BOX / 2} cy={MOON_BOX / 2} r={R_MOON} fill="url(#nm-moon-cool)" />
        {/* 3) beso magenta de marca, muy tenue (sobre disco ya frío lee malva, no barro) */}
        <SvgCircle
          cx={MOON_BOX / 2}
          cy={MOON_BOX / 2}
          r={R_MOON}
          fill={rgba(colors.magenta, 0.1)}
        />
        {/* 4) feather del borde hacia la atmósfera */}
        <SvgCircle cx={MOON_BOX / 2} cy={MOON_BOX / 2} r={R_MOON} fill="url(#nm-moon-feather)" />
      </Svg>
    </Animated.View>
  )
}

// ── §6 · partículas que viajan hacia la luna al registrar una comida ──
// Posiciones de salida deterministas (no random → estables entre renders);
// nacen cerca del readout (izquierda) y suben en arco hacia la luna.
const PARTICLES = Array.from({ length: 7 }, (_, i) => ({
  dx: Math.sin(i * 1.7) * 24,
  dy: Math.cos(i * 2.3) * 16,
  delay: i * 0.05,
  arc: (i % 2 === 0 ? -1 : 1) * (16 + (i % 3) * 9),
}))

function Particle({
  t,
  sx,
  sy,
  tx,
  ty,
  off,
}: {
  t: SharedValue<number>
  sx: number
  sy: number
  tx: number
  ty: number
  off: (typeof PARTICLES)[number]
}) {
  const style = useAnimatedStyle(() => {
    const local = Math.max(0, Math.min(1, (t.value - off.delay) / (1 - off.delay)))
    const dx = (tx - sx) * local + off.arc * Math.sin(local * Math.PI)
    const dy = (ty - sy) * local - 26 * Math.sin(local * Math.PI)
    return {
      opacity: Math.sin(local * Math.PI),
      transform: [{ translateX: dx }, { translateY: dy }, { scale: 1 - 0.45 * local }],
    }
  })
  return (
    <Animated.View style={[styles.particle, { left: sx, top: sy }, style]} pointerEvents="none" />
  )
}

function MoonParticles({
  targetX,
  targetY,
  trigger,
  reduced,
}: {
  targetX: number
  targetY: number
  trigger: number
  reduced: boolean
}) {
  const t = useSharedValue(0)
  useEffect(() => {
    if (trigger === 0 || reduced) return
    t.value = 0
    t.value = withTiming(1, { duration: 1150, easing: Easing.out(Easing.cubic) })
    return () => cancelAnimation(t)
  }, [trigger, reduced, t])

  if (trigger === 0) return null
  const sx = GUTTER + 26
  const sy = HERO_H * 0.5
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {PARTICLES.map((off, i) => (
        <Particle
          key={i}
          t={t}
          sx={sx + off.dx}
          sy={sy + off.dy}
          tx={targetX}
          ty={targetY}
          off={off}
        />
      ))}
    </View>
  )
}

type Props = {
  proteinValue: number
  proteinTarget?: number
  /** Calorías del día — ya no se muestran en el hero (el peso visual lo lleva
   *  la proteína y la luna); se conserva por compatibilidad de la firma. */
  caloriesValue?: number
  isLoading?: boolean
}

/*
 * Tu Cielo Nutricional — the day's protein as a growing moon, compact
 * full-bleed hero. Atmosphere (Skia, self-contained) breathes behind a real
 * moon (RN phase images crossfaded by protein, mirrored so the lit limb faces
 * the readout). Non-stellar depth only. Reaching/passing the reference is a
 * full moon — celebrated, never "te pasaste". Calorías = quiet fact.
 */
const RING_GOLD = colors.oroLight

/* Estrella de 4 puntas (sparkle ✦) como path SVG, centrada en (x,y), radio s.
 * Lados cóncavos → lee como destello, no como diamante. */
function starPath(x: number, y: number, s: number): string {
  const t = s * 0.26 // cintura (qué tan cóncavos los lados)
  return [
    `M ${x} ${y - s}`,
    `C ${x} ${y - t} ${x + t} ${y} ${x + s} ${y}`,
    `C ${x + t} ${y} ${x} ${y + t} ${x} ${y + s}`,
    `C ${x} ${y + t} ${x - t} ${y} ${x - s} ${y}`,
    `C ${x - t} ${y} ${x} ${y - t} ${x} ${y - s}`,
    'Z',
  ].join(' ')
}

/* Dos aros: el INTERIOR sólido, el EXTERIOR difuminado/punteado (dashed +
 * tenue), con puntitos y estrellas dorados repartidos. */
function OrbitRing({ W, cx, cy }: { W: number; cx: number; cy: number }) {
  // Posición sobre un aro (escala sx) en su ángulo a.
  const at = (a: number, sx: number) => ({
    x: cx + RING_RX * sx * Math.cos(a),
    y: cy + RING_RY * sx * Math.sin(a),
  })
  // Estrellas ✦ (ángulo, escala radial, tamaño, alpha).
  // Menos es más (dirección de arte sep 2026): tres chispas y el aro; sin
  // anillo punteado ni puntitos, que competían con los astros de abajo.
  const stars = [
    { a: 2.55, sx: 1.0, s: 4.2, o: 0.9 },
    { a: 4.55, sx: 1.0, s: 3.6, o: 0.8 },
    { a: 5.6, sx: 1.0, s: 3.0, o: 0.7 },
  ]
  return (
    <Svg width={W} height={HERO_H} style={StyleSheet.absoluteFill} pointerEvents="none">
      <SvgG transform={`rotate(${RING_ROT} ${cx} ${cy})`}>
        {/* Interior — sólido. */}
        <SvgEllipse
          cx={cx}
          cy={cy}
          rx={RING_RX}
          ry={RING_RY}
          stroke={rgba(RING_GOLD, 0.42)}
          strokeWidth={1.1}
          fill="none"
        />
        {stars.map((sp, i) => {
          const c = at(sp.a, sp.sx)
          return (
            <SvgPath key={`sp${i}`} d={starPath(c.x, c.y, sp.s)} fill={rgba(RING_GOLD, sp.o)} />
          )
        })}
      </SvgG>
    </Svg>
  )
}

export function NutritionMoon({ proteinValue, proteinTarget, isLoading = false }: Props) {
  const { width: W } = useWindowDimensions()
  const reduced = useReducedMotion() ?? false

  const reference = proteinTarget != null && proteinTarget > 0 ? Math.round(proteinTarget) : null
  const illumination = moonIllumination(proteinValue, reference)
  const ambient = illumination == null
  const moonDim = isLoading || ambient
  // Copy honesto: frase de fase + cuánto falta (gramos). El usuario pidió saber
  // CÓMO VA, no una frase vaga.
  const copy = moonProgressCopy(proteinValue, reference)

  // Luna justificada a la derecha (14px del borde). Los aros, concéntricos, se
  // extienden hacia la izquierda; su mitad derecha cae fuera (la luna está al
  // borde), lo cual es intencional.
  const cx = W - R_MOON - MOON_RIGHT_INSET
  const cy = HERO_H * 0.5

  // §6 · al registrar una comida en Comidas, la luna celebra (partículas).
  const [logTrigger, setLogTrigger] = useState(0)
  useEffect(() => subscribeMealLogged(() => setLogTrigger((n) => n + 1)), [])

  const phaseTarget = moonDim ? PHASE_MAX : Math.max(0, Math.min(1, illumination ?? 1)) * PHASE_MAX
  const p = useSharedValue(phaseTarget)
  useEffect(() => {
    if (reduced) p.value = phaseTarget
    else p.value = withTiming(phaseTarget, { duration: 1000, easing: FILL_EASE })
    return () => cancelAnimation(p)
  }, [p, phaseTarget, reduced])

  // ── Hero COMPACTO en estado 0 (patrón del colapso post-ritual de Hoy):
  // con 0 g, la luna gigante gastaba el primer screenful para decir "aún
  // nada". El compacto conserva número, copy y una luna dormida pequeña;
  // el hero pleno regresa con la primera comida. (Todos los hooks corren
  // arriba: el early-return no altera su orden entre renders.)
  if (!isLoading && Math.round(proteinValue) <= 0) {
    return (
      <View style={styles.heroCompact}>
        <View style={styles.compactText}>
          <Text style={styles.eyebrow}>Proteína de hoy</Text>
          <View
            style={styles.readout}
            accessibilityRole="text"
            accessibilityLabel={
              reference != null
                ? `0 de ${reference} gramos de proteína`
                : '0 gramos de proteína registrados'
            }
          >
            <Text style={styles.compactValue}>0</Text>
            {reference != null ? (
              <Text style={styles.reference}> / {reference} g</Text>
            ) : (
              <Text style={styles.reference}> g</Text>
            )}
          </View>
          {copy.phrase ? <Text style={styles.coach}>{copy.phrase}</Text> : null}
        </View>
        {/* Luna dormida — glifo estático pequeño, sin cielo Skia. */}
        <Svg width={52} height={52} viewBox="0 0 52 52" pointerEvents="none">
          <SvgCircle cx={26} cy={26} r={24} stroke={colors.hairline} strokeWidth={1} fill="none" />
          <SvgCircle cx={26} cy={26} r={16} fill={colors.bgCard2} />
        </Svg>
      </View>
    )
  }

  return (
    <View style={styles.hero}>
      <Sky W={W} cx={cx} cy={cy + SKY_BLEED} p={p} reduced={reduced} />
      {/* Aros corridos a la izquierda (centro = cx - RING_OFFSET); la luna queda
          a la derecha del sistema orbital. */}
      <OrbitRing W={W} cx={cx - RING_OFFSET} cy={cy} />
      <Moon
        left={cx - MOON_BOX / 2}
        top={cy - MOON_BOX / 2}
        p={p}
        moonDim={moonDim}
        reduced={reduced}
      />
      <MoonParticles targetX={cx} targetY={cy} trigger={logTrigger} reduced={reduced} />

      {/* ── Content (text), left column over the sky ── */}
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Proteína de hoy</Text>

        {isLoading ? (
          <>
            <Text style={styles.value}>·</Text>
            <Text style={styles.coach}>Reuniendo tu día…</Text>
          </>
        ) : (
          <>
            <View
              style={styles.readout}
              accessibilityRole="text"
              accessibilityLabel={
                reference != null
                  ? `${Math.round(proteinValue)} de ${reference} gramos de proteína`
                  : `${Math.round(proteinValue)} gramos de proteína registrados`
              }
            >
              <Text style={styles.value}>{Math.round(proteinValue)}</Text>
              {reference != null ? (
                <Text style={styles.reference}> / {reference} g</Text>
              ) : (
                <Text style={styles.reference}> g registrados</Text>
              )}
            </View>
            {/* Una sola línea (dirección de arte sep 2026): el faltante
                honesto, o la luna llena. La luna ES el medidor (sin barra). */}
            {copy.honest ? <Text style={styles.honest}>{copy.honest}</Text> : null}
            {copy.phrase ? <Text style={styles.coach}>{copy.phrase}</Text> : null}
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: {
    height: HERO_H,
    marginHorizontal: -GUTTER,
    marginTop: 4,
    marginBottom: 8,
  },
  // Estado 0: media altura, sin cielo Skia — el screenful se lo ganan los
  // Momentos y los Aliados (lo accionable) hasta que la luna tenga qué contar.
  heroCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 14,
  },
  compactText: {
    flex: 1,
  },
  compactValue: {
    fontFamily: typography.displayHeavy,
    fontSize: 32,
    color: colors.leche,
    letterSpacing: -1,
    lineHeight: 34,
  },
  moonImg: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: GUTTER,
    paddingRight: R_MOON * 2 + 8,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.niebla,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontFamily: typography.displayHeavy,
    fontSize: 46,
    color: colors.leche,
    letterSpacing: -1.6,
    lineHeight: 48,
  },
  reference: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.heading,
    color: colors.bone,
  },
  // Frase de fase — voz del coach (serif italic).
  coach: {
    marginTop: 12,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 18,
    color: colors.leche,
  },
  // Línea honesta — el dato claro (cuánto falta). UI upright, callada pero
  // legible: el usuario quiere saber cómo va, sin que grite.
  honest: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
    color: colors.bone,
  },
  // Partícula que viaja a la luna al registrar — punto cálido con glow.
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.oroLight,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 4,
  },
})
