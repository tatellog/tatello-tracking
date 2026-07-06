import {
  BlurMask,
  Group as SkiaGroup,
  Path as SkiaPath,
  RadialGradient as SkiaRadialGradient,
  Canvas,
  Circle as SkiaCircle,
  Skia,
  vec,
  type SkPath,
} from '@shopify/react-native-skia'
import { useEffect, useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated'

import { colors } from '@/theme'

/* ────────────────────────────────────────────────────────────────────────────
 * StairsScene · el núcleo visual de "la esfera que CONSTRUYE su camino de luz"
 * (Órbita · Semana). Componente PRESENTACIONAL puro: NO tiene animación propia.
 * Recibe Reanimated shared values desde un orquestador externo y sólo pinta.
 *
 * ── Concepto (brief de la dueña, traducido a Stelar) ────────────────────────
 * Una pequeña ESFERA/astro luminoso (= la usuaria) SUBE una escalera que NO
 * está pre-hecha: cada escalón se DIBUJA/ENCIENDE en el instante en que la
 * esfera lo pisa. La metáfora no es "subir una escalera que alguien ya hizo",
 * es "construir tu propio camino": cada paso crea el siguiente. Filosofía
 * Stelar pura — el camino no reinicia, no castiga; el camino es lo que llevas
 * hecho. Nunca hay una persona. Contemplativo, lujo silencioso, no videojuego.
 *
 * ── Revelado progresivo (el corazón de la pieza) ────────────────────────────
 * • Los escalones NO se pre-dibujan. Cada escalón tiene su propio factor de
 *   construcción 0..1 (0 = aún no existe · 1 = construido y en reposo), DERIVADO
 *   en la UI thread del shared value `builtUpTo` (o de `progress` por defecto).
 * • El escalón que se acaba de construir da un pequeño DESTELLO que decae a su
 *   brillo de reposo (el "se dibujó en este momento"): un bump de opacidad que
 *   pica a mitad de la transición y se apaga al asentarse.
 * • Los escalones aún no alcanzados NO se ven. El SIGUIENTE se insinúa apenas
 *   como un fantasma tenue hacia donde va la esfera — da dirección sin
 *   "spoilear" el resto del camino.
 *
 * ── Decisiones de arte (por qué se ve así) ──────────────────────────────────
 * • La escalera es SÓLO líneas finas (Skia Path, stroke hairline, sin relleno,
 *   sin textura). Lenguaje de "cartografía celeste", no de plataforma de juego.
 * • Perspectiva por decaimiento geométrico: cada escalón es `decay` veces más
 *   pequeño que el anterior, así el camino converge hacia un punto de fuga
 *   finito aunque se construyan N escalones (serie geométrica → límite finito).
 *   Da la sensación de que el camino "sigue" hacia arriba sin fin.
 * • Grosor de línea COMPENSADO por la escala de cámara (`HAIRLINE_PX/scale`):
 *   pase lo que pase con el dolly-out, la línea se ve como un hairline de ~1px
 *   en pantalla. El camino nunca "engorda" ni desaparece.
 * • La esfera rima con la estrella de la galaxia de la Semana (WeekOrbitGalaxy
 *   → función `Star`): bloom de color + bloom blanco + núcleo, con blur real
 *   (BlurMask) y RadialGradient, en blendMode "screen" (luz aditiva sobre el
 *   negro-warm). Bloom exterior ~3.4x el núcleo, bloom blanco interior ~1.5x →
 *   halo suave, "luz tamizada", no un flash.
 * • La esfera vive en unidades de MUNDO (no compensa la cámara): al alejarse la
 *   cámara, la esfera se vuelve DIMINUTA — corazón del mensaje "mira cuánto has
 *   construido".
 * • Sólo un acento de color por ESTADO (rising/steady/softer). Todo lo demás es
 *   leche/niebla. Lujo silencioso: una sola luz manda, el resto descansa.
 *
 * ── Shared values que espera del orquestador (todos opcionales salvo progress)
 *   progress      SharedValue<number> 0..1 · posición de la esfera a lo largo
 *                 del camino, en espacio de SEGMENTOS (ver `sampleTrack`), para
 *                 que quede acoplada con la construcción escalón por escalón.
 *   builtUpTo     SharedValue<number> 0..1 · hasta dónde está CONSTRUIDO el
 *                 camino. La esfera nunca debe ir más allá de lo construido: el
 *                 orquestador liga `builtUpTo` a la posición de la esfera
 *                 (construye al pisar). Si se omite, sigue a `progress`.
 *   camTranslateX SharedValue<number> · traslación de cámara (px de pantalla).
 *   camTranslateY SharedValue<number> · idem vertical.
 *   camScale      SharedValue<number> · zoom de cámara. >1 acerca, <1 aleja
 *                 (dolly-out → revela el camino YA construido detrás).
 *   pulse         SharedValue<number> 0..1 · respiración del glow de la esfera.
 *                 SÓLO modula radio/opacidad del bloom, NUNCA el color (animar
 *                 los colores de un gradiente Skia crashea en device — ver memo
 *                 skia-animated-gradient-colors-crash).
 *   squashX/Y     SharedValue<number> · squash & stretch de la esfera por salto
 *                 (al saltar un escalón: scaleY>1, scaleX<1). El orquestador
 *                 anima el rebote; aquí sólo se aplica el deform.
 *   enterOpacity  SharedValue<number> 0..1 · fade-in de toda la escena.
 *
 * ── Cómo lograr "dolly-out revela el camino construido detrás" ──────────────
 * El camino se construye COMPLETO en coordenadas de mundo, pero los escalones
 * no construidos son INVISIBLES (factor 0). Todo vive en un único
 * <Group transform={cámara}>. El orquestador:
 *   1) Para SEGUIR a la esfera: lee `progress`, calcula su posición con el
 *      helper exportado `sampleTrack(track, t)` (worklet-safe) y pone
 *      camTranslate = centroPantalla − posEsfera*camScale. La esfera queda
 *      centrada mientras construye.
 *   2) Para el DOLLY-OUT: baja `camScale` (p. ej. 1 → 0.35) recentrando. Como
 *      sólo lo construido es visible, al alejarse aparece EL CAMINO QUE LLEVAS
 *      HECHO (corto al inicio, largo con las semanas) con la esfera diminuta en
 *      la punta. Refuerza que el camino ES tu constancia, no algo pre-existente.
 * El `track` para `sampleTrack` sale de `buildStairLayout(...)` (mismo que usa
 * la escena); compártelo con el orquestador para que coincidan exactamente.
 * ──────────────────────────────────────────────────────────────────────────── */

// Hairline objetivo en px de pantalla (constante tras compensar la escala).
const HAIRLINE_PX = 1.1
// Opacidad máxima del "fantasma" del siguiente escalón (dirección, no spoiler).
const GHOST_MAX = 0.1
// Ganancia del destello al construirse un escalón (se suma al reposo y decae).
const FLASH_GAIN = 0.9
// Cuántos segmentos antes de pisarlo se insinúa el fantasma del siguiente.
const GHOST_LEAD = 1.2

// ── Geometría de la escalera (unidades de mundo) ────────────────────────────
export type StairConfig = {
  /** Número de escalones del camino. Más = camino potencialmente más largo. */
  steps?: number
  /** Ancho (huella) del primer escalón en unidades de mundo. */
  tread?: number
  /** Altura (contrahuella) del primer escalón. */
  rise?: number
  /** Decaimiento por escalón (0..1). <1 → converge al punto de fuga. */
  decay?: number
  /** Grosor visible del bloque de cada escalón (cara frontal), en mundo. */
  depth?: number
}

const DEFAULTS: Required<StairConfig> = {
  steps: 18,
  tread: 42,
  rise: 30,
  decay: 0.94,
  depth: 9,
}

export type WalkTrack = {
  /** Vértices por los que rueda la esfera (topes de huella), en orden. Por
   *  escalón hay 2 vértices (izq/der de la huella); el segmento entre el último
   *  de un escalón y el primero del siguiente ES la contrahuella (el "salto"). */
  pts: { x: number; y: number }[]
}

export type StairsLayout = {
  /** Un Skia Path (sólo stroke) por escalón + su opacidad de reposo (fade de
   *  perspectiva). El REVELADO de construcción se aplica en runtime. */
  stepPaths: { path: SkPath; restOpacity: number }[]
  track: WalkTrack
  /** Nº de segmentos de la pista (= pts.length − 1). El orquestador lo usa para
   *  parametrizar y para acoplar la construcción con la esfera. */
  segments: number
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  vanish: { x: number; y: number }
  /** Radio base de la esfera en unidades de mundo (derivado de la huella). */
  sphereR: number
}

/**
 * Muestrea la pista por SEGMENTOS (tiempo uniforme por segmento, no por
 * longitud de arco). `t` en 0..1 → punto en mundo sobre el camino. Que sea por
 * segmento —no por arco— es intencional: da "un escalón a la vez" y mantiene la
 * esfera acoplada con el frente de construcción. WORKLET-SAFE: el orquestador
 * puede llamarlo dentro de un useDerivedValue para seguir a la esfera con la
 * cámara (ver memo worklet-helpers-need-worklet-directive: por eso la directiva).
 */
export function sampleTrack(track: WalkTrack, t: number): { x: number; y: number } {
  'worklet'
  const { pts } = track
  const n = pts.length
  if (n === 0) return { x: 0, y: 0 }
  const first = pts[0]!
  if (n === 1) return { x: first.x, y: first.y }
  const segs = n - 1
  const pos = Math.min(1, Math.max(0, t)) * segs
  let i0 = Math.floor(pos)
  if (i0 >= segs) i0 = segs - 1
  const local = pos - i0
  const a = pts[i0]!
  const b = pts[i0 + 1]!
  return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local }
}

