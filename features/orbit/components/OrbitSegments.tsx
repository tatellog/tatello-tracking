import * as Haptics from 'expo-haptics'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

/* The three time-altitudes of Tu Órbita — see docs/tu-orbita-design.md.
 * Labelled "Día" (not "Hoy") so it doesn't collide with the top-level
 * Hoy tab: that tab registers the day, this segment reads it. */
export type OrbitSegment = 'dia' | 'semana' | 'mes'

const SEGMENTS: { key: OrbitSegment; label: string }[] = [
  { key: 'dia', label: 'Día' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
]

/* A stadium pill holding the three altitudes — same shape as the
 * Progreso period selector so the app's segmented controls feel like
 * one family. The active altitude takes a magenta-tint capsule. */
export function OrbitSegments({
  value,
  onChange,
}: {
  value: OrbitSegment
  onChange: (next: OrbitSegment) => void
}) {
  return (
    <View style={styles.pill}>
      {SEGMENTS.map(({ key, label }) => {
        const on = key === value
        return (
          <Pressable
            key={key}
            onPress={() => {
              if (on) return
              Haptics.selectionAsync().catch(() => {})
              onChange(key)
            }}
            style={[styles.seg, on && styles.segOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderRadius: 22,
    padding: 4,
  },
  seg: {
    flex: 1,
    height: 34,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segOn: {
    backgroundColor: colors.magentaTint2,
  },
  label: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    letterSpacing: 1.4,
  },
  labelOn: {
    color: colors.magentaHot,
  },
})
