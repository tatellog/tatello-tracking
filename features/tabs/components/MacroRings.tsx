import { useRouter } from 'expo-router'
import { type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import type { BriefContext } from '@/features/brief/api'
import { PHASE_LABEL } from '@/features/cycle/phase'
import { useCyclePhase } from '@/features/cycle/useCyclePhase'
import { enfoqueLabel, reconstructState } from '@/features/profile/calcMacros'
import { useMacroInputs } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

import { RingCard } from './RingCard'

/*
 * Los macros del día en Hoy — los dos anillos, siempre visibles, sin pager
 * (dirección de arte + ux sep 2026: el carrusel escondía el dato más
 * consultado detrás de un swipe y competía con el scroll). Proteína es la
 * única luz; calorías va en neutro. Debajo, para quien trackea su ciclo,
 * una sola línea de contexto (el detalle vive en Progreso).
 */
export function MacroRings({ ctx }: { ctx: BriefContext }) {
  const router = useRouter()
  const cycle = useCyclePhase()
  // Tocar una tarjeta abre el editor de METAS (reusa la pantalla validada que
  // ya usan Comidas/Ajustes). source=settings → vuelve atrás a Hoy al guardar.
  const editTargets = () => router.push('/onboarding/macro-targets?source=settings')

  return (
    <View>
      <View style={styles.header}>
        <EyebrowLabel tone="niebla">Macros</EyebrowLabel>
        {ctx.targets ? <EnfoqueChip targetCalories={ctx.targets.calories} /> : null}
      </View>

      {ctx.targets ? (
        <MacroRow ctx={ctx} targets={ctx.targets} onPress={editTargets} />
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Configura tus metas para ver tus macros.</Text>
        </View>
      )}

      {cycle ? (
        <Text
          style={styles.cycleLine}
          accessibilityLabel={`Tu ciclo: ${PHASE_LABEL[cycle.phase]}, día ${cycle.day} de ${cycle.length}`}
        >
          Tu ciclo · {PHASE_LABEL[cycle.phase]}
          <Text style={styles.cycleDim}>{` · día ${cycle.day} de ${cycle.length}`}</Text>
        </Text>
      ) : null}
    </View>
  )
}

function MacroRow({
  ctx,
  targets,
  onPress,
}: {
  ctx: BriefContext
  targets: NonNullable<BriefContext['targets']>
  onPress: () => void
}) {
  // Calories — a speedometer gauge that exceeds when consumed > target. The
  // subtitle mirrors the protein card's compact "/ target unit" form; over-
  // target is a short, informational +N (the overflow arc already carries
  // the "you went over" without a verdict).
  const caloriesConsumed = ctx.today_macros.calories
  const caloriesTarget = targets.calories
  const calOver = Math.max(0, Math.round(caloriesConsumed - caloriesTarget))
  const calSubtitle = calOver > 0 ? `+${calOver} kcal` : `/ ${caloriesTarget} kcal`

  // Línea honesta "cuánto te falta/queda" (copy autorizado para macros). Al
  // cumplir, voz cálida — NO checklist: proteína "cerrada", calorías "En tu
  // meta". Si te pasaste, el +N del subtítulo ya lo dice solo (manifiesto).
  const proteinLeft = Math.max(0, Math.round(targets.protein_g - ctx.today_macros.protein_g))
  const proteinRemaining = proteinLeft > 0 ? `Te faltan ${proteinLeft} g` : 'Proteína cerrada'
  const calLeft = Math.max(0, Math.round(caloriesTarget - caloriesConsumed))
  const calRemaining = calOver > 0 ? null : calLeft > 0 ? `Te quedan ${calLeft} kcal` : 'En tu meta'

  return (
    <View style={styles.row}>
      <CardWrap enterDelay={120}>
        <RingCard
          label="Proteína"
          value={ctx.today_macros.protein_g}
          target={targets.protein_g}
          formatted={Math.round(ctx.today_macros.protein_g).toString()}
          unitSuffix={`/ ${targets.protein_g} g`}
          remainingText={proteinRemaining}
          ringColor={colors.magenta}
          ringDelay={400}
          onPress={onPress}
        />
      </CardWrap>
      <CardWrap enterDelay={280}>
        <RingCard
          speedometer
          label="Calorías"
          value={caloriesConsumed}
          target={caloriesTarget}
          formatted={Math.round(caloriesConsumed).toString()}
          unitSuffix={calSubtitle}
          remainingText={calRemaining}
          // Calorías es contexto, no presupuesto: renglón quiet, anillo neutro
          // (una sola luz en Hoy: proteína).
          remainingTone="quiet"
          ringColor={colors.niebla}
          ringDelay={600}
          small
          onPress={onPress}
        />
      </CardWrap>
    </View>
  )
}

/* ONE-SHOT ENTRANCE — a staggered FadeInDown so the two cards cascade in
 * (Proteína first, Calorías ~160 ms behind). The aliveness lives INSIDE the
 * ring (MacroRing's glow breath); the card itself stays still. */
function CardWrap({ enterDelay, children }: { enterDelay: number; children: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <Animated.View
      style={styles.cardWrap}
      entering={
        reduce
          ? FadeIn.duration(220).delay(enterDelay)
          : FadeInDown.delay(enterDelay).springify().damping(13).mass(0.7)
      }
    >
      {children}
    </Animated.View>
  )
}

/* Strategy chip in the header. Names the PLAN, never the day's live standing
 * (the intraday "Aún en déficit" was budget-semaphore framing). Pure status,
 * not a button: editing lives on the cards. Renders nothing without a TDEE. */
function EnfoqueChip({ targetCalories }: { targetCalories: number }) {
  const { inputs } = useMacroInputs()
  const state = reconstructState(targetCalories, inputs)
  if (!state) return null
  // "Tu enfoque" — mismo vocabulario que el editor ("ELIGE TU ENFOQUE").
  const label = `Tu enfoque: ${enfoqueLabel(state.enfoque, state.level)}`
  return (
    <View style={styles.enfoqueChip} accessibilityRole="text" accessibilityLabel={label}>
      <View style={styles.enfoqueDot} />
      <Text style={styles.enfoqueChipText}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // Salto de capítulo (ritmo 8/16/32/56): el único hueco grande de la página.
  header: {
    marginTop: 56,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  enfoqueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  enfoqueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.magenta,
  },
  enfoqueChipText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.micro,
    color: colors.bone,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  // `flex: 1` so the two wrapped cards share the row evenly (RingCard's own
  // column is `flex: 1`; mirrored here so wrapping doesn't collapse them).
  cardWrap: {
    flex: 1,
    minWidth: 0,
  },
  emptyCard: {
    backgroundColor: colors.lecheTint,
    borderColor: colors.hairlineFaint,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    color: colors.niebla,
    textAlign: 'center',
  },
  // Una línea de contexto, en la capa meta (Hanken, niebla): no compite con
  // los anillos ni se lee como card.
  cycleLine: {
    marginTop: 14,
    marginLeft: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    color: colors.bone,
  },
  cycleDim: {
    color: colors.niebla,
  },
})
