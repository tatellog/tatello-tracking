import { StyleSheet, Text } from 'react-native'

import { colors, typography } from '@/theme'

/*
 * The coach voice — one editorial line, serif italic, with at most
 * one magenta-emphasised word. The single home for STELAR's spoken
 * register across tabs: Hoy, Comidas and Progreso all routed their
 * own near-duplicate of this before (different sizes, different
 * alignment), which read as three voices instead of one.
 *
 * Two ways to feed it:
 *   • `text` — a plain sentence (no emphasis).
 *   • `before` / `emphasis` / `after` — a sentence with one word lit.
 *
 * `align` adapts to layout context only (centred under a centred
 * constellation, left elsewhere) — the type scale, colour and
 * emphasis treatment stay fixed so the voice is one voice.
 */
type CoachLineProps = {
  text?: string
  before?: string
  emphasis?: string
  after?: string
  align?: 'left' | 'center'
}

export function CoachLine({ text, before, emphasis, after, align = 'left' }: CoachLineProps) {
  return (
    <Text style={[styles.line, align === 'center' && styles.centered]}>
      {text ?? before}
      {emphasis ? <Text style={styles.emphasis}>{emphasis}</Text> : null}
      {after}
    </Text>
  )
}

const styles = StyleSheet.create({
  line: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 16.5,
    lineHeight: 24,
    color: colors.bone,
    marginTop: 12,
  },
  centered: {
    textAlign: 'center',
    marginHorizontal: 16,
  },
  emphasis: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    color: colors.magenta,
  },
})
