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

import type { PhotoAngle, TimelinePhoto } from '../api'
import { PROGRESS_EVENTS } from '../constants'
import { usePhotoTimeline } from '../hooks'
import { photoAt, photoDatesFor } from '../logic'

/*
 * Evolución visual (rediseño · mockup dueña + uxui + benchmark) — la TIRA DE
 * PELÍCULA: todas las fotos del ángulo lado a lado, cronológicas, aterrizando
 * en la más reciente. La progresión está FRENTE a los ojos, no en la memoria
 * (el slideshow de una foto obligaba a comparar de memoria). A este tamaño la
 * silueta responde "¿cambió mi forma?"; el DETALLE vive a un tap: el CAPÍTULO
 * de esa fecha (/photo-chapter · Epic 08), con sus datos y su contexto.
 *
 * Scrubber arriba: línea con relleno magenta hasta la última foto + estrellas ✦
 * equiespaciadas (equiespaciado a propósito: huecos temporales largos leerían
 * como "aquí me abandoné" · anti-culpa). El ancla "Hoy" a la derecha SOLO
 * cuando la última foto es reciente (≤60 días): con fotos viejas, el tramo
 * vacío hasta "Hoy" era el hueco acusador ("aquí desapareciste" · target-user)
 * y deshacía el equiespaciado anti-culpa por la puerta de atrás — el riel
 * termina donde termina la evidencia. El RAIL completo es el touch target
 * (44pt): tap → la tira salta a esa fecha (escala a 20 fechas). Tabs de ángulo
 * ABAJO (píldoras, alcance de pulgar). El tile fantasma dice "Capítulo de hoy"
 * (invitación de inicio, no tarea pendiente: "Agregar era un examen y el
 * examen lo pospongo"); aparece con <4 fechas o cuando las fotos son viejas.
 * Evidencia sin juicio: solo fechas sobre las fotos, jamás peso/medidas encima.
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
// Misma ventana de frescura que el díptico: pasados 60 días, la última foto
// deja de ser "hoy".
const STALE_MS = 60 * 24 * 60 * 60 * 1000
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtShort = (iso: string): string => `${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`
const fmtFull = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`

export function PhotoEvolution() {
  const router = useRouter()
  const { data } = usePhotoTimeline()
  const photos = useMemo(() => data ?? [], [data])

  const usable = useMemo(
    () => ANGLES.filter((a) => photoDatesFor(photos, a.key).length >= 2),
    [photos],
  )
  const [angle, setAngle] = useState<PhotoAngle | null>(null)
  const active = angle ?? usable[0]?.key ?? null
  const dates = useMemo(() => (active ? photoDatesFor(photos, active) : []), [photos, active])

  const items = useMemo(
    () =>
      active
        ? dates
            .map((d) => ({ day: d, photo: photoAt(photos, active, d) }))
            .filter((x): x is { day: string; photo: TimelinePhoto } => x.photo?.signed_url != null)
        : [],
    [dates, photos, active],
  )

  const stripRef = useRef<ScrollView>(null)
  const [viewedIdx, setViewedIdx] = useState(0)
  const [railW, setRailW] = useState(0)

  // Aterriza en lo más reciente (tu yo de hoy; scrolleas hacia atrás para viajar).
  useEffect(() => {
    setViewedIdx(items.length - 1)
    const t = setTimeout(() => stripRef.current?.scrollToEnd({ animated: false }), 50)
    return () => clearTimeout(t)
  }, [active, items.length])

  if (!active || usable.length === 0 || items.length === 0) return null

  // El índice visto se CLAMPA en render: al cambiar de ángulo, viewedIdx aún
  // trae el índice del ángulo anterior (el efecto que lo resetea corre
  // DESPUÉS del render) y items[viewedIdx] explotaba con menos fotos en el
  // ángulo nuevo (render error dueña 15 jul 2026).
  const shownIdx = Math.max(0, Math.min(viewedIdx, items.length - 1))

  // Última foto vieja → el riel termina en su estrella (sin ancla "Hoy") y el
  // tile fantasma invita a abrir el capítulo de hoy.
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
    track(PROGRESS_EVENTS.photo, { kind: 'scrub' })
  }

  // Reserva a la derecha: espacio del label "Hoy" solo cuando existe.
  const reserve = stale ? 8 : 44

  // Rail completo como touch target: tap en cualquier x → la fecha más cercana.
  const onRailPress = (x: number) => {
    if (railW <= 0 || items.length < 2) return
    const usableW = railW - reserve
    const idx = Math.round((x / usableW) * (items.length - 1))
    jumpTo(Math.max(0, Math.min(items.length - 1, idx)))
  }

  // Posición (0..1) de cada estrella sobre el rail (equiespaciado por índice).
  const dotX = (i: number, w: number) =>
    items.length > 1 ? (i / (items.length - 1)) * (w - reserve) : 0

  const showGhost = items.length < 4 || stale

  return (
    <Animated.View entering={FadeIn.duration(360).delay(140)}>
      <View style={styles.divider} />
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Evolución visual
      </EyebrowLabel>
      <Text style={styles.sub}>Tu evolución, de un vistazo</Text>

      {/* ── Scrubber: rail + relleno magenta + estrellas + "Hoy" ── */}
      <Pressable
        onPress={(e) => onRailPress(e.nativeEvent.locationX)}
        onLayout={(e) => setRailW(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel="Línea de tiempo de tus fotos"
        style={styles.rail}
      >
        {railW > 0 ? (
          <>
            <Svg width={railW} height={44} style={StyleSheet.absoluteFill}>
              {/* Con foto reciente, el hairline sigue hasta "Hoy" (tramo sin
                  rellenar: honesto, sin contar días). Con fotos viejas, el
                  riel TERMINA en la última estrella: el tramo vacío hasta un
                  "Hoy" fantasma era el hueco acusador. */}
              <Line
                x1={4}
                y1={22}
                x2={stale ? 4 + dotX(items.length - 1, railW) : railW - 4}
                y2={22}
                stroke={colors.oroHairline}
                strokeWidth={1.4}
              />
              {/* Relleno magenta: del inicio a la última foto. */}
              <Line
                x1={4}
                y1={22}
                x2={4 + dotX(items.length - 1, railW)}
                y2={22}
                stroke={colors.magenta}
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
            {/* Labels: primera fecha + la activa (evita encimar con 8+). */}
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

      {/* ── La tira: todas las fechas lado a lado ── */}
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
                // Epic 08: tocar una foto abre su CAPÍTULO (foto grande + los
                // datos y el contexto de ese día), no un visor mudo.
                router.push({ pathname: '/photo-chapter', params: { day: it.day, angle: active } })
                track(PROGRESS_EVENTS.photo, { kind: 'chapter' })
              }}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Abrir el capítulo del ${fmtFull(it.day)}`}
              style={styles.tileWrap}
            >
              <View style={styles.tile}>
                <Image
                  source={{ uri: it.photo.signed_url! }}
                  style={styles.tileImg}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.tileDate, i === shownIdx && styles.tileDateOn]}>
                {fmtShort(it.day)}
              </Text>
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
              {/* Invitación de inicio, no tarea pendiente ("Agregar" leía
                  como examen que se pospone). */}
              <Text style={styles.tileDate}>Capítulo de hoy</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Tabs de ángulo abajo (alcance de pulgar) ── */}
      {usable.length > 1 ? (
        <View style={styles.angleRow}>
          {usable.map((a) => {
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
  // El espacio ES el separador (brief): sin hairline, solo aire.
  divider: { height: 0, marginVertical: 38 },
  eyebrow: { marginBottom: 2 },
  sub: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
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
  angleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
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
