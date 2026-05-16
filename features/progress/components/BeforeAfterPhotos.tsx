import { useState } from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { EyebrowLabel, type EyebrowTone } from '@/components/EyebrowLabel'
import type { ProgressPhoto } from '@/features/progress/api'
import { useBeforeAfterPhotos } from '@/features/progress/hooks'
import { colors, typography } from '@/theme'

import { ProgressShareSheet } from './ProgressShareSheet'

/* iOS-style share glyph — a box with an arrow rising out of it. */
function ShareIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.2 V14.2" stroke={colors.magenta} strokeWidth={1.9} strokeLinecap="round" />
      <Path
        d="M8.2 6.8 L12 3 L15.8 6.8"
        stroke={colors.magenta}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7.6 10 H6 V20.5 H18 V10 H16.4"
        stroke={colors.magenta}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MESES[d.getMonth()] ?? ''} ${d.getFullYear()}`
}

/* One side of the diptych — an eyebrow, a portrait photo frame (or a
 * dashed placeholder when the photo doesn't exist yet) and its date. */
function PhotoColumn({
  label,
  tone,
  photo,
}: {
  label: string
  tone: EyebrowTone
  photo: ProgressPhoto | null
}) {
  return (
    <View style={styles.col}>
      <EyebrowLabel tone={tone} size={10} style={styles.colLabel}>
        {label}
      </EyebrowLabel>
      {photo?.signed_url ? (
        <View style={styles.frame}>
          <Image source={{ uri: photo.signed_url }} style={styles.img} resizeMode="cover" />
        </View>
      ) : (
        <View style={[styles.frame, styles.framePlaceholder]}>
          <Text style={styles.placeholderStar}>✦</Text>
        </View>
      )}
      <Text style={styles.date}>{photo ? formatDate(photo.taken_at) : 'Pendiente'}</Text>
    </View>
  )
}

/*
 * "Antes y ahora" — the visual twin of the trajectory: the earliest
 * front photo against the latest. Always the full span (not the page
 * range). Empty / single states render the same diptych with dashed
 * placeholders so the shape of the journey is always legible.
 */
export function BeforeAfterPhotos() {
  const { data } = useBeforeAfterPhotos()
  const [shareOpen, setShareOpen] = useState(false)
  if (!data) return null

  const caption =
    data.count === 0
      ? 'Tómate una foto frontal para trazar tu antes y después.'
      : data.count === 1
        ? 'Tu próxima foto frontal completará el después.'
        : null
  const canShare = data.count >= 2

  return (
    <Animated.View entering={FadeIn.duration(360).delay(360)} style={styles.wrap}>
      <View style={styles.row}>
        <PhotoColumn label="Antes" tone="niebla" photo={data.before} />
        <Text style={styles.arrow}>→</Text>
        <PhotoColumn label="Ahora" tone="magenta" photo={data.after} />
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}

      {canShare ? (
        <TouchableOpacity
          style={styles.shareBtn}
          activeOpacity={0.6}
          onPress={() => setShareOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Compartir mi cambio"
        >
          <ShareIcon />
          <Text style={styles.shareLabel}>Compartir mi cambio</Text>
        </TouchableOpacity>
      ) : null}

      {canShare ? (
        <ProgressShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} />
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  col: {
    flex: 1,
  },
  colLabel: {
    marginLeft: 2,
    marginBottom: 8,
  },
  // Portrait photo frame — bruma edge so it reads as a defined card.
  frame: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard2,
    overflow: 'hidden',
  },
  framePlaceholder: {
    borderStyle: 'dashed',
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderStar: {
    fontSize: 22,
    color: colors.bruma,
  },
  img: {
    width: '100%',
    height: '100%',
  },
  date: {
    marginTop: 8,
    marginLeft: 2,
    fontFamily: typography.uiMedium,
    fontSize: 12,
    color: colors.niebla,
  },
  // The same gesture as the hero's "76.6 → 75.0".
  arrow: {
    fontFamily: typography.uiBold,
    fontSize: 17,
    color: colors.magenta,
    marginHorizontal: 12,
  },
  caption: {
    marginTop: 12,
    fontFamily: typography.uiMedium,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.bone,
  },
  // Quiet, label-led — discoverable without competing with the photos.
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 7,
    marginTop: 14,
    paddingVertical: 4,
  },
  shareLabel: {
    fontFamily: typography.uiSemi,
    fontSize: 13,
    color: colors.magenta,
  },
})
