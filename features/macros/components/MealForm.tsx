import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
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
import { SafeAreaView } from 'react-native-safe-area-context'

import { MealInputSchema, type MealInput } from '@/features/macros/api'
import type { MealType } from '@/features/macros/utils/mealType'
import { colors, radius, spacing, typography } from '@/theme'

function inferMealTypeFromHour(hour: number): MealType {
  if (hour >= 5 && hour <= 10) return 'breakfast'
  if (hour >= 11 && hour <= 15) return 'lunch'
  if (hour >= 16 && hour <= 20) return 'dinner'
  return 'snack'
}

type Props = {
  defaultValues?: Partial<MealInput>
  submitLabel: string
  headerTitle: string
  headerMeta: string
  onSubmit: (values: MealInput) => Promise<void> | void
  onCancel: () => void
  isSubmitting?: boolean
}

/*
 * The single meal form used by both create (log-meal) and edit
 * (meal/[id]) screens. Sprint 3 will reuse this identically behind
 * the photo + IA path: the IA response pre-fills `defaultValues`
 * and the user edits/confirms in this same UI.
 *
 * Validation: zod schema (MealInputSchema) mirrors the server's
 * CHECK constraints. Numeric inputs accept digits only; the
 * stripped string is coerced to a real Number on change so zod
 * reads the right primitive type.
 */
export function MealForm({
  defaultValues,
  submitLabel,
  headerTitle,
  headerMeta,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: Props) {
  const { control, handleSubmit, formState } = useForm<MealInput>({
    resolver: zodResolver(MealInputSchema),
    // onTouched fires validation after the first blur on a field,
    // so inline errors appear as the user tabs through — not only
    // after they first tap Submit on an invalid form.
    mode: 'onTouched',
    // Numbers start undefined (not 0) so the placeholder shows
    // until the user types — no more deleting "0" before entry.
    // Zod rejects undefined on submit, which triggers the error
    // copy under the field.
    defaultValues: {
      name: defaultValues?.name ?? '',
      protein_g: defaultValues?.protein_g,
      calories: defaultValues?.calories,
      consumed_at: defaultValues?.consumed_at ?? new Date(),
      // Edit screens pass meal_type explicitly. New-meal callers
      // (only the legacy /log-meal.tsx route, replaced by the
      // suggestor-driven screen) fall back to inferring from the
      // consumed_at hour so the form submission isn't rejected by
      // the zod enum.
      meal_type:
        defaultValues?.meal_type ??
        inferMealTypeFromHour((defaultValues?.consumed_at ?? new Date()).getHours()),
    } as Partial<MealInput>,
  })

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.meta}>{headerMeta}</Text>
            <Text style={styles.headline}>{headerTitle}</Text>
          </View>

          <View style={styles.stack}>
            <Controller
              control={control}
              name="name"
              render={({ field, fieldState }) => (
                <TextField
                  label="¿Qué comiste?"
                  placeholder="Pollo a la plancha con arroz"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />

            <View style={styles.row}>
              <View style={styles.half}>
                <Controller
                  control={control}
                  name="protein_g"
                  render={({ field, fieldState }) => (
                    <NumberField
                      label="Proteína"
                      suffix="g"
                      placeholder="35"
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </View>
              <View style={styles.half}>
                <Controller
                  control={control}
                  name="calories"
                  render={({ field, fieldState }) => (
                    <NumberField
                      label="Calorías"
                      suffix="cal"
                      placeholder="520"
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </View>
            </View>

            <Controller
              control={control}
              name="consumed_at"
              render={({ field, fieldState }) => (
                <DateField
                  label="Hora"
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting || !formState.isValid}
              style={[
                styles.primary,
                (isSubmitting || !formState.isValid) && styles.primaryDisabled,
              ]}
            >
              <Text style={styles.primaryLabel}>{isSubmitting ? 'Guardando…' : submitLabel}</Text>
            </Pressable>
            <Pressable onPress={onCancel} style={styles.secondary}>
              <Text style={styles.secondaryLabel}>Cancelar</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

/* ─── fields ─────────────────────────────────────────────────────── */

type TextFieldProps = {
  label: string
  placeholder: string
  value: string
  onChangeText: (v: string) => void
  onBlur: () => void
  error: string | undefined
}

function TextField({ label, placeholder, value, onChangeText, onBlur, error }: TextFieldProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.labelDim}
        accessibilityLabel={label}
        accessibilityHint={error}
        style={[styles.textInput, error && styles.inputError]}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  )
}

type NumberFieldProps = {
  label: string
  suffix: string
  placeholder: string
  value: number | undefined
  onChangeText: (v: number | undefined) => void
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
  // value is undefined on mount (user hasn't typed yet) → placeholder
  // shows and zod flags the field as invalid until they enter a value.
  const displayValue = value === undefined || value === 0 ? '' : String(value)

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      <View style={[styles.numberInputRow, error && styles.inputError]}>
        <TextInput
          value={displayValue}
          onChangeText={(text) => {
            const digits = text.replace(/[^0-9.]/g, '')
            if (digits === '') {
              onChangeText(undefined)
              return
            }
            const n = Number(digits)
            onChangeText(Number.isFinite(n) ? n : undefined)
          }}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.labelDim}
          accessibilityLabel={`${label}, en ${suffix === 'g' ? 'gramos' : suffix}`}
          accessibilityHint={error}
          keyboardType="decimal-pad"
          inputMode="decimal"
          style={styles.numberInput}
        />
        <Text style={styles.suffix}>{suffix}</Text>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  )
}

type DateFieldProps = {
  label: string
  value: Date
  onChange: (d: Date) => void
  error: string | undefined
}

function DateField({ label, value, onChange, error }: DateFieldProps) {
  const [open, setOpen] = useState(Platform.OS === 'ios') // iOS picker is inline by default
  const [mode, setMode] = useState<'date' | 'time'>('date')

  const handleChange = (_event: DateTimePickerEvent, next?: Date) => {
    if (Platform.OS === 'android') setOpen(false)
    if (next) onChange(next)
  }

  const formatted = value.toLocaleString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  })

  if (Platform.OS === 'ios') {
    return (
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
        <View style={[styles.iosDateWrap, error && styles.inputError]}>
          <DateTimePicker
            mode="datetime"
            value={value}
            onChange={handleChange}
            maximumDate={new Date()}
            locale="es-MX"
          />
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    )
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            setMode('date')
            setOpen(true)
          }}
          style={[styles.androidDateBtn, styles.half]}
        >
          <Text style={styles.androidDateLabel}>{formatted}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setMode('time')
            setOpen(true)
          }}
          style={[styles.androidDateBtn, styles.half]}
        >
          <Text style={styles.androidDateLabel}>Hora</Text>
        </Pressable>
      </View>
      {open && (
        <DateTimePicker
          mode={mode}
          value={value}
          onChange={handleChange}
          maximumDate={new Date()}
        />
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  )
}

