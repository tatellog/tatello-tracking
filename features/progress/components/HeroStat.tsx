import { StyleSheet, Text, View } from 'react-native'

import { colors, spacing, typography } from '@/theme'

import type { WeightDelta } from '../logic'

type Props = {
  /** Peso actual en kg. */
  weight: number
  /** Delta vs el primer punto del rango. Null si solo hay 1 medida. */
  delta: WeightDelta | null
  /** Etiqueta del rango activo (`7 días`, `30 días`, `Todo`...) para
   *  contextualizar el delta. */
  rangeLabel: string
}

/*
 * Hero stat: peso actual GRANDE en Inter Tight light, con la etiqueta
 * 'kg' al lado en label dim. Abajo, el delta del rango como prefijo
 * mauve cuando hay datos, o 'Sin comparativa' cuando hay 1 sola
 * medida.
 *
 * Va arriba de la gráfica porque es lo primero que el ojo busca al
 * abrir la pantalla; la gráfica es contexto.
 */
export function HeroStat({ weight, delta, rangeLabel }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.numberRow}>
        <Text style={styles.bigNumber}>{weight.toFixed(1)}</Text>
        <Text style={styles.unit}>KG</Text>
      </View>
      {delta ? (
        <Text style={styles.delta}>
          {formatDelta(delta.abs)} KG · {rangeLabel.toUpperCase()}
        </Text>
      ) : (
        <Text style={styles.deltaMuted}>Sin comparativa</Text>
      )}
    </View>
  )
}

function formatDelta(abs: number): string {
  if (abs > 0) return `+${abs.toFixed(1)}`
  // Usamos el guion menos tipográfico (U+2212) para alinear con el
  // resto de la app (DeltaPair hace lo mismo).
  if (abs < 0) return `−${Math.abs(abs).toFixed(1)}`
  return '0.0'
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  bigNumber: {
    fontFamily: typography.display,
    fontSize: typography.sizes.streakNum,
    fontWeight: typography.fontWeight.light,
    color: colors.inkPrimary,
    letterSpacing: typography.letterSpacing.displayTight,
    lineHeight: typography.sizes.streakNum * typography.lineHeight.displayTight,
  },
  unit: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    color: colors.labelDim,
  },
  delta: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.semi,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    color: colors.mauveDeep,
    marginTop: spacing.xs,
  },
  deltaMuted: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    color: colors.labelDim,
    marginTop: spacing.xs,
  },
})
