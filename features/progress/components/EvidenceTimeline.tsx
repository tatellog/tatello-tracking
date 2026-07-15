import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Line, Path } from 'react-native-svg'
import { useRouter } from 'expo-router'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry/four-point-star-path'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

import type { PhotoAngle } from '../api'
import { PROGRESS_EVENTS } from '../constants'
import { useBodyCheckins, usePhotoTimeline } from '../hooks'
import { photoAt, photoDatesFor } from '../logic'

import { LinkCta } from './LinkCta'

/*
 * Historial (FUSIÓN dueña 15 jul 2026: "Historial de mediciones" y
 * "Evolución visual" eran gemelos — dos rieles horizontales de fotos con
 * fechas a media pantalla de distancia). UNA sola línea del tiempo con TODA
 * la evidencia:
 *
 * - Cada fecha es un TILE: la foto del ángulo activo si ese día la tiene, o
 *   una estrella sobre card si solo hay números. Debajo: fecha + kg + %grasa
 *   (evidencia sin juicio: los números son caption, jamás encima de la foto).
 * - UN solo tap: seleccionar la fecha ARMA EL COMPARADOR de abajo (el ritual
 *   del coach: "toca una y compárala abajo"). El CAPÍTULO de la fecha (foto
 *   grande + contexto) vive en un LinkCta contextual bajo la tira — aparece
 *   cuando la fecha seleccionada tiene foto (un tap, un destino; nada de
 *   gestos ocultos).
 * - Scrubber arriba (equiespaciado anti-culpa; "Hoy" solo si la última
 *   evidencia es reciente), tabs de ángulo abajo, tile fantasma "Capítulo de
 *   hoy" como invitación. "Ver tabla completa →" sigue en el header (el
 *   expediente crudo no cambia de casa).
 *
 * Reemplaza a CheckinTimeline + PhotoEvolution (borrados).
 */

const ANGLES: { key: PhotoAngle; label: string }[] = [
  { key: 'front', label: 'Frente' },
  { key: 'back', label: 'Espalda' },
  { key: 'side_left', label: 'Perfil izq' },
  { key: 'side_right', label: 'Perfil der' },
]

