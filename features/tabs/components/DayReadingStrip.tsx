import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { dayReading } from '@/features/orbit/day-goal'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

import { dayCloseVerdict } from '../day-close'

/*
 * "¿Cómo voy hoy?" — la lectura del día asomada en Hoy (V-02 · el hook
 * diario honesto). Órbita Día ya responde la pregunta; esta tira la trae a
 * donde la usuaria está, con las MISMAS palabras (day-goal.dayReading, una
 * sola fuente de verdad). Es lectura, no countdown: estado + margen, sin
 * semáforo intradía, sin rojo, sin porcentaje de meta.
 *
 * Convive con el cierre nocturno: desde las 20:00, si DayCloseCard tiene
 * veredicto, esta tira se retira — un solo mensaje por franja. El ticker de
 * hora vive aquí (como en DayCloseCard) para que el cambio de franja
 * re-renderice solo esta tira, nunca el árbol de la constelación.
 *
 * Tap → Órbita Día (el porqué completo: anillos, evidencia, dirección).
 */
export function DayReadingStrip({
  consumedCalories,
  targetCalories,
  mealCount,
}: {
  consumedCalories: number
  targetCalories: number | null | undefined
  mealCount: number
}) {
  const router = useRouter()
  const [hour, setHour] = useState(() => new Date().getHours())
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000)
    return () => clearInterval(id)
  }, [])

  // La franja del cierre: si el veredicto nocturno existe, él habla.
  if (dayCloseVerdict({ consumedCalories, targetCalories, mealCount, hour })) return null

  const r = dayReading(consumedCalories, targetCalories)
  // "Sobre tu objetivo" a media tarde sería el semáforo intradía que
  // day-close.ts prohíbe (bucle de ansiedad): con el día aún abierto, la
  // tira calla — misma disciplina que micro-reading — y el veredicto de
  // ese estado lo da el cierre nocturno (DayCloseCard) con su copy.
  if (r.status === 'over') return null

  const deficit = r.status === 'deficit'
  const dataLine =
    r.status === 'incomplete' ? r.stateLabel : `${r.stateLabel} · −${r.deltaKcal} kcal`

  return (
    <Animated.View
      entering={FadeIn.duration(420)}
      style={[styles.card, deficit && styles.cardGold]}
    >
      <Pressable
        onPress={() => {
          track('insight_opened', { source: 'day_reading', target: 'orbit_dia' })
          router.navigate('/orbit')
        }}
        accessibilityRole="button"
        accessibilityLabel={`¿Cómo voy hoy? ${dataLine}. ${r.line} Abre tu Órbita.`}
        style={({ pressed }) => pressed && { opacity: 0.82 }}
      >
        <View style={styles.headRow}>
          <EyebrowLabel tone="niebla" size={10}>
            ¿Cómo voy hoy?
          </EyebrowLabel>
          <Text style={styles.chevron}>›</Text>
        </View>
        <Text style={styles.data}>
          {r.status === 'incomplete' ? (
            r.stateLabel
          ) : (
            <>
              {r.stateLabel}
              <Text style={styles.deltaGold}>{`  −${r.deltaKcal} kcal`}</Text>
            </>
          )}
        </Text>
        <Text style={styles.line}>{r.line}</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Misma vestimenta que DayCloseCard: son la MISMA pregunta en dos
  // franjas del día; el ancho/padding vive en el View (quirk Pressable).
  card: {
    marginTop: 14,
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  cardGold: {
    borderColor: colors.oroHairline,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  chevron: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
  },
  data: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  deltaGold: {
    color: colors.oroLight,
  },
  // La línea de apoyo — voz del coach (serif italic), como en Órbita Día.
  line: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
