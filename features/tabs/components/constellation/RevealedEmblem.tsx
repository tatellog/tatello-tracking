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

// 11 frames del reveal radial (0 %, 10 %, …, 100 %). Índice = round(%/10).
const FRAMES = [
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
// Frames del animal por signo (arch.png es compartido). Solo Leo hoy.
const FRAMES_BY_SIGN: Partial<Record<ZodiacSign, readonly number[]>> = {
  leo: FRAMES,
}
const ARCH_SRC = require('@/assets/zodiac-art/arch.png')

// Encaje. El arco llena el cuadrado en altura (enmarca); el animal va
// centrado dentro del aro a LION_WFRAC del ancho.
const ARCH_HFRAC = 0.98
// El aro se ve ligeramente ancho → se estira en alto (sin tocar el ancho)
// para que quede un poco más largo/alto y deje de verse achatado.
const ARCH_VSTRETCH = 1.07
const LION_WFRAC = 0.64
// Centro VISUAL del león (no el geométrico): la melena densa pesa a la
// izquierda y las patas abajo, así que se corre un pelín a la derecha y
// arriba para que quede balanceado dentro del aro.
const LION_CX = 0.515
const LION_CY = 0.475
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
const MASTER_OPACITY = 0.95
// Glifo: sello sutil, no tercer foco (el foco es el león revelándose).
const GLYPH_OPACITY = 0.7

// Bloom: un halo (copia borrosa del animal) que crece hacia el 100 %.
// Arranca temprano (~30 %) para que se sienta "algo se enciende" pronto;
// `screen` satura sin quemar el centro.
const BLOOM_START = 32
const BLOOM_MAX_OPACITY = 0.6

function frameIndexFor(progress: number): number {
  const p = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0))
  return Math.max(0, Math.min(FRAMES.length - 1, Math.round((p / 100) * (FRAMES.length - 1))))
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
  const bloomRadius = size * (0.012 + bloomT * 0.03)

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Group opacity={MASTER_OPACITY}>
          {/* Arco — marco fijo, siempre completo. */}
          {arch ? (
            <SkiaImage image={arch} x={archX} y={archY} width={archW} height={archH} fit="fill" />
          ) : null}
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
        <Hojas width="100%" height="100%" opacity={MASTER_OPACITY} />
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
