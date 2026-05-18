import { useState } from 'react'
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
  const frame =
    photo?.signed_url && !uploading ? (
      <View style={styles.frame}>
        <Image source={{ uri: photo.signed_url }} style={styles.img} resizeMode="cover" />
      </View>
    ) : (
      <View style={[styles.frame, styles.framePlaceholder]}>
        {uploading ? (
          <ActivityIndicator color={colors.magenta} />
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
  const takePhoto = useTakePhoto()
  const [shareOpen, setShareOpen] = useState(false)
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

  const caption =
    data.count === 0
      ? 'Tómate una foto frontal para trazar tu antes y después.'
      : data.count === 1
        ? 'Tu próxima foto frontal completará el después.'
        : null
  const canShare = data.count >= 2
  const busy = takePhoto.isPending

  return (
    <Animated.View entering={FadeIn.duration(360).delay(360)} style={styles.wrap}>
      <View style={styles.row}>
        <PhotoColumn
          label="Antes"
          tone="niebla"
          photo={data.before}
          // The "antes" is your origin point — only tappable while it's
          // still empty (the very first upload).
          onPress={!busy && !data.before ? choosePhoto : undefined}
          uploading={busy && data.count === 0}
        />
        <Text style={styles.arrow}>→</Text>
        <PhotoColumn
          label="Ahora"
          tone="magenta"
          photo={data.after}
          // The "ahora" is always updatable — each new front photo
          // becomes the latest comparison point.
          onPress={!busy ? choosePhoto : undefined}
          uploading={busy && data.count >= 1}
        />
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
  // The tap affordance — quiet magenta so the empty frame reads as an
  // invitation, not just a void.
  placeholderHint: {
    marginTop: 6,
    fontFamily: typography.uiSemi,
    fontSize: 11,
    color: colors.magenta,
    letterSpacing: 0.3,
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
