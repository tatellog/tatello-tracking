import {
  Blur,
  Canvas,
  Group,
  Image as SkiaImage,
  Paint,
  useImage,
} from '@shopify/react-native-skia'
import { Image, StyleSheet, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { GLYPH_BY_SIGN } from '@/features/tabs/zodiac/glyphs'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors } from '@/theme'

/*
 * Emblema Celeste — reveal RASTER por FRAMES, en 3 capas.
 *
 *   1. arch.png  — aro ornamental, COMPARTIDO por los 12 (transparente;
 *      enmarca el cuadrado). SIEMPRE presente: es el marco/promesa.
 *   2. <sign>-reveal/fNN.png — el animal pre-horneado a 11 niveles de
 *      revelado RADIAL (centro → afuera). Se muestra el frame del %.
 *   3. glifo del signo (vector tintable, GLYPH_BY_SIGN) — oro, arriba.
 *
 * Por qué frames y no un shader: el line-art tiene brillo uniforme, así
 * que un reveal por luminancia hace aparecer todo el contorno de golpe;
 * y el runtime shader de Skia (uniform packing) resultó poco fiable. Los
 * frames pre-horneados (scripts/gen-emblem-frames.mjs) dan un reveal
 * espacial limpio y son solo `<Image>` — sin shader, 100% predecible.
 *
 * Sistema INDEPENDIENTE de la constelación natal (estrellas magenta,
 * "Entrené", mensual), que se dibuja ENCIMA.
 *
 * Performance: <Canvas> de Skia hermano del SVG (patrón de
 * SkiaLitFlareLayer), NO un PNG dentro de un <Svg> (causaba scroll-swim
 * en Android). Solo carga 2 texturas (arco + frame vigente); cambiar de
 * frame es swap de imagen, sin repintar por frame en reposo.
 */

// Frames del reveal radial por signo (11 c/u: 0%,10%,…,100%). El arco,
// el laurel y los glifos son compartidos.
const FRAME_COUNT = 11

