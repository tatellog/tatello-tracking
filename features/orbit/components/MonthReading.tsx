import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { colors, typography } from '@/theme'

import { DiscoveryWave } from './DiscoveryWave'

/*
 * MonthReading — "Pantalla 1": Stelar leyendo tu mes antes de mostrar los
 * hallazgos. La onda dorada + un texto que cicla ("Leyendo tu mes…" →
 * "Analizando N días…" → "Encontrando relaciones…"). Dura ~3.5s y luego revela
 * los patrones. Mientras, el motor ya los tiene.
 */

const STEP_MS = 1150

export function MonthReading({ days, onDone }: { days: number; onDone: () => void }) {
  const lines = ['Leyendo tu mes…', `Analizando ${days} días…`, 'Encontrando relaciones…']
  const [step, setStep] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), STEP_MS)
    const t2 = setTimeout(() => setStep(2), STEP_MS * 2)
    const done = setTimeout(onDone, STEP_MS * 3 + 150)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(done)
    }
  }, [onDone])

  return (
    <View style={styles.wrap}>
      <DiscoveryWave width={220} />
      <Animated.Text key={step} entering={FadeIn.duration(360)} style={styles.line}>
        {lines[step]}
      </Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 22 },
  line: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    color: colors.oroSoft,
    textAlign: 'center',
  },
})
