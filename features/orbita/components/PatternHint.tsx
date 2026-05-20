import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { EmText } from '@/components/EmText'
import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

import type { Patron } from '../mock'

/*
 * A single-line hint in Semana that surfaces the one multi-week
 * pattern most relevant to today. Honest about scope: the eyebrow
 * leads with the data window ("detectado hace 3 semanas") so the
 * reader knows this isn't drawn from 7 days. Tap → detail screen.
 *
 * The full patterns list lives in Mes — patterns are cross-week by
 * nature, so they belong in the longer view. This chip is just the
 * doorway from the week's reading into that view.
 */
export function PatternHint({ patron }: { patron: Patron }) {
  const router = useRouter()
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/orbita/patron/${patron.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${patron.title}. ${patron.since}`}
    >
      <View style={styles.head}>
        <EyebrowLabel tone="magenta" size={9.5}>
          {patron.since}
        </EyebrowLabel>
        <Text style={styles.cta}>ver patrón →</Text>
      </View>
      <EmText
        text={patron.title}
        emphasis={patron.emphasis}
        style={styles.title}
        emStyle={styles.em}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 22,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cta: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  title: {
    fontFamily: typography.displaySemi,
    fontSize: 18,
    lineHeight: 23,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  em: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 19,
    color: colors.magenta,
  },
})
