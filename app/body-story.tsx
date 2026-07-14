import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Line, Path } from 'react-native-svg'

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
  date: string
  detail: string | null
  bright?: boolean
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
      out.push({ key: m.kind, title: m.title, date: fmtDay(m.date), detail: null })
    }

    // El pico y el regreso (si hubo rebote): nombrado sin drama.
    if (recovery) {
      const peak = smoothed.reduce((a, b) => (b.weight > a.weight ? b : a), first)
      out.push({
        key: 'peak',
        title: 'El pico',
        date: fmtT(peak.t),
        detail: `${recovery.peakKg.toFixed(1)} kg`,
      })
      out.push({
        key: 'return',
        title: 'El regreso',
        date: fmtT(peak.t),
        detail: `Desde aquí, ya bajaste ${recovery.droppedKg.toFixed(1)} kg`,
      })
    }

    out.push({
      key: 'today',
      title: 'Hoy',
      date: fmtT(last.t),
      detail: `${last.weight.toFixed(1)} kg`,
      bright: true,
    })

    // Orden cronológico estable ("El regreso" hereda la fecha del pico y debe
    // quedar justo después de él).
    return out
  }, [smoothed, signals.data, targets?.calories, recovery])

  const isPending = measurements.isPending || checkins.isPending || signals.isLoading

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
                  {/* La columna del tiempo: estrella + hilo hacia el siguiente. */}
                  <View style={styles.beatRail}>
                    <Svg width={26} height={26} viewBox="0 0 26 26">
                      {b.bright ? (
                        <Path
                          d={fourPointStarPath(13, 13, 11)}
                          fill={colors.oroGlow}
                          opacity={0.5}
                        />
                      ) : null}
                      <Path
                        d={fourPointStarPath(13, 13, b.bright ? 8 : 5.5)}
                        fill={b.bright ? colors.oroLeche : colors.oroSoft}
                        opacity={b.bright ? 1 : 0.85}
                      />
                    </Svg>
                    {i < beats.length - 1 ? (
                      <Svg width={26} height={44} viewBox="0 0 26 44">
                        <Line
                          x1={13}
                          y1={2}
                          x2={13}
                          y2={42}
                          stroke={colors.oroHairline}
                          strokeWidth={1.2}
                        />
                      </Svg>
                    ) : null}
                  </View>
                  <View style={styles.beatBody}>
                    <Text style={[styles.beatTitle, b.bright && styles.beatTitleBright]}>
                      {b.title}
                    </Text>
                    <Text style={styles.beatDate}>{b.date}</Text>
                    {b.detail ? <Text style={styles.beatDetail}>{b.detail}</Text> : null}
                  </View>
                </Animated.View>
              ))}
            </View>

            {/* Lo que Stelar observó — motor, fechado en tus datos, sin sello. */}
            {observation ? (
              <Animated.View entering={FadeIn.duration(420).delay(beats.length * 90 + 120)}>
                <Text style={styles.observedLabel}>Lo que Stelar observó</Text>
                <Text style={styles.observedText}>{observation}</Text>
              </Animated.View>
            ) : null}

            <View style={styles.ctaWrap}>
              <PrimaryCta
                label="Registrar mi peso"
                onPress={() => router.push('/log-measurement')}
              />
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
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
  beatRail: { alignItems: 'center' },
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
  observedLabel: {
    marginTop: 26,
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
  ctaWrap: { marginTop: 36 },
})
