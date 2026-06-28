import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import * as MediaLibrary from 'expo-media-library'
import * as Sharing from 'expo-sharing'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeIn, useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { captureRef } from 'react-native-view-shot'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

import { LinearGradient } from 'expo-linear-gradient'

import { StarLoader } from '@/components/StarLoader'
import { track } from '@/lib/analytics'
import { colors, shadows, typography } from '@/theme'

import { DEFAULT_SHARE_STYLE, SHARE_CARD_STYLES, type ShareCardStyle } from '../share-styles'
import { CARD_H, CARD_W } from './ProgressShareCard'

/* Write-only Photos permission — enough to save; less invasive than
 * full library access. */
async function ensurePhotoPermission(): Promise<boolean> {
  const current = await MediaLibrary.getPermissionsAsync(true)
  if (current.granted) return true
  const next = await MediaLibrary.requestPermissionsAsync(true)
  return next.granted
}

/* Permiso de Fotos denegado — sin esto el botón "no hace nada" y parece roto. */
function showPhotoPermissionAlert() {
  Alert.alert(
    'Acceso a Fotos',
    'Para guardar tu tarjeta necesitamos permiso para acceder a tus Fotos.',
    [
      { text: 'Ahora no', style: 'cancel' },
      {
        text: 'Abrir Ajustes',
        onPress: () => {
          void Linking.openSettings()
        },
      },
    ],
  )
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

/* Sparkles — marca el formato recomendado. Una estrella grande + una
 * chica, el lenguaje de "destacado". */
function SparklesGlyph() {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 2 L12.5 8.5 L19 10 L12.5 11.5 L11 18 L9.5 11.5 L3 10 L9.5 8.5 Z"
        fill={colors.magenta}
      />
      <Path
        d="M18.5 14 L19.2 16.3 L21.5 17 L19.2 17.7 L18.5 20 L17.8 17.7 L15.5 17 L17.8 16.3 Z"
        fill={colors.magenta}
        opacity={0.85}
      />
    </Svg>
  )
}

/* "Más" — tres puntos, el lenguaje universal de "más opciones". */
function MoreGlyph() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Circle cx={5.5} cy={12} r={1.9} fill={colors.magenta} />
      <Circle cx={12} cy={12} r={1.9} fill={colors.magenta} />
      <Circle cx={18.5} cy={12} r={1.9} fill={colors.magenta} />
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
        {loading ? (
          <StarLoader size={24} color={primary ? colors.leche : colors.magenta} />
        ) : (
          children
        )}
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

/** Un tab del sheet. `render` recibe `onReady` — llamalo una vez que la
 *  tarjeta haya asentado (foto cargada, etc.) para habilitar las acciones. */
export type ShareTab = {
  id: string
  label: string
  /** Icono simple; recibe el estado activo para tintarse. */
  icon: (active: boolean) => ReactNode
  /** Marca el formato recomendado (etiqueta "Más compartido"). */
  recommended?: boolean
  /** Renderiza la tarjeta. Recibe `onReady` (gate de captura) y el estilo
   *  de fondo elegido en la fila "ESTILO". */
  render: (onReady: () => void, cardStyle: ShareCardStyle) => ReactNode
}

type Props = {
  visible: boolean
  onClose: () => void
  /** Subtítulo bajo "Compartir": "Tu entrenamiento" / "Tu cambio visual". */
  subtitle: string
  /** Los formatos a elegir. */
  tabs: readonly ShareTab[]
  /** id del tab activo por defecto. Si falta, el recomendado o el primero. */
  defaultTabId?: string
  /** Para analytics: a qué flujo pertenece este sheet. */
  shareType: 'workout' | 'visual_change'
  /** Se llama cuando una acción de compartir/guardar se completa con éxito.
   *  Devuelve la imagen capturada (para previsualizarla), la acción y el
   *  formato elegido — el padre marca "compartido hoy" y puede mostrar la
   *  tarjeta resultante. */
  onShared?: (result: { uri: string; action: ActionId; template: string }) => void
  /** Copy mientras los tabs aún no existen (cargando). */
  loadingLabel?: string
}

