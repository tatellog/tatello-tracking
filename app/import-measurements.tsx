import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import Toast from 'react-native-toast-message'

import { PrimaryCta } from '@/components/PrimaryCta'
import { upsertBodyCheckin, type BodyCheckinInput } from '@/features/progress/api'
import {
  scanMeasurementsImage,
  scanMeasurementsPdf,
  type ScannedCheckin,
  type ScannedValues,
} from '@/features/progress/import-scan'
import { queryKeys } from '@/lib/queryKeys'
import { queryClient } from '@/lib/queryClient'
import { SkyBackground } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

/*
 * Importar mediciones (pedido dueña 15 jul 2026) — la tabla del coach entra
 * por foto o PDF. Tres actos: elegir archivo → Stelar transcribe (edge
 * function, IA server-side) → REVISIÓN obligatoria antes de guardar (datos
 * de salud: la usuaria confirma cada fecha; puede excluir columnas). Se
 * guarda como fuente 'coach' (upsert por día: re-importar corrige, no
 * duplica) y cualquier celda se corrige después tocando la fecha en la
 * Tabla completa. Sin ✦: la IA transcribe, no conversa (regla del sello).
 */

const LABELS: { key: keyof ScannedValues; label: string; unit: string }[] = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg' },
  { key: 'bmi', label: 'IMC', unit: '' },
  { key: 'bmr_kcal', label: 'TMB', unit: 'kcal' },
  { key: 'water_pct', label: 'Agua', unit: '%' },
  { key: 'bone_mass_kg', label: 'M. ósea', unit: 'kg' },
  { key: 'metabolic_age', label: 'Edad metab.', unit: 'años' },
  { key: 'visceral_fat_index', label: 'Visceral', unit: '' },
  { key: 'muscle_kg', label: 'Músculo total', unit: 'kg' },
  { key: 'muscle_arm_right_kg', label: 'Brazo der', unit: 'kg' },
  { key: 'muscle_arm_left_kg', label: 'Brazo izq', unit: 'kg' },
  { key: 'muscle_trunk_kg', label: 'Tronco', unit: 'kg' },
  { key: 'muscle_leg_right_kg', label: 'Pierna der', unit: 'kg' },
  { key: 'muscle_leg_left_kg', label: 'Pierna izq', unit: 'kg' },
  { key: 'body_fat_pct', label: 'Grasa total', unit: '%' },
  { key: 'fat_arm_right_pct', label: 'Grasa brazo der', unit: '%' },
  { key: 'fat_arm_left_pct', label: 'Grasa brazo izq', unit: '%' },
  { key: 'fat_trunk_pct', label: 'Grasa tronco', unit: '%' },
  { key: 'fat_leg_right_pct', label: 'Grasa pierna der', unit: '%' },
  { key: 'fat_leg_left_pct', label: 'Grasa pierna izq', unit: '%' },
  { key: 'neck_cm', label: 'Cuello', unit: 'cm' },
  { key: 'chest_cm', label: 'Pecho', unit: 'cm' },
  { key: 'waist_cm', label: 'Cintura', unit: 'cm' },
  { key: 'abdomen_cm', label: 'Abdomen', unit: 'cm' },
  { key: 'hips_cm', label: 'Caderas', unit: 'cm' },
  { key: 'arm_right_cm', label: 'Brazo der', unit: 'cm' },
  { key: 'arm_left_cm', label: 'Brazo izq', unit: 'cm' },
  { key: 'thigh_right_cm', label: 'Muslo der', unit: 'cm' },
  { key: 'thigh_left_cm', label: 'Muslo izq', unit: 'cm' },
  { key: 'calf_right_cm', label: 'Pantorrilla der', unit: 'cm' },
  { key: 'calf_left_cm', label: 'Pantorrilla izq', unit: 'cm' },
]

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtFull = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
const fmtVal = (v: number, unit: string) =>
  `${v % 1 === 0 ? v : v.toFixed(1)}${unit ? ` ${unit}` : ''}`

