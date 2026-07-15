import DateTimePicker from '@react-native-community/datetimepicker'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import Toast from 'react-native-toast-message'

import { PrimaryCta } from '@/components/PrimaryCta'
import { BodyCheckinInputSchema, type BodyCheckinInput } from '@/features/progress/api'
import { BodyMap, type BodyRegion } from '@/features/progress/components/BodyMap'
import { MeasureWheel } from '@/features/progress/components/MeasureWheel'
import { useBodyCheckins, useMeasurements, useUpsertBodyCheckin } from '@/features/progress/hooks'
import { computeBmi, computeTmb, mergeWeightSeries } from '@/features/progress/logic'
import { useProfile } from '@/features/profile/hooks'
import { SkyBackground } from '@/features/tabs/components'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

/*
 * Nueva medición · UN SOLO CANVAS (rediseño v3 · brief dueña 14 jul 2026):
 * el cuerpo ES la navegación. Sin cards anidadas, sin pantallas, sin forms.
 *
 *   Arriba: título + fecha/fuente compactas + chips de modo
 *   [Peso][Medidas][Músculo][Grasa]. Centro: la figura interactiva (respira,
 *   spark + reveal que recorre la región + bloom al tocar; las regiones
 *   guardadas quedan con outline y una estrella — el cuerpo se enciende con
 *   el progreso, CERO contadores ni barras). Abajo: bottom sheet ADAPTATIVO
 *   que nunca tapa el cuerpo: wheel picker + valor anterior + guía; al
 *   guardar una zona, el sheet permanece y tocas la siguiente.
 *
 * Modo Peso = los básicos con el mismo wheel (chips de métrica dentro del
 * sheet); IMC/TMB se calculan solos ("Calculado por Stelar"). Todo opcional;
 * la EDICIÓN (params day+source) conserva su contrato (precarga, fecha/
 * fuente fijas, vaciar = borrar con nulls explícitos).
 *
 * DIFERIDO (necesita assets que no existen): rotación 360° con inercia
 * (render multi-ángulo/malla 3D), relleno con la silueta exacta por zona
 * (máscaras vectoriales) y parallax de sensores. Skia fuera a propósito:
 * animar sus gradientes truena en device (memoria del repo) y estos efectos
 * viven bien en Reanimated puro.
 */

type FieldKey = keyof Omit<BodyCheckinInput, 'measured_on' | 'source' | 'notes'>

type Mode = 'peso' | 'medidas' | 'musculo' | 'grasa'

type MetricDef = {
  key: FieldKey
  label: string
  unit: string
  min: number
  max: number
  decimals?: boolean
  guide?: string
}

// ── Modo Peso: los básicos editables por wheel (IMC/TMB son calculados). ──
const BASICOS: MetricDef[] = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg', min: 30, max: 200 },
  { key: 'body_fat_pct', label: 'Grasa', unit: '%', min: 3, max: 70 },
  { key: 'muscle_kg', label: 'Músculo', unit: 'kg', min: 10, max: 90 },
  { key: 'water_pct', label: 'Agua', unit: '%', min: 20, max: 80 },
  { key: 'bone_mass_kg', label: 'Ósea', unit: 'kg', min: 0, max: 9 },
  { key: 'visceral_fat_index', label: 'Visceral', unit: '', min: 0, max: 59 },
]

// ── Regiones del cuerpo por modo (hotspots en % de la figura). ──
const ZONE_REGIONS: BodyRegion[] = [
  { key: 'arm_right', label: 'Brazo derecho', x: 25, y: 28, w: 12, h: 22 },
  { key: 'arm_left', label: 'Brazo izquierdo', x: 63, y: 28, w: 12, h: 22 },
  { key: 'trunk', label: 'Tronco', x: 37, y: 22, w: 26, h: 26 },
  { key: 'leg_right', label: 'Pierna derecha', x: 35, y: 51, w: 15, h: 37 },
  { key: 'leg_left', label: 'Pierna izquierda', x: 50, y: 51, w: 15, h: 37 },
]

