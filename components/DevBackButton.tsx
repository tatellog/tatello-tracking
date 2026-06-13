import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text } from 'react-native'

import { colors, typography } from '@/theme'

/*
 * Barra de regreso para las vistas /dev-*. Absoluta arriba-izquierda para
 * no descentrar el título de cada catálogo. Vuelve con el historial (un
 * nivel); si la vista se abrió en frío (deep link), cae a Ajustes. El
 * `label` indica a dónde se vuelve (default "Ajustes"; en un detalle
 * anidado pásale el nombre del padre, p. ej. "Signos").
 */
export function DevBackButton({ label = 'Ajustes' }: { label?: string }) {
  const router = useRouter()
  return (
    <Pressable
      onPress={() => {
        if (router.canGoBack()) router.back()
        else router.replace('/settings')
      }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={`Volver a ${label}`}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Text style={styles.text}>‹ {label}</Text>
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
