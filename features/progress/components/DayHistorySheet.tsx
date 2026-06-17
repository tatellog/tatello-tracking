/*
 * DayHistorySheet — el detalle de un día en el Tab PROGRESO, en modo
 * OBSERVACIÓN. Se abre al tocar una estrella del calendario Historia. Muestra
 * el MISMO `DayDetailContent` que Hoy (una sola fuente del detalle), pero sin
 * una sola acción de edición: aquí nada se registra ni se corrige.
 *
 * El único camino a editar es el CTA "Ver día →": deja la petición en el bus
 * (pending-calendar-day) y navega a Hoy, que selecciona la fecha y hace scroll
 * a su DayDetailPanel. Así Progreso observa y Hoy opera — nunca dos lugares
 * para editar el mismo dato.
 *
 * `editable` = la fecha cae en la ventana editable de Hoy (últimos 30 días).
 * Para días más viejos el sheet es lectura pura: el CTA no aparece (lo viejo
 * es historia, no se reabre para editar).
 */

import { Feather } from '@expo/vector-icons'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ChevronHint } from '@/components/ui/interaction'
import { DayDetailContent } from '@/features/tabs/components/calendar/DayDetailContent'
import type { CalendarDay } from '@/features/tabs/components/calendar/logic'
import { colors, radius, spacing, typography } from '@/theme'

type Props = {
  visible: boolean
  day: CalendarDay | null
  /** La fecha cae en la ventana editable de Hoy (últimos 30 días). */
  editable: boolean
  onClose: () => void
  /** "Ver día →" — lleva a Hoy a editar esa fecha. */
  onSeeDay: (date: string) => void
}

export function DayHistorySheet({ visible, day, editable, onClose, onSeeDay }: Props) {
  const insets = useSafeAreaInsets()
  if (!day) return null

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(160)}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
      </Animated.View>

      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          entering={SlideInDown.duration(260)}
          exiting={SlideOutDown.duration(200)}
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
        >
          <View style={styles.grabber} />

          <Pressable
            style={styles.close}
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Feather name="x" size={20} color={colors.niebla} />
          </Pressable>

          <DayDetailContent
            day={day}
            showValues
            footer={
              editable ? (
                <Pressable
                  style={styles.cta}
                  onPress={() => onSeeDay(day.date)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver y editar el día en Hoy`}
                >
                  <Text style={styles.ctaText}>Ver día</Text>
                  <ChevronHint direction="right" size={16} color={colors.magenta} />
                </Pressable>
              ) : (
                <Text style={styles.readOnlyHint}>
                  Este día ya es historia. Lo nuevo se registra en Hoy.
                </Text>
              )
            }
          />
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 6, 8, 0.6)',
  },
  anchor: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgCard2,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.oroHairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline,
    marginBottom: spacing.sm,
  },
  close: { position: 'absolute', top: spacing.md, right: spacing.md, zIndex: 2 },
  // CTA "Ver día →" — el ÚNICO puente a edición; link magenta, sin pill.
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    marginTop: spacing.xl,
    paddingVertical: 4,
  },
  ctaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.4,
    color: colors.magenta,
  },
  readOnlyHint: {
    marginTop: spacing.xl,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
})
