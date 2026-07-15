import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Circle, Line, Path } from 'react-native-svg'

import { PrimaryCta } from '@/components/PrimaryCta'
import { requestOrbitSegment } from '@/features/orbit/pending-segment'
import { useBodyCheckins, useProgressInsights } from '@/features/progress/hooks'
import {
  compareBuckets,
  compareCheckins,
  compareSynthesis,
  elapsedLabel,
  type CheckinDelta,
  type CheckinDeltaKey,
} from '@/features/progress/logic'
import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry/four-point-star-path'
import { LinkCta } from '@/features/progress/components/LinkCta'
import { PROGRESS_EVENTS } from '@/features/progress/constants'
import { SkyBackground } from '@/features/tabs/components'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

/*
 * Análisis (D · Progress 3.0, versión DETERMINISTA para beta; Epic 08 · F3 lo
 * consolida como EL comparador de pantalla completa) — la síntesis honesta +
 * botones GUIADOS que revelan cards. Cero IA: todo sale del motor
 * (compareCheckins/compareSynthesis/compareBuckets + Progress Insight Engine).
 * SIN ✦: el sello es exclusivo del chat IA (regla dueña) y esta pantalla es
 * motor — no finge chat ni mente. F3 añade: picker de fechas A→B arriba (era
 * solo-params) y "¿Qué patrones ves?" con los hallazgos del engine. El porqué
 * vive en Órbita (línea del módulo).
 */

