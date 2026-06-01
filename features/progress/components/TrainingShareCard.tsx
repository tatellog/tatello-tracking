import { useRef } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import { GLYPH_BY_SIGN } from '@/features/tabs/zodiac/glyphs'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
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
// that lives behind every shareable STELAR card. The brightest tier
// (o > 0.36) gets a bloom halo, echoing the "today" moon of CycleRing.
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

// Pre-split the brightest stars so the bloom layer only paints those.
const BLOOM_STARS = CARD_STARS.filter((st) => st.o > 0.36)

type Props = {
  variant: TrainingShareVariant
  /** Local file URI of the just-captured workout photo. */
  photoUri: string
  /** Number of trained days within the current 28-day cycle. */
  dayCount: number
  /** Sign key — drives the celestial glyph (GLYPH_BY_SIGN). */
  sign: ZodiacSign
  /** "Tu Leo", "Tu Acuario"… — the user's sign label. */
  signLabel: string
  /** One short serif-italic line in the coach voice. */
  coachCopy: string
  /** Fires once the photo has settled — gates the capture. */
  onReady: () => void
}

/* The single workout-photo frame, shared across variants and always
 * 4:5 so the body is never cropped (manifesto: no body-cropping).
 *
 * The photo is shown in `contain` so nothing is clipped; to avoid dead
 * letterbox bars, the same photo sits behind it blurred + `cover` under
 * a dark scrim, so the bars read as a soft bokeh extension of the shot.
 *
 * The chip says "HOY" — the only timestamp the card needs, since the
 * entreno is by definition today's moment. `halo` adds the single soft
 * magenta glow that makes the photo the hero of its variant. */
