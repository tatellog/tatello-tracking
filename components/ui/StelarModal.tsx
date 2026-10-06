import { BlurView } from 'expo-blur'
import { useEffect, type ReactNode } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { colors, typography } from '@/theme'

/*
 * El modal de Stelar (dueña 6 oct 2026: "homogeneiza los modales"). Un solo
 * contenedor para las tarjetas centradas, con el lenguaje de "La evidencia":
 * fondo difuminado, tarjeta vino con esquinas de 24 y filo oro finísimo,
 * encabezado (ícono + categoría en su color), título grande a la izquierda,
 * el contenido en tarjetas internas (`StelarModalPanel`) y "Listo" al pie.
 * Entra con un resorte suave; tocar afuera o "Listo" cierra.
 */

export function StelarModal({
  visible,
  onClose,
  kicker,
  kickerColor = colors.oroSoft,
  icon,
  title,
  children,
  doneLabel = 'Listo',
  footer,
}: {
  visible: boolean
  onClose: () => void
  /** Categoría arriba ("TU ACUARIO", "PROTEÍNA"); se pinta en mayúsculas. */
  kicker?: string
  kickerColor?: string
  /** Ícono(s) a la izquierda de la categoría. */
  icon?: ReactNode
  /** El titular, grande y a la izquierda. */
  title?: string
  children: ReactNode
  /** Texto del botón de cierre. */
  doneLabel?: string
  /** Sustituye al botón "Listo" (p. ej. dos acciones). */
  footer?: ReactNode
}) {
  const reduce = useReducedMotion()
  const enter = useSharedValue(0)
  useEffect(() => {
    if (!visible) return
    enter.value = 0
    enter.value = reduce ? 1 : withSpring(1, { damping: 19, stiffness: 190, mass: 0.7 })
  }, [visible, reduce, enter])
  const cardAnim = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.5),
    transform: [{ translateY: (1 - enter.value) * 18 }, { scale: 0.96 + enter.value * 0.04 }],
  }))

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar">
        <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="none" />
        <Animated.View style={[styles.cardWrap, cardAnim]}>
          {/* Pressable vacío: un toque DENTRO de la tarjeta no la cierra. */}
          <Pressable style={styles.card} onPress={() => {}}>
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.body}
            >
              {kicker || icon ? (
                <View style={styles.header}>
                  {icon}
                  {kicker ? (
                    <Text style={[styles.kicker, { color: kickerColor }]}>
                      {kicker.toUpperCase()}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {children}
              {footer ?? (
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.done, pressed && styles.pressed]}
                >
                  <Text style={styles.doneText}>{doneLabel}</Text>
                </Pressable>
              )}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

/** Tarjeta interna del modal (el contenido va en paneles, como en Salud). */
export function StelarModalPanel({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.panel, style]}>{children}</View>
}

/** Texto chico al pie de un bloque: qué se midió / de dónde sale. */
export function StelarModalMeta({ children }: { children: ReactNode }) {
  return <Text style={styles.meta}>{children}</Text>
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  scrim: { backgroundColor: 'rgba(10, 6, 8, 0.55)' },
  cardWrap: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '88%',
    borderRadius: 24,
    shadowColor: colors.sombra,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 20,
  },
  card: {
    maxHeight: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.bgCard2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
  },
  body: { paddingVertical: 24, paddingHorizontal: 22, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kicker: { fontFamily: typography.uiBold, fontSize: typography.sizes.body, letterSpacing: 0.4 },
  title: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.headingLg,
    lineHeight: 25,
    letterSpacing: -0.3,
    color: colors.leche,
  },
  panel: { borderRadius: 18, backgroundColor: colors.bgCard, padding: 14 },
  meta: {
    marginTop: -6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 17,
    color: colors.niebla,
  },
  done: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
  },
  pressed: { opacity: 0.7 },
  doneText: { fontFamily: typography.uiBold, fontSize: typography.sizes.ui, color: colors.leche },
})

/*
 * Las HOJAS que suben desde abajo (Registrar, Comidas de hoy, el día, …)
 * comparten estas piezas para verse iguales (dueña 6 oct 2026): el mismo
 * oscurecido detrás, la misma superficie (esquinas de 26, vino, filo oro
 * arriba) y la misma barrita para arrastrar. Se esparcen AL FINAL del estilo
 * de cada hoja para que manden sobre lo anterior.
 */
export const SHEET_SCRIM = 'rgba(10, 6, 8, 0.62)'

export const SHEET_SURFACE = {
  borderTopLeftRadius: 26,
  borderTopRightRadius: 26,
  backgroundColor: colors.bgCard,
  borderWidth: StyleSheet.hairlineWidth,
  borderBottomWidth: 0,
  borderColor: colors.oroHairline,
} as const

export const SHEET_GRABBER = {
  alignSelf: 'center',
  width: 40,
  height: 5,
  borderRadius: 3,
  backgroundColor: colors.hairlineStrong,
} as const