/**
 * Construye la geometría del camino. Puro y sin side-effects. Úsalo TAMBIÉN
 * desde el orquestador para obtener `track`/`segments` (así la cámara sigue
 * exactamente la misma esfera que se pinta, y `builtUpTo` se acopla bien).
 */
export function buildStairLayout(config: StairConfig = {}): StairsLayout {
  const { steps, tread, rise, decay, depth } = { ...DEFAULTS, ...config }

  const stepPaths: StairsLayout['stepPaths'] = []
  const pts: { x: number; y: number }[] = []

  let X = 0
  let Y = 0 // el eje Y de pantalla crece hacia abajo → subir = restar
  let minX = 0
  let maxX = 0
  let minY = 0
  let maxY = 0

  for (let i = 0; i < steps; i++) {
    const s = Math.pow(decay, i)
    const dx = tread * s
    const dy = rise * s
    const d = depth * s

    const x0 = X
    const x1 = X + dx
    const yTop = Y // tope de la huella (donde "pisa" la esfera)
    const yNext = Y - dy // tope de la siguiente huella (contrahuella hacia arriba)

    // Path del escalón: SÓLO stroke, sin relleno. Un bloque insinuado con
    // grosor (`d`): huella superior + huella frontal + dos ticks verticales +
    // la contrahuella que sube al siguiente escalón.
    const p = Skia.Path.Make()
    // huella (superior)
    p.moveTo(x0, yTop)
    p.lineTo(x1, yTop)
    // huella (borde frontal, desplazado hacia abajo por el grosor)
    p.moveTo(x0, yTop + d)
    p.lineTo(x1, yTop + d)
    // ticks verticales que cierran la cara frontal de la huella
    p.moveTo(x0, yTop)
    p.lineTo(x0, yTop + d)
    p.moveTo(x1, yTop)
    p.lineTo(x1, yTop + d)
    // contrahuella: sube del frente del escalón al tope del siguiente
    p.moveTo(x1, yTop)
    p.lineTo(x1, yNext)

    // Reposo: leve fade hacia el punto de fuga (además del revelado de build).
    const k = steps <= 1 ? 0 : i / (steps - 1)
    const restOpacity = 0.86 - k * 0.55 // 0.86 (cerca) → ~0.31 (lejos)
    stepPaths.push({ path: p, restOpacity })

    // Pista de caminata: los dos topes de la huella (izq → der).
    pts.push({ x: x0, y: yTop })
    pts.push({ x: x1, y: yTop })

    minX = Math.min(minX, x0)
    maxX = Math.max(maxX, x1)
    minY = Math.min(minY, yNext)
    maxY = Math.max(maxY, yTop + d)

    X = x1
    Y = yNext
  }

  // Punto de fuga (límite de la serie geométrica).
  const vanish = { x: tread / (1 - decay), y: -(rise / (1 - decay)) }

  return {
    stepPaths,
    track: { pts },
    segments: Math.max(1, pts.length - 1),
    bounds: { minX, maxX, minY, maxY },
    vanish,
    sphereR: tread * 0.32,
  }
}