// La ESPALDA (frame de giro trasero) muestra los mismos segmentos con su
// propia calibración — mismas keys/métricas: la báscula mide el segmento
// completo, la espalda es la otra cara del mismo dato. OJO: visto por
// detrás, izquierda/derecha NO se espejean (tu izquierda queda a la
// izquierda del espectador).
const ZONE_REGIONS_BACK: BodyRegion[] = [
  { key: 'arm_left', label: 'Brazo izquierdo', x: 13, y: 26, w: 13, h: 24 },
  { key: 'arm_right', label: 'Brazo derecho', x: 74, y: 26, w: 13, h: 24 },
  // "Espalda" = la cara trasera del segmento TRONCO (la báscula no separa
  // espalda/glúteo; escribe muscle_trunk_kg). La caja baja hasta el glúteo.
  { key: 'trunk', label: 'Espalda', x: 30, y: 19, w: 40, h: 33 },
  { key: 'leg_left', label: 'Pierna izquierda', x: 27, y: 53, w: 20, h: 35 },
  { key: 'leg_right', label: 'Pierna derecha', x: 53, y: 53, w: 20, h: 35 },
]

// Cintas vistas por detrás. "Glúteo" ES la medida de caderas (se toma en la
// parte más ancha del glúteo); escribe hips_cm, solo cambia dónde se ve.
const TAPE_REGIONS_BACK: BodyRegion[] = [
  { key: 'neck', label: 'Cuello', x: 40, y: 12, w: 20, h: 5 },
  { key: 'waist', label: 'Cintura', x: 34, y: 36, w: 32, h: 6 },
  { key: 'hips', label: 'Glúteo', x: 32, y: 43, w: 36, h: 10 },
  { key: 'arm_left', label: 'Brazo izquierdo', x: 13, y: 26, w: 13, h: 22 },
  { key: 'arm_right', label: 'Brazo derecho', x: 74, y: 26, w: 13, h: 22 },
  { key: 'thigh_left', label: 'Muslo izquierdo', x: 30, y: 56, w: 18, h: 12 },
  { key: 'thigh_right', label: 'Muslo derecho', x: 52, y: 56, w: 18, h: 12 },
  { key: 'calf_left', label: 'Pantorrilla izquierda', x: 33, y: 74, w: 14, h: 12 },
  { key: 'calf_right', label: 'Pantorrilla derecha', x: 53, y: 74, w: 14, h: 12 },
]

const TAPE_REGIONS: BodyRegion[] = [
  { key: 'neck', label: 'Cuello', x: 43, y: 16, w: 14, h: 5 },
  { key: 'chest', label: 'Pecho', x: 36, y: 23, w: 28, h: 8 },
  { key: 'waist', label: 'Cintura', x: 38, y: 34.5, w: 24, h: 5 },
  { key: 'abdomen', label: 'Abdomen', x: 38, y: 40, w: 24, h: 5.5 },
  { key: 'hips', label: 'Caderas', x: 35, y: 46, w: 30, h: 7 },
  { key: 'arm_right', label: 'Brazo derecho', x: 25, y: 27, w: 11, h: 20 },
  { key: 'arm_left', label: 'Brazo izquierdo', x: 64, y: 27, w: 11, h: 20 },
  { key: 'thigh_right', label: 'Muslo derecho', x: 36, y: 54, w: 13, h: 13 },
  { key: 'thigh_left', label: 'Muslo izquierdo', x: 51, y: 54, w: 13, h: 13 },
  { key: 'calf_right', label: 'Pantorrilla derecha', x: 38, y: 71, w: 10, h: 13 },
  { key: 'calf_left', label: 'Pantorrilla izquierda', x: 52, y: 71, w: 10, h: 13 },
]

