import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { useMacroTargets } from '@/features/macros/hooks'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { detectMonthPatterns } from '@/features/orbit/month-built'
import { requestOrbitSegment } from '@/features/orbit/pending-segment'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

const WINDOW = 30
// Por debajo de esto NO insistimos: el mes apenas se forma y un "patrón" sería ruido.
const MIN_ACTIVE = 7

/*
 * Lectura — UNA observación destilada de los últimos 30 días, en voz
 * Observadora (describe, NUNCA aconseja ni califica). Reemplaza el viejo
 * scoreboard de "Consistencia": en vez de "qué tan seguido registraste",
 * nombra un patrón REAL en tus datos y abre la puerta a Órbita (su hogar
 * canónico). Reusa el MISMO motor del segmento Mes (detectMonthPatterns) —
 * copy ya vetado por la cadena de voz; aquí solo se destila el titular.
 */
export function ReadingCard() {
  const router = useRouter()
  const signals = useSignalsHistory(WINDOW)
  const targets = useMacroTargets().data
  const proteinTarget = targets?.protein_g ?? null
  const calorieTarget = targets?.calories ?? null

  const rows = useMemo(() => signals.data ?? [], [signals.data])
  const lead = useMemo(() => {
    const patterns = detectMonthPatterns(rows, { proteinTarget, calorieTarget })
    // El titular: preferimos un PATRÓN (forma temporal / correlación: el "lever")
    // sobre un DESCUBRIMIENTO (constancia). El primero del orden ya es el más fuerte.
    return patterns.find((p) => p.kind === 'pattern') ?? patterns[0] ?? null
  }, [rows, proteinTarget, calorieTarget])

  const activeDays = useMemo(() => rows.filter((s) => s.day != null).length, [rows])

  if (signals.isLoading) return null
  if (!lead && activeDays < MIN_ACTIVE) return null // muy pronto: ni ruido ni patrón inventado

  const openOrbita = () => {
    track('reading_open_orbita', { pattern: lead?.id ?? null })
    requestOrbitSegment('mes')
    router.push('/orbit')
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.card}>
      <EyebrowLabel tone="magenta" size={10}>
        Lectura
      </EyebrowLabel>
      <Text style={styles.subtitle}>Tus últimos 30 días</Text>

      {lead ? (
        <>
          <Text style={styles.title}>{lead.title}</Text>
          {lead.why ? <Text style={styles.why}>{lead.why}</Text> : null}
          <Pressable
            onPress={openOrbita}
            accessibilityRole="button"
            accessibilityLabel="Ver más en Órbita"
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaText}>Ver más en Órbita</Text>
            <Text style={styles.ctaArrow}>→</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.empty}>Sigo juntando tus días. Poco a poco voy a ver tus ritmos.</Text>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  subtitle: {
    marginTop: 6,
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  // La observación — voz Observadora, Cormorant italic. El "haz visible lo invisible".
  title: {
    marginTop: 14,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.heading,
    lineHeight: 25,
    color: colors.leche,
  },
  // El "so what" — por qué te sirve. Hanken, secundario, niebla.
  why: {
    marginTop: 10,
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
  },
  cta: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ctaPressed: { opacity: 0.6 },
  ctaText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.magenta,
  },
  ctaArrow: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.magenta,
  },
  empty: {
    marginTop: 14,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.bone,
  },
})