// ── Estados de acento (dirección de la semana) ──────────────────────────────
// El estado SÓLO cambia color de acento + intensidad de glow, nunca geometría.
export type StairsState = 'rising' | 'steady' | 'softer'

type AccentSpec = { accent: string; glow: number; lineDim: number }

const ACCENTS: Record<StairsState, AccentSpec> = {
  // rising · el finde/impulso empuja: magenta vivo, glow pleno.
  rising: { accent: colors.magentaHot, glow: 1, lineDim: 1 },
  // steady · sostenido y sereno: leche, sin drama.
  steady: { accent: colors.leche, glow: 0.72, lineDim: 0.9 },
  // softer · la pausa como perspectiva: niebla, luz más tenue (nunca "falla").
  softer: { accent: colors.niebla, glow: 0.52, lineDim: 0.7 },
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  )
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

// ── Props ───────────────────────────────────────────────────────────────────
export type StairsSceneProps = {
  /** Cuadrado (compacto). Si se omite, usa width/height. */
  size?: number
  width?: number
  height?: number

  /** Geometría del camino. Debe COINCIDIR con la que use el orquestador para
   *  calcular la cámara y el acoplamiento build↔esfera. */
  config?: StairConfig

  /** Dirección/acento de la semana. Cambia sólo color + intensidad de glow. */
  state?: StairsState

  // ── Shared values animados desde fuera (ver header) ──
  progress?: SharedValue<number>
  builtUpTo?: SharedValue<number>
  camTranslateX?: SharedValue<number>
  camTranslateY?: SharedValue<number>
  camScale?: SharedValue<number>
  pulse?: SharedValue<number>
  squashX?: SharedValue<number>
  squashY?: SharedValue<number>
  enterOpacity?: SharedValue<number>
  /** Opacidad SOLO de la esfera (para que aparezca después del camino). */
  sphereOpacity?: SharedValue<number>
}

