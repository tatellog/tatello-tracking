import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text } from 'react-native'

import { colors, typography } from '@/theme'

/*
 * Barra de regreso a Ajustes para las vistas /dev-*. Absoluta
 * arriba-izquierda para no descentrar el título de cada catálogo. Vuelve
 * con el historial; si la vista se abrió en frío (deep link), cae a
 * Ajustes.
 */
export function DevBackButton() {
  const router = useRouter()
  return (
    <Pressable
      onPress={() => {
        if (router.canGoBack()) router.back()
        else router.replace('/settings')
      }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Volver a Ajustes"
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Text style={styles.text}>‹ Ajustes</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    top: 8,
    left: 14,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  pressed: { opacity: 0.6 },
  text: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
  },
})
