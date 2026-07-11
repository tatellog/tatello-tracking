import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

import type { KeptFoco } from '../focos'

/*
 * "Lo que fuiste mirando" — la memoria de focos de MESES ANTERIORES (Stage 2).
 * El foco del mes actual ya vive en la discovery ("Tu foco: …"), así que aquí
 * NO se repite: esto es la memoria a través del tiempo. Read-only a propósito —
 * es un recuerdo, no otra puerta al mismo chat (que se sentía redundante).
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
  /** El mes actual (se excluye: su foco ya está en la discovery). */
  currentMonth: string
}

export function MonthKeptFocos({ focos, currentMonth }: Props) {
  const past = focos.filter((f) => f.month !== currentMonth)
  if (past.length === 0) return null
  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Lo que fuiste mirando</Text>
      {past.map((f) => (
        <View key={`${f.month}:${f.findingId}`} style={styles.row}>
          <Text style={styles.foco}>{f.foco}</Text>
          <Text style={styles.month}>{monthLabel(f.month)}</Text>
        </View>
      ))}
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
  row: { gap: 2 },
  foco: {
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
