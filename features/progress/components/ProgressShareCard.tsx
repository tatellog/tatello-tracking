import { LinearGradient } from 'expo-linear-gradient'
import { useRef } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

// Fixed 9:16 — rendered at this exact size so the capture is
// consistent and fits the share-sheet carousel on any phone.
export const CARD_W = 320
export const CARD_H = Math.round((CARD_W * 16) / 9)

export type ShareVariant = 'cielo' | 'retrato' | 'cifra'

/** The carousel's variants, in order. */
export const SHARE_VARIANTS: { id: ShareVariant; label: string }[] = [
  { id: 'cielo', label: 'Cielo' },
  { id: 'retrato', label: 'Retrato' },
  { id: 'cifra', label: 'Cifra' },
]

// A seeded starfield with three brightness tiers — the celestial bed.
const CARD_STARS: { x: number; y: number; r: number; o: number }[] = (() => {
  const arr = []
  let s = 99173
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  for (let i = 0; i < 56; i += 1) {
    const b = rand()
    const bright = b > 0.9
    const mid = !bright && b > 0.62
    arr.push({
      x: rand() * CARD_W,
      y: rand() * CARD_H,
      r: bright ? 1.5 + rand() * 0.8 : mid ? 1 + rand() * 0.6 : 0.5 + rand() * 0.6,
      o: bright ? 0.36 + rand() * 0.16 : mid ? 0.2 + rand() * 0.13 : 0.06 + rand() * 0.12,
    })
  }
  return arr
})()

type Props = {
  variant: ShareVariant
  beforeUrl: string
  afterUrl: string
  beforeDate: string
  afterDate: string
  deltaText: string
  coachCopy: string | null
  /** Fires once both photos have settled — gates the capture. */
  onReady: () => void
}

function PhotoFrame({ url, now, onSettled }: { url: string; now: boolean; onSettled: () => void }) {
  return (
    <View style={[styles.frame, now && styles.frameNow]}>
      <Image
        source={{ uri: url }}
        style={styles.img}
        resizeMode="cover"
        onLoad={onSettled}
        onError={onSettled}
      />
      <View style={[styles.chip, now ? styles.chipNow : styles.chipBefore]}>
        <Text style={[styles.chipText, now ? styles.chipTextNow : styles.chipTextBefore]}>
          {now ? 'Ahora' : 'Antes'}
        </Text>
      </View>
    </View>
  )
}

/*
 * The shareable progress card — a 9:16 Instagram-story image. Three
 * variants share the celestial bed and brand but rearrange the same
 * pieces (diptych, change, coach line):
 *   cielo   — balanced: photos, then the change, then the coach line.
 *   retrato — photos forward, the change as a compact tag.
 *   cifra   — the change huge, the photos a small strip beneath.
 */
