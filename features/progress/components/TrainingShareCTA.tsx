import * as ImagePicker from 'expo-image-picker'
import { useMemo, useState } from 'react'
import {
  ActionSheetIOS,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { useHomeBrief } from '@/features/home/useHomeBrief'
import { useProfile } from '@/features/profile/hooks'
import { ZODIAC, zodiacFromDate } from '@/features/tabs/zodiac'
import { colors, typography } from '@/theme'

import { ProgressShareSheet, type ShareVariant } from './ProgressShareSheet'
import { TRAINING_SHARE_VARIANTS, TrainingShareCard } from './TrainingShareCard'

/* A constellation pinpoint — the same magenta dot used elsewhere in
 * the app to invite a tap on an empty frame. Cheap to draw and reads
 * as "this is a star waiting to be lit", not as a generic icon. */
function PinpointGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4 L12 10 M12 14 L12 20 M4 12 L10 12 M14 12 L20 12"
        stroke={colors.magenta}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path d="M12 12 m-1.6 0 a 1.6 1.6 0 1 0 3.2 0 a 1.6 1.6 0 1 0 -3.2 0" fill={colors.magenta} />
    </Svg>
  )
}

/* iOS-style share glyph — same as the one in BeforeAfterPhotos. */
function ShareIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
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

/* A coach line tuned to where the user is in the 28-day cycle. The
 * intent: the share card celebrates today specifically, not the
 * abstract idea of "training". A line that reflects the user's place
 * in the arc lands harder than a generic congratulation. */
function coachLineForDay(dayCount: number): string {
  if (dayCount <= 1) return 'Una sola estrella encendida ya cambia el cielo.'
  if (dayCount <= 7) return 'El cuerpo recuerda. La constelación empieza a tomar forma.'
  if (dayCount <= 14) return 'Sigues sumando luz. Lo que se repite, se vuelve tuyo.'
  if (dayCount <= 21) return 'Estás dentro del ritmo. Tu cielo ya te reconoce.'
  if (dayCount < 28) return 'Falta poco. El Leo casi se cierra en ti.'
  return 'Constelación completa. Cuerpo y cielo en sincronía.'
}

/*
 * "Captura tu entreno de hoy" — the ephemeral, share-only photo flow
 * for the Progreso tab. Visible only on days the user has marked as
 * trained (today_workout_completed = true).
 *
 * The photo never leaves the user's phone: ImagePicker returns a
 * local URI, the URI is held in component state, the share sheet
 * captures the composed card into the Camera Roll, and when the
 * sheet closes the URI is discarded. STELAR's persistent record of
 * progress is the constellation, not this photo — this is the
 * celebration moment, not a journal entry.
 */
