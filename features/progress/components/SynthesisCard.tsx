import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { useMacroTargets } from '@/features/macros/hooks'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { daysInDeficit, detectMonthPatterns } from '@/features/orbit/month-built'
import { requestOrbitSegment } from '@/features/orbit/pending-segment'
import { useMeasurements } from '@/features/progress/hooks'
import { smoothWeightPoints, toWeightPoints } from '@/features/progress/logic'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

const WINDOW = 30
// Por debajo de esto NO insistimos: el mes apenas se forma y un "patrón" sería ruido.
const MIN_ACTIVE = 7
// Descenso mínimo (suavizado 7d) para nombrar el resultado — bajo esto es ruido de báscula.
const MIN_DROP_KG = 0.2
// Días en déficit mínimos para nombrar la causa.
const MIN_DEFICIT_DAYS = 3

/** "~800 g" o "~1.1 kg" — redondeado a lo que la báscula sostiene (50 g). */
function dropLabel(kg: number): string {
  if (kg >= 1) return `~${kg.toFixed(1)} kg`
  return `~${Math.max(50, Math.round((kg * 1000) / 50) * 50)} g`
}

/*
 * Síntesis — evolución de la vieja ReadingCard, en el orden mental de la
 * usuaria (feedback beta: "todas las piezas existen pero están regadas y
 * un martes cansada no las armo"): RESULTADO → CAUSA → QUÉ INTENTAR.
 *
 *   1 · Resultado (oro, números literales): "Estos 30 días: ~1.1 kg menos."
 *       Solo cuando el peso BAJÓ de verdad; si no, el beat CALLA (una
 *       subida jamás se nombra aquí, jamás culpa) y la card abre con la
 *       causa como evidencia de esfuerzo.
 *   2 · Causa: "Tus 14 días en déficit lo sostuvieron." Co-ocurrencia en
 *       tono calmo, no afirmación de laboratorio.
 *   3 · Qué intentar: la Lectura (voz Observadora, motor del Mes) + el
 *       ÚNICO link saliente del tab ("cuarto, no pasillo").
 *
 * SIEMPRE sobre 30 días rodantes, independiente del chip de periodo de la
 * gráfica: el chip filtra la vista, no la historia.
 */
export function SynthesisCard() {
  const router = useRouter()
  const signals = useSignalsHistory(WINDOW)
  const targets = useMacroTargets().data
  const proteinTarget = targets?.protein_g ?? null
  const calorieTarget = targets?.calories ?? null

  // Peso de la MISMA ventana rodante (independiente del chip de la gráfica),
  // suavizado a 7 días — la misma vara que usa la sección Tu cuerpo.
  const measurements = useMeasurements(WINDOW)
  const drop = useMemo(() => {
    const smoothed = smoothWeightPoints(toWeightPoints(measurements.data ?? []))
    if (smoothed.length < 3) return null
    const first = smoothed[0]!
    const last = smoothed[smoothed.length - 1]!
    const kg = first.weight - last.weight
    return kg >= MIN_DROP_KG ? kg : null
  }, [measurements.data])

  const rows = useMemo(() => signals.data ?? [], [signals.data])
  const { lead, deficitDays, sideLabel, focoLabel } = useMemo(() => {
    const patterns = detectMonthPatterns(rows, { proteinTarget, calorieTarget })
    // El titular: preferimos un PATRÓN (forma temporal / correlación: el "lever")
    // sobre un DESCUBRIMIENTO (constancia). El primero del orden ya es el más fuerte.
    const leadP = patterns.find((p) => p.kind === 'pattern') ?? patterns[0] ?? null
    const summary = daysInDeficit(rows, { calorieTarget })
    const daytype = patterns.find((p) => p.id === 'deficit-daytype')
    const side = daytype?.weekdayShape
      ? daytype.weekdayShape.strongSide === 'weekday'
        ? 'entre semana'
        : 'el fin de semana'
      : null
    // El FOCO es el lado contrario al fuerte: donde el déficit se suelta es
    // donde vive la palanca (recomendación de foco, nunca de conducta).
    const foco = daytype?.weekdayShape
      ? daytype.weekdayShape.strongSide === 'weekday'
        ? 'el fin de semana'
        : 'entre semana'
      : null
    return {
      lead: leadP,
      deficitDays:
        summary != null && summary.deficitDays >= MIN_DEFICIT_DAYS ? summary.deficitDays : null,
      sideLabel: side,
      focoLabel: foco,
    }
  }, [rows, proteinTarget, calorieTarget])

  const activeDays = useMemo(() => rows.filter((s) => s.day != null).length, [rows])

  if (signals.isLoading) return null
  if (!lead && activeDays < MIN_ACTIVE) return null // muy pronto: ni ruido ni patrón inventado

  const openOrbita = () => {
    track('synthesis_open_orbita', { pattern: lead?.id ?? null })
    requestOrbitSegment('mes')
    router.push('/orbit')
  }

  // Beat 1 + 2 — el resultado y su causa. Si no hay descenso, el resultado
  // calla y la causa abre sola ("Estos 30 días: 14 días en déficit.").
  const resultLine = drop != null ? `Estos 30 días: ${dropLabel(drop)} menos.` : null
  const causeLine =
    deficitDays != null
      ? resultLine
        ? `Tus ${deficitDays} días en déficit lo sostuvieron${sideLabel ? `, sobre todo ${sideLabel}` : ''}.`
        : `Estos 30 días: ${deficitDays} días en déficit${sideLabel ? `, sobre todo ${sideLabel}` : ''}.`
      : null

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.card}>
      <EyebrowLabel tone="magenta" size={10}>
        Lectura
      </EyebrowLabel>
      <Text style={styles.subtitle}>Tus últimos 30 días</Text>

      {resultLine || causeLine ? (
        <View style={styles.proof}>
          {resultLine ? <Text style={styles.proofResult}>{resultLine}</Text> : null}
          {causeLine ? (
            <Text style={resultLine ? styles.proofCause : styles.proofResult}>{causeLine}</Text>
          ) : null}
        </View>
      ) : null}

      {lead ? (
        <>
          <Text style={styles.title}>{lead.title}</Text>
          {lead.why ? <Text style={styles.why}>{lead.why}</Text> : null}
          {/* Beat 3 · TU FOCO (deseo target-user: "que el domingo cierre con
              'esto es lo tuyo esta semana'"): SOLO cuando el patrón daytype
              existe — sin patrón no se inventa foco. Verbo de foco
              ("sostener"), jamás de conducta (la frontera del manifiesto:
              recomendar foco ✓, recetar dieta/rutina ✗). Hanken upright:
              es recomendación de motor, no poesía. Gate extra (manifesto-review,
              advertencia de coherencia): solo si la card YA narró el déficit
              (causeLine), para que el foco no aparezca desconectado. */}
          {focoLabel && deficitDays != null ? (
            <View style={styles.focusBlock}>
              <Text style={styles.focusEyebrow}>Tu foco</Text>
              <Text style={styles.focusText}>Esta semana: sostener {focoLabel}.</Text>
            </View>
          ) : null}
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
  // Resultado → causa: números literales en oro (jerarquía, no confetti) —
  // el mismo lenguaje del calendario dorado y del cierre del día.
  proof: {
    marginTop: 14,
    gap: 4,
  },
  proofResult: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  proofCause: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
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
  focusBlock: { marginTop: 14 },
  focusEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  focusText: {
    marginTop: 3,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
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
