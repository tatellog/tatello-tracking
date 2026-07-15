import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { colors, typography } from '@/theme'

/*
 * AiCta — EL tratamiento canónico de "aquí trabaja la IA" (regla dueña
 * 15 jul 2026: todo lo hecho con IA va highlighted + con sparkles).
 *
 *   Piel única: fondo magentaTint2 + borde magentaGlow + ✦ y texto en
 *   magentaHot. Dos tamaños:
 *   - `pill`  → inline, se centra solo (importar tabla, accesos sueltos).
 *   - `block` → CTA de card a lo ancho (hablar con Stelar, etc.).
 *
 * El motor determinístico JAMÁS usa esta piel (no se disfraza de IA);
 * LinkCta/PrimaryCta siguen siendo los CTAs sin IA.
 */
export function AiCta({
  label,
  onPress,
  accessibilityLabel,
  variant = 'pill',
  disabled = false,
  style,
}: {
  /** Sin ✦ en el string: el sello lo pone el componente. */
  label: string
  onPress: () => void
  accessibilityLabel: string
  variant?: 'pill' | 'block'
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const block = variant === 'block'
  return (
    <View style={[block ? styles.wrapBlock : styles.wrapPill, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}, con inteligencia artificial`}
        style={({ pressed }) => (pressed || disabled) && { opacity: pressed ? 0.8 : 0.5 }}
      >
        <View style={[styles.skin, block && styles.skinBlock]}>
          <Text style={styles.star}>✦</Text>
          <Text style={[styles.text, block && styles.textBlock]}>{label}</Text>
        </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapPill: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  wrapBlock: { alignSelf: 'stretch' },
  skin: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.magentaTint2,
    borderWidth: 1,
    borderColor: colors.magentaGlow,
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  skinBlock: { paddingVertical: 14, paddingHorizontal: 16 },
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
  textBlock: { fontFamily: typography.uiBold },
})