function PhotoFrame({
  uri,
  halo,
  onSettled,
}: {
  uri: string
  /** When true, the frame carries a soft magenta halo (its variant's hero). */
  halo?: boolean
  onSettled: () => void
}) {
  return (
    <View style={[styles.frame, halo && styles.frameHalo]}>
      {/* Blurred cover backdrop — fills the letterbox so contain has no
          dead bars. */}
      <Image source={{ uri }} style={styles.imgBackdrop} resizeMode="cover" blurRadius={18} />
      <View style={styles.imgScrim} />
      {/* The real, uncropped photo. */}
      <Image
        source={{ uri }}
        style={styles.img}
        resizeMode="contain"
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
 * variants share the celestial bed + brand but rearrange the same
 * pieces (photo, day, sign, coach line). Each variant has ONE hero and
 * keeps magenta to ≤2 accents (brand ✦ + the hero's single touch):
 *
 *   momento — the photo is the hero: large 4:5 with a soft magenta halo.
 *             Sign in leche, day as a quiet gold eyebrow.
 *   cifra   — the count is the hero: magenta number, gold "DÍA" eyebrow.
 *             Photo is a smaller 4:5 with a gold (not magenta) frame.
 *   sello   — the sign is the hero, rendered in serif italic leche with a
 *             gold glow (no magenta on the sign). Photo medium 4:5 keeps
 *             the lone second magenta as a soft halo.
 */
/* The sign's celestial glyph in oro — a constellation emblem, the
 * brand's "tu cielo te reconoce" made into a mark. `glow` adds a soft
 * gold halo (the hero treatment on the sello variant). */
function SignGlyph({ sign, size, glow }: { sign: ZodiacSign; size: number; glow?: boolean }) {
  const Glyph = GLYPH_BY_SIGN[sign]
  return (
    <View style={glow ? styles.glyphGlow : undefined}>
      <Glyph width={size} height={size} color={colors.oro} />
    </View>
  )
}

export function TrainingShareCard({
  variant,
  photoUri,
  dayCount,
  sign,
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
  // Public fraction removed — "N / 28" reads as a comparative goal /
  // countdown, which the manifesto forbids. Day stands on its own.
  const dayLine = `DÍA ${dayCount}`

  return (
    <View style={styles.card}>
      {/* Celestial bed — two asymmetric radial glows for depth. */}
      <Svg style={StyleSheet.absoluteFill} width={TRAINING_CARD_W} height={TRAINING_CARD_H}>
        <Defs>
          {/* Magenta wash, top-right. */}
          <RadialGradient id="tsc-magenta" cx="72%" cy="16%" r="62%">
            <Stop offset="0" stopColor={colors.magenta} stopOpacity="0.20" />
            <Stop offset="0.6" stopColor={colors.magentaDeep} stopOpacity="0.06" />
            <Stop offset="1" stopColor={colors.magentaDeep} stopOpacity="0" />
          </RadialGradient>
          {/* Gold wash, low-left — the observatory light. */}
          <RadialGradient id="tsc-oro" cx="20%" cy="30%" r="60%">
            <Stop offset="0" stopColor={colors.oro} stopOpacity="0.07" />
            <Stop offset="1" stopColor={colors.oro} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width={TRAINING_CARD_W} height={TRAINING_CARD_H} fill="url(#tsc-magenta)" />
        <Rect width={TRAINING_CARD_W} height={TRAINING_CARD_H} fill="url(#tsc-oro)" />

        {/* Bloom under the brightest stars (drawn first, below the body). */}
        {BLOOM_STARS.map((st, i) => (
          <Circle
            key={`bloom-${i}`}
            cx={st.x}
            cy={st.y}
            r={st.r * 2.6}
            fill={colors.leche}
            opacity={st.o * 0.18}
          />
        ))}
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
            {/* Capped width so the 4:5 photo's height leaves room for the
                brand, meta and coach — at full width it overflowed up over
                the STELAR title. */}
            <View style={styles.momentoPhoto}>
              <PhotoFrame uri={photoUri} halo onSettled={handleSettled} />
            </View>
            <View style={styles.meta}>
              <SignGlyph sign={sign} size={30} />
              <Text style={styles.dayEyebrow}>{dayLine}</Text>
              <Text style={styles.signMd}>{signUpper}</Text>
            </View>
          </View>
          <Text style={styles.coach}>{coachCopy}</Text>
        </>
      ) : variant === 'cifra' ? (
        <>
          <View style={styles.middle}>
            <View style={styles.countBlock}>
              <Text style={styles.dayEyebrow}>DÍA</Text>
              <Text style={styles.countHuge}>{dayCount}</Text>
            </View>
            <View style={styles.cifraSign}>
              <SignGlyph sign={sign} size={24} />
              <Text style={styles.signEyebrow}>{signUpper}</Text>
            </View>
            <View style={styles.cifraPhoto}>
              <PhotoFrame uri={photoUri} onSettled={handleSettled} />
            </View>
          </View>
          <Text style={styles.coach}>{coachCopy}</Text>
        </>
      ) : (
        <>
          <View style={styles.middle}>
            <View style={styles.sealHeader}>
              <SignGlyph sign={sign} size={54} glow />
              <Text style={styles.eyebrowMd}>TU</Text>
              <Text style={styles.signHuge}>{signLabel.toUpperCase().replace('TU ', '')}</Text>
              <Text style={styles.dayEyebrow}>{dayLine}</Text>
            </View>
            <View style={styles.sealPhoto}>
              <PhotoFrame uri={photoUri} halo onSettled={handleSettled} />
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
    justifyContent: 'space-between',
    // Clip any content to the card bounds (belt-and-suspenders against a
    // tall photo bleeding past the edge).
    overflow: 'hidden',
  },
  // Momento's photo — capped width so its 4:5 height fits with room for
  // the brand/meta/coach. The hero is still clearly the photo.
  momentoPhoto: {
    width: '80%',
    alignSelf: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    // Stay above the middle block so a tall photo never covers the title.
    zIndex: 2,
    justifyContent: 'center',
    gap: 7,
  },
  brandStar: {
    fontSize: typography.sizes.label,
    color: colors.magenta,
  },
  brandWord: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    letterSpacing: 3,
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
    gap: 22,
  },
  // The workout photo — a fixed 4:5 frame across variants so the body is
  // never cropped. A gold hairline keeps the edge quiet; the magenta voice
  // lives only in the optional halo (the hero's single accent).
  frame: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 16,
    borderWidth: 0.75,
    borderColor: colors.oroHairline,
    backgroundColor: colors.bgCard2,
    overflow: 'hidden',
  },
  // The single soft magenta accent on the hero photo — an exterior glow.
  frameHalo: {
    shadowColor: colors.magenta,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    transform: [{ scale: 1.04 }],
  },
  imgBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  imgScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim,
  },
  img: {
    width: '100%',
    height: '100%',
  },
  chip: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: colors.scrim,
    borderWidth: 0.5,
    borderColor: colors.oroHairline,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
  },
  chipText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.6,
    color: colors.oroLight,
  },
  // Shared gold eyebrow — the quiet day / label tier (no magenta).
  dayEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2.2,
    color: colors.oro,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  signEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2.2,
    color: colors.niebla,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  // Soft gold halo behind the glyph — the hero treatment on sello. The
  // wrapper is small, so the rectangular iOS shadow reads as ambient
  // light, not a box.
  glyphGlow: {
    shadowColor: colors.oro,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  // ── cifra: glyph + sign label, stacked and centred ──
  cifraSign: {
    alignItems: 'center',
    gap: 4,
  },
  // ── momento ────────────────────────────────────────────────────────
  meta: {
    alignItems: 'center',
    gap: 6,
  },
  signMd: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.deltaNum,
    letterSpacing: 4,
    color: colors.leche,
    textAlign: 'center',
  },
  // ── cifra ──────────────────────────────────────────────────────────
  countBlock: {
    alignItems: 'center',
    gap: 2,
  },
  countHuge: {
    fontFamily: typography.displayHeavy,
    fontSize: 84,
    paddingTop: 8,
    paddingBottom: 6,
    color: colors.magenta,
    textAlign: 'center',
  },
  // A smaller 4:5 photo, centred — the count is the hero, not the photo.
  cifraPhoto: {
    alignSelf: 'center',
    width: '46%',
  },
  // ── sello ──────────────────────────────────────────────────────────
  sealHeader: {
    alignItems: 'center',
    gap: 6,
  },
  eyebrowMd: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 4,
    color: colors.niebla,
  },
  // The sign as serif-italic hero with a gold glow behind it — no magenta
  // on the type; the lone second magenta accent is the photo halo below.
  signHuge: {
    // Hanken upright (NOT serif italic): serif italic is reserved for the
    // coach voice, and the coach line on this same card is already italic —
    // reusing it for the sign name would blur that signal. The celestial
    // feel comes from the oro glow + letter-spacing + leche, not italic.
    fontFamily: typography.displayHeavy,
    fontSize: 52,
    letterSpacing: 4,
    color: colors.leche,
    textAlign: 'center',
    textShadowColor: colors.oro,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  sealPhoto: {
    alignSelf: 'center',
    width: '62%',
  },
  // ── coach line ─────────────────────────────────────────────────────
  coach: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.bone,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 14,
  },
})
