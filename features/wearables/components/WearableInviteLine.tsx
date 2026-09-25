/*
 * La invitación contextual a conectar el reloj (spec wearables §5): una línea
 * quieta bajo el check-in de Hoy, en el lugar exacto que automatiza. Dice qué
 * ahorra ("anota por ti"), nunca promete métricas ni empuja. "Ahora no" la
 * retira para siempre; la conexión sigue viva en Ajustes → Conexiones.
 */
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

import { useWearableInvite } from '../hooks'

export function WearableInviteLine() {
  const router = useRouter()
  const { show, dismiss } = useWearableInvite()
  if (!show) return null

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          track('wearable_invite_tap', { source: 'apple_health' })
          router.push('/connections')
        }}
        hitSlop={{ top: 10, bottom: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Conectar tu reloj: puede anotar tu entreno y tu sueño por ti"
        style={styles.main}
      >
        <Text style={styles.text}>
          ¿Usas reloj? Puede anotar tu entreno y tu sueño por ti
          <Text style={styles.chevron}> ›</Text>
        </Text>
      </Pressable>
      <Pressable
        onPress={dismiss}
        hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Ahora no, no volver a mostrar"
      >
        <Text style={styles.dismiss}>Ahora no</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    marginLeft: 2,
  },
  main: {
    flex: 1,
  },
  text: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 17,
    letterSpacing: 0.3,
    color: colors.bone,
  },
  chevron: {
    color: colors.niebla,
  },
  dismiss: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
    color: colors.niebla,
  },
})
