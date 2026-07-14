import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import Toast from 'react-native-toast-message'

import { EyebrowLabel, type EyebrowTone } from '@/components/EyebrowLabel'
import { useHomeBrief } from '@/features/home/useHomeBrief'
import { useTakePhoto } from '@/features/onboarding/photos/hooks/useTakePhoto'
import { useProfile } from '@/features/profile/hooks'
import type { ProgressPhoto } from '@/features/progress/api'
import { trySaveUriToLibrary } from '@/features/progress/export'
import { useBeforeAfterPhotos, useDeletePhoto, useMeasurements } from '@/features/progress/hooks'
import { computeTrend, formatTrendCopy, toWeightPoints } from '@/features/progress/logic'
import { ZODIAC, zodiacFromDate } from '@/features/tabs/zodiac'
import { showActionSheet } from '@/lib/actionSheet'
import { colors, typography } from '@/theme'

import { BeforeAfterSlider } from './BeforeAfterSlider'
import { ProgressShareCard } from './ProgressShareCard'
import { ProgressShareSheet, type ShareTab } from './ProgressShareSheet'
import { CambioIcon, RetratoIcon, TransformacionIcon } from './share-icons'
import { constellationReveal, weightSpan } from '../share-logic'
import type { ShareCardStyle } from '../share-styles'

// Persistencia del slot sostenido (ID de la foto que vive en "Ahora").
const SOLO_AFTER_KEY = '@app:beforeafter_solo_after_id'

const MESES_FMT = [
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

function formatDateForCard(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MESES_FMT[d.getMonth()] ?? ''} ${d.getFullYear()}`
}

/* iOS-style share glyph — a box with an arrow rising out of it. */
function ShareIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.2 V14.2" stroke={colors.magenta} strokeWidth={1.9} strokeLinecap="round" />
      <Path
        d="M8.2 6.8 L12 3 L15.8 6.8"
        stroke={colors.magenta}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7.6 10 H6 V20.5 H18 V10 H16.4"
        stroke={colors.magenta}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MESES[d.getMonth()] ?? ''} ${d.getFullYear()}`
}

/** YYYY-MM-DD in local time — used to detect same-day pairs in the
 *  diptych so the "ahora" column reads "Hoy" / "Hace un momento" when
 *  before and after share a date (otherwise both columns display the
 *  same string and the metaphor collapses). */
function ymdLocal(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Date label for the "ahora" column. When the pair is same-day, show
 *  a relative phrase instead of the same calendar string as the
 *  "antes" column — same date in both slots reads as a bug. */
function formatAfterDate(after: ProgressPhoto, before: ProgressPhoto | null): string {
  const todayYmd = ymdLocal(new Date().toISOString())
  const afterYmd = ymdLocal(after.taken_at)
  const sameAsBefore = before && ymdLocal(before.taken_at) === afterYmd
  if (sameAsBefore) {
    // If "after" is literally today, "Hoy"; otherwise the user shot
    // both on the same older day — surface that as "Mismo día" so
    // both columns aren't a copy of the same string.
    return afterYmd === todayYmd ? 'Hoy' : 'Mismo día'
  }
  return afterYmd === todayYmd ? 'Hoy' : formatDate(after.taken_at)
}

/* One side of the diptych — an eyebrow, a portrait photo frame and its
 * date. When `onPress` is given the frame is a button: a filled photo
 * re-opens the picker, an empty one shows a "Subir foto" affordance.
 * `uploading` swaps the frame for a spinner while the upload runs.
 * `dateOverride` lets the caller substitute the default `taken_at`
 * stringifier — used to render "Hoy" / "Mismo día" in the after slot
 * when the pair shares a date. */
/* "Recaptura estelar" — the editable affordance on a filled frame. A ✦
 * (the Stelar seal) wrapped in two orbital arcs that read as "this can be
 * re-made", a sibling of the cycle ring's language. Oro, not magenta:
 * editing chrome is "the sky's light on the UI", and magenta is already
 * spent on the arrow + share link. */
function RecaptureGlyph() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 8.2 A7 7 0 0 1 17.8 7.3"
        stroke={colors.oro}
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.7}
      />
      <Path
        d="M17.5 15.8 A7 7 0 0 1 6.2 16.7"
        stroke={colors.oro}
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.7}
      />
      <Path
        d="M17.8 7.3 L17.0 4.9 M17.8 7.3 L20.2 6.8"
        stroke={colors.oro}
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.7}
      />
      <Path
        d="M6.2 16.7 L7.0 19.1 M6.2 16.7 L3.8 17.2"
        stroke={colors.oro}
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.7}
      />
      <Path
        d="M12 8 L12.9 11.1 L16 12 L12.9 12.9 L12 16 L11.1 12.9 L8 12 L11.1 11.1 Z"
        fill={colors.oro}
      />
    </Svg>
  )
}

