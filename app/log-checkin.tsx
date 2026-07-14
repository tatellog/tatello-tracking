import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
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
import Toast from 'react-native-toast-message'

import { PrimaryCta } from '@/components/PrimaryCta'
import { BodyCheckinInputSchema, type BodyCheckinInput } from '@/features/progress/api'
import { useBodyCheckins, useUpsertBodyCheckin } from '@/features/progress/hooks'
import { SkyBackground } from '@/features/tabs/components'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

/*
 * Nueva medición (F0 · Progress 3.0) — captura MANUAL del check-in de
 * composición (el registro que dejaba el coach, tipo InBody): básicos +
 * músculo/grasa por zonas. Todo opcional (capturas lo que tengas; la DB exige
 * al menos un valor) y con FECHA EDITABLE → backfill del histórico.
 *
 * Manual es fuente de primera clase: los wearables quizá no den todas estas
 * métricas (decisión dueña jul 2026). Sin colores de juicio: es captura de
 * hechos. `metabolic_age` se captura (completitud del registro) aunque la UI
 * de lectura no la muestre por default.
 *
 * EDICIÓN (decisión dueña jul 2026): con params ?day&source la forma abre el
 * check-in existente precargado. Fecha y fuente quedan FIJAS (identifican el
 * registro que editas; el upsert por usuaria+día+fuente hace el resto) y al
 * guardar se mandan null explícitos: vaciar un campo lo borra de verdad (el
 * upsert de PostgREST no toca columnas ausentes del payload).
 */

type FieldKey = keyof Omit<BodyCheckinInput, 'measured_on' | 'source' | 'notes'>

type Field = { key: FieldKey; label: string; unit: string }

const BASICOS: Field[] = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg' },
  { key: 'body_fat_pct', label: 'Grasa corporal', unit: '%' },
  { key: 'muscle_kg', label: 'Músculo', unit: 'kg' },
  { key: 'water_pct', label: 'Agua', unit: '%' },
  { key: 'bmi', label: 'IMC', unit: '' },
  { key: 'bmr_kcal', label: 'TMB', unit: 'kcal' },
  { key: 'bone_mass_kg', label: 'Masa ósea', unit: 'kg' },
  { key: 'visceral_fat_index', label: 'Visceral', unit: '' },
  { key: 'metabolic_age', label: 'Edad metabólica', unit: 'años' },
]

const ZONAS_MUSCULO: Field[] = [
  { key: 'muscle_arm_right_kg', label: 'Brazo der', unit: 'kg' },
  { key: 'muscle_arm_left_kg', label: 'Brazo izq', unit: 'kg' },
  { key: 'muscle_trunk_kg', label: 'Tronco', unit: 'kg' },
  { key: 'muscle_leg_right_kg', label: 'Pierna der', unit: 'kg' },
  { key: 'muscle_leg_left_kg', label: 'Pierna izq', unit: 'kg' },
]

const ZONAS_GRASA: Field[] = [
  { key: 'fat_arm_right_pct', label: 'Brazo der', unit: '%' },
  { key: 'fat_arm_left_pct', label: 'Brazo izq', unit: '%' },
  { key: 'fat_trunk_pct', label: 'Tronco', unit: '%' },
  { key: 'fat_leg_right_pct', label: 'Pierna der', unit: '%' },
  { key: 'fat_leg_left_pct', label: 'Pierna izq', unit: '%' },
]

const ALL_FIELDS: Field[] = [...BASICOS, ...ZONAS_MUSCULO, ...ZONAS_GRASA]

