import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'

import { colors, radius, typography } from '@/theme'

import { type ComboChatRequest, fetchComboAnswer, fetchComboChips } from '../ai-voice'
import type { ComboDayDetail, ComboFact } from '../combo-facts'
import { fmtShortDate } from '../combo-facts'
import { type ComboEntry, makeComboTranscript, type ComboTranscript } from '../combo-transcript'
import type { Finding } from '../findings'
import { StelarStar } from './MonthChatView'
import { TypingDots } from './TypingDots'

/*
 * El chat del patrón dominante (paquete de hechos · sep 2026).
 *
 *   Apertura FIJA: el patrón, su evidencia contada y tus otros días. No es IA
 *     (es el motor), así que no lleva ✦ ni aurora.
 *   ✦ Pregúntale a Stelar: la IA redacta 3 preguntas, cada una atada a un hecho
 *     que el motor ya calculó; contesta con ESE hecho (números del hecho, nada
 *     más). Si la IA falla, cae al texto determinista del hecho.
 *   Metacognición FIJA tras dos preguntas; cierre FIJO: "Tu foco esta semana",
 *     el estado de la semana y tus días con el patrón.
 *   Un día tocado se resume aquí mismo (sueño, entreno, déficit) y abre el día
 *     completo. Al reabrir con el mismo patrón: abre en el foco, con "Lo que
 *     hablamos" plegado y preguntas nuevas si quedan hechos sin ver.
 */

type Phase = 'asking' | 'meta' | 'closed'
type Chip = { factId: string; label: string }

const QUESTIONS_BEFORE_META = 2
const MAX_DAY_PILLS = 14

type Props = {
  opening: string[]
  facts: ComboFact[]
  focus: string
  weekLine: string | null
  /** Todos los días con el patrón (para el cierre). */
  comboDays: string[]
  request: ComboChatRequest
  meta: Finding['metacognition']
  reflectionKey: string
  today: string
  transcript: ComboTranscript | null
  onSaveTranscript: (t: ComboTranscript) => void
  dayDetail: (date: string) => ComboDayDetail
  onSaveReflection: (questionKey: string, answer: string) => void
  onOpenDay?: (date: string) => void
  onFinish: () => void
  finishLabel: string
  /** Abrió desde una pregunta de la tarjeta: se contesta de entrada. */
  initialFactId?: string | null
}