export function ProgressShareCard({
  variant,
  beforeUrl,
  afterUrl,
  beforeDate,
  afterDate,
  deltaText,
  coachCopy,
  onReady,
}: Props) {
  const settled = useRef(0)
  const handleSettled = () => {
    settled.current += 1
    if (settled.current >= 2) onReady()
  }

  const before = <PhotoFrame url={beforeUrl} now={false} onSettled={handleSettled} />
  const after = <PhotoFrame url={afterUrl} now onSettled={handleSettled} />

  return (
    <View style={styles.card}>
      <LinearGradient colors={[colors.magentaTint2, 'transparent']} style={styles.nebula} />
      <Svg style={StyleSheet.absoluteFill} width={CARD_W} height={CARD_H}>
        {CARD_STARS.map((st, i) => (
          <Circle key={i} cx={st.x} cy={st.y} r={st.r} fill={colors.leche} opacity={st.o} />
        ))}
      </Svg>

      <View style={styles.brand}>
        <Text style={styles.brandStar}>✦</Text>
        <Text style={styles.brandWord}>STELAR</Text>
      </View>

      {variant === 'cielo' ? (
        <>
          <View style={styles.middle}>
            <View style={styles.diptych}>
              <View style={styles.col}>
                {before}
                <Text style={styles.date}>{beforeDate}</Text>
              </View>
              <View style={styles.col}>
                {after}
                <Text style={styles.date}>{afterDate}</Text>
              </View>
            </View>
            <View style={styles.deltaRow}>
              <Text style={styles.deltaMd}>{deltaText}</Text>
              <Text style={styles.unitMd}>kg</Text>
            </View>
            <EyebrowLabel tone="niebla" size={9.5} style={styles.centered}>
              Rumbo a tu Andrómeda
            </EyebrowLabel>
          </View>
          {coachCopy ? <Text style={styles.coach}>{coachCopy}</Text> : null}
        </>
      ) : variant === 'retrato' ? (
        <View style={styles.middle}>
          <View style={styles.diptychWide}>
            <View style={styles.col}>{before}</View>
            <View style={styles.col}>{after}</View>
          </View>
          <Text style={styles.rangeLine}>
            {beforeDate} → {afterDate}
          </Text>
          <View style={styles.deltaTag}>
            <Text style={styles.deltaTagText}>{deltaText} kg</Text>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.middle}>
            <View style={styles.deltaRow}>
              <Text style={styles.deltaHuge}>{deltaText}</Text>
              <Text style={styles.unitHuge}>kg</Text>
            </View>
            <EyebrowLabel tone="niebla" size={9.5} style={styles.centered}>
              Rumbo a tu Andrómeda
            </EyebrowLabel>
            <View style={styles.strip}>
              <View style={styles.col}>{before}</View>
              <View style={styles.col}>{after}</View>
            </View>
          </View>
          {coachCopy ? <Text style={styles.coach}>{coachCopy}</Text> : null}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
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
    height: CARD_H * 0.6,
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
  // ── shared photo frame ─────────────────────────────────────────────
  frame: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard2,
    overflow: 'hidden',
  },
  frameNow: {
    borderColor: colors.magenta,
  },
  img: {
    width: '100%',
    height: '100%',
  },
  chip: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
  },
  chipBefore: {
    backgroundColor: colors.bg,
  },
  chipNow: {
    backgroundColor: colors.magenta,
  },
  chipText: {
    fontFamily: typography.uiBold,
    fontSize: 8.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  chipTextBefore: {
    color: colors.bone,
  },
  chipTextNow: {
    color: '#FFFFFF',
  },
  col: {
    flex: 1,
  },
  date: {
    marginTop: 7,
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: 10.5,
    color: colors.niebla,
  },
  centered: {
    marginTop: 3,
    textAlign: 'center',
  },
  // ── cielo ──────────────────────────────────────────────────────────
  diptych: {
    flexDirection: 'row',
    gap: 12,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
    marginTop: 24,
  },
  deltaMd: {
    fontFamily: typography.displayHeavy,
    fontSize: 54,
    paddingTop: 10,
    paddingBottom: 6,
    color: colors.magenta,
    letterSpacing: -2,
  },
  unitMd: {
    fontFamily: typography.displayMedium,
    fontSize: 16,
    color: colors.bone,
  },
  // ── retrato ────────────────────────────────────────────────────────
  diptychWide: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: -6,
  },
  rangeLine: {
    marginTop: 14,
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: 11,
    color: colors.niebla,
  },
  deltaTag: {
    marginTop: 14,
    alignSelf: 'center',
    backgroundColor: colors.magentaTint2,
    borderWidth: 1,
    borderColor: colors.magenta,
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  deltaTagText: {
    fontFamily: typography.displayHeavy,
    fontSize: 18,
    color: colors.magenta,
    letterSpacing: -0.5,
  },
  // ── cifra ──────────────────────────────────────────────────────────
  deltaHuge: {
    fontFamily: typography.displayHeavy,
    fontSize: 88,
    paddingTop: 16,
    paddingBottom: 10,
    color: colors.magenta,
    letterSpacing: -4,
  },
  unitHuge: {
    fontFamily: typography.displayMedium,
    fontSize: 22,
    color: colors.bone,
  },
  strip: {
    flexDirection: 'row',
    gap: 10,
    width: 190,
    alignSelf: 'center',
    marginTop: 30,
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
