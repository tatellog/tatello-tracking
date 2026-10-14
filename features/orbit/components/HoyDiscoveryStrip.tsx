/*
 * El hallazgo NUEVO en Hoy (ST-007): UNA fila tocable, ícono + etiqueta + título
 * corto (dueña 14 oct 2026: la gente casi no lee; Hoy solo avisa, el detalle con
 * sus números vive en Descubre). Oro = lo que ya construiste, sin anillo (en Hoy
 * el único es el del emblema), sin ✦ (lo encontró el motor). Lo que dice sale de
 * `hoyDiscoveryModel`, con la misma etiqueta que Descubre.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { colors, typography } from '@/theme'

import { evidenceLook, type EvidenceIcon } from '../evidence-highlight'
import type { HoyDiscoveryModel } from '../hoy-discovery'

const COMBO_ICON: EvidenceIcon = { name: 'fire', color: colors.oro }

export function HoyDiscoveryStrip({
  model,
  onOpen,
}: {
  model: HoyDiscoveryModel
  onOpen: () => void
}) {
  const icon = model.lookId ? evidenceLook(model.lookId, colors.oro).icons[0]! : COMBO_ICON
  return (
    <Animated.View entering={FadeIn.duration(420)}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${model.eyebrow}. ${model.title}.`}
        accessibilityHint="Abre el patrón en Descubre."
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
      >
        <View style={styles.badge}>
          <MaterialCommunityIcons name={icon.name} size={20} color={icon.color} />
        </View>
        <View style={styles.text}>
          <Text style={styles.eyebrow}>{model.eyebrow}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {model.title}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.oroHairlineSoft,
  },
  text: { flex: 1 },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.uppercaseTight,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  title: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.ui,
    lineHeight: 20,
    color: colors.leche,
  },
  chevron: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.title,
    color: colors.magenta,
  },
})
