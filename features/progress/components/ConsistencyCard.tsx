import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

const SEGMENTS = 10
const WINDOW = 30
// Mínimo de días activos para que la constancia signifique algo.
const MIN_ACTIVE = 7

function isoDaysAgo(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d - n, 12)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number) as [number, number, number]
  const [ty, tm, td] = toIso.split('-').map(Number) as [number, number, number]
  const a = new Date(fy, fm - 1, fd, 12).getTime()
  const b = new Date(ty, tm - 1, td, 12).getTime()
  return Math.round((b - a) / 86_400_000)
}

type Signal = {
  day?: string | null
  trained?: boolean | null
  meal_count?: number | null
  sleep_minutes?: number | null
  wellbeing_checkins?: number | null
  energy?: number | null
}

// Barra segmentada (sin colores de error: lleno = magenta, vacío = hairline).
function Bar({ pct }: { pct: number }) {
  const filled = Math.round((pct / 100) * SEGMENTS)
  return (
    <View style={styles.bar}>
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <View key={i} style={[styles.seg, i < filled ? styles.segOn : styles.segOff]} />
      ))}
    </View>
  )
}

/*
 * "Consistencia" — adherencia a HÁBITOS (no resultados) en los últimos 30 días.
 * Responde "¿qué tan constante he sido?". Un score general + 4 barras
 * (Movimiento · Comidas · Sueño · Check-in). Sin colores de error: la barra más
 * corta es la que pide atención, y la voz lo nombra en POSITIVO ("dónde más
 * puedes crecer"), nunca como falla.
 */
export function ConsistencyCard() {
  const signals = useSignalsHistory(WINDOW)
  const today = useMemo(() => todayInTimezone(), [])
  const start = useMemo(() => isoDaysAgo(today, WINDOW - 1), [today])

  const model = useMemo(() => {
    const rows = ((signals.data ?? []) as Signal[]).filter((s) => s.day != null && s.day >= start)
    if (rows.length === 0) return null

    // Ventana activa: desde el primer registro (en los 30d) hasta hoy. Así un
    // usuario reciente no se castiga contra 30 días que aún no vivió.
    let firstDay = today
    for (const r of rows) if (r.day && r.day < firstDay) firstDay = r.day
    const denom = Math.min(WINDOW, daysBetween(firstDay, today) + 1)
    if (denom < MIN_ACTIVE) return null

    const count = (pred: (s: Signal) => boolean) => rows.filter(pred).length
    const pct = (n: number) => Math.round((n / denom) * 100)

    const habits = [
      { key: 'mov', label: 'Movimiento', pct: pct(count((s) => s.trained === true)) },
      { key: 'com', label: 'Comidas', pct: pct(count((s) => (s.meal_count ?? 0) > 0)) },
      { key: 'sue', label: 'Sueño', pct: pct(count((s) => s.sleep_minutes != null)) },
      {
        key: 'chk',
        label: 'Check-in',
        pct: pct(count((s) => (s.wellbeing_checkins ?? 0) > 0 || s.energy != null)),
      },
    ]
    const overall = Math.round(habits.reduce((a, h) => a + h.pct, 0) / habits.length)
    const lowest = habits.reduce((lo, h) => (h.pct < lo.pct ? h : lo), habits[0]!)
    return { habits, overall, lowest }
  }, [signals.data, start, today])

  if (signals.isLoading || !model) return null

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.card}>
      <View style={styles.head}>
        <View>
          <EyebrowLabel tone="magenta" size={10}>
            Consistencia
          </EyebrowLabel>
          <Text style={styles.subtitle}>Constancia · últimos 30 días</Text>
        </View>
        <Text style={styles.score}>
          {model.overall}
          <Text style={styles.scorePct}>%</Text>
        </Text>
      </View>

      <View style={styles.rows}>
        {model.habits.map((h) => (
          <View key={h.key} style={styles.row}>
            <Text style={styles.label}>{h.label}</Text>
            <Bar pct={h.pct} />
            <Text style={styles.pct}>{h.pct}%</Text>
          </View>
        ))}
      </View>

      {/* La que pide atención, en positivo (sin culpa, sin rojo). */}
      {model.lowest.pct < 100 ? (
        <Text style={styles.coach}>
          Tu <Text style={styles.coachKey}>{model.lowest.label.toLowerCase()}</Text> es donde más
          puedes crecer.
        </Text>
      ) : (
        <Text style={styles.coach}>Tu constancia está encendida en todo.</Text>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  subtitle: {
    marginTop: 5,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // El score general — grande, cálido, la respuesta de un vistazo.
  score: {
    fontFamily: typography.displayHeavy,
    fontSize: 38,
    letterSpacing: -1.4,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  scorePct: {
    fontFamily: typography.uiSemi,
    fontSize: 18,
    color: colors.bone,
  },
  rows: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    width: 92,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  seg: {
    flex: 1,
    height: 9,
    borderRadius: 3,
  },
  segOn: {
    backgroundColor: colors.magenta,
  },
  segOff: {
    backgroundColor: colors.hairline,
  },
  pct: {
    width: 38,
    textAlign: 'right',
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.caption,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  coach: {
    marginTop: 14,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.bone,
  },
  coachKey: {
    fontStyle: 'normal',
    fontFamily: typography.uiSemi,
    color: colors.oroLight,
  },
})
