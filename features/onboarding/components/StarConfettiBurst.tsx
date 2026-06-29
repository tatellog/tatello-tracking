import { useState } from 'react'
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  type SharedValue,
} from 'react-native-reanimated'
import { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg'

import { burstHash } from '@/features/tabs/components/constellation/geometry'
import { colors } from '@/theme'

/* ─ Star confetti burst (ONBOARDING ONLY) ──────────────────────────
 *
 * Reemplaza el confeti de rayitas (ParticleBurst) por ESTRELLAS de 4
 * puntas con flare — chicas y grandes — que estallan radialmente en el
 * clímax de la ceremonia "Tu cielo". Es un burst de UNA sola vez,
 * disparado por `pulse` (0→1, ~900 ms ease-out), NO un loop.
 *
 * Drop-in: se monta DENTRO del <Svg> de la constelación, en el MISMO
 * lugar donde hoy vive <ParticleBurst cx cy pulse/>. Devuelve un <G>,
 * sin <Svg> propio.
 *
 * REGLA ANDROID (memoria del repo): la POSICIÓN se anima con los props
 * individuales `x`/`y` del <G> (translate), NUNCA con un `transform`
 * array con rotate. El glifo NO rota: es simétrico de 4 puntas con la
 * punta arriba, así que no necesita rotación. El tamaño es estático por
 * estrella (scale fijo); solo x/y/opacity se animan en el worklet.
 */

const AnimatedG = Animated.createAnimatedComponent(G)

const TAU = Math.PI * 2

/* Glifo · estrella de 4 puntas CÓNCAVA (look "destello/sparkle"),
 * centrada en el ORIGEN (0,0), punta arriba, radio de punta = 12 →
 * diámetro 24 unidades. La cintura cóncava la dan los puntos de control
 * a ±1.5 del centro (afinar 1.0 = más filosa · 2.4 = más Genshin/suave).
 * Centrada en origen (no en 12,12) para escalar/trasladar limpio con los
 * props del <G>. */
const STAR_PATH = 'M0 -12 Q1.5 -1.5 12 0 Q1.5 1.5 0 12 Q-1.5 1.5 -12 0 Q-1.5 -1.5 0 -12 Z'

/* Reparto de matices · las grandes tiran a crema/oro (cuerpo cálido del
 * destello), las chicas a magenta (chispa). Mezcla de la paleta Stelar. */
const HUES_BIG = [colors.oroLight, colors.leche, colors.magentaHot] // #FFE9C2 · #F4ECDE · #FF4886
const HUES_SMALL = [colors.magentaHot, colors.magenta, '#FF8FC0']

export function StarConfettiBurst({
  cx,
  cy,
  size,
  pulse,
  seed = 1,
  count = 22,
}: {
  cx: number
  cy: number
  /** Lado del stage en px — define el reach (qué tan lejos viajan). */
  size: number
  /** SharedValue 0→1; el burst solo existe mientras 0 < pulse < 1. */
  pulse: SharedValue<number>
  /** Semilla determinista (fija en onboarding → estable entre renders). */
  seed?: number
  /** Nº de estrellas (18–28 recomendado). */
  count?: number
}) {
  // Gate de montaje — igual que ParticleBurst: el subárbol solo existe
  // durante la ventana del estallido, así no quedan ~22 worklets zombie
  // evaluándose con pulse=0.
  const [active, setActive] = useState(false)
  useAnimatedReaction(
    () => pulse.value > 0 && pulse.value < 1,
    (isActive, prev) => {
      if (isActive === prev) return
      runOnJS(setActive)(isActive)
    },
    [],
  )
  if (!active) return null

  // Reach base — las estrellas alcanzan ~0.42 del stage (no llegan al
  // borde: el confeti respira dentro del aro/halo, no lo desborda).
  const reachBase = size * 0.42

  return (
    <G>
      <Defs>
        {/* Flare cálido (estrellas grandes crema/oro) — núcleo blanco →
            oro → transparente. El último stop a opacidad 0 hace que el
            halo se DISUELVA en el aire, nunca un disco con borde. */}
        <RadialGradient id="confetti-flare-warm" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
          <Stop offset="32%" stopColor={colors.oroLight} stopOpacity={0.7} />
          <Stop offset="70%" stopColor={colors.oro} stopOpacity={0.22} />
          <Stop offset="100%" stopColor={colors.oro} stopOpacity={0} />
        </RadialGradient>
        {/* Flare magenta (estrellas grandes magenta) — núcleo blanco →
            magentaHot → transparente. */}
        <RadialGradient id="confetti-flare-magenta" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
          <Stop offset="34%" stopColor={colors.magentaHot} stopOpacity={0.6} />
          <Stop offset="72%" stopColor={colors.magenta} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {Array.from({ length: count }).map((_, i) => (
        <ConfettiStar
          key={i}
          index={i}
          count={count}
          seed={seed}
          cx={cx}
          cy={cy}
          reachBase={reachBase}
          pulse={pulse}
        />
      ))}
    </G>
  )
}

/* Una estrella del confeti. Vuela recto por su ángulo radial (ease-out:
 * lanzamiento explosivo, luego freno), parpadea (twinkle) y se apaga.
 * Todo lo determinista (ángulo, reach, tamaño, matiz, fase) se calcula
 * UNA vez en render; el worklet solo mueve x/y y modula opacity. */
function ConfettiStar({
  index,
  count,
  seed,
  cx,
  cy,
  reachBase,
  pulse,
}: {
  index: number
  count: number
  seed: number
  cx: number
  cy: number
  reachBase: number
  pulse: SharedValue<number>
}) {
  const h1 = burstHash(seed, index)
  const h2 = burstHash(seed, index + 13)
  const h3 = burstHash(seed, index + 29)
  const h4 = burstHash(seed, index + 47)

  // Reparto angular uniforme + jitter → anillo orgánico, nunca un círculo
  // estampado.
  const angle = (index / count) * TAU + (h1 - 0.5) * 0.45
  const dirX = Math.cos(angle)
  const dirY = Math.sin(angle)

  // Reach con banda 0.55–1.15× → siluetas distintas, algunas vuelan más.
  const reach = reachBase * (0.55 + h2 * 0.6)

  // ~30% grandes (con flare), ~70% chicas (chispa).
  const big = h3 > 0.7
  // Tamaño tip-a-tip en px: grandes 12–18, chicas 5–9.
  const px = big ? 12 + h4 * 6 : 5 + h4 * 4
  // El glifo está en unidades de diámetro 24 → escala = px/24.
  const scale = px / 24

  const hue = big
    ? (HUES_BIG[Math.floor(h1 * HUES_BIG.length)] ?? colors.oroLight)
    : (HUES_SMALL[Math.floor(h1 * HUES_SMALL.length)] ?? colors.magentaHot)

  // El halo de las grandes hereda el matiz (cálido vs magenta).
  const warm = big && hue !== colors.magentaHot
  const flareId = warm ? 'confetti-flare-warm' : 'confetti-flare-magenta'

  // Gravedad sutil — las grandes "caen" un pelo al final (confeti), las
  // chicas casi nada.
  const gravity = big ? 16 : 5
  // Stagger de nacimiento — no estallan todas en el mismo frame.
  const delay = h4 * 0.1
  const twinklePhase = h2 * TAU

  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = pulse.value
    if (u <= 0 || u >= 1) {
      // Aparcadas fuera del lienzo + invisibles fuera de la ventana.
      return { x: -200, y: -200, opacity: 0 }
    }
    const tt = Math.max(0, Math.min(1, (u - delay) / (1 - delay)))
    // ease-out radial (lanzamiento → arrastre).
    const te = 1 - (1 - tt) * (1 - tt)
    const x = cx + dirX * reach * te
    const y = cy + dirY * reach * te + gravity * tt * tt
    // fade-in rápido, fade-out largo.
    const fade = tt < 0.1 ? tt / 0.1 : Math.pow(1 - (tt - 0.1) / 0.9, 1.3)
    const twinkle = 0.72 + 0.28 * Math.sin(u * 52 + twinklePhase)
    return { x, y, opacity: Math.max(0, fade) * twinkle }
  })

  return (
    <AnimatedG scale={scale} animatedProps={animatedProps}>
      {/* Flare radial detrás (solo grandes) — diámetro ~1.8× la estrella
          (r=22 unidades vs punta=12). Se disuelve en transparente. */}
      {big ? <Circle cx={0} cy={0} r={22} fill={`url(#${flareId})`} /> : null}
      {/* El glifo de 4 puntas cóncavo. */}
      <Path d={STAR_PATH} fill={hue} />
      {/* Núcleo blanco caliente (solo grandes) — el "destello" puntual. */}
      {big ? <Circle cx={0} cy={0} r={3} fill="#FFFFFF" opacity={0.9} /> : null}
    </AnimatedG>
  )
}

export default StarConfettiBurst