const FRAMES_ARIES = [
  require('@/assets/zodiac-art/aries-reveal/f00.png'),
  require('@/assets/zodiac-art/aries-reveal/f01.png'),
  require('@/assets/zodiac-art/aries-reveal/f02.png'),
  require('@/assets/zodiac-art/aries-reveal/f03.png'),
  require('@/assets/zodiac-art/aries-reveal/f04.png'),
  require('@/assets/zodiac-art/aries-reveal/f05.png'),
  require('@/assets/zodiac-art/aries-reveal/f06.png'),
  require('@/assets/zodiac-art/aries-reveal/f07.png'),
  require('@/assets/zodiac-art/aries-reveal/f08.png'),
  require('@/assets/zodiac-art/aries-reveal/f09.png'),
  require('@/assets/zodiac-art/aries-reveal/f10.png'),
]
const FRAMES_TAURO = [
  require('@/assets/zodiac-art/tauro-reveal/f00.png'),
  require('@/assets/zodiac-art/tauro-reveal/f01.png'),
  require('@/assets/zodiac-art/tauro-reveal/f02.png'),
  require('@/assets/zodiac-art/tauro-reveal/f03.png'),
  require('@/assets/zodiac-art/tauro-reveal/f04.png'),
  require('@/assets/zodiac-art/tauro-reveal/f05.png'),
  require('@/assets/zodiac-art/tauro-reveal/f06.png'),
  require('@/assets/zodiac-art/tauro-reveal/f07.png'),
  require('@/assets/zodiac-art/tauro-reveal/f08.png'),
  require('@/assets/zodiac-art/tauro-reveal/f09.png'),
  require('@/assets/zodiac-art/tauro-reveal/f10.png'),
]
const FRAMES_GEMINIS = [
  require('@/assets/zodiac-art/geminis-reveal/f00.png'),
  require('@/assets/zodiac-art/geminis-reveal/f01.png'),
  require('@/assets/zodiac-art/geminis-reveal/f02.png'),
  require('@/assets/zodiac-art/geminis-reveal/f03.png'),
  require('@/assets/zodiac-art/geminis-reveal/f04.png'),
  require('@/assets/zodiac-art/geminis-reveal/f05.png'),
  require('@/assets/zodiac-art/geminis-reveal/f06.png'),
  require('@/assets/zodiac-art/geminis-reveal/f07.png'),
  require('@/assets/zodiac-art/geminis-reveal/f08.png'),
  require('@/assets/zodiac-art/geminis-reveal/f09.png'),
  require('@/assets/zodiac-art/geminis-reveal/f10.png'),
]
const FRAMES_CANCER = [
  require('@/assets/zodiac-art/cancer-reveal/f00.png'),
  require('@/assets/zodiac-art/cancer-reveal/f01.png'),
  require('@/assets/zodiac-art/cancer-reveal/f02.png'),
  require('@/assets/zodiac-art/cancer-reveal/f03.png'),
  require('@/assets/zodiac-art/cancer-reveal/f04.png'),
  require('@/assets/zodiac-art/cancer-reveal/f05.png'),
  require('@/assets/zodiac-art/cancer-reveal/f06.png'),
  require('@/assets/zodiac-art/cancer-reveal/f07.png'),
  require('@/assets/zodiac-art/cancer-reveal/f08.png'),
  require('@/assets/zodiac-art/cancer-reveal/f09.png'),
  require('@/assets/zodiac-art/cancer-reveal/f10.png'),
]
const FRAMES_LEO = [
  require('@/assets/zodiac-art/leo-reveal/f00.png'),
  require('@/assets/zodiac-art/leo-reveal/f01.png'),
  require('@/assets/zodiac-art/leo-reveal/f02.png'),
  require('@/assets/zodiac-art/leo-reveal/f03.png'),
  require('@/assets/zodiac-art/leo-reveal/f04.png'),
  require('@/assets/zodiac-art/leo-reveal/f05.png'),
  require('@/assets/zodiac-art/leo-reveal/f06.png'),
  require('@/assets/zodiac-art/leo-reveal/f07.png'),
  require('@/assets/zodiac-art/leo-reveal/f08.png'),
  require('@/assets/zodiac-art/leo-reveal/f09.png'),
  require('@/assets/zodiac-art/leo-reveal/f10.png'),
]
const FRAMES_VIRGO = [
  require('@/assets/zodiac-art/virgo-reveal/f00.png'),
  require('@/assets/zodiac-art/virgo-reveal/f01.png'),
  require('@/assets/zodiac-art/virgo-reveal/f02.png'),
  require('@/assets/zodiac-art/virgo-reveal/f03.png'),
  require('@/assets/zodiac-art/virgo-reveal/f04.png'),
  require('@/assets/zodiac-art/virgo-reveal/f05.png'),
  require('@/assets/zodiac-art/virgo-reveal/f06.png'),
  require('@/assets/zodiac-art/virgo-reveal/f07.png'),
  require('@/assets/zodiac-art/virgo-reveal/f08.png'),
  require('@/assets/zodiac-art/virgo-reveal/f09.png'),
  require('@/assets/zodiac-art/virgo-reveal/f10.png'),
]
const FRAMES_LIBRA = [
  require('@/assets/zodiac-art/libra-reveal/f00.png'),
  require('@/assets/zodiac-art/libra-reveal/f01.png'),
  require('@/assets/zodiac-art/libra-reveal/f02.png'),
  require('@/assets/zodiac-art/libra-reveal/f03.png'),
  require('@/assets/zodiac-art/libra-reveal/f04.png'),
  require('@/assets/zodiac-art/libra-reveal/f05.png'),
  require('@/assets/zodiac-art/libra-reveal/f06.png'),
  require('@/assets/zodiac-art/libra-reveal/f07.png'),
  require('@/assets/zodiac-art/libra-reveal/f08.png'),
  require('@/assets/zodiac-art/libra-reveal/f09.png'),
  require('@/assets/zodiac-art/libra-reveal/f10.png'),
]
const FRAMES_ESCORPIO = [
  require('@/assets/zodiac-art/escorpio-reveal/f00.png'),
  require('@/assets/zodiac-art/escorpio-reveal/f01.png'),
  require('@/assets/zodiac-art/escorpio-reveal/f02.png'),
  require('@/assets/zodiac-art/escorpio-reveal/f03.png'),
  require('@/assets/zodiac-art/escorpio-reveal/f04.png'),
  require('@/assets/zodiac-art/escorpio-reveal/f05.png'),
  require('@/assets/zodiac-art/escorpio-reveal/f06.png'),
  require('@/assets/zodiac-art/escorpio-reveal/f07.png'),
  require('@/assets/zodiac-art/escorpio-reveal/f08.png'),
  require('@/assets/zodiac-art/escorpio-reveal/f09.png'),
  require('@/assets/zodiac-art/escorpio-reveal/f10.png'),
]
const FRAMES_SAGITARIO = [
  require('@/assets/zodiac-art/sagitario-reveal/f00.png'),
  require('@/assets/zodiac-art/sagitario-reveal/f01.png'),
  require('@/assets/zodiac-art/sagitario-reveal/f02.png'),
  require('@/assets/zodiac-art/sagitario-reveal/f03.png'),
  require('@/assets/zodiac-art/sagitario-reveal/f04.png'),
  require('@/assets/zodiac-art/sagitario-reveal/f05.png'),
  require('@/assets/zodiac-art/sagitario-reveal/f06.png'),
  require('@/assets/zodiac-art/sagitario-reveal/f07.png'),
  require('@/assets/zodiac-art/sagitario-reveal/f08.png'),
  require('@/assets/zodiac-art/sagitario-reveal/f09.png'),
  require('@/assets/zodiac-art/sagitario-reveal/f10.png'),
]
const FRAMES_CAPRICORNIO = [
  require('@/assets/zodiac-art/capricornio-reveal/f00.png'),
  require('@/assets/zodiac-art/capricornio-reveal/f01.png'),
  require('@/assets/zodiac-art/capricornio-reveal/f02.png'),
  require('@/assets/zodiac-art/capricornio-reveal/f03.png'),
  require('@/assets/zodiac-art/capricornio-reveal/f04.png'),
  require('@/assets/zodiac-art/capricornio-reveal/f05.png'),
  require('@/assets/zodiac-art/capricornio-reveal/f06.png'),
  require('@/assets/zodiac-art/capricornio-reveal/f07.png'),
  require('@/assets/zodiac-art/capricornio-reveal/f08.png'),
  require('@/assets/zodiac-art/capricornio-reveal/f09.png'),
  require('@/assets/zodiac-art/capricornio-reveal/f10.png'),
]
const FRAMES_ACUARIO = [
  require('@/assets/zodiac-art/acuario-reveal/f00.png'),
  require('@/assets/zodiac-art/acuario-reveal/f01.png'),
  require('@/assets/zodiac-art/acuario-reveal/f02.png'),
  require('@/assets/zodiac-art/acuario-reveal/f03.png'),
  require('@/assets/zodiac-art/acuario-reveal/f04.png'),
  require('@/assets/zodiac-art/acuario-reveal/f05.png'),
  require('@/assets/zodiac-art/acuario-reveal/f06.png'),
  require('@/assets/zodiac-art/acuario-reveal/f07.png'),
  require('@/assets/zodiac-art/acuario-reveal/f08.png'),
  require('@/assets/zodiac-art/acuario-reveal/f09.png'),
  require('@/assets/zodiac-art/acuario-reveal/f10.png'),
]
const FRAMES_PISCIS = [
  require('@/assets/zodiac-art/piscis-reveal/f00.png'),
  require('@/assets/zodiac-art/piscis-reveal/f01.png'),
  require('@/assets/zodiac-art/piscis-reveal/f02.png'),
  require('@/assets/zodiac-art/piscis-reveal/f03.png'),
  require('@/assets/zodiac-art/piscis-reveal/f04.png'),
  require('@/assets/zodiac-art/piscis-reveal/f05.png'),
  require('@/assets/zodiac-art/piscis-reveal/f06.png'),
  require('@/assets/zodiac-art/piscis-reveal/f07.png'),
  require('@/assets/zodiac-art/piscis-reveal/f08.png'),
  require('@/assets/zodiac-art/piscis-reveal/f09.png'),
  require('@/assets/zodiac-art/piscis-reveal/f10.png'),
]

