/*
 * El ícono del smartwatch: caja redondeada con dos tramos de correa. Es la
 * marca de procedencia "esto vino de tu reloj" en toda la app (firma del
 * check-in de Hoy, evidencia y leyenda de Órbita Día). Tintable.
 */
import Svg, { Path, Rect } from 'react-native-svg'

export function WatchGlyph({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={6} y={6} width={12} height={12} rx={3.5} stroke={color} strokeWidth={1.8} />
      <Path d="M9 6 V3.5 H15 V6 M9 18 V20.5 H15 V18" stroke={color} strokeWidth={1.8} />
    </Svg>
  )
}
