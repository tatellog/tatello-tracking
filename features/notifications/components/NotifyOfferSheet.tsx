import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, radius, typography } from '@/theme'

import type { OfferTrigger } from '../offer-logic'

/*
 * La oferta de avisos en contexto: una hoja chica, una pregunta, un toque.
 * "Sí, avísame" lanza directo el permiso del sistema (sin pantalla de horas:
 * la hora sale de cuándo aceptó). Sin ✦: no es IA.
 */

const COPY: Record<OfferTrigger, { title: string; body: string }> = {
  meal: {
    title: '¿Te aviso cuando encuentre algo en tus días?',
    body: 'Nunca más de uno al día. Lo cambias cuando quieras en Ajustes.',
  },
  pattern: {
    title: 'Encontré tu primer patrón. ¿Te aviso cuando haya otro?',
    body: 'Nunca más de uno al día. Lo cambias cuando quieras en Ajustes.',
  },
}

export function NotifyOfferSheet({
  visible,
  trigger,
  onAccept,
  onDecline,
}: {
  visible: boolean
  trigger: OfferTrigger
  onAccept: () => void
  onDecline: () => void
}) {
  const insets = useSafeAreaInsets()
  const copy = COPY[trigger]
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDecline}>
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDecline}
          accessibilityLabel="Ahora no"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
          <Pressable
            onPress={onAccept}
            accessibilityRole="button"
            accessibilityLabel="Sí, avísame"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <View style={styles.primary}>
              <Text style={styles.primaryText}>Sí, avísame</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={onDecline}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ahora no"
            style={styles.secondaryHit}
          >
            <Text style={styles.secondaryText}>Ahora no</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  sheet: {
    paddingTop: 12,
    paddingHorizontal: 24,
    gap: 12,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.bgCard,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.oroHairline,
    marginBottom: 10,
  },
  title: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.headingLg,
    lineHeight: 27,
    color: colors.leche,
  },
  body: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 20,
    color: colors.niebla,
    marginBottom: 8,
  },
  primary: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: colors.magenta,
  },
  primaryText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.ui,
    color: colors.blanco,
  },
  pressed: { opacity: 0.85 },
  secondaryHit: { alignSelf: 'center', paddingVertical: 8 },
  secondaryText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
  },
})
