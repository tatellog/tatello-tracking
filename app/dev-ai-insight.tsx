import { Stack } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { DevBackButton } from '@/components/DevBackButton'
import { StarLoader } from '@/components/StarLoader'
import { withDevGuard } from '@/components/withDevGuard'
import { fetchAiVoice, type AiVoiceFeature, type AiVoicePeriod } from '@/features/orbit/ai-voice'
import type { VozParte } from '@/features/orbit/mock'
import { SkyBackground } from '@/features/tabs/components'
import { useSession } from '@/hooks/useSession'
import { aiEnabledForEmail } from '@/lib/featureFlags'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

/*
 * Dev-only — prueba el pipeline de IA end-to-end (AI Foundation): Context
 * Engine → Prompt Builder → edge stelar-insight → gpt-4o-mini → caché. Elige
 * un periodo y muestra la voz devuelta + si vino del caché (segunda llamada
 * al mismo periodo NO debe re-llamar la IA: cached=true).
 *
 * Requiere: el flag AI_VOICE_ENABLED en true Y la edge function desplegada
 * (`supabase functions deploy stelar-insight`). Funciona en Expo Go (es solo
 * un fetch, sin módulo nativo). Gateado is_dev — invisible a las usuarias.
 */

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

type Preset = {
  label: string
  feature: AiVoiceFeature
  periodType: AiVoicePeriod
  range: () => { start: string; end: string }
}

const PRESETS: Preset[] = [
  {
    label: 'Este mes (Órbita Mes)',
    feature: 'orbita_mes',
    periodType: 'month',
    range: () => {
      const today = todayInTimezone()
      return { start: `${today.slice(0, 7)}-01`, end: today }
    },
  },
  {
    label: 'Esta semana (Órbita Semana)',
    feature: 'orbita_semana',
    periodType: 'week',
    range: () => {
      const today = todayInTimezone()
      return { start: shiftDate(today, -6), end: today }
    },
  },
  {
    label: 'Últimos 30 días (Progreso)',
    feature: 'progreso',
    periodType: 'last30',
    range: () => {
      const today = todayInTimezone()
      return { start: shiftDate(today, -29), end: today }
    },
  },
]

export default withDevGuard(DevAiInsight)

function DevAiInsight() {
  const { session } = useSession()
  const aiOn = aiEnabledForEmail(session?.user?.email)
  const [loading, setLoading] = useState<string | null>(null)
  const [result, setResult] = useState<{ voz: VozParte[]; meta: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (p: Preset) => {
    setLoading(p.label)
    setError(null)
    setResult(null)
    const t0 = Date.now()
    const { start, end } = p.range()
    const voz = await fetchAiVoice({
      feature: p.feature,
      periodType: p.periodType,
      periodStart: start,
      periodEnd: end,
    })
    const ms = Date.now() - t0
    setLoading(null)
    if (!voz) {
      setError(
        `Sin respuesta (${ms} ms). ¿Desplegaste stelar-insight? ¿Hay datos en ${start}…${end}?`,
      )
      return
    }
    setResult({ voz, meta: `${start} → ${end} · ${ms} ms` })
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Voz de IA' }} />
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DevBackButton />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Voz de IA · QA</Text>
          <Text style={styles.subtitle}>
            Prueba el pipeline completo (contexto → prompt → gpt-4o-mini → caché). La segunda
            llamada al mismo periodo debe venir del caché. IA para tu cuenta:{' '}
            {aiOn ? 'ON' : 'OFF (esta cuenta no la ve en Órbita)'}.
          </Text>

          {PRESETS.map((p) => (
            <Pressable
              key={p.label}
              onPress={() => void run(p)}
              disabled={loading != null}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.button,
                loading != null && styles.disabled,
                pressed && styles.buttonPressed,
              ]}
            >
              {loading === p.label ? (
                <StarLoader size={16} color={colors.bone} />
              ) : (
                <Text style={styles.buttonText}>{p.label}</Text>
              )}
            </Pressable>
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {result ? (
            <View style={styles.card}>
              <Text style={styles.cardMeta}>{result.meta}</Text>
              {result.voz.map((v, i) => (
                <Text
                  key={i}
                  style={[
                    styles.voz,
                    v.tone === 'accent' && styles.vozAccent,
                    v.tone === 'strong' && styles.vozStrong,
                  ]}
                >
                  {v.text}
                </Text>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
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
    lineHeight: 17,
    color: colors.niebla,
    marginTop: 4,
    marginBottom: 14,
  },
  button: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(217, 174, 111, 0.4)',
    backgroundColor: 'rgba(217, 174, 111, 0.06)',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0.4,
    color: colors.bone,
  },
  buttonPressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  error: {
    marginTop: 12,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 17,
    color: colors.feedbackError,
  },
  card: {
    marginTop: 16,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  cardMeta: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.4,
    color: colors.bruma,
    marginBottom: 10,
  },
  voz: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 24,
    color: colors.bone,
    marginBottom: 6,
  },
  vozAccent: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    color: colors.magenta,
  },
  vozStrong: {
    fontFamily: typography.uiBold,
    color: colors.leche,
  },
})
