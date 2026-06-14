/*
 * DayDetailPanel — "¿qué pasó ese día?". Aparece debajo del strip cuando hay
 * un día seleccionado. Responde con presencia (estado + checks + evento), NO
 * con métricas (sin kcal, gramos, peso ni horas). Copy plano, sin culpa.
 *
 * Las acciones (marcar/quitar entrené o descansé) son callbacks al padre —
 * el padre maneja mutación, optimismo y haptic. NUNCA disparan celebración.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { colors, typography } from '@/theme'

import type { CalendarDay, DayRegistered } from './logic'

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

function dateHeading(iso: string): string {
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

export type DayDetailPanelProps = {
  day: CalendarDay
  onMarkTrained: (date: string) => void
  onMarkRested: (date: string) => void
  onClearTrained: (date: string) => void
  onClearRested: (date: string) => void
}

function ActionButton({
  label,
  primary,
  onPress,
}: {
  label: string
  primary?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.action,
        primary ? styles.actionPrimary : styles.actionGhost,
        pressed && styles.actionPressed,
      ]}
    >
      <Text
        style={[styles.actionText, primary ? styles.actionTextPrimary : styles.actionTextGhost]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function DayDetailPanel({
  day,
  onMarkTrained,
  onMarkRested,
  onClearTrained,
  onClearRested,
}: DayDetailPanelProps) {
  const checks = REGISTERED_ITEMS.filter((it) => day.registered[it.key])
  const hasEvents = day.events.length > 0

  return (
    <Animated.View
      key={day.date}
      entering={FadeIn.duration(220)}
      style={styles.panel}
      accessibilityLabel={`Detalle de ${dateHeading(day.date)}`}
    >
      <Text style={styles.date}>{dateHeading(day.date)}</Text>

      {/* Estado */}
      <Text style={styles.eyebrow}>Estado</Text>
      <Text style={styles.statusLine}>{STATUS_LABEL[day.status]}</Text>

      {/* Registraste — solo si hubo al menos un registro */}
      {checks.length > 0 ? (
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

      {/* Hoy tiene UNA sola casa: el toggle Entrené/Descansé de arriba (el
          que celebra). Aquí el día de hoy solo se LEE — sin botones que
          dupliquen esa decisión con feedback distinto. Las acciones son solo
          para backfill de días pasados, y nunca celebran. */}
      {day.isToday ? (
        <Text style={styles.todayHint}>El día de hoy se marca arriba, con tu constelación.</Text>
      ) : (
        <View style={styles.actions}>
          {day.status === 'empty' ? (
            <>
              <ActionButton
                label="Marcar entrené"
                primary
                onPress={() => onMarkTrained(day.date)}
              />
              <ActionButton label="Marcar descansé" onPress={() => onMarkRested(day.date)} />
            </>
          ) : null}
          {day.status === 'trained' ? (
            <>
              <ActionButton label="Quitar entrenamiento" onPress={() => onClearTrained(day.date)} />
              <ActionButton label="Marcar descansé" onPress={() => onMarkRested(day.date)} />
            </>
          ) : null}
          {day.status === 'rested' ? (
            <>
              <ActionButton
                label="Marcar entrené"
                primary
                onPress={() => onMarkTrained(day.date)}
              />
              <ActionButton label="Quitar descanso" onPress={() => onClearRested(day.date)} />
            </>
          ) : null}
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 14,
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
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
  // Hoy: solo lectura (la acción vive arriba).
  todayHint: {
    marginTop: 18,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.niebla,
  },
  // Acciones
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  action: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 13,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionPrimary: {
    backgroundColor: colors.magentaTint2,
    borderColor: colors.magenta,
  },
  actionGhost: {
    backgroundColor: 'transparent',
    borderColor: colors.oroHairline,
  },
  actionPressed: {
    opacity: 0.6,
  },
  actionText: {
    fontFamily: typography.uiBold,
    fontSize: 13.5,
    letterSpacing: 0.2,
  },
  actionTextPrimary: {
    color: colors.leche,
  },
  actionTextGhost: {
    color: colors.bone,
  },
})
