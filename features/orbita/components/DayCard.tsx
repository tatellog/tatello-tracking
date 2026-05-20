import { Pressable, StyleSheet, Text, View } from 'react-native'

import { EmText } from '@/components/EmText'
import { colors, typography } from '@/theme'

import type { DiaSemana } from '../mock'

/*
 * The day card under the constellation. Mirrors the selection in the
 * diagram: whichever day is selected, this card shows its one-word
 * archetype, the day's voz, and its en-luz / drift counts. Today gets
 * the extra "Abrir Día" CTA — the bridge into the Día view; past
 * days are purely informational, no CTA.
 */
export function DayCard({ day, onOpenDia }: { day: DiaSemana; onOpenDia: () => void }) {
  const isToday = day.today
  // An empty archetype = the day hasn't arrived yet. The card drops
  // to a quiet single line; no stats, no CTA, no archetype voice.
  const isFuture = day.archetype === ''

  if (isFuture) {
    return (
      <View style={[styles.card, styles.cardFuture]}>
        <Text style={styles.eyebrowMuted}>{day.weekday}</Text>
        <Text style={styles.vozFuture}>{day.note}</Text>
      </View>
    )
  }

  const word = isToday ? 'hoy' : day.weekday.toLowerCase()
  const title = `${word} ${day.archetype}`

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.eyebrow}>
          {isToday ? (
            <>
              <Text style={styles.eyebrowAccent}>Hoy</Text>
              <Text> · {day.weekday}</Text>
            </>
          ) : (
            <Text style={styles.eyebrowAccent}>{day.weekday}</Text>
          )}
        </Text>
        <EmText text={title} emphasis={word} style={styles.title} emStyle={styles.titleAccent} />
        <Text style={styles.voz}>{day.note}</Text>
      </View>
      <View style={styles.right}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumRow}>
              <Text style={styles.statNum}>{day.dimEnLuz}</Text>
              <Text style={styles.statDen}>/6</Text>
            </Text>
            <Text style={styles.statLabel}>En luz</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{day.drift}</Text>
            <Text style={styles.statLabel}>Drift</Text>
          </View>
        </View>
        {isToday ? (
          <Pressable
            onPress={onOpenDia}
            accessibilityRole="button"
            accessibilityLabel="Abrir Día"
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaText}>Abrir Día →</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    gap: 14,
  },
  // A day that hasn't arrived yet — a quieter, shorter card.
  cardFuture: {
    flexDirection: 'column',
    paddingVertical: 18,
    gap: 8,
  },
  eyebrowMuted: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  vozFuture: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 20,
    color: colors.bone,
  },
  // ── Left: the day's identity ──────────────────────────────────
  left: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  eyebrowAccent: {
    color: colors.magenta,
  },
  // The day's mini-archetype — serif italic, the time word in magenta.
  title: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 22,
    lineHeight: 26,
    color: colors.leche,
  },
  titleAccent: {
    color: colors.magenta,
  },
  voz: {
    marginTop: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.bone,
  },
  // ── Right: stats + (today only) CTA ───────────────────────────
  right: {
    alignItems: 'flex-end',
    gap: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  stat: {
    alignItems: 'center',
  },
  statNumRow: {},
  statNum: {
    fontFamily: typography.displayHeavy,
    fontSize: 26,
    color: colors.magenta,
    letterSpacing: -0.6,
  },
  statDen: {
    fontFamily: typography.uiBold,
    fontSize: 13,
    color: colors.niebla,
  },
  statLabel: {
    marginTop: 2,
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  // The CTA — a magenta-outlined button that opens Día.
  cta: {
    borderWidth: 1.4,
    borderColor: colors.magenta,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ctaPressed: {
    backgroundColor: colors.magentaTint,
  },
  ctaText: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.magenta,
  },
})
