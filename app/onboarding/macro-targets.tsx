import { zodResolver } from '@hookform/resolvers/zod'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { DeficitSlider } from '@/features/macros/components/DeficitSlider'
import { EnfoqueSelector } from '@/features/macros/components/EnfoqueSelector'
import { MacroPreviewCard } from '@/features/macros/components/MacroPreviewCard'
import { MacroTargetsInputSchema, type MacroTargetsInput } from '@/features/macros/api'
import { useMacroTargets, useUpsertMacroTargets } from '@/features/macros/hooks'
import {
  computeTdee,
  levelsFor,
  macrosForDelta,
  reconstructState,
  safeLevelsFor,
  type Enfoque,
  type MacroInputs,
  type Nivel,
} from '@/features/profile/calcMacros'
import { useMacroInputs } from '@/features/profile/hooks'
import { colors, radius, spacing, typography } from '@/theme'

type Source = 'banner' | 'settings' | 'onboarding' | undefined

// Plain-language definition of each enfoque, shown in the note card so
// the user understands what they're choosing. Warm, no clinical terms,
// no pressure (manifiesto): describes the strategy, never commands it.
const ENFOQUE_INFO: Record<Enfoque, { name: string; desc: string }> = {
  deficit: {
    name: 'Déficit',
    desc: 'Comes un poco menos de lo que tu cuerpo gasta. Así usa tu reserva como energía y bajas de grasa sin prisa.',
  },
  maintain: {
    name: 'Mantenimiento',
    desc: 'Comes más o menos lo que gastas. Sostienes tu peso mientras cuidas tu energía y tus hábitos.',
  },
  surplus: {
    name: 'Superávit',
    desc: 'Comes un poco más de lo que gastas, con buena proteína, para darle a tu cuerpo material para ganar músculo.',
  },
}

// El déficit se describe por NIVEL: decir "sin prisa" bajo un Marcado de
// -750 contradice lo que la usuaria acaba de elegir. Honesto con el ritmo
// y con lo que pide sostenerlo, sin culpa (manifiesto).
const DEFICIT_DESC: Record<Nivel, string> = {
  light:
    'Comes un poco menos de lo que tu cuerpo gasta. Así usa tu reserva como energía y bajas de grasa sin prisa.',
  moderate:
    'Comes menos de lo que tu cuerpo gasta, en un punto medio que la mayoría puede sostener. Avance constante sin exigirte de más.',
  marked:
    'Comes bastante menos de lo que tu cuerpo gasta. El cambio se nota antes, pero es el nivel que más pide. Si un día pesa, bajar de nivel también es cuidarte.',
}

/*
 * Goal editor. The rich path lets the user pick an enfoque (déficit /
 * mantenimiento / superávit) and a nivel; we recompute the macros live
 * from their profile's TDEE and persist only calories + protein (fat /
 * carbs derive). When the profile can't yield a TDEE (missing weight /
 * height / age), we fall back to the manual two-field form so the
 * screen never dead-ends. The `source` param only steers back/cancel.
 */
export default function MacroTargetsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { source } = useLocalSearchParams<{ source?: Source }>()

  const { inputs, isLoading: inputsLoading } = useMacroInputs()
  const targetsQuery = useMacroTargets()

  const existing = targetsQuery.data
  const tdee = computeTdee(inputs)
  const canCompute = tdee != null

  const goHome = () => {
    if (source === 'banner' || source === 'settings') {
      if (router.canGoBack()) router.back()
      else router.replace('/(tabs)')
    } else {
      router.replace('/(tabs)')
    }
  }

  // Still resolving profile + targets — render nothing rather than
  // flashing the manual fallback before the TDEE is known.
  if (inputsLoading || targetsQuery.isLoading) {
    return <View style={[styles.screen, { paddingTop: insets.top }]} />
  }

  if (!canCompute) {
    return (
      <ManualTargets
        insets={insets}
        existing={existing ? { protein_g: existing.protein_g, calories: existing.calories } : null}
        missing={missingInputLabels(inputs)}
        onCompleteProfile={() => router.push('/profile')}
        onSaved={goHome}
        onCancel={goHome}
      />
    )
  }

  return (
    <GoalEditor
      insets={insets}
      inputs={inputs}
      tdee={tdee}
      savedCalories={existing?.calories ?? null}
      onSaved={goHome}
      onCancel={goHome}
    />
  )
}

/* ─── rich editor (profile complete) ─────────────────────────────── */

