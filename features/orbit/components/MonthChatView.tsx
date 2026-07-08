import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { colors, radius, shadows, typography } from '@/theme'

import type { ChatBubble, ChatChoice, ChatTopic, ChatTree, MonthChat } from '../month-chat'

/*
 * Órbita Mes IA · la conversación guiada (Release 2). Rediseño tras el
 * feedback de usuaria + uxui + illustrator + product:
 *
 *   · HILO ACUMULADO: cada turno (Stelar y la respuesta de la usuaria) se
 *     QUEDA en pantalla — deja de ser "diapositiva que se reemplaza". Los
 *     turnos viejos se atenúan; solo el vivo respira.
 *   · IDENTIDAD: Stelar habla en ORO desde la izquierda, con su estrella
 *     emisora ✦; la usuaria responde en MAGENTA desde la derecha. Oro = el
 *     cielo; magenta = acción/ella. Nunca se confunde quién habla.
 *   · BOTONES CON JERARQUÍA: primario (magenta sólido + glow + chevron) para
 *     avanzar; secundario (borde vivo + texto magenta) para las ramas
 *     sí/no. "Elige una ✦" marca que es su turno.
 *
 * onSaveReflection persiste la metacognición; onOpenCalendar lleva a la
 * evidencia (el calendario vive abajo en el chasis).
 */

type Props = {
  chat: MonthChat
  onSaveReflection: (questionKey: string, answer: string) => void
  onOpenCalendar: () => void
  /** Intro de la Voz de IA (gpt-4o-mini, cacheada) que EXPLICA los hallazgos.
   *  Si está, reemplaza la intro determinista del picker. */
  aiIntro?: readonly ChatBubble[] | null
}

/** Un turno del hilo: lo que dijo Stelar, o lo que respondió la usuaria. */
type Turn = { who: 'stelar'; bubbles: readonly ChatBubble[] } | { who: 'user'; text: string }

type Flow =
  | { kind: 'picker' }
  | { kind: 'node'; topic: ChatTopic; nodeId: string }
  | { kind: 'done' }

export function MonthChatView({ chat, onSaveReflection, onOpenCalendar, aiIntro }: Props) {
  const introBubbles: readonly ChatBubble[] =
    aiIntro && aiIntro.length > 0 ? aiIntro : (chat.picker?.intro ?? [])

  const [turns, setTurns] = useState<Turn[]>(() => [{ who: 'stelar', bubbles: introBubbles }])
  const [flow, setFlow] = useState<Flow>({ kind: 'picker' })
  // El último turno de Stelar se revela con "pensando"; al terminar, se
  // muestran los botones. `revealed` gatea ese turno.
  const [revealed, setRevealed] = useState(false)
  const onRevealed = useCallback(() => setRevealed(true), [])

  if (!chat.ready || !chat.picker) return <EmptyLearning />

  const say = (bubbles: readonly ChatBubble[]) => {
    setRevealed(false)
    setTurns((t) => [...t, { who: 'stelar', bubbles }])
  }
  const userSays = (text: string) => setTurns((t) => [...t, { who: 'user', text }])

  const pickTopic = (topic: ChatTopic, label: string) => {
    const tree = chat.trees[topic]
    if (!tree) return
    userSays(label)
    const entry = tree.nodes[tree.entry]
    if (entry) {
      setFlow({ kind: 'node', topic, nodeId: tree.entry })
      say(entry.bubbles)
    }
  }

  const chooseInNode = (tree: ChatTree, choice: ChatChoice) => {
    userSays(choice.label)
    if (choice.reflection) onSaveReflection(choice.reflection.questionKey, choice.reflection.answer)
    const a = choice.action
    if (a.kind === 'goto') {
      const next = tree.nodes[a.node]
      if (next) {
        setFlow((f) => (f.kind === 'node' ? { ...f, nodeId: a.node } : f))
        say(next.bubbles)
      }
    } else if (a.kind === 'openCalendar') {
      onOpenCalendar()
      setFlow({ kind: 'done' })
      say([{ text: 'Ahí está, en tu calendario abajo.', tone: 'accent' }])
    } else {
      setFlow({ kind: 'done' })
      say([{ text: 'Aquí quedó. Tu cielo guarda lo que descubriste.', tone: 'accent' }])
    }
  }

  const restart = () => {
    setTurns([{ who: 'stelar', bubbles: introBubbles }])
    setFlow({ kind: 'picker' })
    setRevealed(false)
  }

  // Los botones del turno vivo (solo cuando Stelar terminó de hablar).
  let choices: { label: string; onPress: () => void; primary: boolean }[] = []
  if (flow.kind === 'picker') {
    choices = chat.picker.choices.map((c) => ({
      label: c.label,
      primary: true,
      onPress: () => pickTopic(c.topic, c.label),
    }))
  } else if (flow.kind === 'node') {
    const tree = chat.trees[flow.topic]
    const node = tree?.nodes[flow.nodeId]
    if (tree && node?.choices) {
      choices = node.choices.map((c) => ({
        label: c.label,
        // Primario = avanza (goto/openCalendar); secundario = rama sí/no.
        primary: c.action.kind !== 'end',
        onPress: () => chooseInNode(tree, c),
      }))
    }
  } else {
    choices = [{ label: 'Ver otra cosa', primary: false, onPress: restart }]
  }

  const lastIsStelar = turns[turns.length - 1]?.who === 'stelar'
  const showChoices = choices.length > 0 && (!lastIsStelar || revealed)

  return (
    <View style={styles.wrap}>
      <ConversationHeader />
      <View style={styles.thread}>
        {turns.map((turn, i) => {
          const isLast = i === turns.length - 1
          const dim = !isLast
          if (turn.who === 'user') {
            return (
              <Animated.View key={i} entering={FadeInDown.duration(220)} style={styles.userRow}>
                <View style={[styles.userBubble, dim && styles.dim]}>
                  <Text style={styles.userText}>{turn.text}</Text>
                </View>
              </Animated.View>
            )
          }
          return (
            <StelarTurn
              key={i}
              bubbles={turn.bubbles}
              animate={isLast}
              dim={dim}
              onDone={isLast ? onRevealed : undefined}
            />
          )
        })}
      </View>

      {showChoices ? (
        <Animated.View entering={FadeInDown.duration(400).delay(120)}>
          <Text style={styles.turnHint}>
            {flow.kind === 'picker' ? '¿Por dónde empezamos?' : 'Elige una ✦'}
          </Text>
          <View style={styles.choiceCol}>
            {choices.map((c, i) => (
              <ChoiceButton key={i} label={c.label} primary={c.primary} onPress={c.onPress} />
            ))}
          </View>
        </Animated.View>
      ) : null}
    </View>
  )
}

