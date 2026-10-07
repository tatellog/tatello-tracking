import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
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
import { BeforeAfterModule } from '@/features/progress/components/BeforeAfterModule'
import { CompositionCards } from '@/features/progress/components/CompositionCards'
import { HistoryChips } from '@/features/progress/components/HistoryChips'
import { AiImportPill } from '@/features/progress/components/AiImportPill'
import { LinkCta } from '@/features/progress/components/LinkCta'
import { SynthesisCard } from '@/features/progress/components/SynthesisCard'
import {
  WEIGHT_PERIODS,
  WeightCard,
  type WeightPeriod,
} from '@/features/progress/components/WeightCard'
import { TransformationHero } from '@/features/progress/components/TransformationHero'
import { ZonesEvolution } from '@/features/progress/components/ZonesEvolution'
import { PROGRESS_EVENTS } from '@/features/progress/constants'
import { ProgressInsightCard } from '@/features/progress/components/ProgressInsightCard'
import { PROGRESS_BODY_ENABLED } from '@/lib/featureFlags'
import { useBodyCheckins, useMeasurements } from '@/features/progress/hooks'
import { mergeWeightSeries } from '@/features/progress/logic'
import { PrimaryCta, SkyBackground, TabHeader } from '@/features/tabs/components'
import { colors, typography } from '@/theme'
import { useWearableWeights } from '@/features/wearables/hooks'

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
  const [period, setPeriod] = useState<WeightPeriod>('M')

  const goBody = () => {
    track(PROGRESS_EVENTS.body)
    setSegment('body')
  }
  const scrollRef = useRef<ScrollView>(null)
  const measurementsQuery = useMeasurements(null)
  const checkinsQuery = useBodyCheckins()
  // Báscula (spec wearables §9): rellena los días sin registro propio.
  const scaleWeights = useWearableWeights()
  const { data: profile } = useProfile()

  // UNA sola serie de peso (app + coach + báscula), cruda: el número grande es
  // tu última medición real con su fecha; el periodo recorta la gráfica.
  const allPoints = useMemo(
    () =>
      mergeWeightSeries(
        measurementsQuery.data ?? [],
        checkinsQuery.data ?? [],
        scaleWeights.data ?? [],
      ),
    [measurementsQuery.data, checkinsQuery.data, scaleWeights.data],
  )
  const points = useMemo(() => {
    const days = WEIGHT_PERIODS.find((p) => p.key === period)?.days ?? 30
    const since = Date.now() - days * 24 * 60 * 60 * 1000
    return allPoints.filter((p) => p.t >= since)
  }, [allPoints, period])
  const latestPoint = allPoints[allPoints.length - 1] ?? null
  const first = allPoints[0]
  const count = allPoints.length

  // Peso y comida juntos: tus días en déficit de los últimos 30 días.
  const targets = useMacroTargets().data
  const signals30 = useSignalsHistory(30)
  const deficitCard = useMemo(() => {
    const summary = daysInDeficit(signals30.data ?? [], {
      calorieTarget: targets?.calories ?? null,
    })
    if (summary == null || summary.foodLoggedDays < 3) return null
    return { days: summary.deficitDays, of: summary.foodLoggedDays }
  }, [signals30.data, targets?.calories])

  // Cycle phase — used to caption the weight chart so a luteal
  // water-weight bump reads as biology, not regression. (Único hogar del
  // ciclo en este tab; la card standalone se fue de Historia.)
  const cycle = useCyclePhase()
  const cycleCard =
    cycle?.phase === 'lutea'
      ? { day: cycle.day, note: 'La semana antes de tu período el peso puede subir por agua.' }
      : cycle?.phase === 'menstrual'
        ? { day: cycle.day, note: 'Estás en tu período: el peso puede subir por agua.' }
        : null

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
                label="Ver tu evolución completa ›"
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

              {/* ── Body: Tu cuerpo · la tarjeta de Peso estilo Salud (dueña
                  7 oct 2026): último peso con fecha, cambio con su tramo,
                  gráfica de mediciones, ciclo y días en déficit. ── */}
              <EyebrowLabel tone="magenta" size={10} style={styles.heroEyebrow}>
                Tu cuerpo
              </EyebrowLabel>
              {hasFocus && !focusIsWeight ? (
                <Text style={styles.focusNote}>
                  Tu enfoque este mes no es el peso. Esto es solo una referencia, sin metas.
                </Text>
              ) : null}
              {weightLoading ? null : hasTrajectory && latestPoint ? (
                <WeightCard
                  points={points}
                  latest={latestPoint}
                  period={period}
                  onPeriod={setPeriod}
                  onOpenAll={() => router.push('/weight-trend')}
                  cycle={cycleCard}
                  deficit={deficitCard}
                />
              ) : (
                <Animated.View entering={FadeIn.duration(360).delay(80)} style={styles.heroEmpty}>
                  {count === 1 && first ? (
                    <View style={styles.firstWeightRow}>
                      <Text style={styles.firstWeightNum}>{first.weight.toFixed(1)}</Text>
                      <Text style={styles.firstWeightUnit}>kg</Text>
                    </View>
                  ) : (
                    <Text style={styles.heroEmptyTitle}>Registra tu peso para empezar.</Text>
                  )}

                  {/* La anticipación vive en el "cuándo" (mañana), no en un
                      CTA de báscula: "Pesarme de nuevo" a minutos de pesarse
                      era presión suave y su completación honesta era "vuelve
                      mañana" (uxui). */}
                  <Text style={styles.heroEmptyHint}>
                    {count === 0
                      ? 'Con 2 mediciones aparece tu gráfica.'
                      : 'Con la siguiente medición aparece tu gráfica.'}
                  </Text>

                  <View style={styles.heroCtaWrap}>
                    {/* Un nombre, un destino, siempre (igual que el chip ＋). */}
                    <PrimaryCta label="Nueva medición" onPress={goLogMeasurement} />
                  </View>

                  {/* El dead-end del día 1 (uxui): quien llega con meses de
                      historial en el PDF del coach necesita su puerta AQUÍ,
                      no escondida tras pantallas que piden datos. */}
                  <Text style={styles.coachAsk}>¿Llevabas mediciones con tu coach?</Text>
                  <AiImportPill
                    onPress={() => {
                      track(PROGRESS_EVENTS.body, { kind: 'import-from-empty' })
                      router.push('/import-measurements')
                    }}
                  />
                  <LinkCta
                    label="Agregar fotos de otra fecha →"
                    onPress={() => router.push('/log-photos')}
                    accessibilityLabel="Agregar fotos de otra fecha"
                    style={styles.bridgeLink}
                  />
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
                  {/* Antes y ahora (dueña 7 oct 2026): historial + fotos +
                      comparador en un solo módulo, estilo Salud. */}
                  <View style={styles.sectionGap} />
                  <BeforeAfterModule
                    weights={allPoints}
                    onOpenTable={() => router.push('/progress-table')}
                  />
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
              {hasTrajectory ? (
                <LinkCta
                  label="Agregar fotos de otra fecha →"
                  onPress={() => router.push('/log-photos')}
                  accessibilityLabel="Agregar fotos de otra fecha"
                  style={styles.bridgeLink}
                />
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
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
    paddingBottom: 140,
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
  // El espacio ES el separador (unificado con Cuerpo · decisión dueña).
  divider: { height: 0, marginVertical: 28 },
  // Separación por AIRE (Cuerpo): sin línea, ~35% más respiro entre secciones.
  sectionGap: { height: 56 },
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
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 20,
    color: colors.bone,
  },
  // Cabecera del peso: PESO ACTUAL (calmo) a la izquierda, "cambio total" como
  // chip a la derecha — el número no domina, la tendencia vive en la gráfica.
  weightHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  weightLabel: { marginBottom: 6 },
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
    letterSpacing: typography.letterSpacing.microCaption,
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
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.bone,
  },
  // Puente callado al calendario (Epic 06) — link, no card.
  // Layout de los links puente (el touch vive en LinkCta · quirk-safe).
  bridgeLink: { marginTop: 10, alignSelf: 'center' },
  coachAsk: {
    marginTop: 22,
    marginBottom: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    textAlign: 'center',
  },
  emptyCloser: {
    marginTop: 26,
    paddingHorizontal: 24,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.bone,
    textAlign: 'center',
  },
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
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 21,
    color: colors.bone,
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
