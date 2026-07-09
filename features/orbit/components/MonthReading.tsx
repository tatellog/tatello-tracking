import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { colors, typography } from '@/theme'

import { DiscoveryWave } from './DiscoveryWave'

/*
 * MonthReading — "Pantalla 1": Stelar juntando tus días antes de mostrar los
 * hallazgos. PROMESA HONESTA: el motor es determinístico (lee lo que se repitió
 * en TUS días), no una IA que "analiza profundo". Antes el copy ("Analizando…
 * Encontrando relaciones…") sobre-prometía y el payoff se sentía fraude. Ahora
 * dice lo que de verdad hace, en 2 beats cortos (~2.2s).
 */

const STEP_MS = 1050

export function MonthReading({ days, onDone }: { days: number; onDone: () => void }) {
  const lines = [`Junté tus últimos ${days} días…`, 'Esto es lo que se repitió.']
  const [step, setStep] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), STEP_MS)
    const done = setTimeout(onDone, STEP_MS * 2 + 150)
    return () => {
      clearTimeout(t1)
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
