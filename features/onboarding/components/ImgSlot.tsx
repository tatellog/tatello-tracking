import { StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, Line, Pattern, Rect, G } from 'react-native-svg'

import { colors, typography } from '@/theme'

type Props = {
  /** "DÍA 1" — el strong prefix renderizado en magenta uppercase. */
  prefix: string
  /** Body de la caption — mono uppercase niebla. */
  caption: string
  /** Override del alto del slot (default 72px). */
  height?: number
}

/*
 * Placeholder visual del prototype HTML — futura ubicación de las
 * fotos de Día 1 / Día 28. Replica:
 *
 *   • Hatching diagonal a 45° (líneas leche alpha 0.025)
 *   • Border dashed bruma 1px (RN no soporta `dashed` borderStyle
 *     uniformemente, así que dibujamos un rectángulo SVG con
 *     strokeDasharray)
 *   • Dot magenta 4×4 en top-left como "registration mark"
 *   • Caption: prefix magenta uppercase + cuerpo niebla mono
 *
 * Producción: este slot se reemplaza por la cámara real una vez que
 * el flujo de captura esté listo. Sirve aquí como teaser visual.
 */
export function ImgSlot({ prefix, caption, height = 72 }: Props) {
  return (
    <View style={[styles.slot, { height }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern
            id="hatch"
            patternUnits="userSpaceOnUse"
            width={12}
            height={12}
            patternTransform="rotate(45)"
          >
            <Line x1={0} y1={0} x2={0} y2={12} stroke="rgba(244,236,222,0.06)" strokeWidth={6} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#hatch)" rx={4} />
        <G>
          <Rect
            x={0.5}
            y={0.5}
            width="99%"
            height="99%"
            fill="none"
            stroke={colors.bruma}
            strokeWidth={1}
            strokeDasharray="4 3"
            rx={4}
          />
        </G>
      </Svg>
      <View style={styles.registrationDot} />
      <View style={styles.captionWrap}>
        <Text style={styles.prefix}>{prefix.toUpperCase()}</Text>
        <Text style={styles.caption}>{caption}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    borderRadius: 4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  registrationDot: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.magenta,
    opacity: 0.6,
  },
  captionWrap: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  prefix: {
    fontFamily: typography.uiBold,
    fontSize: 8.5,
    color: colors.magenta,
    letterSpacing: 1.9,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  caption: {
    fontFamily: typography.uiMedium,
    fontSize: 8.5,
    color: colors.niebla,
    letterSpacing: 1.4,
    textAlign: 'center',
    textTransform: 'uppercase',
    lineHeight: 12,
  },
})