/* ── Cabecera: quién habla ───────────────────────────────────────────── */

function ConversationHeader() {
  return (
    <View style={styles.header} accessibilityRole="header">
      <StelarStar size={26} />
      <View>
        <Text style={styles.headerName}>Stelar</Text>
        <Text style={styles.headerStatus}>leyendo tu cielo</Text>
      </View>
    </View>
  )
}

/* ── Un turno de Stelar (burbujas con fade escalonado + "pensando") ───── */

function StelarTurn({
  bubbles,
  animate,
  dim,
  onDone,
}: {
  bubbles: readonly ChatBubble[]
  animate: boolean
  dim: boolean
  onDone?: () => void
}) {
  const [shown, setShown] = useState(animate ? 0 : bubbles.length)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    if (!animate) {
      setShown(bubbles.length)
      return
    }
    setShown(0)
    timers.current.forEach(clearTimeout)
    timers.current = []
    for (let i = 0; i < bubbles.length; i++) {
      timers.current.push(setTimeout(() => setShown(i + 1), 450 + i * 560))
    }
    const doneAt = 450 + bubbles.length * 560
    timers.current.push(setTimeout(() => onDone?.(), doneAt))
    return () => timers.current.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, bubbles])

  return (
    <View style={[styles.stelarCol, dim && styles.dim]}>
      {bubbles.slice(0, shown).map((b, i) => (
        <Animated.View
          key={i}
          entering={animate ? FadeInDown.duration(320).springify().damping(18) : undefined}
        >
          <StelarBubble bubble={b} withStar={i === 0} />
        </Animated.View>
      ))}
      {animate && shown < bubbles.length ? <Thinking /> : null}
    </View>
  )
}

function StelarBubble({ bubble, withStar }: { bubble: ChatBubble; withStar: boolean }) {
  const isAccent = bubble.tone === 'accent'
  const isStrong = bubble.tone === 'strong'
  return (
    <View style={styles.stelarRow}>
      <View style={styles.starSlot}>{withStar ? <StelarStar size={20} /> : null}</View>
      <View style={[styles.stelarBubble, isAccent && styles.stelarBubbleAccent]}>
        <Text
          style={[
            styles.stelarText,
            isAccent && styles.stelarAccentText,
            isStrong && styles.stelarStrongText,
          ]}
        >
          {bubble.text}
        </Text>
      </View>
    </View>
  )
}

function Thinking() {
  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.thinkingRow}>
      <View style={styles.starSlot}>
        <StelarStar size={20} />
      </View>
      <View style={styles.thinking}>
        <View style={styles.thinkingStar} />
        <View style={[styles.thinkingStar, styles.thinkingStar2]} />
        <View style={[styles.thinkingStar, styles.thinkingStar3]} />
      </View>
    </Animated.View>
  )
}

