import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

import { colors, typography } from '@/theme'

/*
 * Obturador de comida — la cámara in-app para "Agregar comida". Encuadra el
 * platillo y dispara: la foto se entrega a /scan-meal (que la escanea con IA).
 * Tres caminos, como una cámara de captura clásica:
 *   · Galería (izq)  → elige una foto existente → /scan-meal
 *   · Disparar (centro, obturador) → toma la foto → /scan-meal
 *   · Texto (der)    → descríbela y la IA la arma → /scan-meal modo describe
 *
 * Nota: el Simulador de iOS no tiene cámara — el preview saldrá negro ahí;
 * Galería y Texto sí funcionan. Para probar el disparo, usar Expo Go en un
 * dispositivo físico.
 */
export default function CaptureMealScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const [flash, setFlash] = useState<'off' | 'on'>('off')
  const [busy, setBusy] = useState(false)
  const isWeb = Platform.OS === 'web'

  // Reemplaza esta pantalla por /scan-meal: así "atrás" desde scan-meal
  // regresa a Hoy, no a la cámara.
  const goScanWithUri = useCallback(
    (uri: string) => router.replace({ pathname: '/scan-meal', params: { uri } }),
    [router],
  )

  const handleShutter = useCallback(async () => {
    if (!cameraRef.current || busy) return
    setBusy(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 })
      if (photo?.uri) goScanWithUri(photo.uri)
      else setBusy(false)
    } catch {
      setBusy(false)
    }
  }, [busy, goScanWithUri])

  const handleGallery = useCallback(async () => {
    if (busy) return
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      mediaTypes: ['images'],
    })
    if (result.canceled || !result.assets[0]) return
    goScanWithUri(result.assets[0].uri)
  }, [busy, goScanWithUri])

  const handleText = useCallback(() => {
    router.replace({ pathname: '/scan-meal', params: { describe: '1' } })
  }, [router])

  const close = useCallback(() => router.back(), [router])

  // Gating de permiso (nativo). Web no usa CameraView.
  if (!isWeb && permission && !permission.granted) {
    return (
      <PermissionView
        onGrant={() => requestPermission().catch(() => {})}
        onGallery={handleGallery}
        onText={handleText}
        onClose={close}
      />
    )
  }

  return (
    <View style={styles.screen}>
      {!isWeb && permission?.granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={flash === 'on'}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noPreview]}>
          <Text style={styles.noPreviewText}>
            {isWeb ? 'La cámara no está disponible en web.' : ' '}
          </Text>
        </View>
      )}

      {/* Barra superior — cerrar + flash */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <RoundIconButton onPress={close} accessibilityLabel="Cerrar">
          <CloseIcon />
        </RoundIconButton>
        <Text style={styles.topTitle}>Comida</Text>
        {!isWeb && permission?.granted ? (
          <RoundIconButton
            onPress={() => setFlash((f) => (f === 'on' ? 'off' : 'on'))}
            accessibilityLabel={flash === 'on' ? 'Apagar flash' : 'Encender flash'}
            active={flash === 'on'}
          >
            <FlashIcon on={flash === 'on'} />
          </RoundIconButton>
        ) : (
          <View style={styles.iconBtnSpacer} />
        )}
      </View>

      {/* Encuadre tenue al centro */}
      <View pointerEvents="none" style={styles.frameHintWrap}>
        <Text style={styles.frameHint}>Encuadra tu platillo</Text>
      </View>

      {/* Barra inferior — Galería · Obturador · Texto */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 18 }]}>
        <Pressable
          style={styles.sideAction}
          onPress={handleGallery}
          accessibilityRole="button"
          accessibilityLabel="Elegir de la galería"
        >
          <GalleryIcon />
          <Text style={styles.sideLabel}>Galería</Text>
        </Pressable>

        <Pressable
          onPress={handleShutter}
          disabled={busy || isWeb || !permission?.granted}
          accessibilityRole="button"
          accessibilityLabel="Tomar foto"
          style={({ pressed }) => [styles.shutterOuter, pressed && styles.shutterPressed]}
        >
          <View style={styles.shutterInner} />
        </Pressable>

        <Pressable
          style={styles.sideAction}
          onPress={handleText}
          accessibilityRole="button"
          accessibilityLabel="Escribir la comida"
        >
          <TextIcon />
          <Text style={styles.sideLabel}>Texto</Text>
        </Pressable>
      </View>
    </View>
  )
}

