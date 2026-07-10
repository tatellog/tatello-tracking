import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import {
  useActiveExperiment,
  useCancelExperiment,
  useCloseExperiment,
  useHypotheses,
  useStartExperiment,
} from '@/features/experiments/hooks'
import type { ExperimentMetric } from '@/features/experiments/logic'
import { colors, typography } from '@/theme'

/*
 * Órbita Mes · Hipótesis + Experimentos (R1 Engine 4 → R5).
 *
 * El HILO en tres tiempos, siempre visibles (Aparece → Lo sigues → Lo ves), para
 * que se sienta un recorrido y no tres pantallas sueltas:
 *   · Aparece  — las HIPÓTESIS del motor (relación tentativa en tus datos).
 *   · Lo sigues — un EXPERIMENTO activo (≤2 semanas, reversible). La card muestra
 *     QUÉ se mira y TU ANTES (línea base) con puro dato determinístico — sin IA.
 *   · Lo ves   — el resultado (el motor mide, no la IA): confirmada / no / inconclusa.
 *
 * Solo dentro de MonthSegmentIA (gateado a dev). Lee las hipótesis persistidas
 * (uuid + status real) y el experimento activo.
 */

type Props = {
  uid: string | null
  period: 'day' | 'week' | 'month' | 'last30'
  periodStart: string
  periodEnd: string
  today: string
}

type ExperimentPlanJson = {
  metric?: ExperimentMetric
  direction?: 'increase' | 'decrease' | 'maintain'
  durationDays?: number
  baselineRate?: number
}

const DAY_MS = 24 * 60 * 60 * 1000

const RESULT_COPY: Record<string, { label: string; tone: 'good' | 'soft' }> = {
  confirmed: { label: 'Se sostuvo en tus días.', tone: 'good' },
  discarded: { label: 'No se sostuvo esta vez.', tone: 'soft' },
  inconclusive: { label: 'Aún no alcanza para saberlo.', tone: 'soft' },
}

/** La métrica del motor → "qué se mira", en humano. */
function humanMetric(metric: ExperimentMetric | undefined, dimension: string): string {
  switch (metric) {
    case 'deficit_days':
      return 'tus días en déficit'
    case 'workout_days':
      return 'tus días de entreno'
    case 'days_slept_7h':
      return 'tus noches de 7 horas o más'
    case 'water_goal_days':
      return 'tus días con tu meta de agua'
    case 'protein_target_days':
      return 'tus días con tu proteína'
    default:
      return humanDimension(dimension)
  }
}

/** Línea base (tasa 0-1 → "tu antes"), sin números fríos ni culpa. */
function baselineLine(rate: number | undefined): string {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return 'Antes casi no pasaba.'
  const n = Math.round(rate * 10)
  if (n <= 0) return 'Antes casi no pasaba.'
  if (n >= 10) return 'Antes pasaba casi todos los días.'
  return `Antes pasaba unos ${n} de cada 10 días.`
}

/** Qué vas a saber, según la dirección (hoy siempre `increase`). Nunca receta. */
function measureLine(direction: ExperimentPlanJson['direction']): string {
  if (direction === 'decrease')
    return 'Así vas a saber si aparece menos que en tus semanas de antes.'
  if (direction === 'maintain')
    return 'Así vas a saber si se sostiene como en tus semanas de antes.'
  return 'Así vas a saber si aparece más seguido que en tus semanas de antes.'
}

/** Día actual dentro de la ventana (progreso, no cuenta regresiva). */
function dayNumber(startedOn: string, today: string, durationDays: number): number {
  const a = new Date(`${startedOn}T00:00:00Z`).getTime()
  const b = new Date(`${today}T00:00:00Z`).getTime()
  const elapsed = Math.floor((b - a) / DAY_MS)
  return Math.min(durationDays, Math.max(1, elapsed + 1))
}

const STAGES = ['Aparece', 'Lo sigues', 'Lo ves'] as const

