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
// agrupadas en un RACIMO arriba-derecha que se desvanece hacia el centro y deja
// VACÍO el abajo-izquierda → "el cielo entra por una esquina" y la fecha vive en
// el silencio de la otra. Coords en el viewBox 320×104 del header.
const VEIL_STARS = [
  { x: 286, y: 18, r: 1.4, o: 0.36 },
  { x: 302, y: 30, r: 0.9, o: 0.24 },
  { x: 270, y: 13, r: 0.7, o: 0.2 },
  { x: 294, y: 46, r: 0.8, o: 0.18 },
  { x: 312, y: 22, r: 0.6, o: 0.16 },
  { x: 258, y: 34, r: 0.6, o: 0.14 },
  { x: 236, y: 22, r: 0.7, o: 0.13 },
  { x: 248, y: 58, r: 0.6, o: 0.1 },
] as const

/**
 * Velo de estrellas + halo dorado del header. Se monta absolute, detrás de la
 * fecha, con pointerEvents="none". Para un día con evento (`hasEvent`) el halo
 * sube apenas — ese día "brilla" un poco más, sin badge.
 */
export function DaySheetAtmosphere({ hasEvent = false }: { hasEvent?: boolean }) {
  const haloPeak = hasEvent ? 0.3 : 0.2
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 320 240"
      preserveAspectRatio="xMidYMin slice"
      pointerEvents="none"
    >
      <Defs>
        {/* Halo bajo la FECHA: la fecha es la estrella y este halo la enciende.
            CÍRCULO real (userSpaceOnUse, no elipse), que llega a TRANSPARENTE
            dentro de la banda alta → su borde cae en zona invisible y nunca
            deja una "raya" dorada cortada por el overflow del sheet. */}
        <RadialGradient id="dhsHalo" cx={92} cy={50} r={118} gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={colors.oro} stopOpacity={haloPeak} />
          <Stop offset="32%" stopColor={colors.oro} stopOpacity={haloPeak * 0.34} />
          <Stop offset="62%" stopColor={colors.oro} stopOpacity={0.045} />
          <Stop offset="100%" stopColor={colors.oro} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <Rect x={0} y={0} width={320} height={240} fill="url(#dhsHalo)" />

      {VEIL_STARS.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={colors.oroLight} opacity={s.o} />
      ))}

      {/* El "ancla": una estrella un punto más viva, al borde del racimo —
          la imperfección elegante entre puntos quietos. */}
      <Circle cx={224} cy={40} r={1.7} fill={colors.oroLight} opacity={0.42} />
      <Circle cx={224} cy={40} r={3.4} fill={colors.oro} opacity={0.07} />
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
