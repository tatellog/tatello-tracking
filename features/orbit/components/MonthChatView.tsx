import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'

import { colors, radius, typography } from '@/theme'

import type { ChatBubble, ChatChoice, ChatTopic, ChatTree, MonthChat } from '../month-chat'

/*
 * Órbita Mes IA · la conversación guiada (Release 2). Camina el grafo que
 * arma month-chat.ts: el picker de temas → burbujas de Stelar (fade
 * escalonado) → botones que ramifican y guardan metacognición.
 *
 * Premium, no WhatsApp: burbujas suaves con hairline magenta, la voz del
 * coach en Cormorant italic (tone 'accent'), el dato que resalta en
 * SemiBold (tone 'strong'), mucho aire. Sin colas de mensajes: solo el
 * turno actual respira en pantalla.
 *
 * onSaveReflection persiste la respuesta (fire-and-forget); onOpenCalendar
 * lleva a la evidencia (el chasis hace scroll al calendario).
 */

type Props = {
  chat: MonthChat
  onSaveReflection: (questionKey: string, answer: string) => void
  onOpenCalendar: () => void
}

type Stage =
  | { kind: 'picker' }
  | { kind: 'node'; topic: ChatTopic; nodeId: string }
  | { kind: 'done' }

export function MonthChatView({ chat, onSaveReflection, onOpenCalendar }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'picker' })

  if (!chat.ready || !chat.picker) return <EmptyLearning />

  if (stage.kind === 'picker') {
    return (
      <View style={styles.wrap}>
        <BubbleColumn bubbles={chat.picker.intro} />
        <ChoiceRow>
          {chat.picker.choices.map((c) => (
            <ChoiceButton
              key={c.topic}
              label={c.label}
              onPress={() => {
                const tree = chat.trees[c.topic]
                if (tree) setStage({ kind: 'node', topic: c.topic, nodeId: tree.entry })
              }}
            />
          ))}
        </ChoiceRow>
      </View>
    )
  }

  if (stage.kind === 'done') {
    return (
      <View style={styles.wrap}>
        <BubbleColumn
          bubbles={[{ text: 'Aquí quedó. Tu cielo guarda lo que descubriste.', tone: 'accent' }]}
        />
        <ChoiceRow>
          <ChoiceButton label="Ver otra cosa" onPress={() => setStage({ kind: 'picker' })} />
        </ChoiceRow>
      </View>
    )
  }

  const tree: ChatTree | undefined = chat.trees[stage.topic]
  const node = tree?.nodes[stage.nodeId]
  if (!tree || !node) return <EmptyLearning />

  const onChoice = (choice: ChatChoice) => {
    if (choice.reflection) {
      onSaveReflection(choice.reflection.questionKey, choice.reflection.answer)
    }
    const a = choice.action
    if (a.kind === 'goto') setStage({ kind: 'node', topic: stage.topic, nodeId: a.node })
    else if (a.kind === 'openCalendar') {
      onOpenCalendar()
      setStage({ kind: 'done' })
    } else setStage({ kind: 'done' })
  }

  return (
    <View style={styles.wrap} key={`${stage.topic}:${stage.nodeId}`}>
      <BubbleColumn bubbles={node.bubbles} />
      {node.choices ? (
        <ChoiceRow>
          {node.choices.map((c, i) => (
            <ChoiceButton key={i} label={c.label} onPress={() => onChoice(c)} />
          ))}
        </ChoiceRow>
      ) : null}
    </View>
  )
}

/* ── Burbujas — fade escalonado, "Stelar pensando" antes de cada turno ── */

function BubbleColumn({ bubbles }: { bubbles: readonly ChatBubble[] }) {
  // Cada burbuja aparece tras la anterior (~520 ms) → ritmo de habla, no
  // volcado de texto. El indicador de "pensando" precede a la primera.
  const [shown, setShown] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    setShown(0)
    timers.current.forEach(clearTimeout)
    timers.current = []
    for (let i = 0; i < bubbles.length; i++) {
      timers.current.push(setTimeout(() => setShown((n) => Math.max(n, i + 1)), 500 + i * 520))
    }
    return () => timers.current.forEach(clearTimeout)
  }, [bubbles])

  return (
    <View style={styles.column}>
      {bubbles.slice(0, shown).map((b, i) => (
        <Animated.View key={i} entering={FadeInDown.duration(340).springify().damping(18)}>
          <Bubble bubble={b} />
        </Animated.View>
      ))}
      {shown < bubbles.length ? <Thinking /> : null}
    </View>
  )
}

function Bubble({ bubble }: { bubble: ChatBubble }) {
  const isAccent = bubble.tone === 'accent'
  const isStrong = bubble.tone === 'strong'
  return (
    <View style={[styles.bubble, isAccent && styles.bubbleAccent]}>
      <Text
        style={[
          styles.bubbleText,
          isAccent && styles.bubbleAccentText,
          isStrong && styles.bubbleStrongText,
        ]}
      >
        {bubble.text}
      </Text>
    </View>
  )
}

function Thinking() {
  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.thinking}>
      <View style={styles.thinkingDot} />
      <View style={[styles.thinkingDot, styles.thinkingDot2]} />
      <View style={[styles.thinkingDot, styles.thinkingDot3]} />
    </Animated.View>
  )
}

/* ── Botones ─────────────────────────────────────────────────────────── */

function ChoiceRow({ children }: { children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(400).delay(180)} style={styles.choiceRow}>
      {children}
    </Animated.View>
  )
}

function ChoiceButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
    >
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  )
}

/* ── Estado vacío ────────────────────────────────────────────────────── */

function EmptyLearning() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyStar} />
      <Text style={styles.emptyTitle}>Todavía estoy aprendiendo</Text>
      <Text style={styles.emptyBody}>Cuando tenga más días contigo, voy a ver esto más claro.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  column: { gap: 10, alignItems: 'flex-start' },
  // Burbuja de Stelar — alineada a la izquierda, superficie suave + hairline.
  bubble: {
    maxWidth: '90%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    borderTopLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  bubbleAccent: {
    borderColor: colors.magentaTint2,
    backgroundColor: 'rgba(233,30,99,0.05)',
  },
  bubbleText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 23,
    color: colors.bone,
  },
  // Voz del coach — Cormorant italic (la única voz emocional).
  bubbleAccentText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 26,
    color: colors.leche,
  },
  // El dato que resalta.
  bubbleStrongText: {
    fontFamily: typography.displaySemi,
    color: colors.leche,
  },
  thinking: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  thinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.niebla,
    opacity: 0.9,
  },
  thinkingDot2: { opacity: 0.6 },
  thinkingDot3: { opacity: 0.35 },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  choice: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.magentaGlow,
    backgroundColor: colors.magentaTint2,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  choicePressed: { opacity: 0.7 },
  choiceText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
    color: colors.leche,
  },
  // Estado vacío — una estrella tenue + copy honesto.
  empty: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 12,
  },
  emptyStar: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.oroLight,
    opacity: 0.5,
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