export function MonthExperiments({ uid, period, periodStart, periodEnd, today }: Props) {
  const { data: hypotheses = [] } = useHypotheses({ uid, period, periodStart, periodEnd })
  const { data: active } = useActiveExperiment(uid)
  const start = useStartExperiment(uid)
  const close = useCloseExperiment(uid)
  const cancel = useCancelExperiment(uid)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const open = hypotheses.filter((h) => h.status === 'open')
  // Nada que mostrar: sin hipótesis abiertas y sin experimento en curso.
  if (!active && open.length === 0 && !lastResult) return null

  const stage: 1 | 2 | 3 = active ? 2 : lastResult ? 3 : 1

  const onClose = (id: string) =>
    close.mutate(id, {
      onSuccess: (data) => {
        const status = (data as { measurement?: { status?: string } })?.measurement?.status ?? null
        setLastResult(status)
      },
    })

  const plan: ExperimentPlanJson = (active?.plan as ExperimentPlanJson) ?? {}
  const duration = plan.durationDays ?? 14
  const left = active ? daysLeft(active.ends_on, today) : 0

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Un hilo para seguir</Text>

      {/* El hilo en tres tiempos: continuidad visible (Aparece → Lo sigues → Lo ves). */}
      <View style={styles.spine}>
        {STAGES.map((label, i) => (
          <View key={label} style={styles.spineItem}>
            <Text
              style={[
                styles.spineLabel,
                i + 1 === stage && styles.spineLabelOn,
                i + 1 < stage && styles.spineLabelDone,
              ]}
            >
              {label}
            </Text>
            {i < STAGES.length - 1 ? <Text style={styles.spineArrow}>→</Text> : null}
          </View>
        ))}
      </View>

      <Text style={styles.lead}>
        Si quieres, elige un hilo y lo seguimos un tiempo. Sin presión: puedes parar cuando quieras.
      </Text>

      {/* ── Lo sigues: el experimento activo, con QUÉ se mira + tu antes ── */}
      {active ? (
        <View style={styles.activeCard}>
          <Text style={styles.activeLabel}>Estás siguiendo un hilo</Text>
          <Text style={styles.activeDim}>{humanMetric(plan.metric, active.dimension)}</Text>
          <Text style={styles.activeBase}>{baselineLine(plan.baselineRate)}</Text>
          <Text style={styles.activeMeasure}>{measureLine(plan.direction)}</Text>
          <Text style={styles.activeDay}>
            {left > 0
              ? `Día ${dayNumber(active.started_on, today, duration)} de ${duration}. Al cerrar, ves el resultado.`
              : 'Ya puedes ver cómo te fue.'}
          </Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              disabled={close.isPending}
              onPress={() => onClose(active.id)}
            >
              {close.isPending ? (
                <ActivityIndicator color={colors.bg} size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>Cerrar y ver el resultado</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.btnGhost}
              disabled={cancel.isPending}
              onPress={() => cancel.mutate(active.id)}
            >
              <Text style={styles.btnGhostText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        // Aparece: las hipótesis abiertas. El spinner va SOLO en el botón tocado.
        open.map((h) => {
          const starting = start.isPending && start.variables === h.id
          return (
            <View key={h.id} style={styles.hypCard}>
              <Text style={styles.hypText}>{h.text}</Text>
              <Pressable
                style={[styles.btn, styles.btnPrimary, styles.btnFull]}
                disabled={start.isPending}
                onPress={() => {
                  setLastResult(null)
                  start.mutate(h.id)
                }}
              >
                {starting ? (
                  <ActivityIndicator color={colors.bg} size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Seguir este hilo 2 semanas</Text>
                )}
              </Pressable>
            </View>
          )
        })
      )}

      {/* Si arrancar falla (ej. dimensión no medible → 422), lectura suave. */}
      {start.isError ? (
        <Text style={styles.softNote}>Ese hilo todavía no se puede seguir.</Text>
      ) : null}

      {/* Lo ves: el resultado del último experimento cerrado (cálido, sin culpa). */}
      {lastResult && RESULT_COPY[lastResult] ? (
        <Text
          style={[
            styles.result,
            RESULT_COPY[lastResult]!.tone === 'good' ? styles.resultGood : styles.resultSoft,
          ]}
        >
          {RESULT_COPY[lastResult]!.label}
        </Text>
      ) : null}
    </View>
  )
}

function daysLeft(endsOn: string, today: string): number {
  const a = new Date(`${today}T00:00:00Z`).getTime()
  const b = new Date(`${endsOn}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((b - a) / DAY_MS))
}

/** La dimensión técnica → humano (fallback cuando no hay métrica). */
function humanDimension(dim: string): string {
  switch (dim) {
    case 'deficit':
      return 'tu déficit'
    case 'movimiento':
      return 'tu movimiento'
    case 'sueno':
      return 'tu descanso'
    case 'agua':
      return 'tu hidratación'
    case 'proteina':
      return 'tu proteína'
    default:
      return 'este hilo'
  }
}

const styles = StyleSheet.create({
  wrap: { gap: 12, paddingHorizontal: 4 },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  spine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  spineItem: { flexDirection: 'row', alignItems: 'center' },
  spineLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  spineLabelOn: { fontFamily: typography.uiBold, color: colors.magenta },
  spineLabelDone: { color: colors.bone },
  spineArrow: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bruma,
    marginHorizontal: 8,
  },
  lead: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.bone,
  },
  hypCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    padding: 16,
    gap: 14,
  },
  hypText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.leche,
  },
  activeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.magenta,
    padding: 16,
    gap: 4,
  },
  activeLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.magenta,
  },
  activeDim: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.title,
    color: colors.leche,
    marginBottom: 2,
  },
  activeBase: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 19,
    color: colors.bone,
  },
  activeMeasure: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.leche,
    marginTop: 2,
  },
  activeDay: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    marginTop: 6,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  btnFull: { alignSelf: 'stretch' },
  btnPrimary: { backgroundColor: colors.magenta, flexShrink: 1 },
  btnPrimaryText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.bg,
  },
  btnGhost: { paddingVertical: 12, paddingHorizontal: 8 },
  btnGhostText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  softNote: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  result: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    marginTop: 4,
  },
  resultGood: { color: colors.leche },
  resultSoft: { color: colors.bone },
})
