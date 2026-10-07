import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { useMacroTargets } from '@/features/macros/hooks'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { detectMonthPatterns } from '@/features/orbit/month-built'
import { requestOrbitSegment } from '@/features/orbit/pending-segment'
import { useBodyCheckins, useMeasurements } from '@/features/progress/hooks'
import { describeWeightChange, mergeWeightSeries } from '@/features/progress/logic'
import { useWearableWeights } from '@/features/wearables/hooks'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

import { HealthCardHeader } from './HealthCardHeader'
import { ListGlyph } from './HealthGlyphs'

/*
 * Historia · Destacados (dueña 7 oct 2026; reemplaza la "Lectura"). Una o dos
 * líneas de HECHOS que no repiten los números de las tarjetas: la tendencia
 * del peso con la MISMA serie que Cuerpo y sus fechas, el patrón del mes si
 * existe y "Tu foco" solo con el patrón de días. Un único enlace a Descubre.
 * Sin cursivas ni frases de relleno.
 */

const WINDOW = 30
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtT = (t: number) => {
  const d = new Date(t)
  return `${d.getDate()} ${MESES[d.getMonth()]}`
}

export function HistoryHighlights() {
  const router = useRouter()
  const signals = useSignalsHistory(WINDOW)
  const targets = useMacroTargets().data
  const measurements = useMeasurements(WINDOW)
  const checkins = useBodyCheckins()
  const scale = useWearableWeights()

  const weight = useMemo(() => {
    const since = Date.now() - WINDOW * 24 * 60 * 60 * 1000
    const series = mergeWeightSeries(
      measurements.data ?? [],
      checkins.data ?? [],
      scale.data ?? [],
    ).filter((p) => p.t >= since)
    return describeWeightChange(series)
  }, [measurements.data, checkins.data, scale.data])

  const rows = useMemo(() => signals.data ?? [], [signals.data])
  const { lead, foco } = useMemo(() => {
    const patterns = detectMonthPatterns(rows, {
      proteinTarget: targets?.protein_g ?? null,
      calorieTarget: targets?.calories ?? null,
    })
    const leadP = patterns.find((p) => p.kind === 'pattern') ?? patterns[0] ?? null
    const daytype = patterns.find((p) => p.id === 'deficit-daytype')
    // El foco es el lado donde el déficit se suelta (recomendación de foco,
    // nunca de conducta).
    const side = daytype?.weekdayShape
      ? daytype.weekdayShape.strongSide === 'weekday'
        ? 'el fin de semana'
        : 'entre semana'
      : null
    return { lead: leadP, foco: side }
  }, [rows, targets?.protein_g, targets?.calories])

  const foodDays = rows.filter((s) => (s.calories ?? 0) > 0).length
  if (signals.isLoading) return null

  const weightLine =
    weight && weight.n >= 2
      ? `Tu peso: ${weight.abs > 0 ? '↑' : weight.abs < 0 ? '↓' : '='} ${Math.abs(weight.abs).toFixed(1)} kg del ${fmtT(weight.fromT)} al ${fmtT(weight.toT)} · ${weight.n} registros`
      : null

  const openDescubre = () => {
    track('synthesis_open_orbita', { pattern: lead?.id ?? null })
    requestOrbitSegment('mes')
    router.push('/orbit')
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.card}>
      <HealthCardHeader
        icon={<ListGlyph color={colors.oroSoft} />}
        title="Destacados"
        color={colors.oroSoft}
        right="Últimos 30 días"
      />
      <View style={styles.lines}>
        {weightLine ? <Line text={weightLine} /> : null}
        {lead ? <Line text={lead.title} /> : null}
        {foco && lead ? <Line text={`Tu foco esta semana: sostener ${foco}.`} strong /> : null}
        {!weightLine && !lead ? (
          <Text style={styles.empty}>
            {foodDays < 7
              ? `Aún no hay patrón: aparece con 7 días o más con comida (llevas ${foodDays}).`
              : 'Aún no hay un patrón claro en estos días.'}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={openDescubre}
        accessibilityRole="button"
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      >
        <Text style={styles.linkText}>Ver patrones en Descubre</Text>
        <Text style={styles.linkChevron}>›</Text>
      </Pressable>
    </Animated.View>
  )
}

function Line({ text, strong }: { text: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <View style={styles.dot} />
      <Text style={[styles.lineText, strong && styles.lineStrong]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, backgroundColor: colors.bgCard, padding: 16, gap: 12 },
  lines: { gap: 10 },
  line: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, backgroundColor: colors.oroSoft },
  lineText: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.leche,
  },
  lineStrong: { fontFamily: typography.uiBold },
  empty: { fontFamily: typography.uiMedium, fontSize: typography.sizes.body, color: colors.bone },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingTop: 12,
  },
  linkText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.magenta,
  },
  linkChevron: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.magenta,
  },
  pressed: { opacity: 0.7 },
})
