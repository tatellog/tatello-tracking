import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import { useDaySignals } from '@/features/orbit/hooks'
import type { PhotoAngle } from '@/features/progress/api'
import { useBodyCheckins, usePhotoTimeline } from '@/features/progress/hooks'
import { photoAt, photoDatesFor } from '@/features/progress/logic'
import { SkyBackground } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

/*
 * Capítulo (Epic 08 · F2) — la pregunta: "¿quién era yo ese día?". Una foto
 * NO es una imagen: es un momento. Foto grande + tres datos (peso, grasa,
 * músculo del check-in cercano ±3 días) + las notas de esa medición + el
 * contexto del día (daily_signals: entreno, sueño, ánimo, ciclo — sin datos
 * de cumplimiento junto a la foto). Navegación ‹ › entre capítulos del mismo
 * ángulo. Evidencia sin juicio: jamás un veredicto sobre la foto.
 *
 * (El contexto del día solo aparece si ese día tiene señales registradas —
 * un capítulo de la era pre-Stelar muestra la foto y su medición, sin fingir
 * contexto que no existe.)
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDay = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`

const MOOD_LABEL: Record<string, string> = {
  dificil: 'Difícil',
  neutral: 'Neutral',
  bien: 'Bien',
}

const ANGLES: PhotoAngle[] = ['front', 'back', 'side_left', 'side_right']

/** Distancia en días entre dos ISO (YYYY-MM-DD). */
const daysBetween = (a: string, b: string): number =>
  Math.abs(
    Math.round(
      (new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 86400000,
    ),
  )

export default function PhotoChapterScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ day?: string; angle?: string }>()
  const day = typeof params.day === 'string' ? params.day : ''
  const angle = (ANGLES.includes(params.angle as PhotoAngle) ? params.angle : 'front') as PhotoAngle

  const photosQ = usePhotoTimeline()
  const checkinsQ = useBodyCheckins()
  const signalsQ = useDaySignals(day, day.length > 0)

  const photos = useMemo(() => photosQ.data ?? [], [photosQ.data])
  const photo = useMemo(() => (day ? photoAt(photos, angle, day) : null), [photos, angle, day])

  // Capítulos hermanos (mismo ángulo) para el ‹ › .
  const days = useMemo(() => photoDatesFor(photos, angle), [photos, angle])
  const idx = days.indexOf(day)
  const prevDay = idx > 0 ? days[idx - 1] : null
  const nextDay = idx >= 0 && idx < days.length - 1 ? days[idx + 1] : null

  // El check-in más cercano (±3 días): sus tres datos + notas.
  const checkin = useMemo(() => {
    const rows = checkinsQ.data ?? []
    let best: (typeof rows)[number] | null = null
    let bestDist = 4
    for (const c of rows) {
      const d = daysBetween(c.measured_on, day)
      if (d < bestDist) {
        best = c
        bestDist = d
      }
    }
    return best
  }, [checkinsQ.data, day])

  const signals = signalsQ.data
  const dayFacts = useMemo(() => {
    if (!signals) return []
    const out: { key: string; label: string; value: string }[] = []
    // SIN fila de déficit (manifesto-review, severidad media): un dato de
    // cumplimiento junto a una FOTO del cuerpo se vuelve veredicto implícito
    // sobre lo que se ve. El contexto del capítulo solo lleva hechos que no
    // juzgan (entreno, sueño, ánimo, ciclo).
    if (signals.trained != null) {
      out.push({ key: 'trained', label: 'Entreno', value: signals.trained ? 'Sí' : 'Descanso' })
    }
    if (signals.sleep_minutes != null) {
      out.push({
        key: 'sleep',
        label: 'Sueño',
        value: `${(signals.sleep_minutes / 60).toFixed(1)} h`,
      })
    }
    if (signals.mood) {
      out.push({ key: 'mood', label: 'Ánimo', value: MOOD_LABEL[signals.mood] ?? signals.mood })
    }
    if (signals.on_period === true) {
      out.push({ key: 'cycle', label: 'Ciclo', value: 'En tu período' })
    }
    return out
  }, [signals])

  const isPending = photosQ.isPending || checkinsQ.isPending

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{day ? fmtDay(day) : 'Capítulo'}</Text>
            <Text style={styles.sub}>Un capítulo de tu evidencia</Text>
          </View>
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

        {isPending ? (
          <View style={styles.skeleton}>
            <View style={styles.skeletonPhoto} />
          </View>
        ) : !photo?.signed_url ? (
          <Text style={styles.empty}>No encontramos la foto de este capítulo.</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* La foto, grande. Fechada; jamás juzgada. */}
            <Animated.View entering={FadeInDown.duration(420)} style={styles.photoFrame}>
              <Image
                source={{ uri: photo.signed_url }}
                style={styles.photoBg}
                resizeMode="cover"
                blurRadius={18}
              />
              <View style={styles.photoScrim} pointerEvents="none" />
              <Image source={{ uri: photo.signed_url }} style={styles.photo} resizeMode="contain" />
            </Animated.View>

            {/* ‹ › entre capítulos del mismo ángulo. */}
            <View style={styles.navRow}>
              {prevDay ? (
                <Pressable
                  onPress={() => router.setParams({ day: prevDay, angle })}
                  accessibilityRole="button"
                  accessibilityLabel={`Capítulo anterior, ${fmtDay(prevDay)}`}
                  hitSlop={8}
                  style={({ pressed }) => pressed && { opacity: 0.6 }}
                >
                  <Text style={styles.navText}>‹ {fmtDay(prevDay)}</Text>
                </Pressable>
              ) : (
                <View />
              )}
              {nextDay ? (
                <Pressable
                  onPress={() => router.setParams({ day: nextDay, angle })}
                  accessibilityRole="button"
                  accessibilityLabel={`Capítulo siguiente, ${fmtDay(nextDay)}`}
                  hitSlop={8}
                  style={({ pressed }) => pressed && { opacity: 0.6 }}
                >
                  <Text style={styles.navText}>{fmtDay(nextDay)} ›</Text>
                </Pressable>
              ) : (
                <View />
              )}
            </View>

            {/* Tres datos del check-in cercano, nada más. */}
            {checkin ? (
              <Animated.View entering={FadeIn.duration(420).delay(120)} style={styles.factsRow}>
                {checkin.weight_kg != null ? (
                  <View style={styles.fact}>
                    <Text style={styles.factLabel}>Peso</Text>
                    <Text style={styles.factValue}>{checkin.weight_kg.toFixed(1)} kg</Text>
                  </View>
                ) : null}
                {checkin.body_fat_pct != null ? (
                  <View style={styles.fact}>
                    <Text style={styles.factLabel}>Grasa</Text>
                    <Text style={styles.factValue}>{checkin.body_fat_pct.toFixed(1)} %</Text>
                  </View>
                ) : null}
                {checkin.muscle_kg != null ? (
                  <View style={styles.fact}>
                    <Text style={styles.factLabel}>Músculo</Text>
                    <Text style={styles.factValue}>{checkin.muscle_kg.toFixed(1)} kg</Text>
                  </View>
                ) : null}
              </Animated.View>
            ) : null}

            {/* Sus notas de ese día (si las dejó). */}
            {checkin?.notes ? <Text style={styles.notes}>“{checkin.notes}”</Text> : null}

            {/* El contexto del día — solo si ese día tiene señales. */}
            {dayFacts.length > 0 ? (
              <View style={styles.context}>
                <Text style={styles.contextTitle}>Ese día</Text>
                {dayFacts.map((f) => (
                  <View key={f.key} style={styles.contextRow}>
                    <Text style={styles.contextLabel}>{f.label}</Text>
                    <Text style={styles.contextValue}>{f.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  sub: {
    marginTop: 2,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  skeleton: { paddingHorizontal: 20, paddingTop: 16 },
  skeletonPhoto: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    opacity: 0.6,
  },
  empty: {
    marginTop: 30,
    paddingHorizontal: 24,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    textAlign: 'center',
  },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 },
  photoFrame: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.oroHairlineSoft,
    backgroundColor: colors.bgCard2,
    overflow: 'hidden',
  },
  photoBg: { ...StyleSheet.absoluteFillObject },
  photoScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,6,8,0.45)' },
  photo: { ...StyleSheet.absoluteFillObject },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  navText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  factsRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  fact: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  factLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.5,
    color: colors.niebla,
  },
  factValue: {
    marginTop: 4,
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.heading,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  notes: {
    marginTop: 22,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 25,
    color: colors.bone,
  },
  context: { marginTop: 32 },
  contextTitle: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    marginBottom: 6,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  contextLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  contextValue: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
})
