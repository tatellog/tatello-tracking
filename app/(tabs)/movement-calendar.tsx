import { ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MovementCalendarPanel } from '@/features/progress/components/MovementCalendarPanel'
import { TrainingShareCTA } from '@/features/progress/components/TrainingShareCTA'
import { SkyBackground, TabHeader } from '@/features/tabs/components'
import { colors } from '@/theme'

/*
 * "Tu historia" — calendario de movimiento. Vive DENTRO de (tabs) como pantalla
 * oculta (href: null en el layout; AppTabBar la salta), así conserva la barra de
 * tabs y el header estándar. Se navega desde el ícono de calendario del header;
 * se sale por los tabs (sin botón "Cerrar").
 */
export default function MovementCalendarScreen() {
  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ErrorBoundary screen="movement-calendar">
            <TabHeader title="Tu historia" titleEmphasis="Tu" />
            <MovementCalendarPanel />
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120,
  },
  shareWrap: {
    marginTop: 24,
  },
})
