import { useState } from 'react'
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'

import { colors, typography } from '@/theme'

import type { CalendarDay, MonthCalendar } from '../month-built'

/*
 * "Tu mes" — el calendario del déficit. Responde "¿en qué días estuviste en
 * déficit?" de un vistazo.
 *
 * El NÚMERO vive dentro de su marca (dueña 26 sep 2026, a lo Apple Fitness): con
 * un punto diminuto sobre el número el mes se leía vacío. Gramática por LUMINANCIA
 * + FORMA, nunca verde/rojo (manifiesto-safe, ni premia ni castiga):
 *   déficit       → círculo oro relleno (el único que brilla)
 *   sobre tu meta → círculo apagado relleno (descansa, sin magenta)
 *   comiste poco  → solo aro frío (cuidado, no logro)
 *   sin registro  → el número tenue, sin marca
 *   futuro        → el número aún más tenue
 * Lógica en `monthCalendar`.
 */

const WD_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const
const MARK_MAX = 34

type Mark = { box: object | null; text: object }

function markFor(status: CalendarDay['status'], future: boolean): Mark {
  if (status === 'deficit') return { box: styles.markDeficit, text: styles.numDeficit }
  if (status === 'surplus') return { box: styles.markSurplus, text: styles.numSurplus }
  if (status === 'low') return { box: styles.markLow, text: styles.numLow }
  return { box: null, text: future ? styles.numFuture : styles.numNone }
}

const STATUS_LABEL: Record<CalendarDay['status'], string> = {
  deficit: 'en déficit',
  surplus: 'sobre tu meta',
  low: 'comiste poco',
  none: 'sin registro',
}

export function MonthGlanceCalendar({
  data,
  onPickDay,
}: {
  data: MonthCalendar
  /** Tocar un día (no futuro) lo abre en el día completo. */
  onPickDay?: (date: string) => void
}) {
  const [w, setW] = useState(0)
  const onLayout = (e: LayoutChangeEvent): void => {
    const next = e.nativeEvent.layout.width
    setW((p) => (Math.abs(p - next) < 1 ? p : next))
  }
  const cell = w > 0 ? w / 7 : 0
  const mark = Math.min(MARK_MAX, Math.max(0, cell - 10))
  const cells: (CalendarDay | null)[] = [...Array(data.leadOffset).fill(null), ...data.days]

  return (
    <View style={styles.section}>
      {/* Leyenda: la misma forma que las marcas, en miniatura. */}
      <View style={styles.legend}>
        <LegendItem kind="deficit" label="déficit" />
        <LegendItem kind="surplus" label="sobre tu meta" />
        {data.hasLow ? <LegendItem kind="low" label="poco" /> : null}
      </View>

      <View style={styles.calendar} onLayout={onLayout}>
        {cell > 0 ? (
          <>
            <View style={styles.weekHead}>
              {WD_INITIALS.map((d, i) => (
                <Text key={i} style={[styles.weekInitial, { width: cell }]}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((c, i) => {
                if (!c) return <View key={i} style={{ width: cell, height: cell }} />
                const m = markFor(c.status, c.future)
                const tappable = !c.future && onPickDay != null
                const circle = (
                  <View
                    style={[
                      styles.mark,
                      { width: mark, height: mark, borderRadius: mark / 2 },
                      m.box,
                      c.isToday && styles.markToday,
                    ]}
                  >
                    <Text style={[styles.num, m.text, c.isToday && styles.numToday]}>{c.day}</Text>
                  </View>
                )
                return (
                  <View key={i} style={[styles.cellBox, { width: cell, height: cell }]}>
                    {tappable ? (
                      <Pressable
                        onPress={() => onPickDay!(c.date)}
                        hitSlop={2}
                        accessibilityRole="button"
                        accessibilityLabel={`Día ${c.day}, ${STATUS_LABEL[c.status]}. Abrir el día.`}
                        style={({ pressed }) => [styles.cellFill, pressed && styles.cellPressed]}
                      >
                        {circle}
                      </Pressable>
                    ) : (
                      circle
                    )}
                  </View>
                )
              })}
            </View>
          </>
        ) : null}
      </View>
    </View>
  )
}

function LegendItem({ kind, label }: { kind: CalendarDay['status']; label: string }) {
  const m = markFor(kind, false)
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, m.box]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  )
}

const SURPLUS_FILL = 'rgba(188, 150, 128, 0.22)'
const LOW_RING = 'rgba(150, 158, 172, 0.6)'

const styles = StyleSheet.create({
  section: {
    marginTop: 10,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  calendar: {
    marginTop: 14,
  },
  weekHead: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekInitial: {
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 0.5,
    color: colors.niebla,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cellBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // El Pressable llena la celda y centra la marca (no toca el ancho del grid).
  cellFill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellPressed: {
    opacity: 0.55,
    transform: [{ scale: 0.94 }],
  },
  // ── La marca: un círculo con el número adentro ──
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markDeficit: {
    backgroundColor: colors.oroSoft,
  },
  markSurplus: {
    backgroundColor: SURPLUS_FILL,
  },
  markLow: {
    borderWidth: 1.5,
    borderColor: LOW_RING,
  },
  // Hoy: aro claro de orientación, sobre cualquier estado.
  markToday: {
    borderWidth: 1.5,
    borderColor: colors.leche,
  },
  num: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    fontVariant: ['tabular-nums'],
  },
  numDeficit: { color: colors.bg },
  numSurplus: { color: colors.bone },
  numLow: { color: colors.bone },
  numNone: { color: colors.niebla },
  numFuture: { color: colors.niebla, opacity: 0.4 },
  numToday: { fontFamily: typography.uiBold },
})