type Busy = 'instagram' | 'save' | 'more' | null
type ActionId = 'instagram' | 'save' | 'more'

/* La tarjeta se renderiza a tamaño completo (320×569) para que la captura
 * salga a resolución plena, pero el preview se escala para llenar el
 * escenario disponible sin desbordar. El nodo capturado es el interior
 * SIN escalar (la escala vive en el ancestro), así el PNG no pierde
 * resolución. Fallback hasta medir el escenario. */
const FALLBACK_SCALE = 0.7

/* Una tarjeta del escenario. Todas las tarjetas se montan a la vez (para
 * capturar al instante y para que asienten en paralelo); solo la activa es
 * visible, con un cross-fade + escala suave. `scale` se ajusta al alto real
 * del escenario para que el preview sea lo más grande posible. */
function StageCard({
  active,
  scale,
  nodeRef,
  children,
}: {
  active: boolean
  scale: number
  nodeRef: (el: View | null) => void
  children: ReactNode
}) {
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(active ? 1 : 0, { duration: 220 }),
    transform: [{ scale: withTiming(active ? scale : scale * 0.96, { duration: 220 }) }],
  }))
  return (
    <Animated.View style={[styles.stageCard, style]} pointerEvents={active ? 'auto' : 'none'}>
      <View ref={nodeRef} collapsable={false}>
        {children}
      </View>
    </Animated.View>
  )
}

/*
 * Flujo de compartir — tabs visibles (no slider) sobre un escenario de
 * tarjetas. El usuario entiende los formatos sin deslizar: elige un tab,
 * ve la tarjeta, y comparte con una de tres acciones fijas abajo —
 * Instagram (la tarjeta se guarda primero, a un toque en la galería),
 * Guardar (al carrete) y Más (share sheet nativo).
 *
 * El sheet es genérico: no sabe qué hay DENTRO de las tarjetas, solo
 * posee el chrome (modal, header, tabs, captura → MediaLibrary/Sharing).
 * Los consumidores (BeforeAfterPhotos, TrainingShareCTA) pasan los tabs.
 */
