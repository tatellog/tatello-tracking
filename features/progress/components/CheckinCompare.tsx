import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

import { PROGRESS_EVENTS } from '../constants'
import { useBodyCheckins } from '../hooks'
import { compareCheckins, type CheckinDeltaKey } from '../logic'

/*
 * Comparador rápido (F3 · mockup dueña) — "compara dos mediciones": elige dos
 * fechas de check-in y mira los CAMBIOS PRINCIPALES como tabla. Anti-fricción
 * estilo MFP: cero pasos entre la pregunta ("¿cómo estaba en junio vs ahora?")
 * y la respuesta. Solo métricas presentes en AMBAS mediciones (compareCheckins,
 * puro). Deltas con hue de identidad por métrica — nunca verde/rojo, nunca
 * semáforo saludable/no-saludable (anti-patrón Renpho). Se gana su lugar con
 * ≥2 check-ins.
 */

const LABEL: Record<CheckinDeltaKey, { name: string; unit: string; hue: string }> = {
  weight_kg: { name: 'Peso', unit: 'kg', hue: colors.oroSoft },
  body_fat_pct: { name: 'Grasa corporal', unit: '%', hue: colors.signal.proteina },
  muscle_kg: { name: 'Músculo', unit: 'kg', hue: colors.dimension.cuerpo },
  water_pct: { name: 'Agua', unit: '%', hue: colors.signal.agua },
  visceral_fat_index: { name: 'Visceral', unit: '', hue: colors.dimension.alimento },
  bmi: { name: 'IMC', unit: '', hue: colors.oroSoft },
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDay = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`

const fmtVal = (v: number, unit: string) =>
  `${v % 1 === 0 ? v : v.toFixed(1)}${unit ? ` ${unit}` : ''}`

export function CheckinCompare() {
  const { data } = useBodyCheckins()
  const checkins = useMemo(() => data ?? [], [data])
  const dates = useMemo(() => checkins.map((c) => c.measured_on), [checkins])

  const [dayA, setDayA] = useState<string | null>(null)
  const [dayB, setDayB] = useState<string | null>(null)
  const a = dayA && dates.includes(dayA) ? dayA : dates[0]
  const b = dayB && dates.includes(dayB) ? dayB : dates[dates.length - 1]

  if (checkins.length < 2 || !a || !b || a === b) return null

  const checkinA = checkins.find((c) => c.measured_on === a)!
  const checkinB = checkins.find((c) => c.measured_on === b)!
  const rows = compareCheckins(checkinA, checkinB)
  if (rows.length === 0) return null

  const pick = (setter: (d: string) => void) => (d: string) => {
    setter(d)
    track(PROGRESS_EVENTS.compare, { kind: 'checkin' })
  }

  return (
    <Animated.View entering={FadeIn.duration(360).delay(140)}>
      <View style={styles.divider} />
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Comparador rápido
      </EyebrowLabel>
      <Text style={styles.sub}>Compara dos mediciones</Text>

      <DateRow label="Antes" dates={dates} value={a} exclude={b} onPick={pick(setDayA)} />
      <DateRow label="Después" dates={dates} value={b} exclude={a} onPick={pick(setDayB)} />

      <View style={styles.table}>
        <View style={styles.headRow}>
          <Text style={styles.headLabel}>CAMBIOS PRINCIPALES</Text>
          <Text style={styles.headDates}>
            {fmtDay(a)} → {fmtDay(b)}
          </Text>
        </View>
        {rows.map((r, i) => {
          const meta = LABEL[r.key]
          const arrow = r.delta === 0 ? null : r.delta > 0 ? '↑' : '↓'
          return (
            <View key={r.key} style={[styles.row, i > 0 && styles.rowDivider]}>
              <Text style={[styles.rowLabel, { color: meta.hue }]}>{meta.name}</Text>
              <View style={styles.rowValues}>
                <Text style={styles.rowA}>{fmtVal(r.a, meta.unit)}</Text>
                <Text style={[styles.rowArrow, { color: meta.hue }]}>→</Text>
                <Text style={styles.rowB}>{fmtVal(r.b, meta.unit)}</Text>
                {arrow ? (
                  <Text style={[styles.rowDelta, { color: meta.hue }]}>
                    {arrow} {r.delta > 0 ? '+' : '−'}
                    {fmtVal(Math.abs(r.delta), meta.unit)}
                  </Text>
                ) : null}
              </View>
            </View>
          )
        })}
      </View>

      {/* "En resumen" determinístico: los hechos en una línea, sin adjetivos
          (nada de 'mejoró notablemente' — juicio). */}
      {rows.length > 1 ? (
        <Text style={styles.summary}>
          Entre estas dos mediciones:{' '}
          {rows
            .filter((r) => r.delta !== 0)
            .map((r) => {
              const meta = LABEL[r.key]
              return `${meta.name.toLowerCase()} ${r.delta > 0 ? '+' : '−'}${Math.abs(r.delta) % 1 === 0 ? Math.abs(r.delta) : Math.abs(r.delta).toFixed(1)}${meta.unit ? ` ${meta.unit}` : ''}`
            })
            .join(' · ')}
          .
        </Text>
      ) : null}

      {/* La protección del manifiesto (mockup + benchmark: perfecta tal cual). */}
      <Text style={styles.disclaimer}>
        Stelar solo interpreta tus registros. No sustituye a un profesional de la salud.
      </Text>
    </Animated.View>
  )
}

function DateRow({
  label,
  dates,
  value,
  exclude,
  onPick,
}: {
  label: string
  dates: string[]
  value: string
  exclude: string
  onPick: (d: string) => void
}) {
  return (
    <View style={styles.dateRow}>
      <Text style={styles.dateLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.dateChips}>
          {dates.map((d) => {
            const on = d === value
            const disabled = d === exclude && !on
            return (
              <Pressable
                key={d}
                onPress={() => !disabled && onPick(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled }}
                style={[styles.dateChip, on && styles.dateChipOn, disabled && styles.dateChipOff]}
              >
                <Text style={[styles.dateText, on && styles.dateTextOn]}>{fmtDay(d)}</Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', marginVertical: 28 },
  eyebrow: { marginBottom: 2 },
  sub: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
    marginBottom: 12,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  dateLabel: {
    width: 58,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  dateChips: { flexDirection: 'row', gap: 6 },
  dateChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bruma,
  },
  dateChipOn: { backgroundColor: colors.magentaTint2, borderColor: colors.magentaGlow },
  dateChipOff: { opacity: 0.35 },
  dateText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  dateTextOn: { color: colors.magentaHot, fontFamily: typography.uiBold },
  table: {
    marginTop: 8,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8 },
  headLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.6,
    color: colors.niebla,
  },
  headDates: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  row: { paddingVertical: 11 },
  rowDivider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  rowLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  rowValues: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  rowA: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.ui,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  rowArrow: { fontFamily: typography.uiMedium, fontSize: typography.sizes.body },
  rowB: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.anchor,
    color: colors.leche,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  // Delta en el hue de la métrica (identidad, no juicio) — a la derecha.
  rowDelta: {
    marginLeft: 'auto',
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    fontVariant: ['tabular-nums'],
  },
  summary: {
    marginTop: 12,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  disclaimer: {
    marginTop: 10,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
})
