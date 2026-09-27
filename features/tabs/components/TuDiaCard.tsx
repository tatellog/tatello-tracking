import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { useWeeklyReading } from '@/features/orbit/weekly-reading-hooks'
import { useSession } from '@/hooks/useSession'
import { track } from '@/lib/analytics'
import { aiEnabledForEmail, WEEKLY_READING_ENABLED } from '@/lib/featureFlags'
import { colors, typography } from '@/theme'

import { tuDiaModel } from '../tu-dia'
import { useLocalHour } from '../use-local-hour'

// Huella TTFI (V-04): la micro-observación del cierre cuenta como insight
// mostrado UNA vez por día (por sesión), no en cada re-render de Hoy.
let readingTrackedDay: string | null = null

/*
 * "Tu día" — la única tarjeta de lectura de Hoy (dirección de arte + ux sep
 * 2026). Una sola vestimenta de vidrio y una sola voz que cambia con la
 * franja: de día la lectura sin número, desde las 20:00 el cierre con la
 * cifra, y cuando hay Lectura Semanal sin abrir, ella toma la tarjeta.
 * La prioridad vive en ../tu-dia.ts (puro). Tap → Órbita Día (el porqué) o
 * la Lectura Semanal. Sin comida registrada, no existe.
 */
export function TuDiaCard({
  consumedCalories,
  targetCalories,
  mealCount,
  closeReading,
}: {
  consumedCalories: number
  targetCalories: number | null | undefined
  mealCount: number
  /** Micro-observación real del motor (early-readings) para el cierre. */
  closeReading?: string | null
}) {
  const router = useRouter()
  const hour = useLocalHour()

  // Lectura Semanal (V-06): solo mientras hay lectura de la semana cerrada
  // sin abrir; la pantalla marca opened_at y la invalidación la apaga.
  // DOBLE-gateada como toda la Lectura Semanal.
  const { session } = useSession()
  const readingOn = WEEKLY_READING_ENABLED && aiEnabledForEmail(session?.user?.email)
  const weekly = useWeeklyReading(readingOn)
  const weeklyReadingReady =
    readingOn && weekly.data?.reading != null && weekly.data?.openedAt == null

  const model = tuDiaModel({
    consumedCalories,
    targetCalories,
    mealCount,
    hour,
    weeklyReadingReady,
    closeReading,
  })

  const closeWithReading = model?.kind === 'close' && model.reading != null
  useEffect(() => {
    if (!closeWithReading) return
    const day = new Date().toDateString()
    if (readingTrackedDay === day) return
    readingTrackedDay = day
    track('insight_shown', { source: 'early_reading', tier: 'reflexion' })
  }, [closeWithReading])

  if (!model) return null

  const onPress = () => {
    if (model.kind === 'weekly') {
      // La pantalla emite insight_shown y marca opened_at: un solo
      // insight_opened por lectura, así que aquí no se trackea.
      router.push('/weekly-reading')
      return
    }
    track('insight_opened', { source: 'day_reading', target: 'orbit_dia' })
    router.navigate('/orbit')
  }

  const gold = model.kind === 'close' && model.verdict.kind === 'deficit'
  const a11y =
    model.kind === 'close'
      ? `${model.eyebrow}. ${model.title} ${model.line}${model.reading ? ` ${model.reading}` : ''}. Abre Descubre.`
      : model.kind === 'weekly'
        ? 'Tu lectura semanal está lista. Ábrela.'
        : `${model.eyebrow}. ${model.title} ${model.line} Abre Descubre.`

  return (
    <Animated.View entering={FadeIn.duration(420)} style={styles.card}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={({ pressed }) => pressed && { opacity: 0.82 }}
      >
        <View style={styles.headRow}>
          <View style={styles.headLeft}>
            {/* La marca del cierre: estrella oro si el día quedó dorado,
                brasa neutra si no (mismo lenguaje que el calendario del mes). */}
            {model.kind === 'close' ? (
              gold ? (
                <View style={styles.starGlow}>
                  <View style={styles.starBody} />
                </View>
              ) : (
                <View style={styles.ember} />
              )
            ) : null}
            <EyebrowLabel tone={gold ? 'bone' : 'niebla'} size={10}>
              {model.eyebrow}
            </EyebrowLabel>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>

        {model.kind === 'weekly' ? (
          // El titular es la voz de la lectura (serif italic), como en la
          // card de Órbita Semana — es el mismo objeto asomado en dos lugares.
          <Text style={styles.weeklyTitle}>{model.title}</Text>
        ) : (
          <Text style={styles.data}>{model.title}</Text>
        )}

        <Text
          style={[
            styles.line,
            model.kind === 'close' && styles.lineCoach,
            model.kind === 'close' && gold && styles.lineGold,
          ]}
        >
          {model.line}
        </Text>

        {model.kind === 'close' && model.reading ? (
          <Text style={styles.reading}>{model.reading}</Text>
        ) : null}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Receta "vidrio" (dirección de arte sep 2026): translúcida, las estrellas
  // del fondo siguen pasando por debajo; sin borde oro.
  card: {
    backgroundColor: colors.lecheTint,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.hairlineFaint,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chevron: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
  },
  // Estrella dorada (día en déficit) — miniatura del tratamiento del
  // calendario de Órbita Mes: el único estado que emite luz.
  starGlow: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.oroGlow,
  },
  starBody: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.oroLight,
  },
  // Brasa neutra (superávit / muy bajo) — descansa, no alarma.
  ember: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.bone,
    opacity: 0.55,
  },
  // El titular: de día una frase, de noche los números literales.
  data: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  weeklyTitle: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.heading,
    color: colors.leche,
  },
  line: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // La línea del cierre es la voz del coach (serif italic).
  lineCoach: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
  },
  lineGold: {
    color: colors.oroLight,
  },
  // La micro-observación — dato en UI upright (no voz de coach), separada
  // del veredicto por un respiro; discreta, nunca compite con el número.
  reading: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
})
