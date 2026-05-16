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
import Svg, { Circle, Path } from 'react-native-svg'

import { MealInputSchema, type MealInput } from '@/features/macros/api'
import { colors, typography } from '@/theme'

type MealType = MealInput['meal_type']

const MEAL_TYPES: readonly { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Desayuno' },
  { value: 'lunch', label: 'Comida' },
  { value: 'dinner', label: 'Cena' },
  { value: 'snack', label: 'Snack' },
]

/* The celestial glyph for each meal slot — sunrise / sun / crescent /
 * sparkle. The same set the meal rows and the quick-log sheet use, so
 * a slot reads identically everywhere. */
function MealGlyph({ type, color }: { type: MealType; color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      {type === 'lunch' ? (
        <>
          <Circle cx={12} cy={12} r={4.3} fill={color} />
          <Path
            d="M12 5.6 V2.8 M12 18.4 V21.2 M18.4 12 H21.2 M5.6 12 H2.8 M16.5 7.5 L18.5 5.5 M7.5 7.5 L5.5 5.5 M16.5 16.5 L18.5 18.5 M7.5 16.5 L5.5 18.5"
            stroke={color}
            strokeWidth={1.7}
            strokeLinecap="round"
          />
        </>
      ) : type === 'dinner' ? (
        <Path d="M15.8 3.2 A 9 9 0 1 0 15.8 20.8 A 7 7 0 1 1 15.8 3.2 Z" fill={color} />
      ) : type === 'breakfast' ? (
        <>
          <Path d="M7 17.5 A 5 5 0 0 1 17 17.5 Z" fill={color} />
          <Path
            d="M2.6 17.5 H21.4 M12 9 V6.4 M6.6 12 L4.8 10.3 M17.4 12 L19.2 10.3"
            stroke={color}
            strokeWidth={1.7}
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <Path
            d="M9.5 7 L11 12.5 L16.5 14 L11 15.5 L9.5 21 L8 15.5 L2.5 14 L8 12.5 Z"
            fill={color}
          />
          <Path
            d="M18 3.2 L18.8 5.8 L21.3 6.5 L18.8 7.3 L18 9.8 L17.2 7.3 L14.7 6.5 L17.2 5.8 Z"
            fill={color}
          />
          <Path
            d="M18.8 14 L19.3 15.6 L20.8 16 L19.3 16.4 L18.8 18 L18.3 16.4 L16.8 16 L18.3 15.6 Z"
            fill={color}
          />
        </>
      )}
    </Svg>
  )
}

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
                <View style={styles.momentoPill}>
                  {MEAL_TYPES.map((mt) => {
                    const active = field.value === mt.value
                    const tint = active ? colors.magenta : colors.niebla
                    return (
                      <Pressable
                        key={mt.value}
                        onPress={() => field.onChange(mt.value)}
                        style={[styles.momentoSeg, active && styles.momentoSegActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={mt.label}
                      >
                        <MealGlyph type={mt.value} color={tint} />
                        <Text style={[styles.momentoSegText, { color: tint }]}>{mt.label}</Text>
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
    <View style={[styles.statCard, accent && styles.cardAccent, error && styles.cardError]}>
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
  // Lifted stat card — a soft shadow gives the macros physical depth.
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 15,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 9,
    elevation: 4,
  },
  // The protein card — the fitness hero metric. A magenta-tinted
  // surface + edge so it reads as the screen's primary number.
  cardAccent: {
    backgroundColor: colors.magentaTint2,
    borderColor: colors.magenta,
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
  // Meal-slot selector — one stadium pill, four glyph+label segments,
  // the active one a magenta capsule. The same control as the quick-
  // log sheet's, so "sumar" and "editar" speak one language.
  momentoPill: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard2,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 4,
  },
  momentoSeg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    borderRadius: 22,
  },
  momentoSegActive: {
    backgroundColor: colors.magentaTint2,
  },
  momentoSegText: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 0.4,
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
