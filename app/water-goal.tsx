import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SkyBackground } from '@/features/tabs/components'
import { GLASS_ML, mlToLitresLabel, useWaterGoal } from '@/features/water/useWaterGoal'
import { colors, radius, typography } from '@/theme'

const WATER_PRESETS_ML = [1500, 2000, 2500, 3000] as const

export default function WaterGoalScreen() {
  return (
    <ErrorBoundary screen="agua">
      <WaterGoalBody />
    </ErrorBoundary>
  )
}

function WaterGoalBody() {
  const router = useRouter()
  const { goalMl, updateGoal } = useWaterGoal()
  const glasses = Math.max(1, Math.round(goalMl / GLASS_ML))

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={styles.back}
          >
            <Feather name="chevron-left" size={24} color={colors.leche} />
          </Pressable>
          <Text style={styles.title}>Agua</Text>
          <View style={styles.back} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Meta actual — grande y calmada. */}
          <View style={styles.hero}>
            <Text style={styles.heroNum}>
              {mlToLitresLabel(goalMl)}
              <Text style={styles.heroUnit}> L</Text>
            </Text>
            <Text style={styles.heroSub}>{glasses} vasos al día</Text>
          </View>

          <Text style={styles.eyebrow}>Elige tu meta diaria</Text>
          {/* La duda "¿se guardó?" muere aquí: contrato explícito (el hero de
              arriba ya refleja el cambio al instante, esto lo nombra). */}
          <Text style={styles.saveHint}>Se guarda al elegir.</Text>
          <View style={styles.presets}>
            {WATER_PRESETS_ML.map((ml) => {
              const active = goalMl === ml
              return (
                <Pressable
                  key={ml}
                  onPress={() => {
                    if (active) return
                    Haptics.selectionAsync().catch(() => {})
                    updateGoal(ml)
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${mlToLitresLabel(ml)} litros al día`}
                  style={({ pressed }) => [
                    styles.chip,
                    active && styles.chipActive,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {active ? '✓ ' : ''}
                    {mlToLitresLabel(ml)} L
                  </Text>
                  <Text style={[styles.chipGlasses, active && styles.chipTextActive]}>
                    {Math.max(1, Math.round(ml / GLASS_ML))} vasos
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <Text style={styles.note}>
            El agua acompaña tu energía y tu recuperación. Elige lo que sostengas, no lo más alto.
          </Text>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.title,
    color: colors.leche,
    letterSpacing: 0.2,
  },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  hero: { alignItems: 'center', marginBottom: 28 },
  heroNum: {
    fontFamily: typography.displayHeavy,
    fontSize: 52,
    letterSpacing: -2,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.segmentTitle,
    color: colors.bone,
  },
  heroSub: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 4,
  },
  saveHint: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.caption,
    color: colors.niebla,
    marginBottom: 12,
  },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // Contraste OLED (uxui jul 2026): bgCard sobre bg era luminancia casi nula
  // (los chips leían como texto suelto en pantalla real) y hairline al 10%
  // desaparecía. Idle sube a bgCard2 + hairlineStrong; el activo se dice en
  // MAGENTA (borde + fill 0.18 + texto), no con un bold imperceptible.
  chip: {
    flexGrow: 1,
    flexBasis: '47%',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.bgCard2,
  },
  chipActive: {
    borderColor: colors.magenta,
    backgroundColor: colors.magentaTint2,
  },
  chipPressed: { opacity: 0.7 },
  chipText: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.segmentTitle,
    letterSpacing: -0.5,
    color: colors.bone,
  },
  chipGlasses: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.niebla,
  },
  chipTextActive: { color: colors.magentaHot },
  note: {
    marginTop: 22,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
    textAlign: 'center',
  },
})