type EditorProps = {
  insets: ReturnType<typeof useSafeAreaInsets>
  inputs: ReturnType<typeof useMacroInputs>['inputs']
  tdee: number
  savedCalories: number | null
  onSaved: () => void
  onCancel: () => void
}

function GoalEditor({ insets, inputs, tdee, savedCalories, onSaved, onCancel }: EditorProps) {
  const router = useRouter()
  const upsert = useUpsertMacroTargets()

  const [enfoque, setEnfoque] = useState<Enfoque>('deficit')
  const [nivel, setNivel] = useState<Nivel>('moderate')
  const inited = useRef(false)

  // Seed the controls from the saved target (or the profile's intention)
  // once, when data is ready.
  useEffect(() => {
    if (inited.current) return
    inited.current = true
    if (savedCalories != null) {
      const state = reconstructState(savedCalories, inputs)
      if (state) {
        setEnfoque(state.enfoque)
        if (state.level) setNivel(state.level)
        return
      }
    }
    setEnfoque(inputs.monthly_focus === 'weight' ? 'deficit' : 'maintain')
  }, [savedCalories, inputs])

  // El slider solo ofrece niveles SOSTENIBLES para este TDEE — nunca uno que
  // aterrice bajo el mínimo saludable (manifiesto). `capped` = se recortó algún
  // nivel (déficit) respecto al rango completo.
  const stops = useMemo(() => safeLevelsFor(enfoque, tdee), [enfoque, tdee])
  const capped = enfoque === 'deficit' && stops.length < levelsFor('deficit').length

  // Si el nivel seleccionado dejó de estar disponible (cambió el enfoque o el
  // rango se recortó), reencaja al más fuerte que SÍ se ofrece.
  useEffect(() => {
    if (enfoque === 'maintain') return
    if (!stops.some((s) => s.key === nivel)) {
      const fallback = stops[stops.length - 1]?.key
      if (fallback) setNivel(fallback)
    }
  }, [stops, nivel, enfoque])

  const selectedStop = stops.find((s) => s.key === nivel)
  const delta = enfoque === 'maintain' ? 0 : (selectedStop?.delta ?? 0)
  const preview = macrosForDelta(inputs, enfoque, delta)
  // Delta REAL aplicado (calorías - TDEE): honesto aunque el objetivo se tope.
  const deltaReal = preview ? preview.calories - tdee : delta
  const clamped = preview?.clamped ?? false

  const [justSaved, setJustSaved] = useState(false)
  const onSave = async () => {
    if (!preview || justSaved) return
    try {
      await upsert.mutateAsync({ protein_g: preview.protein_g, calories: preview.calories })
      // Confirmación cálida antes de salir: háptico + el botón pasa a
      // "Guardado ✓" un instante para que se SIENTA que quedó.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setJustSaved(true)
      setTimeout(onSaved, 850)
    } catch {
      // Mutation error surfaces below; keep the screen open to retry.
    }
  }

  const levelLabel = selectedStop?.label ?? ''
  const nivelHeading = enfoque === 'surplus' ? 'NIVEL DE SUPERÁVIT' : 'NIVEL DE DÉFICIT'

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top bar: back + Guardar */}
      <View style={styles.topbar}>
        <Pressable onPress={onCancel} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={upsert.isPending || !preview || justSaved}
          hitSlop={12}
        >
          <Text style={[styles.save, (upsert.isPending || !preview) && styles.saveDisabled]}>
            {upsert.isPending ? 'Guardando…' : justSaved ? 'Guardado ✓' : 'Guardar'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <Text style={styles.headline}>Ajusta tus objetivos</Text>
          <Text style={styles.editorial}>
            Personaliza tu enfoque. Nosotros recalculamos tus macros.
          </Text>
        </View>

        <View style={styles.section}>
          <EyebrowLabel tone="niebla" size={10} tracking={2.4}>
            ELIGE TU ENFOQUE
          </EyebrowLabel>
          <EnfoqueSelector value={enfoque} onChange={setEnfoque} />
        </View>

        {enfoque !== 'maintain' ? (
          <View style={styles.section}>
            <View style={styles.nivelRow}>
              <EyebrowLabel tone="niebla" size={10} tracking={2.4}>
                {nivelHeading}
              </EyebrowLabel>
              {/* El delta mostrado es el REAL (calorías - TDEE), no el nominal:
                  si el objetivo se topó, no mentimos con "-750". */}
              <Text style={styles.nivelValue}>
                {levelLabel} ({deltaReal > 0 ? '+' : ''}
                {deltaReal} kcal)
              </Text>
            </View>
            <DeficitSlider stops={stops} value={nivel} onChange={setNivel} />
            {/* El rango se recortó a lo sostenible para este cuerpo. */}
            {capped ? (
              <Text style={styles.sustainNote}>
                El rango refleja lo que funciona para tu cuerpo.
              </Text>
            ) : null}
          </View>
        ) : null}

        {preview ? (
          <MacroPreviewCard
            title="VISTA PREVIA DE TUS NUEVOS OBJETIVOS"
            macros={preview}
            weightKg={inputs.weight_kg ?? 0}
            delta={deltaReal}
            floorNote={clamped ? 'el mínimo para este cuerpo' : null}
          />
        ) : null}

        {/* Caso límite (TDEE bajo, todo se topa): una línea cálida del coach
            que explica el piso como cuidado, no como bloqueo. */}
        {clamped ? (
          <Text style={styles.floorCoach}>
            Aquí nos detenemos. Hay un punto donde cuidar es también no bajar más.
          </Text>
        ) : null}

        <Pressable
          onPress={() => router.push('/macro-breakdown')}
          style={styles.calcLink}
          hitSlop={8}
        >
          <Text style={styles.calcLinkText}>¿Cómo se calcula? ›</Text>
        </Pressable>

        <View style={styles.note}>
          <Text style={styles.noteGlyph}>✦</Text>
          <View style={styles.noteBody}>
            <Text style={styles.noteTitle}>{ENFOQUE_INFO[enfoque].name}</Text>
            <Text style={styles.noteText}>
              {enfoque === 'deficit' ? DEFICIT_DESC[nivel] : ENFOQUE_INFO[enfoque].desc}
            </Text>
          </View>
        </View>

        {upsert.isError ? (
          <Text style={styles.errorText}>No se pudo guardar. Intenta de nuevo.</Text>
        ) : null}
      </ScrollView>
    </View>
  )
}