export default function LogCheckinScreen() {
  const router = useRouter()
  const upsert = useUpsertBodyCheckin()
  const params = useLocalSearchParams<{ day?: string; source?: string }>()

  // Modo edición: ?day&source identifican el check-in a abrir precargado.
  const editDay = typeof params.day === 'string' ? params.day : null
  const editSource = params.source === 'manual' || params.source === 'coach' ? params.source : null
  const editing = editDay != null && editSource != null

  const [date, setDate] = useState(editDay ?? todayInTimezone())
  const [source, setSource] = useState<'manual' | 'coach'>(editSource ?? 'manual')
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({})

  const { data: checkins } = useBodyCheckins()
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (!editing || hydrated || !checkins) return
    const record = checkins.find((c) => c.measured_on === editDay && c.source === editSource)
    if (!record) return
    const initial: Partial<Record<FieldKey, string>> = {}
    for (const f of ALL_FIELDS) {
      const v = record[f.key]
      if (v != null) initial[f.key] = String(v)
    }
    setValues(initial)
    setHydrated(true)
  }, [editing, hydrated, checkins, editDay, editSource])

  const setField = (key: FieldKey, raw: string) =>
    setValues((v) => ({ ...v, [key]: raw.replace(',', '.') }))

  const save = () => {
    // Texto → número; vacío = no medido (queda null, la DB lo permite).
    const numeric: Partial<Record<FieldKey, number>> = {}
    for (const [key, raw] of Object.entries(values)) {
      if (raw == null || raw.trim() === '') continue
      const n = Number(raw)
      if (Number.isNaN(n)) {
        Toast.show({ type: 'error', text1: `Revisa el valor de ${key}` })
        return
      }
      numeric[key as FieldKey] = n
    }
    // Al editar, los campos vacíos van como null EXPLÍCITO: vaciar = borrar
    // (el upsert no toca columnas que no llegan en el payload).
    const cleared: Partial<Record<FieldKey, null>> = {}
    if (editing) {
      for (const f of ALL_FIELDS) if (numeric[f.key] == null) cleared[f.key] = null
    }
    const parsed = BodyCheckinInputSchema.safeParse({
      measured_on: date.trim(),
      source,
      ...cleared,
      ...numeric,
    })
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      Toast.show({ type: 'error', text1: first?.message ?? 'Revisa los datos' })
      return
    }
    if (Object.keys(numeric).length === 0) {
      Toast.show({ type: 'error', text1: 'Captura al menos una medida' })
      return
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    upsert.mutate(parsed.data, {
      onSuccess: () => {
        Toast.show({
          type: 'success',
          text1: editing ? 'Medición actualizada' : 'Medición guardada',
        })
        router.back()
      },
      onError: (err) => {
        Toast.show({
          type: 'error',
          text1: 'No pudimos guardar',
          text2: err instanceof Error ? err.message : 'Intenta de nuevo.',
        })
      },
    })
  }

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>{editing ? 'Editar medición' : 'Nueva medición'}</Text>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke={colors.bone}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.hint}>
              {editing
                ? 'Corrige lo que necesites. Un campo vacío se borra de la medición.'
                : 'Captura lo que tengas: todos los campos son opcionales. La fecha se puede cambiar para registrar mediciones pasadas.'}
            </Text>

            {/* Fecha + fuente. Al editar quedan fijas: identifican el registro. */}
            <View style={styles.metaRow}>
              <View style={styles.dateWrap}>
                <Text style={styles.fieldLabel}>Fecha</Text>
                {editing ? (
                  <View style={[styles.input, styles.inputLocked]}>
                    <Text style={styles.lockedText}>{date}</Text>
                  </View>
                ) : (
                  <TextInput
                    value={date}
                    onChangeText={setDate}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor={colors.niebla}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                )}
              </View>
              <View style={styles.sourceWrap}>
                <Text style={styles.fieldLabel}>Fuente</Text>
                {editing ? (
                  <View style={[styles.input, styles.inputLocked]}>
                    <Text style={styles.lockedText}>{source === 'manual' ? 'Yo' : 'Mi coach'}</Text>
                  </View>
                ) : (
                  <View style={styles.sourcePill}>
                    {(['manual', 'coach'] as const).map((s) => {
                      const on = s === source
                      return (
                        <Pressable
                          key={s}
                          onPress={() => setSource(s)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          style={[styles.sourceSeg, on && styles.sourceSegOn]}
                        >
                          <Text style={[styles.sourceLabel, on && styles.sourceLabelOn]}>
                            {s === 'manual' ? 'Yo' : 'Mi coach'}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                )}
              </View>
            </View>

            <Section title="Básicos" fields={BASICOS} values={values} onChange={setField} />
            <Section
              title="Músculo por zona"
              fields={ZONAS_MUSCULO}
              values={values}
              onChange={setField}
            />
            <Section
              title="Grasa por zona"
              fields={ZONAS_GRASA}
              values={values}
              onChange={setField}
            />

            <View style={styles.ctaWrap}>
              <PrimaryCta
                label={editing ? 'Guardar cambios' : 'Guardar medición'}
                onPress={save}
                loading={upsert.isPending}
                loadingLabel="Guardando…"
              />
            </View>

            {/* Epic 08 · F3: las fotos de la sesión, a un tap (mismo flujo de
                backdating; ahí eliges la fecha). */}
            <Pressable
              onPress={() => router.push('/log-photos')}
              accessibilityRole="link"
              accessibilityLabel="Agregar fotos de esta medición"
              style={({ pressed }) => [styles.photosLink, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.photosLinkText}>Agregar fotos de esta fecha →</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

function Section({
  title,
  fields,
  values,
  onChange,
}: {
  title: string
  fields: Field[]
  values: Partial<Record<FieldKey, string>>
  onChange: (key: FieldKey, raw: string) => void
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.grid}>
        {fields.map((f) => (
          <View key={f.key} style={styles.field}>
            <Text style={styles.fieldLabel}>
              {f.label}
              {f.unit ? <Text style={styles.fieldUnit}> · {f.unit}</Text> : null}
            </Text>
            <TextInput
              value={values[f.key] ?? ''}
              onChangeText={(t) => onChange(f.key, t)}
              placeholder="—"
              placeholderTextColor={colors.niebla}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.5,
  },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  hint: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
    marginBottom: 16,
  },
  metaRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  dateWrap: { flex: 1 },
  sourceWrap: { flex: 1 },
  sourcePill: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderRadius: 14,
    padding: 3,
  },
  sourceSeg: {
    flex: 1,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceSegOn: { backgroundColor: colors.magentaTint2 },
  sourceLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  sourceLabelOn: { color: colors.magentaHot },
  section: { marginTop: 18 },
  sectionTitle: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    marginBottom: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  field: { flexGrow: 1, flexBasis: '30%' },
  fieldLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.4,
    color: colors.bone,
    marginBottom: 5,
  },
  fieldUnit: { color: colors.niebla },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  inputLocked: { justifyContent: 'center', opacity: 0.7 },
  lockedText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  ctaWrap: { marginTop: 26 },
  photosLink: { marginTop: 14, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 8 },
  photosLinkText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    letterSpacing: 0.2,
  },
})
