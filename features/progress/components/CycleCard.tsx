import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import {
  CycleNextMilestone,
  CyclePhaseHero,
  CycleTimeline,
} from '@/features/cycle/components/CycleTimeline'
import {
  cyclePhaseFromPeriod,
  type CyclePhase,
  DEFAULT_CYCLE_LENGTH,
  isCycleActive,
} from '@/features/cycle/phase'
import { useProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

import { useLastPeriodStart } from '../hooks'

// One read-only context line per phase (the user asked for "más
// información"). Vetted by behavioral-specialist + voice-and-copy against
// cycle-voice-spec: período/semana-antes carry the anti-culpa-de-balanza
// message (water, not fat); the calm phases speak only in POBLACIONAL,
// conditional voice ("a algunas", "muchas") — never "tu energía/tu cuerpo"
// about a suggestible state, to avoid a nocebo / horoscope read. Only the
// ACTIVE phase's line shows, never all four at once.
// NOTE: do NOT add antojo/ánimo to the lútea line without re-running it
// through behavioral-specialist — it's the highest nocebo-risk phase.
const PHASE_NOTE: Record<CyclePhase, string> = {
  menstrual:
    'Estos días tu cuerpo retiene más agua. Si la balanza sube, no es grasa: es tu ciclo. No dejes que el número te diga cómo vas.',
  folicular:
    'A algunas les vuelve algo de energía por acá. Si lo sientes, es tuyo. Si no, también está bien.',
  ovulatoria: 'Es el punto medio de tu ciclo. Muchas notan más energía por estos días.',
  lutea:
    'Tu cuerpo puede retener algo de agua estos días. Es normal y se va. No dejes que el número te diga cómo vas.',
}

const MONTHS_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

// Días de hoy al próximo período = length - day + 1. Estimación, nunca
// pronóstico: vive como dato objetivo en el bloque calmo, no como countdown.
function formatNextPeriod(day: number, length: number): string {
  const d = new Date()
  d.setDate(d.getDate() + (length - day + 1))
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]}`
}

// Campo estelar fantasma — puntos estáticos muy tenues SOLO en el espacio
// negativo (esquinas/bordes), nunca sobre texto. Estático = sin bug de
// Android, coste cero. Asimetría intencional.
const STARFIELD: { x: string; y: string; r: number; o: number }[] = [
  { x: '8%', y: '14%', r: 1, o: 0.1 },
  { x: '93%', y: '9%', r: 0.8, o: 0.07 },
  { x: '50%', y: '5%', r: 0.6, o: 0.05 },
  { x: '4%', y: '52%', r: 0.7, o: 0.06 },
  { x: '96%', y: '44%', r: 0.8, o: 0.08 },
  { x: '14%', y: '90%', r: 0.7, o: 0.07 },
  { x: '89%', y: '83%', r: 1, o: 0.09 },
  { x: '68%', y: '95%', r: 0.6, o: 0.05 },
]

function Starfield() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      {STARFIELD.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={colors.leche} opacity={s.o} />
      ))}
    </Svg>
  )
}

// Separador de carta celeste — dos hairlines oro con una estrellita al centro.
// Sin rotaciones → seguro en Android.
function StarDivider() {
  return (
    <Svg width={80} height={8} viewBox="0 0 80 8" style={styles.starDivider}>
      <Path d="M2 4 H32" stroke={colors.oro} strokeWidth={0.5} opacity={0.5} />
      <Path
        d="M40 1.5 L41 3.5 L43 4 L41 4.5 L40 6.5 L39 4.5 L37 4 L39 3.5 Z"
        fill={colors.oro}
        opacity={0.9}
      />
      <Path d="M48 4 H78" stroke={colors.oro} strokeWidth={0.5} opacity={0.5} />
    </Svg>
  )
}

// Una columna de la tira de efemérides: label tiny arriba + valor abajo. El
// punto oro (accent) ata "evento futuro estimado" con la fila "Próximo".
function EphemCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.ephemCell}>
      <Text style={styles.ephemLabel} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.ephemValueRow}>
        {accent ? <View style={styles.ephemDot} /> : null}
        <Text style={styles.ephemValue}>{value}</Text>
      </View>
    </View>
  )
}

/* ─────────────────────── Component ─────────────────────── */

/**
 * Tarjeta de ciclo — visible only when the user's cycle is active
 * (menstruates / contraception / irregular). Reads the last period_start
 * from cycle_events + the cycle_length_days from the profile and surfaces
 * the FULL journey: where you are (hero), the horizontal timeline (where
 * you've been / are / what's next), the next milestone, the per-phase coach
 * line, and an objective "Este ciclo" ephemeris strip. The compact glance of
 * the same data lives on the Hoy slider (shared CycleTimeline components).
 *
 * For users that menstruate, this is often a more orienting datum than
 * weight — they can read training / nutrition / mood against it.
 */
export function CycleCard() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const { data: lastPeriod } = useLastPeriodStart()

  const isActive = isCycleActive(profile?.biological_sex, profile?.cycle_situation)
  const cycleLength = profile?.cycle_length_days ?? DEFAULT_CYCLE_LENGTH

  const state = useMemo(() => {
    if (!isActive) return null
    const cp = cyclePhaseFromPeriod(lastPeriod, cycleLength)
    if (!cp) return null
    return { day: cp.day, length: cycleLength, phaseKey: cp.phase }
  }, [isActive, lastPeriod, cycleLength])

  if (!isActive) return null

  // No period logged yet — the user picked a cycle situation in onboarding
  // but the last-period date is optional and was skipped. The card is the
  // right place to invite it (the value is visible here), so it's TAPPABLE
  // and routes straight to the cycle editor — never to a dead-end "Ajustes →
  // Mi perfil" that has no cycle field.
  if (!state) {
    return (
      <Animated.View entering={FadeIn.duration(360).delay(320)}>
        <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
          Tu ciclo
        </EyebrowLabel>
        <Pressable
          onPress={() => router.push('/onboarding/cycle?source=settings')}
          accessibilityRole="button"
          accessibilityLabel="Anclar mi última menstruación"
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <Text style={styles.emptyHint}>
            Dime tu última menstruación y Stelar marca tu día del ciclo. Toca para anclarla.
          </Text>
        </Pressable>
      </Animated.View>
    )
  }

  const phaseNote = PHASE_NOTE[state.phaseKey]
  const nextPeriod = formatNextPeriod(state.day, state.length)

  return (
    <Animated.View entering={FadeIn.duration(360).delay(320)}>
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Tu ciclo
      </EyebrowLabel>
      <LinearGradient
        colors={[colors.bgCard2, colors.bgCard, colors.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.card}
      >
        <Starfield />
        <CyclePhaseHero
          phase={state.phaseKey}
          day={state.day}
          length={state.length}
          align="center"
        />
        <CycleTimeline phase={state.phaseKey} />
        <CycleNextMilestone day={state.day} length={state.length} />

        <Text style={styles.coachLine}>{phaseNote}</Text>

        <View style={styles.summary}>
          <StarDivider />
          <Text style={styles.summaryTitle}>Este ciclo</Text>
          <View style={styles.ephemRow}>
            <EphemCell label="Duración" value={`${state.length} días`} />
            <View style={styles.ephemDivider} />
            <EphemCell label="Período" value="Registrado" />
            <View style={styles.ephemDivider} />
            <EphemCell label={'Próximo\nestimado'} value={nextPeriod} accent />
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  eyebrow: {
    marginBottom: 14,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
  },
  cardPressed: {
    opacity: 0.6,
  },
  // Coach line — the anti-culpa-de-balanza message. Cormorant italic (coach
  // voice), warm, only present in the two phases that move the scale.
  coachLine: {
    marginTop: 20,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    lineHeight: 23,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  // "Este ciclo" — efemérides objetivas (3 columnas con divisores oro). Nunca
  // un titular; lectura calma del cielo, no una tabla de Ajustes.
  summary: {
    marginTop: 18,
    paddingTop: 6,
  },
  starDivider: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
    textAlign: 'center',
    marginBottom: 14,
  },
  ephemRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  ephemCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  ephemDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.oroHairlineSoft,
    marginVertical: 2,
  },
  ephemLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.niebla,
    textAlign: 'center',
    minHeight: 24,
    lineHeight: 12,
  },
  ephemValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  ephemDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.oro,
  },
  ephemValue: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  emptyHint: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.bone,
    textAlign: 'center',
    paddingVertical: 8,
  },
})