export function ComboChatView({
  opening,
  facts,
  focus,
  weekLine,
  comboDays,
  request,
  meta,
  reflectionKey,
  today,
  transcript: savedTranscript,
  onSaveTranscript,
  dayDetail,
  onSaveReflection,
  onOpenDay,
  onFinish,
  finishLabel,
  initialFactId,
}: Props) {
  // La memoria se congela al abrir: guardar a mitad de charla actualiza la
  // prop, y eso no debe convertir esta visita en "reabierta" (duplicaría el hilo).
  const [transcript] = useState(savedTranscript)
  const resumed = transcript != null
  // Lo ya hablado (plegado al reabrir) y lo de esta visita.
  const past = transcript?.log ?? []
  const [log, setLog] = useState<ComboEntry[]>(() =>
    resumed ? [] : opening.map((text) => ({ who: 'stelar' as const, text })),
  )
  const [phase, setPhase] = useState<Phase>(resumed ? 'closed' : 'asking')
  const [used, setUsed] = useState<string[]>(transcript?.usedFactIds ?? [])
  const [metaAnswer, setMetaAnswer] = useState<string | null>(transcript?.metaAnswer ?? null)
  const [chips, setChips] = useState<Chip[]>([])
  const [pending, setPending] = useState(false)
  const [showPast, setShowPast] = useState(false)
  // El día abierto: en qué lugar del hilo (índice de burbuja o 'cierre') y cuál.
  const [openDay, setOpenDay] = useState<{ at: string; date: string } | null>(null)
  const asked = useRef(0)
  const mounted = useRef(true)

  const remaining = facts.filter((f) => !used.includes(f.id))

  const loadChips = async (usedIds: string[]) => {
    const offer = facts.filter((f) => !usedIds.includes(f.id)).slice(0, 3)
    if (offer.length === 0) {
      setChips([])
      return
    }
    setPending(true)
    const ai = await fetchComboChips(request, usedIds)
    if (!mounted.current) return
    // Cada hecho ofrecido tiene su pregunta: la de la IA o la de reserva.
    const byFact = new Map((ai ?? []).map((c) => [c.factId, c.label]))
    setChips(offer.map((f) => ({ factId: f.id, label: byFact.get(f.id) ?? f.question })))
    setPending(false)
  }

  useEffect(() => {
    mounted.current = true
    // Sin hechos que preguntar: de la apertura directo a la metacognición.
    if (!resumed && facts.length === 0) {
      setLog((l) => [...l, { who: 'stelar', text: meta.question }])
      setPhase('meta')
      return () => {
        mounted.current = false
      }
    }
    const first = initialFactId ? facts.find((f) => f.id === initialFactId) : null
    if (first && !used.includes(first.id)) {
      void onChip({ factId: first.id, label: first.question })
    } else {
      void loadChips(used)
    }
    return () => {
      mounted.current = false
    }
    // Solo al montar: el key del padre remonta si cambia el patrón.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = (nextLog: ComboEntry[], usedIds: string[], answer: string | null) => {
    onSaveTranscript(
      makeComboTranscript({
        talkedOn: today,
        log: [...past, ...nextLog],
        usedFactIds: usedIds,
        metaAnswer: answer,
      }),
    )
  }

  const onChip = async (chip: Chip) => {
    const fact = facts.find((f) => f.id === chip.factId)
    if (!fact || pending) return
    const nextUsed = [...used, fact.id]
    const withQ: ComboEntry[] = [...log, { who: 'user', label: chip.label }]
    setLog(withQ)
    setUsed(nextUsed)
    setChips([])
    setOpenDay(null)
    setPending(true)
    const ai = await fetchComboAnswer(request, fact.id, chip.label)
    if (!mounted.current) return
    const answer: ComboEntry = {
      who: 'stelar',
      text: ai ?? fact.text,
      ...(fact.days.length > 0 ? { days: fact.days.slice(-MAX_DAY_PILLS) } : {}),
    }
    const withA = [...withQ, answer]
    setLog(withA)
    setPending(false)
    asked.current += 1

    const left = facts.filter((f) => !nextUsed.includes(f.id))
    if (phase === 'asking' && (asked.current >= QUESTIONS_BEFORE_META || left.length === 0)) {
      if (metaAnswer == null) {
        const withMeta: ComboEntry[] = [...withA, { who: 'stelar', text: meta.question }]
        setLog(withMeta)
        setPhase('meta')
        persist(withMeta, nextUsed, null)
        return
      }
      setPhase('closed')
    }
    persist(withA, nextUsed, metaAnswer)
    void loadChips(nextUsed)
  }

  const onMeta = (option: { label: string; answer: string }) => {
    onSaveReflection(reflectionKey, option.answer)
    const reply = meta.replies[option.answer] ?? 'Ya lo sabes, y saberlo cambia cómo te ves.'
    const next: ComboEntry[] = [
      ...log,
      { who: 'user', label: option.label },
      { who: 'stelar', text: reply, voice: true },
    ]
    setLog(next)
    setMetaAnswer(option.answer)
    setPhase('closed')
    persist(next, used, option.answer)
    void loadChips(used)
  }

  const renderDays = (at: string, days: string[]) => (
    <View style={styles.daysBlock}>
      <View style={styles.dayPills}>
        {days.map((d) => {
          const info = dayDetail(d)
          const on = openDay?.at === at && openDay.date === d
          return (
            <Pressable
              key={d}
              onPress={() => setOpenDay(on ? null : { at, date: d })}
              accessibilityRole="button"
              accessibilityLabel={`${fmtShortDate(d)}${info.deficit ? ', en déficit' : ''}`}
              style={({ pressed }) => [
                styles.dayPill,
                info.deficit ? styles.dayPillDeficit : null,
                on && styles.dayPillOpen,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.dayPillText, info.deficit && styles.dayPillTextDeficit]}>
                {fmtShortDate(d)}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {openDay?.at === at ? (
        <DayCard detail={dayDetail(openDay.date)} onOpenDay={onOpenDay} />
      ) : null}
    </View>
  )

  const renderEntry = (e: ComboEntry, key: string, animate: boolean) =>
    e.who === 'stelar' ? (
      <Animated.View
        key={key}
        entering={animate ? FadeInDown.duration(320).springify().damping(18) : undefined}
        style={styles.stelarGroup}
      >
        <Bubble text={e.text} voice={e.voice} />
        {e.days && e.days.length > 0 ? (
          <View style={styles.indent}>{renderDays(key, e.days)}</View>
        ) : null}
      </Animated.View>
    ) : (
      <Animated.View key={key} entering={animate ? FadeIn.duration(200) : undefined}>
        <View style={styles.userRow}>
          <View style={styles.userChip}>
            <Text style={styles.userChipText}>{e.label}</Text>
          </View>
        </View>
      </Animated.View>
    )

  const closingDays = comboDays.slice(-MAX_DAY_PILLS)

  return (
    <View style={styles.wrap}>
      {resumed ? (
        <View style={styles.pastBlock}>
          <Pressable
            onPress={() => setShowPast((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={showPast ? 'Ocultar lo que hablamos' : 'Ver lo que hablamos'}
          >
            <Text style={styles.pastToggle}>
              {`Lo que hablamos el ${fmtShortDate(transcript!.talkedOn)} ${showPast ? '⌃' : '›'}`}
            </Text>
          </Pressable>
          {showPast ? (
            <Animated.View entering={FadeIn.duration(220)} style={styles.wrap}>
              {past.map((e, i) => renderEntry(e, `p${i}`, false))}
            </Animated.View>
          ) : null}
        </View>
      ) : null}

      {/* Al reabrir, el foco va primero: es a lo que se vuelve. */}
      {resumed ? (
        <Closing focus={focus} weekLine={weekLine} days={closingDays} renderDays={renderDays} />
      ) : null}

      {log.map((e, i) => renderEntry(e, `n${i}`, true))}

      {pending ? (
        <View style={styles.typingRow}>
          <View style={styles.avatar}>
            <StelarStar size={18} />
          </View>
          <TypingDots />
        </View>
      ) : null}

      {phase === 'meta' && !pending ? (
        <Animated.View entering={FadeInDown.duration(300)} style={[styles.pillRow, styles.indent]}>
          {meta.options.map((o) => (
            <Pressable
              key={o.answer}
              onPress={() => onMeta(o)}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
            >
              <Text style={styles.pillText}>{o.label}</Text>
            </Pressable>
          ))}
        </Animated.View>
      ) : null}

      {!resumed && phase === 'closed' && !pending ? (
        <Closing focus={focus} weekLine={weekLine} days={closingDays} renderDays={renderDays} />
      ) : null}

      {phase !== 'meta' && !pending ? (
        chips.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.askBlock}>
            <Text style={styles.askEyebrow}>
              {phase === 'closed' ? '✦ Pregúntale algo nuevo' : '✦ Pregúntale a Stelar'}
            </Text>
            <View style={styles.pillRow}>
              {chips.map((c) => (
                <Pressable
                  key={c.factId}
                  onPress={() => onChip(c)}
                  accessibilityRole="button"
                  accessibilityLabel={c.label}
                  style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
                >
                  <Text style={styles.pillText}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        ) : phase === 'closed' && remaining.length === 0 ? (
          <Text style={[styles.exhausted, styles.indent]}>
            Ya hablamos de todo lo que tus días muestran por ahora. Con más días, habrá más que
            mirar.
          </Text>
        ) : null
      ) : null}

      {phase === 'closed' && !pending ? (
        <Pressable
          onPress={onFinish}
          accessibilityRole="button"
          accessibilityLabel={finishLabel}
          style={({ pressed }) => [styles.finish, pressed && styles.pressed]}
        >
          <Text style={styles.finishText}>{finishLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

/* ── Piezas ──────────────────────────────────────────────────────────── */

function Closing({
  focus,
  weekLine,
  days,
  renderDays,
}: {
  focus: string
  weekLine: string | null
  days: string[]
  renderDays: (at: string, days: string[]) => ReactNode
}) {
  return (
    <Animated.View entering={FadeInDown.duration(340)} style={styles.closing}>
      <Text style={styles.closingEyebrow}>Tu foco esta semana</Text>
      <Text style={styles.focusText}>{focus}</Text>
      {weekLine ? <Text style={styles.weekLine}>{weekLine}</Text> : null}
      {days.length > 0 ? (
        <View style={styles.closingDays}>
          <Text style={styles.closingDaysLabel}>Tus días con este patrón</Text>
          {renderDays('cierre', days)}
          <Text style={styles.legend}>Llenos: cerraste en déficit.</Text>
        </View>
      ) : null}
    </Animated.View>
  )
}

function DayCard({
  detail,
  onOpenDay,
}: {
  detail: ComboDayDetail
  onOpenDay?: (date: string) => void
}) {
  const sleep =
    detail.sleepMinutes != null && detail.sleepMinutes > 0
      ? `Dormiste ${Math.floor(detail.sleepMinutes / 60)} h ${String(detail.sleepMinutes % 60).padStart(2, '0')}`
      : 'Sin sueño registrado'
  const train = detail.trained
    ? detail.workoutType
      ? `Entrenaste · ${detail.workoutType}`
      : 'Entrenaste'
    : 'Sin entreno'
  const deficit =
    detail.deficit == null
      ? 'Sin comidas registradas'
      : detail.deficit
        ? 'Cerraste en déficit'
        : 'No cerró en déficit'
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.dayCard}>
      <Text style={styles.dayCardTitle}>{fmtShortDate(detail.date)}</Text>
      <Text style={styles.dayCardRow}>{sleep}</Text>
      <Text style={styles.dayCardRow}>{train}</Text>
      <Text style={[styles.dayCardRow, detail.deficit ? styles.dayCardDeficit : null]}>
        {deficit}
      </Text>
      {onOpenDay ? (
        <Pressable
          onPress={() => onOpenDay(detail.date)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Ver el día completo"
        >
          <Text style={styles.dayCardLink}>Ver el día completo ›</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  )
}

function Bubble({ text, voice }: { text: string; voice?: boolean }) {
  return (
    <View style={styles.bubbleRow}>
      <View style={styles.avatar}>
        <StelarStar size={18} />
      </View>
      <View style={styles.bubble}>
        <Text style={voice ? styles.bubbleVoice : styles.bubbleText}>{text}</Text>
      </View>
    </View>
  )
}

const AV = 32

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  indent: { marginLeft: AV + 8 },
  stelarGroup: { gap: 10 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  avatar: {
    width: AV,
    height: AV,
    borderRadius: AV / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
    marginTop: 2,
  },
  bubble: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.cardLg,
    borderTopLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  bubbleText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.leche,
  },
  bubbleVoice: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 25,
    color: colors.leche,
  },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  userRow: { alignItems: 'flex-end' },
  userChip: {
    backgroundColor: colors.magentaTint2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.magentaGlow,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  userChipText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  askBlock: { gap: 10, marginLeft: AV + 8, marginTop: 4 },
  askEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: 18,
    backgroundColor: colors.magentaTint,
    borderWidth: 1.5,
    borderColor: colors.magentaGlow,
  },
  pillText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
    color: colors.magentaHot,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  // Cierre fijo: el foco dicho con aire, sin ✦ (no es IA).
  closing: {
    gap: 8,
    marginTop: 8,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: radius.cardLg,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
  },
  closingEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  focusText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.title,
    lineHeight: 26,
    color: colors.leche,
  },
  weekLine: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.oroSoft,
  },
  closingDays: { gap: 8, marginTop: 10 },
  closingDaysLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  legend: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
  daysBlock: { gap: 10 },
  dayPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: `${colors.magenta}66`,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  dayPillDeficit: { backgroundColor: colors.magenta, borderColor: colors.magenta },
  dayPillOpen: { borderColor: colors.leche },
  dayPillText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.magentaHot,
  },
  dayPillTextDeficit: { color: colors.blanco },
  dayCard: {
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.control,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
  },
  dayCardTitle: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
    marginBottom: 2,
  },
  dayCardRow: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  dayCardDeficit: { color: colors.magentaHot },
  dayCardLink: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.oroSoft,
    marginTop: 6,
  },
  pastBlock: { gap: 12 },
  pastToggle: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  exhausted: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.niebla,
  },
  finish: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: colors.oroHairline,
    marginTop: 6,
  },
  finishText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
})
