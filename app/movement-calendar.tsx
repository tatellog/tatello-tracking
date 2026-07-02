import { useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MovementCalendarPanel } from '@/features/progress/components/MovementCalendarPanel'
import { TrainingShareCTA } from '@/features/progress/components/TrainingShareCTA'
import { SkyBackground } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

/*
 * Calendario de movimiento en pantalla completa — se abre desde el ícono de
 * calendario del header de Progreso (a la izquierda del gear). Contiene el
 * mismo `MovementCalendarPanel` (constelación de días entrenados + Historia)
 * más el CTA de Compartir. Presentado como modal (Cerrar arriba).
 */
export default function MovementCalendarScreen() {
  const router = useRouter()
  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Tu historia</Text>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
            <Text style={styles.close}>Cerrar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ErrorBoundary screen="movement-calendar">
            <MovementCalendarPanel />
            {/* Compartir — recomendada la Constelación (tu cielo), no el momento
                de hoy. Siempre disponible (historyMode), sin gate de "entrenaste hoy". */}
            <View style={styles.shareWrap}>
              <TrainingShareCTA historyMode />
            </View>
          </ErrorBoundary>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: 28,
    color: colors.leche,
    letterSpacing: -1.2,
  },
  close: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.magenta,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 60,
  },
  shareWrap: {
    marginTop: 24,
  },
})
