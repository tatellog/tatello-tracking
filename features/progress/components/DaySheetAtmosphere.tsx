/*
 * Atmósfera del DayHistorySheet — la capa CELESTE que convierte el bottom sheet
 * de "ficha de día" en "abrir una estrella de tu constelación". Todo es SVG
 * ESTÁTICO (nunca Skia, nunca anima atributos del SVG): un velo de estrellas oro
 * con posiciones fijas + un halo radial dorado detrás de la fecha. Barato y
 * seguro en Android (sin rotate-en-array, sin raster pesado, pointerEvents none).
 *
 * Oro = memoria/pasado: el velo y el halo son siempre dorados, jamás magenta.
 * El magenta se reserva para el único puente al presente (el CTA "Editar día").
 *
 * `GrabberAstro` reemplaza la barrita gris del grabber por un micro-astro de 4
 * puntas (el lenguaje del MilestoneStar) — se ve en cada apertura del sheet.
 */

import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg'

import { colors } from '@/theme'

// Velo de estrellas: posiciones FIJAS (no random → no parpadean entre renders),
// densidad hacia arriba-derecha y vacío abajo-izquierda → "el cielo entra por
// una esquina". Coords en el viewBox 320×120 del header.
const VEIL_STARS = [
  { x: 262, y: 22, r: 1.4, o: 0.34 },
  { x: 290, y: 34, r: 0.9, o: 0.22 },
  { x: 238, y: 15, r: 0.7, o: 0.18 },
  { x: 300, y: 17, r: 1.1, o: 0.26 },
  { x: 210, y: 30, r: 0.6, o: 0.14 },
  { x: 276, y: 52, r: 0.7, o: 0.16 },
  { x: 184, y: 19, r: 0.8, o: 0.15 },
  { x: 312, y: 46, r: 0.6, o: 0.13 },
  { x: 156, y: 26, r: 0.6, o: 0.11 },
  { x: 250, y: 70, r: 0.8, o: 0.12 },
] as const

/**
 * Velo de estrellas + halo dorado del header. Se monta absolute, detrás de la
 * fecha, con pointerEvents="none". Para un día con evento (`hasEvent`) el halo
 * sube apenas — ese día "brilla" un poco más, sin badge.
 */
export function DaySheetAtmosphere({ hasEvent = false }: { hasEvent?: boolean }) {
  const haloPeak = hasEvent ? 0.24 : 0.16
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 320 120"
      preserveAspectRatio="xMidYMin slice"
      pointerEvents="none"
    >
      <Defs>
        {/* Halo radial detrás de donde va la fecha (izquierda-centro). */}
        <RadialGradient id="dhsHalo" cx="30%" cy="46%" r="52%">
          <Stop offset="0%" stopColor={colors.oro} stopOpacity={haloPeak} />
          <Stop offset="58%" stopColor={colors.oro} stopOpacity={0.05} />
          <Stop offset="100%" stopColor={colors.oro} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <Rect x={0} y={0} width={320} height={120} fill="url(#dhsHalo)" />

      {VEIL_STARS.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={colors.oroLight} opacity={s.o} />
      ))}

      {/* El "ancla": una estrella un punto más viva, fuera de centro — la
          imperfección elegante entre puntos quietos. */}
      <Circle cx={226} cy={40} r={1.8} fill={colors.oroLight} opacity={0.4} />
      <Circle cx={226} cy={40} r={3.6} fill={colors.oro} opacity={0.07} />
    </Svg>
  )
}

// Micro-astro de 4 puntas con cintura cóncava (lenguaje del MilestoneStar),
// plano y barato. Centro x=30 en el viewBox 60×12.
const ASTRO_PATH =
  'M30 1.5 C30.7 4.3 31.7 5.3 34.5 6 C31.7 6.7 30.7 7.7 30 10.5 C29.3 7.7 28.3 6.7 25.5 6 C28.3 5.3 29.3 4.3 30 1.5 Z'

/**
 * Grabber-astro: la zona de agarre (barra tenue) con un micro-astro oro al
 * centro. `bright` (día con evento) sube la opacidad del astro a 1 — el grabber
 * mismo insinúa que hay algo especial dentro.
 */
export function GrabberAstro({ bright = false }: { bright?: boolean }) {
  return (
    <Svg width={52} height={12} viewBox="0 0 60 12">
      <Rect x={6} y={5} width={48} height={2} rx={1} fill={colors.oro} opacity={0.16} />
      <Path d={ASTRO_PATH} fill={colors.oro} opacity={bright ? 1 : 0.85} />
    </Svg>
  )
}
