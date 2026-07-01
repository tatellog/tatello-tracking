import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'

import { colors, typography } from '@/theme'

import type { CalendarDay, MonthCalendar } from '../month-built'

/*
 * "Tu mes de un vistazo" — el mapa estelar del mes. Responde "¿en qué días
 * estuviste en déficit?". Reescrito tras la auditoría de uxui + illustrator:
 *
 * El reencuadre clave: NO es "verde=bien / rosa=malo" (gramática de fitness que
 * roza la culpa), sino "días ENCENDIDOS vs cielo en reposo". El déficit es el
 * único día que emite luz (estrella oro con halo); el superávit es una brasa
 * que descansa (sin halo); muy bajo, un anillo cálido; sin datos, polvo. La
 * distinción es por LUMINANCIA + FORMA, no por hue alarmante → coherente con la
 * familia warm-gold de Stelar y manifiesto-safe (ni premia ni castiga).
 *
 * Calendario full-width (lee como calendario: cabecera L-M-M-J-V-S-D + hoy
 * marcado); el conteo va como caption debajo. Lógica en `monthCalendar`.
 */

const WD_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const
const DUST = colors.bruma

/** Un día = un punto de luz (o su ausencia). Centrado en su celda. */
function DayMark({ day }: { day: CalendarDay }) {
  if (day.status === 'deficit') {
    // Estrella encendida: bloom + glow + cuerpo + núcleo especular. El único
    // día que emite luz.
    return (
      <View style={styles.bloom}>
        <View style={styles.glow}>
          <View style={styles.starBody}>
            <View style={styles.starCore} />
          </View>
        </View>
      </View>
    )
  }
  if (day.status === 'surplus') {
    // Brasa que descansa: magenta de marca pero apagado, SIN halo (recede).
    return <View style={styles.ember} />
  }
  if (day.status === 'low') {
    // "Casi déficit, no celebrado": anillo cálido (no niebla fría).
    return <View style={styles.lowRing} />
  }
  // Sin datos: polvo cósmico que se hunde en el negro. El futuro, aún más.
  return <View style={[styles.dust, day.future ? styles.dustFuture : null]} />
}

