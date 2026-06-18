import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import type { BodyMeasurement } from '@/features/brief/api'
import { useTransformProgressAsOf } from '@/features/emblem'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { useProfile } from '@/features/profile/hooks'
import { ZODIAC, zodiacFromDate } from '@/features/tabs/zodiac'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { useAllWorkoutDates, useMeasurements } from '../hooks'

/* Hace `n` días en zona local desde una fecha ISO — numérico (Hermes no parsea
 * 'YYYY-MM-DD' como Date confiable). */
function isoDaysAgo(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d - n, 12)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** Peso (kg) registrado más cercano a `targetIso`. null si no hay pesajes. */
function weightAt(rows: readonly BodyMeasurement[], targetIso: string): number | null {
  const [y, m, d] = targetIso.split('-').map(Number) as [number, number, number]
  const targetTs = new Date(y, m - 1, d, 12).getTime()
  let best: number | null = null
  let bestDelta = Infinity
  for (const r of rows) {
    if (r.weight_kg == null) continue
    const dd = Math.abs(new Date(r.measured_at).getTime() - targetTs)
    if (dd < bestDelta) {
      bestDelta = dd
      best = r.weight_kg
    }
  }
  return best
}

type Signal = { day?: string | null; protein_g?: number | null }

function avgProtein(rows: readonly Signal[], fromIso: string, toIso: string): number | null {
  let sum = 0
  let n = 0
  for (const r of rows) {
    if (!r.day || r.day <= fromIso || r.day > toIso) continue
    if (r.protein_g != null && r.protein_g > 0) {
      sum += r.protein_g
      n += 1
    }
  }
  return n > 0 ? sum / n : null
}

type Tone = 'growth' | 'neutral'
type Row = {
  key: string
  label: string
  before: string | null
  now: string | null
  unit?: string
  suffix?: string
  delta: { text: string; up: boolean } | null
  tone: Tone
}

/*
 * "Tu Historia" — el hero de Progreso. Responde "¿qué ha cambiado desde que
 * empecé?" con EVIDENCIA, no un dashboard: cada métrica como un salto
 * Antes → Ahora (el pasado tenue, el presente luminoso) + el delta a la
 * derecha. El % de constelación usa el RPC con fecha de corte para el "antes"
 * exacto de hace 30 días.
 */
