import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import Toast from 'react-native-toast-message'
import { useQueryClient } from '@tanstack/react-query'

import { PrimaryCta } from '@/components/PrimaryCta'
import { DateField } from '@/features/onboarding/components/DateField'
import { processAndUploadFromUri } from '@/features/onboarding/photos/api'
import type { PhotoAngle } from '@/features/onboarding/photos/hooks/usePhotosToday'
import { SkyBackground } from '@/features/tabs/components'
import { queryKeys } from '@/lib/queryKeys'
import { colors, typography } from '@/theme'

/*
 * Sube tus fotos (Progress 3.0 + Epic 08) — el flujo de fotos con FECHA:
 * sirve para el capítulo de HOY y para el backdating (las sesiones del coach
 * con su fecha real). Elige fecha + los ángulos que tengas; cada foto se sube
 * con taken_at = esa fecha.
 *
 * Fixes uxui (jul 2026): el layout de los slots vive en un View wrapper (el
 * layout directo en Pressable colapsa en este setup · patrón del repo);
 * DateField en vez de TextInput (adiós fechas imposibles/futuras y el
 * RangeError críptico); CTA anclado abajo, deshabilitado sin fotos y con
 * conteo; el retry solo re-envía lo que falló (cada foto sale de `picked` al
 * subirse — antes un fallo parcial duplicaba las ya subidas).
 */

const ANGLES: { key: PhotoAngle; label: string }[] = [
  { key: 'front', label: 'Frente' },
  { key: 'back', label: 'Espalda' },
  { key: 'side_left', label: 'Perfil izq' },
  { key: 'side_right', label: 'Perfil der' },
]

const parseISODate = (v: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return null
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

export default function LogPhotosScreen() {
  const router = useRouter()
  const qc = useQueryClient()
  // Tamaño EXPLÍCITO de los slots: aspectRatio + flexBasis porcentual no
  // resuelven altura en este setup (el grid salía plano en device). Dos
  // columnas: ancho = (pantalla - padding 20×2 - gap 12) / 2; alto 4:3.
  const { width: screenW } = useWindowDimensions()
  const slotW = Math.floor((screenW - 40 - 12) / 2)
  const slotH = Math.round((slotW * 4) / 3)
  // "Agregar fotos de esta fecha" (medición completa) manda su fecha; sin
  // param, hoy.
  const params = useLocalSearchParams<{ date?: string }>()
  const initial = (typeof params.date === 'string' ? parseISODate(params.date) : null) ?? new Date()
  const [date, setDate] = useState<Date>(initial)
  const [picked, setPicked] = useState<Partial<Record<PhotoAngle, string>>>({})
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const pick = async (angle: PhotoAngle) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    })
    const uri = result.assets?.[0]?.uri
    if (!result.canceled && uri) setPicked((p) => ({ ...p, [angle]: uri }))
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
          <Text style={styles.hint}>
            Elige la fecha y los ángulos que tengas. Sirve para fotos de hoy o de antes (las de tus
            sesiones con coach, por ejemplo).
          </Text>

          <DateField
            label="Fecha de las fotos"
            value={date}
            onChange={setDate}
            defaultDate={initial}
            maxDate={new Date()}
          />

          <View style={styles.grid}>
            {ANGLES.map((a) => {
              const uri = picked[a.key]
              return (
                /* El layout vive en el wrapper; el Pressable solo rellena
                   (layout directo en Pressable colapsa · patrón del repo). */
                <View key={a.key} style={{ width: slotW, height: slotH }}>
                  <Pressable
                    onPress={() => void pick(a.key)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      uri ? `Cambiar foto de ${a.label}` : `Elegir foto de ${a.label}`
                    }
                    style={({ pressed }) => [styles.slot, pressed && { opacity: 0.7 }]}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                    ) : (
                      <Text style={styles.slotPlus}>+</Text>
                    )}
                    <Text style={[styles.slotLabel, uri != null && styles.slotLabelOn]}>
                      {a.label}
                    </Text>
                  </Pressable>
                </View>
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
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, flexGrow: 1 },
  hint: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
    marginBottom: 18,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 22 },
  slot: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumb: { ...StyleSheet.absoluteFillObject },
  slotPlus: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displayMd,
    color: colors.niebla,
  },
  slotLabel: {
    position: 'absolute',
    bottom: 8,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.bone,
    backgroundColor: 'rgba(10, 6, 8, 0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  slotLabelOn: { color: colors.leche },
  ctaWrap: { marginTop: 'auto', paddingTop: 26 },
})