export function ProgressShareSheet({
  visible,
  onClose,
  subtitle,
  tabs,
  defaultTabId,
  shareType,
  onShared,
  loadingLabel,
}: Props) {
  const cardRefs = useRef<(View | null)[]>([])
  // Índice del tab por defecto: el explícito, el recomendado, o el primero.
  const initialIndex = (() => {
    if (defaultTabId) {
      const i = tabs.findIndex((t) => t.id === defaultTabId)
      if (i >= 0) return i
    }
    const reco = tabs.findIndex((t) => t.recommended)
    return reco >= 0 ? reco : 0
  })()

  const [active, setActive] = useState(initialIndex)
  // settled = ids de tarjetas que ya asentaron. Solo capturamos la activa,
  // así que basta con que la activa haya asentado para habilitar acciones.
  const settledRef = useRef(new Set<string>())
  const [settledTick, setSettledTick] = useState(0)
  const [busy, setBusy] = useState<Busy>(null)
  const [saved, setSaved] = useState(false)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const [styleId, setStyleId] = useState(DEFAULT_SHARE_STYLE.id)

  // El preview se agranda para llenar el escenario PERO con aire alrededor:
  // un margen generoso (no toca los bordes) y un tope para que no se sienta
  // apretado contra los tabs / la fila ESTILO.
  const previewScale =
    stage.h > 0 && stage.w > 0
      ? Math.min((stage.h - 44) / CARD_H, (stage.w - 36) / CARD_W, 0.76)
      : FALLBACK_SCALE
  const cardStyle = SHARE_CARD_STYLES.find((s) => s.id === styleId) ?? DEFAULT_SHARE_STYLE

  // Al abrir: reset al default + evento de apertura.
  useEffect(() => {
    if (!visible) return
    setActive(initialIndex)
    setStyleId(DEFAULT_SHARE_STYLE.id)
    const opened = tabs[initialIndex]
    if (opened) {
      track('share_template_opened', { share_type: shareType, template: opened.id })
    }
    // initialIndex depende de defaultTabId/tabs; el efecto corre al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const onCardReady = (id: string) => {
    if (settledRef.current.has(id)) return
    settledRef.current.add(id)
    setSettledTick((n) => n + 1)
  }

  const activeTab = tabs[active]
  const ready = activeTab ? settledRef.current.has(activeTab.id) : false
  // settledTick fuerza el re-render cuando una tarjeta asienta.
  void settledTick

  const changeTab = (i: number) => {
    if (i === active || busy) return
    const from = tabs[active]
    const to = tabs[i]
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setActive(i)
    setSaved(false)
    if (from && to) {
      track('share_template_changed', {
        share_type: shareType,
        from_template: from.id,
        to_template: to.id,
      })
    }
  }

  const changeStyle = (id: string) => {
    if (id === styleId) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setStyleId(id)
    setSaved(false)
  }

  const captureActive = async (): Promise<string | null> => {
    const node = cardRefs.current[active]
    if (!node) return null
    return captureRef(node, { format: 'png', quality: 1 })
  }

  const markCompleted = (action: ActionId, uri: string) => {
    if (!activeTab) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    track('share_completed', { action, share_type: shareType, template: activeTab.id })
    onShared?.({ uri, action, template: activeTab.id })
  }

  const runAction = async (action: ActionId) => {
    if (!ready || busy || !activeTab) return
    track('share_action_clicked', { action, share_type: shareType, template: activeTab.id })
    setBusy(action)
    try {
      const uri = await captureActive()
      if (!uri) return

      if (action === 'save') {
        if (!(await ensurePhotoPermission())) {
          showPhotoPermissionAlert()
          return
        }
        await MediaLibrary.saveToLibraryAsync(uri)
        markCompleted(action, uri)
        // Muestra el check "Guardada", luego cierra hacia Progreso.
        setSaved(true)
        setTimeout(() => {
          setSaved(false)
          onClose()
        }, 1100)
      } else if (action === 'instagram') {
        // La tarjeta necesita estar en Fotos para postearla en IG.
        if (!(await ensurePhotoPermission())) {
          showPhotoPermissionAlert()
          return
        }
        await MediaLibrary.saveToLibraryAsync(uri)
        try {
          await Linking.openURL('instagram://story-camera')
          markCompleted('instagram', uri)
          // IG te saca de la app: cerramos el modal detrás tras un instante.
          setTimeout(() => onClose(), 450)
        } catch {
          // Instagram no está instalado: la tarjeta quedó en Fotos, así que
          // la verdad honesta es "guardada", no "compartida en Instagram".
          markCompleted('save', uri)
          Alert.alert(
            'Tu tarjeta está en Fotos',
            'No encontramos Instagram. La guardamos en tu galería para que la compartas cuando quieras.',
          )
        }
      } else {
        // Más → share sheet nativo (vive ENCIMA del modal): no cerramos a
        // ciegas, el sheet del SO maneja su propio cierre.
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' })
          markCompleted(action, uri)
        }
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
        {/* Fondo: la pantalla detrás difuminada + un velo oscuro warm para
            que el contenido siga legible. experimentalBlurMethod activa el
            blur real en Android (si no, queda un velo sólido — aceptable). */}
        <BlurView
          intensity={48}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.scrim} />
        <View style={styles.topBar}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Compartir</Text>
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
          </View>
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

        {tabs.length > 0 ? (
          <>
            <Text style={styles.helper}>Elige el formato que quieres compartir.</Text>

            <View style={styles.tabsRow}>
              {tabs.map((t, i) => {
                const isActive = i === active
                return (
                  <View key={t.id} style={styles.tabCol}>
                    <View style={styles.recoTag}>
                      {t.recommended ? (
                        <>
                          <SparklesGlyph />
                          <Text style={styles.recoText}>Recomendado</Text>
                        </>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => changeTab(i)}
                      style={[styles.tab, isActive && styles.tabActive]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={t.label}
                    >
                      {t.icon(isActive)}
                      {/* numberOfLines+adjustsFontSizeToFit: "Transformación" es
                          una palabra larga que en Android se partía a la mitad
                          ("Transformaci/ón"); aquí encoge a UNA línea. */}
                      <Text
                        style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        {t.label}
                      </Text>
                    </Pressable>
                  </View>
                )
              })}
            </View>

            <View
              style={styles.stage}
              onLayout={(e) =>
                setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
              }
            >
              {tabs.map((t, i) => (
                <StageCard
                  key={t.id}
                  active={i === active}
                  scale={previewScale}
                  nodeRef={(el) => {
                    cardRefs.current[i] = el
                  }}
                >
                  {t.render(() => onCardReady(t.id), cardStyle)}
                </StageCard>
              ))}
            </View>

            <View style={styles.styleRow}>
              <Text style={styles.styleEyebrow}>Estilo</Text>
              <View style={styles.swatches}>
                {SHARE_CARD_STYLES.map((s) => {
                  const on = s.id === styleId
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => changeStyle(s.id)}
                      style={[styles.swatch, on && styles.swatchOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`Estilo ${s.label}`}
                    >
                      <LinearGradient
                        colors={[s.swatch[0], s.swatch[1]]}
                        start={{ x: 0.2, y: 0 }}
                        end={{ x: 0.8, y: 1 }}
                        style={styles.swatchFill}
                      />
                    </Pressable>
                  )
                })}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.loading}>
            <StarLoader size={34} />
            <Text style={styles.loadingText}>{loadingLabel ?? 'Preparando tu tarjeta…'}</Text>
          </View>
        )}

        <Text style={styles.actionsCaption}>Comparte tu luz. Inspira a otros.</Text>
        <Animated.View entering={FadeIn.duration(260)} style={styles.actions}>
          <ActionButton
            label="Instagram"
            primary
            loading={busy === 'instagram'}
            disabled={actionsDisabled}
            onPress={() => runAction('instagram')}
          >
            <InstagramGlyph />
          </ActionButton>
          <ActionButton
            label={saved ? 'Guardada' : 'Guardar'}
            loading={busy === 'save'}
            disabled={actionsDisabled}
            onPress={() => runAction('save')}
          >
            {saved ? <CheckGlyph /> : <SaveGlyph />}
          </ActionButton>
          <ActionButton
            label="Más"
            loading={busy === 'more'}
            disabled={actionsDisabled}
            onPress={() => runAction('more')}
          >
            <MoreGlyph />
          </ActionButton>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  // Velo oscuro warm sobre el blur — sostiene el contraste del contenido
  // sin tapar del todo la pantalla difuminada de atrás.
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 5, 7, 0.74)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 46,
    paddingBottom: 2,
    paddingHorizontal: 22,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.heading,
    color: colors.leche,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    marginTop: 2,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
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
  helper: {
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 22,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.niebla,
  },
  // ── tabs ───────────────────────────────────────────────────────────
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  tabCol: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 130,
  },
  // Etiqueta "Más compartido" sobre el recomendado. Siempre reserva el
  // alto (con un espacio) para alinear los chips entre columnas.
  recoTag: {
    height: 14,
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  recoText: {
    fontFamily: typography.uiBold,
    fontSize: 8.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.magenta,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard,
  },
  tabActive: {
    borderColor: colors.magenta,
    backgroundColor: colors.magentaTint,
  },
  tabLabel: {
    flexShrink: 1,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.caption,
    letterSpacing: 0.2,
    color: colors.niebla,
  },
  tabLabelActive: {
    color: colors.leche,
  },
  // ── escenario de tarjetas ──────────────────────────────────────────
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stageCard: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // ── fila ESTILO ────────────────────────────────────────────────────
  styleRow: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
  },
  styleEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  swatches: {
    flexDirection: 'row',
    gap: 12,
  },
  swatch: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.bruma,
    overflow: 'hidden',
  },
  swatchOn: {
    borderColor: colors.magenta,
  },
  swatchFill: {
    flex: 1,
  },
  // ── barra de acciones (fija abajo) ─────────────────────────────────
  actionsCaption: {
    textAlign: 'center',
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.bone,
    paddingTop: 10,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 38,
    paddingTop: 12,
    paddingBottom: 34,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 9,
  },
  actionDim: {
    opacity: 0.4,
  },
  actionCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
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
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 0.6,
    color: colors.bone,
  },
})