// Región+modo → métrica (campo, unidad, rango de wheel, guía de medición).
const REGION_METRICS: Record<'medidas' | 'musculo' | 'grasa', Record<string, MetricDef>> = {
  musculo: {
    arm_right: { key: 'muscle_arm_right_kg', label: 'Brazo derecho', unit: 'kg', min: 0, max: 20 },
    arm_left: { key: 'muscle_arm_left_kg', label: 'Brazo izquierdo', unit: 'kg', min: 0, max: 20 },
    trunk: { key: 'muscle_trunk_kg', label: 'Tronco', unit: 'kg', min: 5, max: 60 },
    leg_right: { key: 'muscle_leg_right_kg', label: 'Pierna derecha', unit: 'kg', min: 1, max: 30 },
    leg_left: { key: 'muscle_leg_left_kg', label: 'Pierna izquierda', unit: 'kg', min: 1, max: 30 },
  },
  grasa: {
    arm_right: { key: 'fat_arm_right_pct', label: 'Brazo derecho', unit: '%', min: 3, max: 70 },
    arm_left: { key: 'fat_arm_left_pct', label: 'Brazo izquierdo', unit: '%', min: 3, max: 70 },
    trunk: { key: 'fat_trunk_pct', label: 'Tronco', unit: '%', min: 3, max: 70 },
    leg_right: { key: 'fat_leg_right_pct', label: 'Pierna derecha', unit: '%', min: 3, max: 70 },
    leg_left: { key: 'fat_leg_left_pct', label: 'Pierna izquierda', unit: '%', min: 3, max: 70 },
  },
  medidas: {
    neck: {
      key: 'neck_cm',
      label: 'Cuello',
      unit: 'cm',
      min: 20,
      max: 70,
      guide: 'Cinta horizontal, justo bajo la garganta.',
    },
    chest: {
      key: 'chest_cm',
      label: 'Pecho',
      unit: 'cm',
      min: 40,
      max: 180,
      guide: 'A la altura del pecho, cinta horizontal.',
    },
    waist: {
      key: 'waist_cm',
      label: 'Cintura',
      unit: 'cm',
      min: 40,
      max: 180,
      guide: 'En el punto más angosto, sin apretar.',
    },
    abdomen: {
      key: 'abdomen_cm',
      label: 'Abdomen',
      unit: 'cm',
      min: 40,
      max: 180,
      guide: 'A la altura del ombligo, relajada.',
    },
    hips: {
      key: 'hips_cm',
      label: 'Caderas',
      unit: 'cm',
      min: 40,
      max: 180,
      guide: 'En la parte más ancha.',
    },
    arm_right: {
      key: 'arm_right_cm',
      label: 'Brazo derecho',
      unit: 'cm',
      min: 15,
      max: 60,
      guide: 'En el punto más ancho, brazo relajado.',
    },
    arm_left: {
      key: 'arm_left_cm',
      label: 'Brazo izquierdo',
      unit: 'cm',
      min: 15,
      max: 60,
      guide: 'En el punto más ancho, brazo relajado.',
    },
    thigh_right: {
      key: 'thigh_right_cm',
      label: 'Muslo derecho',
      unit: 'cm',
      min: 30,
      max: 100,
      guide: 'En la parte más ancha del muslo.',
    },
    thigh_left: {
      key: 'thigh_left_cm',
      label: 'Muslo izquierdo',
      unit: 'cm',
      min: 30,
      max: 100,
      guide: 'En la parte más ancha del muslo.',
    },
    calf_right: {
      key: 'calf_right_cm',
      label: 'Pantorrilla derecha',
      unit: 'cm',
      min: 20,
      max: 70,
      guide: 'En la parte más ancha.',
    },
    calf_left: {
      key: 'calf_left_cm',
      label: 'Pantorrilla izquierda',
      unit: 'cm',
      min: 20,
      max: 70,
      guide: 'En la parte más ancha.',
    },
  },
}

const ALL_METRICS: MetricDef[] = [
  ...BASICOS,
  { key: 'bmi', label: 'IMC', unit: '', min: 5, max: 99 },
  { key: 'bmr_kcal', label: 'TMB', unit: 'kcal', min: 500, max: 5999 },
  ...Object.values(REGION_METRICS.musculo),
  ...Object.values(REGION_METRICS.grasa),
  ...Object.values(REGION_METRICS.medidas),
]

const MODES: { key: Mode; label: string }[] = [
  { key: 'peso', label: 'Peso' },
  { key: 'medidas', label: 'Medidas' },
  { key: 'musculo', label: 'Músculo' },
  { key: 'grasa', label: 'Grasa' },
]

