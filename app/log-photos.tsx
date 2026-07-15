import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import Toast from 'react-native-toast-message'
import { useQueryClient } from '@tanstack/react-query'

import { PrimaryCta } from '@/components/PrimaryCta'
import { StarLoader } from '@/components/StarLoader'
import { DateField } from '@/features/onboarding/components/DateField'
import { processAndUploadFromUri } from '@/features/onboarding/photos/api'
import type { PhotoAngle } from '@/features/onboarding/photos/hooks/usePhotosToday'
import { PoseGlyph } from '@/features/progress/components/PoseGlyph'
import { SkyBackground } from '@/features/tabs/components'
import { queryKeys } from '@/lib/queryKeys'
import { colors, typography } from '@/theme'

/*
 * Sube tus fotos (Progress 3.0 + Epic 08 · rediseño uxui+illustrator jul 2026)
 * — el flujo de fotos con FECHA: sirve para el capítulo de HOY y para el
 * backdating (las sesiones del coach con su fecha real).
 *
 * Diseño: el alto de los slots se deriva del espacio VERTICAL disponible
 * (fecha + 4 ángulos + CTA caben en una pantalla, cero scroll objetivo; el
 * ScrollView queda de red de seguridad). "Un placeholder no necesita la
 * proporción del contenido futuro; necesita la proporción de una invitación."
 * Slot vacío: glifo de pose (cartografía, cero figura humana) + label + badge
 * "+" de esquina. Slot lleno: thumb + borde encendido en magenta (mismo
 * vocabulario que el hairline del DateField) + badge palomita; tap → Cambiar /
 * Quitar. Subiendo: overlay con StarLoader por slot.
 *
 * Quirk del repo (3 rounds): ni layout, ni flex:1, ni aspectRatio+flexBasis%
 * son confiables en Pressable — dimensiones EXPLÍCITAS en el View y el
 * Pressable como capa táctil absoluta.
 *
 * Hint en Hanken (regla tipográfica: la itálica serif es SOLO voz de coach;
 * esto es una instrucción).
 */

const ANGLES: { key: PhotoAngle; label: string }[] = [
  { key: 'front', label: 'Frente' },
  { key: 'back', label: 'Espalda' },
  { key: 'side_left', label: 'Perfil izq' },
  { key: 'side_right', label: 'Perfil der' },
]

const GAP = 10
// Header + hint + DateField + zona CTA (aprox.): lo que NO es grid.
const CHROME = 250

