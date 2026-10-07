import * as Haptics from 'expo-haptics'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

import type { PhotoAngle } from '../api'
import { PROGRESS_EVENTS } from '../constants'
import { useBodyCheckins, useDeletePhoto, usePhotoTimeline } from '../hooks'
import {
  buildCompareEntries,
  compareDeltas,
  daysBetween,
  elapsedLabel,
  photoDatesFor,
  type CompareEntry,
  type WeightPoint,
} from '../logic'
import { HealthCardHeader } from './HealthCardHeader'
import { ProgressShareSheet } from './ProgressShareSheet'
import { useTransformationShareTabs } from './useTransformationShare'
import {
  DropGlyph,
  DumbbellGlyph,
  FatGlyph,
  FramesGlyph,
  ListGlyph,
  ScaleGlyph,
} from './HealthGlyphs'

/*
 * Antes y ahora (dueña 7 oct 2026): el historial, las fotos y el comparador de
 * Cuerpo en un solo módulo, al estilo Salud. Arriba, dos fechas lado a lado con
 * sus números de ESE día y el tiempo entre ellas; debajo, el cambio (solo las
 * métricas medidas en las dos fechas, grasa en puntos). La lista de mediciones
 * es el selector: tocar una la pone en el lado activo (A o B). Por defecto, tu
 * primera fecha contra la más reciente. Sin frases: fechas y números.
 */

const ANGLES: { key: PhotoAngle; label: string }[] = [
  { key: 'front', label: 'Frente' },
  { key: 'back', label: 'Espalda' },
  { key: 'side_left', label: 'Izq' },
  { key: 'side_right', label: 'Der' },
]
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDay = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
const LIST_PREVIEW = 5

