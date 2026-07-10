import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import {
  useCancelExperiment,
  useCloseExperiment,
  useClosedExperiments,
  useHypotheses,
  useLatestExperiment,
  useStartExperiment,
} from '@/features/experiments/hooks'
import type { ExperimentMetric } from '@/features/experiments/logic'
import { useExperimentCopy } from '@/features/orbit/ai-voice'
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
  const { data: latest } = useLatestExperiment(uid)
  const { data: closedAll = [] } = useClosedExperiments(uid)
  const start = useStartExperiment(uid)
  const close = useCloseExperiment(uid)
  const cancel = useCancelExperiment(uid)
  // El resultado que la usuaria ya cerró (para volver a los hilos).
  const [dismissedId, setDismissedId] = useState<string | null>(null)

  // El más reciente: activo (running) o el recién cerrado con su resultado.
  const active = latest && latest.status === 'running' ? latest : null
  const closedRes = (latest?.result as { status?: string; daysMeasured?: number } | null) ?? null
  const recentlyClosed = !!(
    latest &&
    latest.status !== 'running' &&
    latest.id !== dismissedId &&
    latest.closed_at &&
    Date.now() - new Date(latest.closed_at).getTime() < 60 * 60 * 1000
  )

  const open = hypotheses.filter((h) => h.status === 'open')
  // El hilo fuerte (dos hallazgos que coincidieron · source_story_id) antes que
  // el cabo suelto (un cruce tentativo · solo source_finding_id). Sort estable →
  // conserva el orden por confianza dentro de cada nivel.
  const sortedOpen = [...open].sort(
    (a, b) => (a.source_story_id ? 0 : 1) - (b.source_story_id ? 0 : 1),
  )

  const plan: ExperimentPlanJson = (active?.plan as ExperimentPlanJson) ?? {}
  // El "por qué": la hipótesis que originó el experimento. RE-ANCLA la métrica a
  // su relación con tu déficit (no es una meta de agua/sueño suelta · manifiesto).
  const sourceHyp = active ? hypotheses.find((h) => h.id === active.hypothesis_id) : undefined
  const activeMetricLabel = active ? humanMetric(plan.metric, active.dimension) : ''
  // La IA redacta el FOCO del hilo (gateado a dev, backstop anti-receta); si no
  // está disponible o el backstop la rechaza, cae a la hipótesis determinística.
  const aiFocus = useExperimentCopy({
    uid,
    periodStart,
    periodEnd,
    metricLabel: activeMetricLabel,
    hypothesis: sourceHyp?.text ?? '',
    subject: activeMetricLabel,
    cacheKey: active?.id ?? 'none',
  }).data

  // El historial "Hilos que ya seguiste": los cerrados, excluyendo el que ya se
  // muestra arriba como card de resultado reciente (para no duplicarlo).
  const trail = closedAll.filter((e) => !(recentlyClosed && e.id === latest?.id))
  // El bloque activo (elegir/seguir/ver) solo tiene sentido si hay algo vivo o
  // hipótesis por elegir; si solo queda historial, mostramos nada más la tira.
  const showFollow = !!active || recentlyClosed || open.length > 0

  // Nada que mostrar: sin activo, sin resultado reciente, sin hipótesis, sin historial.
  if (!showFollow && trail.length === 0) return null

  const stage: 1 | 2 | 3 = active ? 2 : recentlyClosed ? 3 : 1
  const duration = plan.durationDays ?? 14
  const left = active ? daysLeft(active.ends_on, today) : 0

  const onClose = (id: string) => close.mutate(id)

  return (
    <View style={styles.wrap}>
      {showFollow ? (
        <>
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
            Si quieres, elige un hilo y lo seguimos un tiempo. Sin presión: puedes parar cuando
            quieras.
          </Text>

          {/* ── Lo sigues: el experimento activo, con QUÉ se mira + tu antes ── */}
          {active ? (
            <View style={styles.activeCard}>
              <Text style={styles.activeLabel}>Estás siguiendo un hilo</Text>
              <Text style={styles.activeDim}>{activeMetricLabel}</Text>
              {/* La IA (voz de Stelar) lleva el ✦; si cae al determinístico, sin marca. */}
              {aiFocus ? (
                <Text style={styles.activeWhy}>
                  <Text style={styles.aiMark}>✦ </Text>
                  {aiFocus}
                </Text>
              ) : sourceHyp?.text ? (
                <Text style={styles.activeWhy}>{sourceHyp.text}</Text>
              ) : null}
              <Text style={styles.activeBase}>{baselineLine(plan.baselineRate)}</Text>
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
          ) : recentlyClosed && latest ? (
            // Lo ves: el resultado del hilo recién cerrado, leído de la DB (sobrevive a
            // remounts). Cálido, sin culpa. Botón para volver a los hilos abiertos.
            <View style={styles.resultCard}>
              <Text style={styles.resultEyebrow}>Lo que vio este hilo</Text>
              <Text style={styles.activeDim}>
                {humanMetric((latest.plan as ExperimentPlanJson)?.metric, latest.dimension)}
              </Text>
              <Text
                style={[
                  styles.result,
                  resultTone(closedRes?.status) === 'good' ? styles.resultGood : styles.resultSoft,
                ]}
              >
                {resultLine(closedRes?.status, closedRes?.daysMeasured)}
              </Text>
              <Pressable
                style={[styles.btn, styles.btnFull, styles.btnOutline]}
                onPress={() => setDismissedId(latest.id)}
              >
                <Text style={styles.btnOutlineText}>Ver mis hilos</Text>
              </Pressable>
            </View>
          ) : (
            // Aparece: las hipótesis abiertas, por nivel. Un HILO (dos hallazgos que
            // coincidieron) pesa más que un CABO SUELTO (un cruce tentativo): el fuerte
            // arriba, sólido; el tentativo, más callado. El spinner va SOLO en el tocado.
            sortedOpen.map((h) => {
              const loose = h.source_story_id == null // cruce tentativo (hyp-find)
              const starting = start.isPending && start.variables === h.id
              return (
                <View key={h.id} style={[styles.hypCard, loose && styles.hypCardLoose]}>
                  <Text style={[styles.hypTier, loose && styles.hypTierLoose]}>
                    {loose ? 'Un cabo suelto' : 'Un hilo que ya se dejó ver'}
                  </Text>
                  <Text style={styles.hypText}>{h.text}</Text>
                  <Pressable
                    style={[
                      styles.btn,
                      styles.btnFull,
                      loose ? styles.btnOutline : styles.btnPrimary,
                    ]}
                    disabled={start.isPending}
                    onPress={() => start.mutate(h.id)}
                  >
                    {starting ? (
                      <ActivityIndicator color={loose ? colors.magenta : colors.bg} size="small" />
                    ) : (
                      <Text style={loose ? styles.btnOutlineText : styles.btnPrimaryText}>
                        Seguir este hilo 2 semanas
                      </Text>
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
        </>
      ) : null}

      {/* Historial: los hilos que ya seguiste, quietos (no desaparecen al cerrar). */}
      {trail.length > 0 ? (
        <View style={styles.trail}>
          <Text style={styles.trailTitle}>Hilos que ya seguiste</Text>
          {trail.map((e) => (
            <View key={e.id} style={styles.trailRow}>
              <Text style={styles.trailDim}>
                {humanMetric((e.plan as ExperimentPlanJson)?.metric, e.dimension)}
              </Text>
              <Text style={styles.trailMeta}>
                <Text
                  style={resultTone(e.status) === 'good' ? styles.resultGood : styles.resultSoft}
                >
                  {shortResult(
                    e.status,
                    (e.result as { daysMeasured?: number } | null)?.daysMeasured,
                  )}
                </Text>
                {formatShortDate(e.closed_at) ? `   ·   ${formatShortDate(e.closed_at)}` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** El resultado del motor → una frase cálida, sin culpa. El día-0 (cerrado muy
 *  pronto) se dice como tal, no como fracaso. */
function resultLine(status: string | undefined, daysMeasured: number | undefined): string {
  if (status === 'confirmed') return 'Se sostuvo en tus días.'
  if (status === 'discarded') return 'No se sostuvo esta vez, y eso también dice algo.'
  if ((daysMeasured ?? 0) === 0)
    return 'Lo cerraste muy pronto para leerlo. Otro día le damos tiempo.'
  return 'Aún no alcanza para saberlo.'
}

function resultTone(status: string | undefined): 'good' | 'soft' {
  return status === 'confirmed' ? 'good' : 'soft'
}

/** El resultado en corto, para las filas del historial (sin frase larga). */
function shortResult(status: string | undefined, daysMeasured: number | undefined): string {
  if (status === 'confirmed') return 'Se sostuvo'
  if (status === 'discarded') return 'No se sostuvo'
  if ((daysMeasured ?? 0) === 0) return 'Cerrado pronto'
  return 'Sin señal aún'
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Fecha de cierre → "10 jul" (corto, cálido). Vacío si no hay fecha válida. */
function formatShortDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MESES[d.getMonth()]}`
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
    gap: 12,
  },
  // El cabo suelto se ve más callado: borde más tenue, sin acento.
  hypCardLoose: { borderColor: colors.borderSubtle, backgroundColor: 'transparent' },
  hypTier: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  hypTierLoose: { color: colors.niebla },
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
  activeWhy: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.leche,
    marginTop: 4,
    marginBottom: 2,
  },
  // Marca de la voz de Stelar (la línea la escribió la IA).
  aiMark: { fontStyle: 'normal', color: colors.magenta },
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
  // CTA del cabo suelto: contorno, no relleno (empuja menos).
  btnOutline: { borderWidth: 1, borderColor: colors.magentaDeep, backgroundColor: 'transparent' },
  btnOutlineText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.magenta,
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
  // Lo ves: la card del resultado (mismo lenguaje que el hilo activo, más quieta).
  resultCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.magentaDeep,
    padding: 16,
    gap: 6,
  },
  resultEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  result: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    marginTop: 4,
    marginBottom: 8,
  },
  resultGood: { color: colors.leche },
  resultSoft: { color: colors.bone },
  // Historial "Hilos que ya seguiste": quieto, separado de la sección activa.
  trail: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.oroHairline,
    gap: 12,
  },
  trailTitle: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 2,
  },
  trailRow: { gap: 2 },
  trailDim: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  trailMeta: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
})
