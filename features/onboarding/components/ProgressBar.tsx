import { StyleSheet, View } from 'react-native'

import { colors } from '@/theme'

type Props = {
  current: number
  total: number
}

/*
 * Norte progress bar — N segmentos de 3px de alto separados por 4px.
 *
 *   done    → cream sólido (`leche`)
 *   active  → magenta con glow (box-shadow simulado vía sombra RN)
 *   pending → bruma sólido
 *
 * El `current` es 1-indexed; `idx < current` queda "done", `idx ===
 * current` queda "active". No animamos el llenado — la transición
 * de pantalla ya es la señal de progreso.
 */
export function ProgressBar({ current, total }: Props) {
  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: current, min: 0, max: total }}
    >
      {Array.from({ length: total }, (_, i) => {
        const idx = i + 1
        const state = idx < current ? 'done' : idx === current ? 'active' : 'pending'
        return (
          <View
            key={i}
            style={[
              styles.segment,
              state === 'done' && styles.segmentDone,
              state === 'active' && styles.segmentActive,
              state === 'pending' && styles.segmentPending,
            ]}
          />
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
    height: 3,
    width: '100%',
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 1,
  },
  segmentDone: {
    backgroundColor: colors.leche,
  },
  segmentActive: {
    backgroundColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  segmentPending: {
    backgroundColor: colors.bruma,
  },
})
