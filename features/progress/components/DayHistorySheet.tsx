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
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ChoreStar from '@/assets/icons/choreStar.svg'
import { ChevronHint } from '@/components/ui/interaction'
import { DayDetailContent } from '@/features/tabs/components/calendar/DayDetailContent'
import type { CalendarDay } from '@/features/tabs/components/calendar/logic'
import { colors, radius, spacing, typography } from '@/theme'

import { DaySheetAtmosphere, GrabberAstro } from './DaySheetAtmosphere'

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
  // Cerrado = SIN Modal montado (no solo visible=false). Evita que un Modal
  // transparente quede "huérfano" capturando toques al volver a Progreso —
  // sobre todo tras "Editar día", que navega mientras el sheet se cierra.
  if (!day || !visible) return null

  const hasEvent = day.events.length > 0

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Backdrop SOLO atenúa — no cierra. El sheet se cierra solo con la ✕
          (o el botón atrás de Android vía onRequestClose); un tap afuera lo
          mantiene abierto. */}
      <Animated.View entering={FadeIn.duration(160)} style={styles.backdrop} pointerEvents="none" />

      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          entering={SlideInDown.duration(260)}
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
        >
          {/* Atmósfera celeste: velo de estrellas + halo dorado tras la fecha.
              Absolute, detrás del contenido, sin capturar toques. */}
          <View style={styles.atmosphere} pointerEvents="none">
            <DaySheetAtmosphere hasEvent={hasEvent} />
          </View>

          <View style={styles.grabber}>
            <GrabberAstro bright={hasEvent} />
          </View>

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
            tone="observe"
            // Día con evento = día especial: la estrella ornamental (oro,
            // memoria) remata la fecha como una unidad. Sin magenta — ese
            // queda para el CTA.
            headerAccessory={hasEvent ? <ChoreStar width={50} height={66} /> : undefined}
            footer={
              editable ? (
                <Pressable
                  style={styles.cta}
                  onPress={() => onSeeDay(day.date)}
                  accessibilityRole="button"
                  accessibilityLabel="Editar este día en Hoy"
                >
                  {/* Modo observación: el acento NO vive en el botón de salir.
                      La palabra va en bone; el magenta queda solo en el chevron
                      (la única "puerta al presente"). */}
                  <Text style={styles.ctaText}>Editar día</Text>
                  <ChevronHint direction="right" size={15} color={colors.magenta} />
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
    overflow: 'hidden',
  },
  // Capa celeste tras la cabecera: ocupa la franja superior del sheet (donde
  // viven el grabber + la fecha + el estado). Recortada por overflow del sheet.
  atmosphere: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Banda alta a propósito: el halo (un círculo suave en la parte de arriba)
    // se desvanece a transparente MUY por encima de este borde, así el corte
    // del overflow del sheet cae en zona invisible — sin "raya" dorada.
    height: 240,
  },
  // El grabber dejó de ser una barra gris: ahora aloja el micro-astro oro.
  grabber: {
    alignSelf: 'center',
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
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    letterSpacing: 0.4,
    color: colors.bone,
  },
  readOnlyHint: {
    marginTop: spacing.xl,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
})
