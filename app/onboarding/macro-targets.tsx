import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MacroTargetsInputSchema, type MacroTargetsInput } from '@/features/macros/api'
import { useMacroTargets, useUpsertMacroTargets } from '@/features/macros/hooks'
import { colors, radius, spacing, typography } from '@/theme'

type Source = 'banner' | 'settings' | 'onboarding' | undefined

/*
 * Single screen for both 'set first targets' and 'edit existing
 * targets'. The copy reflects which state the user is in, derived
 * from the targets query (exists → edit mode, null → first time).
 * The `source` query param only affects the back/cancel behaviour
 * because different entry points have different 'home' destinations.
 */
export default function MacroTargetsScreen() {
  const router = useRouter()
  const { source } = useLocalSearchParams<{ source?: Source }>()
  const targetsQuery = useMacroTargets()
  const upsert = useUpsertMacroTargets()

  const existing = targetsQuery.data
  const isEdit = Boolean(existing)

  const { control, handleSubmit, formState } = useForm<MacroTargetsInput>({
    resolver: zodResolver(MacroTargetsInputSchema),
    defaultValues: {
      protein_g: existing?.protein_g ?? 130,
      calories: existing?.calories ?? 1800,
    },
    values: existing ? { protein_g: existing.protein_g, calories: existing.calories } : undefined,
  })

  const onSubmit = async (values: MacroTargetsInput) => {
    try {
      await upsert.mutateAsync(values)
      if (source === 'banner' || source === 'settings') {
        router.back()
      } else {
        router.replace('/(tabs)')
      }
    } catch {
      // Error will be visible via the mutation's error state; the
      // form stays open so the user can retry without losing input.
    }
  }

  const onCancel = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)')
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.meta}>METAS DIARIAS</Text>
            <Text style={styles.headline}>
              {isEdit ? 'Ajustá tus metas' : 'Configurá tus metas'}
            </Text>
            <Text style={styles.editorial}>
              Proteína y calorías del día. Podés cambiarlas cuando quieras.
            </Text>
          </View>

          <View style={styles.stack}>
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
    </SafeAreaView>
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
            // Coerce empty to 0; react-hook-form + zod reports invalid.
            const n = text === '' ? 0 : Number(text.replace(/[^0-9]/g, ''))
            onChangeText(Number.isFinite(n) ? n : 0)
          }}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.labelDim}
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
  screen: { flex: 1, backgroundColor: colors.pearlBase },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  stack: { gap: spacing.lg },
  meta: {
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.labelMuted,
  },
  headline: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.anchor,
    color: colors.inkPrimary,
    letterSpacing: typography.letterSpacing.displayMed,
  },
  editorial: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.labelMuted,
    lineHeight: typography.sizes.bodyLarge * typography.lineHeight.body,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDashed,
    borderRadius: radius.tile,
    backgroundColor: colors.pearlBase,
    paddingHorizontal: spacing.md,
  },
  inputError: {
    borderColor: colors.mauveDeep,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.deltaNum,
    fontFamily: typography.displayMedium,
    color: colors.inkPrimary,
    paddingVertical: spacing.md,
  },
  suffix: {
    fontSize: typography.sizes.body,
    color: colors.labelMuted,
    marginLeft: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.smallLabel,
    color: colors.mauveDeep,
  },
  actions: { gap: spacing.md },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.mauveDeep,
  },
  primaryDisabled: {
    backgroundColor: colors.pearlBase,
  },
  primaryLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.pearlBase,
  },
  secondary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  secondaryLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.labelMuted,
  },
})
