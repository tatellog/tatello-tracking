import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

/** El encabezado de cada tarjeta de Progreso, igual en todas (como Salud):
 *  ícono animado, título en el color de su categoría y un dato a la derecha. */
export function HealthCardHeader({
  icon,
  title,
  color,
  right,
}: {
  icon: ReactNode
  title: string
  color: string
  right?: string
}) {
  return (
    <View style={styles.head}>
      <View style={styles.headTitle}>
        {icon}
        <Text style={[styles.title, { color }]}>{title}</Text>
      </View>
      {right ? <Text style={styles.right}>{right}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontFamily: typography.uiBold, fontSize: typography.sizes.body },
  right: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
})