const fmtNum = (v: number) => (v % 1 === 0 ? `${v}` : v.toFixed(1))
const MESES_META = [
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

export default function LogCheckinScreen() {
  const router = useRouter()
  const upsert = useUpsertBodyCheckin()
  const params = useLocalSearchParams<{ day?: string; source?: string }>()
  const profile = useProfile()

  // Modo edición: ?day&source identifican el check-in a abrir precargado.
  const editDay = typeof params.day === 'string' ? params.day : null
  const editSource = params.source === 'manual' || params.source === 'coach' ? params.source : null
  const editing = editDay != null && editSource != null

  const parseISO = (v: string): Date | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
    if (!m) return null
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const [dateObj, setDateObj] = useState<Date>(
    () => (editDay ? parseISO(editDay) : null) ?? parseISO(todayInTimezone()) ?? new Date(),
  )
  const date = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(
    dateObj.getDate(),
  ).padStart(2, '0')}`
  // Sin selector Yo/Mi coach (dueña 14 jul 2026): todo registro nuevo es
  // 'manual'; al editar se conserva la fuente del registro original.
  const source: 'manual' | 'coach' = editSource ?? 'manual'
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({})
  const [mode, setMode] = useState<Mode>('peso')
  const [activeRegion, setActiveRegion] = useState<string | null>(null)
  // Nombre de la CARA tocada ("Espalda"/"Glúteo" nombran distinto el mismo
  // dato canónico del sheet/tabla).
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const [basicKey, setBasicKey] = useState<FieldKey>('weight_kg')
  const [draft, setDraft] = useState<number | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)

  const { data: checkins } = useBodyCheckins()
  // La rueda de peso también se siembra con los pesajes RÁPIDOS (✦): serie
  // fusionada, no solo check-ins (consolidación de puertas · uxui).
  const { data: quickWeights } = useMeasurements(null)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (!editing || hydrated || !checkins) return
    const record = checkins.find((c) => c.measured_on === editDay && c.source === editSource)
    if (!record) return
    const initial: Partial<Record<FieldKey, string>> = {}
    for (const f of ALL_METRICS) {
      const v = record[f.key]
      if (v != null) initial[f.key] = String(v)
    }
    setValues(initial)
    setHydrated(true)
  }, [editing, hydrated, checkins, editDay, editSource])

  // "Antes": el último check-in ANTERIOR a esta fecha.
  const previous = useMemo(() => {
    const rows = (checkins ?? []).filter((c) => c.measured_on < date)
    return rows.length > 0 ? rows[rows.length - 1] : null
  }, [checkins, date])

  // Calculado por Stelar (IMC/TMB desde el perfil).
  const weightNum = Number(values.weight_kg)
  const heightCm = profile.data?.height_cm ?? null
  const ageYears = useMemo(() => {
    const dob = profile.data?.date_of_birth
    if (!dob) return null
    const b = parseISO(dob.slice(0, 10))
    if (!b) return null
    let age = dateObj.getFullYear() - b.getFullYear()
    const m = dateObj.getMonth() - b.getMonth()
    if (m < 0 || (m === 0 && dateObj.getDate() < b.getDate())) age -= 1
    return age
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data?.date_of_birth, date])
  const sex = profile.data?.biological_sex === 'male' ? ('male' as const) : ('female' as const)
  const computedBmi =
    Number.isFinite(weightNum) && weightNum > 0 && heightCm ? computeBmi(weightNum, heightCm) : null
  const computedTmb =
    Number.isFinite(weightNum) && weightNum > 0 && heightCm && ageYears
      ? computeTmb(weightNum, heightCm, ageYears, sex)
      : null

  const hasAnyValue =
    Object.values(values).some((v) => v != null && v.trim() !== '') ||
    computedBmi != null ||
    computedTmb != null

  // ── La métrica en edición (región del cuerpo o básico del modo Peso). ──
  const regionMetric: MetricDef | null =
    mode !== 'peso' && activeRegion ? (REGION_METRICS[mode][activeRegion] ?? null) : null
  const basicMetric: MetricDef | null =
    mode === 'peso' ? (BASICOS.find((b) => b.key === basicKey) ?? null) : null
  const editingMetric = regionMetric ?? basicMetric

  // Último peso conocido HASTA la fecha elegida, de cualquiera de las dos
  // fuentes (check-ins + pesajes rápidos).
  const lastKnownWeight = useMemo(() => {
    const cutoff = new Date(`${date}T23:59:59`).getTime()
    const pts = mergeWeightSeries(quickWeights ?? [], checkins ?? []).filter((pt) => pt.t <= cutoff)
    return pts.length > 0 ? (pts[pts.length - 1]?.weight ?? null) : null
  }, [quickWeights, checkins, date])

  const seedFor = (m: MetricDef): number => {
    const manual = Number(values[m.key])
    if (Number.isFinite(manual) && manual > 0) return manual
    if (m.key === 'weight_kg' && lastKnownWeight != null) {
      return Math.min(Math.max(lastKnownWeight, m.min), m.max)
    }
    const prev = previous?.[m.key]
    if (typeof prev === 'number') return Math.min(Math.max(prev, m.min), m.max)
    return Math.round((m.min + m.max) / 2)
  }

  const regions = mode === 'medidas' ? TAPE_REGIONS : mode !== 'peso' ? ZONE_REGIONS : []
  const backRegions =
    mode === 'medidas'
      ? TAPE_REGIONS_BACK
      : mode === 'musculo' || mode === 'grasa'
        ? ZONE_REGIONS_BACK
        : undefined
  const completedKeys = useMemo(() => {
    const set = new Set<string>()
    if (mode === 'peso') return set
    for (const [regionKey, m] of Object.entries(REGION_METRICS[mode])) {
      const v = values[m.key]
      if (v != null && v.trim() !== '') set.add(regionKey)
    }
    return set
  }, [values, mode])

  const selectRegion = (key: string, label?: string) => {
    if (mode === 'peso') return
    Haptics.selectionAsync().catch(() => {})
    setActiveRegion(key)
    setActiveLabel(label ?? null)
    const m = REGION_METRICS[mode][key]
    setDraft(m ? seedFor(m) : null)
  }

  const selectBasic = (key: FieldKey) => {
    Haptics.selectionAsync().catch(() => {})
    setBasicKey(key)
    const m = BASICOS.find((b) => b.key === key)
    setDraft(m ? seedFor(m) : null)
  }

  const commitRegion = () => {
    if (!regionMetric || draft == null) return
    Haptics.selectionAsync().catch(() => {})
    setValues((v) => ({ ...v, [regionMetric.key]: String(draft) }))
    // El sheet permanece: solo se suelta la región; tocas la siguiente.
    setActiveRegion(null)
    setActiveLabel(null)
    setDraft(null)
  }

  // En modo Peso el wheel escribe directo (sin botón por métrica).
  const commitBasic = (v: number) => {
    setDraft(v)
    if (basicMetric) setValues((prev) => ({ ...prev, [basicMetric.key]: String(v) }))
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setActiveRegion(null)
    setActiveLabel(null)
    if (m === 'peso') {
      const def = BASICOS.find((b) => b.key === basicKey) ?? BASICOS[0]!
      setDraft(seedFor(def))
    } else {
      setDraft(null)
    }
  }

  // Semilla inicial del modo Peso. En EDICIÓN espera a la hidratación: sin
  // esto la rueda montaba con el valor equivocado y un roce lo guardaba
  // (reanimated-guardian, severidad alta).
  useEffect(() => {
    if (mode === 'peso' && draft == null && (!editing || hydrated)) {
      const def = BASICOS.find((b) => b.key === basicKey)
      if (def) setDraft(seedFor(def))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, checkins, hydrated])

  const save = () => {
    const numeric: Partial<Record<FieldKey, number>> = {}
    for (const [key, raw] of Object.entries(values)) {
      if (raw == null || raw.trim() === '') continue
      const n = Number(raw)
      if (!Number.isNaN(n)) numeric[key as FieldKey] = n
    }
    if (numeric.bmi == null && computedBmi != null) numeric.bmi = computedBmi
    if (numeric.bmr_kcal == null && computedTmb != null) numeric.bmr_kcal = computedTmb
    const cleared: Partial<Record<FieldKey, null>> = {}
    if (editing) {
      for (const f of ALL_METRICS) if (numeric[f.key] == null) cleared[f.key] = null
    }
    const parsed = BodyCheckinInputSchema.safeParse({
      measured_on: date,
      source,
      ...cleared,
      ...numeric,
    })
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      Toast.show({ type: 'error', text1: first?.message ?? 'Revisa los datos' })
      return
    }
    if (Object.keys(numeric).length === 0) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    upsert.mutate(parsed.data, {
      onSuccess: () => {
        Toast.show({
          type: 'success',
          text1: editing ? 'Medición actualizada' : 'Medición guardada',
        })
        // Ritual post-medición (benchmark, patrón summary de Apple): el
        // Análisis aparece SOLO, ya abierto en anterior → recién guardada —
        // el producto elige el momento. replace: volver atrás desde el
        // Análisis regresa al tab, no al formulario. Sin medición anterior
        // (o editando), vuelve como siempre.
        if (!editing && previous) {
          router.replace({
            pathname: '/progress-analysis',
            params: { a: previous.measured_on, b: date },
          })
        } else {
          router.back()
        }
      },
      onError: () => {
        Toast.show({
          type: 'error',
          text1: 'No pudimos guardar tu medición',
          text2: 'Revisa tu conexión e intenta de nuevo.',
        })
      },
    })
  }

  const prevValue = editingMetric ? (previous?.[editingMetric.key] as number | null) : null
  const prevDaysAgo = useMemo(() => {
    if (!previous) return null
    const a = parseISO(previous.measured_on)
    if (!a) return null
    const d = Math.round((dateObj.getTime() - a.getTime()) / 86400000)
    return d > 0 ? d : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previous, date])

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* ── Arriba: título + fecha/fuente + chips de modo. ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{editing ? 'Editar medición' : 'Nueva medición'}</Text>
            <Text style={styles.subtitle}>Registra solo lo que tengas hoy.</Text>
          </View>
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

        {/* Orden del mock: PRIMERO los modos, DEBAJO la fecha (sola: el
            selector Yo/Mi coach se retiró a pedido de la dueña). */}
        <View style={styles.modeRow}>
          {MODES.map((m) => {
            const on = m.key === mode
            return (
              <Pressable
                key={m.key}
                onPress={() => switchMode(m.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => pressed && { opacity: 0.8 }}
              >
                <View style={[styles.modeChip, on && styles.modeChipOn]}>
                  <ModeGlyph mode={m.key} color={on ? colors.magentaHot : colors.niebla} />
                  <Text style={[styles.modeLabel, on && styles.modeLabelOn]}>{m.label}</Text>
                </View>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.metaLine}>
          <Pressable
            onPress={editing ? undefined : () => setShowDatePicker((v) => !v)}
            disabled={editing}
            accessibilityRole="button"
            accessibilityLabel="Cambiar la fecha de la medición"
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            <View style={[styles.metaChip, editing && styles.metaChipLocked]}>
              <Text style={styles.metaChipText}>
                {dateObj.getDate()} {MESES_META[dateObj.getMonth()]} {dateObj.getFullYear()}
              </Text>
              {!editing ? <Text style={styles.metaCaret}>▾</Text> : null}
            </View>
          </Pressable>
        </View>
        {showDatePicker && !editing ? (
          <DateTimePicker
            value={dateObj}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            themeVariant="dark"
            textColor={colors.leche}
            onChange={(_e, next) => {
              if (Platform.OS === 'android') setShowDatePicker(false)
              if (next) setDateObj(next)
            }}
            style={styles.datePicker}
          />
        ) : null}

        {/* ── Centro: el cuerpo (siempre visible; respira). ── */}
        <View style={styles.bodyBox}>
          <BodyBoxMeasured
            regions={regions}
            backRegions={backRegions}
            activeKey={activeRegion}
            completedKeys={completedKeys}
            onSelect={selectRegion}
          />
        </View>

        {/* ── Abajo: bottom sheet adaptativo (nunca navega, nunca tapa). ── */}
        <Animated.View entering={FadeInDown.duration(280)} style={styles.sheet}>
          <View style={styles.sheetHandle} />
          {mode === 'peso' && basicMetric ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.metricChips}
              >
                {BASICOS.map((b) => {
                  const on = b.key === basicKey
                  const has = (values[b.key] ?? '').trim() !== ''
                  return (
                    <Pressable
                      key={b.key}
                      onPress={() => selectBasic(b.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={({ pressed }) => pressed && { opacity: 0.8 }}
                    >
                      <View style={[styles.metricChip, on && styles.metricChipOn]}>
                        {has ? <View style={styles.metricDot} /> : null}
                        <Text style={[styles.metricChipText, on && styles.metricChipTextOn]}>
                          {b.label}
                        </Text>
                      </View>
                    </Pressable>
                  )
                })}
              </ScrollView>
              <View style={styles.wheelSolo}>
                <MeasureWheel
                  key={basicMetric.key}
                  value={draft ?? seedFor(basicMetric)}
                  min={basicMetric.min}
                  max={basicMetric.max}
                  unit={basicMetric.unit}
                  decimals={basicMetric.decimals !== false}
                  onChange={commitBasic}
                />
              </View>
              <View style={styles.sheetFootRow}>
                {prevValue != null ? (
                  <Text style={styles.prevText}>
                    antes {fmtNum(prevValue)} {basicMetric.unit}
                  </Text>
                ) : (
                  <View />
                )}
                {computedBmi != null || computedTmb != null ? (
                  <Text style={styles.autoText}>
                    {computedBmi != null ? `IMC ${computedBmi}` : ''}
                    {computedBmi != null && computedTmb != null ? ' · ' : ''}
                    {computedTmb != null ? `TMB ${computedTmb} kcal` : ''} · Calculado por Stelar
                  </Text>
                ) : null}
              </View>
              <PrimaryCta
                label="Guardar medición"
                onPress={save}
                loading={upsert.isPending}
                loadingLabel="Guardando…"
                disabled={!hasAnyValue}
              />
            </>
          ) : regionMetric ? (
            <Animated.View entering={FadeIn.duration(200)} key={regionMetric.key}>
              <Text style={styles.regionName}>{activeLabel ?? regionMetric.label}</Text>
              {regionMetric.guide ? <Text style={styles.guide}>{regionMetric.guide}</Text> : null}
              {/* La rueda al centro, flanqueada por la última medición y el
                  cambio en vivo (mock dueña). */}
              <View style={styles.wheelRow}>
                <View style={styles.wheelSide}>
                  {prevValue != null ? (
                    <Text style={styles.prevText}>
                      Última medición{'\n'}
                      <Text style={styles.prevStrong}>{fmtNum(prevValue)}</Text>
                      {prevDaysAgo != null ? `\nhace ${prevDaysAgo} días` : ''}
                    </Text>
                  ) : null}
                </View>
                <MeasureWheel
                  key={regionMetric.key}
                  value={draft ?? seedFor(regionMetric)}
                  min={regionMetric.min}
                  max={regionMetric.max}
                  unit={regionMetric.unit}
                  onChange={setDraft}
                />
                <View style={[styles.wheelSide, styles.wheelSideRight]}>
                  {prevValue != null && draft != null && draft !== prevValue ? (
                    <Text style={styles.changeText}>
                      Cambio{'\n'}
                      <Text style={styles.changeStrong}>
                        {draft > prevValue ? '+' : '−'}
                        {fmtNum(Math.abs(Number((draft - prevValue).toFixed(1))))}{' '}
                        {draft > prevValue ? '↑' : '↓'}
                      </Text>
                    </Text>
                  ) : null}
                </View>
              </View>
              <PrimaryCta label="Guardar y elegir otra zona" onPress={commitRegion} />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(200)}>
              <Text style={styles.idleHint}>
                Toca una zona del cuerpo. Las guardadas se quedan encendidas.
              </Text>
              {/* El link va ARRIBA del CTA: pegado al borde inferior caía en
                  la zona del gesto de home y no se alcanzaba a tapear. El
                  layout vive en el View (quirk Pressable). */}
              <View style={styles.photosLink}>
                <Pressable
                  onPress={() => router.push({ pathname: '/log-photos', params: { date } })}
                  accessibilityRole="link"
                  accessibilityLabel="Agregar fotos de esta medición"
                  hitSlop={10}
                  style={({ pressed }) => pressed && { opacity: 0.6 }}
                >
                  <Text style={styles.photosLinkText}>Agregar fotos de esta fecha →</Text>
                </Pressable>
              </View>
              <PrimaryCta
                label="Guardar medición"
                onPress={save}
                loading={upsert.isPending}
                loadingLabel="Guardando…"
                disabled={!hasAnyValue}
              />
            </Animated.View>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  )
}

/** Glifos mínimos de los chips de modo (mock dueña): báscula, cinta métrica,
 *  mancuerna y gota. Trazos abstractos de 14px, tintables. */
function ModeGlyph({ mode, color }: { mode: Mode; color: string }) {
  const d =
    mode === 'peso'
      ? 'M4.4 1.8h5.2a2.6 2.6 0 012.6 2.6v5.2a2.6 2.6 0 01-2.6 2.6H4.4a2.6 2.6 0 01-2.6-2.6V4.4a2.6 2.6 0 012.6-2.6zM5 5.4a2 2 0 014 0'
      : mode === 'medidas'
        ? 'M8.4 7a3.1 3.1 0 11-6.2 0 3.1 3.1 0 016.2 0zM8.4 7h3.8M5.3 7h.01'
        : mode === 'musculo'
          ? 'M4.2 4.2v5.6M9.8 4.2v5.6M4.2 7h5.6M1.6 5.4v3.2M12.4 5.4v3.2'
          : 'M7 1.8C7 1.8 3.4 6.2 3.4 8.5a3.6 3.6 0 007.2 0C10.6 6.2 7 1.8 7 1.8z'
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path d={d} stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

/* El cuerpo mide su caja disponible (flex) y se la pasa al BodyMap. */
function BodyBoxMeasured({
  regions,
  backRegions,
  activeKey,
  completedKeys,
  onSelect,
}: {
  regions: readonly BodyRegion[]
  backRegions?: readonly BodyRegion[]
  activeKey: string | null
  completedKeys: ReadonlySet<string>
  onSelect: (key: string) => void
}) {
  const [h, setH] = useState(0)
  return (
    <View style={styles.bodyFill} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {h > 40 ? (
        <BodyMap
          regions={regions}
          backRegions={backRegions}
          activeKey={activeKey}
          completedKeys={completedKeys}
          onSelect={onSelect}
          height={h - 8}
        />
      ) : null}
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
    paddingBottom: 2,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // La fecha: un chip compacto centrado bajo los modos (mock dueña).
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard2,
  },
  metaChipLocked: { opacity: 0.65 },
  metaChipText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  metaCaret: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    color: colors.niebla,
  },
  datePicker: { alignSelf: 'center', marginTop: 2 },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard2,
  },
  modeChipOn: { backgroundColor: colors.magentaTint2, borderColor: colors.magentaGlow },
  modeLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  modeLabelOn: { color: colors.magentaHot },
  // El cuerpo ocupa TODO el espacio entre chips y sheet.
  bodyBox: { flex: 1, marginTop: 8 },
  bodyFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // El sheet: siempre presente, adaptativo, nunca navega.
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginBottom: 8,
  },
  metricChips: { gap: 8, paddingBottom: 6 },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard2,
  },
  metricChipOn: { backgroundColor: colors.magentaTint2, borderColor: colors.magentaGlow },
  metricChipText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  metricChipTextOn: { color: colors.magentaHot },
  metricDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.oroLight },
  sheetFootRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    minHeight: 16,
    gap: 10,
  },
  prevText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  autoText: {
    flex: 1,
    textAlign: 'right',
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    fontVariant: ['tabular-nums'],
  },
  // La rueda al centro, datos a los lados (mock dueña).
  wheelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
    gap: 8,
  },
  wheelSide: { flex: 1 },
  wheelSideRight: { alignItems: 'flex-end' },
  wheelSolo: { marginTop: 4, marginBottom: 6 },
  prevStrong: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  changeText: {
    textAlign: 'right',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  changeStrong: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroLight,
  },
  regionName: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  guide: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    marginBottom: 2,
  },
  idleHint: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    textAlign: 'center',
    marginBottom: 12,
  },
  photosLink: { alignSelf: 'center', marginBottom: 12, paddingVertical: 6, paddingHorizontal: 12 },
  photosLinkText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    letterSpacing: 0.2,
  },
})
