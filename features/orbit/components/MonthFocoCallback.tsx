import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

/*
 * MonthFocoCallback — el LOOP DE REGRESO (Stage 3). El foco que la usuaria se
 * quedó el mes PASADO reaparece arriba de Mes: "El mes pasado te fijaste en X.
 * Mirémoslo." Cierra el círculo descubrimiento → foco → regreso.
 *
 * NUNCA es un examen (manifiesto): no dice "lograste el 40% de tus viernes". Solo
 * OBSERVA si el patrón volvió a asomar este mes (determinístico, sin números, sin
 * culpa) e invita a seguirlo. La retención sale de que Stelar RECUERDA, no de
 * presionar. Se auto-oculta cuando la usuaria se queda un foco de este mes.
 */

type Props = {
  /** La palanca que se quedó el mes pasado ("cuida los viernes"). */
  foco: string
  /** ¿El patrón que originó ese foco volvió a asomar este mes? (observación, no
   *  veredicto). */
  stillPresent: boolean
  following?: boolean
  onFollow: () => void
  onDismiss: () => void
}

export function MonthFocoCallback({ foco, stillPresent, following, onFollow, onDismiss }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>El mes pasado te fijaste en</Text>
      <Text style={styles.foco}>
        <Text style={styles.focoMark}>✦ </Text>
        {foco}
      </Text>
      {/* Observación honesta, sin números ni culpa: solo si volvió a asomar. */}
      <Text style={styles.obs}>
        {stillPresent
          ? 'Sigue asomando este mes. Si quieres, lo seguimos.'
          : 'Este mes no volvió a asomar. Algo se movió.'}
      </Text>
      <View style={styles.row}>
        <Pressable
          style={styles.follow}
          onPress={onFollow}
          disabled={following}
          accessibilityRole="button"
          accessibilityLabel="Seguir con este foco"
        >
          <Text style={styles.followText}>{following ? 'Guardando…' : 'Seguir con este foco'}</Text>
        </Pressable>
        <Pressable
          style={styles.dismiss}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Ahora no"
        >
          <Text style={styles.dismissText}>Ahora no</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    backgroundColor: colors.bgCard,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  foco: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.title,
    color: colors.leche,
  },
  focoMark: { fontFamily: typography.uiBold, color: colors.magenta },
  obs: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.bone,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  follow: {
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.magentaDeep,
  },
  followText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.magenta,
  },
  dismiss: { paddingVertical: 11, paddingHorizontal: 8 },
  dismissText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
})
