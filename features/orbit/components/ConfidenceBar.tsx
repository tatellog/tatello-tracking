import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

/*
 * ConfidenceBar — la solidez de un patrón como barra + porcentaje. "Confianza"
 * aquí = cuánto sostuvo el patrón (semanas/ocasiones), no una probabilidad.
 * Reusable en la card y en el detalle.
 */

export function ConfidenceBar({
  confidence,
  tint,
  showLabel = true,
}: {
  confidence: number
  tint: string
  showLabel?: boolean
}) {
  const pct = Math.max(0, Math.min(100, confidence))
  return (
    <View style={styles.wrap}>
      {showLabel ? <Text style={styles.label}>Confianza</Text> : null}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: tint }]} />
      </View>
      <Text style={[styles.value, { color: tint }]}>{pct}%</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3 },
  value: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.body,
    minWidth: 34,
    textAlign: 'right',
  },
})
