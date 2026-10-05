/*
 * DayHistorySheet — el detalle de un día de Tu constancia (rediseño dueña
 * 4 oct 2026: "como Apple Fitness / Salud, con información útil"). Se abre al
 * tocar un día del calendario. Fecha grande y tarjetas por métrica con el
 * número grande en su color:
 *   · Comida: si fue día en déficit y por cuánto (el norte), con lo comido y
 *     la proteína. Sobre la meta o bajo el piso sano, solo el dato, sin juicio.
 *   · Entrenos: una fila por sesión del reloj (ícono, minutos, hora); un
 *     entreno manual, su tipo. Toca → Tu entreno del día.
 *   · Sueño y agua lado a lado. Sueño → Tu sueño de esa noche.
 * Sin anillos: viven en Descubre de ese día, a un tap con "Editar día".
 *
 * Aquí nada se edita: "Editar día" lleva a Hoy en esa fecha (ventana de 30
 * días). Lo más viejo es lectura pura.
 */

import { Feather } from '@expo/vector-icons'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MoonGlyph } from '@/features/tabs/components/check-in-glyphs'
import type { CalendarDay, CalendarEvent } from '@/features/tabs/components/calendar/logic'
import { ActivityIcon } from '@/features/wearables/components/ActivityIcon'
import { useHealthSummary } from '@/features/wearables/hooks'
import { clockTime } from '@/features/wearables/sleep-detail'
import { WORKOUT_NAME, workoutOfDay } from '@/features/wearables/workout-insights'
import { emitReplayReveal } from '@/features/revelations'
import { userTimezone } from '@/lib/time'
import { colors, spacing, typography } from '@/theme'

import { foodSummary, sleepLong } from '../constancia-logic'

type Props = {
  visible: boolean
  day: CalendarDay | null
  /** La fecha cae en la ventana editable de Hoy (últimos 30 días). */
  editable: boolean
  calorieTarget?: number | null
  proteinTarget?: number | null
  onClose: () => void
  /** "Editar día" — lleva a Hoy a editar esa fecha. */
  onSeeDay: (date: string) => void
  /** Abre otra pantalla (Tu entreno / Tu sueño) cerrando el sheet primero. */
  onNavigate: (path: '/workout-day' | '/sleep', date: string) => void
}

const ENTRENO = colors.dimension.mente
const SUENO = colors.dimension.sueno
const AGUA = colors.signal.agua
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const fmt = (n: number) => n.toLocaleString('es-MX')

