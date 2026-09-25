/*
 * "Lo que ya llegó" (spec wearables §9 · modo confirmación de Hoy): la línea
 * que absorbe lo que el reloj ya anotó hoy (sueño, entreno, agua) para que
 * sus componentes dejen de preguntar. Cerrada, es un renglón; "ajustar" la
 * abre y devuelve los componentes de siempre, ya llenos, para corregir
 * (manual gana). Sin número de peso, sin pasos (viven en Semana), sin ✦.
 */
import { Pressable, StyleSheet, Text } from 'react-native'

import { colors, typography } from '@/theme'

import { arrivedSummary, type WearableDayFacts } from '../recovery'

type Props = {
  facts: WearableDayFacts
  expanded: boolean
  onToggle: () => void
}

export function ArrivedLine({ facts, expanded, onToggle }: Props) {
  const summary = arrivedSummary(facts)
  if (!summary) return null

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={{ top: 8, bottom: 8 }}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`Tu reloj ya anotó ${summary}. ${expanded ? 'Toca para cerrar' : 'Toca para ajustar'}.`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.text} numberOfLines={2}>
        <Text style={styles.lead}>Tu reloj ya anotó: </Text>
        {summary}
      </Text>
      <Text style={styles.action}>{expanded ? 'listo' : 'ajustar ›'}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.hairlineFaint,
    backgroundColor: colors.lecheTint,
    marginBottom: 16,
  },
  pressed: { opacity: 0.8 },
  text: {
    flex: 1,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    lineHeight: typography.sizes.body * 1.4,
    letterSpacing: 0.2,
    color: colors.leche,
  },
  lead: {
    fontFamily: typography.uiMedium,
    color: colors.bone,
  },
  action: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
    color: colors.niebla,
  },
})
