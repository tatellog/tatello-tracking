import { useEffect, useRef, useState } from 'react'
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'

import { colors, radius, typography } from '@/theme'

import { fetchMonthChatTurn } from '../ai-voice'
import type { Finding, FindingCategory } from '../findings'
import { FindingConstellation } from './finding-constellations'
import { StelarStar } from './MonthChatView'
import { TypingDots } from './TypingDots'

/*
 * FindingChatView — el detalle de un hallazgo como CHAT GUIADO CON IA (hermano
 * generativo de FindingView, el fallback determinístico de la beta sin IA).
 *
 * Flujo (cada elección SIEMPRE recibe respuesta; no se ignora un tap):
 *   opening (IA nombra la dimensión) + chips
 *     → reply1 (IA responde a tu chip) + chips
 *       → si es el hero: reply2 (IA responde) → metacognición (1×/sesión) → cierre
 *       → si no:         reply2 = cierre
 *   cierre → footer: [Ver esos días] + (hay más → "Ver otro hallazgo" · si no →
 *            "Ver mi mes completo", que termina la sesión sin loop).
 *
 * Aliveness: onda dorada (ceremonial) SOLO en la apertura; 3 puntos "escribiendo"
 * en los turnos de respuesta. El CLIENTE controla el conteo y el cierre.
 * Degradación grácil: si un turno de IA falla, cae al beat determinístico.
 */

type Phase = 'opening' | 'reply1' | 'reply2' | 'meta' | 'closing'

type Props = {
  finding: Finding
  periodStart: string
  periodEnd: string
  findingsHash: string
  /** Solo el hero de la sesión hace la metacognición (evita repetir la misma
   *  pregunta en cada hallazgo → se sentía fraude). */
  askMetacognition: boolean
  /** ¿Quedan hallazgos sin ver? Decide el botón de cierre (otro vs terminar). */
  hasMore: boolean
  onSaveReflection: (questionKey: string, answer: string) => void
  /** "Me lo quedo presente": guarda la palanca concreta del cierre como foco. */
  onKeepFoco?: (foco: string) => void
  /** Este hallazgo ya es un foco guardado este mes. */
  kept?: boolean
  onNext: () => void
  onFinish: () => void
  onPickDay?: (date: string) => void
}

type Entry = { who: 'stelar'; text: string; voice?: boolean } | { who: 'user'; label: string }

const TINT: Record<FindingCategory, string> = {
  deficit: colors.magenta,
  movimiento: colors.dimension.cuerpo,
  sueno: colors.dimension.sueno,
  agua: colors.signal.agua,
  proteina: colors.signal.proteina,
  alimentacion: colors.dimension.alimento,
}

// Chips deterministas de reserva (reacciones, nunca acción) si la IA no da chips.
const FALLBACK_CHIPS = ['No lo había notado', '¿Y los días que no?', '¿Es casualidad?']

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDate = (d: string): string =>
  `${Number(d.slice(8, 10))} ${MESES[Number(d.slice(5, 7)) - 1] ?? ''}`

/**
 * El fallback determinístico CONSCIENTE del chip: cada pregunta recibe SU
 * respuesta del dato, no un mensaje "positivo" ciego (que se sentía como esquivar).
 * Honesto y sin afirmar causa (manifiesto). Primero contesta; la calidez va en el
 * chip de foco / la discovery, no en vez de la respuesta. Es el PISO cuando la IA
 * falla o el backstop la rechaza — por eso tiene que contestar bien solo.
 */
function fallbackFor(label: string, finding: Finding): string {
  const l = label.toLowerCase()
  // "¿Y los días que no?" → el contrapunto, directo (los días que NO se dieron).
  if (/d[ií]as que no|los que no|y los que|los otros/.test(l)) {
    return finding.contrast ?? 'Los otros días no llegaron; ese es el otro lado del mes.'
  }
  // "¿Es casualidad?" → honesto: no afirmo causa, pero los dos van juntos. Contesta
  // la pregunta (sí/no honesto) en vez de esquivar con una frase positiva.
  if (/casualidad|coincidencia|de verdad|en serio/.test(l)) {
    return 'No te lo puedo asegurar: no afirmo causas, solo lo que vi en tus días. Pero los dos se dieron juntos seguido, y por eso vale la pena mirarlo.'
  }
  // "¿En cuántos días pasó?" → el número, directo.
  if (/cu[aá]nto/.test(l)) return `${finding.metric.value} — ${finding.metric.label}.`
  // "No lo había notado" → por qué no se veía (día a día vs mes junto).
  if (/no lo hab[ií]a notado|no me hab/.test(l)) return finding.phrase.caption
  return finding.hypothesis ?? finding.northLink ?? finding.explanation
}

