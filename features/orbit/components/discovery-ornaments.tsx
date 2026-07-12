import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'

import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry/four-point-star-path'
import { colors } from '@/theme'

import { StelarStar } from './MonthChatView'

/*
 * discovery-ornaments — el arte ligero que convierte la card "Este mes encontré
 * algo" de un cuadro de texto en "algo se encendió en tu cielo". Todo SVG
 * estático (RNSVG), sin animación, sin raster: barato y sin riesgo de perf.
 *
 * Vocabulario ya existente en la app (StelarStar, fourPointStarPath): estas
 * piezas lo traen a la card, no inventan un idioma nuevo. Oro = voz/hallazgo de
 * Stelar; magenta = la puerta a la conversación. Sin números decorativos.
 */

/**
 * FindingGlyph — "un hallazgo = estrellas que se conectan". Dos puntos latentes
 * enlazados por una hairline que resuelve en un ✦ oro (el nodo encontrado).
 * Firma del eyebrow. Estático.
 */
export const FindingGlyph = memo(function FindingGlyph({ size = 16 }: { size?: number }) {
  const w = (size * 60) / 20
  return (
    <Svg width={w} height={size} viewBox="0 0 60 20" pointerEvents="none">
      <Line x1={5} y1={14} x2={18} y2={6} stroke={colors.oroHairlineSoft} strokeWidth={0.75} />
      <Line x1={18} y1={6} x2={34} y2={11} stroke={colors.oroHairline} strokeWidth={0.75} />
      <Circle cx={5} cy={14} r={1.3} fill={colors.niebla} opacity={0.55} />
      <Circle cx={18} cy={6} r={1.1} fill={colors.bone} opacity={0.5} />
      {/* El nodo encontrado — ✦ oro con halo y núcleo cálido. */}
      <Circle cx={34} cy={11} r={6.5} fill={colors.oroGlow} opacity={0.5} />
      <Path d={fourPointStarPath(34, 11, 4.4)} fill={colors.oroSoft} />
      <Circle cx={34} cy={10.6} r={1} fill={colors.oroLeche} />
    </Svg>
  )
})

/**
 * CardAura — halo descentrado detrás de la card. No es un contenedor (sería un
 * panel, rompe el quiet luxury): es el cosmos un poco más encendido AQUÍ. Oro
 * (hallazgo) fundido a magenta (la puerta), disuelto a transparente. Se dibuja
 * en absoluteFill detrás del contenido; necesita las dimensiones medidas.
 */
export function CardAura({ width, height }: { width: number; height: number }) {
  if (width <= 0 || height <= 0) return null
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="card-aura" cx="15%" cy="24%" r="90%">
          <Stop offset="0" stopColor={colors.oro} stopOpacity={0.1} />
          <Stop offset="0.45" stopColor={colors.magenta} stopOpacity={0.045} />
          <Stop offset="1" stopColor={colors.magenta} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#card-aura)" />
    </Svg>
  )
}

/**
 * CtaStar — la ✦ del CTA como UMBRAL iluminado (un pozo de luz oro detrás), no
 * un ícono pegado. Hace que el botón se lea como "puerta a una conversación".
 */
export function CtaStar() {
  return (
    <View style={styles.ctaStar}>
      <Svg
        width={28}
        height={28}
        viewBox="0 0 28 28"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id="cta-door" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.oroSoft} stopOpacity={0.38} />
            <Stop offset="1" stopColor={colors.oroSoft} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={14} cy={14} r={13} fill="url(#cta-door)" />
      </Svg>
      <StelarStar size={16} />
    </View>
  )
}

/**
 * SealDivider — el "sello celeste" que cierra la card cuando NO hay palanca:
 * hairline oro que se disuelve hacia un ✦ central. "El cielo descansa aquí".
 * Cierre digno, sin inventar foco ni número.
 */
export function SealDivider() {
  return (
    <Svg width="100%" height={16} viewBox="0 0 200 16" preserveAspectRatio="xMidYMid meet">
      <Defs>
        <LinearGradient id="seal" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.oro} stopOpacity={0} />
          <Stop offset="0.5" stopColor={colors.oro} stopOpacity={0.42} />
          <Stop offset="1" stopColor={colors.oro} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Line x1={16} y1={8} x2={82} y2={8} stroke="url(#seal)" strokeWidth={1} />
      <Line x1={118} y1={8} x2={184} y2={8} stroke="url(#seal)" strokeWidth={1} />
      <Circle cx={100} cy={8} r={7} fill={colors.oroGlow} opacity={0.4} />
      <Path d={fourPointStarPath(100, 8, 4)} fill={colors.oroSoft} />
    </Svg>
  )
}

const styles = StyleSheet.create({
  ctaStar: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
})
