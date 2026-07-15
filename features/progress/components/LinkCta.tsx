import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'

import { colors, typography } from '@/theme'

/*
 * LinkCta — el link-con-flecha canónico de Progreso, quirk-safe (auditoría
 * usabilidad dueña 14 jul 2026: varios links "no se alcanzaban a tapear" y
 * los chevrons se iban a su propia línea):
 *
 * - El LAYOUT vive en el View exterior; el Pressable adentro solo envuelve
 *   el texto (patrón AccountRow · estilos de layout directo en un Pressable
 *   rompen su caja táctil en este setup).
 * - La flecha/chevron va DENTRO del mismo string del label — nunca puede
 *   envolver sola a otra línea.
 * - Target táctil real: paddingVertical 10 en el texto + hitSlop 10.
 */
export function LinkCta({
  label,
  onPress,
  accessibilityLabel,
  role = 'link',
  expanded,
  style,
  textStyle,
}: {
  /** Incluye la flecha en el string ("Ver tendencia →", "Ocultar ▴"). */
  label: string
  onPress: () => void
  accessibilityLabel: string
  role?: 'link' | 'button'
  /** Para toggles colapsables (accessibilityState). */
  expanded?: boolean
  /** Layout externo (margins, alignSelf) — vive en el View, no el Pressable. */
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
}) {
  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        onPress={onPress}
        hitSlop={10}
        accessibilityRole={role}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={expanded === undefined ? undefined : { expanded }}
        style={({ pressed }) => pressed && { opacity: 0.6 }}
      >
        <Text style={[styles.text, textStyle]}>{label}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  text: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    letterSpacing: 0.2,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
})
