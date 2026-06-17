/*
 * DayDetailContent — el cuerpo SOLO-LECTURA del detalle de un día: fecha ·
 * estado · "Registraste ✓" · eventos. Presentación pura, sin side-effects y
 * sin chrome de tarjeta (lo provee quien lo envuelve).
 *
 * Es la ÚNICA fuente del detalle de un día, compartida por:
 *   · DayDetailPanel  (Tab Hoy)      → lo envuelve en su tarjeta + acciones
 *     de edición (marcar entrené/descansé) como `footer`.
 *   · DayHistorySheet (Tab Progreso) → lo envuelve en un bottom sheet de
 *     observación + CTA "Ver día →" como `footer`. NUNCA edita.
 *
 * La edición vive SOLO en el footer de Hoy: nada de mutar datos cruza a este
 * componente. Así Progreso observa, Hoy opera, y no hay dos detalles distintos.
 */

import { type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

import type { CalendarDay, DayRegistered, DayValues } from './logic'

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

export function dateHeading(iso: string): string {
  const [, m, d] = iso.split('-').map(Number) as [number, number, number]
  return `${d} ${MONTHS_ES[(m ?? 1) - 1] ?? ''}`
}

const STATUS_LABEL: Record<CalendarDay['status'], string> = {
  trained: 'Entrenaste',
  rested: 'Descansaste',
  empty: 'Sin registro',
}

// Orden + etiqueta de cada check de "Registraste".
const REGISTERED_ITEMS: { key: keyof DayRegistered; label: string }[] = [
  { key: 'comida', label: 'Comida' },
  { key: 'agua', label: 'Agua' },
  { key: 'sueno', label: 'Sueño' },
  { key: 'energia', label: 'Energía' },
  { key: 'peso', label: 'Peso' },
  { key: 'ciclo', label: 'Ciclo' },
]

function formatSleep(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** Filas de VALORES reales del día (label · valor). Omite lo no registrado. */
function dataRowsFor(v: DayValues): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  if (v.mealCount != null && v.mealCount > 0)
    rows.push({
      label: 'Comida',
      value: `${v.mealCount} ${v.mealCount === 1 ? 'comida' : 'comidas'}`,
    })
  if (v.proteinG != null && v.proteinG > 0)
    rows.push({ label: 'Proteína', value: `${Math.round(v.proteinG)} g` })
  if (v.calories != null && v.calories > 0)
    rows.push({ label: 'Calorías', value: `${Math.round(v.calories)} kcal` })
  if (v.waterGlasses != null && v.waterGlasses > 0)
    rows.push({
      label: 'Agua',
      value: `${v.waterGlasses} ${v.waterGlasses === 1 ? 'vaso' : 'vasos'}`,
    })
  if (v.sleepMinutes != null) rows.push({ label: 'Sueño', value: formatSleep(v.sleepMinutes) })
  if (v.energy != null) rows.push({ label: 'Energía', value: `${v.energy} / 5` })
  if (v.weightKg != null) rows.push({ label: 'Peso', value: `${v.weightKg.toFixed(1)} kg` })
  if (v.onPeriod) rows.push({ label: 'Ciclo', value: 'Día de ciclo' })
  return rows
}

/** Platillo individual del día (subconjunto de Meal) para la lista de Historia. */
export type DayMeal = { id: string; name: string; calories: number | null }

export function DayDetailContent({
  day,
  showValues = false,
  meals,
  footer,
}: {
  day: CalendarDay
  /** Historia (Progreso): muestra VALORES reales. Hoy lo deja en false →
   *  solo presencia (sin métricas, como decidió el manifiesto para Hoy). */
  showValues?: boolean
  /** Platillos registrados ese día (solo Historia). Si vienen, reemplazan el
   *  agregado "Comida · N comidas" por la lista real. */
  meals?: readonly DayMeal[]
  footer?: ReactNode
}) {
  const checks = REGISTERED_ITEMS.filter((it) => day.registered[it.key])
  const showMeals = showValues && meals != null && meals.length > 0
  // Con la lista de platillos, el agregado "Comida · N comidas" sobra.
  const dataRows = (showValues ? dataRowsFor(day.values) : []).filter(
    (r) => !(showMeals && r.label === 'Comida'),
  )
  const hasEvents = day.events.length > 0

  return (
    <View>
      <Text style={styles.date}>{dateHeading(day.date)}</Text>

      {/* Estado */}
      <Text style={styles.eyebrow}>Estado</Text>
      <Text style={styles.statusLine}>{STATUS_LABEL[day.status]}</Text>

      {/* Historia: VALORES reales de ese día (proteína, calorías, sueño…). */}
      {showValues && dataRows.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Lo que registraste</Text>
          <View style={styles.dataList}>
            {dataRows.map((r) => (
              <View key={r.label} style={styles.dataRow}>
                <Text style={styles.dataLabel}>{r.label}</Text>
                <Text style={styles.dataValue}>{r.value}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Historia: los platillos reales del día (nombre + kcal). */}
      {showMeals ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Comidas</Text>
          <View style={styles.mealList}>
            {meals!.map((m) => (
              <View key={m.id} style={styles.mealRow}>
                <Text style={styles.mealName} numberOfLines={1}>
                  {m.name}
                </Text>
                {m.calories != null ? (
                  <Text style={styles.mealKcal}>{Math.round(m.calories)} kcal</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Hoy: presencia (✓), no métricas — solo cuando NO mostramos valores. */}
      {!showValues && checks.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Registraste</Text>
          <View style={styles.checkWrap}>
            {checks.map((it) => (
              <View key={it.key} style={styles.checkChip}>
                <Text style={styles.checkMark}>✓</Text>
                <Text style={styles.checkLabel}>{it.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Evento(s) — revelaciones de ese día. Se listan TODAS (cada una en
          su línea): así no hay "+N" críptico y se ve qué pasó realmente. */}
      {hasEvents ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>{day.events.length > 1 ? 'Eventos' : 'Evento'}</Text>
          <View style={styles.eventList}>
            {day.events.map((ev) => (
              <View key={ev.id} style={styles.eventRow}>
                <View style={styles.eventDot} />
                <Text style={styles.eventTitle}>{ev.title}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {footer}
    </View>
  )
}

const styles = StyleSheet.create({
  date: {
    fontFamily: typography.displayHeavy,
    fontSize: 20,
    color: colors.leche,
    letterSpacing: -0.4,
    textTransform: 'capitalize',
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginTop: 14,
    marginBottom: 6,
  },
  statusLine: {
    fontFamily: typography.uiMedium,
    fontSize: 16,
    color: colors.bone,
  },
  section: {},
  // "Lo que registraste" — filas label · valor (Historia).
  dataList: {
    gap: 9,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  dataLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 14,
    color: colors.niebla,
  },
  dataValue: {
    fontFamily: typography.uiSemi,
    fontSize: 14,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  // "Comidas" — lista de platillos (nombre · kcal).
  mealList: {
    gap: 7,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  mealName: {
    flexShrink: 1,
    fontFamily: typography.uiMedium,
    fontSize: 14,
    color: colors.bone,
  },
  mealKcal: {
    fontFamily: typography.uiMedium,
    fontSize: 13,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  // Registraste — chips de presencia (✓ + etiqueta).
  checkWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.oroHairlineSoft,
  },
  checkMark: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    color: colors.magenta,
  },
  checkLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 12.5,
    color: colors.bone,
  },
  // Evento(s)
  eventList: {
    gap: 7,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.oro,
  },
  eventTitle: {
    flexShrink: 1,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.oroLight,
  },
})
