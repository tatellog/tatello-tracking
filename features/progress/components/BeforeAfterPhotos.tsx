import { useMemo, useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { EyebrowLabel, type EyebrowTone } from '@/components/EyebrowLabel'
import { useTakePhoto } from '@/features/onboarding/photos/hooks/useTakePhoto'
import type { ProgressPhoto } from '@/features/progress/api'
import { useBeforeAfterPhotos, useMeasurements } from '@/features/progress/hooks'
import {
  computeDelta,
  computeTrend,
  formatTrendCopy,
  toWeightPoints,
} from '@/features/progress/logic'
import { colors, typography } from '@/theme'

import { ProgressShareCard, SHARE_VARIANTS } from './ProgressShareCard'
import { ProgressShareSheet, type ShareVariant } from './ProgressShareSheet'

const MESES_FMT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

function formatDateForCard(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MESES_FMT[d.getMonth()] ?? ''} ${d.getFullYear()}`
}

function formatDeltaForCard(kg: number | undefined): string {
  if (kg == null) return '—'
  if (kg === 0) return '0.0'
  return `${kg < 0 ? '−' : '+'}${Math.abs(kg).toFixed(1)}`
}

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

/* One side of the diptych — an eyebrow, a portrait photo frame and its
 * date. When `onPress` is given the frame is a button: a filled photo
 * re-opens the picker, an empty one shows a "Subir foto" affordance.
 * `uploading` swaps the frame for a spinner while the upload runs. */
function PhotoColumn({
  label,
  tone,
  photo,
  onPress,
  uploading,
}: {
  label: string
  tone: EyebrowTone
  photo: ProgressPhoto | null
  onPress?: () => void
  uploading?: boolean
}) {
  // 3-state render: uploading spinner, full image, or placeholder.
  // The placeholder distinguishes between "no photo yet" (✦ + Subir
  // foto invite) and "photo exists but its URL failed to sign" — that
  // second state shows a soft error so the user doesn't think the
  // upload didn't happen.
  const photoButNoUrl = photo && !photo.signed_url

  const frame = uploading ? (
    <View style={[styles.frame, styles.framePlaceholder]}>
      <ActivityIndicator color={colors.magenta} />
    </View>
  ) : photo?.signed_url ? (
    <View style={styles.frame}>
      <Image source={{ uri: photo.signed_url }} style={styles.img} resizeMode="cover" />
    </View>
  ) : (
    <View style={[styles.frame, styles.framePlaceholder]}>
      {photoButNoUrl ? (
        <>
          <Text style={styles.placeholderStar}>⚠︎</Text>
          <Text style={styles.placeholderError}>No pudimos cargar la foto</Text>
          {onPress ? <Text style={styles.placeholderHint}>Tocá para volver a subir</Text> : null}
        </>
      ) : (
        <>
          <Text style={styles.placeholderStar}>✦</Text>
          {onPress ? <Text style={styles.placeholderHint}>Subir foto</Text> : null}
        </>
      )}
    </View>
  )

  return (
    <View style={styles.col}>
      <EyebrowLabel tone={tone} size={10} style={styles.colLabel}>
        {label}
      </EyebrowLabel>
      {onPress ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Subir foto de ${label.toLowerCase()}`}
        >
          {frame}
        </TouchableOpacity>
      ) : (
        frame
      )}
      <Text style={styles.date}>{photo ? formatDate(photo.taken_at) : 'Pendiente'}</Text>
    </View>
  )
}

/*
 * "Antes y ahora" — the visual twin of the trajectory: the earliest
 * front photo against the latest. Always the full span (not the page
 * range). Empty / single states render the same diptych with dashed
 * placeholders, each tappable to upload a front photo.
 */
