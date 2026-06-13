import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  Line,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg'

import { colors, typography } from '@/theme'

import type { DiaSemana } from '../week-logic'
import { logBrightness } from '../week-logic'

/*
 * Mapa Semanal (Órbita Semana, PRD V1) — los 7 días en una FILA (DOM→SAB),
 * leídos como un renglón. Cada día se ilumina por su CANTIDAD DE REGISTROS
 * (signalCount, no calidad): más registros = más brillo. Reemplaza la
 * galaxia espiral, que respondía la pregunta de Día (calidad) y era cara
 * (60 motas animadas + Skia por día).
 *
 *   · 0 registros  → anillo punteado tenue ("tranquilo", nunca "fallaste").
 *   · día futuro   → un punto apenas visible ("aún no llega").
 *   · 1..6         → estrella cuyo halo + núcleo crecen con el conteo.
 *   · hoy          → un aro magenta fino (no tamaño extra: no debe dominar
 *                    el escaneo de repetición).
 *
 * El HILO "En Luz" (color de la dimensión) conecta SOLO los días donde
 * ocurrió el comportamiento más repetido — "esto se repitió" dibujado a
 * través de la semana ("siempre los martes" se vuelve visible).
 *
 * Performance: SVG estático, sin loops, sin Skia. Una sola entrada FadeIn
 * one-shot al montar; cero costo en reposo.
 */

const VB_W = 320
const VB_H = 92
const NODE_Y = 40
const LABEL_Y = 76
const X0 = 28
const STEP = (VB_W - X0 * 2) / 6 // 7 nodos equiespaciados

const nodeX = (i: number): number => X0 + i * STEP

type Props = {
  days: readonly DiaSemana[]
  todayIdx: number
  /** Índices (Sunday-first) del comportamiento "En Luz" — el hilo los conecta. */
  enLuzDays?: readonly number[]
  /** Color de la dimensión del "En Luz" (hilo + marcadores). */
  enLuzColor?: string
}

export function WeekMap({ days, todayIdx, enLuzDays, enLuzColor }: Props) {
  const litDays = days
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i <= todayIdx && days[i]!.signalCount > 0)

  const enLuzPath =
    enLuzDays && enLuzDays.length >= 2
      ? enLuzDays.map((d, k) => `${k === 0 ? 'M' : 'L'}${nodeX(d)} ${NODE_Y}`).join(' ')
      : null

  return (
    <Animated.View entering={FadeIn.duration(420)}>
      <Svg width="100%" height={VB_H} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Defs>
          {/* Glow neutro (leche) — los días brillan por "cuánto registré",
              no por una dimensión: el color queda para el hilo "En Luz". */}
          <RadialGradient id="wk-halo" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.leche} stopOpacity={0.85} />
            <Stop offset="100%" stopColor={colors.leche} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Hilo base — conecta los días vivos, muy tenue. */}
        <Line
          x1={nodeX(0)}
          y1={NODE_Y}
          x2={nodeX(6)}
          y2={NODE_Y}
          stroke={colors.leche}
          strokeWidth={0.5}
          opacity={0.1}
        />

        {/* Hilo "En Luz" — el comportamiento repetido, trazado a través de
            la semana en el color de su dimensión. */}
        {enLuzPath && enLuzColor ? (
          <>
            <Path
              d={enLuzPath}
              stroke={enLuzColor}
              strokeWidth={1.1}
              strokeLinecap="round"
              opacity={0.55}
            />
            {enLuzDays!.map((d) => (
              <Circle key={`el-${d}`} cx={nodeX(d)} cy={NODE_Y} r={2} fill={enLuzColor} />
            ))}
          </>
        ) : null}

        {/* Los nodos por encima del hilo. */}
        {litDays.map(({ d, i }) => {
          const b = logBrightness(d.signalCount)
          return (
            <Circle
              key={`halo-${i}`}
              cx={nodeX(i)}
              cy={NODE_Y}
              r={6 + b * 12}
              fill="url(#wk-halo)"
              opacity={0.16 + b * 0.44}
            />
          )
        })}
        {litDays.map(({ i }) => {
          const b = logBrightness(days[i]!.signalCount)
          return (
            <Circle
              key={`core-${i}`}
              cx={nodeX(i)}
              cy={NODE_Y}
              r={1.4 + b * 1.9}
              fill={colors.leche}
            />
          )
        })}

        {/* Días sin registro (pasado) → anillo punteado; futuros → punto tenue. */}
        {days.map((d, i) => {
          if (i <= todayIdx && d.signalCount > 0) return null
          if (i > todayIdx) {
            return (
              <Circle
                key={`fut-${i}`}
                cx={nodeX(i)}
                cy={NODE_Y}
                r={1}
                fill={colors.leche}
                opacity={0.12}
              />
            )
          }
          return (
            <Circle
              key={`ghost-${i}`}
              cx={nodeX(i)}
              cy={NODE_Y}
              r={3}
              fill="none"
              stroke={colors.leche}
              strokeWidth={0.7}
              strokeDasharray="1.2 2.2"
              opacity={0.22}
            />
          )
        })}

        {/* Hoy — aro fino magenta (no tamaño extra). */}
        <Circle
          cx={nodeX(todayIdx)}
          cy={NODE_Y}
          r={9}
          fill="none"
          stroke={colors.magentaHot}
          strokeWidth={0.8}
          opacity={0.7}
        />

        {/* Etiquetas D L M X J V S — hoy en magenta, el resto en niebla. */}
        {days.map((d, i) => (
          <SvgText
            key={`lbl-${i}`}
            x={nodeX(i)}
            y={LABEL_Y}
            fontSize={9}
            fontFamily={typography.uiMedium}
            fill={i === todayIdx ? colors.magentaHot : colors.niebla}
            textAnchor="middle"
          >
            {d.label}
          </SvgText>
        ))}
      </Svg>
    </Animated.View>
  )
}
