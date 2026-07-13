import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { StelarStar } from '@/features/orbit/components/MonthChatView'
import { requestOrbitSegment } from '@/features/orbit/pending-segment'
import { useBodyCheckins } from '@/features/progress/hooks'
import {
  compareBuckets,
  compareCheckins,
  compareSynthesis,
  type CheckinDelta,
  type CheckinDeltaKey,
} from '@/features/progress/logic'
import { PROGRESS_EVENTS } from '@/features/progress/constants'
import { SkyBackground } from '@/features/tabs/components'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

/*
 * Análisis (D · Progress 3.0, versión DETERMINISTA para beta) — la película del
 * tráiler ✦: la síntesis honesta + botones GUIADOS que revelan cards. Cero IA:
 * todo sale del motor (compareCheckins/compareSynthesis/compareBuckets). NO
 * finge chat (cards reveladas, no burbujas): fingir conversación sin IA rompe
 * confianza (benchmark). 3 botones v1; '¿Desde cuándo ocurre?' y 'Ver en
 * calendario' llegan post-launch. El porqué vive en Órbita (línea del módulo).
 */

const LABEL: Record<CheckinDeltaKey, { name: string; unit: string }> = {
  weight_kg: { name: 'Peso', unit: 'kg' },
  body_fat_pct: { name: 'Grasa corporal', unit: '%' },
  muscle_kg: { name: 'Músculo', unit: 'kg' },
  water_pct: { name: 'Agua', unit: '%' },
  visceral_fat_index: { name: 'Visceral (índice)', unit: '' },
  bmi: { name: 'IMC', unit: '' },
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDay = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`
const fmtVal = (v: number, unit: string) =>
  `${v % 1 === 0 ? v : v.toFixed(1)}${unit ? ` ${unit}` : ''}`

export default function ProgressAnalysisScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ a?: string; b?: string }>()
  const { data } = useBodyCheckins()
  const checkins = useMemo(() => data ?? [], [data])

  const [openChanges, setOpenChanges] = useState(false)
  const [openData, setOpenData] = useState(false)

  const a = typeof params.a === 'string' ? params.a : undefined
  const b = typeof params.b === 'string' ? params.b : undefined
  const checkinA = checkins.find((c) => c.measured_on === a)
  const checkinB = checkins.find((c) => c.measured_on === b)
  const rows = checkinA && checkinB ? compareCheckins(checkinA, checkinB) : []
  const synthesis = compareSynthesis(rows)
  const { gains, hard } = compareBuckets(rows)

  const goOrbita = () => {
    track(PROGRESS_EVENTS.openOrbita, { from: 'analysis' })
    requestOrbitSegment('mes')
    router.push('/orbit')
  }

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Análisis</Text>
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

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {rows.length === 0 || !a || !b ? (
            <Text style={styles.empty}>
              No encontré esas mediciones. Regresa y elige otras dos fechas.
            </Text>
          ) : (
            <>
              {/* Quién habla + qué miró: la ✦, sin fingir chat. */}
              <View style={styles.who}>
                <StelarStar size={26} />
                <Text style={styles.whoText}>
                  Lo que encontré entre el {fmtDay(a)} y el {fmtDay(b)}
                </Text>
              </View>

              {synthesis ? <Text style={styles.synthesis}>{synthesis}</Text> : null}

              {/* Botones guiados → cards reveladas (nunca input libre). */}
              <GuideButton
                label="¿Qué cambió?"
                open={openChanges}
                onPress={() => {
                  setOpenChanges((v) => !v)
                  track(PROGRESS_EVENTS.openInsight, { kind: 'analysis-changes' })
                }}
              />
              {openChanges ? (
                <Animated.View entering={FadeIn.duration(240)} style={styles.card}>
                  {gains.map((r) => (
                    <ChangeRow key={r.key} row={r} favorable />
                  ))}
                  {hard.map((r) => (
                    <ChangeRow key={r.key} row={r} />
                  ))}
                </Animated.View>
              ) : null}

              <GuideButton
                label="Muéstrame los datos"
                open={openData}
                onPress={() => {
                  setOpenData((v) => !v)
                  track(PROGRESS_EVENTS.openInsight, { kind: 'analysis-data' })
                }}
              />
              {openData ? (
                <Animated.View entering={FadeIn.duration(240)} style={styles.card}>
                  {rows.map((r) => {
                    const meta = LABEL[r.key]
                    return (
                      <View key={r.key} style={styles.dataRow}>
                        <Text style={styles.dataLabel}>{meta.name}</Text>
                        <Text style={styles.dataValues}>
                          {fmtVal(r.a, meta.unit)}
                          <Text style={styles.dataArrow}>{'  →  '}</Text>
                          {fmtVal(r.b, meta.unit)}
                        </Text>
                      </View>
                    )
                  })}
                </Animated.View>
              ) : null}

              <GuideButton label="Abrir en Órbita" chevron onPress={goOrbita} />
              <Text style={styles.orbitaHint}>Aquí ves qué cambió. El porqué vive en Órbita.</Text>

              <Text style={styles.disclaimer}>
                Stelar solo interpreta tus registros. No sustituye a un profesional de la salud.
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function GuideButton({
  label,
  open,
  chevron,
  onPress,
}: {
  label: string
  open?: boolean
  chevron?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={open != null ? { expanded: open } : undefined}
      style={({ pressed }) => [styles.guide, pressed && { opacity: 0.75 }]}
    >
      <Text style={styles.guideText}>{label}</Text>
      <Text style={styles.guideGlyph}>{chevron ? '→' : open ? '▾' : '▸'}</Text>
    </Pressable>
  )
}

/** Un cambio como HECHO. Los rescates llevan la marca "a tu favor" (oro);
 *  los demás se nombran planos — no existe la etiqueta del bucket malo. */
function ChangeRow({ row, favorable }: { row: CheckinDelta; favorable?: boolean }) {
  const meta = LABEL[row.key]
  const arrow = row.delta > 0 ? '↑' : '↓'
  return (
    <View style={styles.changeRow}>
      <View style={styles.changeMain}>
        <Text style={styles.changeLabel}>{meta.name}</Text>
        <Text style={styles.changeValues}>
          {fmtVal(row.a, meta.unit)} → {fmtVal(row.b, meta.unit)}
        </Text>
      </View>
      <View style={styles.changeSide}>
        <Text style={styles.changeDelta}>
          {arrow} {row.delta > 0 ? '+' : '−'}
          {fmtVal(Math.abs(row.delta), meta.unit)}
        </Text>
        {favorable ? <Text style={styles.favTag}>a tu favor</Text> : null}
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
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  empty: {
    marginTop: 30,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    textAlign: 'center',
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  whoText: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  synthesis: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    lineHeight: 30,
    color: colors.leche,
    marginBottom: 20,
  },
  guide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: colors.bgCard,
    marginTop: 10,
  },
  guideText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  guideGlyph: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.magentaHot,
  },
  card: {
    marginTop: 8,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.oroHairlineSoft,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  changeMain: { flex: 1 },
  changeLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  changeValues: {
    marginTop: 3,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  changeSide: { alignItems: 'flex-end' },
  changeDelta: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  favTag: {
    marginTop: 2,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 9,
  },
  dataLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  dataValues: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  dataArrow: { color: colors.oro },
  orbitaHint: {
    marginTop: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  disclaimer: {
    marginTop: 22,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
})