export function BeforeAfterPhotos() {
  const { data } = useBeforeAfterPhotos()
  const measurements = useMeasurements(null)
  const takePhoto = useTakePhoto()
  const [shareOpen, setShareOpen] = useState(false)

  // Build the card-config used to feed the generic share sheet. Lives
  // here (not in the sheet) because the data — photo URLs, dates,
  // delta, coach line — is specific to the antes/después flow.
  const shareVariants: ShareVariant[] = useMemo(() => {
    const before = data?.before
    const after = data?.after
    const beforeUrl = before?.signed_url
    const afterUrl = after?.signed_url
    if (!before || !after || !beforeUrl || !afterUrl) return []
    const points = toWeightPoints(measurements.data ?? [])
    const delta = computeDelta(points)
    const trend = computeTrend(points)
    const deltaText = formatDeltaForCard(delta?.abs)
    const coachCopy = trend ? formatTrendCopy(trend) : null
    const beforeDate = formatDateForCard(before.taken_at)
    const afterDate = formatDateForCard(after.taken_at)
    return SHARE_VARIANTS.map((v) => ({
      id: v.id,
      label: v.label,
      render: (onReady: () => void) => (
        <ProgressShareCard
          variant={v.id}
          beforeUrl={beforeUrl}
          afterUrl={afterUrl}
          beforeDate={beforeDate}
          afterDate={afterDate}
          deltaText={deltaText}
          coachCopy={coachCopy}
          onReady={onReady}
        />
      ),
    }))
  }, [data?.before, data?.after, measurements.data])

  if (!data) return null

  // Pick from camera/library, then push it through the shared upload
  // pipeline as a `front` photo — getBeforeAfterPhotos derives the
  // before/after pair from the earliest/latest front photos, so a new
  // upload always lands as the "ahora".
  const pickAndUpload = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Cámara', 'Necesitamos permiso a la cámara para tomar la foto.')
        return
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    if (result.canceled || !result.assets[0]) return
    try {
      await takePhoto.mutateAsync({ uri: result.assets[0].uri, angle: 'front' })
    } catch {
      Alert.alert('Foto', 'No se pudo subir la foto. Inténtalo de nuevo.')
    }
  }

  const choosePhoto = () => {
    const options = ['Tomar foto', 'Elegir de galería', 'Cancelar']
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Foto de progreso', options, cancelButtonIndex: 2 },
      (i) => {
        if (i === 0) void pickAndUpload('camera')
        else if (i === 1) void pickAndUpload('library')
      },
    )
  }

  const canShare = data.count >= 2
  const busy = takePhoto.isPending

  // Section eyebrow + empty-state header. The eyebrow ties this
  // section into the redesigned page architecture (each section
  // declares itself); the body changes by data state.
  return (
    <Animated.View entering={FadeIn.duration(360).delay(360)} style={styles.wrap}>
      <EyebrowLabel tone="magenta" size={10} style={styles.sectionEyebrow}>
        Tu cambio visual
      </EyebrowLabel>

      {/* Empty state — a single invitation card, not two dashed
          placeholders. With zero photos there's no "antes" nor an
          "ahora" yet; forcing the diptych makes the metaphor exist
          before it has any content. One card → one decision. */}
      {data.count === 0 ? (
        <TouchableOpacity
          style={styles.emptyCard}
          activeOpacity={0.7}
          onPress={!busy ? choosePhoto : undefined}
          accessibilityRole="button"
          accessibilityLabel="Empezá con una foto frontal"
        >
          <Text style={styles.emptyStar}>✦</Text>
          <Text style={styles.emptyTitle}>Empezá con una foto frontal</Text>
          <Text style={styles.emptyHint}>Tu próxima marca abre la comparación</Text>
          {busy ? (
            <View style={styles.emptyBusy}>
              <ActivityIndicator color={colors.magenta} />
            </View>
          ) : null}
        </TouchableOpacity>
      ) : (
        <>
          <View style={styles.row}>
            <PhotoColumn
              label="Antes"
              tone="niebla"
              photo={data.before}
              onPress={!busy && (!data.before || !data.before.signed_url) ? choosePhoto : undefined}
              uploading={busy && data.count === 0}
            />
            <Text style={styles.arrow}>→</Text>
            <PhotoColumn
              label="Ahora"
              tone="magenta"
              photo={data.after}
              onPress={!busy ? choosePhoto : undefined}
              uploading={busy && data.count >= 1}
            />
          </View>
          {data.count === 1 ? (
            <Text style={styles.caption}>Tu próxima foto frontal completa el después.</Text>
          ) : null}
        </>
      )}

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
        <ProgressShareSheet
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
          variants={shareVariants}
        />
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // No top margin — the page-level divider in progress.tsx already
  // separates sections. Keeping it here would double the gap.
  wrap: {},
  sectionEyebrow: {
    marginBottom: 14,
  },
  // Single-card empty state shown when count === 0. Wider, friendlier
  // than the dashed diptych — one decision, not two.
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.bruma,
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: colors.bgCard,
    paddingVertical: 36,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  emptyStar: {
    fontSize: 26,
    color: colors.magenta,
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: typography.uiSemi,
    fontSize: 15.5,
    color: colors.leche,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  emptyHint: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13,
    color: colors.niebla,
    textAlign: 'center',
  },
  emptyBusy: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
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
  // The tap affordance — quiet magenta so the empty frame reads as an
  // invitation, not just a void.
  placeholderHint: {
    marginTop: 6,
    fontFamily: typography.uiSemi,
    fontSize: 11,
    color: colors.magenta,
    letterSpacing: 0.3,
  },
  // Shown when the photo row exists but signing failed — distinct
  // from the empty-frame invite so the user understands "upload OK,
  // load failed".
  placeholderError: {
    marginTop: 6,
    paddingHorizontal: 10,
    fontFamily: typography.uiMedium,
    fontSize: 11,
    color: colors.niebla,
    textAlign: 'center',
  },
  // Absolute-fill, not 100%/100%: the frame's height comes from
  // `aspectRatio`, and a percentage-height child of an aspectRatio-sized
  // parent resolves to 0 in Yoga — the image would render invisibly.
  // (The onboarding PhotoCaptureCard fills its frame the same way.)
  img: {
    ...StyleSheet.absoluteFillObject,
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