/* ─── manual fallback (profile incomplete) ───────────────────────── */

/** Qué piezas del TDEE faltan, en el idioma de la usuaria — alimenta la
 *  explicación y el CTA del fallback manual (antes: callejón que solo
 *  explicaba, sin puerta a completar el perfil). */
function missingInputLabels(inputs: MacroInputs): string[] {
  const out: string[] = []
  if (inputs.weight_kg == null) out.push('tu peso')
  if (inputs.height_cm == null) out.push('tu estatura')
  if (inputs.date_of_birth == null) out.push('tu fecha de nacimiento')
  if (inputs.biological_sex == null) out.push('tu sexo')
  if (inputs.training_frequency == null) out.push('tu frecuencia de entreno')
  return out
}

/** "tu peso, tu estatura y tu sexo" — lista en español natural. */
function listAnd(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`
}

function ManualTargets({
  insets,
  existing,
  missing,
  onCompleteProfile,
  onSaved,
  onCancel,
}: {
  insets: ReturnType<typeof useSafeAreaInsets>
  existing: MacroTargetsInput | null
  missing: string[]
  onCompleteProfile: () => void
  onSaved: () => void
  onCancel: () => void
}) {
  const upsert = useUpsertMacroTargets()
  const isEdit = Boolean(existing)

  const { control, handleSubmit, formState } = useForm<MacroTargetsInput>({
    resolver: zodResolver(MacroTargetsInputSchema),
    defaultValues: {
      protein_g: existing?.protein_g ?? 130,
      calories: existing?.calories ?? 1800,
    },
    values: existing ?? undefined,
  })

  const onSubmit = async (values: MacroTargetsInput) => {
    try {
      await upsert.mutateAsync(values)
      onSaved()
    } catch {
      // Error visible via the mutation state; the form stays open.
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.manualContainer}>
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.meta}>METAS DIARIAS</Text>
            <Text style={styles.headline}>
              {isEdit ? 'Ajusta tus metas' : 'Configura tus metas'}
            </Text>
            <Text style={styles.editorial}>
              Proteína y calorías del día. Puedes cambiarlas cuando quieras.
            </Text>
          </View>

          <View style={{ gap: spacing.lg }}>
            <Controller
              control={control}
              name="protein_g"
              render={({ field, fieldState }) => (
                <NumberField
                  label="Proteína"
                  suffix="g"
                  placeholder="130"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="calories"
              render={({ field, fieldState }) => (
                <NumberField
                  label="Calorías"
                  suffix="cal"
                  placeholder="1800"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>DE DÓNDE SALE</Text>
              <Text style={styles.infoText}>
                {missing.length > 0
                  ? `Para calcular tus metas por ti falta ${listAnd(missing)}. Mientras tanto, puedes ajustarlas a mano aquí.`
                  : 'Completa tu perfil para calcular tus metas automáticamente. Mientras tanto, puedes ajustarlas a mano aquí.'}
              </Text>
              <Text style={styles.infoText}>Es una guía, no una regla.</Text>
              {/* La puerta al camino rico (déficit/mantenimiento/superávit):
                  con el perfil completo, esta misma pantalla abre el editor
                  con enfoque y niveles. */}
              <Pressable
                onPress={onCompleteProfile}
                style={styles.infoCta}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Completar mi perfil"
              >
                <Text style={styles.infoCtaLabel}>Completar mi perfil ›</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={upsert.isPending || !formState.isValid}
              style={[
                styles.primary,
                (upsert.isPending || !formState.isValid) && styles.primaryDisabled,
              ]}
            >
              <Text style={styles.primaryLabel}>{upsert.isPending ? 'Guardando…' : 'Guardar'}</Text>
            </Pressable>
            <Pressable onPress={onCancel} style={styles.secondary}>
              <Text style={styles.secondaryLabel}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

type NumberFieldProps = {
  label: string
  suffix: string
  placeholder: string
  value: number
  onChangeText: (v: number) => void
  onBlur: () => void
  error: string | undefined
}

function NumberField({
  label,
  suffix,
  placeholder,
  value,
  onChangeText,
  onBlur,
  error,
}: NumberFieldProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.meta}>{label.toUpperCase()}</Text>
      <View style={[styles.inputRow, error ? styles.inputError : null]}>
        <TextInput
          value={value ? String(value) : ''}
          onChangeText={(text) => {
            const n = text === '' ? 0 : Number(text.replace(/[^0-9]/g, ''))
            onChangeText(Number.isFinite(n) ? n : 0)
          }}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.niebla}
          keyboardType="numeric"
          inputMode="numeric"
          style={styles.input}
        />
        <Text style={styles.suffix}>{suffix}</Text>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },

  // ── rich editor ──
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  backGlyph: {
    fontFamily: typography.ui,
    fontSize: 30,
    lineHeight: 32,
    color: colors.leche,
  },
  save: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.magenta,
  },
  saveDisabled: {
    opacity: 0.4,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.xxl,
  },
  head: { gap: spacing.sm },
  section: { gap: spacing.md },
  nivelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nivelValue: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.magenta,
  },
  // Nota tenue bajo el slider cuando el rango se recortó (UI, no voz de coach).
  sustainNote: {
    marginTop: spacing.sm,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  // Línea del coach (serif italic) cuando el objetivo toca el mínimo: cuidado,
  // no bloqueo. Reservada para el caso límite (todo se topa).
  floorCoach: {
    marginTop: -spacing.md,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: typography.sizes.bodyLarge * typography.lineHeight.body,
    color: colors.oroLight,
  },
  calcLink: {
    alignSelf: 'flex-start',
    marginTop: -spacing.md,
  },
  calcLinkText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
    backgroundColor: colors.oroTint,
  },
  noteGlyph: {
    fontFamily: typography.ui,
    fontSize: 13,
    color: colors.oro,
    marginTop: 1,
  },
  noteBody: {
    flex: 1,
    gap: 3,
  },
  noteTitle: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  noteText: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.bone,
    lineHeight: typography.sizes.body * typography.lineHeight.body,
  },

  // ── manual fallback ──
  manualContainer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  infoCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  infoTitle: {
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.niebla,
  },
  infoText: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.bone,
    lineHeight: typography.sizes.body * typography.lineHeight.body,
  },
  infoCta: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  infoCtaLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.magenta,
    letterSpacing: 0.3,
  },
  meta: {
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.niebla,
  },
  headline: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.anchor,
    color: colors.leche,
    letterSpacing: typography.letterSpacing.displayMed,
  },
  editorial: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    lineHeight: typography.sizes.bodyLarge * typography.lineHeight.body,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.tile,
    backgroundColor: colors.bgCard,
    paddingHorizontal: spacing.md,
  },
  inputError: {
    borderColor: colors.feedbackError,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.deltaNum,
    fontFamily: typography.displayMedium,
    color: colors.leche,
    paddingVertical: spacing.md,
  },
  suffix: {
    fontSize: typography.sizes.body,
    color: colors.niebla,
    marginLeft: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.smallLabel,
    color: colors.feedbackError,
  },
  actions: { gap: spacing.md },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.magenta,
  },
  primaryDisabled: {
    opacity: 0.4,
  },
  primaryLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  secondary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  secondaryLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
