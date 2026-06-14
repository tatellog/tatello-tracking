import { Stack } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { DevBackButton } from '@/components/DevBackButton'
import { PatternReveal } from '@/features/patterns'
import type { PatternType } from '@/features/patterns/logic'
import { useProfile } from '@/features/profile/hooks'
import {
  patternRevelationCopy,
  RETURN_COPY,
  TransformationReveal,
  transformationCopy,
} from '@/features/revelations'
import { SkyBackground } from '@/features/tabs/components'
import { ZODIAC, zodiacFromDate } from '@/features/tabs/zodiac'
import { colors, typography } from '@/theme'

/*
 * Dev-only — dispara cada Revelación on-demand para QA, SIN pasar por la
 * detección, los rate-limits ni la DB. Reusa los componentes reales
 * (TransformationReveal / PatternReveal) y el copy puro, así lo que ves
 * aquí es lo que la usuaria vería. Se llega desde Ajustes (gateado is_dev).
 *
 * Nota: PatternReveal tiene un delay de aparición propio (~1.8 s para
 * patrones, ~0.45 s para regreso) — es el comportamiento real, no un bug.
 */

// Conteos de muestra para el copy con conteos (no afectan la detección).
const SAMPLE = { protein: 5, training: 4, sleep: 5, night: 5, window: 7 } as const

type Active =
  | { mode: 'transformation'; threshold: number; message: string }
  | { mode: 'pattern'; type: PatternType; message: string }

export default function DevRevelations() {
  const { data: profile } = useProfile()
  const sign = zodiacFromDate(profile?.date_of_birth)
  const signLabel = ZODIAC[sign].label

  const [active, setActive] = useState<Active | null>(null)
  const close = () => setActive(null)

  const showTransformation = (threshold: number) =>
    setActive({
      mode: 'transformation',
      threshold,
      message: transformationCopy(threshold as 25 | 50 | 75 | 100, signLabel).message,
    })
  const showPattern = (type: PatternType, message: string) =>
    setActive({ mode: 'pattern', type, message })

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Revelaciones' }} />
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DevBackButton />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Revelaciones · QA</Text>
          <Text style={styles.subtitle}>
            Dispara cada momento full-screen. Usa tu signo ({signLabel}).
          </Text>

          <Section label="T1 · Transformación" />
          {[25, 50, 75, 100].map((t) => (
            <DevButton
              key={t}
              label={`Transformación ${t}%`}
              onPress={() => showTransformation(t)}
            />
          ))}

          <Section label="T2 · Regreso" />
          <DevButton
            label="Regreso (3+ días fuera)"
            onPress={() => showPattern('abandonment', RETURN_COPY.message)}
          />

          <Section label="T3 · Patrones positivos" />
          <DevButton
            label={`Proteína constante (${SAMPLE.protein}/${SAMPLE.window})`}
            onPress={() =>
              showPattern(
                'protein_consistent',
                patternRevelationCopy('protein_consistent', SAMPLE.protein, SAMPLE.window).message,
              )
            }
          />
          <DevButton
            label={`Entrenamiento (${SAMPLE.training}/${SAMPLE.window})`}
            onPress={() =>
              showPattern(
                'training_consistent',
                patternRevelationCopy('training_consistent', SAMPLE.training, SAMPLE.window)
                  .message,
              )
            }
          />
          <DevButton
            label={`Sueño estable (${SAMPLE.sleep}/${SAMPLE.window})`}
            onPress={() =>
              showPattern(
                'sleep_consistent',
                patternRevelationCopy('sleep_consistent', SAMPLE.sleep, SAMPLE.window).message,
              )
            }
          />

          <Section label="T3 · Noticing" />
          <DevButton
            label={`Comida nocturna (${SAMPLE.night}/${SAMPLE.window})`}
            onPress={() =>
              showPattern(
                'night_eating',
                patternRevelationCopy('night_eating', SAMPLE.night, SAMPLE.window).message,
              )
            }
          />
        </ScrollView>
      </SafeAreaView>

      {/* El reveal real, por encima de todo. */}
      {active?.mode === 'transformation' ? (
        <TransformationReveal
          sign={sign}
          threshold={active.threshold}
          message={active.message}
          onClose={close}
        />
      ) : active ? (
        <PatternReveal
          pattern={{ id: 'dev', type: active.type, message: active.message }}
          onClose={close}
        />
      ) : null}
    </View>
  )
}

function Section({ label }: { label: string }) {
  return <Text style={styles.section}>{label}</Text>
}

function DevButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 60 },
  title: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    marginTop: 2,
    marginBottom: 8,
  },
  section: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginTop: 22,
    marginBottom: 8,
  },
  button: {
    marginBottom: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(217, 174, 111, 0.4)',
    backgroundColor: 'rgba(217, 174, 111, 0.06)',
  },
  buttonPressed: { opacity: 0.6 },
  buttonText: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    letterSpacing: 0.4,
  },
})