export function TrainingShareCTA() {
  const brief = useHomeBrief()
  const profile = useProfile()
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const sign = useMemo(
    () => zodiacFromDate(profile.data?.date_of_birth),
    [profile.data?.date_of_birth],
  )
  const signLabel = ZODIAC[sign].label

  const dayCount = useMemo(
    () => brief.data?.grid_28_days.filter((c) => c.completed).length ?? 0,
    [brief.data?.grid_28_days],
  )

  const coachCopy = coachLineForDay(dayCount)

  // Build the carousel variants for the entreno flow. The sheet is
  // generic — we just hand it the cards to render. Defined ABOVE the
  // gate so the hook is always called in the same order; an empty
  // photoUri returns an empty array.
  const shareVariants: readonly ShareVariant[] = useMemo(() => {
    if (!photoUri) return []
    return TRAINING_SHARE_VARIANTS.map((v) => ({
      id: v.id,
      label: v.label,
      render: (onReady: () => void) => (
        <TrainingShareCard
          variant={v.id}
          photoUri={photoUri}
          dayCount={dayCount}
          signLabel={signLabel}
          coachCopy={coachCopy}
          onReady={onReady}
        />
      ),
    }))
  }, [photoUri, dayCount, signLabel, coachCopy])

  // Gate: only show this section once the user has marked today as
  // trained. The CTA disappears when the user untoggles or rolls
  // into a new day; by design the card is a celebration of *now*,
  // not an evergreen affordance.
  const trainedToday = brief.data?.today_workout_completed === true
  if (!trainedToday) return null

  const pickAndOpen = async (source: 'camera' | 'library') => {
    if (busy) return
    setBusy(true)
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync()
        if (!perm.granted) {
          Alert.alert('Cámara', 'Necesitamos permiso a la cámara para tomar la foto.')
          return
        }
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.85, mediaTypes: ['images'] })
      if (result.canceled || !result.assets[0]) return
      // Only store the URI — the user opens the share sheet themselves
      // by tapping the preview. Previously this auto-opened the sheet,
      // which meant cancelling the share also discarded the photo.
      setPhotoUri(result.assets[0].uri)
    } finally {
      setBusy(false)
    }
  }

  const choosePhoto = () => {
    const options = ['Tomar foto', 'Elegir de galería', 'Cancelar']
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Tu entreno de hoy', options, cancelButtonIndex: 2 },
      (i) => {
        if (i === 0) void pickAndOpen('camera')
        else if (i === 1) void pickAndOpen('library')
      },
    )
  }

  // Empty-state chip tap → pick a source. Photo state has its own
  // explicit "Compartir entreno" button + Cambiar/Quitar links, so
  // the bare tile in that state only opens the share sheet (no
  // hidden long-press behavior to memorise).
  const handleTilePress = () => {
    if (photoUri) {
      setSheetOpen(true)
    } else {
      choosePhoto()
    }
  }

  // Closing the share sheet keeps the photo as a preview so the user
  // can re-share, change it via the header link, or quitar.
  const handleClose = () => {
    setSheetOpen(false)
  }

  return (
    <Animated.View entering={FadeIn.duration(360).delay(320)} style={styles.wrap}>
      <EyebrowLabel tone="magenta" style={styles.eyebrow}>
        Entreno de hoy
      </EyebrowLabel>

      {photoUri ? (
        // Photo state has 3 visible affordances now (the previous
        // long-press-only menu was undiscoverable):
        //   • Tile = preview (tap also opens share for power users)
        //   • "Cambiar" + "Quitar" → tertiary header links
        //   • "Compartir entreno" → primary button below the tile
        <>
          <View style={styles.photoHeader}>
            <Text style={styles.headerLink} onPress={choosePhoto} suppressHighlighting>
              Cambiar
            </Text>
            <Text style={styles.headerSep}>·</Text>
            <Text style={styles.headerLink} onPress={() => setPhotoUri(null)} suppressHighlighting>
              Quitar
            </Text>
          </View>
          <TouchableOpacity
            style={styles.tilePhoto}
            activeOpacity={0.8}
            onPress={() => setSheetOpen(true)}
            accessibilityRole="image"
            accessibilityLabel="Tu entreno de hoy"
          >
            <Image source={{ uri: photoUri }} style={styles.thumb} resizeMode="contain" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareBtn}
            activeOpacity={0.7}
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Compartir tu entreno"
          >
            <ShareIcon />
            <Text style={styles.shareLabel}>Compartir entreno</Text>
          </TouchableOpacity>
        </>
      ) : (
        // Empty state — compact chip, not a 4:5 tile. Without a photo
        // the section is just an invitation; a dashed monolith eats
        // vertical space without delivering anything.
        <TouchableOpacity
          style={styles.chip}
          activeOpacity={0.7}
          onPress={handleTilePress}
          accessibilityRole="button"
          accessibilityLabel="Captura tu entreno"
        >
          <PinpointGlyph />
          <View style={styles.chipText}>
            <Text style={styles.chipTitle}>Captura tu entreno</Text>
            <Text style={styles.chipHint}>Para compartirlo</Text>
          </View>
        </TouchableOpacity>
      )}

      {photoUri ? (
        <ProgressShareSheet visible={sheetOpen} onClose={handleClose} variants={shareVariants} />
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // The page-level divider in progress.tsx separates sections — no
  // top margin here.
  wrap: {},
  eyebrow: {
    marginBottom: 10,
  },
  // Tertiary actions over the photo tile — discoverable without
  // the hidden long-press menu (which most users never trigger).
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  headerLink: {
    fontFamily: typography.uiSemi,
    fontSize: 12.5,
    color: colors.magenta,
    letterSpacing: 0.2,
    paddingVertical: 4,
  },
  headerSep: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  // Captured photo — 4:5 portrait-leaning tile to fit gym selfies.
  // resizeMode "contain" keeps the full body in frame; letterbox
  // bars (if any) match the dark tile background.
  tilePhoto: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  // Primary share action — same vocabulary as the "Compartir mi
  // cambio" link in BeforeAfterPhotos. Sits below the tile so it
  // doesn't crowd the photo.
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 7,
    marginTop: 12,
    paddingVertical: 4,
  },
  shareLabel: {
    fontFamily: typography.uiSemi,
    fontSize: 13.5,
    color: colors.magenta,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  // Empty-state chip — single row, compact. Replaces the prior 4:5
  // tile-with-placeholder which dominated the screen for a feature
  // that only matters after the user has captured something.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderStyle: 'dashed',
    backgroundColor: colors.bgCard,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  chipText: {
    flex: 1,
  },
  chipTitle: {
    fontFamily: typography.uiSemi,
    fontSize: 14.5,
    color: colors.leche,
    letterSpacing: 0.1,
  },
  chipHint: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.niebla,
    letterSpacing: 0.2,
  },
})
