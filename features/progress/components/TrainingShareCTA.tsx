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
      setPhotoUri(result.assets[0].uri)
      setSheetOpen(true)
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

  const handleClose = () => {
    setSheetOpen(false)
    // Discard the local URI on close — the photo lives in Camera Roll
    // only if the user explicitly saved or shared it from the sheet.
    setTimeout(() => setPhotoUri(null), 220)
  }

  return (
    <Animated.View entering={FadeIn.duration(360).delay(320)} style={styles.wrap}>
      <EyebrowLabel tone="magenta" style={styles.eyebrow}>
        Entreno de hoy
      </EyebrowLabel>

      <TouchableOpacity
        style={styles.tile}
        activeOpacity={0.7}
        onPress={choosePhoto}
        accessibilityRole="button"
        accessibilityLabel="Captura tu entreno"
      >
        {photoUri && sheetOpen ? (
          // While the sheet is open, keep the thumbnail of the latest
          // capture so the tile doesn't feel "empty" behind the modal.
          <Image source={{ uri: photoUri }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <PinpointGlyph />
            <Text style={styles.placeholderText}>Captura tu entreno</Text>
            <Text style={styles.placeholderHint}>Para compartirlo</Text>
          </View>
        )}
      </TouchableOpacity>

      {photoUri ? (
        <ProgressShareSheet visible={sheetOpen} onClose={handleClose} variants={shareVariants} />
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 28,
  },
  eyebrow: {
    marginBottom: 10,
  },
  // Wider-than-tall tile — the entreno is a single moment, not a
  // portrait. 16:9-ish so the empty placeholder reads as "frame for a
  // story", not as a profile pic slot.
  tile: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderStyle: 'dashed',
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  placeholderText: {
    fontFamily: typography.uiSemi,
    fontSize: 14,
    color: colors.leche,
    letterSpacing: 0.2,
  },
  placeholderHint: {
    fontFamily: typography.uiMedium,
    fontSize: 11,
    color: colors.niebla,
    letterSpacing: 0.3,
  },
})
