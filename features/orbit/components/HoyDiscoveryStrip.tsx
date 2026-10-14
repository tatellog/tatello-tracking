/*
 * El hallazgo NUEVO en Hoy (ST-007), como franja y no como tarjeta: "Tu día"
 * sigue siendo la única tarjeta de lectura. Paleta de Hoy (oro = lo que ya
 * construiste; magenta = la acción), sin anillo (en Hoy el único es el del
 * emblema), sin ✦ (lo encontró el motor). Lo que dice sale de
 * `hoyDiscoveryModel`, con la misma etiqueta y muestra que Descubre.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { colors, typography } from '@/theme'

import type { HoyDiscoveryModel } from '../hoy-discovery'

export function HoyDiscoveryStrip({
  model,
  onOpen,
}: {
  model: HoyDiscoveryModel
  onOpen: () => void
}) {
  return (
    <Animated.View entering={FadeIn.duration(420)} style={styles.strip}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${model.eyebrow}. ${model.title} ${model.numbers ?? ''}. ${model.evidence}. Ver el patrón.`}
        style={({ pressed }) => pressed && { opacity: 0.75 }}
      >
        <Text style={styles.eyebrow}>{model.eyebrow}</Text>
        <Text style={styles.title}>{model.title}</Text>
        {model.numbers ? <Text style={styles.numbers}>{model.numbers}</Text> : null}
        <Text style={styles.evidence}>{model.evidence}</Text>
        <View style={styles.ctaRow}>
          <Text style={styles.cta}>Ver el patrón ›</Text>
        </View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  strip: {
    borderLeftWidth: 2,
    borderLeftColor: colors.oroHairline,
    paddingLeft: 14,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.uppercaseTight,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  title: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.ui,
    lineHeight: 21,
    color: colors.leche,
  },
  numbers: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  evidence: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  ctaRow: { marginTop: 10, minHeight: 24, justifyContent: 'center' },
  cta: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.magenta,
  },
})
