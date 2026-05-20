import * as Haptics from 'expo-haptics'
import * as MediaLibrary from 'expo-media-library'
import { useRef, useState, type ReactNode } from 'react'
import {
  Dimensions,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

import { StarLoader } from '@/components/StarLoader'
import { colors, shadows, typography } from '@/theme'

import { CARD_H } from './ProgressShareCard'

const SCREEN_W = Dimensions.get('window').width

/* Write-only Photos permission — enough to save; less invasive than
 * full library access. */
async function ensurePhotoPermission(): Promise<boolean> {
  const current = await MediaLibrary.getPermissionsAsync(true)
  if (current.granted) return true
  const next = await MediaLibrary.requestPermissionsAsync(true)
  return next.granted
}

// ── action icons ────────────────────────────────────────────────────
function InstagramGlyph() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Rect x={3.4} y={3.4} width={17.2} height={17.2} rx={5.2} stroke="#FFFFFF" strokeWidth={2} />
      <Circle cx={12} cy={12} r={4.3} stroke="#FFFFFF" strokeWidth={2} />
      <Circle cx={16.9} cy={7.1} r={1.35} fill="#FFFFFF" />
    </Svg>
  )
}

function SaveGlyph() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.5 V14" stroke={colors.magenta} strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M7.4 9.6 L12 14.3 L16.6 9.6"
        stroke={colors.magenta}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M5 18.6 H19" stroke={colors.magenta} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

function CheckGlyph() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.6 L10 17.4 L19 7.2"
        stroke={colors.magenta}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function ActionButton({
  label,
  primary,
  loading,
  disabled,
  onPress,
  children,
}: {
  label: string
  primary?: boolean
  loading: boolean
  disabled: boolean
  onPress: () => void
  children: ReactNode
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, disabled && styles.actionDim]}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.actionCircle,
          primary ? styles.actionCirclePrimary : styles.actionCircleGhost,
        ]}
      >
        {loading ? <StarLoader size={24} color={primary ? '#FFFFFF' : colors.magenta} /> : children}
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

/** One swipeable card inside the share sheet. The render function
 *  receives `onReady` — call it once the card's photos (or whatever
 *  blocks the capture) have settled, so the action buttons enable. */
export type ShareVariant = {
  id: string
  label: string
  render: (onReady: () => void) => ReactNode
}

type Props = {
  visible: boolean
  onClose: () => void
  /** The cards to display in the carousel. The sheet's chrome (modal,
   *  carousel, dots, save/IG actions) is the same for every flow that
   *  uses it — antes/después, entreno, anything future. Only the
   *  cards change. */
  variants: readonly ShareVariant[]
  /** Optional override for the "loading…" copy shown while the cards'
   *  photos haven't settled yet. */
  loadingLabel?: string
}

type Busy = 'ig' | 'save' | null

/*
 * Generic share flow — a carousel of card variants. Swipe to pick a
 * style, then tap an icon: Instagram (the card is saved to Photos
 * first so it's one tap away in the IG gallery) or just save it.
 *
 * The sheet doesn't know what's INSIDE the cards — it just owns the
 * chrome: modal, close button, horizontal pager, variant dots,
 * Save/Instagram buttons, and the captureRef → MediaLibrary flow.
 * Consumers (BeforeAfterPhotos, TrainingShareCTA, …) supply the
 * cards via `variants`.
 */
