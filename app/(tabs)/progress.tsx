import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { EyebrowLabel } from '@/components/EyebrowLabel'
import { track } from '@/lib/analytics'
import { useCyclePhase } from '@/features/cycle/useCyclePhase'
import { useMacroTargets } from '@/features/macros/hooks'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { daysInDeficit } from '@/features/orbit/month-built'
import { useProfile } from '@/features/profile/hooks'
import { BeforeAfterPhotos } from '@/features/progress/components/BeforeAfterPhotos'
import { CheckinCompare } from '@/features/progress/components/CheckinCompare'
import { EvidenceTimeline } from '@/features/progress/components/EvidenceTimeline'
import { CompositionCards } from '@/features/progress/components/CompositionCards'
import { HistoryChips } from '@/features/progress/components/HistoryChips'
import { LinkCta } from '@/features/progress/components/LinkCta'
import { SynthesisCard } from '@/features/progress/components/SynthesisCard'
import { TrajectoryChart } from '@/features/progress/components/TrajectoryChart'
import { TransformationHero } from '@/features/progress/components/TransformationHero'
import { ZonesEvolution } from '@/features/progress/components/ZonesEvolution'
import { PROGRESS_EVENTS } from '@/features/progress/constants'
import { ProgressInsightCard } from '@/features/progress/components/ProgressInsightCard'
import { PROGRESS_BODY_ENABLED } from '@/lib/featureFlags'
import { useBodyCheckins, useMeasurements } from '@/features/progress/hooks'
import {
  computeDelta,
  computeTrend,
  formatTrendCopy,
  mergeWeightSeries,
  smoothWeightPoints,
} from '@/features/progress/logic'
import { CoachLine, PrimaryCta, SkyBackground, TabHeader } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

// `ALL` (not `TODO`) for the "todo el historial" option — the all-caps
// Spanish word read as a dev-leftover marker in grep + tripped code
// review tools. English keys + Spanish display labels mirrors the
// pattern in RangeChips.tsx.
type Period = '7D' | '30D' | '90D' | 'ALL'

const PERIOD_DAYS: Record<Period, number | null> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
  ALL: null,
}

// Display labels — the pills read in plain Spanish.
const PERIOD_LABEL: Record<Period, string> = {
  '7D': '7 días',
  '30D': '30 días',
  '90D': '90 días',
  ALL: 'Todo',
}

// Los dos segmentos de Progress (Epic 01): Historia (¿qué cambió en mis hábitos?)
// y Body (¿qué cambió en mi cuerpo?, Epic 02 lo llena). Como Órbita Día/Semana/Mes.
type ProgressSegment = 'historia' | 'body'

/** Switcher Historia | Body — píldora de dos segmentos (mismo lenguaje que el
 *  selector de periodo del peso). */
