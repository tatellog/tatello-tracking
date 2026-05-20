import { LinearGradient } from 'expo-linear-gradient'
import { useRef } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

// Same 9:16 frame as ProgressShareCard so the captured PNG lives in
// the same visual language across the share-sheet carousel.
export const TRAINING_CARD_W = 320
export const TRAINING_CARD_H = Math.round((TRAINING_CARD_W * 16) / 9)

export type TrainingShareVariant = 'momento' | 'cifra' | 'sello'

/** The carousel's variants for the entreno flow, in order. */
export const TRAINING_SHARE_VARIANTS: { id: TrainingShareVariant; label: string }[] = [
  { id: 'momento', label: 'Momento' },
  { id: 'cifra', label: 'Cifra' },
  { id: 'sello', label: 'Sello' },
]

// Seeded starfield with three brightness tiers — the celestial bed
// that lives behind every shareable STELAR card.
const CARD_STARS: { x: number; y: number; r: number; o: number }[] = (() => {
  const arr: { x: number; y: number; r: number; o: number }[] = []
  let s = 77119
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  for (let i = 0; i < 56; i += 1) {
    const b = rand()
    const bright = b > 0.9
    const mid = !bright && b > 0.62
    arr.push({
      x: rand() * TRAINING_CARD_W,
      y: rand() * TRAINING_CARD_H,
      r: bright ? 1.5 + rand() * 0.8 : mid ? 1 + rand() * 0.6 : 0.5 + rand() * 0.6,
      o: bright ? 0.36 + rand() * 0.16 : mid ? 0.2 + rand() * 0.13 : 0.06 + rand() * 0.12,
    })
  }
  return arr
})()

type Props = {
  variant: TrainingShareVariant
  /** Local file URI of the just-captured workout photo. */
  photoUri: string
  /** Number of trained days within the current 28-day cycle. */
  dayCount: number
  /** "Tu Leo", "Tu Acuario"… — the user's sign label. */
  signLabel: string
  /** One short serif-italic line in the coach voice. */
  coachCopy: string
  /** Fires once the photo has settled — gates the capture. */
  onReady: () => void
}

/* The single workout-photo frame, shared across variants. The chip in
 * the corner says "HOY" — the only timestamp the card needs, since
 * the entreno is by definition today's moment. */
function PhotoFrame({
  uri,
  aspect,
  onSettled,
}: {
  uri: string
  aspect: number
  onSettled: () => void
}) {
  return (
    <View style={[styles.frame, { aspectRatio: aspect }]}>
      <Image
        source={{ uri }}
        style={styles.img}
        resizeMode="cover"
        onLoad={onSettled}
        onError={onSettled}
      />
      <View style={styles.chip}>
        <Text style={styles.chipText}>HOY</Text>
      </View>
    </View>
  )
}

/*
 * The shareable training card — a 9:16 Instagram-story image. Three
 * variants share the celestial bed and brand but rearrange the same
 * pieces (photo, day count, sign, coach line):
 *
 *   momento — balanced: photo prominent, then "DÍA N · 28", sign as
 *             a quiet header line, coach line at the bottom.
 *   cifra   — the count huge ("16 / 28"), photo as a smaller strip
 *             beneath. The flex of the cycle, not the photo.
 *   sello   — the sign as visual hero ("TU LEO" big), photo framed
 *             smaller below it. The card reads as a passport stamp.
 */
