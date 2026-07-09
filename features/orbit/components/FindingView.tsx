import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'

import { colors, radius, shadows, typography } from '@/theme'

import type { Finding, FindingCategory, FollowUp } from '../findings'
import { ConfidenceBar } from './ConfidenceBar'
import { InsightChart } from './InsightCharts'

/*
 * FindingView — el detalle de un hallazgo de Órbita Mes como DESCUBRIMIENTO
 * guiado (no chat, no formulario). Una sola experiencia que fluye:
 *   Hero (lo que apareció + confianza + métrica)
 *   → Evidencia (¿por qué Stelar encontró esto? + gráfica mínima)
 *   → Metacognición ramificada (¿lo habías notado? → ¿qué crees que influye?)
 *   → Profundizar (¿cuándo? ¿con qué se relaciona? · otro patrón)
 * Se revela por pasos (nunca todo a la vez). La UI solo renderiza el árbol del
 * Finding; no inventa texto ni preguntas.
 */

type Props = {
  finding: Finding
  onSaveReflection: (questionKey: string, answer: string) => void
  onNext: () => void
}

const TINT: Record<FindingCategory, string> = {
  deficit: colors.magenta,
  movimiento: colors.dimension.cuerpo,
  sueno: colors.dimension.sueno,
  agua: colors.signal.agua,
  proteina: colors.signal.proteina,
  alimentacion: colors.dimension.alimento,
}