function PhotoColumn({
  label,
  tone,
  photo,
  onPress,
  uploading,
  dateOverride,
  accent,
}: {
  label: string
  tone: EyebrowTone
  photo: ProgressPhoto | null
  onPress?: () => void
  uploading?: boolean
  dateOverride?: string
  /** Lift this frame with a faint oro border — used on "Ahora" so the
   *  antes/ahora trajectory reads as a temperature shift, not a label. */
  accent?: boolean
}) {
  // 3-state render: uploading spinner, full image, or placeholder.
  // The placeholder distinguishes between "no photo yet" (✦ + Subir
  // foto invite) and "photo exists but its URL failed to sign" — that
  // second state shows a soft error so the user doesn't think the
  // upload didn't happen.
  const photoButNoUrl = photo && !photo.signed_url
  const filled = !!photo?.signed_url

  const frame = uploading ? (
    <View style={[styles.frame, styles.framePlaceholder]}>
      <ActivityIndicator color={colors.oro} />
    </View>
  ) : filled ? (
    <View style={[styles.frame, accent && styles.frameAccent]}>
      {/* Fondo: la MISMA foto en cover + blur, para rellenar las bandas con la
          propia imagen (no negro) cuando su proporción no coincide con el
          marco 3/4. Un scrim tenue encima la apaga para que la foto nítida del
          frente resalte. */}
      <Image
        source={{ uri: photo!.signed_url! }}
        style={styles.imgBlurBg}
        resizeMode="cover"
        blurRadius={18}
      />
      <View style={styles.imgBlurScrim} pointerEvents="none" />
      {/* resizeMode "contain" so the full body stays visible in the
          frame — the diptych's whole point is comparing silhouettes,
          and "cover" was cropping the head/feet of portrait shots. */}
      <Image source={{ uri: photo!.signed_url! }} style={styles.img} resizeMode="contain" />
      {/* The editable affordance — only when the frame is interactive. */}
      {onPress ? (
        <View pointerEvents="none" style={styles.editGlyph}>
          <RecaptureGlyph />
        </View>
      ) : null}
    </View>
  ) : (
    <View style={[styles.frame, styles.framePlaceholder]}>
      {photoButNoUrl ? (
        <>
          <Text style={styles.placeholderStar}>✦</Text>
          <Text style={styles.placeholderError}>Esta foto no se cargó</Text>
          {onPress ? <Text style={styles.placeholderHint}>Toca para gestionarla</Text> : null}
        </>
      ) : (
        <>
          <Text style={styles.placeholderStar}>✦</Text>
          {onPress ? <Text style={styles.placeholderHint}>Subir foto</Text> : null}
        </>
      )}
    </View>
  )

  return (
    <View style={styles.col}>
      <EyebrowLabel tone={tone} size={10} style={styles.colLabel}>
        {label}
      </EyebrowLabel>
      {onPress ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={
            filled
              ? `Gestionar foto de ${label.toLowerCase()}`
              : `Subir foto de ${label.toLowerCase()}`
          }
        >
          {frame}
        </TouchableOpacity>
      ) : (
        frame
      )}
      <Text style={styles.date}>
        {dateOverride ?? (photo ? formatDate(photo.taken_at) : 'Pendiente')}
      </Text>
    </View>
  )
}

/*
 * "Antes y ahora" — the visual twin of the trajectory: the earliest
 * front photo against the latest. Always the full span (not the page
 * range). Empty / single states render the same diptych with dashed
 * placeholders, each tappable to upload a front photo.
 */
