import type { StyleProp, ViewStyle } from 'react-native'
import Svg, { Circle, Polyline } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * Mini-sparkline compartida (HistoryChips, CompositionCards): la FORMA del arco,
 * sin ejes ni juicio. El hue es identidad de la métrica (mismo color suba o
 * baje); la dirección la dicen los deltas tipográficos, nunca verde/rojo.
 */
export function Sparkline({
  data,
  hue,
  width = 64,
  height = 18,
  style,
  endNode = false,
}: {
  data: number[]
  hue: string
  width?: number
  height?: number
  /** Por defecto respira bajo texto (marginTop 8); en celdas va centrada. */
  style?: StyleProp<ViewStyle>
  /** Línea = historia, nodo = hoy (Tabla completa): la polyline baja a
   *  susurro y el último valor se enciende (halo + núcleo). */
  endNode?: boolean
}) {
  if (data.length === 0) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  // Con nodo, el rango de x se recoge 4px para que el halo no se recorte.
  const drawW = endNode ? width - 4 : width
  const xy = data.map((v, i) => ({
    x: data.length > 1 ? (i / (data.length - 1)) * drawW : drawW / 2,
    y: height - 2 - ((v - min) / span) * (height - 4),
  }))
  const points = xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const last = xy[xy.length - 1]!
  return (
    <Svg width={width} height={height} style={style ?? { marginTop: 8 }}>
      {endNode ? <Circle cx={last.x} cy={last.y} r={3.2} fill={colors.oroGlow} /> : null}
      <Polyline
        points={points}
        fill="none"
        stroke={hue}
        strokeWidth={endNode ? 1.2 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={endNode ? 0.55 : 0.85}
      />
      {endNode ? <Circle cx={last.x} cy={last.y} r={1.5} fill={colors.oroLight} /> : null}
    </Svg>
  )
}
