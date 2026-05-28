import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

/*
 * Honest framing for the órbita segments while the engine is mock.
 * The Voz de Stelar, the patterns and the archetype rendered below
 * are placeholder examples — this banner says so plainly, so the
 * user is never told they've been "read" when they haven't. Removed
 * automatically once ENGINE_ACTIVE flips true.
 */
export function PreviewBanner() {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Vista previa</Text>
      <Text style={styles.body}>
        El motor de Stelar aún no lee tu data. Lo de abajo es un ejemplo de cómo se verá tu lectura.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // Dashed edge — reads as a meta-note about the screen, not as one
  // of the content cards.
  card: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderStyle: 'dashed',
    backgroundColor: colors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 4,
  },
  body: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.bone,
  },
})