const valueCount = (c: ScannedCheckin) =>
  LABELS.reduce((n, l) => (c.values[l.key] != null ? n + 1 : n), 0)

type Phase = 'idle' | 'scanning' | 'review' | 'saving'

export default function ImportMeasurementsScreen() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [checkins, setCheckins] = useState<ScannedCheckin[]>([])
  const [confidence, setConfidence] = useState<'alta' | 'media' | 'baja'>('alta')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const fail = () => {
    Toast.show({ type: 'error', text1: 'No pudimos leer tu tabla', text2: 'Intenta de nuevo.' })
    setPhase('idle')
  }

  const receive = (result: {
    checkins: ScannedCheckin[]
    confidence: 'alta' | 'media' | 'baja'
  }) => {
    const withValues = result.checkins.filter((c) => valueCount(c) > 0)
    if (withValues.length === 0) {
      Toast.show({
        type: 'info',
        text1: 'No encontramos una tabla de mediciones',
        text2: 'Prueba con una imagen más clara.',
      })
      setPhase('idle')
      return
    }
    setCheckins(withValues)
    setConfidence(result.confidence)
    setExcluded(new Set())
    setPhase('review')
  }

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
    const uri = res.assets?.[0]?.uri
    if (res.canceled || !uri) return
    setPhase('scanning')
    try {
      receive(await scanMeasurementsImage(uri))
    } catch {
      fail()
    }
  }

  const pickPdf = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' })
    const uri = res.assets?.[0]?.uri
    if (res.canceled || !uri) return
    setPhase('scanning')
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
      receive(await scanMeasurementsPdf(base64))
    } catch {
      fail()
    }
  }

  const included = checkins.filter((c) => !excluded.has(c.date))

  const save = async () => {
    if (included.length === 0 || phase === 'saving') return
    setPhase('saving')
    let saved = 0
    for (const c of included) {
      try {
        const values: Partial<BodyCheckinInput> = {}
        for (const l of LABELS) {
          const v = c.values[l.key]
          if (v != null) values[l.key] = v
        }
        // Secuencial a propósito (conexión de teléfono): un fallo no
        // descarta las demás. Upsert por (día, coach): re-importar corrige.
        await upsertBodyCheckin({ measured_on: c.date, source: 'coach', ...values })
        saved += 1
      } catch {
        // se reporta abajo
      }
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.progress.bodyCheckins() })
    if (saved === 0) {
      Toast.show({ type: 'error', text1: 'No pudimos guardar', text2: 'Intenta de nuevo.' })
      setPhase('review')
      return
    }
    Toast.show({
      type: 'success',
      text1: saved === 1 ? 'Medición guardada' : `${saved} mediciones guardadas`,
      text2: saved < included.length ? 'Algunas no se guardaron. Intenta de nuevo.' : undefined,
    })
    router.replace('/progress-table')
  }

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Importar mediciones</Text>
            <Text style={styles.sub}>De la tabla de tu coach a la tuya</Text>
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

        {phase === 'idle' ? (
          <Animated.View entering={FadeIn.duration(240)} style={styles.content}>
            <Text style={styles.lead}>
              <Text style={styles.leadStar}>✦ </Text>
              Elige una foto o un PDF de tu tabla. Stelar lee los números por ti y tú los revisas
              antes de guardar.
            </Text>
            <View style={styles.sourceBtnWrap}>
              <Pressable
                onPress={() => void pickPhoto()}
                accessibilityRole="button"
                accessibilityLabel="Elegir una foto de tu tabla"
                style={({ pressed }) => pressed && { opacity: 0.75 }}
              >
                <View style={styles.sourceBtn}>
                  <Text style={styles.sourceBtnText}>Elegir foto</Text>
                  <Text style={styles.sourceBtnHint}>Captura o imagen de la tabla</Text>
                </View>
              </Pressable>
            </View>
            <View style={styles.sourceBtnWrap}>
              <Pressable
                onPress={() => void pickPdf()}
                accessibilityRole="button"
                accessibilityLabel="Elegir un PDF de tu tabla"
                style={({ pressed }) => pressed && { opacity: 0.75 }}
              >
                <View style={styles.sourceBtn}>
                  <Text style={styles.sourceBtnText}>Elegir PDF</Text>
                  <Text style={styles.sourceBtnHint}>El archivo que te comparte tu coach</Text>
                </View>
              </Pressable>
            </View>
          </Animated.View>
        ) : phase === 'scanning' ? (
          <View style={styles.scanning}>
            <ActivityIndicator color={colors.magentaHot} />
            <Text style={styles.scanningText}>
              <Text style={styles.leadStar}>✦ </Text>Leyendo tu tabla…
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.lead}>
              Revisa que los números coincidan con tu tabla. Toca una fecha para excluirla; después
              de guardar puedes corregir cualquier celda desde la Tabla completa.
            </Text>
            {confidence !== 'alta' ? (
              <Text style={styles.confidenceNote}>
                La imagen no se leyó del todo clara. Revisa con calma antes de guardar.
              </Text>
            ) : null}

            {checkins.map((c) => {
              const off = excluded.has(c.date)
              return (
                <View key={c.date} style={styles.cardWrap}>
                  <Pressable
                    onPress={() =>
                      setExcluded((prev) => {
                        const next = new Set(prev)
                        if (next.has(c.date)) next.delete(c.date)
                        else next.add(c.date)
                        return next
                      })
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !off }}
                    accessibilityLabel={`Medición del ${fmtFull(c.date)}`}
                    style={({ pressed }) => pressed && { opacity: 0.8 }}
                  >
                    <View style={[styles.card, off && styles.cardOff]}>
                      <View style={styles.cardHead}>
                        <Text style={styles.cardDate}>
                          {fmtFull(c.date)}
                          {c.dateExact ? '' : ' · día estimado'}
                        </Text>
                        <Text style={[styles.cardState, !off && styles.cardStateOn]}>
                          {off ? 'excluida' : 'se guarda'}
                        </Text>
                      </View>
                      {!off
                        ? LABELS.filter((l) => c.values[l.key] != null).map((l) => (
                            <View key={l.key} style={styles.row}>
                              <Text style={styles.rowLabel}>{l.label}</Text>
                              <Text style={styles.rowValue}>
                                {fmtVal(c.values[l.key]!, l.unit)}
                              </Text>
                            </View>
                          ))
                        : null}
                    </View>
                  </Pressable>
                </View>
              )
            })}

            <View style={styles.ctaWrap}>
              <PrimaryCta
                label={
                  included.length === 1
                    ? 'Guardar 1 medición'
                    : `Guardar ${included.length} mediciones`
                }
                onPress={() => void save()}
                loading={phase === 'saving'}
                loadingLabel="Guardando…"
                disabled={included.length === 0}
              />
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.5,
  },
  sub: {
    marginTop: 2,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },
  lead: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 20,
    color: colors.bone,
    marginBottom: 18,
  },
  sourceBtnWrap: { marginBottom: 12 },
  sourceBtn: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 18,
    paddingVertical: 16,
    minHeight: 44,
  },
  sourceBtnText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  sourceBtnHint: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  scanning: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  scanningText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    color: colors.bone,
  },
  leadStar: { color: colors.magentaHot },
  confidenceNote: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.oroSoft,
    marginBottom: 12,
  },
  cardWrap: { marginBottom: 12 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.oroHairlineSoft,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardOff: { opacity: 0.45 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardDate: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.ui,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  cardState: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  cardStateOn: { color: colors.oroSoft },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  rowLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  rowValue: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  ctaWrap: { marginTop: 10 },
})