export function FindingChatView({
  finding,
  periodStart,
  periodEnd,
  findingsHash,
  askMetacognition,
  hasMore,
  onSaveReflection,
  onKeepFoco,
  kept,
  onNext,
  onFinish,
  onPickDay,
}: Props) {
  const tint = TINT[finding.category] ?? colors.magenta

  const [log, setLog] = useState<Entry[]>([])
  const [chips, setChips] = useState<string[]>([])
  const [pending, setPending] = useState(true)
  const [phase, setPhase] = useState<Phase>('opening')
  const [metaAnswer, setMetaAnswer] = useState<string | null>(null)
  // La palanca concreta del cierre ("cuida el agua el finde"), para quedársela.
  const [focus, setFocus] = useState<string | null>(null)
  const [openDays, setOpenDays] = useState(false)
  const [bandW, setBandW] = useState(0)
  const pathRef = useRef<string[]>([])
  const mounted = useRef(true)

  const onBand = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w > 0 && Math.abs(w - bandW) > 1) setBandW(w)
  }

  const fInput = {
    id: finding.id,
    subject: finding.subject,
    lead: finding.phrase.lead,
    support: finding.phrase.support,
    northLink: finding.northLink ?? null,
    hypothesis: finding.hypothesis ?? null,
    contrast: finding.contrast ?? null,
    // La palanca del motor: la IA la VISTE en el cierre, no la inventa.
    lever: finding.lever ?? null,
  }

  // Pide un turno de IA y lo agrega (o cae al beat determinístico del turno).
  const aiTurn = async (
    turnIndex: number,
    isFinal: boolean,
    fallbackText: string,
    fallbackVoice: boolean,
  ) => {
    setPending(true)
    const res = await fetchMonthChatTurn({
      periodStart,
      periodEnd,
      findingsHash,
      finding: fInput,
      turnIndex,
      isFinal,
      path: pathRef.current,
    })
    if (!mounted.current) return
    const text = res?.message.text ?? fallbackText
    const voice = res ? res.message.tone === 'accent' : fallbackVoice
    setLog((l) => [...l, { who: 'stelar', text, voice }])
    setChips(isFinal ? [] : res?.chips.length ? res.chips : FALLBACK_CHIPS)
    // El cierre trae la palanca; si la IA no la dio, cae a la palanca DEL MOTOR
    // (determinística, accionable), no a una observación (northLink).
    if (isFinal) setFocus(res?.focus || finding.lever || finding.northLink || finding.subject)
    setPending(false)
  }

  // Arranca (y reinicia al cambiar de hallazgo; el key del padre remonta).
  useEffect(() => {
    mounted.current = true
    setLog([])
    setChips([])
    setPending(true)
    setPhase('opening')
    setMetaAnswer(null)
    setFocus(null)
    setOpenDays(false)
    pathRef.current = []
    // Fallback de apertura = el HECHO (support), no la poesía (fact-led).
    void aiTurn(0, false, finding.phrase.support, false)
    return () => {
      mounted.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finding.id])

  // Chip elegido en un turno de IA — SIEMPRE recibe una respuesta de la IA.
  const onChip = async (label: string) => {
    setLog((l) => [...l, { who: 'user', label }])
    pathRef.current = [...pathRef.current, label]
    setChips([])
    if (phase === 'opening') {
      setPhase('reply1')
      // Fallback CONSCIENTE del chip: contesta lo que preguntó, no un mensaje ciego.
      await aiTurn(1, false, fallbackFor(label, finding), true)
    } else if (phase === 'reply1') {
      if (askMetacognition) {
        // El hero: la IA responde tu 2º chip y LUEGO hace la metacognición.
        setPhase('reply2')
        await aiTurn(2, false, fallbackFor(label, finding), true)
        if (!mounted.current) return
        setPending(true)
        setTimeout(() => {
          if (!mounted.current) return
          setLog((l) => [...l, { who: 'stelar', text: finding.metacognition.question }])
          setPending(false)
          setPhase('meta')
        }, 450)
      } else {
        // Cierre: contesta el 2º chip directo (fallback consciente). La palanca se
        // entrega en el chip "Es tu foco" + la discovery, no encima de la respuesta.
        setPhase('closing')
        await aiTurn(2, true, fallbackFor(label, finding), true)
      }
    }
  }

  // Metacognición (solo hero): se guarda para la continuidad entre meses.
  const onMeta = async (option: { label: string; answer: string }) => {
    onSaveReflection(finding.reflectionKey, option.answer)
    setMetaAnswer(option.answer)
    setLog((l) => [...l, { who: 'user', label: option.label }])
    pathRef.current = [...pathRef.current, option.label]
    setPhase('closing')
    const reply =
      finding.metacognition.replies[option.answer] || 'Ya lo sabes, y saberlo cambia cómo te ves.'
    await aiTurn(3, true, reply, true)
  }

  const showAiChips = (phase === 'opening' || phase === 'reply1') && chips.length > 0 && !pending
  const showMeta = phase === 'meta' && !metaAnswer && !pending
  const showClosing = phase === 'closing' && !pending

  return (
    <View style={styles.wrap}>
      {/* Visual de apertura: el objeto-constelación del hallazgo. */}
      <View style={styles.band} onLayout={onBand}>
        {bandW > 0 ? <FindingConstellation finding={finding} width={bandW} /> : null}
      </View>

      {log.map((e, i) =>
        e.who === 'stelar' ? (
          <Animated.View key={i} entering={FadeInDown.duration(340).springify().damping(18)}>
            <StelarBubble text={e.text} voice={e.voice} />
          </Animated.View>
        ) : (
          <Animated.View key={i} entering={FadeIn.duration(220)}>
            <UserChip label={e.label} />
          </Animated.View>
        ),
      )}

      {pending ? (
        // Siempre los "…" (loop continuo) mientras Stelar escribe. La onda
        // ceremonial de un solo tiro ("Encontrando conexiones…") ya la hace
        // MonthChatSheet al abrir; aquí un one-shot dejaba un hueco en blanco.
        <View style={styles.typingRow}>
          <View style={styles.avatar}>
            <StelarStar size={18} />
          </View>
          <TypingDots />
        </View>
      ) : null}

      {showAiChips ? (
        <Animated.View entering={FadeInDown.duration(320)} style={styles.pillRow}>
          {chips.map((c) => (
            <Pressable
              key={c}
              onPress={() => onChip(c)}
              accessibilityRole="button"
              accessibilityLabel={c}
              style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
            >
              <Text style={styles.pillText}>{c}</Text>
            </Pressable>
          ))}
        </Animated.View>
      ) : null}

      {showMeta ? (
        <Animated.View entering={FadeInDown.duration(320)} style={styles.pillRow}>
          {finding.metacognition.options.map((o) => (
            <Pressable
              key={o.answer}
              onPress={() => onMeta(o)}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
            >
              <Text style={styles.pillText}>{o.label}</Text>
            </Pressable>
          ))}
        </Animated.View>
      ) : null}

      {showClosing ? (
        <Animated.View entering={FadeInDown.duration(360)} style={styles.closing}>
          {finding.evidenceDates.length > 0 ? (
            <View>
              <ChoiceChip
                label="Ver esos días"
                tint={tint}
                onPress={() => setOpenDays((v) => !v)}
              />
              {openDays ? (
                <Animated.View entering={FadeIn.duration(220)} style={styles.dayChips}>
                  {finding.evidenceDates.map((d) => (
                    <Pressable
                      key={d}
                      onPress={() => onPickDay?.(d)}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir ${fmtDate(d)}`}
                      style={({ pressed }) => [
                        styles.dayChip,
                        { borderColor: `${tint}66` },
                        pressed && styles.pillPressed,
                      ]}
                    >
                      <Text style={[styles.dayChipText, { color: tint }]}>{fmtDate(d)}</Text>
                    </Pressable>
                  ))}
                </Animated.View>
              ) : null}
            </View>
          ) : null}
          {/* "Me lo quedo presente": guarda la PALANCA concreta del cierre como
              foco. Sin veredicto, sin contador — solo Stelar recordándola. */}
          {onKeepFoco && focus ? (
            kept ? (
              <Text style={styles.keptNote}>✦ Es tu foco este mes</Text>
            ) : (
              <ChoiceChip
                label="Me lo quedo presente"
                tint={tint}
                onPress={() => onKeepFoco(focus)}
              />
            )
          ) : null}
          {hasMore ? (
            <ChoiceChip label="Ver otro hallazgo" tint={tint} primary onPress={onNext} />
          ) : (
            <ChoiceChip label="Ver mi mes completo" tint={tint} primary onPress={onFinish} />
          )}
        </Animated.View>
      ) : null}
    </View>
  )
}

/* ── Piezas (mismo lenguaje visual que FindingView) ───────────────────── */

function StelarBubble({ text, voice }: { text: string; voice?: boolean }) {
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

function UserChip({ label }: { label: string }) {
  return (
    <View style={styles.userRow}>
      <View style={styles.userChip}>
        <Text style={styles.userChipText}>{label}</Text>
      </View>
    </View>
  )
}

function ChoiceChip({
  label,
  tint,
  primary,
  onPress,
}: {
  label: string
  tint: string
  primary?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.choice,
        primary ? { backgroundColor: tint } : { borderColor: `${tint}66`, borderWidth: 1.5 },
        pressed && styles.pillPressed,
      ]}
    >
      <Text style={[styles.choiceText, primary ? styles.choiceTextPrimary : { color: tint }]}>
        {label}
      </Text>
      {primary ? <Text style={styles.choiceStar}>✦</Text> : null}
    </Pressable>
  )
}

const AV = 32

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  band: { alignSelf: 'stretch', marginBottom: 4 },
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
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginLeft: AV + 8 },
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
  pillPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  pillText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
    color: colors.magentaHot,
  },
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
  closing: { gap: 10, marginLeft: AV + 8 },
  keptNote: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    color: colors.magenta,
    paddingVertical: 6,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    borderRadius: radius.control,
    paddingVertical: 13,
    paddingHorizontal: 18,
    backgroundColor: colors.bgCard,
  },
  choiceText: { fontFamily: typography.uiSemi, fontSize: typography.sizes.bodyLarge },
  choiceTextPrimary: { color: colors.blanco },
  choiceStar: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.bodyLarge,
    color: colors.blanco,
  },
  dayChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 10 },
  dayChip: { borderRadius: radius.pill, borderWidth: 1, paddingVertical: 7, paddingHorizontal: 14 },
  dayChipText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
  },
})