export function TrainingShareCard({
  variant,
  photoUri,
  dayCount,
  signLabel,
  coachCopy,
  onReady,
}: Props) {
  const settled = useRef(false)
  const handleSettled = () => {
    if (settled.current) return
    settled.current = true
    onReady()
  }

  const signUpper = signLabel.toUpperCase()
  const dayLine = `DÍA ${dayCount} · 28`

  return (
    <View style={styles.card}>
      <LinearGradient colors={[colors.magentaTint2, 'transparent']} style={styles.nebula} />
      <Svg style={StyleSheet.absoluteFill} width={TRAINING_CARD_W} height={TRAINING_CARD_H}>
        {CARD_STARS.map((st, i) => (
          <Circle key={i} cx={st.x} cy={st.y} r={st.r} fill={colors.leche} opacity={st.o} />
        ))}
      </Svg>

      <View style={styles.brand}>
        <Text style={styles.brandStar}>✦</Text>
        <Text style={styles.brandWord}>STELAR</Text>
      </View>

      {variant === 'momento' ? (
        <>
          <View style={styles.middle}>
            <PhotoFrame uri={photoUri} aspect={4 / 5} onSettled={handleSettled} />
            <View style={styles.meta}>
              <EyebrowLabel tone="niebla" size={9.5} style={styles.centered}>
                {dayLine}
              </EyebrowLabel>
              <Text style={styles.signMd}>{signUpper}</Text>
            </View>
          </View>
          <Text style={styles.coach}>{coachCopy}</Text>
        </>
      ) : variant === 'cifra' ? (
        <>
          <View style={styles.middle}>
            <View style={styles.countRow}>
              <Text style={styles.countHuge}>{dayCount}</Text>
              <Text style={styles.countUnit}>/ 28</Text>
            </View>
            <EyebrowLabel tone="niebla" size={9.5} style={styles.centered}>
              {signUpper}
            </EyebrowLabel>
            <View style={styles.strip}>
              <PhotoFrame uri={photoUri} aspect={16 / 9} onSettled={handleSettled} />
            </View>
          </View>
          <Text style={styles.coach}>{coachCopy}</Text>
        </>
      ) : (
        <>
          <View style={styles.middle}>
            <View style={styles.sealHeader}>
              <Text style={styles.eyebrowMd}>TU</Text>
              <Text style={styles.signHuge}>{signLabel.toUpperCase().replace('TU ', '')}</Text>
              <EyebrowLabel tone="magenta" size={9.5} style={styles.centered}>
                {dayLine}
              </EyebrowLabel>
            </View>
            <View style={styles.sealPhoto}>
              <PhotoFrame uri={photoUri} aspect={1} onSettled={handleSettled} />
            </View>
          </View>
          <Text style={styles.coach}>{coachCopy}</Text>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: TRAINING_CARD_W,
    height: TRAINING_CARD_H,
    backgroundColor: colors.bg,
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 26,
  },
  nebula: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TRAINING_CARD_H * 0.6,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  brandStar: {
    fontSize: 12,
    color: colors.magenta,
  },
  brandWord: {
    fontFamily: typography.displayHeavy,
    fontSize: 14,
    color: colors.leche,
    letterSpacing: 3,
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
  },
  // The workout photo — frame shared across variants. Aspect ratio
  // is passed by the caller so each variant can size it differently.
  // Magenta border signals "now / earned", echoing the "Ahora" frame
  // in the antes-y-ahora cards.
  frame: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1.4,
    borderColor: colors.magenta,
    backgroundColor: colors.bgCard2,
    overflow: 'hidden',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  chip: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: colors.magenta,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
  },
  chipText: {
    fontFamily: typography.uiBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: '#FFFFFF',
  },
  centered: {
    textAlign: 'center',
  },
  // ── momento ────────────────────────────────────────────────────────
  meta: {
    marginTop: 22,
    alignItems: 'center',
    gap: 6,
  },
  signMd: {
    fontFamily: typography.displayHeavy,
    fontSize: 28,
    letterSpacing: 4,
    color: colors.leche,
    textAlign: 'center',
  },
  // ── cifra ──────────────────────────────────────────────────────────
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 4,
  },
  countHuge: {
    fontFamily: typography.displayHeavy,
    fontSize: 110,
    paddingTop: 12,
    paddingBottom: 10,
    color: colors.magenta,
    letterSpacing: -5,
  },
  countUnit: {
    fontFamily: typography.displayMedium,
    fontSize: 22,
    color: colors.bone,
    letterSpacing: -0.6,
  },
  strip: {
    marginTop: 30,
    alignSelf: 'center',
    width: 240,
  },
  // ── sello ──────────────────────────────────────────────────────────
  sealHeader: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 26,
  },
  eyebrowMd: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 4,
    color: colors.niebla,
  },
  signHuge: {
    fontFamily: typography.displayHeavy,
    fontSize: 56,
    letterSpacing: 4,
    color: colors.magenta,
    textAlign: 'center',
    marginBottom: 4,
  },
  sealPhoto: {
    alignSelf: 'center',
    width: '78%',
  },
  // ── coach line ─────────────────────────────────────────────────────
  coach: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 19,
    color: colors.bone,
    textAlign: 'center',
  },
})