const TILE_W = 74
const TILE_GAP = 8
const TILE_H = Math.round(TILE_W / 0.52)
// Pasados 60 días, la última evidencia deja de ser "hoy".
const STALE_MS = 60 * 24 * 60 * 60 * 1000
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtShort = (iso: string): string => `${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`
const fmtFull = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`

export function EvidenceTimeline({ onPick }: { onPick?: (day: string) => void }) {
  const router = useRouter()
  const { data: checkinsData } = useBodyCheckins()
  const checkins = useMemo(() => checkinsData ?? [], [checkinsData])
  const photosQ = usePhotoTimeline()
  const photos = useMemo(() => photosQ.data ?? [], [photosQ.data])

  const usableAngles = useMemo(
    () => ANGLES.filter((a) => photoDatesFor(photos, a.key).length >= 1),
    [photos],
  )
  const [angle, setAngle] = useState<PhotoAngle | null>(null)
  const active = angle ?? usableAngles[0]?.key ?? null

  // La unión de TODAS las fechas con evidencia: mediciones y fotos del
  // ángulo activo, cronológicas.
  const items = useMemo(() => {
    const byDay = new Map(checkins.map((c) => [c.measured_on, c]))
    const photoDays = active ? photoDatesFor(photos, active) : []
    const days = [...new Set([...checkins.map((c) => c.measured_on), ...photoDays])].sort()
    return days
      .map((day) => ({
        day,
        photo: active ? photoAt(photos, active, day) : null,
        checkin: byDay.get(day) ?? null,
      }))
      .filter((x) => x.photo?.signed_url != null || x.checkin != null)
  }, [checkins, photos, active])

  const stripRef = useRef<ScrollView>(null)
  const [viewedIdx, setViewedIdx] = useState(0)
  const [railW, setRailW] = useState(0)

  // Aterriza en lo más reciente (tu yo de hoy; scrolleas hacia atrás).
  useEffect(() => {
    setViewedIdx(items.length - 1)
    const t = setTimeout(() => stripRef.current?.scrollToEnd({ animated: false }), 50)
    return () => clearTimeout(t)
  }, [active, items.length])

  if (items.length < 2) return null

  // Clamp en render: al cambiar de ángulo, viewedIdx aún trae el índice del
  // set anterior (el efecto corre después del render · aprendizaje 15 jul).
  const shownIdx = Math.max(0, Math.min(viewedIdx, items.length - 1))
  const shown = items[shownIdx]!

  const lastItem = items[items.length - 1]
  const stale =
    lastItem != null && Date.now() - new Date(`${lastItem.day}T12:00:00`).getTime() > STALE_MS

  const onStripScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = e.nativeEvent
    const lastVisible = Math.floor(
      (contentOffset.x + layoutMeasurement.width - TILE_W / 2) / (TILE_W + TILE_GAP),
    )
    setViewedIdx(Math.max(0, Math.min(items.length - 1, lastVisible)))
  }

  const jumpTo = (idx: number) => {
    stripRef.current?.scrollTo({ x: Math.max(0, idx * (TILE_W + TILE_GAP) - 40), animated: true })
    setViewedIdx(idx)
  }

  const reserve = stale ? 8 : 44
  const onRailPress = (x: number) => {
    if (railW <= 0 || items.length < 2) return
    const usableW = railW - reserve
    const idx = Math.round((x / usableW) * (items.length - 1))
    jumpTo(Math.max(0, Math.min(items.length - 1, idx)))
    track(PROGRESS_EVENTS.photo, { kind: 'scrub' })
  }
  const dotX = (i: number, w: number) =>
    items.length > 1 ? (i / (items.length - 1)) * (w - reserve) : 0

  const showGhost = items.length < 4 || stale

  return (
    <Animated.View entering={FadeIn.duration(360).delay(160)}>
      <View style={styles.divider} />
      <View style={styles.headerRow}>
        <View style={styles.eyebrowShrink}>
          <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
            Historial
          </EyebrowLabel>
        </View>
        {/* La tabla del coach (decisión dueña): todos los números, sin frases. */}
        <View style={styles.tableLinkWrap}>
          <LinkCta
            label="Ver tabla completa →"
            onPress={() => {
              router.push('/progress-table')
              track(PROGRESS_EVENTS.body, { kind: 'table' })
            }}
            accessibilityLabel="Ver la tabla completa de mediciones"
          />
        </View>
      </View>
      <Text style={styles.sub}>Fotos y mediciones · toca una y compárala abajo</Text>

      {/* ── Scrubber: rail + recorrido oro + estrellas + "Hoy" ── */}
      <Pressable
        onPress={(e) => onRailPress(e.nativeEvent.locationX)}
        onLayout={(e) => setRailW(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel="Línea de tiempo de tu evidencia"
        style={styles.rail}
      >
        {railW > 0 ? (
          <>
            <Svg width={railW} height={44} style={StyleSheet.absoluteFill}>
              <Line
                x1={4}
                y1={22}
                x2={stale ? 4 + dotX(items.length - 1, railW) : railW - 4}
                y2={22}
                stroke={colors.oroHairline}
                strokeWidth={1.4}
              />
              {/* Recorrido en ORO: es "lo que ya recorriste", el mismo
                  significado que el trail del hero (auditoría). */}
              <Line
                x1={4}
                y1={22}
                x2={4 + dotX(items.length - 1, railW)}
                y2={22}
                stroke={colors.oro}
                strokeWidth={2}
              />
              {items.map((it, i) => (
                <Path
                  key={it.day}
                  d={fourPointStarPath(4 + dotX(i, railW), 22, i === shownIdx ? 7 : 4.5)}
                  fill={i === shownIdx ? colors.oroLeche : colors.oroSoft}
                  opacity={i === shownIdx ? 1 : 0.75}
                />
              ))}
            </Svg>
            {stale ? null : <Text style={styles.hoy}>Hoy</Text>}
            <Text style={[styles.railLabel, { left: 0 }]}>{fmtShort(items[0]!.day)}</Text>
            {shownIdx > 0 ? (
              <Text
                style={[
                  styles.railLabel,
                  styles.railLabelOn,
                  { left: Math.min(railW - 70, Math.max(30, dotX(shownIdx, railW) - 16)) },
                ]}
              >
                {fmtShort(items[shownIdx]!.day)}
              </Text>
            ) : null}
          </>
        ) : null}
      </Pressable>

      {/* ── La tira: cada fecha con su evidencia (foto o estrella) + números ── */}
      <ScrollView
        ref={stripRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={onStripScroll}
        scrollEventThrottle={32}
      >
        <View style={styles.strip}>
          {items.map((it, i) => (
            <Pressable
              key={it.day}
              onPress={() => {
                // UN tap = seleccionar: arma el comparador de abajo. El
                // capítulo vive en el link contextual bajo la tira.
                jumpTo(i)
                onPick?.(it.day)
                track(PROGRESS_EVENTS.compare, { kind: 'timeline' })
              }}
              accessibilityRole="button"
              accessibilityLabel={`Comparar la evidencia del ${fmtFull(it.day)}`}
              style={styles.tileWrap}
            >
              <View style={[styles.tile, i === shownIdx && styles.tileOn]}>
                {it.photo?.signed_url ? (
                  <Image
                    source={{ uri: it.photo.signed_url }}
                    style={styles.tileImg}
                    resizeMode="contain"
                  />
                ) : (
                  // Solo números ese día: la estrella sostiene el lugar.
                  <Svg width={26} height={26} viewBox="0 0 26 26">
                    <Path d={fourPointStarPath(13, 13, 8)} fill={colors.oroSoft} opacity={0.8} />
                  </Svg>
                )}
              </View>
              <Text style={[styles.tileDate, i === shownIdx && styles.tileDateOn]}>
                {i === 0 ? 'Inicio · ' : ''}
                {fmtShort(it.day)}
              </Text>
              {it.checkin?.weight_kg != null ? (
                <Text style={styles.tileMetric}>{it.checkin.weight_kg.toFixed(1)} kg</Text>
              ) : null}
              {it.checkin?.body_fat_pct != null ? (
                <Text style={styles.tileMetric}>{it.checkin.body_fat_pct.toFixed(1)} %</Text>
              ) : null}
            </Pressable>
          ))}
          {showGhost ? (
            <Pressable
              onPress={() => router.push('/log-photos')}
              accessibilityRole="button"
              accessibilityLabel="Abrir el capítulo de hoy con una foto nueva"
              style={styles.tileWrap}
            >
              <View style={[styles.tile, styles.ghost]}>
                <Svg width={26} height={26} viewBox="0 0 26 26">
                  <Path d={fourPointStarPath(13, 13, 8)} fill={colors.bruma} />
                </Svg>
              </View>
              <Text style={styles.tileDate}>Capítulo de hoy</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {/* La puerta al capítulo de la fecha seleccionada (solo con foto). */}
      {shown.photo?.signed_url != null && active ? (
        <LinkCta
          label={`Abrir el capítulo del ${fmtFull(shown.day)} →`}
          onPress={() => {
            router.push({ pathname: '/photo-chapter', params: { day: shown.day, angle: active } })
            track(PROGRESS_EVENTS.photo, { kind: 'chapter' })
          }}
          accessibilityLabel={`Abrir el capítulo del ${fmtFull(shown.day)}`}
          style={styles.chapterLink}
        />
      ) : null}

      {/* ── Tabs de ángulo (cambian las fotos de la tira) ── */}
      {usableAngles.length > 1 ? (
        <View style={styles.angleRow}>
          {usableAngles.map((a) => {
            const on = a.key === active
            return (
              <Pressable
                key={a.key}
                onPress={() => setAngle(a.key)}
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
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  divider: { height: 0, marginVertical: 28 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
  },
  eyebrowShrink: { flexShrink: 1 },
  tableLinkWrap: { flexShrink: 0 },
  eyebrow: { marginBottom: 2 },
  sub: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    marginBottom: 6,
  },
  rail: { height: 44, justifyContent: 'center', marginBottom: 6 },
  hoy: {
    position: 'absolute',
    right: 0,
    top: 15,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    color: colors.oroLeche,
  },
  railLabel: {
    position: 'absolute',
    top: 32,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  railLabelOn: { color: colors.oroLeche, fontFamily: typography.uiBold },
  strip: { flexDirection: 'row', gap: TILE_GAP, paddingTop: 8, paddingRight: 12 },
  tileWrap: { width: TILE_W, alignItems: 'center' },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.oroHairlineSoft,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileOn: { borderColor: colors.oroGlow },
  tileImg: { width: TILE_W, height: TILE_H },
  ghost: { borderStyle: 'dashed', borderColor: colors.bruma },
  tileDate: {
    marginTop: 5,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  tileDateOn: { color: colors.oroLeche, fontFamily: typography.uiBold },
  tileMetric: {
    marginTop: 1,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.tinyLabel,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  chapterLink: { alignSelf: 'center', marginTop: 2 },
  angleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
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
})