function SegmentSwitcher({
  value,
  onChange,
}: {
  value: ProgressSegment
  onChange: (s: ProgressSegment) => void
}) {
  // "Cuerpo" en la UI (Capa 2, español, coherente con Hoy/Comidas/Órbita);
  // "Body" queda como nombre interno de la épica (Capa 3) — benchmark + mockup.
  const segs: { key: ProgressSegment; label: string }[] = [
    { key: 'historia', label: 'Historia' },
    { key: 'body', label: 'Cuerpo' },
  ]
  return (
    <View style={styles.segmentPill}>
      {segs.map((s) => {
        const on = s.key === value
        return (
          <Pressable
            key={s.key}
            onPress={() => onChange(s.key)}
            style={[styles.segmentSeg, on && styles.segmentSegOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.segmentLabel, on && styles.segmentLabelOn]}>{s.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export default function ProgressScreen() {
  return (
    <ErrorBoundary screen="progreso">
      <ProgressBody />
    </ErrorBoundary>
  )
}

function ProgressBody() {
  useFocusEffect(
    useCallback(() => {
      track('tab_changed', { tab: 'progreso' })
    }, []),
  )
  const router = useRouter()
  const [segment, setSegment] = useState<ProgressSegment>('historia')
  const [period, setPeriod] = useState<Period>('30D')

  const goBody = () => {
    track(PROGRESS_EVENTS.body)
    setSegment('body')
  }
  // Fusión "detalle de medición": tap en el timeline preselecciona el comparador
  // Y hace scroll hasta él (sin el scroll, el tap no tenía ningún feedback
  // visible). El preset se limpia al cambiar de segmento: pegado, servía "mejor
  // momento vs peor momento" como default (casi hace cerrar la app · beta).
  const [comparePresetA, setComparePresetA] = useState<string | null>(null)
  const scrollRef = useRef<ScrollView>(null)
  const compareY = useRef(0)
  useEffect(() => {
    if (segment !== 'body') setComparePresetA(null)
  }, [segment])
  const pickCompare = useCallback((day: string) => {
    setComparePresetA(day)
    scrollRef.current?.scrollTo({ y: compareY.current, animated: true })
  }, [])
  const measurementsQuery = useMeasurements(null)
  const checkinsQuery = useBodyCheckins()
  const { data: profile } = useProfile()

  // UNA sola serie de peso (app + check-ins del coach) — la misma verdad que el
  // hero. El periodo se recorta client-side sobre la serie fusionada.
  const points = useMemo(() => {
    const fused = mergeWeightSeries(measurementsQuery.data ?? [], checkinsQuery.data ?? [])
    const days = PERIOD_DAYS[period]
    if (days == null) return fused
    const since = Date.now() - days * 24 * 60 * 60 * 1000
    return fused.filter((p) => p.t >= since)
  }, [measurementsQuery.data, checkinsQuery.data, period])
  // Weight is shown smoothed — a trailing 7-day moving average — so a
  // single noisy weigh-in never becomes the trend, the delta or the
  // headline number. The raw `points` are kept only for the count.
  const smoothed = useMemo(() => smoothWeightPoints(points), [points])
  const delta = useMemo(() => computeDelta(smoothed), [smoothed])
  const trend = useMemo(() => computeTrend(smoothed), [smoothed])

  const first = smoothed[0]
  const last = smoothed[smoothed.length - 1]
  const count = points.length

  // "Báscula quieta, esfuerzo presente" (benchmark · el momento exacto donde
  // una abandona): cuando los 30 días RODANTES están planos pero hubo días en
  // déficit, esa constatación vive AQUÍ, junto al peso — antes la usuaria
  // tenía que armarla a mano cruzando a Historia. Hechos, cero promesa de
  // resultado (línea roja: nunca "pronto se reflejará").
  const targets = useMacroTargets().data
  const signals30 = useSignalsHistory(30)
  const plateauNote = useMemo(() => {
    const fused = mergeWeightSeries(measurementsQuery.data ?? [], checkinsQuery.data ?? [])
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000
    const smoothed30 = smoothWeightPoints(fused.filter((p) => p.t >= since))
    const d = computeDelta(smoothed30)
    // Plano = |cambio| < 0.3 kg con al menos 3 puntos (menos es "sin datos",
    // no "sin movimiento").
    if (!d || smoothed30.length < 3 || Math.abs(d.abs) >= 0.3) return null
    const summary = daysInDeficit(signals30.data ?? [], {
      calorieTarget: targets?.calories ?? null,
    })
    // Mismo umbral que la Síntesis (MIN_DEFICIT_DAYS): menos de 3 días en
    // déficit no se nombra como esfuerzo.
    if (summary == null || summary.deficitDays < 3) return null
    return `La báscula casi no se movió estos 30 días. Tus ${summary.deficitDays} días en déficit sí quedaron registrados.`
  }, [measurementsQuery.data, checkinsQuery.data, signals30.data, targets?.calories])

  // Cycle phase — used to caption the weight chart so a luteal
  // water-weight bump reads as biology, not regression. (Único hogar del
  // ciclo en este tab; la card standalone se fue de Historia.)
  const cycle = useCyclePhase()

  // The user's declared focus for the month. When it isn't weight,
  // the "Tu cuerpo" section says so — the number is reference, not a
  // goal they should be chasing.
  const focusIsWeight = profile?.monthly_focus === 'weight'
  const hasFocus = profile?.monthly_focus != null

  // UNA sola puerta de captura (uxui 14 jul 2026): log-checkin abre en modo
  // Peso con la rueda lista, así que el caso común sigue siendo 0 fricción.
  // El peso impulsivo de diario vive en ✦ QuickLog, que no se toca.
  const goLogMeasurement = () => router.push('/log-checkin')
  const hasTrajectory = count >= 2
  // Mientras cargan las queries, count===0 se disfrazaba de "primera vez" y una
  // veterana veía el empty-hero un instante (uxui: falso vacío = micro-traición).
  const weightLoading = measurementsQuery.isPending || checkinsQuery.isPending

  return (
    <View style={styles.screen}>
      <SkyBackground />

      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(280)}>
            <TabHeader title="Tu progreso" titleEmphasis="Tu" />
          </Animated.View>

          {/* El "＋" vive junto al switcher SOLO en Cuerpo: Progreso → Cuerpo
              → ＋ = nueva medición sin scroll (uxui). Discreto: el CTA magenta
              del cierre sigue siendo único. */}
          <View style={styles.switcherRow}>
            <View style={styles.switcherGrow}>
              <SegmentSwitcher value={segment} onChange={setSegment} />
            </View>
            {segment === 'body' ? (
              <Pressable
                onPress={goLogMeasurement}
                accessibilityRole="button"
                accessibilityLabel="Nueva medición"
                style={({ pressed }) => pressed && { opacity: 0.7 }}
              >
                <View style={styles.addChip}>
                  <Text style={styles.addChipGlyph}>＋</Text>
                </View>
              </Pressable>
            ) : null}
          </View>

          {segment === 'historia' ? (
            <>
              {/* F1 · "Tus últimos 30 días": chips 30v30 con sparklines, driven
                  por el Comparison Engine (UNA matemática — reemplaza a
                  TuHistoria, que calculaba su propia ventana). */}
              <HistoryChips />

              {/* Insight principal + chat guiado (Epic 04). Doble-gateado (flag +
                  dev) y auto-oculto sin insights — trae su propio divisor. */}
              <ProgressInsightCard />

              {/* (La card de ciclo se fue de Historia: un concepto, un hogar —
                  el ciclo vive en Hoy, y aquí solo como nota contextual bajo la
                  gráfica de peso de Cuerpo, donde explica la báscula.) */}

              {/* "Tu cambio visual" — la evidencia emocional más fuerte: antes →
              ahora en grande, con modo "Comparar" (slider de arrastrar).
              Responde "¿realmente cambio?". */}
              <View style={styles.divider} />
              <BeforeAfterPhotos />

              {/* A · el antojo: Historia delega la evolución completa a Cuerpo
                  (un solo hogar para la tira — nunca duplicarla aquí). */}
              <LinkCta
                label="Ver tu evolución completa →"
                onPress={goBody}
                accessibilityLabel="Ver tu evolución completa"
                style={styles.bridgeLink}
              />

              {/* Síntesis — resultado → causa → qué intentar. CIERRA Historia
              (peak-end: el último sabor del scroll es la palanca abierta, la
              razón de volver el domingo — nunca un dato triste). Absorbe la
              vieja ReadingCard; su link a Órbita es el único saliente del tab.
              La card del emblema se retiró: su % junto a la báscula se leía
              como "% de mi meta de peso" (anti-patrón por contexto). */}
              <View style={styles.divider} />
              <SynthesisCard />

              {/* Epic 06 · puente al calendario: ver (y editar) los días detrás
                  de estos números — el cierre único de Historia (dieta de CTAs:
                  el segmento Cuerpo ya tiene su puerta en el switcher). */}
              <LinkCta
                label="Ver tu constancia, día por día →"
                onPress={() => {
                  track(PROGRESS_EVENTS.openCalendar)
                  router.navigate('/movement-calendar')
                }}
                accessibilityLabel="Ver tu constancia"
                style={styles.bridgeLink}
              />

              {/* (La coda "Tu transformación nunca retrocede" se retiró: suelta
                  sonaba a frase de taza y para quien rebotó era además falsa
                  sobre el peso. Vuelve DESPUÉS de beta atada a la Historia de
                  hitos inmutables, donde cada trofeo la respalda.) */}
            </>
          ) : (
            <>
              {/* F2 · hero "Tu transformación": primera marca → hoy con el arco
                  dorado (peso suavizado). Se auto-oculta con <2 mediciones. */}
              <TransformationHero />
              {/* El espacio ES el separador (brief UI polish): en Cuerpo las
                  secciones respiran sin hairlines. */}
              <View style={styles.sectionGap} />

              {/* ── Body: Tu cuerpo — peso + medidas. Epic 02/F2: composición
                  con sparklines + comparador de fechas. ── */}
              <EyebrowLabel tone="magenta" size={10} style={styles.heroEyebrow}>
                Tu cuerpo
              </EyebrowLabel>
              {hasFocus && !focusIsWeight ? (
                <Text style={styles.focusNote}>
                  Tu enfoque este mes no es el peso. Esto es solo una referencia, sin metas.
                </Text>
              ) : hasTrajectory ? (
                <Text style={styles.patientSub}>
                  El cuerpo cambia despacio. Mira la tendencia, no el número del día.
                </Text>
              ) : null}
              {weightLoading ? null : hasTrajectory ? (
                <>
                  <Animated.View
                    entering={FadeIn.duration(360).delay(80)}
                    style={styles.weightHead}
                  >
                    {/* Peso ACTUAL — calmo, no gigante: un indicador más, no la
                    meta. El cambio total va como chip, la tendencia en la
                    gráfica. */}
                    <View>
                      <Text style={styles.weightLabel}>Peso actual</Text>
                      <View style={styles.weightNowRow}>
                        <Text style={styles.weightNow}>{last?.weight.toFixed(1)}</Text>
                        <Text style={styles.weightUnit}>kg</Text>
                      </View>
                    </View>
                    {delta ? (
                      <View style={styles.deltaChip}>
                        {/* "Total" SOLO cuando el periodo es Todo: la etiqueta fija
                            contradecía al hero (−2.2 "total" vs −0.1 "total") y
                            rompía la confianza en ambos números. */}
                        <Text style={styles.deltaChipLabel}>
                          {period === 'ALL'
                            ? 'Cambio total'
                            : `Cambio · ${PERIOD_LABEL[period].toLowerCase()}`}
                        </Text>
                        <Text style={styles.deltaChipNum}>{formatDelta(delta.abs)} kg</Text>
                      </View>
                    ) : null}
                  </Animated.View>

                  {/* Comparación temporal — antes → ahora en el periodo elegido. */}
                  {first && last ? (
                    <Text style={styles.comparison}>
                      <Text style={styles.compFrom}>{first.weight.toFixed(1)}</Text>
                      <Text style={styles.compArrow}>{'  →  '}</Text>
                      <Text style={styles.compTo}>{last.weight.toFixed(1)} kg</Text>
                      <Text
                        style={styles.compPeriod}
                      >{`   ·   ${PERIOD_LABEL[period].toLowerCase()}`}</Text>
                    </Text>
                  ) : null}

                  {/* Báscula quieta + esfuerzo presente, juntos (siempre sobre
                      los 30 días rodantes, independiente del chip de periodo). */}
                  {plateauNote ? (
                    <Animated.View entering={FadeIn.duration(360).delay(200)}>
                      <Text style={styles.plateauNote}>{plateauNote}</Text>
                    </Animated.View>
                  ) : null}

                  {/* Period filter — only meaningful once there are 2+ marks. */}
                  <Animated.View
                    entering={FadeIn.duration(320).delay(160)}
                    style={styles.periodPill}
                  >
                    {(Object.keys(PERIOD_DAYS) as Period[]).map((p) => {
                      const on = p === period
                      return (
                        <Pressable
                          key={p}
                          onPress={() => setPeriod(p)}
                          style={[styles.periodSeg, on && styles.periodSegOn]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                        >
                          <Text style={[styles.periodLabel, on && styles.periodLabelOn]}>
                            {PERIOD_LABEL[p]}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </Animated.View>

                  <Animated.View
                    entering={FadeIn.duration(360).delay(240)}
                    style={styles.chartSection}
                  >
                    {/* La punteada proyecta desde el ritmo OBSERVADO (nunca desde un
                    plan con fecha): cuando la realidad cambia, la línea cambia
                    sin que nadie "incumpla". */}
                    <Text style={styles.chartCaption}>
                      {count} mediciones · la línea es tu promedio de la semana
                      {trend ? ' · la punteada sigue tu ritmo real' : ''}
                    </Text>
                    <TrajectoryChart points={smoothed} trend={trend} />
                    {/* Epic 08: la tendencia completa vive en su pantalla. */}
                    <LinkCta
                      label="Ver tendencia →"
                      onPress={() => router.push('/weight-trend')}
                      accessibilityLabel="Ver la tendencia completa de tu peso"
                    />
                  </Animated.View>

                  {/* Cycle context — weight genuinely shifts with the
                  cycle's water balance; the chart says so, so a
                  luteal bump isn't read as a setback. */}
                  {cycle && (cycle.phase === 'lutea' || cycle.phase === 'menstrual') ? (
                    <Animated.View entering={FadeIn.duration(360).delay(290)}>
                      <Text style={styles.cycleNote}>
                        {cycle.phase === 'lutea'
                          ? 'La semana antes de tu período tu cuerpo retiene agua: la báscula sube por agua, no por grasa.'
                          : 'Estás menstruando: el peso se mueve por agua, no por grasa.'}
                      </Text>
                    </Animated.View>
                  ) : null}

                  {trend ? (
                    <Animated.View entering={FadeIn.duration(360).delay(320)}>
                      <CoachLine text={formatTrendCopy(trend)} />
                    </Animated.View>
                  ) : null}
                  {/* El "show more" pegado a su muestra (uxui): esta puerta
                      era la más misteriosa al fondo del scroll. */}
                  {PROGRESS_BODY_ENABLED ? (
                    <LinkCta
                      label="Más observaciones como esta →"
                      onPress={() => router.push('/stelar-observes')}
                      accessibilityLabel="Ver más observaciones de tus datos"
                      style={styles.bridgeLink}
                    />
                  ) : null}
                </>
              ) : (
                <Animated.View entering={FadeIn.duration(360).delay(80)} style={styles.heroEmpty}>
                  {count === 1 && first ? (
                    <View style={styles.firstWeightRow}>
                      <Text style={styles.firstWeightNum}>{first.weight.toFixed(1)}</Text>
                      <Text style={styles.firstWeightUnit}>kg</Text>
                    </View>
                  ) : (
                    <Text style={styles.heroEmptyTitle}>
                      Tu primera marca pone una estrella en el cielo.
                    </Text>
                  )}

                  <Text style={styles.heroEmptyHint}>
                    {count === 0
                      ? 'Marca tu peso para empezar a trazar tu trayectoria.'
                      : 'Una segunda marca traza tu trayectoria.'}
                  </Text>

                  <View style={styles.heroCtaWrap}>
                    <PrimaryCta
                      label={count === 0 ? 'Marcar mi peso →' : 'Pesarme de nuevo →'}
                      onPress={goLogMeasurement}
                    />
                  </View>
                </Animated.View>
              )}

              {/* ── Orden producto: detalle numérico → evidencia visual →
                  herramientas → ENTRADA al final. El comparador va DEBAJO del
                  historial: el tap en una estrella aterriza donde sigues
                  leyendo. PhotoCompare murió (duplicaba al comparador, que ya
                  trae CAMBIO VISUAL). ── */}
              {PROGRESS_BODY_ENABLED ? (
                <>
                  {/* Cada pieza trae su propio divisor: si se auto-oculta (sin
                      datos), no deja una hairline huérfana. Orden peak-end:
                      lo fechado/viejo (composición, comparador) primero y
                      colapsado; el segmento CIERRA en la tira de fotos con
                      "Capítulo de hoy" + el CTA de registro — el último sabor
                      es futuro, nunca ago-2025. */}
                  <CompositionCards />
                  {/* F4 · evolución por zona (segmental de los check-ins). */}
                  <ZonesEvolution />
                  {/* Historial → comparador (tap en estrella aterriza abajo,
                      con scroll real hasta él). */}
                  {/* FUSIÓN (dueña): historial + evolución visual eran dos
                      rieles gemelos — ahora UNA línea del tiempo con toda la
                      evidencia (fotos + números). */}
                  <EvidenceTimeline onPick={pickCompare} />
                  <View
                    onLayout={(e) => {
                      compareY.current = e.nativeEvent.layout.y
                    }}
                  >
                    <CheckinCompare presetA={comparePresetA} />
                  </View>
                </>
              ) : null}

              {/* (Ciclo se movió a Historia · mockup dueña.) */}

              {/* ── Cluster de ENTRADA (un solo hogar para el input, al final,
                  como el modelo de logging de Hoy). ── */}
              {/* Naming que distingue destino (target-user: "medición" y
                  "medición completa" parecían el mismo botón dos veces): el CTA
                  magenta es el peso rápido; "Medición completa" es la
                  composición, mismo label aquí y en la tabla. */}
              {hasTrajectory ? (
                <Animated.View entering={FadeIn.duration(360).delay(400)} style={styles.ctaWrap}>
                  <PrimaryCta label="Nueva medición" onPress={goLogMeasurement} />
                </Animated.View>
              ) : null}
              <LinkCta
                label="Agregar fotos de otra fecha →"
                onPress={() => router.push('/log-photos')}
                accessibilityLabel="Agregar fotos de otra fecha"
                style={styles.bridgeLink}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function formatDelta(kg: number | undefined): string {
  if (kg == null) return '·'
  if (kg === 0) return '0.0'
  const sign = kg < 0 ? '−' : '+'
  return `${sign}${Math.abs(kg).toFixed(1)}`
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  hero: {
    paddingTop: 6,
    paddingBottom: 6,
  },
  // Empty-state hero — gives the early days (0 / 1 measurement) a
  // shape that doesn't look like a broken chart screen.
  heroEmpty: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  heroEmptyTitle: {
    marginTop: 4,
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displayMd,
    lineHeight: 32,
    color: colors.leche,
    letterSpacing: -0.6,
  },
  heroEmptyHint: {
    marginTop: 14,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 21,
    color: colors.bone,
  },
  // First-weight as hero — same heft as the delta number but no
  // sign, since there's no comparison yet.
  firstWeightRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  // Section-sized, not page-hero-sized — weight is no longer the
  // number the tab opens on.
  firstWeightNum: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.statHero,
    paddingTop: 4,
    paddingBottom: 2,
    color: colors.leche,
    letterSpacing: -1,
    textShadowColor: 'rgba(252, 246, 235, 0.22)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  firstWeightUnit: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.headingLg,
    color: colors.magenta,
  },
  heroCtaWrap: {
    marginTop: 22,
  },
  // Thin hairline between the page's three sections (cambio /
  // cambio visual / entreno) so the eye reads them as separate
  // beats instead of an undifferentiated dump.
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 28,
  },
  // Separación por AIRE (Cuerpo): sin línea, ~35% más respiro entre secciones.
  sectionGap: { height: 44 },
  heroEyebrow: {
    marginBottom: 10,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  // Section-sized — weight is one axis among several now, not the
  // giant delta that used to open the tab.
  deltaNum: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.statHero,
    paddingTop: 4,
    paddingBottom: 4,
    color: colors.magenta,
    letterSpacing: -1,
  },
  deltaUnit: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.headingLg,
    color: colors.bone,
  },
  deltaRange: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  deltaStrong: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  // Tono paciente / largo plazo — el peso es un indicador más.
  patientSub: {
    marginTop: 6,
    marginBottom: 4,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.niebla,
  },
  // Cabecera del peso: PESO ACTUAL (calmo) a la izquierda, "cambio total" como
  // chip a la derecha — el número no domina, la tendencia vive en la gráfica.
  weightHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  weightLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 2,
  },
  weightNowRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  weightNow: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displayHero,
    letterSpacing: -1,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  weightUnit: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.title,
    color: colors.bone,
  },
  // "Cambio total" — chip callado en oro (sin rojo/verde: el peso no se juzga).
  deltaChip: {
    alignItems: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    backgroundColor: colors.oroTint,
  },
  deltaChipLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  deltaChipNum: {
    marginTop: 1,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  // Comparación temporal — antes → ahora · periodo.
  comparison: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  compFrom: {
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  compArrow: {
    color: colors.oro,
  },
  compTo: {
    fontFamily: typography.uiBold,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  compPeriod: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // Switcher Historia | Body — píldora de dos segmentos bajo el header.
  // Los márgenes verticales viven en la FILA (switcherRow), no aquí: dentro
  // del row, el chip ＋ se centraba contra pill+márgenes y quedaba caído.
  segmentPill: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderRadius: 22,
    padding: 4,
  },
  segmentSeg: {
    flex: 1,
    height: 38,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSegOn: { backgroundColor: colors.magentaTint2 },
  segmentLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    letterSpacing: 0.4,
  },
  segmentLabelOn: { color: colors.magentaHot },
  // Stadium pill — mirrors the quick-log meal-slot selector.
  periodPill: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderRadius: 22,
    padding: 4,
    marginTop: 22,
    marginBottom: 16,
  },
  periodSeg: {
    flex: 1,
    height: 34,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodSegOn: {
    backgroundColor: colors.magentaTint2,
  },
  photoTogglePressed: {
    opacity: 0.6,
  },
  periodLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    // Tight tracking now that the labels are words ("30 días"), not
    // 2–3-char codes — wide tracking would overflow the segment.
    letterSpacing: 0.2,
  },
  periodLabelOn: {
    color: colors.magentaHot,
  },
  // No box — the trajectory floats directly in the page's sky.
  chartSection: {
    marginTop: 4,
  },
  chartCaption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  // Cycle context under the chart — quiet, reassuring, serif italic. Con
  // aire de reflexión (nunca pegada al chart como caption).
  cycleNote: {
    marginTop: 24,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.niebla,
  },
  // Puente callado al calendario (Epic 06) — link, no card.
  // Layout de los links puente (el touch vive en LinkCta · quirk-safe).
  bridgeLink: { marginTop: 10, alignSelf: 'center' },
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 20,
  },
  switcherGrow: { flex: 1 },
  // Misma altura que el pill, FIJA (38 del seg + 4×2 padding + bordes = 48):
  // height '100%' dentro de un Pressable auto es dependencia circular en
  // Yoga y el chip se estiraba a toda la pantalla.
  addChip: {
    width: 48,
    height: 48,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addChipGlyph: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.heading,
    color: colors.magentaHot,
    marginTop: -1,
  },
  // Báscula quieta + esfuerzo presente — una REFLEXIÓN, no un caption
  // (brief: el texto interpretativo se separa y respira como cita).
  plateauNote: {
    marginTop: 30,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  // Shown in "Tu cuerpo" when the month's focus isn't weight — the
  // section is reference, not a target to chase.
  focusNote: {
    marginTop: -2,
    marginBottom: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
  },
  chartEmpty: {
    paddingVertical: 26,
    alignItems: 'center',
  },
  chartEmptyText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.bone,
    textAlign: 'center',
  },
  ctaWrap: {
    marginTop: 18,
  },
})