export function TuHistoria() {
  const today = useMemo(() => todayInTimezone(), [])
  const cut30 = useMemo(() => isoDaysAgo(today, 30), [today])
  const cut60 = useMemo(() => isoDaysAgo(today, 60), [today])

  const measurements = useMeasurements(70)
  const workouts = useAllWorkoutDates()
  const signals = useSignalsHistory(95)
  const cBefore = useTransformProgressAsOf(cut30)
  const cNow = useTransformProgressAsOf(today)
  const { data: profile } = useProfile()

  const signLabel = useMemo(() => {
    const sign = zodiacFromDate(profile?.date_of_birth)
    const raw = ZODIAC[sign].label
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
  }, [profile?.date_of_birth])

  const loading =
    measurements.isLoading ||
    workouts.isLoading ||
    signals.isLoading ||
    cBefore.isLoading ||
    cNow.isLoading

  const rows = useMemo<Row[]>(() => {
    const mRows = measurements.data ?? []
    const wDates = workouts.data ?? []
    const sRows = (signals.data ?? []) as Signal[]

    // Peso — valor puntual entonces vs ahora (sin juicio: delta neutro).
    const wBefore = weightAt(mRows, cut30)
    const wNow = weightAt(mRows, today)
    const weightDelta =
      wBefore != null && wNow != null
        ? {
            text: `${wNow - wBefore >= 0 ? '+' : '−'}${Math.abs(wNow - wBefore).toFixed(1)} kg`,
            up: wNow - wBefore >= 0,
          }
        : null

    // Entrenos — acumulado de por vida entonces vs ahora.
    const eBefore = wDates.filter((d) => d <= cut30).length
    const eNow = wDates.length

    // Proteína — promedio del mes previo vs el reciente.
    const pBefore = avgProtein(sRows, cut60, cut30)
    const pNow = avgProtein(sRows, cut30, today)
    const proteinDelta =
      pBefore != null && pNow != null
        ? {
            text: `${pNow - pBefore >= 0 ? '+' : '−'}${Math.round(Math.abs(pNow - pBefore))} g`,
            up: pNow - pBefore >= 0,
          }
        : null

    // Días registrados — días con señal, acumulado entonces vs ahora.
    const dBefore = sRows.filter((r) => r.day != null && r.day <= cut30).length
    const dNow = sRows.filter((r) => r.day != null).length

    // Constelación — % exacto (RPC con corte) entonces vs ahora.
    const conBefore = cBefore.progress
    const conNow = cNow.progress
    const conDelta =
      conBefore != null && conNow != null
        ? { text: `+${Math.round(conNow - conBefore)}%`, up: conNow >= conBefore }
        : null

    return [
      {
        key: 'peso',
        label: 'Peso',
        before: wBefore != null ? wBefore.toFixed(1) : null,
        now: wNow != null ? wNow.toFixed(1) : null,
        unit: 'kg',
        delta: weightDelta,
        tone: 'neutral',
      },
      {
        key: 'entrenos',
        label: 'Entrenos',
        before: String(eBefore),
        now: String(eNow),
        delta: eNow - eBefore > 0 ? { text: `+${eNow - eBefore}`, up: true } : null,
        tone: 'growth',
      },
      {
        key: 'proteina',
        label: 'Proteína prom.',
        before: pBefore != null ? String(Math.round(pBefore)) : null,
        now: pNow != null ? String(Math.round(pNow)) : null,
        unit: 'g',
        delta: proteinDelta,
        tone: 'growth',
      },
      {
        key: 'dias',
        label: 'Días registrados',
        before: String(dBefore),
        now: String(dNow),
        delta: dNow - dBefore > 0 ? { text: `+${dNow - dBefore}`, up: true } : null,
        tone: 'growth',
      },
      {
        key: 'constelacion',
        label: 'Constelación',
        before: conBefore != null ? String(Math.round(conBefore)) : null,
        now: conNow != null ? String(Math.round(conNow)) : null,
        unit: '%',
        suffix: signLabel,
        delta: conDelta,
        tone: 'growth',
      },
    ]
  }, [
    measurements.data,
    workouts.data,
    signals.data,
    cBefore.progress,
    cNow.progress,
    cut30,
    cut60,
    today,
    signLabel,
  ])

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.card}>
      <EyebrowLabel tone="magenta" size={10}>
        Tu Historia
      </EyebrowLabel>
      <Text style={styles.subtitle}>
        Hace 30 días <Text style={styles.subtitleArrow}>→</Text> Hoy
      </Text>

      {loading ? (
        <Text style={styles.loading}>Reuniendo tu historia…</Text>
      ) : (
        <View style={styles.rows}>
          {rows.map((r, i) => (
            <View key={r.key} style={[styles.row, i > 0 && styles.rowDivider]}>
              <Text style={styles.label}>{r.label}</Text>

              <View style={styles.values}>
                <Text style={styles.before}>{r.before ?? '·'}</Text>
                <Text style={styles.arrow}>→</Text>
                <Text style={styles.now} numberOfLines={1}>
                  {r.now ?? '·'}
                  {r.now != null && r.unit ? <Text style={styles.unit}> {r.unit}</Text> : null}
                  {r.now != null && r.suffix ? (
                    <Text style={styles.suffix}> {r.suffix}</Text>
                  ) : null}
                </Text>
              </View>

              {r.delta ? (
                <View style={[styles.delta, r.tone === 'neutral' && styles.deltaNeutral]}>
                  <Text style={[styles.deltaText, r.tone === 'neutral' && styles.deltaTextNeutral]}>
                    {r.tone === 'growth' ? '↑ ' : ''}
                    {r.delta.text}
                  </Text>
                </View>
              ) : (
                <View style={styles.deltaSpacer} />
              )}
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  )
}

const DELTA_W = 74

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  subtitle: {
    marginTop: 5,
    marginBottom: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  subtitleArrow: {
    color: colors.oro,
    fontStyle: 'normal',
  },
  loading: {
    paddingVertical: 18,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  rows: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.oroHairlineSoft,
  },
  label: {
    width: 104,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    letterSpacing: 0.2,
    color: colors.niebla,
  },
  values: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  // El pasado: tenue. El contraste con el presente luminoso ES la evidencia.
  before: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  arrow: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.oro,
  },
  // El presente: brillante. Es donde el ojo aterriza.
  now: {
    flexShrink: 1,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.heading,
    letterSpacing: -0.3,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  suffix: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  // Delta de crecimiento — chip oro tenue con flecha (más = evidencia).
  delta: {
    width: DELTA_W,
    alignItems: 'flex-end',
  },
  deltaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.caption,
    letterSpacing: 0.2,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  // Peso: sin juicio de "bueno/malo" — el delta va en tono neutro.
  deltaNeutral: {},
  deltaTextNeutral: {
    color: colors.niebla,
  },
  deltaSpacer: {
    width: DELTA_W,
  },
})
