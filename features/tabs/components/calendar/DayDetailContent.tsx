/*
 * DayDetailContent — el cuerpo SOLO-LECTURA del detalle de un día: fecha ·
 * estado · "Registraste ✓" · eventos. Presentación pura, sin side-effects y
 * sin chrome de tarjeta (lo provee quien lo envuelve).
 *
 * Es la ÚNICA fuente del detalle de un día, compartida por:
 *   · DayDetailPanel  (Tab Hoy)      → lo envuelve en su tarjeta + acciones
 *     de edición (marcar entrené/descansé) como `footer`.
 *   · DayHistorySheet (Tab Progreso) → lo envuelve en un bottom sheet de
 *     observación + CTA "Ver día →" como `footer`. NUNCA edita.
 *
 * La edición vive SOLO en el footer de Hoy: nada de mutar datos cruza a este
 * componente. Así Progreso observa, Hoy opera, y no hay dos detalles distintos.
 */

import { type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

import type { CalendarDay, CalendarEvent, DayRegistered, DayValues } from './logic'

/** Color + etiqueta del evento según su tier — espeja el marcador del
 *  calendario (azul = Patrón, oro = Revelación/Transformación). */
function tierMeta(tier: string | undefined): { color: string; label: string | null } {
  if (tier === 'pattern') return { color: colors.dimension.sueno, label: 'Patrón' }
  if (tier === 'transformation' || tier === 'return') {
    return { color: colors.oro, label: 'Revelación' }
  }
  return { color: colors.oro, label: null }
}

// Divisor estelar: un hairline que es una pequeña constelación (estrella al
// centro + satélites asimétricos), no una línea recta. Solo en OBSERVACIÓN y
// solo antes de los eventos del día (no decoramos el vacío). SVG estático.
function StarDivider() {
  return (
    <Svg width="100%" height={8} viewBox="0 0 320 8" style={styles.divider}>
      {/* Susurro: dos tramos finísimos que paran antes de la estrella (la
          estrellita "interrumpe" la línea, más elegante que un punto encima). */}
      <Path d="M0 4 H146 M174 4 H320" stroke={colors.oro} strokeWidth={0.5} opacity={0.18} />
      <Path
        d="M160 1.6 C160.4 3.3 160.7 3.6 162.4 4 C160.7 4.4 160.4 4.7 160 6.4 C159.6 4.7 159.3 4.4 157.6 4 C159.3 3.6 159.6 3.3 160 1.6 Z"
        fill={colors.oro}
        opacity={0.5}
      />
    </Svg>
  )
}

const MONTHS_ES = [
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
] as const

export function dateHeading(iso: string): string {
  const [, m, d] = iso.split('-').map(Number) as [number, number, number]
  return `${d} ${MONTHS_ES[(m ?? 1) - 1] ?? ''}`
}

const STATUS_LABEL: Record<CalendarDay['status'], string> = {
  trained: 'Entrenaste',
  rested: 'Descansaste',
  empty: 'Sin registro',
}

// Voz cálida del estado para el modo OBSERVACIÓN (Progreso). El vacío deja de
// ser "Sin registro" (hueco/deuda) y pasa a "Un día tranquilo" (pausa, sin
// culpa) — la misma sensibilidad del cielo, que nunca pinta un hoyo.
const STATUS_POETIC: Record<CalendarDay['status'], string> = {
  trained: 'Entrenaste',
  rested: 'Descansaste',
  empty: 'Un día tranquilo',
}

// Orden + etiqueta de cada check de "Registraste".
const REGISTERED_ITEMS: { key: keyof DayRegistered; label: string }[] = [
  { key: 'comida', label: 'Comida' },
  { key: 'agua', label: 'Agua' },
  { key: 'sueno', label: 'Sueño' },
  { key: 'energia', label: 'Energía' },
  { key: 'peso', label: 'Peso' },
  { key: 'ciclo', label: 'Ciclo' },
]

function formatSleep(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** Filas de VALORES reales del día (label · valor). Omite lo no registrado. */
function dataRowsFor(v: DayValues): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  if (v.mealCount != null && v.mealCount > 0)
    rows.push({
      label: 'Comida',
      value: `${v.mealCount} ${v.mealCount === 1 ? 'comida' : 'comidas'}`,
    })
  if (v.proteinG != null && v.proteinG > 0)
    rows.push({ label: 'Proteína', value: `${Math.round(v.proteinG)} g` })
  if (v.calories != null && v.calories > 0)
    rows.push({ label: 'Calorías', value: `${Math.round(v.calories)} kcal` })
  if (v.waterGlasses != null && v.waterGlasses > 0)
    rows.push({
      label: 'Agua',
      value: `${v.waterGlasses} ${v.waterGlasses === 1 ? 'vaso' : 'vasos'}`,
    })
  if (v.sleepMinutes != null) rows.push({ label: 'Sueño', value: formatSleep(v.sleepMinutes) })
  if (v.energy != null) rows.push({ label: 'Energía', value: `${v.energy} / 5` })
  if (v.weightKg != null) rows.push({ label: 'Peso', value: `${v.weightKg.toFixed(1)} kg` })
  if (v.onPeriod) rows.push({ label: 'Ciclo', value: 'Día de ciclo' })
  return rows
}

/** Platillo individual del día (subconjunto de Meal) para la lista de Historia. */
export type DayMeal = { id: string; name: string; calories: number | null }

export function DayDetailContent({
  day,
  showValues = false,
  meals,
  footer,
  headerAccessory,
  tone = 'operate',
  onEventPress,
}: {
  day: CalendarDay
  /** Historia (Progreso): muestra VALORES reales. Hoy lo deja en false →
   *  solo presencia (sin métricas, como decidió el manifiesto para Hoy). */
  showValues?: boolean
  /** Platillos registrados ese día (solo Historia). Si vienen, reemplazan el
   *  agregado "Comida · N comidas" por la lista real. */
  meals?: readonly DayMeal[]
  footer?: ReactNode
  /** Remate a la derecha de la fecha (ej. el astro del día con evento). Se
   *  alinea con la fecha como una unidad, no como un objeto suelto. */
  headerAccessory?: ReactNode
  /** 'operate' (Hoy) = ficha funcional, sin cambios. 'observe' (Progreso) =
   *  voz contemplativa: fecha como heroína, estado en serif italic, vacío sin
   *  culpa, chips con más presencia. Gatea SOLO la capa visual; el contenido
   *  es el mismo. */
  tone?: 'operate' | 'observe'
  /** Tocar un evento → re-vivir su ceremonia full-screen. Opcional: sin esto
   *  los eventos son de solo lectura (la presentación sigue siendo pura; el
   *  efecto vive en quien envuelve). */
  onEventPress?: (ev: CalendarEvent) => void
}) {
  const observe = tone === 'observe'
  const checks = REGISTERED_ITEMS.filter((it) => day.registered[it.key])
  const showMeals = showValues && meals != null && meals.length > 0
  // Con la lista de platillos, el agregado "Comida · N comidas" sobra.
  const dataRows = (showValues ? dataRowsFor(day.values) : []).filter(
    (r) => !(showMeals && r.label === 'Comida'),
  )
  const hasEvents = day.events.length > 0

  return (
    <View>
      <View style={styles.dateRow}>
        <Text style={[styles.date, observe && styles.dateHero]}>{dateHeading(day.date)}</Text>
        {headerAccessory}
      </View>

      {/* Estado. En OBSERVACIÓN la fecha es la heroína y el estado baja a un
          subtítulo serif italic (voz cálida, sin eyebrow). En OPERAR queda la
          ficha de siempre: eyebrow + línea de UI. */}
      {observe ? (
        <Text style={styles.statusPoetic}>{STATUS_POETIC[day.status]}</Text>
      ) : (
        <>
          <Text style={styles.eyebrow}>Estado</Text>
          <Text style={styles.statusLine}>{STATUS_LABEL[day.status]}</Text>
        </>
      )}

      {/* Historia: VALORES reales de ese día (proteína, calorías, sueño…). */}
      {showValues && dataRows.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Lo que registraste</Text>
          <View style={styles.dataList}>
            {dataRows.map((r) => (
              <View key={r.label} style={styles.dataRow}>
                <Text style={styles.dataLabel}>{r.label}</Text>
                <Text style={styles.dataValue}>{r.value}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Historia: los platillos reales del día (nombre + kcal). */}
      {showMeals ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Comidas</Text>
          <View style={styles.mealList}>
            {meals!.map((m) => (
              <View key={m.id} style={styles.mealRow}>
                <Text style={styles.mealName} numberOfLines={1}>
                  {m.name}
                </Text>
                {m.calories != null ? (
                  <Text style={styles.mealKcal}>{Math.round(m.calories)} kcal</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Hoy: presencia (✓), no métricas — solo cuando NO mostramos valores. */}
      {!showValues && checks.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Registraste</Text>
          <View style={styles.checkWrap}>
            {checks.map((it) => (
              <View key={it.key} style={[styles.checkChip, observe && styles.checkChipObserve]}>
                <Text style={styles.checkMark}>✓</Text>
                <Text style={[styles.checkLabel, observe && styles.checkLabelObserve]}>
                  {it.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Evento(s) — revelaciones de ese día. Se listan TODAS (cada una en
          su línea): así no hay "+N" críptico y se ve qué pasó realmente. */}
      {observe && hasEvents ? <StarDivider /> : null}
      {hasEvents ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>{day.events.length > 1 ? 'Eventos' : 'Evento'}</Text>
          <View style={styles.eventList}>
            {day.events.map((ev) => {
              // El punto y la etiqueta del evento toman el COLOR de su tier, igual
              // que el marcador del calendario (azul = Patrón, oro = Revelación)
              // — así el día azul "se conecta" con su evento al abrirlo.
              const t = tierMeta(ev.tier)
              // Tocar el evento → re-vivir su ceremonia full-screen. Solo si
              // quien envuelve pasó onEventPress; si no, es de solo lectura.
              const tappable = onEventPress != null
              const body = (
                <>
                  <View style={styles.eventRow}>
                    <View style={[styles.eventDot, { backgroundColor: t.color }]} />
                    <Text style={styles.eventTitle}>{ev.title}</Text>
                    {t.label ? (
                      <Text style={[styles.eventTag, { color: t.color }]}>{t.label}</Text>
                    ) : null}
                    {tappable ? <Text style={styles.eventChevron}>›</Text> : null}
                  </View>
                  {/* La evidencia / el porqué — para patrones trae el conteo
                      ("X de los últimos N días…"); para transformación, el trazo. */}
                  {ev.message && ev.message !== ev.title ? (
                    <Text style={styles.eventEvidence}>{ev.message}</Text>
                  ) : null}
                  {tappable ? (
                    <Text style={styles.eventReplayHint}>Un momento para revivir</Text>
                  ) : null}
                </>
              )
              if (!tappable) {
                return (
                  <View key={ev.id} style={styles.eventItem}>
                    {body}
                  </View>
                )
              }
              return (
                <Pressable
                  key={ev.id}
                  style={({ pressed }) => [styles.eventItem, pressed && styles.eventItemPressed]}
                  onPress={() => onEventPress(ev)}
                  accessibilityRole="button"
                  accessibilityLabel={ev.title}
                  accessibilityHint="Vuelve a este momento"
                >
                  {body}
                </Pressable>
              )
            })}
          </View>
        </View>
      ) : null}

      {footer}
    </View>
  )
}

const styles = StyleSheet.create({
  // Fecha + remate (astro) como una sola fila: el día y su brillo se leen
  // juntos, no como dos elementos sueltos.
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  date: {
    flexShrink: 1,
    fontFamily: typography.displayHeavy,
    fontSize: 20,
    color: colors.leche,
    letterSpacing: -0.4,
    textTransform: 'capitalize',
  },
  // OBSERVACIÓN: la fecha sube a heroína — domina el sheet como "este día,
  // este recuerdo", no como un campo más.
  dateHero: {
    fontSize: 29,
    letterSpacing: -0.8,
    color: colors.oroLeche,
  },
  // OBSERVACIÓN: el estado como subtítulo serif italic (voz del coach), justo
  // bajo la fecha. Oro tenue = memoria; el vacío ("Un día tranquilo") se lee
  // sereno, nunca a reproche.
  statusPoetic: {
    marginTop: 4,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 17,
    color: colors.oroLight,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginTop: 14,
    marginBottom: 6,
  },
  statusLine: {
    fontFamily: typography.uiMedium,
    fontSize: 16,
    color: colors.bone,
  },
  section: {},
  // "Lo que registraste" — filas label · valor (Historia).
  dataList: {
    gap: 9,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  dataLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 14,
    color: colors.niebla,
  },
  dataValue: {
    fontFamily: typography.uiSemi,
    fontSize: 14,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  // "Comidas" — lista de platillos (nombre · kcal).
  mealList: {
    gap: 7,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  mealName: {
    flexShrink: 1,
    fontFamily: typography.uiMedium,
    fontSize: 14,
    color: colors.bone,
  },
  mealKcal: {
    fontFamily: typography.uiMedium,
    fontSize: 13,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  // Registraste — chips de presencia (✓ + etiqueta).
  checkWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.oroHairlineSoft,
  },
  // OBSERVACIÓN: los chips se leen como "logros guardados" del recuerdo —
  // borde oro más visible y más aire, no como pills deshabilitadas.
  checkChipObserve: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 12,
    borderColor: colors.oroHairline,
    backgroundColor: colors.oroTint,
  },
  checkMark: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    color: colors.magenta,
  },
  checkLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 12.5,
    color: colors.bone,
  },
  checkLabelObserve: {
    fontSize: 14,
    color: colors.leche,
  },
  // Divisor estelar (solo OBSERVACIÓN, antes de los eventos).
  divider: {
    marginTop: 18,
    marginBottom: 2,
  },
  // Evento(s)
  eventList: {
    gap: 12,
  },
  eventItem: {
    gap: 4,
  },
  eventItemPressed: {
    opacity: 0.6,
  },
  // El acento "›" al final de la fila: señala que el momento se puede re-vivir.
  // La etiqueta del tier ya empuja a la derecha con marginLeft:auto; el chevron
  // se sienta justo después. (Todos los eventos reales traen tier → etiqueta.)
  eventChevron: {
    marginLeft: 6,
    fontFamily: typography.uiMedium,
    fontSize: 18,
    color: colors.niebla,
  },
  // Pista discreta bajo la evidencia, alineada con ella (pasa el punto).
  eventReplayHint: {
    marginLeft: 14,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 0.6,
    color: colors.bruma,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // La evidencia bajo el título, alineada pasando el punto (6 + gap 8).
  eventEvidence: {
    marginLeft: 14,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 18,
    color: colors.niebla,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.oro,
  },
  // Etiqueta del tier (Patrón / Revelación) a la derecha del título, en su color.
  eventTag: {
    marginLeft: 'auto',
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  eventTitle: {
    flexShrink: 1,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.oroLight,
  },
})
