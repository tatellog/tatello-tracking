import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { zodResolver } from '@hookform/resolvers/zod'
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
import Svg, { Path } from 'react-native-svg'

import { MealInputSchema, type MealInput } from '@/features/macros/api'
import { colors, typography } from '@/theme'

type MealType = MealInput['meal_type']

const MEAL_TYPES: readonly { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Desayuno' },
  { value: 'lunch', label: 'Comida' },
  { value: 'dinner', label: 'Cena' },
  { value: 'snack', label: 'Snack' },
]

function inferMealTypeFromHour(hour: number): MealType {
  if (hour >= 5 && hour <= 10) return 'breakfast'
  if (hour >= 11 && hour <= 15) return 'lunch'
  if (hour >= 16 && hour <= 20) return 'dinner'
  return 'snack'
}

type Props = {
  defaultValues?: Partial<MealInput>
  /** Centred header title — "Editar comida". */
  headerTitle: string
  onSubmit: (values: MealInput) => Promise<void> | void
  /** Back arrow — discards and leaves. */
  onCancel: () => void
  /** When set, a "Borrar comida" action shows at the foot. */
  onDelete?: () => void
  isSubmitting?: boolean
}

/*
 * The meal detail / edit screen. A polished detail layout — header
 * with an inline "Guardar", the meal name as the page title, the two
 * macros as prominent stat cards, then time and meal-slot — rather
 * than a plain stacked form.
 *
 * Only the fields the data model actually holds (name, protein,
 * calories, consumed_at, meal_type) are shown — no serving-size or
 * carb/fat scaffolding the schema can't back.
 *
 * Validation: zod (MealInputSchema) mirrors the server CHECK
 * constraints; the header "Guardar" stays disabled until the form
 * is valid.
 */
