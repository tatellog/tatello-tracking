import { useMemo } from 'react'
import {
  BlurMask,
  Canvas,
  Circle as SkiaCircle,
  Group as SkiaGroup,
  Path as SkiaPath,
  Rect as SkiaRect,
  Skia,
  vec,
} from '@shopify/react-native-skia'
import {
  Extrapolation,
  interpolate,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated'

import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry'
import { colors } from '@/theme'

/*
 * PatternRevealLifeLine — la "línea de vida" del modal de revelación (Skia).
 *
 * Metáfora (no gráfica literal): un mal día se siente ENCERRADO en un cuadro
 * chico; al abrir el contexto, se ve que era una parte mínima de una trayectoria
 * más grande que sigue subiendo. La cámara arranca cerrada sobre el rectángulo
 * (solo se ve la CAÍDA), un astro recorre la línea hacia abajo; al llegar a la
 * mitad la cámara hace ZOOM OUT y se revela la línea exterior (que sigue a la
 * derecha y arriba); el astro la recorre hasta la esquina superior derecha
 * (recuperación). Minimalista: líneas blancas, fondo negro, glow muy sutil.
 *
 * Todo lo maneja UN `progress` (SharedValue 0→1) que anima quien monta. Skia lee
 * `progress` vía useDerivedValue. En reduce-motion, quien monta pasa progress=1
 * (estado final: trayectoria completa, astro arriba) sin animar.
 *
 * Coordenadas de MUNDO (viewBox conceptual 1000×600); el <Group> las mapea a
 * pantalla con el zoom. Grid, rectángulo y línea viven en el mundo (zoomean
 * juntos); el astro se dibuja en coords de PANTALLA (tamaño constante + glow).
 */

// El path ATRAVIESA el cuadro: ENTRA por la izquierda (contexto, de dónde venías),
// la CAÍDA queda DENTRO del cuadro, y SALE por la derecha subiendo (recuperación,
// sube · bache · remonta a la esquina superior derecha). El cuadro está en el
// CENTRO del path completo → al abrir queda centrado con línea a AMBOS lados.
const PATH_D =
  'M110,190 L250,255 L390,330 L470,440 L560,370 L645,330 L740,260 L830,310 L900,190 L945,120'

// El cuadro wireframe ("el mal día") — CENTRADO en el path (la caída vive dentro).
const RECT = { x: 405, y: 220, w: 240, h: 250 }

// Focos y escalas del zoom (fit-to-screen se resuelve con el ancho real).
const RECT_CENTER = { x: RECT.x + RECT.w / 2, y: RECT.y + RECT.h / 2 } // ≈ (525, 345)
// El foco es SIEMPRE el centro del cuadro = centro del path → el cuadro se queda
// FIJO EN EL CENTRO de la pantalla; el zoom-out solo se aleja y revela la línea a
// AMBOS lados (entra por la izquierda, sale por la derecha). Nunca se va a un lado.
const FULL_CENTER = { x: RECT_CENTER.x, y: RECT_CENTER.y }
const RECT_SPAN = RECT.w // 240 — solo el cuadro llena la pantalla al inicio
// Ancho de TODO el path al alejarse (para que quepa centrado, con línea a los lados).
const FULL_SPAN = 840

const CLAMP = Extrapolation.CLAMP
const N = 220 // muestras del path para posicionar el astro

// Estrella de 4 puntas ELONGADA para el flare: puntas largas y delgadas (cintura
// chica) → rayos largos, no un asterisco gordo. v = largo vertical, h = horizontal.
function flareStarPath(v: number, h: number, inner: number): string {
  const p: [number, number][] = [
    [0, -v],
    [inner, -inner],
    [h, 0],
    [inner, inner],
    [0, v],
    [-inner, inner],
    [-h, 0],
    [-inner, -inner],
  ]
  return `M${p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`
}

export function PatternRevealLifeLine({
  width,
  height,
  progress,
}: {
  width: number
  height: number
  progress: SharedValue<number>
}) {
  // Path de la línea + grid, construidos una vez (Skia ya está listo aquí).
  const linePath = useMemo(() => Skia.Path.MakeFromSVGString(PATH_D), [])
  const gridPath = useMemo(() => {
    const p = Skia.Path.Make()
    for (let x = 0; x <= 1000; x += 80) {
      p.moveTo(x, 0)
      p.lineTo(x, 600)
    }
    for (let y = 0; y <= 600; y += 80) {
      p.moveTo(0, y)
      p.lineTo(1000, y)
    }
    return p
  }, [])

  // Muestras (x,y) a lo largo de la línea → el astro interpola entre ellas.
  const pts = useMemo<{ x: number; y: number }[]>(() => {
    if (!linePath) return []
    const it = Skia.ContourMeasureIter(linePath, false, 1)
    const contour = it.next()
    if (!contour) return []
    const len = contour.length()
    const out: { x: number; y: number }[] = []
    for (let i = 0; i <= N; i++) {
      const [pos] = contour.getPosTan((len * i) / N)
      out.push({ x: pos.x, y: pos.y })
    }
    return out
  }, [linePath])

  // El astro NO recorre el tramo de CONTEXTO de la izquierda: arranca donde el
  // path ENTRA al cuadro → en el zoom-in ya está adentro haciendo la caída.
  const astroStartFrac = useMemo(() => {
    const idx = pts.findIndex((p) => p.x >= RECT.x)
    return idx <= 0 ? 0 : idx / (pts.length - 1)
  }, [pts])

  // El astro = estrella de 4 puntas (firma Stelar) + flare. Paths centrados en el
  // origen; se posicionan con el translate del Group al punto del astro.
  const starCore = useMemo(() => Skia.Path.MakeFromSVGString(fourPointStarPath(0, 0, 12)), [])
  // Flare de rayos LARGOS: vertical más largo que el horizontal (look lens-flare).
  const starFlare = useMemo(() => Skia.Path.MakeFromSVGString(flareStarPath(96, 54, 5)), [])

  const cx = width / 2
  const cy = height / 2

  // Cámara (escala + offset) derivada del progress. El zoom-out ocurre 0.42→0.64.
  // screen = (a + s·worldX, b + s·worldY), con a,b para centrar el foco.
  const cam = useDerivedValue(() => {
    const s1 = (0.72 * width) / RECT_SPAN
    const s2 = (0.9 * width) / FULL_SPAN // se aleja para que quepa TODO el path, centrado
    const z = interpolate(progress.value, [0.42, 0.64], [0, 1], CLAMP)
    const s = interpolate(z, [0, 1], [s1, s2])
    const fx = interpolate(z, [0, 1], [RECT_CENTER.x, FULL_CENTER.x])
    const fy = interpolate(z, [0, 1], [RECT_CENTER.y, FULL_CENTER.y])
    return { s, a: cx - s * fx, b: cy - s * fy }
  })

  const transform = useDerivedValue(() => {
    const { a, b, s } = cam.value
    return [{ translateX: a }, { translateY: b }, { scale: s }]
  })

  // La línea se traza progresivamente. Traza rápido hasta la entrada del cuadro
  // (el tramo de contexto, casi fuera de pantalla), y de ahí en adelante apenas
  // por delante del astro.
  const drawEnd = useDerivedValue(() =>
    interpolate(progress.value, [0.02, 0.2, 0.9], [0.04, astroStartFrac + 0.03, 1], CLAMP),
  )

  // El rectángulo wireframe: nítido al inicio, se atenúa (no desaparece) al abrir.
  const rectOpacity = useDerivedValue(() =>
    interpolate(progress.value, [0, 0.1, 0.5, 1], [0, 0.5, 0.5, 0.22], CLAMP),
  )
  const gridOpacity = useDerivedValue(() =>
    interpolate(progress.value, [0, 0.15, 1], [0, 0.06, 0.05], CLAMP),
  )

  // El astro en coords de PANTALLA (tamaño constante). Aparece al terminar la
  // primera caída (~0.24) y recorre hasta el final.
  const astro = useDerivedValue(() => {
    if (pts.length === 0) return vec(-100, -100)
    const t = interpolate(progress.value, [0.24, 0.98], [astroStartFrac, 1], CLAMP)
    const f = t * (pts.length - 1)
    const i0 = Math.floor(f)
    const i1 = Math.min(i0 + 1, pts.length - 1)
    const k = f - i0
    const wx = pts[i0]!.x + (pts[i1]!.x - pts[i0]!.x) * k
    const wy = pts[i0]!.y + (pts[i1]!.y - pts[i0]!.y) * k
    const { a, b, s } = cam.value
    return vec(a + s * wx, b + s * wy)
  })
  const astroOpacity = useDerivedValue(() =>
    interpolate(progress.value, [0.18, 0.26], [0, 1], CLAMP),
  )
  // Posiciona la estrella (paths en el origen) en el punto de pantalla del astro.
  const astroTransform = useDerivedValue(() => [
    { translateX: astro.value.x },
    { translateY: astro.value.y },
  ])
  const flareOpacity = useDerivedValue(() => astroOpacity.value * 0.6)
  const haloOpacity = useDerivedValue(() => astroOpacity.value * 0.32)

  return (
    <Canvas style={{ width, height }}>
      <SkiaGroup transform={transform}>
        <SkiaPath
          path={gridPath}
          style="stroke"
          strokeWidth={1}
          color={colors.leche}
          opacity={gridOpacity}
        />
        <SkiaRect
          x={RECT.x}
          y={RECT.y}
          width={RECT.w}
          height={RECT.h}
          style="stroke"
          strokeWidth={1.2}
          color={colors.leche}
          opacity={rectOpacity}
        />
        {linePath ? (
          <SkiaPath
            path={linePath}
            style="stroke"
            strokeWidth={2.4}
            strokeCap="round"
            strokeJoin="round"
            color={colors.leche}
            start={0}
            end={drawEnd}
          >
            <BlurMask blur={2} style="solid" />
          </SkiaPath>
        ) : null}
      </SkiaGroup>

      {/* El astro: estrella de 4 puntas con flare (halo redondo + destello de
          puntas difuso + núcleo nítido). */}
      <SkiaCircle c={astro} r={15} color={colors.leche} opacity={haloOpacity}>
        <BlurMask blur={16} style="normal" />
      </SkiaCircle>
      <SkiaGroup transform={astroTransform}>
        {starFlare ? (
          <SkiaPath path={starFlare} color={colors.leche} opacity={flareOpacity}>
            <BlurMask blur={4} style="normal" />
          </SkiaPath>
        ) : null}
        {starCore ? (
          <SkiaPath path={starCore} color={colors.leche} opacity={astroOpacity}>
            <BlurMask blur={1} style="solid" />
          </SkiaPath>
        ) : null}
      </SkiaGroup>
    </Canvas>
  )
}