// Exportado: el modal "Tu {signo}" reusa el MISMO frame del animal (como
// <Image> plano, no Skia → sin chocar TextureViews con el del hero) para que
// el emblema del modal sea EL MISMO que el del Tab Hoy.
export const FRAMES_BY_SIGN: Record<ZodiacSign, readonly number[]> = {
  aries: FRAMES_ARIES,
  tauro: FRAMES_TAURO,
  geminis: FRAMES_GEMINIS,
  cancer: FRAMES_CANCER,
  leo: FRAMES_LEO,
  virgo: FRAMES_VIRGO,
  libra: FRAMES_LIBRA,
  escorpio: FRAMES_ESCORPIO,
  sagitario: FRAMES_SAGITARIO,
  capricornio: FRAMES_CAPRICORNIO,
  acuario: FRAMES_ACUARIO,
  piscis: FRAMES_PISCIS,
}
const ARCH_SRC = require('@/assets/zodiac-art/arch.png')

// Encaje. El arco llena el cuadrado en altura (enmarca).
const ARCH_HFRAC = 0.98
// El aro se ve ligeramente ancho → se estira en alto (sin tocar el ancho)
// para que quede un poco más largo/alto y deje de verse achatado.
const ARCH_VSTRETCH = 1.07
// Los frames son CUADRADOS con el animal centrado ÓPTICAMENTE (centroide
// de luminancia, en el generador), así que la colocación es uniforme
// para los 12. El animal ocupa ~0.58 del lienzo para que RESPIRE dentro
// del aro (estética sello/lujo: figura ~55-60% del marco, no 90%).
const LION_WFRAC = 0.63
const LION_CX = 0.5
const LION_CY = 0.46
const GLYPH_FRAC = 0.11
const GLYPH_CY = 0.085
// (Las constantes HOJAS_* del laurel se retiraron junto con la capa — el
// laurel sobrecargaba la composición. Viven en git si se quiere reponer.)
// La constelación natal (el dato real de la usuaria) GANA sobre el emblema.
// SLICE 1 (motion premium / Genshin): el emblema RECEDE a near-void para que
// las estrellas tengan el contraste y no compitan dos figuras de Leo. Bajado
// 0.72 → 0.45; el león queda como textura-memoria de fondo, no co-protagonista.
const MASTER_OPACITY = 0.45
// Marco (aro): el elemento MÁS tenue — ancla estructural, no foco. Por debajo
// de ~0.35 el oro se vuelve gris sucio sobre el fondo y el marco "se rompe",
// así que lo bajo solo a 0.36 (justo arriba del piso).
const FRAME_OPACITY = 0.36
// Glifo: acompaña al marco, no al animal.
const GLYPH_OPACITY = 0.42

