import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'

import { colors, radius, typography } from '@/theme'

import type { Finding, FindingCategory } from '../findings'
import { ConfidenceBar } from './ConfidenceBar'
import { DiscoveryWave } from './DiscoveryWave'
import { InsightChart } from './InsightCharts'
import { StelarStar } from './MonthChatView'

/*
 * FindingView — el detalle de un hallazgo como CHAT GUIADO de Stelar (no un
 * reporte de tarjetas apiladas · feedback usuaria: "se siente reporte, no
 * chat"). Stelar habla DE A POCO (burbujas reveladas con "pensando"), NO repite
 * la antesala (profundiza: evidencia de cerca + hipótesis), arriesga ELLA la
 * lectura, y la respuesta de la usuaria colapsa a un chip. Todo determinístico:
 * las burbujas salen del `Finding`, la IA no inventa.
 *
 * Turnos: 1 zoom+evidencia · 2 norte · 3 hipótesis(opt) · 4 "¿ya lo sabías?" →
 * chip · 4b respuesta de Stelar · 5 cierre (ver esos días / otro hallazgo).
 */

type Props = {
  finding: Finding
  onSaveReflection: (questionKey: string, answer: string) => void
  onNext: () => void
  onPickDay?: (date: string) => void
}

const TINT: Record<FindingCategory, string> = {
  deficit: colors.magenta,
  movimiento: colors.dimension.cuerpo,
  sueno: colors.dimension.sueno,
  agua: colors.signal.agua,
  proteina: colors.signal.proteina,
  alimentacion: colors.dimension.alimento,
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDate = (d: string): string =>
  `${Number(d.slice(8, 10))} ${MESES[Number(d.slice(5, 7)) - 1] ?? ''}`

/** Una burbuja de Stelar que se revela: dato=Hanken, voz=Cormorant italic. */
type Beat = { kind: 'bubble'; text: string; voice?: boolean } | { kind: 'chart' }

export function FindingView({ finding, onSaveReflection, onNext, onPickDay }: Props) {
  const tint = TINT[finding.category] ?? colors.magenta

  // Los turnos de Stelar ANTES de la reflexión (profundización, no restatement).
  const beats = useMemo<Beat[]>(() => {
    const b: Beat[] = [{ kind: 'bubble', text: 'Déjame mostrártelo de cerca.' }, { kind: 'chart' }]
    if (finding.northLink) b.push({ kind: 'bubble', text: finding.northLink, voice: true })
    if (finding.hypothesis) b.push({ kind: 'bubble', text: finding.hypothesis, voice: true })
    return b
  }, [finding.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const [shown, setShown] = useState(0)
  const [answer, setAnswer] = useState<string | null>(null)
  const [openDays, setOpenDays] = useState(false)

  // Revela las burbujas de a poco (con "Stelar pensando" entre ellas).
  useEffect(() => {
    setShown(0)
    setAnswer(null)
    setOpenDays(false)
    const timers = beats.map((_, i) => setTimeout(() => setShown(i + 1), 650 + i * 950))
    return () => timers.forEach(clearTimeout)
  }, [finding.id, beats])

  const allShown = shown >= beats.length
  const pick = (a: string) => {
    setAnswer(a)
    onSaveReflection(finding.reflectionKey, a)
  }

  return (
    // Tap para saltar el ritmo y revelar todo lo pendiente.
    <Pressable onPress={() => setShown(beats.length)} style={styles.wrap}>
      {beats.slice(0, shown).map((beat, i) => (
        <Animated.View key={i} entering={FadeInDown.duration(340).springify().damping(18)}>
          {beat.kind === 'chart' ? (
            <View style={styles.evidence}>
              <InsightChart chart={finding.charts[0]!} tint={tint} />
              <ConfidenceBar confidence={finding.confidence} tint={tint} />
            </View>
          ) : (
            <StelarBubble text={beat.text} voice={beat.voice} />
          )}
        </Animated.View>
      ))}

      {!allShown ? <Typing /> : null}

      {/* Reflexión guiada. */}
      {allShown ? (
        <Animated.View entering={FadeInDown.duration(360)} style={styles.reflect}>
          {finding.priorCallback ? <StelarBubble text={finding.priorCallback} voice /> : null}
          <StelarBubble text={finding.metacognition.question} />
          {!answer ? (
            <View style={styles.pillRow}>
              {finding.metacognition.options.map((o) => (
                <Pressable
                  key={o.answer}
                  onPress={() => pick(o.answer)}
                  accessibilityRole="button"
                  accessibilityLabel={o.label}
                  style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
                >
                  <Text style={styles.pillText}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <UserChip
              label={finding.metacognition.options.find((o) => o.answer === answer)?.label ?? ''}
            />
          )}
        </Animated.View>
      ) : null}

      {/* Respuesta de Stelar + cierre. */}
      {answer ? (
        <Animated.View entering={FadeInDown.duration(360)} style={styles.reflect}>
          <StelarBubble text={finding.metacognition.replies[answer] ?? ''} />
          <StelarBubble text="¿Seguimos? Puedo mostrarte más." />
          <View style={styles.closing}>
            {finding.followUps.map((f) =>
              f.kind === 'days' ? (
                <View key={f.label}>
                  <ChoiceChip label={f.label} tint={tint} onPress={() => setOpenDays((v) => !v)} />
                  {openDays ? (
                    <Animated.View entering={FadeIn.duration(220)} style={styles.dayChips}>
                      {f.dates.map((d) => (
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
              ) : (
                <ChoiceChip key={f.label} label={f.label} tint={tint} primary onPress={onNext} />
              ),
            )}
          </View>
        </Animated.View>
      ) : null}
    </Pressable>
  )
}

/* ── Piezas ───────────────────────────────────────────────────────────── */

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

function Typing() {
  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.typingRow}>
      <View style={styles.avatar}>
        <StelarStar size={18} />
      </View>
      <DiscoveryWave width={54} />
    </Animated.View>
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
  // Burbujas de Stelar.
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
  // Evidencia de cerca (chart + consistencia), sin framing defensivo.
  evidence: {
    marginLeft: AV + 8,
    backgroundColor: colors.bgCard,
    borderRadius: radius.cardLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
    padding: 16,
    gap: 14,
  },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  // Reflexión + respuesta.
  reflect: { gap: 12 },
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
  // Respuesta de la usuaria (chip, derecha).
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
  // Cierre.
  closing: { gap: 10, marginLeft: AV + 8 },
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
  choiceText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
  },
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
