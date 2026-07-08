import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { ChevronHint, usePressFeedback } from '@/components/ui/interaction'
import { colors, radius, typography } from '@/theme'

import { useAppleHealthConnection } from '../hooks'

/*
 * La card DESTACADA de Conexiones en Ajustes (feedback de la dueña: la fila
 * plana dentro de Cuenta no resaltaba). Mismo tratamiento premium que la
 * IdentityCard (borde magenta tenue + glow), con el mini-hero Stelar ✦ ↔
 * corazón de Salud y estado vivo: invitación si no ha conectado, "Conectado"
 * con punto de luz si ya. Toca → /connections.
 */

const HEART_PATH =
  'M12 21.35 C7.2 17.1 3 13.5 3 9.3 C3 6.4 5.3 4 8.2 4 C9.8 4 11.2 4.8 12 6 C12.8 4.8 14.2 4 15.8 4 C18.7 4 21 6.4 21 9.3 C21 13.5 16.8 17.1 12 21.35 Z'

export function ConnectionsCard({ onPress }: { onPress: () => void }) {
  const { connected, lastSyncAt } = useAppleHealthConnection()
  const press = usePressFeedback()

  const tagline = connected
    ? lastSyncAt
      ? 'Conectado. Tu reloj anota por ti.'
      : 'Conectado. Esperando tu primera lectura.'
    : 'Entrenos, sueño y pasos se anotan solos.'

  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Conexiones. Tu reloj y Apple Health."
      accessibilityHint="Abre la pantalla de conexiones"
    >
      <Animated.View style={[styles.card, press.animatedStyle]}>
        {/* Mini-hero: Stelar enlazado al corazón de Salud. Decorativo. */}
        <View
          style={styles.heroRow}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Image source={require('@/assets/icon.png')} style={styles.appIcon} />
          <View style={styles.linkDots}>
            <View style={[styles.dot, { opacity: 0.35 }]} />
            <View style={[styles.dot, { opacity: 0.7 }]} />
            <View style={[styles.dot, { opacity: 0.35 }]} />
          </View>
          <View style={styles.healthTile}>
            <Svg width={20} height={20} viewBox="0 0 24 24">
              {/* Rojo del app de Salud de iOS (ilustra el OS, no la paleta). */}
              {/* eslint-disable-next-line no-restricted-syntax */}
              <Path d={HEART_PATH} fill="#FF375F" />
            </Svg>
          </View>
        </View>

        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Conexiones</Text>
            {connected ? <View style={styles.statusDot} /> : null}
          </View>
          <Text style={styles.tagline} numberOfLines={2}>
            {tagline}
          </Text>
        </View>

        <ChevronHint direction="right" size={16} color={colors.magenta} />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // El tratamiento de la IdentityCard: borde magenta tenue + glow suave.
  // Es la ÚNICA card de configuración con este peso — destaca por diseño.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.magentaTint2,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  appIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  linkDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: colors.leche,
  },
  healthTile: {
    width: 34,
    height: 34,
    borderRadius: 8,
    // Pintura de escena: tile blanco del app de Salud de iOS.
    // eslint-disable-next-line no-restricted-syntax
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.title,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  // Punto de luz "conectado" — mismo lenguaje que el estado de Conexiones.
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.oroLight,
  },
  tagline: {
    marginTop: 3,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.bone,
  },
})
