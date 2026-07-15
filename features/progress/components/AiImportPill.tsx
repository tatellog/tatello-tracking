import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { colors, typography } from '@/theme'

/** El sello IA de "Importar de foto o PDF" (regla dueña 15 jul 2026: todo lo
 *  hecho con IA va highlighted + sparkles). Un solo nombre, un solo look, en
 *  todos sus hogares (Tabla completa, empty de Cuerpo). Quirk-safe. */
export function AiImportPill({
  onPress,
  style,
}: {
  onPress: () => void
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Importar mediciones desde una foto o PDF, con inteligencia artificial"
        style={({ pressed }) => pressed && { opacity: 0.8 }}
      >
        <View style={styles.pill}>
          <Text style={styles.star}>✦</Text>
          <Text style={styles.text}>Importar de foto o PDF</Text>
        </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.magentaTint2,
    borderWidth: 1,
    borderColor: colors.magentaGlow,
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  star: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.bodyLarge,
    color: colors.magentaHot,
  },
  text: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.magentaHot,
    letterSpacing: 0.2,
  },
})
