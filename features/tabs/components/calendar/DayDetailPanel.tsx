/*
 * DayDetailPanel — "¿qué pasó ese día?" en el Tab HOY. Aparece debajo del
 * strip cuando hay un día seleccionado. El cuerpo (estado + checks + eventos)
 * es `DayDetailContent` compartido; este wrapper le agrega la tarjeta y las
 * ACCIONES de edición (marcar/quitar entrené o descansé) como footer.
 *
 * La edición vive SOLO aquí (Hoy). Las acciones son callbacks al padre — el
 * padre maneja mutación, optimismo y haptic. NUNCA disparan celebración.
 * Progreso consume el mismo `DayDetailContent` pero en modo observación, sin
 * estas acciones (ver DayHistorySheet).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { usePressFeedback } from '@/components/ui/interaction'
import { useMealsForDate } from '@/features/macros/hooks'
import { emitReplayReveal } from '@/features/revelations'
import { colors, typography } from '@/theme'

import { DayDetailContent, dateHeading } from './DayDetailContent'
import type { CalendarDay } from './logic'

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
  // Scale on press from the interaction system (haptic off — the parent fires
  // the backfill haptic). The Pressable carries only the flex sizing; the
  // chrome + scale live on the inner Animated.View (border/bg/flex don't render
  // reliably straight on a Pressable in this RN setup).
  const { onPressIn, onPressOut, animatedStyle } = usePressFeedback({ haptic: false })
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.actionHit}
    >
      <Animated.View
        style={[styles.action, primary ? styles.actionPrimary : styles.actionGhost, animatedStyle]}
      >
        <Text
          style={[styles.actionText, primary ? styles.actionTextPrimary : styles.actionTextGhost]}
        >
          {label}
        </Text>
      </Animated.View>
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
  // Días PASADOS: mostramos los VALORES reales de ese día (proteína, sueño…)
  // + sus platillos — son los datos DE ESE DÍA, no los de hoy. El día de HOY
  // se queda en presencia (sin métricas), por el manifiesto.
  const past = !day.isToday
  const mealCount = day.values.mealCount ?? 0
  const mealsQuery = useMealsForDate(past ? day.date : null, {
    enabled: past && mealCount > 0,
  })

  // Hoy tiene UNA sola casa: el toggle Entrené/Descansé de arriba (el que
  // celebra). Aquí el día de hoy solo se LEE — sin botones que dupliquen esa
  // decisión con feedback distinto. Las acciones son solo para backfill de
  // días pasados, y nunca celebran.
  const footer = day.isToday ? (
    <Text style={styles.todayHint}>El día de hoy se marca arriba, con tu constelación.</Text>
  ) : (
    <View style={styles.actions}>
      {day.status === 'empty' ? (
        <>
          <ActionButton label="Marcar entrené" primary onPress={() => onMarkTrained(day.date)} />
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
          <ActionButton label="Marcar entrené" primary onPress={() => onMarkTrained(day.date)} />
          <ActionButton label="Quitar descanso" onPress={() => onClearRested(day.date)} />
        </>
      ) : null}
    </View>
  )

  return (
    <Animated.View
      key={day.date}
      entering={FadeIn.duration(220)}
      style={styles.panel}
      accessibilityLabel={`Detalle de ${dateHeading(day.date)}`}
    >
      <DayDetailContent
        day={day}
        showValues={past}
        meals={past ? mealsQuery.data : undefined}
        footer={footer}
        onEventPress={(ev) =>
          emitReplayReveal({
            tier: ev.tier ?? '',
            kind: ev.kind ?? '',
            message: ev.message ?? ev.title,
          })
        }
      />
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
  // Hoy: solo lectura (la acción vive arriba).
  todayHint: {
    marginTop: 18,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
  },
  // Acciones
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  actionHit: {
    flex: 1,
  },
  action: {
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
  actionText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
  },
  actionTextPrimary: {
    color: colors.leche,
  },
  actionTextGhost: {
    color: colors.bone,
  },
})
