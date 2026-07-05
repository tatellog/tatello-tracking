import { useState } from 'react'
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg'

import { colors, typography } from '@/theme'

import { deficitTrajectoryRead, type MonthChangeCategory } from '../month-built'

/*
 * "Así se movió tu déficit" — el cierre del mes sobre el NORTE, reconcebido a
 * CONCLUSIÓN + FOCO (no una rejilla ni un gráfico suelto). Jerarquía: el
 * takeaway en palabras es el héroe (qué me dice); la trayectoria de 4 semanas es
 * la PRUEBA debajo (con números honestos por semana); y un "foco" cierra con
 * DÓNDE mirar el próximo mes — accionable sin prescribir (Órbita observa, no
 * aconseja: la usuaria deduce). El sujeto es el tiempo, nunca la persona (sin
 * culpa). Sin meta calórica no hay norte → la sección no aparece. Reusa
 * `monthChange` + `deficitTrajectoryRead`. Ver docs/orbita-mes-spec.md §8.
 */

const DEFICIT_COLOR = colors.oroSoft

const weekCounts = (c: MonthChangeCategory): number[] => c.weeks.map((w) => w.count ?? 0)

/* ── La trayectoria (evidencia): sparkline de 4 semanas CON números ────── */

const SPARK_H = 76
const SPARK_PAD_X = 24
const SPARK_TOP = 14
const SPARK_BOT = 12

function Sparkline({
  counts,
  color,
  weeks,
  onPickWeek,
}: {
  counts: number[]
  color: string
  weeks: MonthChangeCategory['weeks']
  /** Tocar la columna de una semana → abre esa semana ISO en Órbita Semana (la
   *  última = en curso → null). */
  onPickWeek?: (weekEnd: string | null) => void
}) {
  const [w, setW] = useState(0)
  const onLayout = (e: LayoutChangeEvent): void => {
    const next = e.nativeEvent.layout.width
    setW((p) => (Math.abs(p - next) < 1 ? p : next))
  }
  // Escala relativa (piso 3): la forma se ve aunque los conteos sean chicos,
  // nunca castiga con "de 7".
  const denom = Math.max(3, ...counts)
  const n = counts.length
  const x = (i: number) => SPARK_PAD_X + (n > 1 ? i / (n - 1) : 0) * (w - 2 * SPARK_PAD_X)
  const y = (v: number) => SPARK_TOP + (1 - v / denom) * (SPARK_H - SPARK_TOP - SPARK_BOT)
  const pts = counts.map((v, i) => ({ x: x(i), y: y(v) }))
  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')
  const area =
    w > 0
      ? `${line} L${pts[pts.length - 1]!.x.toFixed(1)},${SPARK_H - SPARK_BOT} L${pts[0]!.x.toFixed(1)},${SPARK_H - SPARK_BOT} Z`
      : ''
  const lastIdx = pts.length - 1

  return (
    <View style={styles.trajectory} onLayout={onLayout}>
      {w > 0 ? (
        <Svg width={w} height={SPARK_H} pointerEvents="none">
          <Defs>
            <LinearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.18} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#spark-fill)" />
          <Path
            d={line}
            stroke={color}
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {pts.map((p, i) => {
            const isLast = i === lastIdx
            return (
              <G key={i}>
                {isLast ? <Circle cx={p.x} cy={p.y} r={6} fill={color} opacity={0.18} /> : null}
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={isLast ? 3.4 : 2.4}
                  fill={color}
                  opacity={isLast ? 1 : 0.55}
                />
              </G>
            )
          })}
        </Svg>
      ) : null}

      {/* Columnas tappables sobre la gráfica: cada una abre esa semana ISO en
          Órbita Semana (la última = semana en curso → modo normal). */}
      {onPickWeek && w > 0 ? (
        <View style={styles.tapCols}>
          {weeks.map((wk, i) => (
            <Pressable
              key={i}
              style={styles.tapCol}
              accessibilityRole="button"
              accessibilityLabel={`Ver esa semana en Órbita Semana (${wk.count} días en déficit)`}
              onPress={() => onPickWeek(i === weeks.length - 1 ? null : wk.weekEnd)}
            />
          ))}
        </View>
      ) : null}

      {/* Los números por semana — el ancla honesta (sin ellos la altura no dice
          nada). Alineados bajo cada nodo. */}
      <View style={styles.numsRow}>
        {counts.map((c, i) => (
          <Text key={i} style={[styles.num, i === lastIdx && styles.numLast]}>
            {c}
          </Text>
        ))}
      </View>
      <Text style={styles.numsCaption}>
        días en déficit · semana a semana{onPickWeek ? ' · toca una semana' : ''}
      </Text>
    </View>
  )
}

