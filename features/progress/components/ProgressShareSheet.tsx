import * as Haptics from 'expo-haptics'
import * as MediaLibrary from 'expo-media-library'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Alert,
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
import { useBeforeAfterPhotos, useMeasurements } from '@/features/progress/hooks'
import {
  computeDelta,
  computeTrend,
  formatTrendCopy,
  toWeightPoints,
} from '@/features/progress/logic'
import { colors, shadows, typography } from '@/theme'

import { CARD_H, ProgressShareCard, SHARE_VARIANTS } from './ProgressShareCard'

const SCREEN_W = Dimensions.get('window').width
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MESES[d.getMonth()] ?? ''} ${d.getFullYear()}`
}

function formatDelta(kg: number | undefined): string {
  if (kg == null) return '—'
  if (kg === 0) return '0.0'
  return `${kg < 0 ? '−' : '+'}${Math.abs(kg).toFixed(1)}`
}

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

type Props = {
  visible: boolean
  onClose: () => void
}

type Busy = 'ig' | 'save' | null

/*
 * The share flow — a carousel of card styles. Swipe to pick a style,
 * then tap an icon: Instagram (the card is saved to Photos first so
 * it's one tap away in the IG gallery) or just save it.
 */
export function ProgressShareSheet({ visible, onClose }: Props) {
  const photos = useBeforeAfterPhotos()
  const measurements = useMeasurements(null)

  const cardRefs = useRef<(View | null)[]>([])
  const [active, setActive] = useState(0)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  const [saved, setSaved] = useState(false)

  const { deltaText, coachCopy } = useMemo(() => {
    const points = toWeightPoints(measurements.data ?? [])
    const delta = computeDelta(points)
    const trend = computeTrend(points)
    return {
      deltaText: formatDelta(delta?.abs),
      coachCopy: trend ? formatTrendCopy(trend) : null,
    }
  }, [measurements.data])

  const before = photos.data?.before
  const after = photos.data?.after
  const beforeUrl = before?.signed_url ?? null
  const afterUrl = after?.signed_url ?? null
  const cardReady = beforeUrl != null && afterUrl != null && before != null && after != null

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
        Alert.alert('Permiso necesario', 'Activa el acceso a Fotos para guardar tu tarjeta.')
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

        {cardReady && beforeUrl && afterUrl && before && after ? (
          <>
            <View style={styles.carouselWrap}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onScrollEnd}
              >
                {SHARE_VARIANTS.map((v, i) => (
                  <View key={v.id} style={styles.page}>
                    <View
                      ref={(el) => {
                        cardRefs.current[i] = el
                      }}
                      collapsable={false}
                    >
                      <ProgressShareCard
                        variant={v.id}
                        beforeUrl={beforeUrl}
                        afterUrl={afterUrl}
                        beforeDate={formatDate(before.taken_at)}
                        afterDate={formatDate(after.taken_at)}
                        deltaText={deltaText}
                        coachCopy={coachCopy}
                        onReady={() => setReady(true)}
                      />
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.meta}>
              <Text style={styles.variantName}>{SHARE_VARIANTS[active]?.label}</Text>
              <View style={styles.dots}>
                {SHARE_VARIANTS.map((v, i) => (
                  <View key={v.id} style={[styles.dot, i === active && styles.dotOn]} />
                ))}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.loading}>
            <StarLoader size={34} />
            <Text style={styles.loadingText}>Preparando tu tarjeta…</Text>
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
