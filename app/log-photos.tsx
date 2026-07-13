import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import Toast from 'react-native-toast-message'
import { useQueryClient } from '@tanstack/react-query'

import { PrimaryCta } from '@/components/PrimaryCta'
import { processAndUploadFromUri } from '@/features/onboarding/photos/api'
import type { PhotoAngle } from '@/features/onboarding/photos/hooks/usePhotosToday'
import { SkyBackground } from '@/features/tabs/components'
import { queryKeys } from '@/lib/queryKeys'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

/*
 * Fotos de otra fecha (Progress 3.0) — BACKDATING: sube las fotos históricas
 * (las sesiones del coach: frente/espalda/perfiles) con la fecha REAL en que
 * se tomaron, para que la evolución visual y el comparador tengan línea de
 * tiempo de verdad. Elige fecha + los ángulos que tengas (todos opcionales);
 * cada foto se sube con taken_at = esa fecha.
 */

const ANGLES: { key: PhotoAngle; label: string }[] = [
  { key: 'front', label: 'Frente' },
  { key: 'back', label: 'Espalda' },
  { key: 'side_left', label: 'Perfil izq' },
  { key: 'side_right', label: 'Perfil der' },
]

export default function LogPhotosScreen() {
  const router = useRouter()
  const qc = useQueryClient()
  const [date, setDate] = useState(todayInTimezone())
  const [picked, setPicked] = useState<Partial<Record<PhotoAngle, string>>>({})
  const [saving, setSaving] = useState(false)

  const pick = async (angle: PhotoAngle) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    })
    const uri = result.assets?.[0]?.uri
    if (!result.canceled && uri) setPicked((p) => ({ ...p, [angle]: uri }))
  }

  const save = async () => {
    const entries = Object.entries(picked) as [PhotoAngle, string][]
    if (entries.length === 0) {
      Toast.show({ type: 'error', text1: 'Elige al menos una foto' })
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      Toast.show({ type: 'error', text1: 'Fecha en formato AAAA-MM-DD' })
      return
    }
    // Mediodía local del día elegido: cae en el día correcto en cualquier zona.
    const takenAt = new Date(`${date.trim()}T12:00:00`).toISOString()
    setSaving(true)
    try {
      // Secuencial a propósito: sube una por una (conexión de teléfono; un
      // fallo no descarta las demás — las ya subidas quedan).
      for (const [angle, uri] of entries) {
        await processAndUploadFromUri(uri, angle, takenAt)
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      void qc.invalidateQueries({ queryKey: queryKeys.photos.all, refetchType: 'all' })
      void qc.invalidateQueries({ queryKey: queryKeys.progress.all })
      Toast.show({
        type: 'success',
        text1: entries.length === 1 ? 'Foto guardada' : `${entries.length} fotos guardadas`,
      })
      router.back()
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'No pudimos subir todas las fotos',
        text2: err instanceof Error ? err.message : 'Intenta de nuevo.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Fotos de otra fecha</Text>
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

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.hint}>
            Sube fotos que ya tenías (las de tus sesiones con coach, por ejemplo) con la fecha en
            que se tomaron. Elige los ángulos que tengas.
          </Text>

          <Text style={styles.fieldLabel}>Fecha de las fotos</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={colors.niebla}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.grid}>
            {ANGLES.map((a) => {
              const uri = picked[a.key]
              return (
                <Pressable
                  key={a.key}
                  onPress={() => void pick(a.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Elegir foto de ${a.label}`}
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
              )
            })}
          </View>

          <View style={styles.ctaWrap}>
            <PrimaryCta
              label="Guardar fotos"
              onPress={() => void save()}
              loading={saving}
              loadingLabel="Subiendo…"
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
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  hint: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.4,
    color: colors.bone,
    marginBottom: 5,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  slot: {
    flexGrow: 1,
    flexBasis: '45%',
    aspectRatio: 3 / 4,
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
  ctaWrap: { marginTop: 26 },
})