/* ─── styles ─────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.pearlBase },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
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
  stack: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },

  fieldLabel: {
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.labelMuted,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.borderDashed,
    borderRadius: radius.tile,
    backgroundColor: colors.pearlBase,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.body,
    color: colors.inkPrimary,
    fontFamily: typography.ui,
  },
  numberInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDashed,
    borderRadius: radius.tile,
    backgroundColor: colors.pearlBase,
    paddingHorizontal: spacing.md,
  },
  numberInput: {
    flex: 1,
    fontSize: typography.sizes.anchor,
    fontFamily: typography.displayMedium,
    color: colors.inkPrimary,
    paddingVertical: spacing.md,
  },
  suffix: {
    fontSize: typography.sizes.body,
    color: colors.labelMuted,
    marginLeft: spacing.sm,
  },
  inputError: { borderColor: colors.mauveDeep },
  errorText: {
    fontSize: typography.sizes.smallLabel,
    color: colors.mauveDeep,
  },
  submitHint: {
    fontSize: typography.sizes.smallLabel,
    color: colors.mauveDeep,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  iosDateWrap: {
    borderRadius: radius.tile,
    backgroundColor: colors.pearlBase,
    borderWidth: 1,
    borderColor: colors.borderDashed,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  androidDateBtn: {
    borderRadius: radius.tile,
    backgroundColor: colors.pearlBase,
    borderWidth: 1,
    borderColor: colors.borderDashed,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  androidDateLabel: {
    fontFamily: typography.uiMedium,
    color: colors.inkPrimary,
    fontSize: typography.sizes.body,
  },

  actions: { gap: spacing.md, marginTop: spacing.xl },
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