const LABEL: Record<CheckinDeltaKey, { name: string; unit: string }> = {
  weight_kg: { name: 'Peso', unit: 'kg' },
  body_fat_pct: { name: 'Grasa corporal', unit: '%' },
  muscle_kg: { name: 'Músculo', unit: 'kg' },
  water_pct: { name: 'Agua', unit: '%' },
  visceral_fat_index: { name: 'Visceral (índice)', unit: '' },
  bmi: { name: 'IMC', unit: '' },
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDay = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`
const fmtVal = (v: number, unit: string) =>
  `${v % 1 === 0 ? v : v.toFixed(1)}${unit ? ` ${unit}` : ''}`

export default function ProgressAnalysisScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ a?: string; b?: string }>()
  const { data, isPending } = useBodyCheckins()
  const checkins = useMemo(() => data ?? [], [data])
  const dates = useMemo(() => checkins.map((c) => c.measured_on), [checkins])

  const [openPatterns, setOpenPatterns] = useState(false)

  // F3: las fechas se ELIGEN aquí (picker A→B); los params solo precargan.
  const [dayA, setDayA] = useState<string | null>(null)
  const [dayB, setDayB] = useState<string | null>(null)
  const [picking, setPicking] = useState<'a' | 'b' | null>(null)

  const paramA = typeof params.a === 'string' ? params.a : undefined
  const paramB = typeof params.b === 'string' ? params.b : undefined
  let a =
    (dayA && dates.includes(dayA) ? dayA : undefined) ??
    (paramA && dates.includes(paramA) ? paramA : undefined) ??
    dates[dates.length - 2]
  let b =
    (dayB && dates.includes(dayB) ? dayB : undefined) ??
    (paramB && dates.includes(paramB) ? paramB : undefined) ??
    dates[dates.length - 1]
  // Normalización CRONOLÓGICA (uxui, bloqueante): con A posterior a B la
  // síntesis se invertía ("bajaste" cuando subió). Nunca castigar por
  // explorar: se reordena solo.
  if (a && b && a > b) [a, b] = [b, a]
  const elapsedDays =
    a && b
      ? Math.round(
          (new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000,
        )
      : 0
  const isLatest = b != null && b === dates[dates.length - 1]

  // Atajos de rango CON historia (benchmark): el default sigue siendo
  // penúltima→última; el pico alinea el Análisis con la historia del hero.
  const peakDay = useMemo(() => {
    let best: { day: string; w: number } | null = null
    for (const c of checkins) {
      if (c.weight_kg != null && (best == null || c.weight_kg > best.w)) {
        best = { day: c.measured_on, w: c.weight_kg }
      }
    }
    return best?.day ?? null
  }, [checkins])
  const lastDay = dates[dates.length - 1]
  const ranges: { key: string; label: string; a: string; b: string }[] = []
  if (dates.length >= 2 && lastDay) {
    ranges.push({ key: 'last', label: 'Última', a: dates[dates.length - 2]!, b: lastDay })
    if (peakDay && peakDay !== lastDay && peakDay !== dates[dates.length - 2]) {
      ranges.push({ key: 'peak', label: 'Desde tu pico', a: peakDay, b: lastDay })
    }
    if (dates.length > 2 && dates[0] !== peakDay) {
      ranges.push({ key: 'start', label: 'Desde el inicio', a: dates[0]!, b: lastDay })
    }
  }

  const checkinA = checkins.find((c) => c.measured_on === a)
  const checkinB = checkins.find((c) => c.measured_on === b)
  const rows = checkinA && checkinB && a !== b ? compareCheckins(checkinA, checkinB) : []
  const synthesis = compareSynthesis(rows, { startingPointCloser: isLatest })
  const { gains, hard } = compareBuckets(rows)

  // Hallazgos del Progress Insight Engine (determinístico) — el puente
  // conceptual con Órbita: qué cambió y con qué se relaciona.
  const insightsState = useProgressInsights()
  const insights =
    insightsState.status === 'completed' || insightsState.status === 'partial'
      ? insightsState.data.slice(0, 2)
      : []

  const pick = (side: 'a' | 'b', d: string) => {
    if (side === 'a') setDayA(d)
    else setDayB(d)
    setPicking(null)
    track(PROGRESS_EVENTS.compare, { kind: 'analysis-pick' })
  }

  const goOrbita = () => {
    track(PROGRESS_EVENTS.openOrbita, { from: 'analysis' })
    requestOrbitSegment('mes')
    router.push('/orbit')
  }

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Análisis</Text>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke={colors.bone}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {isPending ? (
            /* Cargando NO es "no tienes suficientes mediciones": ese flash era
               una micro-traición para quien lleva 20 (uxui). */
            <View style={styles.skeleton}>
              {Array.from({ length: 3 }, (_, i) => (
                <View key={i} style={styles.skeletonCard} />
              ))}
            </View>
          ) : !a || !b || dates.length < 2 ? (
            <View>
              <Text style={styles.empty}>
                Necesitas dos mediciones para poder comparar. Registra la siguiente cuando quieras.
              </Text>
              <View style={styles.emptyCta}>
                <PrimaryCta label="Nueva medición" onPress={() => router.push('/log-checkin')} />
              </View>
            </View>
          ) : (
            <>
              {/* Rangos con historia (benchmark): cero taps a las tres
                  comparaciones que significan algo. El picker manual queda
                  para el caso libre. */}
              {ranges.length > 1 ? (
                <View style={styles.rangeRow}>
                  {ranges.map((r) => {
                    const on = r.a === a && r.b === b
                    return (
                      <Pressable
                        key={r.key}
                        onPress={() => {
                          setDayA(r.a)
                          setDayB(r.b)
                          setPicking(null)
                          track(PROGRESS_EVENTS.compare, { kind: `analysis-range-${r.key}` })
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        style={({ pressed }) => pressed && { opacity: 0.75 }}
                      >
                        <View style={[styles.option, on && styles.optionOn]}>
                          <Text style={[styles.optionText, on && styles.optionTextOn]}>
                            {r.label}
                          </Text>
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
              ) : null}
              {/* F3 · el picker: tocar una fecha abre SOLO sus opciones. */}
              <View style={styles.pillRow}>
                <DatePill
                  label={fmtDay(a)}
                  open={picking === 'a'}
                  onPress={() => setPicking(picking === 'a' ? null : 'a')}
                  a11y="Cambiar la fecha inicial"
                />
                <CompareThread />
                <DatePill
                  label={fmtDay(b)}
                  open={picking === 'b'}
                  onPress={() => setPicking(picking === 'b' ? null : 'b')}
                  a11y="Cambiar la fecha final"
                />
              </View>
              {picking ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.optionsRow}
                >
                  <View style={styles.options}>
                    {dates
                      .filter((d) => (picking === 'a' ? d !== b : d !== a))
                      .slice()
                      .reverse()
                      .map((d) => {
                        const on = d === (picking === 'a' ? a : b)
                        return (
                          <Pressable
                            key={d}
                            onPress={() => pick(picking, d)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                            style={({ pressed }) => pressed && { opacity: 0.75 }}
                          >
                            <View style={[styles.option, on && styles.optionOn]}>
                              <Text style={[styles.optionText, on && styles.optionTextOn]}>
                                {fmtDay(d)}
                              </Text>
                            </View>
                          </Pressable>
                        )
                      })}
                  </View>
                </ScrollView>
              ) : null}

              {/* El contexto que reencuadra cada delta (+5.3 en 3 semanas no
                  es +5.3 en 9 meses); las fechas ya viven en las pills. */}
              <Text style={styles.whoText}>
                {elapsedDays < 1
                  ? 'Lo que cambió ese día'
                  : `Lo que cambió en ${elapsedLabel(elapsedDays)}`}
              </Text>

              {rows.length === 0 ? (
                <Text style={styles.noShared}>
                  Estas dos fechas no tienen métricas en común. Prueba con otras.
                </Text>
              ) : null}

              {synthesis ? <Text style={styles.synthesis}>{synthesis}</Text> : null}

              {rows.length > 0 ? (
                <>
                  {/* Umbral voz→expediente (illustrator): divider a media
                      intensidad, sin halo — separa, no celebra. */}
                  <View style={styles.ornamentRow} pointerEvents="none">
                    <Svg width="100%" height={12} viewBox="0 0 320 12">
                      <Line
                        x1={40}
                        y1={6}
                        x2={148}
                        y2={6}
                        stroke={colors.oroHairlineSoft}
                        strokeWidth={1}
                      />
                      <Line
                        x1={172}
                        y1={6}
                        x2={280}
                        y2={6}
                        stroke={colors.oroHairlineSoft}
                        strokeWidth={1}
                      />
                      <Path
                        d={fourPointStarPath(160, 6, 3.2)}
                        fill={colors.oroSoft}
                        opacity={0.8}
                      />
                    </Svg>
                  </View>
                  {/* Header ESTÁTICO (uxui): el acordeón abierto por defecto
                      solo servía para vaciar la pantalla. */}
                  <Text style={styles.sectionHead}>¿Qué cambió?</Text>
                  <Animated.View entering={FadeIn.duration(240)} style={styles.card}>
                    {gains.map((r) => (
                      <ChangeRow key={r.key} row={r} favorable />
                    ))}
                    {hard.map((r) => (
                      <ChangeRow key={r.key} row={r} />
                    ))}
                    {/* Las sin cambio TAMBIÉN (uxui: una sola card que es
                          interpretación Y dato completo — la vieja card
                          "Muéstrame los datos" era esta misma lista sin los
                          deltas, acordeón de relleno). */}
                    {rows
                      .filter((r) => r.delta === 0)
                      .map((r) => {
                        const meta = LABEL[r.key]
                        return (
                          <View key={r.key} style={styles.changeRow}>
                            <View style={styles.changeMain}>
                              <Text style={styles.changeLabel}>{meta.name}</Text>
                              {/* Atenuadas: "51 → 51" no debe gritar igual
                                    que "+5.3" (uxui). */}
                              <Text style={[styles.changeValues, styles.changeValuesMuted]}>
                                {fmtVal(r.a, meta.unit)} → {fmtVal(r.b, meta.unit)}
                              </Text>
                            </View>
                            <Text style={styles.noChangeTag}>sin cambio</Text>
                          </View>
                        )
                      })}
                  </Animated.View>

                  {/* El "muéstrame los datos" DE VERDAD es la tabla cruda. */}
                  <LinkCta
                    label="Ver todas tus mediciones →"
                    onPress={() => router.push('/progress-table')}
                    accessibilityLabel="Ver la tabla completa de mediciones"
                    style={styles.tableLink}
                  />
                </>
              ) : null}

              {/* F3 · los hallazgos del engine (máx 2): qué cambió y con qué
                  se relaciona — el puente conceptual hacia Órbita. */}
              {insights.length > 0 ? (
                <>
                  <GuideButton
                    label="¿Qué patrones ves?"
                    open={openPatterns}
                    onPress={() => {
                      setOpenPatterns((v) => !v)
                      track(PROGRESS_EVENTS.openInsight, { kind: 'analysis-patterns' })
                    }}
                  />
                  {openPatterns ? (
                    <Animated.View entering={FadeIn.duration(240)} style={styles.card}>
                      {insights.map((ins) => (
                        <View key={ins.id} style={styles.insightRow}>
                          <Text style={styles.insightLead}>{ins.lead}</Text>
                          <Text style={styles.insightSupport}>{ins.support}</Text>
                        </View>
                      ))}
                    </Animated.View>
                  ) : null}
                </>
              ) : null}

              {/* La salida a Órbita respira aparte: es otra clase de acción
                  (irse), no otra pregunta. */}
              <GuideButton
                label="Abrir en Órbita"
                chevron
                onPress={goOrbita}
                style={styles.orbitaGuide}
              />
              <Text style={styles.orbitaHint}>Aquí ves qué cambió. El porqué vive en Órbita.</Text>

              <Text style={styles.disclaimer}>
                Stelar solo interpreta tus registros. No sustituye a un profesional de la salud.
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

/* Quirk del repo en ambos: el layout/visual vive en el View INTERNO; el
 * Pressable solo envuelve con cosmética de pressed. Con los estilos directo
 * en el Pressable, las cards colapsaban a texto plano con el chevron
 * huérfano en otra línea (screenshot dueña 14 jul 2026). */

/** El comparador como constelación de dos nodos (illustrator): el antes
 *  apagado, el ahora encendido con halo. Decorativa: las pills llevan la
 *  accesibilidad. Sin animación — es cartografía, no notificación. */
function CompareThread() {
  return (
    <Svg width={38} height={20} viewBox="0 0 38 20" pointerEvents="none">
      <Path d={fourPointStarPath(5.5, 10, 3)} fill={colors.bone} opacity={0.55} />
      <Line x1={9.5} y1={10} x2={26} y2={10} stroke={colors.oroHairline} strokeWidth={1} />
      <Circle cx={31.5} cy={10} r={6} fill={colors.oroGlow} opacity={0.5} />
      <Path d={fourPointStarPath(31.5, 10, 4.2)} fill={colors.oroSoft} />
    </Svg>
  )
}

function DatePill({
  label,
  open,
  onPress,
  a11y,
}: {
  label: string
  open: boolean
  onPress: () => void
  a11y: string
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => pressed && { opacity: 0.75 }}
    >
      <View style={[styles.pill, open && styles.pillOpen]}>
        <Text style={styles.pillText}>{label}</Text>
        <Text style={[styles.pillCaret, open && styles.pillCaretOpen]}>▾</Text>
      </View>
    </Pressable>
  )
}

function GuideButton({
  label,
  open,
  chevron,
  onPress,
  style,
}: {
  label: string
  open?: boolean
  chevron?: boolean
  onPress: () => void
  style?: object
}) {
  return (
    <View style={[styles.guideWrap, style]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={open != null ? { expanded: open } : undefined}
        style={({ pressed }) => pressed && { opacity: 0.75 }}
      >
        <View style={styles.guide}>
          <Text style={styles.guideText}>{label}</Text>
          <Text style={styles.guideGlyph}>{chevron ? '→' : open ? '▾' : '▸'}</Text>
        </View>
      </Pressable>
    </View>
  )
}

/** Un cambio como HECHO. Los rescates llevan la marca "a tu favor" (oro);
 *  los demás se nombran planos — no existe la etiqueta del bucket malo. */
function ChangeRow({ row, favorable }: { row: CheckinDelta; favorable?: boolean }) {
  const meta = LABEL[row.key]
  const arrow = row.delta > 0 ? '↑' : '↓'
  return (
    <View style={styles.changeRow}>
      <View style={styles.changeMain}>
        <Text style={styles.changeLabel}>{meta.name}</Text>
        <Text style={styles.changeValues}>
          {fmtVal(row.a, meta.unit)} → {fmtVal(row.b, meta.unit)}
        </Text>
      </View>
      <View style={styles.changeSide}>
        <Text style={[styles.changeDelta, favorable && styles.changeDeltaFav]}>
          {arrow} {row.delta > 0 ? '+' : '−'}
          {fmtVal(Math.abs(row.delta), meta.unit)}
        </Text>
        {favorable ? <Text style={styles.favTag}>a tu favor</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.5,
  },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  empty: {
    marginTop: 30,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    textAlign: 'center',
  },
  // Picker de fechas (mismo lenguaje que el comparador del tab).
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard2,
  },
  pillOpen: { borderColor: colors.magentaGlow, backgroundColor: colors.magentaTint },
  pillText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  pillCaret: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
  pillCaretOpen: { color: colors.magentaHot },
  rangeRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  ornamentRow: { alignItems: 'center', marginBottom: 2 },
  sectionHead: {
    marginTop: 10,
    marginBottom: 8,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  changeValuesMuted: { color: colors.niebla, fontFamily: typography.uiMedium },
  optionsRow: { marginBottom: 12 },
  options: { flexDirection: 'row', gap: 6 },
  option: {
    minHeight: 36,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bruma,
  },
  optionOn: { backgroundColor: colors.magentaTint2, borderColor: colors.magentaGlow },
  optionText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  optionTextOn: { color: colors.magentaHot, fontFamily: typography.uiBold },
  whoText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    marginBottom: 12,
    fontVariant: ['tabular-nums'],
  },
  synthesis: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    lineHeight: 30,
    color: colors.leche,
    marginBottom: 14,
  },
  guideWrap: { marginTop: 10 },
  guide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: colors.bgCard,
  },
  guideText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  guideGlyph: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.magentaHot,
  },
  card: {
    marginTop: 8,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.oroHairlineSoft,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  changeMain: { flex: 1 },
  changeLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  changeValues: {
    marginTop: 3,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  changeSide: { alignItems: 'flex-end' },
  // Neutro (hecho, no premio): el ORO queda reservado a los rescates — con
  // todos los deltas dorados, subir grasa brillaba igual que ganar músculo.
  changeDelta: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  changeDeltaFav: { color: colors.oroLight },
  noChangeTag: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  tableLink: { alignSelf: 'center', marginTop: 4 },
  skeleton: { paddingTop: 8, gap: 12 },
  skeletonCard: { height: 64, borderRadius: 14, backgroundColor: colors.bgCard, opacity: 0.6 },
  emptyCta: { marginTop: 20 },
  favTag: {
    marginTop: 2,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  // Hallazgos del engine: lead en voz de coach + evidencia con números.
  insightRow: { paddingVertical: 10 },
  insightLead: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 24,
    color: colors.leche,
  },
  insightSupport: {
    marginTop: 5,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  // Hanken: aviso funcional, no voz del coach.
  noShared: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.bone,
    marginBottom: 14,
  },
  orbitaGuide: { marginTop: 26 },
  // Hanken, no serif: es explicación de producto, no voz del coach (regla
  // italic = coach del design system).
  orbitaHint: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  disclaimer: {
    marginTop: 22,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
})
