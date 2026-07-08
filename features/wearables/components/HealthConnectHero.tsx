import { Image, StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * El hero de conexión — el patrón visual que la dueña pidió (referencia
 * YAZIO): [ícono de Stelar] enlazado a [tile del corazón de Salud]. El
 * corazón es una ILUSTRACIÓN del app de Salud de iOS (tile blanco + corazón
 * en el rojo de Apple), no un asset del sistema; el enlace son tres puntos
 * de luz, no una cadena (cielo, no ferretería). Decorativo: oculto de
 * VoiceOver (la pantalla ya se explica en texto).
 */

const HEART_PATH =
  'M12 21.35 C7.2 17.1 3 13.5 3 9.3 C3 6.4 5.3 4 8.2 4 C9.8 4 11.2 4.8 12 6 C12.8 4.8 14.2 4 15.8 4 C18.7 4 21 6.4 21 9.3 C21 13.5 16.8 17.1 12 21.35 Z'

export function HealthConnectHero({ size = 78 }: { size?: number }) {
  const radius = Math.round(size * 0.24)
  return (
    <View
      style={styles.row}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Stelar — el ícono real de la app. */}
      <Image
        source={require('@/assets/icon.png')}
        style={{ width: size, height: size, borderRadius: radius }}
      />

      {/* El enlace: tres puntos de luz en fade (cielo, no cadena). */}
      <View style={styles.linkDots}>
        <View style={[styles.dot, { opacity: 0.35 }]} />
        <View style={[styles.dot, { opacity: 0.7 }]} />
        <View style={[styles.dot, { opacity: 0.35 }]} />
      </View>

      {/* Salud — tile blanco + corazón rojo de Apple (ilustración). */}
      <View style={[styles.healthTile, { width: size, height: size, borderRadius: radius }]}>
        <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24">
          {/* Rojo del app de Salud de iOS (ilustra el OS, no la paleta). */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <Path d={HEART_PATH} fill="#FF375F" />
        </Svg>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  linkDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.leche,
  },
  healthTile: {
    // Pintura de escena: ilustra el ícono del app de Salud de iOS (tile
    // blanco puro del OS), no un rol de la paleta de Stelar.
    // eslint-disable-next-line no-restricted-syntax
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    // Sombra suave para que el tile blanco no flote plano sobre el cielo.
    // eslint-disable-next-line no-restricted-syntax
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
})