/* Vista cuando falta permiso de cámara — deja igual usar Galería o Texto. */
function PermissionView({
  onGrant,
  onGallery,
  onText,
  onClose,
}: {
  onGrant: () => void
  onGallery: () => void
  onText: () => void
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.permScreen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
      <View style={styles.permTop}>
        <RoundIconButton onPress={onClose} accessibilityLabel="Cerrar">
          <CloseIcon />
        </RoundIconButton>
      </View>
      <View style={styles.permBody}>
        <Text style={styles.permTitle}>Necesitamos la cámara</Text>
        <Text style={styles.permText}>
          Para tomar la foto de tu comida necesitamos permiso de cámara. Se usa solo dentro de la
          app.
        </Text>
        <Pressable
          onPress={onGrant}
          style={({ pressed }) => [styles.permCta, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.permCtaText}>Permitir cámara</Text>
        </Pressable>
        <View style={styles.permAlt}>
          <Pressable onPress={onGallery} hitSlop={10} accessibilityRole="button">
            <Text style={styles.permAltText}>Elegir de la galería</Text>
          </Pressable>
          <Text style={styles.permAltDot}>·</Text>
          <Pressable onPress={onText} hitSlop={10} accessibilityRole="button">
            <Text style={styles.permAltText}>Escribir</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

/* ── Botón redondo translúcido (cerrar / flash) ─────────────────────── */
function RoundIconButton({
  children,
  onPress,
  accessibilityLabel,
  active,
}: {
  children: React.ReactNode
  onPress: () => void
  accessibilityLabel: string
  active?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.iconBtn,
        active && styles.iconBtnActive,
        pressed && { opacity: 0.7 },
      ]}
    >
      {children}
    </Pressable>
  )
}

/* ── Iconos (SVG inline, tintables) ─────────────────────────────────── */
function CloseIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M6 6 L18 18 M18 6 L6 18"
        stroke={colors.leche}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  )
}
function FlashIcon({ on }: { on: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M13 2 L4 14 H11 L10 22 L20 9 H13 Z"
        fill={on ? colors.oroLight : 'none'}
        stroke={on ? colors.oroLight : colors.leche}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  )
}
function GalleryIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Rect
        x={3}
        y={4}
        width={18}
        height={16}
        rx={3}
        stroke={colors.leche}
        strokeWidth={1.7}
        fill="none"
      />
      <Circle cx={8.5} cy={9} r={1.6} fill={colors.leche} />
      <Path
        d="M5 18 L10 12.5 L13.5 16 L16 13.5 L20 18"
        stroke={colors.leche}
        strokeWidth={1.7}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  )
}
function TextIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Path
        d="M5 7 H19 M5 12 H19 M5 17 H13"
        stroke={colors.leche}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  )
}

const SCRIM = 'rgba(10,6,8,0.55)'

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  noPreview: {
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPreviewText: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // ── Barra superior ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: SCRIM,
  },
  topTitle: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 1,
    color: colors.leche,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  iconBtnActive: {
    backgroundColor: 'rgba(217,174,111,0.25)',
  },
  iconBtnSpacer: {
    width: 38,
    height: 38,
  },
  // ── Encuadre ──
  frameHintWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 24,
  },
  frameHint: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.leche,
    opacity: 0.85,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  // ── Barra inferior ──
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
    paddingTop: 18,
    backgroundColor: SCRIM,
  },
  sideAction: {
    width: 64,
    alignItems: 'center',
    gap: 5,
  },
  sideLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.leche,
  },
  // Obturador
  shutterOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.leche,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  shutterPressed: {
    transform: [{ scale: 0.94 }],
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.leche,
  },
  // ── Permiso ──
  permScreen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  permTop: {
    paddingHorizontal: 16,
  },
  permBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  permTitle: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
  },
  permText: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
  },
  permCta: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: colors.magenta,
  },
  permCtaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  permAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  permAltText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.magenta,
  },
  permAltDot: {
    color: colors.niebla,
  },
})