export function BeforeAfterModule({
  weights,
  onOpenTable,
  onAddPhotos,
  preset,
}: {
  /** La serie de peso fusionada (la misma de la tarjeta de Peso). */
  weights: readonly WeightPoint[]
  onOpenTable: () => void
  onAddPhotos: () => void
  /** A/B elegidos desde fuera (al guardar una medición: anterior vs nueva). */
  preset?: { a: string; b: string; nonce: number } | null
}) {
  const checkins = useBodyCheckins().data
  const photos = usePhotoTimeline().data
  const usableAngles = useMemo(
    () => ANGLES.filter((a) => photoDatesFor(photos ?? [], a.key).length >= 1),
    [photos],
  )
  const [angle, setAngle] = useState<PhotoAngle | null>(null)
  const active = angle ?? usableAngles[0]?.key ?? null
  const entries = useMemo(
    () => buildCompareEntries(checkins ?? [], photos ?? [], active, weights),
    [checkins, photos, active, weights],
  )

  const [aDay, setADay] = useState<string | null>(null)
  const [bDay, setBDay] = useState<string | null>(null)
  const [side, setSide] = useState<'A' | 'B'>('B')
  const [showAll, setShowAll] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const deletePhoto = useDeletePhoto()
  useEffect(() => {
    if (!preset) return
    setADay(preset.a)
    setBDay(preset.b)
    setSide('B')
  }, [preset])

  const find = (day: string | null) => (day ? entries.find((e) => e.day === day) : undefined)
  const a = find(aDay) ?? entries[0]
  const b = find(bDay) ?? entries[entries.length - 1]
  // MI TRANSFORMACIÓN (se queda): el par A/B elegido, con el peso real de cada fecha.
  const shareTabs = useTransformationShareTabs({
    before: a?.photo ?? null,
    after: b?.photo ?? null,
    weightFrom: a?.weight ?? null,
    weightTo: b?.weight ?? null,
  })

  if (entries.length < 2 || !a || !b) return null
  const deltas = compareDeltas(a, b)
  const elapsed = elapsedLabel(Math.abs(daysBetween(a.day, b.day)))

  const newestFirst = [...entries].reverse()
  const listed = showAll ? newestFirst : newestFirst.slice(0, LIST_PREVIEW)

  // Borrar una foto: mantener presionada (como en Fotos), con confirmación.
  const confirmDelete = (e: CompareEntry) => {
    const photo = e.photo
    if (!photo) return
    Alert.alert(
      'Eliminar esta foto',
      `La foto del ${fmtDay(e.day)} se borra. No se puede recuperar.`,
      [
        { text: 'Conservar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () =>
            deletePhoto.mutate(
              { id: photo.id, storagePath: photo.storage_path },
              {
                onError: (err) =>
                  Alert.alert(
                    'No se pudo eliminar',
                    err instanceof Error ? err.message : 'Intenta de nuevo.',
                  ),
              },
            ),
        },
      ],
    )
  }

  const pick = (e: CompareEntry) => {
    Haptics.selectionAsync().catch(() => {})
    track(PROGRESS_EVENTS.photo, { kind: 'compare-pick', side })
    if (side === 'A') setADay(e.day)
    else setBDay(e.day)
  }

  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeIn.duration(320)} style={styles.card}>
        <HealthCardHeader
          icon={<FramesGlyph color={colors.oroSoft} />}
          title="Antes y ahora"
          color={colors.oroSoft}
          right={elapsed}
        />

        <View style={styles.pair}>
          <Side
            entry={a}
            label="A"
            active={side === 'A'}
            onPress={() => setSide('A')}
            onLongPress={() => confirmDelete(a)}
          />
          <Side
            entry={b}
            label="B"
            active={side === 'B'}
            onPress={() => setSide('B')}
            onLongPress={() => confirmDelete(b)}
          />
        </View>

        {deltas.length > 0 ? (
          <View style={styles.deltas}>
            {deltas.map((d) => (
              <Animated.View
                key={`${d.key}-${a.day}-${b.day}`}
                entering={FadeIn.duration(260)}
                style={styles.deltaRow}
              >
                <View style={styles.deltaName}>
                  {d.key === 'weight' ? (
                    <ScaleGlyph size={16} color={colors.bone} />
                  ) : d.key === 'fat' || d.key === 'visceral' ? (
                    <FatGlyph color={colors.bone} />
                  ) : d.key === 'water' ? (
                    <DropGlyph size={16} color={colors.bone} />
                  ) : d.key === 'bmi' ? (
                    <ScaleGlyph size={16} color={colors.bone} />
                  ) : (
                    <DumbbellGlyph color={colors.bone} />
                  )}
                  <Text style={styles.deltaLabel}>{d.label}</Text>
                </View>
                <Text style={styles.deltaValue}>{d.text}</Text>
              </Animated.View>
            ))}
          </View>
        ) : (
          <Text style={styles.caption}>Estas dos fechas no tienen la misma medición.</Text>
        )}

        {usableAngles.length > 1 ? (
          <View style={styles.segments}>
            {usableAngles.map((ag) => {
              const on = ag.key === active
              return (
                <Pressable
                  key={ag.key}
                  onPress={() => setAngle(ag.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.segment, on && styles.segmentOn]}
                >
                  <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{ag.label}</Text>
                </Pressable>
              )
            })}
          </View>
        ) : null}
        {shareTabs.length > 0 ? (
          <Pressable
            onPress={() => {
              track(PROGRESS_EVENTS.photo, { kind: 'share-open' })
              setShareOpen(true)
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
          >
            <Text style={styles.shareText}>Compartir</Text>
          </Pressable>
        ) : null}
      </Animated.View>

      {shareTabs.length > 0 ? (
        <ProgressShareSheet
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
          subtitle="Tu cambio visual"
          shareType="visual_change"
          defaultTabId="transformacion"
          tabs={shareTabs}
          weightToggle={a.weight != null && b.weight != null}
        />
      ) : null}

      <View style={styles.listHead}>
        <View style={styles.deltaName}>
          <ListGlyph color={colors.bone} />
          <Text style={styles.listTitle}>Mediciones</Text>
        </View>
        <View style={styles.listLinks}>
          <Pressable onPress={onAddPhotos} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.listLink}>Agregar fotos</Text>
          </Pressable>
          <Pressable onPress={onOpenTable} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.listLink}>Ver tabla ›</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.caption}>{`Toca una para ponerla en el lado ${side}.`}</Text>

      <View style={styles.list}>
        {listed.map((e, i) => {
          const mark = e.day === b.day ? 'B' : e.day === a.day ? 'A' : null
          return (
            <Animated.View key={e.day} entering={FadeIn.duration(260).delay(i * 50)}>
              <Pressable
                onPress={() => pick(e)}
                accessibilityRole="button"
                accessibilityLabel={`${fmtDay(e.day)}${e.weight != null ? `, ${e.weight.toFixed(1)} kilos` : ''}`}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && styles.rowDivider,
                  mark === side && styles.rowOn,
                  pressed && styles.pressed,
                ]}
              >
                {e.photo?.signed_url ? (
                  <Image source={{ uri: e.photo.signed_url }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Text style={styles.thumbEmptyText}>sin foto</Text>
                  </View>
                )}
                <View style={styles.rowText}>
                  <Text style={styles.rowValue}>
                    {e.weight != null ? `${e.weight.toFixed(1)} kg` : 'Sin peso'}
                    {e.fat != null ? (
                      <Text style={styles.rowFat}>{`  ·  grasa ${e.fat.toFixed(1)} %`}</Text>
                    ) : null}
                  </Text>
                  <Text style={styles.rowDate}>{fmtDay(e.day)}</Text>
                </View>
                {mark ? (
                  <Text style={[styles.mark, mark === side && styles.markOn]}>{mark}</Text>
                ) : null}
              </Pressable>
            </Animated.View>
          )
        })}
      </View>
      {newestFirst.length > LIST_PREVIEW ? (
        <Pressable onPress={() => setShowAll((v) => !v)} accessibilityRole="button">
          <Text style={styles.listLink}>
            {showAll ? 'Ver menos' : `Ver todas (${newestFirst.length})`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function Side({
  entry,
  label,
  active,
  onPress,
  onLongPress,
}: {
  entry: CompareEntry
  label: 'A' | 'B'
  active: boolean
  onPress: () => void
  onLongPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={entry.photo ? onLongPress : undefined}
      accessibilityHint={entry.photo ? 'Mantén presionada para borrar la foto' : undefined}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Lado ${label}, ${fmtDay(entry.day)}`}
      style={styles.side}
    >
      <View style={[styles.photo, active && styles.photoOn]}>
        {/* Al cambiar la fecha del lado, la foto entra con un fundido corto. */}
        <Animated.View
          key={entry.day}
          entering={FadeIn.duration(280)}
          style={[StyleSheet.absoluteFill, styles.photoInner]}
        >
          {entry.photo?.signed_url ? (
            <Image source={{ uri: entry.photo.signed_url }} style={StyleSheet.absoluteFill} />
          ) : (
            <Text style={styles.noPhoto}>Sin foto de esta fecha</Text>
          )}
        </Animated.View>
        <View style={[styles.badge, active && styles.badgeOn]}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
      </View>
      <Animated.View key={`n-${entry.day}`} entering={FadeIn.duration(280)} style={styles.sideNums}>
        <Text style={styles.sideDate}>{fmtDay(entry.day)}</Text>
        <Text style={styles.sideWeight}>
          {entry.weight != null ? `${entry.weight.toFixed(1)} kg` : 'Sin peso'}
        </Text>
        {entry.fat != null ? (
          <Text style={styles.caption}>{`grasa ${entry.fat.toFixed(1)} %`}</Text>
        ) : null}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  card: { borderRadius: 20, backgroundColor: colors.bgCard, padding: 16, gap: 14 },
  pair: { flexDirection: 'row', gap: 10 },
  side: { flex: 1, gap: 4 },
  photo: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.bgCard2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  photoOn: { borderColor: colors.magenta },
  noPhoto: {
    paddingHorizontal: 14,
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  badgeOn: { backgroundColor: colors.magenta },
  badgeText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.leche,
  },
  sideDate: {
    marginTop: 4,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  sideWeight: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  deltas: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  deltaName: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoInner: { alignItems: 'center', justifyContent: 'center' },
  sideNums: { gap: 4 },
  deltaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  deltaLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.ui,
    color: colors.bone,
  },
  deltaValue: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.heading,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  segments: {
    flexDirection: 'row',
    padding: 3,
    gap: 2,
    borderRadius: 10,
    backgroundColor: colors.bgCard2,
  },
  segment: { flex: 1, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.magentaTint2 },
  segmentText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  segmentTextOn: { fontFamily: typography.uiBold, color: colors.leche },
  listLinks: { flexDirection: 'row', gap: 16 },
  shareBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.magentaTint2,
  },
  shareText: { fontFamily: typography.uiBold, fontSize: typography.sizes.ui, color: colors.leche },
  listHead: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listTitle: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
  },
  listLink: { fontFamily: typography.uiSemi, fontSize: typography.sizes.body, color: colors.bone },
  list: { borderRadius: 20, backgroundColor: colors.bgCard, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  rowOn: { backgroundColor: colors.magentaTint },
  pressed: { opacity: 0.7 },
  thumb: { width: 40, height: 52, borderRadius: 8, backgroundColor: colors.bgCard2 },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairlineStrong,
  },
  thumbEmptyText: {
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.smallLabel,
    color: colors.niebla,
  },
  rowText: { flex: 1, gap: 2 },
  rowValue: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.ui,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  rowFat: { fontFamily: typography.uiMedium, color: colors.niebla },
  rowDate: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  mark: { fontFamily: typography.uiBold, fontSize: typography.sizes.label, color: colors.bone },
  markOn: { color: colors.magenta },
})