export function ProgressShareSheet({ visible, onClose, variants, loadingLabel }: Props) {
  const cardRefs = useRef<(View | null)[]>([])
  const [active, setActive] = useState(0)
  // settled counts the cards whose `onReady` has fired so far. The
  // sheet enables actions only after every variant in the carousel
  // has settled — captureRef of an un-loaded photo yields a blank
  // frame on iOS, so blocking the whole sheet is the safest gate.
  const settledRef = useRef(new Set<string>())
  const [readyCount, setReadyCount] = useState(0)
  const [busy, setBusy] = useState<Busy>(null)
  const [saved, setSaved] = useState(false)

  const onCardReady = (id: string) => {
    if (settledRef.current.has(id)) return
    settledRef.current.add(id)
    setReadyCount(settledRef.current.size)
  }

  const ready = readyCount >= variants.length && variants.length > 0

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActive(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
  }

  const captureActive = async (): Promise<string | null> => {
    const node = cardRefs.current[active]
    if (!node) return null
    return captureRef(node, { format: 'png', quality: 1 })
  }

  const handleSave = async () => {
    if (!ready || busy) return
    setBusy('save')
    try {
      if (!(await ensurePhotoPermission())) {
        return
      }
      const uri = await captureActive()
      if (!uri) return
      await MediaLibrary.saveToLibraryAsync(uri)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setSaved(true)
      setTimeout(() => setSaved(false), 2400)
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
    } finally {
      setBusy(null)
    }
  }

  const handleInstagram = async () => {
    if (!ready || busy) return
    setBusy('ig')
    try {
      const uri = await captureActive()
      if (!uri) return
      // Save first so the card waits in the IG gallery, one tap away.
      if (await ensurePhotoPermission()) {
        await MediaLibrary.saveToLibraryAsync(uri)
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      try {
        await Linking.openURL('instagram://story-camera')
      } catch {
        // Instagram isn't installed — the card is already in Photos.
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
    } finally {
      setBusy(null)
    }
  }

  const actionsDisabled = !ready || busy != null

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={10}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke={colors.bone}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          </TouchableOpacity>
        </View>

        {variants.length > 0 ? (
          <>
            <View style={styles.carouselWrap}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onScrollEnd}
              >
                {variants.map((v, i) => (
                  <View key={v.id} style={styles.page}>
                    <View
                      ref={(el) => {
                        cardRefs.current[i] = el
                      }}
                      collapsable={false}
                    >
                      {v.render(() => onCardReady(v.id))}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.meta}>
              <Text style={styles.variantName}>{variants[active]?.label}</Text>
              <View style={styles.dots}>
                {variants.map((v, i) => (
                  <View key={v.id} style={[styles.dot, i === active && styles.dotOn]} />
                ))}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.loading}>
            <StarLoader size={34} />
            <Text style={styles.loadingText}>{loadingLabel ?? 'Preparando tu tarjeta…'}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <ActionButton
            label="Instagram"
            primary
            loading={busy === 'ig'}
            disabled={actionsDisabled}
            onPress={handleInstagram}
          >
            <InstagramGlyph />
          </ActionButton>
          <ActionButton
            label={saved ? 'Guardada' : 'Guardar'}
            loading={busy === 'save'}
            disabled={actionsDisabled}
            onPress={handleSave}
          >
            {saved ? <CheckGlyph /> : <SaveGlyph />}
          </ActionButton>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 54,
    paddingBottom: 4,
    paddingHorizontal: 22,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  page: {
    width: SCREEN_W,
    height: CARD_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    alignItems: 'center',
    gap: 10,
    paddingBottom: 6,
  },
  variantName: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.bone,
  },
  dots: {
    flexDirection: 'row',
    gap: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bruma,
  },
  dotOn: {
    backgroundColor: colors.magenta,
    width: 18,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    fontFamily: typography.uiMedium,
    fontSize: 13,
    color: colors.niebla,
  },
  // ── action icons ───────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 46,
    paddingTop: 14,
    paddingBottom: 40,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 9,
  },
  actionDim: {
    opacity: 0.4,
  },
  actionCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCirclePrimary: {
    backgroundColor: colors.magenta,
    ...shadows.ctaMagenta,
  },
  actionCircleGhost: {
    backgroundColor: colors.bgCard2,
    borderWidth: 1.5,
    borderColor: colors.magenta,
  },
  actionLabel: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.bone,
  },
})
