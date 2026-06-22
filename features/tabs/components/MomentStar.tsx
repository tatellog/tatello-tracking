import Svg, { Circle, Path } from 'react-native-svg'

import { colors } from '@/theme'

// Estrella de 4 puntas cóncava (centro 12, radio 9) — misma familia que el
// resto del sistema celeste.
const STAR_PATH =
  'M12 3 C12.7 8.3 13.7 9.3 21 12 C13.7 14.7 12.7 15.7 12 21 C11.3 15.7 10.3 14.7 3 12 C10.3 9.3 11.3 8.3 12 3 Z'

/*
 * MomentStar — el marcador de un momento del día. NO es un checkbox: es una
 * estrella. `lit` (registrado) = estrella de oro encendida; sin `lit`
 * (pendiente) = una órbita dormida en niebla, con un lugar para la luz que aún
 * no llega. El mismo glifo evoluciona (órbita → estrella), como la mecánica de
 * la constelación: lo que cambia es la luz, no la forma. Oro, no magenta —
 * el magenta es de la luna y el CTA.
 */
export function MomentStar({
  lit,
  awaiting = false,
  size = 24,
}: {
  lit: boolean
  /** El próximo momento por registrar — se marca en magenta (= acción/CTA)
   *  para que se lea como tappable, no como adorno. Solo UNO a la vez. */
  awaiting?: boolean
  size?: number
}) {
  if (lit) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {/* Órbita tenue que ya "respira" detrás de la estrella encendida. */}
        <Circle cx={12} cy={12} r={9} stroke={colors.oro} strokeWidth={0.6} opacity={0.28} />
        <Path d={STAR_PATH} fill={colors.oro} />
        <Circle cx={12} cy={12} r={2} fill={colors.oroLight} />
      </Svg>
    )
  }
  if (awaiting) {
    // El que toca ahora — anillo magenta + núcleo lleno: "te espera, tócame".
    // El magenta = el lenguaje de acción del CTA (consistente con el `+` de Hoy).
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={9} stroke={colors.magenta} strokeWidth={1.1} opacity={0.55} />
        <Circle cx={12} cy={12} r={8} stroke={colors.magenta} strokeWidth={1.1} />
        <Circle cx={12} cy={12} r={2.6} fill={colors.magenta} />
      </Svg>
    )
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Órbita dormida + núcleo hueco — una estrella por encenderse. */}
      <Circle cx={12} cy={12} r={8} stroke={colors.niebla} strokeWidth={0.9} opacity={0.5} />
      <Circle cx={12} cy={12} r={2.4} stroke={colors.niebla} strokeWidth={0.9} opacity={0.55} />
    </Svg>
  )
}
