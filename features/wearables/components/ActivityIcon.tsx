import { View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * El ícono de cada entreno (dueña 2 oct 2026: "con íconos como Garmin, pero
 * tipo Apple"). Glifo de trazo redondeado al estilo de Apple Fitness dentro de
 * un círculo con el color de su tipo. SVG propio (no SF Symbols): se ve igual
 * en iPhone y en Android. Colores = identidad del tipo, nunca juicio.
 */

type Glyph =
  | 'bike'
  | 'run'
  | 'walk'
  | 'hike'
  | 'strength'
  | 'yoga'
  | 'swim'
  | 'hiit'
  | 'row'
  | 'elliptical'
  | 'stairs'
  | 'dance'
  | 'generic'

/** Qué glifo toca según el nombre de la actividad (o el tipo canónico). */
export function glyphFor(name: string | null, type: string): Glyph {
  const n = (name ?? '').toLowerCase()
  if (n.includes('bici')) return 'bike'
  if (n.includes('correr') || n.includes('caminadora')) return 'run'
  if (n.includes('sender')) return 'hike'
  if (n.includes('camin')) return 'walk'
  if (n.includes('yoga') || n.includes('pilates')) return 'yoga'
  if (n.includes('nata')) return 'swim'
  if (n.includes('hiit') || n.includes('bootcamp') || n.includes('kick')) return 'hiit'
  if (n.includes('remo')) return 'row'
  if (n.includes('elípt')) return 'elliptical'
  if (n.includes('escal') || n.includes('step')) return 'stairs'
  if (n.includes('baile')) return 'dance'
  if (type === 'fuerza') return 'strength'
  if (type === 'caminata') return 'walk'
  if (type === 'cardio') return 'run'
  return 'generic'
}

/** Un color propio por actividad (theme: colors.activity), en armonía con el
 *  violeta del entreno. Las parecidas comparten tono (correr y caminadora). */
const GLYPH_TINT: Record<Glyph, string> = {
  strength: colors.activity.strength,
  bike: colors.activity.bike,
  run: colors.activity.run,
  walk: colors.activity.walk,
  hike: colors.activity.walk,
  swim: colors.activity.swim,
  row: colors.activity.swim,
  hiit: colors.activity.hiit,
  stairs: colors.activity.hiit,
  yoga: colors.activity.yoga,
  dance: colors.activity.yoga,
  elliptical: colors.activity.bike,
  generic: colors.activity.other,
}

const STROKE = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
}

function GlyphPaths({ g }: { g: Glyph }) {
  switch (g) {
    case 'bike':
      return (
        <>
          <Circle cx={6} cy={16} r={3.6} {...STROKE} />
          <Circle cx={18} cy={16} r={3.6} {...STROKE} />
          <Path d="M6 16 L10 9 H15 L18 16 M10 9 L13 16 H6 M14 6 H16.5" {...STROKE} />
        </>
      )
    case 'run':
      return (
        <>
          <Circle cx={15} cy={4.5} r={1.8} fill="currentColor" />
          <Path
            d="M8 11 L11 8.5 L14.5 9.5 L13 14 L16.5 16.5 L15.5 20.5 M13 14 L9.5 17 L6 16.5 M14.5 9.5 L17.5 12"
            {...STROKE}
          />
        </>
      )
    case 'walk':
      return (
        <>
          <Circle cx={13} cy={4.5} r={1.8} fill="currentColor" />
          <Path
            d="M12.5 8.5 L11 14 L13.5 17 L14.5 21 M11 14 L9 21 M12.5 8.5 L9.5 11 L9 13.5 M12.5 8.5 L15 11.5 L17 12.5"
            {...STROKE}
          />
        </>
      )
    case 'hike':
      return (
        <>
          <Circle cx={12} cy={4.5} r={1.8} fill="currentColor" />
          <Path
            d="M11.5 8.5 L10 14 L12.5 17 L13.5 21 M10 14 L8 21 M11.5 8.5 L14 11 L16 11.5 M17.5 9 L17.5 21"
            {...STROKE}
          />
        </>
      )
    case 'strength':
      return (
        <Path
          d="M4 9.5 V14.5 M7 7.5 V16.5 M17 7.5 V16.5 M20 9.5 V14.5 M7 12 H17"
          {...STROKE}
          strokeWidth={2.2}
        />
      )
    case 'yoga':
      return (
        <>
          <Circle cx={12} cy={5} r={1.8} fill="currentColor" />
          <Path
            d="M12 8.5 V13.5 M5.5 10.5 L12 9.5 L18.5 10.5 M7 18.5 L12 13.5 L17 18.5 M5 18.5 H19"
            {...STROKE}
          />
        </>
      )
    case 'swim':
      return (
        <>
          <Circle cx={16.5} cy={7} r={1.8} fill="currentColor" />
          <Path
            d="M5 12 L9.5 9.5 L13 12.5 M3.5 16 C5.5 14.5 7.5 14.5 9.5 16 C11.5 17.5 13.5 17.5 15.5 16 C17.5 14.5 19.5 14.5 21 16"
            {...STROKE}
          />
        </>
      )
    case 'hiit':
      return <Path d="M13 3 L6.5 13 H11.5 L10.5 21 L17.5 10.5 H12.5 Z" {...STROKE} />
    case 'row':
      return (
        <>
          <Circle cx={9} cy={6} r={1.8} fill="currentColor" />
          <Path d="M9 9.5 L11 14 H16 M11 14 L8 18 M5 18 H19 M13 10 L18 8" {...STROKE} />
        </>
      )
    case 'elliptical':
      return (
        <>
          <Circle cx={12} cy={4.5} r={1.8} fill="currentColor" />
          <Path
            d="M12 8.5 V14 L9 18.5 M12 14 L15 18.5 M8 10.5 L12 9 L16 10.5 M6 20 H18"
            {...STROKE}
          />
        </>
      )
    case 'stairs':
      return <Path d="M4 19 H8 V15 H12 V11 H16 V7 H20" {...STROKE} />
    case 'dance':
      return (
        <>
          <Circle cx={12.5} cy={4.5} r={1.8} fill="currentColor" />
          <Path
            d="M12 8.5 L11 13.5 L14 17 L13 21 M11 13.5 L8.5 17.5 L7 21 M12 8.5 L8 6.5 M12 8.5 L16.5 10.5 L18 7.5"
            {...STROKE}
          />
        </>
      )
    default:
      return (
        <Path
          d="M12 3.5 L14.3 9.7 L20.5 12 L14.3 14.3 L12 20.5 L9.7 14.3 L3.5 12 L9.7 9.7 Z"
          {...STROKE}
        />
      )
  }
}

export function ActivityIcon({
  name,
  type,
  size = 32,
}: {
  /** "Bici", "Correr"… (null si la fuente no lo dijo). */
  name: string | null
  type: string
  size?: number
}) {
  const glyph = glyphFor(name, type)
  const tint = GLYPH_TINT[glyph]
  // Como Apple Fitness: disco oscuro teñido + glifo en el tono (no relleno
  // sólido): se integra al fondo de Stelar en vez de saltar.
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${tint}2E`,
        borderWidth: 1,
        borderColor: `${tint}80`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessible={false}
    >
      <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" color={tint}>
        <GlyphPaths g={glyph} />
      </Svg>
    </View>
  )
}
