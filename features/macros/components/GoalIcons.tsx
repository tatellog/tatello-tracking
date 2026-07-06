import Svg, { Path } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * Line icons for the goal editor (enfoque cards, breakdown headers).
 * One stroke, no heavy fill — same language as share-icons. Tinted by
 * the caller via `color`; default magenta. Drawn on a 24×24 grid.
 */

type IconProps = {
  size?: number
  color?: string
  strokeWidth?: number
}

const DEFAULT_COLOR = colors.magenta

/** Llama — déficit / gasto calórico. */
export function FlameIcon({ size = 22, color = DEFAULT_COLOR, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3c.6 2.4-.4 3.9-1.6 5.1C9 9.6 7.5 11 7.5 13.6a4.5 4.5 0 0 0 9 0c0-1.8-.8-3.2-1.8-4.3.2 1.2-.3 2.1-1 2.6.4-2.2-.6-4.6-1.7-5.9-.2-1.1-.1-2 1-3Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Balanza — mantenimiento. */
export function ScaleIcon({ size = 22, color = DEFAULT_COLOR, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 4v15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M5 19h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M5 7h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path
        d="M5 7 2.5 12.5a2.5 2.5 0 0 0 5 0L5 7Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M19 7l-2.5 5.5a2.5 2.5 0 0 0 5 0L19 7Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Flecha hacia arriba — superávit. */
export function ArrowUpIcon({ size = 22, color = DEFAULT_COLOR, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 19V5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path
        d="M6 11l6-6 6 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Foco — la guía contextual (no consejo). */
export function BulbIcon({ size = 18, color = DEFAULT_COLOR, strokeWidth = 1.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 17.5a5.5 5.5 0 1 1 6 0c-.5.4-.8 1-.8 1.6v.4H9.8v-.4c0-.6-.3-1.2-.8-1.6Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path d="M10 21.5h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  )
}
