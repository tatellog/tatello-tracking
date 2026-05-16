import { StyleSheet, View, type TextStyle } from 'react-native'

import { EmText } from '@/components/EmText'
import { colors, typography } from '@/theme'

type Props = {
  /** "Hola, Anahí." — uses Hanken 28 px; emphasis word renders Cormorant italic 26 px magenta. */
  greeting?: string
  greetingEmphasis?: string
  /** "Tu comida" — uses Hanken 36 px; emphasis word renders Hanken heavy 36 px magenta. */
  title?: string
  titleEmphasis?: string
  /** Optional metadata pill on the right ("SÁB 27", "30 días", etc.).
   *  Tabs that want a clean header (e.g. the daily-ritual Hoy tab,
   *  where minute-level time pulls the user out of contemplation)
   *  omit this prop and only the greeting/title renders. */
  pillLabel?: string
  pillEmphasis?: string
}

export function TabHeader({
  greeting,
  greetingEmphasis,
  title,
  titleEmphasis,
  pillLabel,
  pillEmphasis,
}: Props) {
  return (
    <View style={[styles.row, title ? styles.titleRow : null]}>
      <View style={styles.left}>
        {greeting ? (
          <EmText
            text={greeting}
            emphasis={greetingEmphasis}
            emStyle={styles.italicEmGreeting}
            style={styles.greeting}
          />
        ) : null}
        {title ? (
          <EmText
            text={title}
            emphasis={titleEmphasis}
            emStyle={styles.emTitle}
            style={styles.title}
          />
        ) : null}
      </View>
      {pillLabel ? (
        <View style={styles.pill}>
          <EmText
            text={pillLabel}
            emphasis={pillEmphasis}
            emStyle={styles.pillEm}
            style={styles.pillText}
          />
        </View>
      ) : null}
    </View>
  )
}

const italicEmBase: TextStyle = {
  fontFamily: typography.serifSemi,
  fontStyle: 'italic',
  color: colors.magenta,
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  titleRow: {
    marginBottom: 22,
  },
  left: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    fontFamily: typography.displayHeavy,
    fontSize: 28,
    color: colors.leche,
    letterSpacing: -1.2,
    lineHeight: 30,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: 36,
    color: colors.leche,
    letterSpacing: -1.6,
    lineHeight: 38,
  },
  // Greeting keeps the serif-italic accent; the title emphasis is plain
  // Hanken heavy — the accent is carried by colour, not by face.
  italicEmGreeting: { ...italicEmBase, fontSize: 26 },
  emTitle: {
    fontFamily: typography.displayHeavy,
    fontSize: 36,
    color: colors.magenta,
    letterSpacing: -1.6,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.bruma,
  },
  pillText: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    color: colors.bone,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  pillEm: {
    color: colors.magenta,
  },
})
