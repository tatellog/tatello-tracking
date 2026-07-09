import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radius, typography } from '@/theme'

import { StelarStar } from './MonthChatView'

/*
 * Antesala de Órbita Mes como UN solo teaser (no el listado de cards): Stelar
 * dice que encontró algo y INVITA a descubrirlo. Al tocar, se abre el
 * descubrimiento guiado (el chat hallazgo por hallazgo, empezando por el
 * déficit). Anticipación primero, revelación al entrar — no un reporte a la
 * vista. El payoff (déficit + palancas) vive detrás del tap.
 *
 * Layout alineado a la izquierda (mismo lenguaje que las demás cards): fila de
 * marca · titular · línea honesta de dimensión · CTA. Padding claro.
 */

export function MonthDiscoveryTeaser({
  dimension,
  onStart,
}: {
  /** Línea honesta híbrida: sobre qué es (ej. "sobre tus días con agua"). */
  dimension: string
  onStart: () => void
}) {
  return (
    <Pressable
      onPress={onStart}
      accessibilityRole="button"
      accessibilityLabel={`He detectado algo en tu mes, ${dimension}. Descubrir.`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: `${colors.magenta}12` }]}
      />
      <View style={styles.brandRow}>
        <StelarStar size={20} />
        <Text style={styles.brand}>STELAR</Text>
      </View>
      <Text style={styles.lead}>He detectado algo en tu mes.</Text>
      <Text style={styles.dimension}>{dimension}</Text>
      <View style={styles.ctaRow}>
        <Text style={styles.cta}>Descubrir</Text>
        <Text style={styles.ctaArrow}>→</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.cardLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.magenta}59`,
    paddingHorizontal: 22,
    paddingVertical: 22,
    gap: 10,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.92 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    color: colors.oroSoft,
  },
  lead: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.headingLg,
    lineHeight: 28,
    color: colors.leche,
    marginTop: 2,
  },
  dimension: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    color: colors.niebla,
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  cta: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0.3,
    color: colors.magentaHot,
  },
  ctaArrow: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.heading,
    color: colors.magentaHot,
  },
})
