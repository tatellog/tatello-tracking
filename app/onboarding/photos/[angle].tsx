import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { createElement, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ProgressBar } from '@/features/onboarding/components'
import { CaptureButton } from '@/features/onboarding/photos/components/CaptureButton'
import { SilhouetteRenderer } from '@/features/onboarding/photos/components/SilhouetteRenderer'
import { ThumbnailRow } from '@/features/onboarding/photos/components/ThumbnailRow'
import type { PhotoAngle } from '@/features/onboarding/photos/hooks/usePhotosToday'
import { useTakePhoto } from '@/features/onboarding/photos/hooks/useTakePhoto'
import { confirmBinary, useConfirm } from '@/lib/confirm'
import { colors, typography } from '@/theme'

const PHOTO_ORDER: PhotoAngle[] = ['front', 'side_right', 'side_left', 'back']

type PhotoStepConfig = {
  title: string
  instruction: string
  overlayHint: string
  rotationHint: string | null
}

const PHOTO_CONFIG: Record<PhotoAngle, PhotoStepConfig> = {
  front: {
    title: 'Frente',
    instruction: 'De pie. Brazos relajados a los lados.',
    overlayHint: 'Alinea tu cuerpo con la silueta',
    rotationHint: null,
  },
  side_right: {
    title: 'Lateral derecho',
    instruction: 'Gira 90° a tu derecha.',
    overlayHint: 'Mantén la misma distancia',
    rotationHint: 'Gira 90° →',
  },
  side_left: {
    title: 'Lateral izquierdo',
    instruction: 'Gira 180° más para mostrar tu otro lado.',
    overlayHint: 'Casi terminamos',
    rotationHint: 'Gira 180° ↻',
  },
  back: {
    title: 'Espalda',
    instruction: 'Gira 90° más. Brazos relajados a los lados.',
    overlayHint: 'Misma distancia y altura',
    rotationHint: 'Última →',
  },
}

function nextAngle(angle: PhotoAngle): PhotoAngle | null {
  const idx = PHOTO_ORDER.indexOf(angle)
  return PHOTO_ORDER[idx + 1] ?? null
}

function isValidAngle(v: string | undefined): v is PhotoAngle {
  return PHOTO_ORDER.includes(v as PhotoAngle)
}

export default function PhotoStep() {
  const params = useLocalSearchParams<{ angle?: string; source?: string; single?: string }>()
  const angle = params.angle

  if (!isValidAngle(angle)) {
    return <Redirect href="/onboarding/day-one" />
  }

  return (
    <PhotoCaptureScreen angle={angle} source={params.source} single={params.single === 'true'} />
  )
}

