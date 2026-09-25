import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { useWeeklyReading } from '@/features/orbit/weekly-reading-hooks'
import { useSession } from '@/hooks/useSession'
import { aiEnabledForEmail, WEEKLY_READING_ENABLED } from '@/lib/featureFlags'
import { colors, typography } from '@/theme'

/*
 * "Tu lectura está lista" — la entrada de la Lectura Semanal en Hoy (V-06).
 * Aparece SOLO mientras hay lectura de la semana cerrada sin abrir
 * (opened_at null) y se retira sola al abrirla: la pantalla marca opened_at
 * y la invalidación de la query apaga esta tira. Ganada, nunca recordatorio:
 * sin lectura (silencio honesto del motor) o ya leída, la tira no existe.
 *
 * Tap → /weekly-reading (la misma promesa que N8; la pantalla emite
 * insight_shown y marca opened_at, así que aquí no se trackea nada: un solo
 * insight_opened por lectura). DOBLE-gateada como toda la Lectura Semanal.
 */
export function WeeklyReadingStrip() {
  const router = useRouter()
  const { session } = useSession()
  const readingOn = WEEKLY_READING_ENABLED && aiEnabledForEmail(session?.user?.email)
  const q = useWeeklyReading(readingOn)
  const reading = q.data?.reading ?? null

  if (!readingOn || reading == null || q.data?.openedAt != null) return null

  return (
    <Animated.View entering={FadeIn.duration(420)} style={styles.card}>
      <Pressable
        onPress={() => router.push('/weekly-reading')}
        accessibilityRole="button"
        accessibilityLabel="Tu lectura semanal está lista. Ábrela."
        style={({ pressed }) => pressed && { opacity: 0.82 }}
      >
        <View style={styles.headRow}>
          <EyebrowLabel tone="niebla" size={10}>
            Tu lectura semanal
          </EyebrowLabel>
          <Text style={styles.chevron}>›</Text>
        </View>
        <Text style={styles.title}>Tu lectura está lista.</Text>
        <Text style={styles.line}>Lo que tu semana pasada dejó ver.</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Misma vestimenta que DayReadingStrip/DayCloseCard (la familia de
  // lecturas de Hoy); el borde oro marca lo GANADO sin abrir, igual que la
  // card de Órbita Semana.
  card: {
    marginTop: 14,
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    paddingHorizontal: 18,
    paddingVertical: 16,
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
  // El titular es la voz de la lectura (serif italic), como en la card de
  // Órbita Semana — es el mismo objeto asomado en dos lugares.
  title: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.heading,
    color: colors.leche,
  },
  line: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