/* ── La estrella emisora (asset stelar-voice-star, inline para tinte) ─── */

function StelarStar({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={11} fill={colors.oroVect} opacity={0.05} />
      <Circle cx={12} cy={12} r={7.5} fill={colors.oroVect} opacity={0.1} />
      <Path
        d="M12 5 Q12.7 10.4 17 12 Q12.7 13.6 12 19 Q11.3 13.6 7 12 Q11.3 10.4 12 5 Z"
        fill={colors.oroVect}
      />
      <Path d="M17.4 5.4 L18.6 6.9 L17.4 8.4 L16.2 6.9 Z" fill={colors.oroVect} opacity={0.65} />
      {/* Núcleo cálido fijo — punto de luz vivo (pintura de escena del asset,
          no rol de la paleta). */}
      {/* eslint-disable-next-line no-restricted-syntax */}
      <Circle cx={12} cy={11.7} r={1.5} fill="#FFF6E5" />
    </Svg>
  )
}

/* ── Botones ─────────────────────────────────────────────────────────── */

function ChoiceButton({
  label,
  primary,
  onPress,
}: {
  label: string
  primary: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.choice,
        primary ? styles.choicePrimary : styles.choiceSecondary,
        pressed && (primary ? styles.choicePrimaryPressed : styles.choiceSecondaryPressed),
      ]}
    >
      <Text
        style={[styles.choiceText, primary ? styles.choicePrimaryText : styles.choiceSecondaryText]}
      >
        {label}
      </Text>
      {primary ? <Text style={styles.chevron}>›</Text> : null}
    </Pressable>
  )
}

/* ── Estado vacío ────────────────────────────────────────────────────── */

function EmptyLearning() {
  return (
    <View style={styles.empty}>
      <StelarStar size={30} />
      <Text style={styles.emptyTitle}>Todavía estoy aprendiendo</Text>
      <Text style={styles.emptyBody}>Cuando tenga más días contigo, voy a ver esto más claro.</Text>
    </View>
  )
}

const STAR_SLOT = 26

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  // Cabecera del interlocutor.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  headerName: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    color: colors.oroVect,
    letterSpacing: 0.4,
  },
  headerStatus: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.6,
    color: colors.niebla,
  },
  thread: { gap: 12 },
  dim: { opacity: 0.5 },
  // ── Stelar (izquierda, oro) ──
  stelarCol: { gap: 8 },
  stelarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  starSlot: {
    width: STAR_SLOT,
    alignItems: 'center',
    paddingTop: 8,
  },
  stelarBubble: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.cardLg,
    borderTopLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  stelarBubbleAccent: {
    backgroundColor: colors.oroTint,
    borderColor: colors.oroHairline,
  },
  stelarText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 23,
    color: colors.bone,
  },
  // Voz del coach — Cormorant italic, oro (el cielo, no magenta).
  stelarAccentText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 27,
    color: colors.leche,
  },
  stelarStrongText: {
    fontFamily: typography.displaySemi,
    color: colors.leche,
  },
  // ── Usuaria (derecha, magenta) ──
  userRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: colors.magentaTint2,
    borderRadius: radius.cardLg,
    borderTopRightRadius: 6,
    borderWidth: 1,
    borderColor: colors.magentaGlow,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  userText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  // ── "Pensando" — estrellas oro ──
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  thinking: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  thinkingStar: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.oroVect,
    opacity: 1,
  },
  thinkingStar2: { opacity: 0.6 },
  thinkingStar3: { opacity: 0.3 },
  // ── "Es tu turno" + botones ──
  turnHint: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.oroSoft,
    marginBottom: 10,
    marginLeft: 2,
  },
  choiceCol: { gap: 10 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  // Primario — magenta sólido + glow: la acción que avanza.
  choicePrimary: {
    backgroundColor: colors.magenta,
    ...shadows.ctaMagenta,
  },
  choicePrimaryPressed: {
    backgroundColor: colors.magentaDeep,
    transform: [{ scale: 0.98 }],
  },
  choicePrimaryText: {
    color: colors.blanco,
  },
  chevron: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.bodyLarge,
    color: 'rgba(255,255,255,0.75)',
    marginTop: -2,
  },
  // Secundario — borde vivo + texto magenta: las ramas sí/no.
  choiceSecondary: {
    backgroundColor: colors.magentaTint,
    borderWidth: 1.5,
    borderColor: colors.magentaGlow,
  },
  choiceSecondaryPressed: {
    backgroundColor: colors.magentaTint2,
    transform: [{ scale: 0.98 }],
  },
  choiceSecondaryText: {
    color: colors.magentaHot,
  },
  choiceText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
  },
  // ── Estado vacío ──
  empty: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.niebla,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
})