function PhotoCaptureScreen({
  angle,
  source,
  single,
}: {
  angle: PhotoAngle
  source?: string
  single?: boolean
}) {
  const router = useRouter()
  const choose = useConfirm()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const takePhoto = useTakePhoto()

  const [uploadError, setUploadError] = useState<string | null>(null)

  const config = PHOTO_CONFIG[angle]
  const stepNumber = PHOTO_ORDER.indexOf(angle) + 1

  const isWeb = Platform.OS === 'web'

  const finalDestination = source === 'reminder' ? '/(tabs)' : '/onboarding/day-one'

  const onCaptureSuccess = useCallback(() => {
    // Single-slot mode (tap on one slot from Día 1) returns to Día 1
    // straight after the upload — the user wanted just this angle,
    // not the whole walk-through.
    if (single) {
      router.replace('/onboarding/day-one')
      return
    }
    const next = nextAngle(angle)
    if (next) {
      router.replace(`/onboarding/photos/${next}${source ? `?source=${source}` : ''}`)
    } else {
      router.replace(`/onboarding/photos/done${source ? `?source=${source}` : ''}`)
    }
  }, [angle, router, single, source])

  const handleCapturedUri = useCallback(
    async (uri: string) => {
      setUploadError(null)
      try {
        await takePhoto.mutateAsync({ uri, angle })
        onCaptureSuccess()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'No pudimos subir la foto. Intenta otra vez.'
        setUploadError(message)
      }
    },
    [angle, onCaptureSuccess, takePhoto],
  )

  // Native capture path: camera ref → takePictureAsync → upload.
  const handleNativeCapture = useCallback(async () => {
    if (!cameraRef.current) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 })
      if (photo?.uri) await handleCapturedUri(photo.uri)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No pudimos abrir la cámara.'
      setUploadError(message)
    }
  }, [handleCapturedUri])

  const handleSkip = useCallback(async () => {
    const ok = await confirmBinary(choose, {
      title: '¿Saltar las fotos?',
      description:
        'Podrás capturarlas después desde Día 1 o Settings, pero hoy es el "antes" perfecto.',
      confirmLabel: 'Saltar',
      destructive: true,
    })
    if (ok) router.replace(finalDestination)
  }, [choose, finalDestination, router])

  // Native permission gating. Web skips this entirely (file input
  // doesn't need camera permission).
  if (!isWeb) {
    if (!permission) {
      return (
        <View style={styles.fullCenter}>
          <ActivityIndicator color={colors.mauveDeep} />
        </View>
      )
    }
    if (!permission.granted) {
      return <PermissionDeniedView onGrant={requestPermission} />
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <ProgressBar current={stepNumber} total={4} />
        <Text style={styles.eyebrow}>Foto {stepNumber} de 4</Text>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>
          <Text style={styles.titleEmphasis}>{config.title}</Text>
        </Text>
        <Text style={styles.instruction}>{config.instruction}</Text>
      </View>

      <View style={styles.cameraWrap}>
        {isWeb ? (
          <WebCameraSurface onPick={handleCapturedUri} disabled={takePhoto.isPending} />
        ) : (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        )}

        <View pointerEvents="none" style={styles.cornerMarks}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        <View pointerEvents="none" style={styles.silhouetteCenter}>
          <SilhouetteRenderer angle={angle} />
        </View>

        {config.rotationHint ? (
          <View pointerEvents="none" style={styles.rotationHintWrap}>
            <Text style={styles.rotationHint}>{config.rotationHint}</Text>
          </View>
        ) : null}

        <Text pointerEvents="none" style={styles.overlayHint}>
          {config.overlayHint}
        </Text>

        {takePhoto.isPending ? (
          <View pointerEvents="none" style={styles.uploadOverlay}>
            <ActivityIndicator color={colors.pearlBase} />
            <Text style={styles.uploadOverlayText}>Subiendo…</Text>
          </View>
        ) : null}
      </View>

      {uploadError ? <Text style={styles.errorText}>{uploadError}</Text> : null}

      <View style={styles.captureRow}>
        <ThumbnailRow currentStep={stepNumber} />
        {isWeb ? (
          <WebCaptureButton onPick={handleCapturedUri} disabled={takePhoto.isPending} />
        ) : (
          <CaptureButton onPress={handleNativeCapture} disabled={takePhoto.isPending} />
        )}
        <Text style={styles.meta}>
          <Text style={styles.metaNum}>{stepNumber}</Text> de 4
        </Text>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Atrás"
        >
          <Text style={styles.footerLabel}>‹ Atrás</Text>
        </Pressable>
        <Pressable
          onPress={handleSkip}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Saltar"
        >
          <Text style={styles.footerLabel}>Saltar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

function PermissionDeniedView({ onGrant }: { onGrant: () => Promise<unknown> }) {
  return (
    <SafeAreaView style={styles.permSafe} edges={['top', 'bottom']}>
      <View style={styles.permWrap}>
        <Text style={styles.permTitle}>Necesitamos la cámara</Text>
        <Text style={styles.permBody}>
          Para tomar las 4 fotos necesitamos permiso de cámara. Lo usamos solo para esto y las fotos
          quedan privadas en tu cuenta.
        </Text>
        <Pressable
          onPress={() => onGrant().catch(() => {})}
          style={({ pressed }) => [styles.permCta, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.permCtaLabel}>Permitir cámara</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

/* ───────────────────────── Web fallbacks ─────────────────────────────── */

/*
 * Web doesn't have expo-camera's preview. We render a darkened
 * placeholder and rely on a hidden <input type="file" capture> to
 * source the image from the device camera or library. The capture
 * button on web triggers the same input via ref.
 */
function WebCameraSurface({
  onPick,
  disabled,
}: {
  onPick: (uri: string) => void
  disabled: boolean
}): ReactNode {
  return (
    <View style={styles.webCameraSurface}>
      <Text style={styles.webCameraText}>
        {disabled ? 'Subiendo foto…' : 'Toca el botón para abrir la cámara'}
      </Text>
    </View>
  )
}

function WebCaptureButton({
  onPick,
  disabled,
}: {
  onPick: (uri: string) => void
  disabled: boolean
}): ReactNode {
  // Hold the input ref on a useState so the createElement reference
  // can read it imperatively from the Pressable handler.
  const [inputEl, setInputEl] = useState<HTMLInputElement | null>(null)

  // Cleanup any object URLs we hand out.
  const objectUrlRef = useRef<string | null>(null)
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  const onFileChange = (e: { target: HTMLInputElement }) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    onPick(url)
    // Reset so the same file can be picked again later.
    e.target.value = ''
  }

  const hiddenInput = createElement('input', {
    ref: setInputEl,
    type: 'file',
    accept: 'image/*',
    capture: 'environment',
    onChange: onFileChange,
    style: { display: 'none' },
  })

  return (
    <View style={styles.webCaptureWrap}>
      {hiddenInput}
      <CaptureButton
        onPress={() => {
          if (disabled) return
          inputEl?.click()
        }}
        disabled={disabled}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.pearlBase,
  },
  fullCenter: {
    flex: 1,
    backgroundColor: colors.pearlBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    paddingHorizontal: 22,
    paddingTop: 12,
    gap: 12,
  },
  eyebrow: {
    fontFamily: typography.uiSemi,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.labelMuted,
  },
  titleBlock: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 4,
  },
  title: {
    fontFamily: typography.display,
    fontSize: 24,
    letterSpacing: -0.6,
    color: colors.inkPrimary,
  },
  titleEmphasis: {
    fontFamily: typography.displaySemi,
    fontWeight: typography.fontWeight.medium,
    color: colors.mauveDeep,
  },
  instruction: {
    fontFamily: typography.ui,
    fontSize: 12,
    color: colors.labelMuted,
    lineHeight: 17,
  },
  cameraWrap: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.cameraDark,
    overflow: 'hidden',
    position: 'relative',
  },
  webCameraSurface: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.cameraDarkBottom,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webCameraText: {
    fontFamily: typography.uiMedium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  cornerMarks: {
    ...StyleSheet.absoluteFillObject,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  cornerTL: { top: 12, left: 12, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { top: 12, right: 12, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { bottom: 12, left: 12, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { bottom: 12, right: 12, borderBottomWidth: 2, borderRightWidth: 2 },
  silhouetteCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotationHintWrap: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 100,
  },
  rotationHint: {
    fontFamily: typography.uiMedium,
    fontSize: 11,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.95)',
  },
  overlayHint: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    fontFamily: typography.uiMedium,
    fontSize: 11.5,
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 100,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadOverlayText: {
    fontFamily: typography.uiMedium,
    fontSize: 12,
    color: colors.pearlBase,
    letterSpacing: 0.3,
  },
  errorText: {
    paddingHorizontal: 22,
    paddingTop: 6,
    fontFamily: typography.ui,
    fontSize: 12,
    color: colors.feedbackError,
    textAlign: 'center',
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 6,
  },
  webCaptureWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    fontFamily: typography.ui,
    fontSize: 12,
    color: colors.labelMuted,
  },
  metaNum: {
    fontFamily: typography.displayMedium,
    color: colors.inkPrimary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 8,
    paddingTop: 4,
  },
  footerLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 13,
    color: colors.labelMuted,
    letterSpacing: 0.2,
  },
  permSafe: {
    flex: 1,
    backgroundColor: colors.pearlBase,
  },
  permWrap: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  permTitle: {
    fontFamily: typography.display,
    fontSize: 24,
    letterSpacing: -0.6,
    color: colors.inkPrimary,
    textAlign: 'center',
  },
  permBody: {
    fontFamily: typography.ui,
    fontSize: 13,
    lineHeight: 20,
    color: colors.labelMuted,
    textAlign: 'center',
  },
  permCta: {
    marginTop: 8,
    backgroundColor: colors.mauveDeep,
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  permCtaLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 14,
    color: colors.pearlBase,
    letterSpacing: 0.3,
  },
})
