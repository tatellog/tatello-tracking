import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, View, type TextStyle } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { EmText } from '@/components/EmText'
import { colors, typography } from '@/theme'

// Gear glyph — a cog with a hollow core (evenodd cuts the centre).
// Lives in the header as the entry point to Ajustes, which no longer
// occupies a slot in the bottom navigation pill.
const GEAR_PATH =
  'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z'

function GearIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={GEAR_PATH} fill={color} fillRule="evenodd" />
    </Svg>
  )
}

type Props = {
  /** "Hola, Anahí." — uses Hanken 28 px; emphasis word renders Cormorant italic 26 px magenta. */
  greeting?: string
  greetingEmphasis?: string
  /** "Tu comida" — uses Hanken 36 px; emphasis word renders Hanken heavy 36 px magenta. */
  title?: string
  titleEmphasis?: string
  /** Optional metadata pill on the right ("SÁB 27", "30 días", etc.).
   *  When a pill is set it takes the right slot; when it's absent the
   *  slot holds the gear button into Ajustes. The Ajustes screen sets
   *  its own pill, so it never shows a gear pointing back at itself. */
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
  const router = useRouter()
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
      ) : (
        <Pressable
          onPress={() => router.navigate('/settings')}
          hitSlop={10}
          style={styles.settingsBtn}
          accessibilityRole="button"
          accessibilityLabel="Ajustes"
        >
          <GearIcon color={colors.niebla} />
        </Pressable>
      )}
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
    fontSize: typography.sizes.deltaNum,
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
    fontSize: typography.sizes.smallLabel,
    color: colors.bone,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  pillEm: {
    color: colors.magenta,
  },
  // Gear button — a bordered chip echoing the metadata pill, so the
  // right slot reads as one consistent surface across tabs.
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.bruma,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
