import { Fragment, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

type Props = {
  /** Macros after the current plate is logged. */
  projected: { protein: number; calories: number }
  targets: { protein_g: number; calories: number }
  /** Lowercase verb noun: "desayuno" / "comida" / "cena" / "snack". */
  mealLabel: string
}

/*
 * Single-sentence preview of how the day's protein lands once the
 * user saves the current plate. Three flavours of message:
 *   - "cerraste el día" when projected protein hits target.
 *   - "te pasaste por X cal" when protein hit but calories went big.
 *   - "te faltan Xg" otherwise.
 *
 * Hardcoded today; Sprint 4 (LLM) replaces this with model-generated
 * copy informed by the rest of the brief context.
 */
export function FeedbackCard({ projected, targets, mealLabel }: Props) {
  const segments = useMemo(
    () => buildMessage(projected, targets, mealLabel),
    [projected, targets, mealLabel],
  )

  return (
    <View style={styles.card}>
      <Text style={styles.text}>
        {segments.map((seg, i) => (
          <Fragment key={i}>
            {seg.kind === 'strong' ? <Text style={styles.strong}>{seg.text}</Text> : seg.text}
          </Fragment>
        ))}
      </Text>
    </View>
  )
}

type Segment = { kind: 'plain' | 'strong'; text: string }

function buildMessage(
  projected: { protein: number; calories: number },
  targets: { protein_g: number; calories: number },
  mealLabel: string,
): Segment[] {
  const protein = Math.round(projected.protein)
  const calories = Math.round(projected.calories)
  const remaining = Math.max(0, Math.round(targets.protein_g - projected.protein))
  const proteinPct = projected.protein / targets.protein_g
  const calPct = projected.calories / targets.calories

  // Protein closed AND calories within ~5% of target → clean close.
  if (proteinPct >= 1 && calPct <= 1.05) {
    return [
      { kind: 'plain', text: `Después de esta ${mealLabel}: ` },
      { kind: 'strong', text: `${protein}g` },
      { kind: 'plain', text: ' de proteína · ' },
      { kind: 'strong', text: 'cerraste el día' },
      { kind: 'plain', text: '.' },
    ]
  }

  // Protein closed but calories overshot.
  if (proteinPct >= 1 && calPct > 1.05) {
    const overshoot = Math.round(projected.calories - targets.calories)
    return [
      { kind: 'strong', text: 'Cerraste proteína.' },
      {
        kind: 'plain',
        text: ` Te pasaste por ${overshoot} cal — si entrenaste hoy, no pasa nada.`,
      },
    ]
  }

  // Big gap remaining.
  if (remaining > 30) {
    return [
      { kind: 'plain', text: `Después de esta ${mealLabel}: ` },
      { kind: 'strong', text: `${protein}g` },
      { kind: 'plain', text: ' · te faltan ' },
      { kind: 'strong', text: `${remaining}g` },
      { kind: 'plain', text: '.' },
    ]
  }

  // Closing in.
  return [
    { kind: 'plain', text: 'Vas en ' },
    { kind: 'strong', text: `${protein}g` },
    { kind: 'plain', text: ` (${calories} cal) · te faltan ` },
    { kind: 'strong', text: `${remaining}g` },
    { kind: 'plain', text: ' para cerrar.' },
  ]
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(168, 94, 124, 0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  text: {
    fontFamily: typography.ui,
    fontSize: 13,
    lineHeight: 20,
    color: colors.inkPrimary,
    textAlign: 'center',
  },
  strong: {
    fontFamily: typography.uiSemi,
    color: colors.mauveDeep,
  },
})
