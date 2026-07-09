import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { colors, radius, shadows, typography } from '@/theme'

import type { InsightDetail, NextStep, ReflectionOption } from '../month-insight'

/*
 * El DETALLE de un insight de Órbita Mes como LECTURA GUIADA (no chat):
 *   1. "Lo que apareció" — headline + explicación + métrica + barra.
 *   2. Evidencia — línea de días (puntos encendidos/apagados).
 *   3. Reflexión guiada — "¿Lo habías notado?" (pills grandes).
 *   4. Siguiente paso — "¿Qué quieres entender ahora?".
 * Revelado progresivo: la usuaria avanza tocando, sin burbujas desordenadas.
 * El header (título + cerrar) vive en el sheet contenedor.
 */

type Props = {
  detail: InsightDetail
  onSaveReflection: (questionKey: string, answer: string) => void
  onExploreOther: () => void
}

const TINT: Record<string, string> = {
  deficit: colors.magenta,
  sueno: colors.dimension.sueno,
  agua: colors.signal.agua,
  proteina: colors.signal.proteina,
  comida: colors.dimension.alimento,
  cuerpo: colors.dimension.cuerpo,
}
const tintFor = (k: string) => TINT[k] ?? colors.magenta

export function InsightDetailView({ detail, onSaveReflection, onExploreOther }: Props) {
  const tint = tintFor(detail.colorKey)
  const [showEvidence, setShowEvidence] = useState(false)
  const [answered, setAnswered] = useState(false)
  const [openObs, setOpenObs] = useState<string | null>(null)

  const pick = (opt: ReflectionOption) => {
    onSaveReflection(detail.reflectionKey, opt.answer)
    setAnswered(true)
  }

  return (
    <View style={styles.wrap}>
      {/* ── 1 · Lo que apareció ── */}
      <View style={styles.mainCard}>
        <Text style={styles.eyebrow}>Lo que apareció</Text>
        <Text style={styles.headline}>{detail.headline}</Text>
        <Text style={styles.explanation}>{detail.explanation}</Text>
        <ProgressBar value={detail.progress.value} total={detail.progress.total} tint={tint} />
        {detail.secondary ? <Text style={styles.secondary}>{detail.secondary}</Text> : null}
        {!showEvidence ? (
          <Pressable
            onPress={() => setShowEvidence(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaText}>Ver evidencia</Text>
            <Text style={styles.ctaChevron}>›</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ── 2 · Evidencia ── */}
      {showEvidence ? (
        <Animated.View entering={FadeInDown.duration(340)} style={styles.evidenceCard}>
          <DayLine days={detail.evidenceDays} tint={tint} />
          <Text style={styles.caption}>{detail.evidenceCaption}</Text>
        </Animated.View>
      ) : null}

      {/* ── 3 · Reflexión guiada ── */}
      {showEvidence ? (
        <Animated.View entering={FadeInDown.duration(340).delay(120)} style={styles.section}>
          {detail.priorCallback ? (
            <Text style={styles.priorCallback}>{detail.priorCallback}</Text>
          ) : null}
          <Text style={styles.question}>¿Lo habías notado?</Text>
          <View style={styles.pillRow}>
            {detail.reflectionOptions.map((opt) => (
              <ReflectionPill
                key={opt.answer}
                label={opt.label}
                disabled={answered}
                onPress={() => pick(opt)}
              />
            ))}
          </View>
        </Animated.View>
      ) : null}

      {/* ── 4 · Siguiente paso ── */}
      {answered ? (
        <Animated.View entering={FadeInDown.duration(340)} style={styles.section}>
          <Text style={styles.question}>¿Qué quieres entender ahora?</Text>
          <View style={styles.stepCol}>
            {detail.nextSteps.map((step) => (
              <NextStepRow
                key={step.label}
                step={step}
                open={openObs === step.label}
                onPress={() => {
                  if (step.kind === 'explore-other') onExploreOther()
                  else setOpenObs((o) => (o === step.label ? null : step.label))
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

function ProgressBar({ value, total, tint }: { value: number; total: number; tint: string }) {
  const pct = total > 0 ? Math.max(0.04, Math.min(1, value / total)) : 0
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: tint }]} />
    </View>
  )
}

function DayLine({ days, tint }: { days: boolean[]; tint: string }) {
  return (
    <View style={styles.dayLine}>
      {days.map((on, i) => (
        <View key={i} style={[styles.dot, on ? { backgroundColor: tint } : styles.dotOff]} />
      ))}
    </View>
  )
}

function ReflectionPill({
  label,
  disabled,
  onPress,
}: {
  label: string
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.pill,
        pressed && styles.pillPressed,
        disabled && styles.pillDisabled,
      ]}
    >
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  )
}

function NextStepRow({
  step,
  open,
  onPress,
}: {
  step: NextStep
  open: boolean
  onPress: () => void
}) {
  const isExplore = step.kind === 'explore-other'
  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={step.label}
        style={({ pressed }) => [
          styles.step,
          isExplore && styles.stepExplore,
          pressed && styles.stepPressed,
        ]}
      >
        <Text style={[styles.stepText, isExplore && styles.stepExploreText]}>{step.label}</Text>
        <Text style={[styles.stepChevron, isExplore && styles.stepExploreText]}>
          {isExplore ? '✦' : open ? '−' : '+'}
        </Text>
      </Pressable>
      {open && step.kind === 'observation' ? (
        <Animated.Text entering={FadeInDown.duration(260)} style={styles.observation}>
          {step.observation}
        </Animated.Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  // ── Card principal ──
  mainCard: {
    backgroundColor: colors.bgCard2,
    borderRadius: radius.cardLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
    padding: 20,
    gap: 12,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  headline: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.displaySm,
    lineHeight: 30,
    color: colors.leche,
  },
  explanation: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 21,
    color: colors.bone,
  },
  secondary: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    minHeight: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.magenta,
    ...shadows.ctaMagenta,
  },
  ctaPressed: { backgroundColor: colors.magentaDeep, transform: [{ scale: 0.98 }] },
  ctaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
    color: colors.blanco,
  },
  ctaChevron: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.bodyLarge,
    color: 'rgba(255,255,255,0.8)',
    marginTop: -2,
  },
  // ── Evidencia ──
  evidenceCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.cardLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
    padding: 18,
    gap: 12,
  },
  dayLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  dotOff: { backgroundColor: colors.bruma, opacity: 0.5 },
  caption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.niebla,
  },
  // ── Reflexión + siguiente paso ──
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
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    minHeight: 46,
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.magentaTint,
    borderWidth: 1.5,
    borderColor: colors.magentaGlow,
  },
  pillPressed: { backgroundColor: colors.magentaTint2, transform: [{ scale: 0.98 }] },
  pillDisabled: { opacity: 0.4 },
  pillText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
    color: colors.magentaHot,
  },
  // ── Siguiente paso ──
  stepCol: { gap: 10 },
  step: {
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
  stepPressed: { opacity: 0.85 },
  stepExplore: {
    backgroundColor: colors.magenta,
    borderColor: 'transparent',
    ...shadows.ctaMagenta,
  },
  stepText: {
    flex: 1,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  stepExploreText: { color: colors.blanco },
  stepChevron: {
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
    paddingBottom: 2,
  },
})
