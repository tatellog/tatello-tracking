import {
  Blur,
  Canvas,
  Group,
  Image as SkiaImage,
  Paint,
  useImage,
} from '@shopify/react-native-skia'
import { StyleSheet, View } from 'react-native'

import Hojas from '@/assets/zodiac-art/hojas-23.svg'
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

const FRAMES_BY_SIGN: Record<ZodiacSign, readonly number[]> = {
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
// Laurel (hojas-23.svg) dentro del aro, en la parte INFERIOR: las ramas
// abren hacia arriba y cradlean al león como una base, integradas con el
// borde inferior del anillo. Posición = dónde va el CENTRO de las hojas;
// el contenido del SVG vive en (0.497, 0.631) de su frame y las hojas
// ocupan ~0.85 del ancho del frame.
// Ancho calibrado para que el ARCO del laurel calce con la curva del
// anillo: al ensancharlo su curva se aplana y queda paralela a la última
// línea, por dentro del círculo.
const HOJAS_WFRAC = 0.74
const HOJAS_CX = 0.5
const HOJAS_CY = 0.866 // pegado a la última línea, contenido en el círculo
const HOJAS_CC_X = 0.497 // centro del contenido dentro del frame del SVG
const HOJAS_CC_Y = 0.631
const HOJAS_LEAF_WFRAC = 0.85 // las hojas ocupan esta fracción del frame
// La constelación natal (el dato real de la usuaria) GANA sobre el emblema,
// que es el marco/atmósfera poética → el emblema cede a fondo (más tenue +
// más difuso) para que las dos capas se lean como planos distintos.
const MASTER_OPACITY = 0.72
// Marco (aro + laurel): el elemento MÁS tenue — ancla estructural, no
// foco. Más bajo que el animal a propósito (su línea continua de alto
// contraste pesa más a igual opacidad). Por debajo de ~0.35 el oro se
// vuelve gris sucio sobre el fondo y el marco "se rompe".
const FRAME_OPACITY = 0.42
// Glifo: acompaña al marco, no al animal.
const GLYPH_OPACITY = 0.5

// Bloom: un halo (copia borrosa del animal) que crece hacia el 100 %.
// Arranca temprano (~30 %) para que se sienta "algo se enciende" pronto;
// `screen` satura sin quemar el centro.
const BLOOM_START = 32
const BLOOM_MAX_OPACITY = 0.6

function frameIndexFor(progress: number): number {
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
}

export function RevealedEmblem({ sign, transformProgress, size }: RevealedEmblemProps) {
  const frames = FRAMES_BY_SIGN[sign]
  const arch = useImage(ARCH_SRC)
  const animal = useImage(frames ? frames[frameIndexFor(transformProgress)] : 0)
  const Glyph = GLYPH_BY_SIGN[sign]

  if (size <= 0) return null

  // Rects con aspect REAL de cada imagen (sin deformar). El arco llena en
  // altura y se centra; el animal va centrado dentro del aro.
  const archAR = arch ? arch.width() / arch.height() : 1.5
  const archBase = size * ARCH_HFRAC
  const archW = archBase * archAR // ancho según el aspect real
  const archH = archBase * ARCH_VSTRETCH // alto estirado → menos achatado
  const archX = (size - archW) / 2
  const archY = (size - archH) / 2

  const lionAR = animal ? animal.width() / animal.height() : 1.2
  const lionW = size * LION_WFRAC
  const lionH = lionW / lionAR
  const lionX = LION_CX * size - lionW / 2
  const lionY = LION_CY * size - lionH / 2
  const glyphSize = size * GLYPH_FRAC

  // Laurel: el frame del SVG colocado de modo que el CENTRO de las hojas
  // caiga en (HOJAS_CX, HOJAS_CY) del lienzo.
  const hojasFrame = (HOJAS_WFRAC / HOJAS_LEAF_WFRAC) * size
  const hojasLeft = HOJAS_CX * size - HOJAS_CC_X * hojasFrame
  const hojasTop = HOJAS_CY * size - HOJAS_CC_Y * hojasFrame

  const bloomT = bloomTFor(transformProgress)
  // Halo más difuso → el emblema lee como atmósfera de fondo, no como
  // line-art nítido compitiendo con las líneas de la constelación.
  const bloomRadius = size * (0.02 + bloomT * 0.045)

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Arco — el MARCO: línea continua de alto contraste, así que va
            a su propia opacidad MÁS BAJA que el animal (a igual opacidad
            "gritaría" más por sus bordes nítidos). Es el susurro que
            contiene el cuadro, no un foco. */}
        {arch ? (
          <Group opacity={FRAME_OPACITY}>
            <SkiaImage image={arch} x={archX} y={archY} width={archW} height={archH} fit="fill" />
          </Group>
        ) : null}
        <Group opacity={MASTER_OPACITY}>
          {/* Animal — el frame del % vigente (reveal radial pre-horneado). */}
          {animal ? (
            <SkiaImage image={animal} x={lionX} y={lionY} width={lionW} height={lionH} fit="fill" />
          ) : null}
          {/* Bloom — copia borrosa aditiva que crece hacia el 100 %: el
              emblema gana luz al 80 % y resplandece al completarse. */}
          {animal && bloomT > 0 ? (
            <Group
              layer={
                <Paint opacity={bloomT * BLOOM_MAX_OPACITY} blendMode="screen">
                  <Blur blur={bloomRadius} />
                </Paint>
              }
            >
              <SkiaImage
                image={animal}
                x={lionX}
                y={lionY}
                width={lionW}
                height={lionH}
                fit="fill"
              />
            </Group>
          ) : null}
        </Group>
      </Canvas>
      {/* Laurel ornamental dentro del aro, en la base (cradlea al león). */}
      <View
        style={[
          styles.hojas,
          { top: hojasTop, left: hojasLeft, width: hojasFrame, height: hojasFrame },
        ]}
      >
        <Hojas width="100%" height="100%" opacity={FRAME_OPACITY} />
      </View>
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
          <Glyph width="100%" height="100%" color={colors.oro} opacity={GLYPH_OPACITY} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  glyph: { position: 'absolute' },
  hojas: { position: 'absolute' },
})