export function FindingView({ finding, onSaveReflection, onNext }: Props) {
  const tint = TINT[finding.category] ?? colors.magenta
  // Revelado escalonado: 0 hero · 1 +evidencia · 2 +metacognición.
  const [step, setStep] = useState(0)
  const [notado, setNotado] = useState<string | null>(null)
  const [influye, setInfluye] = useState<string | null>(null)
  const [openObs, setOpenObs] = useState<string | null>(null)

  useEffect(() => {
    setStep(0)
    setNotado(null)
    setInfluye(null)
    setOpenObs(null)
    const t1 = setTimeout(() => setStep(1), 550)
    const t2 = setTimeout(() => setStep(2), 1150)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [finding.id])

  const answerNotado = (answer: string) => {
    setNotado(answer)
    onSaveReflection(finding.reflectionKey, answer)
  }
  const answerInfluye = (answer: string) => {
    setInfluye(answer)
    onSaveReflection(`${finding.reflectionKey}_influye`, answer)
  }

  const mc = finding.metacognition

  return (
    <View style={styles.wrap}>
      {/* ── Hero: lo que apareció ── */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.eyebrow}>Lo que apareció</Text>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{finding.metric.value}</Text>
            <Text style={styles.metricLabel}>{finding.metric.label}</Text>
          </View>
        </View>
        <Text style={styles.title}>{finding.title}</Text>
        <Text style={styles.explanation}>{finding.explanation}</Text>
        <ConfidenceBar confidence={finding.confidence} tint={tint} />
      </View>

      {/* ── Evidencia ── */}
      {step >= 1 ? (
        <Animated.View entering={FadeInDown.duration(420)} style={styles.card}>
          <Text style={styles.cardTitle}>{finding.evidenceTitle}</Text>
          {finding.charts.map((chart, i) => (
            <InsightChart key={i} chart={chart} tint={tint} />
          ))}
        </Animated.View>
      ) : null}

      {/* ── Metacognición guiada (ramifica) ── */}
      {step >= 2 ? (
        <Animated.View entering={FadeInDown.duration(420)} style={styles.section}>
          {finding.priorCallback ? (
            <Text style={styles.priorCallback}>{finding.priorCallback}</Text>
          ) : null}
          <Text style={styles.question}>{mc.question}</Text>
          <Pills options={mc.options} selected={notado} onPick={answerNotado} tint={tint} />

          {notado ? (
            <Animated.View entering={FadeInDown.duration(360)} style={styles.replyBlock}>
              <Text style={styles.reply}>{mc.replies[notado]}</Text>
              {mc.follow ? (
                <>
                  <Text style={styles.question}>{mc.follow.question}</Text>
                  <Pills
                    options={mc.follow.options}
                    selected={influye}
                    onPick={answerInfluye}
                    tint={tint}
                  />
                </>
              ) : null}
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : null}

      {/* ── Profundizar ── */}
      {notado && (!mc.follow || influye) ? (
        <Animated.View entering={FadeInDown.duration(420)} style={styles.section}>
          <Text style={styles.question}>Quiero entender…</Text>
          <View style={styles.followCol}>
            {finding.followUps.map((f) => (
              <FollowUpRow
                key={f.label}
                item={f}
                open={openObs === f.label}
                tint={tint}
                onPress={() => {
                  if (f.kind === 'next') onNext()
                  else setOpenObs((o) => (o === f.label ? null : f.label))
                }}
              />
            ))}
          </View>
        </Animated.View>
      ) : null}
    </View>
  )
}

/* ── Piezas ───────────────────────────────────────────────────────────── */

function Pills({
  options,
  selected,
  onPick,
  tint,
}: {
  options: { label: string; answer: string }[]
  selected: string | null
  onPick: (answer: string) => void
  tint: string
}) {
  return (
    <View style={styles.pillRow}>
      {options.map((o) => {
        const on = selected === o.answer
        const locked = selected != null
        return (
          <Pressable
            key={o.answer}
            onPress={() => (locked ? undefined : onPick(o.answer))}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            style={({ pressed }) => [
              styles.pill,
              on && { backgroundColor: tint, borderColor: tint },
              !on && locked && styles.pillDim,
              pressed && styles.pillPressed,
            ]}
          >
            <Text style={[styles.pillText, on && styles.pillTextOn]}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function FollowUpRow({
  item,
  open,
  tint,
  onPress,
}: {
  item: FollowUp
  open: boolean
  tint: string
  onPress: () => void
}) {
  const isNext = item.kind === 'next'
  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        style={({ pressed }) => [
          styles.follow,
          isNext && { backgroundColor: tint, borderColor: 'transparent', ...shadows.ctaMagenta },
          pressed && styles.followPressed,
        ]}
      >
        <Text style={[styles.followText, isNext && styles.followTextNext]}>{item.label}</Text>
        <Text style={[styles.followMark, isNext && styles.followTextNext]}>
          {isNext ? '✦' : open ? '−' : '+'}
        </Text>
      </Pressable>
      {open && item.kind === 'observation' ? (
        <Animated.Text entering={FadeIn.duration(240)} style={styles.observation}>
          {item.text}
        </Animated.Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  // ── Hero ──
  hero: {
    backgroundColor: colors.bgCard2,
    borderRadius: radius.cardLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
    padding: 20,
    gap: 12,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    paddingTop: 3,
  },
  metric: { alignItems: 'flex-end', maxWidth: '52%' },
  metricValue: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.title,
    color: colors.leche,
  },
  metricLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    textAlign: 'right',
  },
  title: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.displaySm,
    lineHeight: 31,
    color: colors.leche,
  },
  explanation: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 21,
    color: colors.bone,
  },
  // ── Cards ──
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.cardLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
    padding: 18,
    gap: 14,
  },
  cardTitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.heading,
    color: colors.leche,
  },
  // ── Metacognición + profundizar ──
  section: { gap: 12 },
  priorCallback: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroSoft,
  },
  question: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
  },
  replyBlock: { gap: 12, marginTop: 2 },
  reply: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.bone,
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
  pillPressed: { transform: [{ scale: 0.98 }] },
  pillDim: { opacity: 0.4 },
  pillText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
    color: colors.magentaHot,
  },
  pillTextOn: { color: colors.blanco },
  // ── Profundizar ──
  followCol: { gap: 10 },
  follow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    borderRadius: radius.control,
    paddingVertical: 13,
    paddingHorizontal: 18,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
  },
  followPressed: { opacity: 0.85 },
  followText: {
    flex: 1,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  followTextNext: { color: colors.blanco },
  followMark: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroSoft,
    marginLeft: 8,
  },
  observation: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 21,
    color: colors.bone,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
})
