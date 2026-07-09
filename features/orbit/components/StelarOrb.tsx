import { Canvas, Circle, Group, vec } from '@shopify/react-native-skia'
import { useEffect } from 'react'
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { colors } from '@/theme'

/*
 * StelarOrb — la presencia animada de Stelar: una esfera de POLVO ESTELAR
 * (oro arriba, blanco abajo, como el cielo condensado en un punto). Es su
 * "logo vivo": aparece cuando Stelar lee tu mes. Cientos de partículas que
 * titilan y respiran, sobre el negro cósmico.
 *
 * Rendimiento (mismo patrón que SkiaAtmosphere): las partículas se agrupan en
 * BUCKETS; cada bucket titila con UN `useDerivedValue` (no uno por partícula) a
 * una fase distinta → shimmer colectivo barato. Colores ESTÁTICOS (animar
 * colores de gradiente Skia crashea en device · memoria conocida); solo se
 * animan opacidad (titileo) y escala (respiración).
 */

const N = 170
const BUCKETS = 6

type Particle = { x: number; y: number; r: number; color: string; bucket: number }

/** Oro concentrado arriba, blanco abajo — como la referencia. */
function colorFor(y: number): string {
  const gold = [colors.oroLight, colors.oroVect, colors.oro, colors.oroSoft]
  const white = [colors.blanco, colors.leche, colors.blanco]
  const mix = [colors.oroSoft, colors.leche, colors.oroVect, colors.blanco]
  const pool = y < 0.42 ? gold : y > 0.6 ? white : mix
  return pool[Math.floor(Math.random() * pool.length)]!
}

/** Partículas en un disco (proyección de esfera), precomputadas una sola vez. */
const PARTICLES: Particle[] = (() => {
  const out: Particle[] = []
  for (let i = 0; i < N; i++) {
    const ang = Math.random() * Math.PI * 2
    const rad = Math.sqrt(Math.random()) * 0.48 // sqrt → disco uniforme
    const x = 0.5 + Math.cos(ang) * rad
    const y = 0.5 + Math.sin(ang) * rad
    out.push({ x, y, r: 0.35 + Math.random() * 1.5, color: colorFor(y), bucket: i % BUCKETS })
  }
  return out
})()
const BY_BUCKET: Particle[][] = Array.from({ length: BUCKETS }, (_, b) =>
  PARTICLES.filter((p) => p.bucket === b),
)

export function StelarOrb({ size = 150 }: { size?: number }) {
  const t = useSharedValue(0)
  const breathe = useSharedValue(0)

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.linear }), -1, false)
    breathe.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    // Cancela los loops infinitos al desmontar (el orbe se monta/desmonta por
    // cada apertura del detalle): si no, quedan animaciones huérfanas corriendo.
    return () => {
      cancelAnimation(t)
      cancelAnimation(breathe)
    }
  }, [t, breathe])

  // Respiración: escala global sutil alrededor del centro.
  const transform = useDerivedValue(() => [{ scale: 1 + 0.05 * breathe.value }])
  const center = vec(size / 2, size / 2)

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={transform} origin={center}>
        {/* Bloom suave detrás — el aire de la esfera. */}
        <Circle cx={size / 2} cy={size / 2} r={size * 0.46} color={colors.oroBloom} opacity={0.5} />
        {BY_BUCKET.map((particles, b) => (
          <Bucket key={b} t={t} index={b} size={size} particles={particles} />
        ))}
      </Group>
    </Canvas>
  )
}

function Bucket({
  t,
  index,
  size,
  particles,
}: {
  t: SharedValue<number>
  index: number
  size: number
  particles: Particle[]
}) {
  const opacity = useDerivedValue(() => {
    const phase = index / BUCKETS
    return 0.28 + 0.55 * (0.5 + 0.5 * Math.sin((t.value + phase) * Math.PI * 2))
  })
  return (
    <Group opacity={opacity}>
      {particles.map((p, i) => (
        <Circle key={i} cx={p.x * size} cy={p.y * size} r={p.r} color={p.color} />
      ))}
    </Group>
  )
}