const parseISODate = (v: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return null
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

export default function LogPhotosScreen() {
  const router = useRouter()
  const qc = useQueryClient()
  // Slots que CABEN: alto derivado del espacio disponible, con piso (touch
  // target/legibilidad) y techo 4:5 (que no vuelvan a ser torres).
  const { width: screenW, height: screenH } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const slotW = Math.floor((screenW - 40 - GAP) / 2)
  const availH = screenH - insets.top - insets.bottom - CHROME
  const slotH = Math.max(150, Math.min(Math.floor((availH - GAP) / 2), Math.round(slotW * 1.25)))

  // "Agregar fotos de esta fecha" (medición completa) manda su fecha; sin
  // param, hoy.
  const params = useLocalSearchParams<{ date?: string }>()
  const initial = (typeof params.date === 'string' ? parseISODate(params.date) : null) ?? new Date()
  const [date, setDate] = useState<Date>(initial)
  const [picked, setPicked] = useState<Partial<Record<PhotoAngle, string>>>({})
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [uploadingAngle, setUploadingAngle] = useState<PhotoAngle | null>(null)

  const pick = async (angle: PhotoAngle) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    })
    const uri = result.assets?.[0]?.uri
    if (!result.canceled && uri) {
      Haptics.selectionAsync().catch(() => {})
      setPicked((p) => ({ ...p, [angle]: uri }))
    }
  }

  // Slot lleno: cambiar o quitar (antes el tap reemplazaba en silencio y no
  // había forma de quitar una foto mal elegida).
  const manage = (angle: PhotoAngle, label: string) => {
    Alert.alert(`Foto de ${label.toLowerCase()}`, undefined, [
      { text: 'Cambiar foto', onPress: () => void pick(angle) },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () =>
          setPicked((p) => {
            const next = { ...p }
            delete next[angle]
            return next
          }),
      },
      { text: 'Cancelar', style: 'cancel' },
    ])
  }

  const pickedCount = Object.keys(picked).length

  const save = async () => {
    const entries = Object.entries(picked) as [PhotoAngle, string][]
    if (entries.length === 0) return
    // Mediodía local del día elegido: cae en el día correcto en cualquier zona.
    const takenAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).toISOString()
    setSaving(true)
    setProgress({ done: 0, total: entries.length })
    try {
      // Secuencial a propósito (conexión de teléfono). Cada foto SALE de
      // `picked` al subirse: un fallo parcial deja visible solo lo pendiente
      // y el retry no duplica lo ya subido.
      let done = 0
      for (const [angle, uri] of entries) {
        setUploadingAngle(angle)
        await processAndUploadFromUri(uri, angle, takenAt)
        done += 1
        setProgress({ done, total: entries.length })
        setPicked((p) => {
          const next = { ...p }
          delete next[angle]
          return next
        })
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      void qc.invalidateQueries({ queryKey: queryKeys.photos.all, refetchType: 'all' })
      void qc.invalidateQueries({ queryKey: queryKeys.progress.all })
      Toast.show({
        type: 'success',
        text1: entries.length === 1 ? 'Foto guardada' : `${entries.length} fotos guardadas`,
      })
      router.back()
    } catch {
      // Copy fijo y cálido: jamás el mensaje crudo del sistema en pantalla.
      Toast.show({
        type: 'error',
        text1: 'No pudimos subir todas las fotos',
        text2: 'Las que faltan siguen aquí. Revisa tu conexión e intenta de nuevo.',
      })
    } finally {
      setSaving(false)
      setProgress(null)
      setUploadingAngle(null)
    }
  }

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Sube tus fotos</Text>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke={colors.bone}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Instrucción, no voz de coach → Hanken recta (regla tipográfica). */}
          <Text style={styles.hint}>Sube los ángulos que tengas · de hoy o de antes.</Text>

          <View style={styles.dateWrap}>
            <DateField
              label="Fecha de las fotos"
              value={date}
              onChange={setDate}
              defaultDate={initial}
              maxDate={new Date()}
            />
          </View>

          <View style={styles.grid}>
            {ANGLES.map((a) => {
              const uri = picked[a.key]
              const filled = uri != null
              const uploading = uploadingAngle === a.key && saving
              return (
                /* Patrón AccountRow (probado): el Pressable ENVUELVE al slot
                   dimensionado — un Pressable sin hijos con absoluteFill queda
                   en tamaño cero en este setup (quirk documentado). */
                <Pressable
                  key={a.key}
                  onPress={() => (filled ? manage(a.key, a.label) : void pick(a.key))}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={
                    filled ? `Cambiar o quitar la foto de ${a.label}` : `Elegir foto de ${a.label}`
                  }
                  style={({ pressed }) => pressed && { opacity: 0.75 }}
                >
                  <View
                    style={[
                      styles.slot,
                      { width: slotW, height: slotH },
                      filled && styles.slotFilled,
                    ]}
                  >
                    {filled ? (
                      <Animated.View
                        entering={FadeIn.duration(200)}
                        style={StyleSheet.absoluteFill}
                      >
                        <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                      </Animated.View>
                    ) : (
                      <View style={styles.emptyBody}>
                        <PoseGlyph pose={a.key} size={44} color={colors.bone} />
                        <Text style={styles.emptyLabel}>{a.label}</Text>
                      </View>
                    )}

                    {/* Label chip solo sobre foto (sobre bgCard no lo necesita). */}
                    {filled ? <Text style={styles.filledLabel}>{a.label}</Text> : null}

                    {/* Badge de esquina: "+" para invitar, palomita al elegir. */}
                    <View style={[styles.badge, filled && styles.badgeFilled]}>
                      {filled ? (
                        <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                          <Path
                            d="M2.5 6.5 L5 9 L9.5 3.5"
                            stroke={colors.bg}
                            strokeWidth={1.8}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      ) : (
                        <Text style={styles.badgePlus}>+</Text>
                      )}
                    </View>

                    {/* Overlay de subida del slot en vuelo. */}
                    {uploading ? (
                      <Animated.View entering={FadeIn.duration(150)} style={styles.uploading}>
                        <StarLoader size={20} />
                      </Animated.View>
                    ) : null}
                  </View>
                </Pressable>
              )
            })}
          </View>

          {/* CTA anclado abajo: el vacío es aire entre contenido y acción. */}
          <View style={styles.ctaWrap}>
            <PrimaryCta
              label={
                pickedCount === 0
                  ? 'Guardar fotos'
                  : pickedCount === 1
                    ? 'Guardar 1 foto'
                    : `Guardar ${pickedCount} fotos`
              }
              onPress={() => void save()}
              loading={saving}
              loadingLabel={
                progress ? `Subiendo ${progress.done + 1} de ${progress.total}…` : 'Subiendo…'
              }
              disabled={pickedCount === 0}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.5,
  },
  // flexGrow: el CTA ancla abajo (marginTop auto) y el hueco se vuelve aire.
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, flexGrow: 1 },
  hint: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
    marginBottom: 14,
  },
  dateWrap: { marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  slot: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  // El borde se ENCIENDE al elegir — mismo vocabulario que el hairline del
  // DateField de arriba (Android degrada a la línea magenta plana).
  slotFilled: {
    borderWidth: 1.5,
    borderColor: colors.magenta,
    ...Platform.select({
      ios: {
        shadowColor: colors.magentaHot,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
      },
      default: {},
    }),
  },
  emptyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    gap: 10,
  },
  emptyLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.bone,
  },
  thumb: { ...StyleSheet.absoluteFillObject },
  filledLabel: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.leche,
    backgroundColor: 'rgba(10, 6, 8, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.magentaGlow,
    backgroundColor: 'rgba(10, 6, 8, 0.45)',
  },
  badgeFilled: {
    backgroundColor: colors.magenta,
    borderColor: colors.magenta,
  },
  badgePlus: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.magenta,
    marginTop: -1,
  },
  // Overlay del slot en vuelo (nunca "se borró": está subiendo).
  uploading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 6, 8, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaWrap: { marginTop: 'auto', paddingTop: 18 },
})
