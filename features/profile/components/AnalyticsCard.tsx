import { useEffect, useState } from 'react'
import { StyleSheet, Switch, Text, View } from 'react-native'

import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { useSession } from '@/hooks/useSession'
import { setAnalyticsOptOut } from '@/lib/analytics'
import { colors, radius, typography } from '@/theme'

/*
 * Compartir el uso de la app (ST-008 · decisión dueña 14 oct 2026): activa por
 * defecto (la política de privacidad ya la declara), se apaga aquí mismo. Se
 * guarda en el perfil (profiles.analytics_opt_out) para que valga en todos tus
 * dispositivos; track() la respeta desde el siguiente evento.
 */
export function AnalyticsCard() {
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const uid = useSession().session?.user?.id ?? null
  const saved = profile?.analytics_opt_out !== true
  // Local para que el toque responda al instante; el perfil lo confirma después.
  const [on, setOn] = useState(saved)
  useEffect(() => setOn(saved), [saved])

  const apply = (next: boolean) => {
    setOn(next)
    if (uid) setAnalyticsOptOut(uid, !next)
    updateProfile.mutate(
      { analytics_opt_out: !next },
      {
        onError: () => {
          // No se guardó: vuelve a lo que dice el perfil.
          setOn(saved)
          if (uid) setAnalyticsOptOut(uid, !saved)
        },
      },
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.label}>Compartir uso de la app</Text>
          <Text style={styles.desc}>Qué abres y qué usas. Nunca lo que comes ni lo que pesas.</Text>
        </View>
        <Switch
          value={on}
          onValueChange={apply}
          trackColor={{ false: colors.bgCard2, true: colors.magenta }}
          thumbColor={colors.leche}
          ios_backgroundColor={colors.bgCard2}
          accessibilityLabel="Compartir uso de la app"
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  text: { flex: 1, gap: 3 },
  label: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  desc: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