// Bloom: un halo (copia borrosa del animal) que crece hacia el 100 %.
// Arranca temprano (~30 %) para que se sienta "algo se enciende" pronto;
// `screen` satura sin quemar el centro.
const BLOOM_START = 32
const BLOOM_MAX_OPACITY = 0.6

export function frameIndexFor(progress: number): number {
  const p = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0))
  return Math.max(0, Math.min(FRAME_COUNT - 1, Math.round((p / 100) * (FRAME_COUNT - 1))))
}

function bloomTFor(progress: number): number {
  const p = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0))
  if (p <= BLOOM_START) return 0
  return (p - BLOOM_START) / (100 - BLOOM_START)
}

export type RevealedEmblemProps = {
  sign: ZodiacSign
  /** Progreso de transformación 0–100. */
  transformProgress: number
  /** Lado del lienzo cuadrado en px (canvasPx del padre). */
  size: number
  /* Opacidades — default = receso para Tab Hoy (el emblema debe RECEDER tras la
   * constelación natal magenta). En Órbita Mes NO hay constelación encima y el
   * emblema ES el protagonista, así que esa vista las sube para coronar. */
  masterOpacity?: number
  frameOpacity?: number
  glyphOpacity?: number
  bloomMaxOpacity?: number
}

export function RevealedEmblem({
  sign,
  transformProgress,
  size,
  masterOpacity = MASTER_OPACITY,
  frameOpacity = FRAME_OPACITY,
  glyphOpacity = GLYPH_OPACITY,
  bloomMaxOpacity = BLOOM_MAX_OPACITY,
}: RevealedEmblemProps) {
  const frames = FRAMES_BY_SIGN[sign]
  const Glyph = GLYPH_BY_SIGN[sign]
  const animalSrc = frames ? frames[frameIndexFor(transformProgress)] : null

  // Bloom (halo aditivo cerca del 100 %) sigue en Skia. Si la textura aún no
  // decodifica, simplemente NO hay bloom — nunca blanquea el emblema.
  const animalSkia = useImage(animalSrc ?? null)

  if (size <= 0 || animalSrc == null) return null

  // Aspecto REAL de cada PNG SIN decodificar (síncrono para assets bundleados),
  // así no dependemos de que Skia ya tenga la textura para medir.
  const archMeta = Image.resolveAssetSource(ARCH_SRC)
  const animalMeta = Image.resolveAssetSource(animalSrc)
  const archAR = archMeta ? archMeta.width / archMeta.height : 1.5
  const lionAR = animalMeta ? animalMeta.width / animalMeta.height : 1.2

  const archBase = size * ARCH_HFRAC
  const archW = archBase * archAR
  const archH = archBase * ARCH_VSTRETCH
  const archX = (size - archW) / 2
  const archY = (size - archH) / 2

  const lionW = size * LION_WFRAC
  const lionH = lionW / lionAR
  const lionX = LION_CX * size - lionW / 2
  const lionY = LION_CY * size - lionH / 2
  const glyphSize = size * GLYPH_FRAC

  const bloomT = bloomTFor(transformProgress)
  const bloomRadius = size * (0.02 + bloomT * 0.045)

  return (
    <Animated.View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      entering={FadeIn.duration(420)}
    >
      {/* Aro + animal como RN <Image> (no Skia): la decodificación la maneja
          RN con caché propio (calentado por LionFramePreloader), así el emblema
          NUNCA queda en blanco al cambiar de tab —el bug que tenía el useImage
          de Skia, que re-decodifica y devolvía null en la re-entrada—. */}
      <Image
        source={ARCH_SRC}
        resizeMode="stretch"
        fadeDuration={0}
        style={{
          position: 'absolute',
          left: archX,
          top: archY,
          width: archW,
          height: archH,
          opacity: frameOpacity,
        }}
      />
      <Image
        source={animalSrc}
        resizeMode="stretch"
        fadeDuration={0}
        style={{
          position: 'absolute',
          left: lionX,
          top: lionY,
          width: lionW,
          height: lionH,
          opacity: masterOpacity,
        }}
      />

      {/* Bloom — copia borrosa aditiva que crece hacia el 100 %. Skia, opcional:
          si aún no carga la textura, no hay bloom (jamás blanquea la figura). */}
      {bloomT > 0 && animalSkia ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Group opacity={masterOpacity}>
            <Group
              layer={
                <Paint opacity={bloomT * bloomMaxOpacity} blendMode="screen">
                  <Blur blur={bloomRadius} />
                </Paint>
              }
            >
              <SkiaImage
                image={animalSkia}
                x={lionX}
                y={lionY}
                width={lionW}
                height={lionH}
                fit="fill"
              />
            </Group>
          </Group>
        </Canvas>
      ) : null}
      {/* El laurel (hojas-23.svg) se retiró — sobrecargaba la composición y
          le peleaba el foco al asterismo (review de arte). El anillo + el león
          quedan; volver a montarlo es un <Hojas> en git. */}
      {Glyph ? (
        <View
          style={[
            styles.glyph,
            {
              top: GLYPH_CY * size - glyphSize / 2,
              left: size / 2 - glyphSize / 2,
              width: glyphSize,
              height: glyphSize,
            },
          ]}
        >
          <Glyph width="100%" height="100%" color={colors.oro} opacity={glyphOpacity} />
        </View>
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  glyph: { position: 'absolute' },
})
