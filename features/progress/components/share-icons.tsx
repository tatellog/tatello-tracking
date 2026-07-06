import Svg, { Circle, Line, Path, Rect } from 'react-native-svg'

import { colors } from '@/theme'

/* Iconos simples para los tabs de compartir. Tintados por estado: magenta
 * activo, niebla inactivo. Un trazo, sin relleno pesado — leen claro a 18 px. */

function tint(active: boolean): string {
  return active ? colors.magenta : colors.niebla
}

const SIZE = 18

// ── Entreno ──────────────────────────────────────────────────────────

/** Constelación — tres estrellas conectadas. */
export function ConstelacionIcon({ active }: { active: boolean }) {
  const c = tint(active)
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none">
      <Line x1={6} y1={7} x2={13} y2={11} stroke={c} strokeWidth={1.4} strokeLinecap="round" />
      <Line x1={13} y1={11} x2={18} y2={17} stroke={c} strokeWidth={1.4} strokeLinecap="round" />
      <Circle cx={6} cy={7} r={2.1} fill={c} />
      <Circle cx={13} cy={11} r={1.6} fill={c} />
      <Circle cx={18} cy={17} r={1.4} fill={c} />
    </Svg>
  )
}

/** Momento — una foto/cámara. */
export function MomentoIcon({ active }: { active: boolean }) {
  const c = tint(active)
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={6} width={17} height={13} rx={3} stroke={c} strokeWidth={1.5} />
      <Circle cx={12} cy={12.5} r={3.2} stroke={c} strokeWidth={1.5} />
      <Path d="M8 6 L9.4 4 H14.6 L16 6" stroke={c} strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  )
}

/** Calendario — una grilla de mes con la barra del encabezado. */
export function CalendarioIcon({ active }: { active: boolean }) {
  const c = tint(active)
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={5} width={17} height={15} rx={2.5} stroke={c} strokeWidth={1.5} />
      <Line x1={3.5} y1={9} x2={20.5} y2={9} stroke={c} strokeWidth={1.5} />
      <Line x1={8} y1={3.5} x2={8} y2={6} stroke={c} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={16} y1={3.5} x2={16} y2={6} stroke={c} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  )
}

/** Progreso — barras ascendentes. */
export function ProgresoIcon({ active }: { active: boolean }) {
  const c = tint(active)
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none">
      <Line x1={6} y1={19} x2={6} y2={13} stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={12} y1={19} x2={12} y2={9} stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={18} y1={19} x2={18} y2={5} stroke={c} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  )
}

// ── Cambio visual ────────────────────────────────────────────────────

/** Retrato — dos marcos lado a lado. */
export function RetratoIcon({ active }: { active: boolean }) {
  const c = tint(active)
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={5} width={7.5} height={14} rx={2} stroke={c} strokeWidth={1.5} />
      <Rect x={13} y={5} width={7.5} height={14} rx={2} stroke={c} strokeWidth={1.5} />
    </Svg>
  )
}

/** Transformación — dos marcos con una flecha entre ellos. */
export function TransformacionIcon({ active }: { active: boolean }) {
  const c = tint(active)
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none">
      <Rect x={2.5} y={6} width={6.5} height={12} rx={2} stroke={c} strokeWidth={1.5} />
      <Rect x={15} y={6} width={6.5} height={12} rx={2} stroke={c} strokeWidth={1.5} />
      <Path
        d="M10.4 12 H13.6 M12.4 10.4 L14 12 L12.4 13.6"
        stroke={c}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Cambio — un delta (la cifra grande). */
export function CambioIcon({ active }: { active: boolean }) {
  const c = tint(active)
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5 L19 18 H5 Z" stroke={c} strokeWidth={1.5} strokeLinejoin="round" fill="none" />
    </Svg>
  )
}