export function DayHistorySheet({
  visible,
  day,
  editable,
  calorieTarget,
  proteinTarget,
  onClose,
  onSeeDay,
  onNavigate,
}: Props) {
  const insets = useSafeAreaInsets()
  // Cerrado = SIN Modal montado (no solo visible=false). Evita que un Modal
  // transparente quede "huérfano" capturando toques al volver a la pantalla.
  if (!day || !visible) return null

  const [y, m, d] = day.date.split('-').map(Number) as [number, number, number]
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()]

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(160)} style={styles.backdrop} pointerEvents="none" />

      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          entering={SlideInDown.duration(260)}
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}
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

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <View>
              <Text style={styles.weekday}>{day.isToday ? 'hoy' : weekday}</Text>
              <Text style={styles.date}>{`${d} de ${MONTHS[m - 1]}`}</Text>
            </View>

            <FoodCard day={day} calorieTarget={calorieTarget} proteinTarget={proteinTarget} />
            <WorkoutCard day={day} onOpen={() => onNavigate('/workout-day', day.date)} />

            <View style={styles.pair}>
              <View style={styles.half}>
                <Pressable
                  onPress={() => onNavigate('/sleep', day.date)}
                  accessibilityRole="button"
                  accessibilityLabel="Ver el detalle de la noche"
                  style={({ pressed }) => [styles.card, styles.fill, pressed && styles.pressed]}
                >
                  <CardHead color={SUENO} label="Sueño" chevron>
                    <MoonGlyph color={SUENO} />
                  </CardHead>
                  {day.values.sleepMinutes != null ? (
                    <BigValue {...sleepParts(day.values.sleepMinutes)} />
                  ) : (
                    <Text style={styles.noData}>Sin dato</Text>
                  )}
                </Pressable>
              </View>
              <View style={styles.half}>
                <View style={[styles.card, styles.fill]}>
                  <CardHead color={AGUA} label="Agua">
                    <Feather name="droplet" size={14} color={AGUA} />
                  </CardHead>
                  {day.values.waterGlasses != null && day.values.waterGlasses > 0 ? (
                    <BigValue
                      value={`${day.values.waterGlasses}`}
                      unit={day.values.waterGlasses === 1 ? 'vaso' : 'vasos'}
                    />
                  ) : (
                    <Text style={styles.noData}>Sin dato</Text>
                  )}
                </View>
              </View>
            </View>

            {day.events.map((ev) => (
              <EventLine key={ev.id} ev={ev} date={day.date} onClose={onClose} />
            ))}

            {editable ? (
              <Pressable
                style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
                onPress={() => onSeeDay(day.date)}
                accessibilityRole="button"
                accessibilityLabel="Editar este día en Hoy"
              >
                <Text style={styles.editText}>Editar día</Text>
              </Pressable>
            ) : (
              <Text style={styles.readOnly}>
                Este día ya no se edita. Lo nuevo se registra en Hoy.
              </Text>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

function FoodCard({
  day,
  calorieTarget,
  proteinTarget,
}: {
  day: CalendarDay
  calorieTarget?: number | null
  proteinTarget?: number | null
}) {
  const food = foodSummary(day.values.calories, calorieTarget)
  const protein =
    day.values.proteinG != null
      ? proteinTarget != null && proteinTarget > 0
        ? `Proteína ${Math.round(day.values.proteinG)} de ${Math.round(proteinTarget)} g`
        : `Proteína ${Math.round(day.values.proteinG)} g`
      : null

  if (food.kind === 'none') {
    return (
      <View style={styles.card}>
        <CardHead color={colors.leche} label="Comida" />
        <Text style={styles.noData}>Sin comida registrada</Text>
      </View>
    )
  }
  if (food.kind === 'deficit') {
    return (
      <View style={styles.card}>
        <CardHead color={colors.oroSoft} label={day.isToday ? 'Vas en déficit' : 'Día en déficit'}>
          <View style={styles.goldDot} />
        </CardHead>
        <BigValue value={fmt(food.under)} unit="kcal bajo tu meta" />
        <Text style={styles.sub}>
          {`Comiste ${fmt(food.calories)} de ${fmt(food.target)} kcal`}
          {protein ? ` · ${protein}` : ''}
        </Text>
      </View>
    )
  }
  return (
    <View style={styles.card}>
      <CardHead color={colors.leche} label="Comida" />
      <BigValue
        value={fmt(food.calories)}
        unit={food.target != null ? `de ${fmt(food.target)} kcal` : 'kcal'}
      />
      {food.over ? (
        <Text style={styles.sub}>
          {day.isToday ? 'Hoy tu cuerpo pidió más.' : 'Ese día tu cuerpo pidió más.'}
        </Text>
      ) : null}
      {protein ? <Text style={styles.sub}>{protein}</Text> : null}
    </View>
  )
}

function WorkoutCard({ day, onOpen }: { day: CalendarDay; onOpen: () => void }) {
  const tz = userTimezone()
  const health = useHealthSummary(day.date, day.date)
  const workout = health.data ? workoutOfDay(health.data.workouts, day.date, tz) : null

  if (workout && workout.list.length > 0) {
    return (
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel="Ver tu entreno de este día"
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <CardHead
          color={ENTRENO}
          label={workout.list.length > 1 ? `${workout.list.length} entrenos` : 'Entreno'}
          chevron
        />
        {workout.list.map((s, i) => (
          <View key={s.key} style={[styles.wRow, i > 0 && styles.wRowBorder]}>
            <ActivityIcon name={s.name} type={s.type} size={40} />
            <View style={styles.wText}>
              <Text style={styles.wName} numberOfLines={1}>
                {s.name}
              </Text>
              <Text style={[styles.wMinutes, { color: ENTRENO }]}>
                {s.minutes}
                <Text style={styles.wUnit}> min</Text>
              </Text>
            </View>
            <Text style={styles.wTime}>{clockTime(s.startedAt, tz)}</Text>
          </View>
        ))}
      </Pressable>
    )
  }
  if (day.status === 'trained') {
    const type = day.values.workoutType ? WORKOUT_NAME[day.values.workoutType] : null
    return (
      <View style={styles.card}>
        <CardHead color={ENTRENO} label="Entreno" />
        <Text style={[styles.bigText, { color: ENTRENO }]}>{type ?? 'Entrenaste'}</Text>
      </View>
    )
  }
  if (day.status === 'rested') {
    return (
      <View style={styles.card}>
        <CardHead color={SUENO} label="Descanso">
          <MoonGlyph color={SUENO} />
        </CardHead>
        <Text style={styles.sub}>Ese día descansaste. También cuenta.</Text>
      </View>
    )
  }
  return null
}

function EventLine({
  ev,
  date,
  onClose,
}: {
  ev: CalendarEvent
  date: string
  onClose: () => void
}) {
  return (
    <Pressable
      // Re-abre su ceremonia full-screen. El sheet es un <Modal> nativo y la
      // ceremonia vive en la raíz: se cierra primero para que quede visible.
      onPress={() => {
        onClose()
        emitReplayReveal({
          tier: ev.tier ?? '',
          kind: ev.kind ?? '',
          title: ev.title,
          message: ev.message ?? '',
          evidence: ev.evidence,
          evidenceCount: ev.evidenceCount,
          evidenceTotal: ev.evidenceTotal,
          evidenceBars: ev.evidenceBars,
          correlationInsight: ev.correlationInsight,
          date,
        })
      }}
      accessibilityRole="button"
      accessibilityLabel={`${ev.title}. Volver a verlo`}
      style={({ pressed }) => [styles.event, pressed && styles.pressed]}
    >
      <View style={styles.goldDot} />
      <Text style={styles.eventText} numberOfLines={2}>
        {ev.title}
      </Text>
      <Feather name="chevron-right" size={16} color={colors.niebla} />
    </Pressable>
  )
}

function CardHead({
  color,
  label,
  chevron = false,
  children,
}: {
  color: string
  label: string
  chevron?: boolean
  children?: React.ReactNode
}) {
  return (
    <View style={styles.head}>
      {children}
      <Text style={[styles.headLabel, { color }]}>{label}</Text>
      {chevron ? (
        <Feather name="chevron-right" size={16} color={colors.niebla} style={styles.headChevron} />
      ) : null}
    </View>
  )
}

function BigValue({ value, unit }: { value: string; unit: string }) {
  return (
    <Text style={styles.big}>
      {value}
      <Text style={styles.bigUnit}>{` ${unit}`}</Text>
    </Text>
  )
}

function sleepParts(minutes: number): { value: string; unit: string } {
  const long = sleepLong(minutes)
  // "6 h 58 min" → valor "6 h 58", unidad "min"; "45 min" → "45" + "min".
  const i = long.lastIndexOf(' ')
  return { value: long.slice(0, i), unit: long.slice(i + 1) }
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 6, 8, 0.6)',
  },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.hairlineStrong,
    marginBottom: spacing.sm,
  },
  close: { position: 'absolute', top: spacing.md, right: spacing.md, zIndex: 2 },
  body: { gap: 12, paddingBottom: spacing.sm },
  weekday: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  date: {
    marginTop: 2,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.displayLg,
    letterSpacing: -0.8,
    color: colors.leche,
  },
  card: {
    backgroundColor: colors.bgCard2,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pressed: { opacity: 0.7 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headLabel: { fontFamily: typography.uiBold, fontSize: typography.sizes.bodyLarge },
  headChevron: { marginLeft: 'auto' },
  big: {
    marginTop: 8,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.macroNum,
    letterSpacing: -0.6,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  bigUnit: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0,
    color: colors.niebla,
  },
  bigText: {
    marginTop: 8,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.displaySm,
    letterSpacing: -0.4,
  },
  sub: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.bone,
  },
  noData: {
    marginTop: 10,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.niebla,
  },
  goldDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.oroSoft },
  wRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  wRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  wText: { flex: 1, minWidth: 0 },
  wName: { fontFamily: typography.uiSemi, fontSize: typography.sizes.body, color: colors.leche },
  wMinutes: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.displaySm,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  wUnit: { fontFamily: typography.uiSemi, fontSize: typography.sizes.bodyLarge },
  wTime: {
    alignSelf: 'flex-start',
    marginTop: 4,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  pair: { flexDirection: 'row', gap: 10 },
  // Pressable no toma flex bien en este setup: el ancho vive en el wrapper.
  half: { flex: 1 },
  fill: { flex: 1 },
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  eventText: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  edit: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.bgCard2,
    alignItems: 'center',
  },
  editText: { fontFamily: typography.uiBold, fontSize: typography.sizes.ui, color: colors.magenta },
  readOnly: {
    marginTop: 4,
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
