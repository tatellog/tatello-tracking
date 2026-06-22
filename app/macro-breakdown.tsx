import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { MacroPreviewCard } from '@/features/macros/components/MacroPreviewCard'
import { FlameIcon } from '@/features/macros/components/GoalIcons'
import {
  ACTIVITY_LABEL,
  computeTdee,
  macrosForDelta,
  reconstructState,
  levelsFor,
  type Enfoque,
} from '@/features/profile/calcMacros'
import { useMacroInputs } from '@/features/profile/hooks'
import { useMacroTargets } from '@/features/macros/hooks'
import { colors, radius, spacing, typography } from '@/theme'

/*
 * "Así se calculan tus macros" — full transparency. Walks the same
 * pipeline the engine runs: profile → TDEE → déficit → meta diaria →
 * macros distribuidos. Read-only; observes, never prescribes. Reached
 * from the goal editor's "¿Cómo se calcula?" link.
 */
export default function MacroBreakdownScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { inputs, isLoading } = useMacroInputs()
  const targetsQuery = useMacroTargets()

  const tdee = computeTdee(inputs)
  const savedCalories = targetsQuery.data?.calories ?? null

  // The user's current state, reconstructed from the saved target.
  const state = savedCalories != null ? reconstructState(savedCalories, inputs) : null
  const enfoque = state?.enfoque ?? 'maintain'
  const delta = state?.delta ?? 0
  const preview = state ? macrosForDelta(inputs, enfoque, delta) : null

  if (isLoading || targetsQuery.isLoading) {
    return <View style={[styles.screen, { paddingTop: insets.top }]} />
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <Text onPress={() => router.back()} style={styles.back} suppressHighlighting>
          ‹
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <Text style={styles.headline}>Así se calculan tus macros</Text>
          <Text style={styles.editorial}>Transparencia total. Tú tienes el control.</Text>
        </View>

        {tdee == null ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Completa tu perfil (peso, estatura, edad y actividad) para ver el cálculo de tus
              macros.
            </Text>
          </View>
        ) : (
          <>
            {/* TDEE */}
            <View style={styles.tdeeCard}>
              <View style={styles.tdeeHead}>
                <FlameIcon size={18} color={colors.oro} />
                <EyebrowLabel tone="niebla" size={10} tracking={2.2}>
                  GASTO CALÓRICO ESTIMADO (TDEE)
                </EyebrowLabel>
              </View>
              <Text style={styles.tdeeNum}>{tdee.toLocaleString('es-MX')} kcal</Text>
              <Text style={styles.tdeeSub}>Gasto diario total</Text>

              <View style={styles.factors}>
                <Factor label="Peso" value={inputs.weight_kg ? `${inputs.weight_kg} kg` : '—'} />
                <Factor label="Altura" value={inputs.height_cm ? `${inputs.height_cm} cm` : '—'} />
                <Factor label="Edad" value={ageLabel(inputs.date_of_birth)} />
                <Factor
                  label="Actividad"
                  value={
                    inputs.training_frequency ? ACTIVITY_LABEL[inputs.training_frequency] : '—'
                  }
                />
              </View>
            </View>

            <Text style={styles.arrow}>↓</Text>

            {/* Déficit / superávit actual */}
            <View style={styles.stepCard}>
              <EyebrowLabel tone="niebla" size={10} tracking={2.2}>
                {enfoque === 'surplus'
                  ? 'TU SUPERÁVIT ACTUAL'
                  : enfoque === 'deficit'
                    ? 'TU DÉFICIT ACTUAL'
                    : 'TU ENFOQUE ACTUAL'}
              </EyebrowLabel>
              <Text style={styles.stepNum}>
                {delta === 0 ? 'Mantenimiento' : `${delta > 0 ? '+' : ''}${delta} kcal`}
              </Text>
              <Text style={styles.stepSub}>{enfoqueSub(enfoque, delta)}</Text>
            </View>

            <Text style={styles.arrow}>↓</Text>

            {/* Meta diaria */}
            <View style={styles.stepCard}>
              <EyebrowLabel tone="niebla" size={10} tracking={2.2}>
                TU META DIARIA
              </EyebrowLabel>
              <Text style={styles.metaNum}>
                {(savedCalories ?? tdee).toLocaleString('es-MX')} kcal
              </Text>
              <Text style={styles.stepSub}>Calorías objetivo</Text>
            </View>

            {/* Macros distribuidos */}
            {preview ? (
              <MacroPreviewCard
                title="MACROS DISTRIBUIDOS"
                macros={preview}
                weightKg={inputs.weight_kg ?? 0}
                withCarbs
              />
            ) : null}

            <Text style={styles.footnote}>
              La proteína se calcula desde tu peso; los carbohidratos completan la energía del día.
              Es una guía, no una regla.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function Factor({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factor}>
      <Text style={styles.factorValue}>{value}</Text>
      <Text style={styles.factorLabel}>{label}</Text>
    </View>
  )
}

function ageLabel(dob: string | null): string {
  if (!dob) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob)
  if (!m) return '—'
  const birth = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const md = now.getMonth() - birth.getMonth()
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age -= 1
  return age >= 0 ? `${age} años` : '—'
}

function enfoqueSub(enfoque: Enfoque, delta: number): string {
  if (delta === 0) return 'Mantienes tu peso'
  const levels = levelsFor(enfoque)
  const near = levels.reduce((best, l) =>
    Math.abs(l.delta - delta) < Math.abs(best.delta - delta) ? l : best,
  )
  return enfoque === 'surplus'
    ? `Superávit ${near.label.toLowerCase()}`
    : `Déficit ${near.label.toLowerCase()}`
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  back: {
    fontFamily: typography.ui,
    fontSize: 30,
    lineHeight: 32,
    color: colors.leche,
    width: 32,
    marginLeft: -8,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  head: { gap: spacing.sm, marginBottom: spacing.sm },
  headline: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    letterSpacing: typography.letterSpacing.displayMed,
  },
  editorial: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    lineHeight: typography.sizes.bodyLarge * typography.lineHeight.body,
  },
  tdeeCard: {
    gap: 4,
    padding: spacing.lg,
    borderRadius: radius.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
    backgroundColor: colors.bgCard,
  },
  tdeeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  tdeeNum: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.macroNum,
    color: colors.leche,
    letterSpacing: typography.letterSpacing.displayMed,
  },
  tdeeSub: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  factors: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.oroHairlineSoft,
  },
  factor: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  factorValue: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  factorLabel: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
  arrow: {
    alignSelf: 'center',
    fontSize: 18,
    color: colors.bruma,
  },
  stepCard: {
    gap: 4,
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  stepNum: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.displaySm,
    color: colors.leche,
    letterSpacing: typography.letterSpacing.displayMed,
  },
  metaNum: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.macroNum,
    color: colors.magenta,
    letterSpacing: typography.letterSpacing.displayMed,
  },
  stepSub: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  footnote: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    lineHeight: typography.sizes.body * typography.lineHeight.body,
    marginTop: spacing.xs,
  },
  emptyCard: {
    padding: spacing.lg,
    borderRadius: radius.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  emptyText: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    lineHeight: typography.sizes.bodyLarge * typography.lineHeight.body,
  },
})
