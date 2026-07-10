import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

import type { KeptFoco } from '../focos'

/*
 * "Lo que fuiste mirando" — la memoria cálida de los focos que la usuaria se
 * quedó presente (Stage 2). NO es un historial de experimentos con veredicto:
 * cada fila es un foco, sin pass/fail, sin "muy pronto". Tocar una fila reabre
 * la conversación de ese hallazgo (si sigue en el mes actual).
 */

const MESES = [
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
]

/** 'YYYY-MM' → "julio". Vacío si no parsea. */
function monthLabel(month: string): string {
  const m = Number(month.slice(5, 7))
  return MESES[m - 1] ?? ''
}

type Props = {
  focos: KeptFoco[]
  /** Reabre el chat del hallazgo si sigue disponible en el mes actual. */
  onReopen: (findingId: string) => void
  /** Ids de hallazgos disponibles ahora (para saber si la fila es tocable). */
  availableIds: Set<string>
}

export function MonthKeptFocos({ focos, onReopen, availableIds }: Props) {
  if (focos.length === 0) return null
  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Lo que fuiste mirando</Text>
      {focos.map((f) => {
        const canReopen = availableIds.has(f.findingId)
        return (
          <Pressable
            key={`${f.month}:${f.findingId}`}
            style={({ pressed }) => [styles.row, pressed && canReopen && styles.rowPressed]}
            onPress={() => canReopen && onReopen(f.findingId)}
            disabled={!canReopen}
            accessibilityRole={canReopen ? 'button' : 'text'}
            accessibilityLabel={f.subject}
          >
            <Text style={styles.subject}>{f.subject}</Text>
            <Text style={styles.month}>{monthLabel(f.month)}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 12, paddingHorizontal: 4 },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  row: { gap: 2, paddingVertical: 4 },
  rowPressed: { opacity: 0.55 },
  subject: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  month: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    textTransform: 'capitalize',
  },
})
