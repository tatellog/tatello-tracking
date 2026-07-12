import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

import { useBodyComposition, useBodyCompositionIsMock } from '../hooks'
import { compositionSummary, type CompositionMetric } from '../logic'

/*
 * Cards de composición corporal (Epic 02 · Body). Muestran SOLO las métricas
 * con datos reales de la ingesta wearable (grasa / masa magra / IMC) — sin
 * cascarones vacíos: si la usuaria no conectó báscula/salud, la sección entera
 * no existe. El delta va en oro (sin rojo/verde: el cuerpo no se juzga), y es
 * evidencia de cambio, no diagnóstico (manifiesto). Agua/visceral/edad
 * metabólica/TMB llegarán cuando exista una fuente que los mida.
 */

const LABEL: Record<CompositionMetric['key'], { name: string; unit: string }> = {
  body_fat_pct: { name: 'Grasa corporal', unit: '%' },
  lean_body_mass_kg: { name: 'Masa magra', unit: 'kg' },
  bmi: { name: 'IMC', unit: '' },
}

function fmtDelta(d: number, unit: string): string {
  const sign = d < 0 ? '−' : '+'
  return `${sign}${Math.abs(d).toFixed(1)}${unit ? ` ${unit}` : ''}`
}

export function CompositionCards() {
  const { data } = useBodyComposition(null)
  const isMock = useBodyCompositionIsMock()
  const cards = compositionSummary(data ?? [])
  if (cards.length === 0) return null

  return (
    <Animated.View entering={FadeIn.duration(360).delay(120)}>
      {/* Divisor propio: solo existe cuando la sección tiene datos. */}
      <View style={styles.divider} />
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Tu composición
      </EyebrowLabel>
      <View style={styles.grid}>
        {cards.map((c) => {
          const meta = LABEL[c.key]
          return (
            <View key={c.key} style={styles.card}>
              <Text style={styles.cardLabel}>{meta.name}</Text>
              <View style={styles.valueRow}>
                <Text style={styles.value}>{c.current}</Text>
                {meta.unit ? <Text style={styles.unit}>{meta.unit}</Text> : null}
              </View>
              {c.delta != null && c.delta !== 0 ? (
                <Text style={styles.delta}>{fmtDelta(c.delta, meta.unit)}</Text>
              ) : (
                <Text style={styles.deltaMuted}>primera medición</Text>
              )}
            </View>
          )
        })}
      </View>
      <Text style={styles.note}>
        {isMock
          ? 'Datos de ejemplo · así se verá cuando conectes tu báscula o salud.'
          : 'De tu báscula o salud conectada. Evidencia, no veredicto.'}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', marginVertical: 28 },
  eyebrow: { marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 6 },
  value: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displaySm,
    color: colors.leche,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontFamily: typography.uiMedium, fontSize: typography.sizes.body, color: colors.bone },
  // Delta en ORO: cambio como evidencia, nunca juicio rojo/verde.
  delta: {
    marginTop: 4,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  deltaMuted: {
    marginTop: 4,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
  note: {
    marginTop: 10,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