export function StairsScene({
  size,
  width,
  height,
  config,
  state = 'steady',
  progress,
  builtUpTo,
  camTranslateX,
  camTranslateY,
  camScale,
  pulse,
  squashX,
  squashY,
  enterOpacity,
  sphereOpacity,
}: StairsSceneProps) {
  const W = size ?? width ?? 120
  const H = size ?? height ?? 120

  const layout = useMemo(() => buildStairLayout(config), [config])
  const accent = ACCENTS[state]
  const accentRgb = useMemo(() => hexToRgb(accent.accent), [accent.accent])
  const lecheRgb = useMemo(() => hexToRgb(colors.leche), [])

  // Cámara por defecto: encuadra todo el camino con la base abajo. Sólo se usa
  // cuando el orquestador NO pasa una cámara (modo estático/preview).
  const fit = useMemo(() => {
    const spanX = Math.max(1, layout.bounds.maxX - layout.bounds.minX)
    const spanY = Math.max(1, layout.bounds.maxY - layout.bounds.minY)
    const scale = Math.min(W / (spanX * 1.25), H / (spanY * 1.25))
    const cx = (layout.bounds.minX + layout.bounds.maxX) / 2
    const cy = (layout.bounds.minY + layout.bounds.maxY) / 2
    return {
      scale,
      tx: W / 2 - cx * scale,
      // base sesgada hacia abajo (0.62) para dejar respirar el cielo arriba.
      ty: H * 0.62 - cy * scale,
    }
  }, [layout, W, H])

  // Defaults internos. Si llegan shared values por props, mandan esos; estos
  // sólo cubren el modo estático/preview. Arrancan en ~0.45 para que el preview
  // no salga en blanco (muestra medio camino construido).
  const dProgress = useSharedValue(0.45)
  const dBuilt = useSharedValue(0.45)
  const dTx = useSharedValue(fit.tx)
  const dTy = useSharedValue(fit.ty)
  const dScale = useSharedValue(fit.scale)
  const dPulse = useSharedValue(0)
  const dSquashX = useSharedValue(1)
  const dSquashY = useSharedValue(1)
  const dEnter = useSharedValue(1)
  const dSphereOpacity = useSharedValue(1)

  // Mantén el fit por defecto sincronizado si cambia el tamaño y no hay cámara.
  useEffect(() => {
    if (!camScale) dScale.value = fit.scale
    if (!camTranslateX) dTx.value = fit.tx
    if (!camTranslateY) dTy.value = fit.ty
  }, [fit, camScale, camTranslateX, camTranslateY, dScale, dTx, dTy])

  const sProgress = progress ?? dProgress
  // La construcción sigue a `progress` si el orquestador no la controla aparte.
  const sBuilt = builtUpTo ?? progress ?? dBuilt
  const sTx = camTranslateX ?? dTx
  const sTy = camTranslateY ?? dTy
  const sScale = camScale ?? dScale
  const sPulse = pulse ?? dPulse
  const sSquashX = squashX ?? dSquashX
  const sSquashY = squashY ?? dSquashY
  const sEnter = enterOpacity ?? dEnter
  const sSphereOpacity = sphereOpacity ?? dSphereOpacity

  // ── Cámara: translate + scale. Todo el mundo vive dentro de este Group. ──
  const cameraTransform = useDerivedValue(() => [
    { translateX: sTx.value },
    { translateY: sTy.value },
    { scale: sScale.value },
  ])

  // Grosor de línea compensado por la escala → hairline constante en pantalla.
  const strokeW = useDerivedValue(() => HAIRLINE_PX / Math.max(0.0001, sScale.value))

  // Fade-in de toda la escena.
  const sceneOpacity = useDerivedValue(() => sEnter.value)

  // ── Esfera ──
  const R = layout.sphereR
  const track = layout.track

  // Posición de la esfera sobre el camino (mundo), elevada sobre la huella.
  const spherePos = useDerivedValue(() => {
    const p = sampleTrack(track, sProgress.value)
    return [{ translateX: p.x }, { translateY: p.y - R * 0.9 }]
  })

  // Squash & stretch (pivote en el centro de la esfera).
  const squashTransform = useDerivedValue(() => [
    { scaleX: sSquashX.value },
    { scaleY: sSquashY.value },
  ])

  // El pulse respira el bloom: radio + opacidad (NUNCA color).
  const bloomR = useDerivedValue(() => R * 3.4 * (1 + sPulse.value * 0.4))
  const bloomOpacity = useDerivedValue(() => Math.min(1, (0.5 + sPulse.value * 0.4) * accent.glow))
  const contactOpacity = useDerivedValue(() =>
    Math.min(1, (0.22 + sPulse.value * 0.14) * accent.glow),
  )

  const segments = layout.segments

  return (
    <Canvas style={[styles.canvas, { width: W, height: H }]}>
      <SkiaGroup opacity={sceneOpacity}>
        <SkiaGroup transform={cameraTransform}>
          {/* Camino · cada escalón se CONSTRUYE cuando la esfera lo pisa. */}
          {layout.stepPaths.map((sp, i) => (
            <StairStep
              key={i}
              path={sp.path}
              restOpacity={sp.restOpacity}
              index={i}
              segments={segments}
              lineDim={accent.lineDim}
              builtUpTo={sBuilt}
              strokeW={strokeW}
            />
          ))}

          {/* Esfera luminosa · rima con la estrella de la galaxia de la Semana. */}
          <SkiaGroup transform={spherePos} opacity={sSphereOpacity}>
            {/* Glow de contacto sobre la huella: aterriza la luz (no squasheado). */}
            <SkiaGroup transform={[{ translateY: R * 0.9 }, { scaleY: 0.36 }]}>
              <SkiaCircle c={vec(0, 0)} r={R * 1.5} opacity={contactOpacity} blendMode="screen">
                <SkiaRadialGradient
                  c={vec(0, 0)}
                  r={R * 1.5}
                  colors={[`rgba(${accentRgb},0.55)`, `rgba(${accentRgb},0)`]}
                />
                <BlurMask blur={R * 0.7} style="normal" />
              </SkiaCircle>
            </SkiaGroup>

            {/* Cuerpo + halos · squash & stretch aplicado aquí (pivote centro). */}
            <SkiaGroup transform={squashTransform}>
              <SkiaGroup blendMode="screen">
                {/* Bloom de acento — respira con el pulse (radio + opacidad). */}
                <SkiaCircle c={vec(0, 0)} r={bloomR} opacity={bloomOpacity}>
                  <SkiaRadialGradient
                    c={vec(0, 0)}
                    r={R * 3.4}
                    colors={[
                      `rgba(${accentRgb},0.6)`,
                      `rgba(${accentRgb},0.16)`,
                      `rgba(${accentRgb},0)`,
                    ]}
                  />
                  <BlurMask blur={R * 1.3} style="normal" />
                </SkiaCircle>
                {/* Bloom blanco interior — el corazón de luz, luz tamizada. */}
                <SkiaCircle c={vec(0, 0)} r={R * 1.5}>
                  <SkiaRadialGradient
                    c={vec(0, 0)}
                    r={R * 1.5}
                    colors={[
                      `rgba(${lecheRgb},0.55)`,
                      `rgba(${lecheRgb},0.12)`,
                      `rgba(${lecheRgb},0)`,
                    ]}
                  />
                  <BlurMask blur={R * 0.7} style="normal" />
                </SkiaCircle>
              </SkiaGroup>

              {/* Núcleo */}
              <SkiaCircle c={vec(0, 0)} r={R * 0.55} color={colors.leche} opacity={0.96} />
            </SkiaGroup>
          </SkiaGroup>
        </SkiaGroup>
      </SkiaGroup>
    </Canvas>
  )
}