export function MonthShift({
  categories,
  onPickWeek,
}: {
  categories: MonthChangeCategory[]
  onPickWeek?: (weekEnd: string | null) => void
}) {
  // La sección es sobre el NORTE. Sin déficit (p. ej. sin meta calórica) no
  // aparece — nunca cae a otra dimensión (rompería el mensaje único).
  const deficit = categories.find((c) => c.key === 'deficit')
  if (!deficit) return null

  const counts = weekCounts(deficit)
  const traj = deficitTrajectoryRead(counts)

  return (
    <View style={styles.section}>
      {/* El héroe: la conclusión en palabras abre la sección directo (se quitó el
          eyebrow "Así se movió tu déficit" — duplicaba el mensaje). */}
      <Text style={[styles.takeaway, styles.takeawayLead]}>{traj.takeaway}</Text>

      {/* La prueba: la trayectoria con números (solo si hay con qué dibujarla). */}
      {traj.state !== 'low' ? (
        <Sparkline
          counts={counts}
          color={DEFICIT_COLOR}
          weeks={deficit.weeks}
          onPickWeek={onPickWeek}
        />
      ) : null}

      {/* El foco: dónde mirar el próximo mes (accionable, no un mandato). */}
      {traj.focus ? (
        <View style={styles.focus}>
          <Text style={styles.focusEyebrow}>{traj.focusLabel}</Text>
          <Text style={styles.focusText}>{traj.focus}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginTop: 30,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginLeft: 2,
  },
  // El héroe: la conclusión. Es un DATO (observación), no voz emocional de coach
  // → Hanken (declaración clara), no serif italic. El serif se reserva a la voz
  // del coach (la pregunta del tiempo, frases emocionales).
  takeaway: {
    marginTop: 14,
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.headingLg,
    lineHeight: 27,
    letterSpacing: -0.3,
    color: colors.leche,
    paddingHorizontal: 2,
  },
  // Sin eyebrow arriba, el takeaway abre la sección → sin margen superior extra.
  takeawayLead: {
    marginTop: 0,
  },
  // La trayectoria (evidencia de apoyo, no protagonista).
  trajectory: {
    marginTop: 20,
    width: '100%',
  },
  // Columnas invisibles sobre la gráfica (targets de toque de ~1/4 del ancho).
  tapCols: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SPARK_H,
    flexDirection: 'row',
  },
  tapCol: {
    flex: 1,
  },
  numsRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPARK_PAD_X,
  },
  // Números legibles y anclados (no en bruma tenue): son el dato que da sentido.
  num: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
    width: 20,
    textAlign: 'center',
  },
  numLast: {
    fontFamily: typography.uiBold,
    color: colors.leche,
  },
  numsCaption: {
    marginTop: 8,
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.bruma,
    textAlign: 'center',
  },
  // El foco: separado por una regla fina; menor peso que el takeaway pero legible.
  focus: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.oroHairlineSoft,
  },
  focusEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  // El foco es una RECOMENDACIÓN (accionable), no una frase emocional → Hanken
  // (claro), no serif italic.
  focusText: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: 15.5,
    lineHeight: 23,
    color: colors.leche,
  },
})