export function BeforeAfterPhotos({ hideEyebrow }: { hideEyebrow?: boolean }) {
  const { data } = useBeforeAfterPhotos()
  const measurements = useMeasurements(null)
  const brief = useHomeBrief()
  const profile = useProfile()
  const takePhoto = useTakePhoto()
  const deletePhoto = useDeletePhoto()
  const [shareOpen, setShareOpen] = useState(false)
  // Modo "Comparar": diptico (default) vs slider de arrastrar-para-revelar.
  const [mode, setMode] = useState<'diptych' | 'slider'>('diptych')
  // Slots FIJOS: la data se deriva por fecha (1 foto = la más antigua = Antes),
  // pero al borrar el Antes la usuaria espera que el placeholder quede en Antes
  // y la foto de Ahora se conserve. Guardamos el ID de la foto que debe vivir en
  // "Ahora" (atado a la foto, no un booleano: así persiste correcto entre
  // sesiones y nunca se aplica a otra foto distinta).
  const [soloAfterId, setSoloAfterId] = useState<string | null>(null)

  // Hidrata el slot sostenido al montar (persistencia entre sesiones).
  useEffect(() => {
    let active = true
    AsyncStorage.getItem(SOLO_AFTER_KEY)
      .then((v) => {
        if (active && v) setSoloAfterId(v)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Guarda/limpia el slot sostenido (estado + AsyncStorage).
  const persistSoloAfter = (id: string | null) => {
    setSoloAfterId(id)
    if (id) AsyncStorage.setItem(SOLO_AFTER_KEY, id).catch(() => {})
    else AsyncStorage.removeItem(SOLO_AFTER_KEY).catch(() => {})
  }

  // Datos de las métricas que viven en las tarjetas (entrenos del ciclo +
  // constelación revelada). El signo sale del perfil; el conteo, del brief.
  const sign = useMemo(
    () => zodiacFromDate(profile.data?.date_of_birth),
    [profile.data?.date_of_birth],
  )
  const dayCount = useMemo(
    () => brief.data?.grid_28_days.filter((c) => c.completed).length ?? 0,
    [brief.data?.grid_28_days],
  )

  // Build the tab-config used to feed the generic share sheet. Lives
  // here (not in the sheet) because the data — photo URLs, dates,
  // métricas, coach line — is specific to the antes/después flow.
  const tabs: readonly ShareTab[] = useMemo(() => {
    const before = data?.before
    const after = data?.after
    const beforeUrl = before?.signed_url
    const afterUrl = after?.signed_url
    if (!before || !after || !beforeUrl || !afterUrl) return []
    const trend = computeTrend(toWeightPoints(measurements.data ?? []))
    const coachCopy = trend ? formatTrendCopy(trend) : null
    const weight = weightSpan(measurements.data)
    const reveal = constellationReveal(sign, dayCount)
    const beforeDate = formatDateForCard(before.taken_at)
    const afterDate = formatDateForCard(after.taken_at)

    const cardFor = (
      variant: 'retrato' | 'transformacion' | 'cambio',
      onReady: () => void,
      cardStyle: ShareCardStyle,
    ) => (
      <ProgressShareCard
        variant={variant}
        beforeUrl={beforeUrl}
        afterUrl={afterUrl}
        beforeDate={beforeDate}
        afterDate={afterDate}
        weightFrom={weight?.from ?? null}
        weightTo={weight?.to ?? null}
        deltaText={weight?.deltaText ?? null}
        workoutsCount={dayCount}
        revealedPct={reveal.revealedPct}
        sign={sign}
        litCount={dayCount}
        signLabel={ZODIAC[sign].label}
        coachCopy={coachCopy}
        cardStyle={cardStyle}
        onReady={onReady}
      />
    )

    return [
      {
        id: 'retrato',
        label: 'Retrato',
        icon: (active: boolean) => <RetratoIcon active={active} />,
        render: (onReady: () => void, cardStyle: ShareCardStyle) =>
          cardFor('retrato', onReady, cardStyle),
      },
      {
        id: 'transformacion',
        label: 'Transformación',
        icon: (active: boolean) => <TransformacionIcon active={active} />,
        recommended: true,
        render: (onReady: () => void, cardStyle: ShareCardStyle) =>
          cardFor('transformacion', onReady, cardStyle),
      },
      {
        id: 'cambio',
        label: 'Cambio',
        icon: (active: boolean) => <CambioIcon active={active} />,
        render: (onReady: () => void, cardStyle: ShareCardStyle) =>
          cardFor('cambio', onReady, cardStyle),
      },
    ]
  }, [data?.before, data?.after, measurements.data, sign, dayCount])

  if (!data) return null

  // Pick from camera/library, then push it through the shared upload
  // pipeline as a `front` photo — getBeforeAfterPhotos derives the
  // before/after pair from the earliest/latest front photos, so a new
  // upload always lands as the "ahora".
  const pickAndUpload = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Cámara', 'Necesitamos permiso a la cámara para tomar la foto.')
        return
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    if (result.canceled || !result.assets[0]) return
    try {
      await takePhoto.mutateAsync({ uri: result.assets[0].uri, angle: 'front' })
      // La foto nueva es la más reciente (Ahora) y el orden por fecha vuelve a
      // mandar; soltamos el slot sostenido.
      persistSoloAfter(null)
      // Dual-save (propiedad de datos): la foto de cámara también vive en SU
      // carrete — antes solo existía en el bucket y desinstalar la perdía.
      // Si niega el permiso, silencio: el rescate masivo vive en Ajustes.
      if (source === 'camera') {
        const ok = await trySaveUriToLibrary(result.assets[0].uri)
        if (ok) Toast.show({ type: 'success', text1: 'Guardada también en tu carrete' })
      }
    } catch (err) {
      Alert.alert('No se pudo subir', err instanceof Error ? err.message : 'Intenta de nuevo.')
    }
  }

  const choosePhoto = () => {
    const options = ['Tomar foto', 'Elegir de galería', 'Cancelar']
    showActionSheet({ title: 'Foto de progreso', options, cancelButtonIndex: 2 }, (i) => {
      if (i === 0) void pickAndUpload('camera')
      else if (i === 1) void pickAndUpload('library')
    })
  }

  // Fotos por SLOT estable. Con 1 sola foto, vive en "Ahora" solo si su ID es
  // el sostenido (se borró el Antes); si no, en Antes (default = punto de
  // partida). Con 2 fotos, el orden por fecha manda (más antigua = Antes).
  const single = data.count === 1
  const soloInAfter = single && data.before != null && data.before.id === soloAfterId
  const antesPhoto = soloInAfter ? null : data.before
  const ahoraPhoto = soloInAfter ? data.before : data.after

  const beforeUrl = data.before?.signed_url ?? null
  const afterUrl = data.after?.signed_url ?? null
  // Comparar/compartir necesitan AMBAS fotos cargadas (URL firmada).
  const canCompare = !!beforeUrl && !!afterUrl
  const busy = takePhoto.isPending || deletePhoto.isPending
  // Which slot is mid-delete, so only that column shows the spinner.
  const deletingId = deletePhoto.isPending ? deletePhoto.variables?.id : undefined

  // Soft, reversible-tone confirm before removing a photo (irreversible,
  // emotionally costly). "Conservar" reads warmer than "Cancelar".
  const confirmDelete = (photo: ProgressPhoto, slot: 'before' | 'after') => {
    Alert.alert(
      'Eliminar esta foto',
      'Esta foto se quita de tu comparación. No se puede recuperar.',
      [
        { text: 'Conservar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            // Slot fijo: si borro el "Antes", la foto que sobrevive (data.after)
            // se conserva en "Ahora" — guardamos su ID. Si borro el "Ahora", la
            // que queda vuelve a "Antes" (default) — limpiamos.
            persistSoloAfter(slot === 'before' ? (data.after?.id ?? null) : null)
            deletePhoto.mutate(
              { id: photo.id, storagePath: photo.storage_path },
              {
                onError: (err) =>
                  Alert.alert(
                    'No se pudo eliminar',
                    err instanceof Error ? err.message : 'Intenta de nuevo.',
                  ),
              },
            )
          },
        },
      ],
    )
  }

  // Manage a FILLED frame. "Ahora" (the latest) can be replaced — a new
  // upload is always the most recent — or deleted. "Antes" (the earliest)
  // can only be deleted: a new photo never lands as the oldest, so
  // "replace the antes" is meaningless. Deleting recomputes the pair.
  const manage = (slot: 'before' | 'after', photo: ProgressPhoto) => {
    if (slot === 'after') {
      showActionSheet(
        {
          title: 'Tu foto de ahora',
          options: ['Reemplazar foto', 'Eliminar foto', 'Cancelar'],
          cancelButtonIndex: 2,
          destructiveButtonIndex: 1,
        },
        (i) => {
          if (i === 0) choosePhoto()
          else if (i === 1) confirmDelete(photo, slot)
        },
      )
    } else {
      showActionSheet(
        {
          title: 'Tu foto de antes',
          options: ['Eliminar foto', 'Cancelar'],
          cancelButtonIndex: 1,
          destructiveButtonIndex: 0,
        },
        (i) => {
          if (i === 0) confirmDelete(photo, slot)
        },
      )
    }
  }

  // Tapping a filled frame manages it; an empty/failed frame uploads.
  const onColumnPress = (slot: 'before' | 'after', photo: ProgressPhoto | null) => {
    if (busy) return undefined
    if (photo?.signed_url) return () => manage(slot, photo)
    return choosePhoto
  }

  // Section eyebrow + empty-state header. The eyebrow ties this
  // section into the redesigned page architecture (each section
  // declares itself); the body changes by data state.
  return (
    <Animated.View entering={FadeIn.duration(360).delay(360)} style={styles.wrap}>
      {/* The eyebrow is suppressed when a parent already provides the
          section header (e.g. the Progreso collapsible toggle). */}
      {hideEyebrow ? null : (
        <EyebrowLabel tone="magenta" size={10} style={styles.sectionEyebrow}>
          Tu cambio visual
        </EyebrowLabel>
      )}

      {/* Empty state — a single invitation card, not two dashed
          placeholders. With zero photos there's no "antes" nor an
          "ahora" yet; forcing the diptych makes the metaphor exist
          before it has any content. One card → one decision. */}
      {data.count === 0 ? (
        <TouchableOpacity
          style={styles.emptyCard}
          activeOpacity={0.7}
          onPress={!busy ? choosePhoto : undefined}
          accessibilityRole="button"
          accessibilityLabel="Empieza con una foto frontal"
        >
          <Text style={styles.emptyStar}>✦</Text>
          <Text style={styles.emptyTitle}>Empieza con una foto frontal</Text>
          <Text style={styles.emptyHint}>Tu próxima marca abre la comparación</Text>
          {busy ? (
            <View style={styles.emptyBusy}>
              <ActivityIndicator color={colors.magenta} />
            </View>
          ) : null}
        </TouchableOpacity>
      ) : mode === 'slider' && canCompare ? (
        <>
          {/* Fechas como etiquetas sobre la foto (hechos), no "Antes/Ahora"
              (juicio de estado · benchmark). Un solo lugar para las fechas. */}
          <BeforeAfterSlider
            beforeUrl={beforeUrl}
            afterUrl={afterUrl}
            leftLabel={formatDate(data.before!.taken_at)}
            rightLabel={formatAfterDate(data.after!, data.before)}
          />
          <Text style={styles.sliderHint}>Arrastra el divisor para revelar tu cambio.</Text>
        </>
      ) : (
        <>
          <View style={styles.row}>
            <PhotoColumn
              label="Antes"
              tone="niebla"
              photo={antesPhoto}
              onPress={onColumnPress('before', antesPhoto)}
              uploading={
                (takePhoto.isPending && data.count === 0) ||
                (deletingId != null && deletingId === antesPhoto?.id)
              }
            />
            <Text style={styles.arrow}>→</Text>
            <PhotoColumn
              label="Ahora"
              tone="magenta"
              photo={ahoraPhoto}
              accent
              onPress={onColumnPress('after', ahoraPhoto)}
              uploading={
                (takePhoto.isPending && data.count >= 1) ||
                (deletingId != null && deletingId === ahoraPhoto?.id)
              }
              dateOverride={
                ahoraPhoto && !single ? formatAfterDate(ahoraPhoto, data.before) : undefined
              }
            />
          </View>
          {data.count === 1 ? (
            <Text style={styles.caption}>Tu próxima foto frontal abre la comparación.</Text>
          ) : null}
        </>
      )}

      {/* CTAs — "Comparar" (abre el slider de arrastrar) como acción principal
          de la sección; "Compartir mi cambio" como secundaria, callada. */}
      {canCompare ? (
        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={styles.compareBtn}
            activeOpacity={0.85}
            onPress={() => setMode((m) => (m === 'slider' ? 'diptych' : 'slider'))}
            accessibilityRole="button"
            accessibilityLabel={mode === 'slider' ? 'Ver lado a lado' : 'Comparar arrastrando'}
          >
            <Text style={styles.compareLabel}>
              {mode === 'slider' ? 'Lado a lado' : 'Comparar'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareBtn}
            activeOpacity={0.6}
            onPress={() => setShareOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Compartir mi cambio"
          >
            <ShareIcon />
            <Text style={styles.shareLabel}>Compartir mi cambio</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {canCompare ? (
        <ProgressShareSheet
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
          subtitle="Tu cambio visual"
          shareType="visual_change"
          defaultTabId="transformacion"
          tabs={tabs}
        />
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // No top margin — the page-level divider in progress.tsx already
  // separates sections. Keeping it here would double the gap.
  wrap: {},
  sectionEyebrow: {
    marginBottom: 14,
  },
  // Single-card empty state shown when count === 0. Wider, friendlier
  // than the dashed diptych — one decision, not two.
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.bruma,
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: colors.bgCard,
    paddingVertical: 36,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  emptyStar: {
    fontSize: typography.sizes.displayMd,
    color: colors.magenta,
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  emptyHint: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
    textAlign: 'center',
  },
  emptyBusy: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  col: {
    flex: 1,
  },
  colLabel: {
    marginLeft: 2,
    marginBottom: 8,
  },
  // Portrait photo frame — bruma edge so it reads as a defined card.
  frame: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard2,
    overflow: 'hidden',
  },
  // "Ahora" frame — a faint oro edge so the antes (cool bruma) → ahora
  // (warm light) trajectory is told by temperature, not just the label.
  frameAccent: {
    borderColor: colors.oroHairline,
  },
  // The editable affordance disc, lower-right of a filled frame: a dark
  // scrim pill behind the oro recapture glyph so it reads on any photo.
  editGlyph: {
    position: 'absolute',
    bottom: 7,
    right: 7,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrim,
    borderWidth: 0.5,
    borderColor: colors.oroHairline,
  },
  framePlaceholder: {
    borderStyle: 'dashed',
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderStar: {
    fontSize: typography.sizes.segmentTitle,
    color: colors.bruma,
  },
  // The tap affordance — quiet magenta so the empty frame reads as an
  // invitation, not just a void.
  placeholderHint: {
    marginTop: 6,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.micro,
    color: colors.magenta,
    letterSpacing: 0.3,
  },
  // Shown when the photo row exists but signing failed — distinct
  // from the empty-frame invite so the user understands "upload OK,
  // load failed".
  placeholderError: {
    marginTop: 6,
    paddingHorizontal: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    textAlign: 'center',
  },
  // Absolute-fill, not 100%/100%: the frame's height comes from
  // `aspectRatio`, and a percentage-height child of an aspectRatio-sized
  // parent resolves to 0 in Yoga — the image would render invisibly.
  // (The onboarding PhotoCaptureCard fills its frame the same way.)
  img: {
    ...StyleSheet.absoluteFillObject,
  },
  // Fondo difuminado (misma foto, cover) que rellena las bandas cuando la
  // proporción no coincide con el marco — evita el letterbox negro.
  imgBlurBg: {
    ...StyleSheet.absoluteFillObject,
  },
  // Apaga el fondo difuminado para que la foto nítida del frente resalte.
  imgBlurScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,6,8,0.45)',
  },
  date: {
    marginTop: 8,
    marginLeft: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  // The same gesture as the hero's "76.6 → 75.0".
  arrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.anchor,
    color: colors.magenta,
    marginHorizontal: 8,
  },
  caption: {
    marginTop: 12,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 18,
    color: colors.bone,
  },
  // Fila de CTAs: "Comparar" (primaria) a la izquierda, "Compartir" (callada)
  // a la derecha.
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  // "Comparar" — pill magenta suave, la acción principal de la sección.
  compareBtn: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: colors.magentaTint,
    borderWidth: 1,
    borderColor: colors.magentaTint2,
  },
  compareLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    color: colors.magenta,
  },
  // Fechas bajo el slider (inicial → actual).
  sliderDates: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  sliderArrow: {
    color: colors.oro,
  },
  sliderHint: {
    marginTop: 4,
    textAlign: 'center',
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  // Compartir — link callado; vive en la fila de CTAs.
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 4,
  },
  shareLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.magenta,
  },
})
