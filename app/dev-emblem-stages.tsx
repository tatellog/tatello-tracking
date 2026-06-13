import { FlatList, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { DevBackButton } from '@/components/DevBackButton'
import { LunarConstellation, SkyBackground } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

/*
 * Dev-only — catálogo de TODOS los estados de Leo: el hero completo
 * (Emblema Celeste raster + constelación natal) renderizado a distintas
 * combinaciones de (entrenos, % de transformación), sin tener que mover
 * datos en la base.
 *
 * Dos sistemas INDEPENDIENTES conviven en el hero:
 *   · Constelación — estrellas magenta, sube con los entrenos del mes.
 *   · Emblema — el león dorado que se va FORMANDO con los hábitos
 *     acumulados (transformProgress, reveal por luminancia).
 * Por eso el catálogo incluye la "diagonal" (ambos crecen juntos) y dos
 * casos desacoplados que prueban que un sistema no revela el otro.
 *
 * Route: /dev-emblem-stages
 */

const TARGET = 28

// Grid de `n` días completados (primeros n true) — enciende n estrellas.
function grid(n: number): boolean[] {
  return Array.from({ length: TARGET }, (_, i) => i < n)
}

type LeoState = {
  id: string
  /** Entrenos del mes (estrellas encendidas). */
  trained: number
  /** % de transformación del emblema (reveal del león). */
  emblem: number
  label: string
  note?: string
}

const STATES: readonly LeoState[] = [
  {
    id: 'calma',
    trained: 0,
    emblem: 0,
    label: 'Calma',
    note: 'Cielo en reposo · nada se ha encendido aún.',
  },
  {
    id: 'd1',
    trained: 1,
    emblem: 8,
    label: 'Primer hábito',
    note: 'Una chispa nace · el emblema despierta.',
  },
  {
    id: 'd2',
    trained: 3,
    emblem: 22,
    label: 'Toma forma',
    note: 'Aparecen las primeras líneas del león.',
  },
  {
    id: 'd3',
    trained: 8,
    emblem: 40,
    label: 'Se dibuja',
    note: 'El aro asienta · el león se reconoce.',
  },
  { id: 'd4', trained: 14, emblem: 60, label: 'Se revela', note: 'Melena y trazos más definidos.' },
  { id: 'd5', trained: 21, emblem: 82, label: 'Casi entero', note: 'El león casi resplandece.' },
  {
    id: 'd6',
    trained: 28,
    emblem: 100,
    label: 'Completo',
    note: 'Constelación llena + emblema pleno.',
  },
  // Desacoplados — los sistemas son independientes:
  {
    id: 'habit-no-gym',
    trained: 4,
    emblem: 100,
    label: 'Hábitos sin gym',
    note: 'Emblema 100% con la constelación a medias.',
  },
  {
    id: 'gym-no-habit',
    trained: 28,
    emblem: 20,
    label: 'Gym sin hábitos',
    note: 'Constelación llena con el emblema apenas formándose.',
  },
]

function renderState({ item }: { item: LeoState }) {
  return (
    <View style={styles.card}>
      <View style={styles.constellationWrap}>
        <LunarConstellation
          trained={grid(item.trained)}
          todayIdx={Math.max(0, item.trained - 1)}
          target={TARGET}
          sign="leo"
          committed
          showCount={false}
          suppressBurst
          transformProgressOverride={item.emblem}
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.label}>{item.label}</Text>
        <Text style={styles.metrics}>
          emblema {item.emblem}% · constelación {item.trained}/{TARGET}
        </Text>
        {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
      </View>
    </View>
  )
}

export default function DevEmblemStagesScreen() {
  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DevBackButton />
        <View style={styles.header}>
          <Text style={styles.title}>Leo · todos los estados</Text>
          <Text style={styles.subtitle}>Emblema (reveal) + constelación (entrenos)</Text>
        </View>
        {/* Cada celda es un LunarConstellation completo (Skia + ~100
            worklets); FlatList virtualiza agresivo para no trabar al
            montar. */}
        <FlatList
          data={STATES}
          keyExtractor={(s) => s.id}
          renderItem={renderState}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          initialNumToRender={1}
          maxToRenderPerBatch={1}
          windowSize={2}
          removeClippedSubviews
        />
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    letterSpacing: 0.6,
  },
  subtitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    color: colors.niebla,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  card: {
    marginBottom: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  constellationWrap: {
    aspectRatio: 1,
    width: '100%',
  },
  info: {
    marginTop: 6,
    alignItems: 'center',
  },
  label: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroLeche,
  },
  metrics: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.4,
    color: colors.bruma,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  note: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.bone,
    marginTop: 6,
    textAlign: 'center',
  },
})
