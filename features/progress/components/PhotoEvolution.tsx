import { useMemo, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Line, Path } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry/four-point-star-path'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

import type { PhotoAngle } from '../api'
import { PROGRESS_EVENTS } from '../constants'
import { usePhotoTimeline } from '../hooks'
import { photoAt, photoDatesFor } from '../logic'

/*
 * Evolución visual (F2 · mockup dueña, el "slider de cuerpo") — MUEVE EL TIEMPO
 * y la fotografía cambia: una línea de tiempo con una estrella por fecha; tocas
 * una estrella y ves cómo te veías ese día, por ángulo. El gancho de retención
 * de largo plazo más fuerte de la categoría (Renpho/Withings), traducido al
 * cielo de Stelar. Cobra vida con el backdating (fotos del coach con su fecha).
 * Se gana su lugar con ≥2 fechas de algún ángulo.
 */

const ANGLES: { key: PhotoAngle; label: string }[] = [
  { key: 'front', label: 'Frente' },
  { key: 'back', label: 'Espalda' },
  { key: 'side_left', label: 'Perfil izq' },
  { key: 'side_right', label: 'Perfil der' },
]

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDay = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`

export function PhotoEvolution() {
  const { data } = usePhotoTimeline()
  const photos = useMemo(() => data ?? [], [data])

  // Ángulos con ≥2 fechas (los únicos donde "mover el tiempo" dice algo).
  const usable = useMemo(
    () => ANGLES.filter((a) => photoDatesFor(photos, a.key).length >= 2),
    [photos],
  )
  const [angle, setAngle] = useState<PhotoAngle | null>(null)
  const active = angle ?? usable[0]?.key ?? null

  const dates = useMemo(() => (active ? photoDatesFor(photos, active) : []), [photos, active])
  const [selected, setSelected] = useState<string | null>(null)
  const day = selected && dates.includes(selected) ? selected : dates[dates.length - 1]

  if (!active || usable.length === 0 || !day) return null
  const photo = photoAt(photos, active, day)
  if (!photo?.signed_url) return null

  const pickDay = (d: string) => {
    setSelected(d)
    track(PROGRESS_EVENTS.photo, { kind: 'evolution' })
  }

  return (
    <Animated.View entering={FadeIn.duration(360).delay(140)}>
      <View style={styles.divider} />
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Evolución visual
      </EyebrowLabel>
      <Text style={styles.sub}>Mueve el tiempo: la fotografía cambia</Text>

      {usable.length > 1 ? (
        <View style={styles.angleRow}>
          {usable.map((a) => {
            const on = a.key === active
            return (
              <Pressable
                key={a.key}
                onPress={() => {
                  setAngle(a.key)
                  setSelected(null)
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.angleChip, on && styles.angleChipOn]}
              >
                <Text style={[styles.angleLabel, on && styles.angleLabelOn]}>{a.label}</Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}

      <View style={styles.photoFrame}>
        {/* contain: la foto COMPLETA siempre visible (cover recortaba cabeza y
            pies de las fotos de cuerpo entero · feedback dueña). */}
        <Image source={{ uri: photo.signed_url }} style={styles.photo} resizeMode="contain" />
        <Text style={styles.photoDate}>{fmtDay(day)}</Text>
      </View>

      {/* La línea de tiempo: una estrella por fecha; la elegida brilla. */}
      <View style={styles.timeline}>
        <Svg width="100%" height={2} style={styles.timelineRail}>
          <Line x1="0" y1="1" x2="100%" y2="1" stroke={colors.oroHairline} strokeWidth={1.2} />
        </Svg>
        <View style={styles.stops}>
          {dates.map((d) => {
            const on = d === day
            return (
              <Pressable
                key={d}
                onPress={() => pickDay(d)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Ver foto del ${fmtDay(d)}`}
                style={styles.stop}
              >
                <Svg width={26} height={26} viewBox="0 0 26 26">
                  <Path
                    d={fourPointStarPath(13, 13, on ? 8 : 5)}
                    fill={on ? colors.oroLeche : colors.oroSoft}
                    opacity={on ? 1 : 0.7}
                  />
                </Svg>
                <Text style={[styles.stopLabel, on && styles.stopLabelOn]}>
                  {`${MESES[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    </Animated.View>
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
  // Marco alto (~proporción de foto de cuerpo entero) — con contain, la foto
  // se ve completa y el letterbox se funde en bgCard.
  photoFrame: {
    aspectRatio: 0.52,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.oroHairlineSoft,
    backgroundColor: colors.bgCard,
  },
  photo: { ...StyleSheet.absoluteFillObject },
  photoDate: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
    backgroundColor: 'rgba(10, 6, 8, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: 'hidden',
    fontVariant: ['tabular-nums'],
  },
  timeline: { marginTop: 14 },
  timelineRail: { position: 'absolute', top: 12 },
  stops: { flexDirection: 'row', justifyContent: 'space-between' },
  stop: { alignItems: 'center', gap: 2 },
  stopLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  stopLabelOn: { color: colors.oroLeche, fontFamily: typography.uiBold },
})