export function MealForm({
  defaultValues,
  headerTitle,
  onSubmit,
  onCancel,
  onDelete,
  isSubmitting = false,
}: Props) {
  const { control, handleSubmit, formState } = useForm<MealInput>({
    resolver: zodResolver(MealInputSchema),
    mode: 'onTouched',
    defaultValues: {
      name: defaultValues?.name ?? '',
      protein_g: defaultValues?.protein_g,
      calories: defaultValues?.calories,
      consumed_at: defaultValues?.consumed_at ?? new Date(),
      meal_type:
        defaultValues?.meal_type ??
        inferMealTypeFromHour((defaultValues?.consumed_at ?? new Date()).getHours()),
    } as Partial<MealInput>,
  })

  const canSave = formState.isValid && !isSubmitting

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Pressable
            onPress={onCancel}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M15 5 L8 12 L15 19"
                stroke={colors.leche}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={!canSave}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Guardar"
            accessibilityState={{ disabled: !canSave }}
          >
            <Text style={[styles.headerSave, !canSave && styles.headerSaveOff]}>
              {isSubmitting ? 'Guardando…' : 'Guardar'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name — the page's title, editable in place. */}
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <View style={styles.nameBlock}>
                <TextInput
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="¿Qué comiste?"
                  placeholderTextColor={colors.bruma}
                  style={styles.nameInput}
                  accessibilityLabel="Nombre de la comida"
                  multiline
                />
                <View style={styles.nameRule} />
                {fieldState.error ? (
                  <Text style={styles.errorText}>{fieldState.error.message}</Text>
                ) : null}
              </View>
            )}
          />

          {/* The two macros — prominent stat cards. */}
          <View style={styles.macroRow}>
            <Controller
              control={control}
              name="protein_g"
              render={({ field, fieldState }) => (
                <StatField
                  label="Proteína"
                  unit="g"
                  placeholder="35"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  accent
                />
              )}
            />
            <Controller
              control={control}
              name="calories"
              render={({ field, fieldState }) => (
                <StatField
                  label="Calorías"
                  unit="kcal"
                  placeholder="520"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
          </View>

          {/* Time. */}
          <Controller
            control={control}
            name="consumed_at"
            render={({ field }) => (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Hora</Text>
                <DateRow value={field.value} onChange={field.onChange} />
              </View>
            )}
          />

          {/* Meal slot. */}
          <Controller
            control={control}
            name="meal_type"
            render={({ field }) => (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Momento</Text>
                <View style={styles.chips}>
                  {MEAL_TYPES.map((mt) => {
                    const active = field.value === mt.value
                    return (
                      <Pressable
                        key={mt.value}
                        onPress={() => field.onChange(mt.value)}
                        style={[styles.chip, active && styles.chipActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {mt.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            )}
          />

          {onDelete ? (
            <Pressable
              onPress={onDelete}
              style={styles.deleteBtn}
              accessibilityRole="button"
              accessibilityLabel="Borrar comida"
            >
              <Text style={styles.deleteLabel}>Borrar comida</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

/* ─── fields ─────────────────────────────────────────────────────── */

type StatFieldProps = {
  label: string
  unit: string
  placeholder: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  onBlur: () => void
  error: string | undefined
  /** Magenta number — used for the hero metric (protein). */
  accent?: boolean
}

function StatField({
  label,
  unit,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  accent = false,
}: StatFieldProps) {
  const display = value === undefined || value === 0 ? '' : String(value)
  return (
    <View style={[styles.statCard, error && styles.cardError]}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <TextInput
          value={display}
          onChangeText={(text) => {
            const digits = text.replace(/[^0-9.]/g, '')
            if (digits === '') {
              onChange(undefined)
              return
            }
            const n = Number(digits)
            onChange(Number.isFinite(n) ? n : undefined)
          }}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.bruma}
          keyboardType="decimal-pad"
          inputMode="decimal"
          style={[styles.statInput, accent && styles.statInputAccent]}
          accessibilityLabel={label}
        />
        <Text style={styles.statUnit}>{unit}</Text>
      </View>
    </View>
  )
}

function DateRow({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const handleChange = (_e: DateTimePickerEvent, next?: Date) => {
    if (next) onChange(next)
  }
  return (
    <View style={styles.dateWrap}>
      <DateTimePicker
        mode="datetime"
        value={value}
        onChange={handleChange}
        maximumDate={new Date()}
        locale="es-MX"
        themeVariant="dark"
        accentColor={colors.magenta}
      />
    </View>
  )
}

/* ─── styles ─────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  headerTitle: {
    fontFamily: typography.uiBold,
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.bone,
  },
  headerSave: {
    fontFamily: typography.uiBold,
    fontSize: 14,
    color: colors.magenta,
    letterSpacing: 0.3,
  },
  headerSaveOff: {
    color: colors.bruma,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 40,
  },
  nameBlock: {
    marginBottom: 24,
  },
  nameInput: {
    fontFamily: typography.displayHeavy,
    fontSize: 28,
    lineHeight: 34,
    color: colors.leche,
    letterSpacing: -0.8,
    padding: 0,
  },
  nameRule: {
    height: 1,
    backgroundColor: colors.hairlineStrong,
    marginTop: 10,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  cardError: {
    borderColor: colors.feedbackError,
  },
  statLabel: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 6,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  statInput: {
    flex: 1,
    fontFamily: typography.displayHeavy,
    fontSize: 30,
    letterSpacing: -1,
    color: colors.leche,
    padding: 0,
  },
  statInputAccent: {
    color: colors.magenta,
  },
  statUnit: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14,
    color: colors.niebla,
  },
  field: {
    marginBottom: 22,
  },
  fieldLabel: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.magenta,
    marginBottom: 10,
  },
  dateWrap: {
    alignSelf: 'flex-start',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard,
  },
  chipActive: {
    borderColor: colors.magenta,
    backgroundColor: colors.magentaTint2,
  },
  chipText: {
    fontFamily: typography.uiSemi,
    fontSize: 13,
    color: colors.bone,
  },
  chipTextActive: {
    fontFamily: typography.uiBold,
    color: colors.leche,
  },
  errorText: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: 12,
    color: colors.feedbackError,
  },
  deleteBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 14,
  },
  deleteLabel: {
    fontFamily: typography.uiBold,
    fontSize: 13,
    letterSpacing: 0.4,
    color: colors.feedbackError,
  },
})