export function MonthGlanceCalendar({
  data,
  onPickDay,
}: {
  data: MonthCalendar
  /** Tocar un día (no futuro) lo abre en Órbita · Día. */
  onPickDay?: (date: string) => void
}) {
  const [w, setW] = useState(0)
  const onLayout = (e: LayoutChangeEvent): void => {
    const next = e.nativeEvent.layout.width
    setW((p) => (Math.abs(p - next) < 1 ? p : next))
  }
  const cell = w > 0 ? w / 7 : 0
  const cells: (CalendarDay | null)[] = [...Array(data.leadOffset).fill(null), ...data.days]
  const pct = data.dataDays > 0 ? Math.round((data.deficitDays / data.dataDays) * 100) : 0

  return (
    <View
      style={styles.section}
      accessible
      accessibilityLabel={`${data.deficitDays} de ${data.dataDays} días en déficit este mes, ${pct} por ciento.`}
    >
      <View style={styles.calendar} onLayout={onLayout}>
        {cell > 0 ? (
          <>
            {/* Cabecera de días: 7 letras tenues (sin cajas → no es Excel). */}
            <View style={styles.weekHead}>
              {WD_INITIALS.map((d, i) => (
                <Text key={i} style={[styles.weekInitial, { width: cell }]}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((c, i) => {
                // Cada día (no futuro) es tappable → abre ese día en Órbita Día.
                // El Pressable va DENTRO de la celda de ancho fijo: así la grilla
                // (flexWrap por `width: cell`) no cambia su layout, solo se vuelve
                // tappable la marca de adentro.
                const tappable = c != null && !c.future && onPickDay != null
                const inner = (
                  <>
                    {/* Hoy: aro tenue de orientación temporal, detrás de la marca. */}
                    {c?.isToday ? <View style={styles.todayRing} /> : null}
                    {c ? <DayMark day={c} /> : null}
                    {/* El número del día — para saber QUÉ día estás tocando. Tenue,
                        bajo la estrella; en hoy, más claro. */}
                    {c ? (
                      <Text style={[styles.dayNum, c.isToday && styles.dayNumToday]}>{c.day}</Text>
                    ) : null}
                  </>
                )
                return (
                  <View key={i} style={[styles.cellBox, { width: cell, height: cell }]}>
                    {tappable ? (
                      <Pressable
                        onPress={() => onPickDay!(c!.date)}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir el día ${c!.day} en Órbita Día`}
                        style={({ pressed }) => [styles.cellFill, pressed && styles.cellPressed]}
                      >
                        {inner}
                      </Pressable>
                    ) : (
                      inner
                    )}
                  </View>
                )
              })}
            </View>
            {onPickDay ? (
              <Text style={styles.tapHint}>Toca un día para abrirlo en Día.</Text>
            ) : null}
          </>
        ) : null}
      </View>

      {/* Conteo como caption: describe la grilla de arriba. Número en leche
          (sereno); el campo de estrellas oro es la textura. */}
      <Text style={styles.caption}>
        <Text style={styles.captionNum}>{data.deficitDays}</Text>
        <Text style={styles.captionRest}> de {data.dataDays} días en déficit</Text>
        <Text style={styles.captionDot}> · </Text>
        <Text style={styles.captionPct}>{pct}%</Text>
      </Text>

      {/* Leyenda: cada chip es una miniatura del tratamiento real. */}
      <View style={styles.legend}>
        <LegendItem kind="deficit" label="Déficit" />
        <LegendItem kind="surplus" label="Superávit" />
        <LegendItem kind="none" label="Sin datos" />
        {data.hasLow ? <LegendItem kind="low" label="Muy bajo" /> : null}
      </View>
    </View>
  )
}

function LegendItem({ kind, label }: { kind: CalendarDay['status']; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={styles.legendSwatch}>
        {kind === 'deficit' ? (
          <View style={styles.legendGlow}>
            <View style={styles.legendStar} />
          </View>
        ) : kind === 'surplus' ? (
          <View style={styles.ember} />
        ) : kind === 'low' ? (
          <View style={styles.lowRing} />
        ) : (
          <View style={styles.dust} />
        )}
      </View>
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // El encabezado (categoría + mes + pregunta) lo pone MonthSegment; aquí la
  // rejilla se pega debajo, no flota como otra tarjeta.
  section: {
    marginTop: 18,
  },
  // ── Calendario full-width ─────────────────────────────────────
  calendar: {
    marginTop: 22,
  },
  weekHead: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekInitial: {
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 0.5,
    color: colors.niebla,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cellBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // El Pressable llena la celda y centra la marca (no toca el ancho del grid).
  cellFill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellPressed: {
    opacity: 0.55,
  },
  // El número del día — pequeño y tenue bajo la estrella (identifica el día sin
  // robarle el protagonismo al mapa estelar).
  dayNum: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: 9.5,
    letterSpacing: 0.2,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  dayNumToday: {
    fontFamily: typography.uiBold,
    color: colors.leche,
  },
  // Pista de tappabilidad — niebla, centrada, como la tira de Semana.
  tapHint: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  // Aro de "hoy": orientación temporal, muy tenue.
  todayRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
  },
  // ── Día en déficit: estrella encendida (bloom > glow > cuerpo > núcleo) ──
  bloom: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.oroBloom,
  },
  glow: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.oroGlow,
  },
  starBody: {
    width: 8,
    height: 8,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.oroLight,
    // Bloom real en iOS; en Android el stack de Views ya da el halo.
    ...Platform.select({
      ios: {
        shadowColor: colors.oro,
        shadowOpacity: 0.9,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
      },
      default: {},
    }),
  },
  starCore: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: colors.oroLeche,
  },
  // ── Día sobre meta: brasa que descansa (sin halo) ─────────────
  ember: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.magentaDeep,
    opacity: 0.6,
  },
  // ── Muy bajo: anillo cálido ───────────────────────────────────
  lowRing: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.2,
    borderColor: 'rgba(217, 174, 111, 0.35)',
    backgroundColor: 'transparent',
  },
  // ── Sin datos: polvo ──────────────────────────────────────────
  dust: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: DUST,
    opacity: 0.55,
  },
  dustFuture: {
    opacity: 0.25,
  },
  // ── Conteo (caption) ──────────────────────────────────────────
  caption: {
    marginTop: 22,
    paddingLeft: 2,
    fontVariant: ['tabular-nums'],
  },
  captionNum: {
    fontFamily: typography.uiBold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: colors.leche,
  },
  captionRest: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  captionDot: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bruma,
  },
  captionPct: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  // ── Leyenda ───────────────────────────────────────────────────
  legend: {
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Swatch de ancho fijo para alinear las etiquetas pese a tamaños distintos.
  legendSwatch: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendGlow: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.oroGlow,
  },
  legendStar: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.oroLight,
  },
  legendLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
})
