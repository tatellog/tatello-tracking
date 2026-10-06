import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useEffect, useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { syncPlanReminder } from '@/features/notifications/scheduler'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

import type { PlanCheckinAnswer } from '../api'
import {
  useActiveExperiment,
  useAnswerPlanCheckin,
  useCloseExperiment,
  useLatestExperiment,
  usePlanCheckins,
} from '../hooks'
import {
  WEEKDAY_PLURAL,
  WEEKDAY_SINGULAR,
  nextReminderDate,
  occurrenceOf,
  planMoment,
  weekdayPlanOf,
} from '../plan'
import { resultLine } from '../verdict'

/*
 * El plan de un día en Hoy (dueña 6 oct 2026). Tres momentos, uno a la vez:
 *   · ese día: "Hoy es viernes · Tu plan: …" (viernes 2 de 4).
 *   · al día siguiente: "¿Cumpliste tu plan del viernes?" Sí / En parte / No.
 *     Sin culpa: "No" es una respuesta válida.
 *   · al cerrar: lo que dijo el motor con sus datos, una semana.
 * Además sincroniza el recordatorio y cierra el plan vencido (el motor mide).
 */
export function PlanTodayCard({ uid, today }: { uid: string | null; today: string }) {
  const active = useActiveExperiment(uid)
  const latest = useLatestExperiment(uid).data ?? null
  const plan = weekdayPlanOf(active.data)
  const checkins = usePlanCheckins(plan?.id ?? null)
  const answer = useAnswerPlanCheckin(plan?.id ?? null)
  const close = useCloseExperiment(uid)

  // Recordatorio: la próxima ocurrencia a su hora; sin plan, se cancela.
  const reminderKey = plan ? `${plan.id}:${plan.reminderMinutes}:${today}` : 'none'
  useEffect(() => {
    if (active.isLoading) return
    void syncPlanReminder(
      plan
        ? { weekday: plan.weekday, text: plan.text, fireAt: nextReminderDate(plan, new Date()) }
        : null,
    )
    // reminderKey resume plan + día (re-agenda tras cada ocurrencia).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderKey, active.isLoading])

  // Vencido: el motor mide y escribe el resultado (una vez por plan).
  const closedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!plan || plan.endsOn >= today || closedRef.current === plan.id) return
    closedRef.current = plan.id
    close.mutate(plan.id)
  }, [plan, today, close])

  if (plan) {
    const moment = planMoment(plan, today, new Set(checkins.data?.keys() ?? []))
    if (!moment || checkins.isLoading) return null
    const singular = WEEKDAY_SINGULAR[plan.weekday] ?? 'día'
    const occ = occurrenceOf(plan, moment.date)
    if (moment.kind === 'today') {
      return (
        <Card icon="calendar-check-outline">
          <Text style={styles.kicker}>{`Hoy es ${singular} · ${occ.n} de ${occ.of}`}</Text>
          <Text style={styles.title}>{`Tu plan: ${plan.text}`}</Text>
        </Card>
      )
    }
    const reply = (a: PlanCheckinAnswer) => {
      Haptics.selectionAsync().catch(() => {})
      track('weekday_plan_checkin', { answer: a, n: occ.n })
      answer.mutate({ date: moment.date, answer: a })
    }
    return (
      <Card icon="calendar-question">
        <Text style={styles.kicker}>{`Tu plan del ${singular}: ${plan.text}`}</Text>
        <Text style={styles.title}>¿Lo cumpliste?</Text>
        <View style={styles.chips}>
          <Chip label="Sí" onPress={() => reply('si')} />
          <Chip label="En parte" onPress={() => reply('parte')} />
          <Chip label="No" onPress={() => reply('no')} />
        </View>
      </Card>
    )
  }

  // Resultado de un plan de día recién cerrado (una semana a la vista).
  const p = latest?.plan ?? {}
  const r = latest?.result ?? {}
  if (
    latest == null ||
    latest.status === 'running' ||
    typeof p.weekday !== 'number' ||
    latest.closed_at == null ||
    Date.now() - new Date(latest.closed_at).getTime() > 7 * 86_400_000
  ) {
    return null
  }
  const plural = WEEKDAY_PLURAL[p.weekday] ?? 'días'
  const hit = typeof r.hitDays === 'number' ? r.hitDays : 0
  const measured = typeof r.daysMeasured === 'number' ? r.daysMeasured : 0
  const before = typeof r.baselineRate === 'number' ? Math.round(r.baselineRate * 100) : null
  return (
    <Card
      icon={latest.status === 'confirmed' ? 'check-decagram-outline' : 'calendar-check-outline'}
    >
      <Text style={styles.kicker}>{`Tu plan de los ${plural}`}</Text>
      <Text style={styles.title}>
        {`Con tu plan: ${hit} de ${measured} ${plural} en déficit${before != null ? `. Antes, ${before}%.` : '.'}`}
      </Text>
      <Text style={styles.body}>
        {resultLine(
          latest.status,
          measured,
          typeof p.durationDays === 'number' ? p.durationDays : 28,
        )}
      </Text>
    </Card>
  )
}

function Card({
  icon,
  children,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']
  children: React.ReactNode
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(260)}
      exiting={FadeOut.duration(180)}
      style={styles.card}
    >
      <View style={styles.iconDisc}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.magenta} />
      </View>
      <View style={styles.texts}>{children}</View>
    </Animated.View>
  )
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  iconDisc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.magentaTint,
  },
  texts: { flex: 1, gap: 3 },
  kicker: { fontFamily: typography.uiBold, fontSize: typography.sizes.label, color: colors.bone },
  title: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.leche,
  },
  body: { fontFamily: typography.uiMedium, fontSize: typography.sizes.label, color: colors.bone },
  chips: { flexDirection: 'row', gap: 8, marginTop: 6 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  pressed: { opacity: 0.7 },
  chipText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.leche,
  },
})
