import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import {
  useActiveExperiment,
  useCancelExperiment,
  useCloseExperiment,
  useHypotheses,
  useStartExperiment,
} from '@/features/experiments/hooks'
import { colors, typography } from '@/theme'

/*
 * Órbita Mes · Hipótesis + Experimentos (R1 Engine 4 → R5).
 *
 * Da entrada VISUAL a dos piezas que vivían solo en el backend:
 *   · las HIPÓTESIS del motor ("es posible que A y B vayan de la mano") — el
 *     hilo tentativo, nunca una afirmación.
 *   · el ciclo de EXPERIMENTOS (R5): elegir un hilo → seguirlo ≤2 semanas →
 *     el motor mide → resultado. Recomendación, no orden; reversible.
 *
 * Solo se muestra dentro de MonthSegmentIA (gateado a dev). Lee las hipótesis
 * persistidas (con su uuid + status real) y el experimento activo.
 */

type Props = {
  uid: string | null
  period: 'day' | 'week' | 'month' | 'last30'
  periodStart: string
  periodEnd: string
  today: string
}

const RESULT_COPY: Record<string, { label: string; tone: 'good' | 'soft' }> = {
  confirmed: { label: 'Se sostuvo en tus días.', tone: 'good' },
  discarded: { label: 'No se sostuvo esta vez.', tone: 'soft' },
  inconclusive: { label: 'Aún no alcanza para saberlo.', tone: 'soft' },
}

function daysLeft(endsOn: string, today: string): number {
  const a = new Date(`${today}T00:00:00Z`).getTime()
  const b = new Date(`${endsOn}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)))
}

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

  const onClose = (id: string) =>
    close.mutate(id, {
      onSuccess: (data) => {
        const status = (data as { measurement?: { status?: string } })?.measurement?.status ?? null
        setLastResult(status)
      },
    })

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Un hilo para seguir</Text>
      <Text style={styles.lead}>
        Si quieres, elige un hilo y lo seguimos un tiempo. Sin presión: puedes parar cuando quieras.
      </Text>

      {/* Experimento en curso: uno a la vez. */}
      {active ? (
        <View style={styles.activeCard}>
          <Text style={styles.activeLabel}>Estás siguiendo un hilo</Text>
          <Text style={styles.activeDim}>{humanDimension(active.dimension)}</Text>
          <Text style={styles.activeMeta}>
            {daysLeft(active.ends_on, today) > 0
              ? `En ${daysLeft(active.ends_on, today)} días lo sabrás.`
              : 'Ya puedes leer cómo te fue.'}
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
                <Text style={styles.btnPrimaryText}>Cerrar y ver cómo me fue</Text>
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
        // Sin activo: las hipótesis abiertas, cada una con su "Probar esto".
        open.map((h) => (
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
              {start.isPending ? (
                <ActivityIndicator color={colors.bg} size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>Probar esto</Text>
              )}
            </Pressable>
          </View>
        ))
      )}

      {/* Resultado del último experimento cerrado (cálido, sin culpa). */}
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

/** La dimensión técnica → humano (para la card del activo). */
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
  },
  activeMeta: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    marginBottom: 10,
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
