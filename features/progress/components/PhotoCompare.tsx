import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

import type { PhotoAngle } from '../api'
import { PROGRESS_EVENTS } from '../constants'
import { usePhotoTimeline } from '../hooks'
import { photoAt, photoDatesFor } from '../logic'
import { BeforeAfterSlider } from './BeforeAfterSlider'

/*
 * Comparador de fotos por FECHAS (Epic 02 · Body): elige un ángulo y dos
 * fechas, y compara con el slider. Se gana su lugar solo con ≥2 fechas de un
 * ángulo — con menos, la sección no existe (sin cascarones). Reusa
 * BeforeAfterSlider (el mismo gesto de arrastre del antes/ahora de Historia).
 * La lógica de fechas vive en logic.ts (photoDatesFor/photoAt), pura y testeada.
 */

const ANGLES: { key: PhotoAngle; label: string }[] = [
  { key: 'front', label: 'Frente' },
  { key: 'back', label: 'Espalda' },
  { key: 'side_left', label: 'Perfil izq' },
  { key: 'side_right', label: 'Perfil der' },
]

const fmtDay = (iso: string): string => {
  const [y, m, d] = iso.split('-')
  return `${Number(d)}/${Number(m)}/${y!.slice(2)}`
}

export function PhotoCompare() {
  const { data } = usePhotoTimeline()
  const photos = useMemo(() => data ?? [], [data])

  // Ángulos con ≥2 fechas (los únicos comparables).
  const usable = useMemo(
    () => ANGLES.filter((a) => photoDatesFor(photos, a.key).length >= 2),
    [photos],
  )
  const [angle, setAngle] = useState<PhotoAngle | null>(null)
  const active = angle ?? usable[0]?.key ?? null

  const dates = useMemo(() => (active ? photoDatesFor(photos, active) : []), [photos, active])
  // Por defecto: primera vs última (el arco completo). La usuaria puede mover
  // cualquiera de los dos extremos.
  const [dayA, setDayA] = useState<string | null>(null)
  const [dayB, setDayB] = useState<string | null>(null)
  const a = dayA && dates.includes(dayA) ? dayA : dates[0]
  const b = dayB && dates.includes(dayB) ? dayB : dates[dates.length - 1]

  if (!active || usable.length === 0 || !a || !b) return null

  const photoA = photoAt(photos, active, a)
  const photoB = photoAt(photos, active, b)
  if (!photoA?.signed_url || !photoB?.signed_url) return null

  const pickAngle = (k: PhotoAngle) => {
    setAngle(k)
    setDayA(null)
    setDayB(null)
    track(PROGRESS_EVENTS.photo, { angle: k })
  }

  return (
    <Animated.View entering={FadeIn.duration(360).delay(160)}>
      {/* Divisor propio: solo existe cuando hay ≥2 fechas comparables. */}
      <View style={styles.divider} />
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Compara dos momentos
      </EyebrowLabel>

      {usable.length > 1 ? (
        <View style={styles.angleRow}>
          {usable.map((aOpt) => {
            const on = aOpt.key === active
            return (
              <Pressable
                key={aOpt.key}
                onPress={() => pickAngle(aOpt.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.angleChip, on && styles.angleChipOn]}
              >
                <Text style={[styles.angleLabel, on && styles.angleLabelOn]}>{aOpt.label}</Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}

      <BeforeAfterSlider beforeUrl={photoA.signed_url} afterUrl={photoB.signed_url} />

      {/* Las dos fechas: chips por fila (Antes / Ahora). */}
      <DateRow label="Antes" dates={dates} value={a} exclude={b} onPick={setDayA} />
      <DateRow label="Ahora" dates={dates} value={b} exclude={a} onPick={setDayB} />
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
  /** La fecha del otro extremo — comparar un día consigo mismo no dice nada. */
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
  eyebrow: { marginBottom: 12 },
  angleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  angleChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard2,
  },
  angleChipOn: { backgroundColor: colors.magentaTint2, borderColor: colors.magentaGlow },
  angleLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  angleLabelOn: { color: colors.magentaHot },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  dateLabel: {
    width: 48,
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
})