/* Un escalón que se CONSTRUYE. Su opacidad se deriva (UI thread) del frente de
 * construcción `builtUpTo`. Estados por escalón:
 *   • no alcanzado        → invisible (0).
 *   • siguiente inminente → fantasma tenue (dirección, sin spoiler).
 *   • construyéndose      → destello que decae (el "se dibujó ahora").
 *   • construido/reposo   → su brillo de reposo (fade de perspectiva).
 * Se extrae a componente para que cada escalón tenga UN useDerivedValue estable
 * (el nº de <StairStep> sólo cambia si cambia la config → remonta). */
function StairStep({
  path,
  restOpacity,
  index,
  segments,
  lineDim,
  builtUpTo,
  strokeW,
}: {
  path: SkPath
  restOpacity: number
  index: number
  segments: number
  lineDim: number
  builtUpTo: SharedValue<number>
  strokeW: SharedValue<number>
}) {
  // El escalón i se pisa alrededor del segmento 2*i (cada escalón = 2 segmentos:
  // huella + contrahuella). Empieza a construirse medio segmento antes de pisar.
  const start = 2 * index - 0.5
  const opacity = useDerivedValue(() => {
    const front = builtUpTo.value * segments
    const reveal = Math.min(1, Math.max(0, front - start)) // 0..1 construido
    // fantasma del siguiente: sube 0→1 mientras la esfera se acerca, y se
    // cancela en cuanto empieza a construirse de verdad.
    const ghost = Math.min(1, Math.max(0, front - (start - GHOST_LEAD))) - reveal
    // destello: pico a mitad de la construcción, 0 en reposo.
    const flash = reveal * (1 - reveal) * 4
    const base = restOpacity * lineDim
    return Math.min(1, base * reveal + GHOST_MAX * ghost * lineDim + base * flash * FLASH_GAIN)
  })

  return (
    <SkiaPath
      path={path}
      style="stroke"
      strokeWidth={strokeW}
      strokeJoin="round"
      strokeCap="round"
      color={colors.leche}
      opacity={opacity}
    />
  )
}

const styles = StyleSheet.create({
  canvas: {
    // Fondo negro-warm lo aporta el contenedor (Órbita); el Canvas es
    // transparente para que la luz aditiva (screen) funcione sobre #0A0608.
    backgroundColor: 'transparent',
  },
})
