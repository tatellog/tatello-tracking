import { useRouter } from 'expo-router'
import { useEffect, useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Line, Path } from 'react-native-svg'

import { PrimaryCta } from '@/components/PrimaryCta'
import { useMacroTargets } from '@/features/macros/hooks'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { useBodyCheckins, useMeasurements } from '@/features/progress/hooks'
import { mergeWeightSeries, recoveryFact, smoothWeightPoints } from '@/features/progress/logic'
import { detectMilestones } from '@/features/progress/milestones'
import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry/four-point-star-path'
import { SkyBackground } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

/*
 * Historia de la transformación (Epic 08 · F2) — la pregunta: "¿de dónde
 * vengo?". No es una gráfica: es una línea del tiempo VERTICAL de capítulos,
 * emocional y fechada. Los capítulos salen del motor de hitos (Epic 03,
 * detectMilestones · lectura, el writer sigue gateado) + recoveryFact + la
 * serie de peso. Cero detección nueva.
 *
 * Al final, "Lo que Stelar observó": MOTOR, sin ✦ (el sello es del chat IA),
 * sin promesas de futuro. Cierra con el CTA que extiende la historia.
 */

// Ventana amplia = "todo el historial" (misma que useMilestoneSync).
const STORY_WINDOW_DAYS = 400

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDay = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
const fmtT = (t: number): string => {
  const d = new Date(t)
  return `${d.getDate()} ${MESES[d.getMonth()] ?? ''} ${d.getFullYear()}`
}

type Beat = {
  key: string
  title: string
  /** null = capítulo sin fecha propia (p. ej. "El regreso" sin punto claro). */
  date: string | null
  detail: string | null
  /** Timestamp para el ORDEN cronológico real. */
  t: number
  /** Tipología visual: cada capítulo pesa lo que pesa en la historia. */
  tone: 'start' | 'milestone' | 'peak' | 'return' | 'today'
}

// Desempates estables cuando dos capítulos comparten fecha: el regreso va
// justo después del pico; hoy cierra siempre.
const TONE_RANK: Record<Beat['tone'], number> = {
  start: 0,
  milestone: 1,
  peak: 1,
  return: 2,
  today: 3,
}

