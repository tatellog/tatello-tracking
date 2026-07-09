import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { colors, radius, shadows, typography } from '@/theme'

import type { ChatBubble, ChatTopic, MonthChat } from '../month-chat'
import { initialTurns, onNodeChoice, type Flow, type Turn } from '../month-chat-flow'

/*
 * Órbita Mes IA · piezas de la conversación guiada (Release 2). Tras el
 * feedback (los temas parecían un índice, no algo interactivo), el modelo es
 * ANTESALA + SALA:
 *
 *   · ANTESALA (vive en el body de Órbita Mes): `StelarSpeaks` — la identidad
 *     de Stelar (estrella oro ✦ + nombre) y su párrafo de apertura (la Voz de
 *     IA, el gancho a 0 taps). Debajo van los chips de tema (MonthTopicChips).
 *   · SALA (sheet full-screen): `MonthConversation` — al tocar un chip se abre
 *     la conversación de ESE tema, con foco: hilo de burbujas (Stelar oro a la
 *     izquierda, la usuaria magenta a la derecha), "pensando", y los botones de
 *     respuesta. La metacognición persiste; al cerrar se vuelve a la antesala.
 *
 * La lógica de ramificación es pura y testeada (month-chat-flow); aquí solo se
 * renderiza y se despacha.
 */

/* ── Antesala: "Stelar habla" (identidad + apertura) ─────────────────── */

export function StelarSpeaks({ bubbles }: { bubbles: readonly ChatBubble[] }) {
  return (
    <View style={styles.speaks}>
      <ConversationHeader />
      <View style={styles.stelarCol}>
        {bubbles.map((b, i) => (
          <StelarBubble key={i} bubble={b} withStar={i === 0} />
        ))}
      </View>
    </View>
  )
}

/* ── Sala: la conversación de un tema (dentro del sheet) ─────────────── */

type ConversationProps = {
  chat: MonthChat
  topic: ChatTopic
  onSaveReflection: (questionKey: string, answer: string) => void
  onOpenCalendar: () => void
  onClose: () => void
}

export function MonthConversation({
  chat,
  topic,
  onSaveReflection,
  onOpenCalendar,
  onClose,
}: ConversationProps) {
  const tree = chat.trees[topic]
  const entryBubbles = tree?.nodes[tree.entry]?.bubbles ?? []

  const [turns, setTurns] = useState<Turn[]>(() => initialTurns(entryBubbles))
  const [flow, setFlow] = useState<Flow>(() =>
    tree ? { kind: 'node', topic, nodeId: tree.entry } : { kind: 'done' },
  )
  const [revealed, setRevealed] = useState(false)
  const onRevealed = useCallback(() => setRevealed(true), [])

  const applyChoose = useCallback(
    (nodeId: string, choiceIndex: number) => {
      if (!tree) return
      const choice = tree.nodes[nodeId]?.choices?.[choiceIndex]
      if (!choice) return
      const r = onNodeChoice(tree, choice)
      if (r.reflection) onSaveReflection(r.reflection.questionKey, r.reflection.answer)
      if (r.openCalendar) onOpenCalendar()
      setRevealed(false)
      setTurns((t) => [...t, ...r.append])
      setFlow(r.flow)
    },
    [tree, onSaveReflection, onOpenCalendar],
  )

  if (!tree) return null

  // Los botones del turno vivo (cuando Stelar terminó de hablar).
  let choices: { label: string; onPress: () => void; primary: boolean }[] = []
  if (flow.kind === 'node') {
    const nodeId = flow.nodeId
    const node = tree.nodes[nodeId]
    if (node?.choices) {
      choices = node.choices.map((c, ci) => ({
        label: c.label,
        primary: c.action.kind !== 'end',
        onPress: () => applyChoose(nodeId, ci),
      }))
    } else {
      // Nodo terminal (p. ej. el "por qué" del patrón): cierra la sala.
      choices = [{ label: 'Cerrar', primary: false, onPress: onClose }]
    }
  } else {
    choices = [{ label: 'Cerrar', primary: false, onPress: onClose }]
  }

  const lastIsStelar = turns[turns.length - 1]?.who === 'stelar'
  const showChoices = choices.length > 0 && (!lastIsStelar || revealed)

  return (
    <View style={styles.conversation}>
      <View style={styles.thread}>
        {turns.map((turn, i) => {
          const isLast = i === turns.length - 1
          if (turn.who === 'user') {
            return (
              <Animated.View key={i} entering={FadeInDown.duration(220)} style={styles.userRow}>
                <View style={[styles.userBubble, !isLast && styles.dim]}>
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
              dim={!isLast}
              onDone={isLast ? onRevealed : undefined}
            />
          )
        })}
      </View>

      {showChoices ? (
        <Animated.View entering={FadeInDown.duration(400).delay(120)} style={styles.choiceZone}>
          <Text style={styles.turnHint}>Elige una ✦</Text>
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
    timers.current.push(setTimeout(() => onDone?.(), 450 + bubbles.length * 560))
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

const StelarBubble = memo(function StelarBubble({
  bubble,
  withStar,
}: {
  bubble: ChatBubble
  withStar: boolean
}) {
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
})

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

export const StelarStar = memo(function StelarStar({ size }: { size: number }) {
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
})

/* ── Botones de respuesta ────────────────────────────────────────────── */

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

const STAR_SLOT = 26

const styles = StyleSheet.create({
  speaks: { gap: 16 },
  conversation: { gap: 18 },
  // Cabecera del interlocutor.
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
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
  stelarRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  starSlot: { width: STAR_SLOT, alignItems: 'center', paddingTop: 8 },
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
  stelarBubbleAccent: { backgroundColor: colors.oroTint, borderColor: colors.oroHairline },
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
  stelarStrongText: { fontFamily: typography.displaySemi, color: colors.leche },
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
  thinkingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  thinking: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 13 },
  thinkingStar: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.oroVect },
  thinkingStar2: { opacity: 0.6 },
  thinkingStar3: { opacity: 0.3 },
  // ── "Es tu turno" + botones ──
  choiceZone: { gap: 0 },
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
  choicePrimary: { backgroundColor: colors.magenta, ...shadows.ctaMagenta },
  choicePrimaryPressed: { backgroundColor: colors.magentaDeep, transform: [{ scale: 0.98 }] },
  choicePrimaryText: { color: colors.blanco },
  chevron: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.bodyLarge,
    color: 'rgba(255,255,255,0.75)',
    marginTop: -2,
  },
  choiceSecondary: {
    backgroundColor: colors.magentaTint,
    borderWidth: 1.5,
    borderColor: colors.magentaGlow,
  },
  choiceSecondaryPressed: { backgroundColor: colors.magentaTint2, transform: [{ scale: 0.98 }] },
  choiceSecondaryText: { color: colors.magentaHot },
  choiceText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
  },
})