export default function BodyStoryScreen() {
  const router = useRouter()
  const measurements = useMeasurements(null)
  const checkins = useBodyCheckins()
  const signals = useSignalsHistory(STORY_WINDOW_DAYS)
  const targets = useMacroTargets().data

  const smoothed = useMemo(
    () => smoothWeightPoints(mergeWeightSeries(measurements.data ?? [], checkins.data ?? [])),
    [measurements.data, checkins.data],
  )
  const recovery = useMemo(() => recoveryFact(smoothed), [smoothed])

  const beats = useMemo<Beat[]>(() => {
    const first = smoothed[0]
    const last = smoothed[smoothed.length - 1]
    if (!first || !last) return []

    const out: Beat[] = [
      {
        key: 'start',
        title: 'Donde empezaste',
        date: fmtT(first.t),
        detail: `${first.weight.toFixed(1)} kg`,
        t: first.t,
        tone: 'start',
      },
    ]

    // Hitos de primera vez (déficit, entreno, mes en déficit) — lectura del
    // motor de Epic 03; los títulos ya vienen en voz Historia.
    const milestones = detectMilestones({
      signals: signals.data ?? [],
      calorieTarget: targets?.calories ?? null,
    })
    for (const m of milestones) {
      if (m.kind === 'first_weight') continue // ya está como "Donde empezaste"
      out.push({
        key: m.kind,
        title: m.title,
        date: fmtDay(m.date),
        detail: null,
        t: new Date(`${m.date}T12:00:00`).getTime(),
        tone: 'milestone',
      })
    }

    // El pico y el regreso (si hubo rebote): nombrado sin drama.
    if (recovery) {
      const peak = smoothed.reduce((a, b) => (b.weight > a.weight ? b : a), first)
      out.push({
        key: 'peak',
        title: 'El pico',
        date: fmtT(peak.t),
        detail: `${recovery.peakKg.toFixed(1)} kg`,
        t: peak.t,
        tone: 'peak',
      })
      // El regreso se fecha en el PRIMER punto después del pico que ya pesó
      // menos (antes heredaba la fecha del pico: dos capítulos, una fecha).
      const turn = smoothed.find((p) => p.t > peak.t && p.weight < peak.weight)
      out.push({
        key: 'return',
        title: 'El regreso',
        date: turn ? fmtT(turn.t) : null,
        detail: `Desde aquí, ya bajaste ${recovery.droppedKg.toFixed(1)} kg`,
        t: turn?.t ?? peak.t + 1,
        tone: 'return',
      })
    }

    out.push({
      key: 'today',
      title: 'Hoy',
      date: fmtT(last.t),
      detail: `${last.weight.toFixed(1)} kg`,
      t: last.t,
      tone: 'today',
    })

    // ORDEN cronológico real (antes se retornaba en orden de construcción y
    // las fechas saltaban 2024→2026→2025 en pantalla · bug dueña), con
    // desempates estables por tono.
    return out.sort((a, b) => a.t - b.t || TONE_RANK[a.tone] - TONE_RANK[b.tone])
  }, [smoothed, signals.data, targets?.calories, recovery])

  const isPending = measurements.isPending || checkins.isPending || signals.isLoading
  const isError = measurements.isError || checkins.isError

  // Respiración del halo de "Hoy" (solo opacity; el anillo queda estático,
  // es cartografía). Solo corre cuando la timeline existe (guardián: sin
  // esto el loop giraba en skeleton/error/empty sin nada que animar).
  const breath = useSharedValue(0)
  const hasBeats = beats.length > 0
  useEffect(() => {
    if (!hasBeats) return
    breath.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [breath, hasBeats])
  const todayHaloProps = useAnimatedProps(() => ({
    opacity: 0.3 + breath.value * 0.25,
  }))

  // Lo que Stelar observó (motor, sin sello): lo recorrido, jamás lo que falta.
  const observation = useMemo(() => {
    const last = smoothed[smoothed.length - 1]
    if (!last) return null
    if (recovery) {
      return `Subiste hasta ${recovery.peakKg.toFixed(1)} kg y desde ahí ya bajaste ${recovery.droppedKg.toFixed(1)} kg. Los ${smoothed.length} registros de este camino los escribiste tú.`
    }
    const first = smoothed[0]
    if (!first) return null
    const delta = Number((last.weight - first.weight).toFixed(1))
    if (delta < 0) {
      return `De ${first.weight.toFixed(1)} a ${last.weight.toFixed(1)} kg, con ${smoothed.length} registros escritos por ti.`
    }
    return `${smoothed.length} registros de peso cuentan este camino. Cada uno lo escribiste tú.`
  }, [smoothed, recovery])

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Tu historia</Text>
            {/* "Camino", no "transformación": esa palabra queda reservada a la
                share card ya aprobada (advertencia manifesto-review). */}
            <Text style={styles.sub}>Los capítulos de tu camino</Text>
          </View>
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

        {isPending ? (
          <View style={styles.skeleton}>
            {Array.from({ length: 5 }, (_, i) => (
              <View key={i} style={styles.skeletonRow} />
            ))}
          </View>
        ) : isError ? (
          /* Error con datos existentes NO es empty: decir "tu historia
             empieza…" a quien lleva meses duele (uxui). */
          <View style={styles.errorWrap}>
            <Text style={styles.empty}>No pudimos traer tu historia. Está a salvo.</Text>
            <View style={styles.retryWrap}>
              <Pressable
                onPress={() => {
                  void measurements.refetch()
                  void checkins.refetch()
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Intentar cargar tu historia de nuevo"
                style={({ pressed }) => pressed && { opacity: 0.6 }}
              >
                <Text style={styles.retryText}>Intentar de nuevo</Text>
              </Pressable>
            </View>
          </View>
        ) : beats.length === 0 ? (
          <Text style={styles.empty}>Tu historia empieza con tu primera marca de peso.</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.timeline}>
              {beats.map((b, i) => (
                <Animated.View
                  key={b.key}
                  entering={FadeInDown.duration(420).delay(i * 90)}
                  style={styles.beat}
                >
                  {/* La columna del tiempo: estrella según el PESO del
                      capítulo + hilo CONTINUO (View flexible, ya no un Svg de
                      44px fijos que se cortaba con títulos de dos líneas) con
                      rampa de intensidad: penumbra en el pasado, encendido
                      hacia Hoy. */}
                  <View style={styles.beatRail}>
                    <BeatStar tone={b.tone} todayHaloProps={todayHaloProps} />
                    {i < beats.length - 1 ? (
                      <View
                        style={[
                          styles.thread,
                          {
                            opacity: 0.1 + 0.22 * (i / Math.max(1, beats.length - 1)),
                            width: i === beats.length - 2 ? 1.5 : 1,
                          },
                        ]}
                      />
                    ) : (
                      /* Tras Hoy, el hilo se disuelve y entrega al cierre. */
                      <>
                        <View style={[styles.thread, styles.threadFadeA]} />
                        <View style={[styles.thread, styles.threadFadeB]} />
                      </>
                    )}
                  </View>
                  <View style={styles.beatBody}>
                    <Text style={[styles.beatTitle, b.tone === 'today' && styles.beatTitleBright]}>
                      {b.title}
                    </Text>
                    {b.date ? <Text style={styles.beatDate}>{b.date}</Text> : null}
                    {b.detail ? <Text style={styles.beatDetail}>{b.detail}</Text> : null}
                  </View>
                </Animated.View>
              ))}
            </View>

            {/* Lo que Stelar observó — motor, fechado en tus datos, sin sello.
                El divider ornamental lo vuelve ceremonia de cierre. */}
            {observation ? (
              <Animated.View entering={FadeIn.duration(420).delay(beats.length * 90 + 120)}>
                <View style={styles.ornamentRow}>
                  <Svg width={120} height={12} viewBox="0 0 120 12">
                    <Line
                      x1={0}
                      y1={6}
                      x2={48}
                      y2={6}
                      stroke={colors.oroHairlineSoft}
                      strokeWidth={0.75}
                    />
                    <Path d={fourPointStarPath(60, 6, 3)} fill={colors.oroSoft} opacity={0.8} />
                    <Line
                      x1={72}
                      y1={6}
                      x2={120}
                      y2={6}
                      stroke={colors.oroHairlineSoft}
                      strokeWidth={0.75}
                    />
                  </Svg>
                </View>
                <Text style={styles.observedLabel}>Lo que Stelar observó</Text>
                <Text style={styles.observedText}>{observation}</Text>
              </Animated.View>
            ) : null}

            <View style={styles.ctaWrap}>
              {/* Puente serif: la emoción en su tipografía, el botón claro en
                  la suya. "Sigue abierta", no "tu próxima marca": sin
                  presuponer la acción futura (voice-and-copy). */}
              <Text style={styles.bridge}>Tu historia sigue abierta.</Text>
              <PrimaryCta label="Registrar mi peso" onPress={() => router.push('/log-checkin')} />
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  )
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** La estrella de cada capítulo, con su peso en la historia: inicio tenue,
 *  primeras veces menores, el pico HUECO (la misma estrella del hero: lo que
 *  ardió y pasó siempre se dibuja igual), el regreso con la única nota
 *  magenta (el hito que ELLA construyó), y Hoy como clímax (halo respirando
 *  + anillo estático de cartografía). */
function BeatStar({
  tone,
  todayHaloProps,
}: {
  tone: Beat['tone']
  todayHaloProps: React.ComponentProps<typeof AnimatedCircle>['animatedProps']
}) {
  if (tone === 'today') {
    return (
      <Svg width={34} height={34} viewBox="0 0 34 34">
        <AnimatedCircle
          cx={17}
          cy={17}
          r={14}
          fill={colors.oroGlow}
          animatedProps={todayHaloProps}
        />
        <Circle
          cx={17}
          cy={17}
          r={12.5}
          fill="none"
          stroke={colors.oroHairline}
          strokeWidth={0.75}
        />
        <Path d={fourPointStarPath(17, 17, 9)} fill={colors.oroLeche} />
      </Svg>
    )
  }
  if (tone === 'return') {
    return (
      <Svg width={26} height={26} viewBox="0 0 26 26">
        <Circle cx={13} cy={13} r={9} fill={colors.magentaGlow} opacity={0.35} />
        <Path d={fourPointStarPath(13, 13, 5)} fill={colors.rosaLuz} />
      </Svg>
    )
  }
  if (tone === 'peak') {
    return (
      <Svg width={26} height={26} viewBox="0 0 26 26">
        <Path
          d={fourPointStarPath(13, 13, 5.5)}
          fill="none"
          stroke={colors.bone}
          strokeWidth={0.8}
          opacity={0.7}
        />
      </Svg>
    )
  }
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Path
        d={fourPointStarPath(13, 13, tone === 'start' ? 4.5 : 4)}
        fill={colors.oroSoft}
        opacity={tone === 'start' ? 0.6 : 0.75}
      />
    </Svg>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.5,
  },
  sub: {
    marginTop: 2,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  skeleton: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  skeletonRow: { height: 52, borderRadius: 12, backgroundColor: colors.bgCard, opacity: 0.6 },
  empty: {
    marginTop: 30,
    paddingHorizontal: 24,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    textAlign: 'center',
  },
  content: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 48 },
  timeline: {},
  beat: { flexDirection: 'row', gap: 16 },
  // Ancho FIJO: los hilos de todos los capítulos quedan en el mismo eje
  // aunque la estrella de Hoy sea más grande.
  beatRail: { alignItems: 'center', width: 34 },
  // El hilo del tiempo: un View flexible que llena hasta el siguiente
  // capítulo (nunca se corta); la opacidad la pone el render (rampa).
  thread: { flex: 1, width: 1, backgroundColor: colors.oro },
  threadFadeA: { flex: 0, height: 12, opacity: 0.18 },
  threadFadeB: { flex: 0, height: 12, opacity: 0.06 },
  beatBody: { flex: 1, paddingBottom: 26 },
  beatTitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.heading,
    lineHeight: 24,
    color: colors.leche,
  },
  beatTitleBright: { color: colors.oroLeche },
  beatDate: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  beatDetail: {
    marginTop: 4,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  ornamentRow: { alignItems: 'center', marginTop: 18 },
  // Centrado: ceremonia de cierre, no otra fila (illustrator).
  observedLabel: {
    marginTop: 14,
    textAlign: 'center',
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    marginBottom: 8,
  },
  observedText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 25,
    color: colors.leche,
  },
  ctaWrap: { marginTop: 34 },
  bridge: {
    marginBottom: 14,
    textAlign: 'center',
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    color: colors.bone,
  },
  errorWrap: { marginTop: 30 },
  retryWrap: { alignSelf: 'center', marginTop: 8, minHeight: 44, justifyContent: 'center' },
  retryText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    letterSpacing: 0.2,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
})
