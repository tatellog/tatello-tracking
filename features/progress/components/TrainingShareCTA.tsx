import * as ImagePicker from 'expo-image-picker'
import { useMemo, useState } from 'react'
import { Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { useHomeBrief } from '@/features/home/useHomeBrief'
import { useProfile } from '@/features/profile/hooks'
import { useMeasurements, useMonthWorkoutDates } from '@/features/progress/hooks'
import { ZODIAC, zodiacFromDate } from '@/features/tabs/zodiac'
import { showActionSheet } from '@/lib/actionSheet'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { ProgressShareSheet, type ShareTab } from './ProgressShareSheet'
import { ConstelacionIcon, MomentoIcon, ProgresoIcon } from './share-icons'
import { constellationReveal, monthLabelFromIso, weightSpan } from '../share-logic'
import { useWorkoutSharedToday } from '../shared-flag'
import type { ShareCardStyle } from '../share-styles'
import { TrainingShareCard } from './TrainingShareCard'

/* iOS-style share glyph. */
function ShareIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
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

/* Check magenta — confirma que el entreno ya quedó compartido hoy. */
function CheckIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.5 L10 17.5 L19 7"
        stroke={colors.magenta}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/* Copy HONESTO de confirmación — dice lo que de verdad pasó, no una metáfora. */
function sharedCopy(action: string | undefined): string {
  if (action === 'save') return 'Guardaste tu tarjeta en Fotos'
  if (action === 'instagram') return 'La llevaste a Instagram'
  if (action === 'more') return 'Compartiste tu tarjeta'
  return 'Tu tarjeta de hoy está lista'
}

/* Una línea corta ajustada a dónde va la usuaria en el ciclo de 28 días. */
function coachLineForDay(dayCount: number): string {
  if (dayCount <= 1) return 'Una sola estrella encendida ya cambia el cielo.'
  if (dayCount <= 7) return 'El cuerpo recuerda. La constelación empieza a tomar forma.'
  if (dayCount <= 14) return 'Sigues sumando luz. Lo que se repite, se vuelve tuyo.'
  if (dayCount <= 21) return 'Estás dentro del ritmo. Tu cielo ya te reconoce.'
  if (dayCount < 28) return 'Falta poco. Tu constelación casi se cierra en ti.'
  return 'Constelación completa. Cuerpo y cielo en sincronía.'
}

/*
 * "Compartir entreno" — la entrada al sheet de compartir desde el tab
 * Progreso, visible solo los días que la usuaria marcó como entrenados.
 *
 * El default ya no exige foto: el formato recomendado es Constelación
 * (no necesita foto). La foto es opcional y vive en el formato Momento;
 * si falta, su estado vacío ofrece agregarla sin cerrar el sheet. La
 * foto nunca sale del teléfono — es la celebración de hoy, no un registro.
 */
export function TrainingShareCTA() {
  const brief = useHomeBrief()
  const profile = useProfile()
  const measurements = useMeasurements(null)
  const monthWorkouts = useMonthWorkoutDates()
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // La tarjeta resultante (imagen capturada + acción + formato) para poder
  // abrirla y verla después. La imagen es temporal (sesión), por eso si al
  // reabrir la app ya no existe, mostramos la confirmación sin thumbnail.
  const [lastShare, setLastShare] = useState<{
    uri: string
    action: string
    template: string
  } | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  const sign = useMemo(
    () => zodiacFromDate(profile.data?.date_of_birth),
    [profile.data?.date_of_birth],
  )
  const signLabel = ZODIAC[sign].label

  const dayCount = useMemo(
    () => brief.data?.grid_28_days.filter((c) => c.completed).length ?? 0,
    [brief.data?.grid_28_days],
  )

  const reveal = useMemo(() => constellationReveal(sign, dayCount), [sign, dayCount])
  const weight = useMemo(() => weightSpan(measurements.data), [measurements.data])
  const todayIso = brief.data?.date ?? todayInTimezone()
  const monthLabel = monthLabelFromIso(todayIso)
  const workoutsThisMonth = monthWorkouts.data?.length ?? 0
  const coachCopy = coachLineForDay(dayCount)
  // "Compartiste tu entreno de hoy" — persiste por día (solo la acción, no la
  // imagen). Se resetea al cambiar de día. Sin racha ni culpa: su ausencia es
  // neutra (manifiesto).
  const { sharedAction, markShared } = useWorkoutSharedToday(todayIso)
  const sharedToday = sharedAction != null

  // Foto: elegir cámara/galería. Funciona con el sheet abierto (el picker
  // presenta su propio modal encima), así Momento se llena sin cerrar.
  const pickPhoto = async (source: 'camera' | 'library') => {
    if (busy) return
    setBusy(true)
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync()
        if (!perm.granted) {
          Alert.alert('Cámara', 'Necesitamos permiso a la cámara para tomar la foto.')
          return
        }
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.85, mediaTypes: ['images'] })
      if (result.canceled || !result.assets[0]) return
      setPhotoUri(result.assets[0].uri)
    } finally {
      setBusy(false)
    }
  }

  const choosePhoto = () => {
    showActionSheet(
      {
        title: 'Tu entreno de hoy',
        options: ['Tomar foto', 'Elegir de galería', 'Cancelar'],
        cancelButtonIndex: 2,
      },
      (i) => {
        if (i === 0) void pickPhoto('camera')
        else if (i === 1) void pickPhoto('library')
      },
    )
  }

  // Los tabs del flujo de entreno. El sheet es genérico — le pasamos las
  // tarjetas a renderizar. Definidos antes del gate para que el hook
  // corra siempre en el mismo orden.
  const tabs: readonly ShareTab[] = useMemo(() => {
    const cardFor = (
      variant: 'constelacion' | 'momento' | 'progreso',
      onReady: () => void,
      cardStyle: ShareCardStyle,
    ) => (
      <TrainingShareCard
        variant={variant}
        photoUri={photoUri}
        onAddPhoto={choosePhoto}
        sign={sign}
        signLabel={signLabel}
        dayCount={dayCount}
        revealedPct={reveal.revealedPct}
        nextStarDay={reveal.nextStarDay}
        monthLabel={monthLabel}
        workoutsThisMonth={workoutsThisMonth}
        activeDays={dayCount}
        weightFrom={weight?.from ?? null}
        weightTo={weight?.to ?? null}
        coachCopy={coachCopy}
        cardStyle={cardStyle}
        onReady={onReady}
      />
    )
    return [
      {
        id: 'constelacion',
        label: 'Constelación',
        icon: (active: boolean) => <ConstelacionIcon active={active} />,
        render: (onReady: () => void, cardStyle: ShareCardStyle) =>
          cardFor('constelacion', onReady, cardStyle),
      },
      {
        id: 'momento',
        label: 'Momento',
        icon: (active: boolean) => <MomentoIcon active={active} />,
        recommended: true,
        render: (onReady: () => void, cardStyle: ShareCardStyle) =>
          cardFor('momento', onReady, cardStyle),
      },
      {
        id: 'progreso',
        label: 'Progreso',
        icon: (active: boolean) => <ProgresoIcon active={active} />,
        render: (onReady: () => void, cardStyle: ShareCardStyle) =>
          cardFor('progreso', onReady, cardStyle),
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    photoUri,
    sign,
    signLabel,
    dayCount,
    reveal,
    monthLabel,
    workoutsThisMonth,
    weight,
    coachCopy,
  ])

  // Gate: la sección aparece solo una vez que se marcó hoy como entrenado.
  const trainedToday = brief.data?.today_workout_completed === true
  if (!trainedToday) return null

  return (
    <Animated.View entering={FadeIn.duration(360).delay(320)} style={styles.wrap}>
      <EyebrowLabel tone="magenta" style={styles.eyebrow}>
        Entreno de hoy
      </EyebrowLabel>

      {/* La foto del entreno es efímera (solo para la tarjeta de compartir),
          así que NO vive acá como registro: se agrega dentro del sheet, en el
          estado vacío de Momento. El dashboard solo celebra el día (línea del
          coach) e invita a compartir. */}
      <Text style={styles.coach}>{coachCopy}</Text>

      {sharedToday ? (
        <TouchableOpacity
          style={styles.sharedCard}
          activeOpacity={0.8}
          onPress={() => lastShare && setViewerOpen(true)}
          disabled={!lastShare}
          accessibilityRole={lastShare ? 'button' : 'text'}
          accessibilityLabel="Ver tu tarjeta de hoy"
        >
          {lastShare ? (
            <Image source={{ uri: lastShare.uri }} style={styles.thumb} resizeMode="cover" />
          ) : null}
          <View style={styles.sharedInfo}>
            <View style={styles.sharedRow}>
              <CheckIcon />
              <Text style={styles.sharedText}>
                {sharedCopy(lastShare?.action ?? sharedAction ?? undefined)}
              </Text>
            </View>
            {lastShare ? <Text style={styles.sharedHint}>Toca para verla en grande</Text> : null}
          </View>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.shareBtn}
        activeOpacity={0.85}
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={sharedToday ? 'Compartir de nuevo' : 'Compartir tu entreno'}
      >
        <ShareIcon />
        <Text style={styles.shareLabel}>
          {sharedToday ? 'Compartir de nuevo' : 'Compartir entreno'}
        </Text>
      </TouchableOpacity>

      <ProgressShareSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        subtitle="Tu entrenamiento"
        shareType="workout"
        defaultTabId={lastShare?.template ?? 'momento'}
        tabs={tabs}
        onShared={(r) => {
          markShared(r.action)
          setLastShare(r)
        }}
      />

      {/* Visor a pantalla completa de la tarjeta resultante. */}
      <Modal
        visible={viewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerOpen(false)}
      >
        <View style={styles.viewerRoot}>
          <TouchableOpacity
            style={styles.viewerClose}
            onPress={() => setViewerOpen(false)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Text style={styles.viewerCloseTxt}>✕</Text>
          </TouchableOpacity>
          {lastShare ? (
            <Image source={{ uri: lastShare.uri }} style={styles.viewerImg} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {},
  eyebrow: {
    marginBottom: 10,
  },
  // Línea cálida del coach — celebra el día sin presión (voz Stelar).
  coach: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.bone,
  },
  // Confirmación "compartido hoy" — thumbnail de la tarjeta + copy honesto,
  // tappable para verla en grande. Aditiva y neutra (sin racha ni culpa).
  sharedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  thumb: {
    width: 80,
    aspectRatio: 9 / 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard,
  },
  sharedInfo: {
    flex: 1,
    gap: 4,
  },
  sharedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sharedText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.magenta,
    letterSpacing: 0.2,
  },
  sharedHint: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.niebla,
    letterSpacing: 0.2,
  },
  // ── visor a pantalla completa ──────────────────────────────────────
  viewerRoot: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 54,
    right: 22,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  viewerCloseTxt: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.title,
    color: colors.bone,
    lineHeight: 22,
  },
  viewerImg: {
    width: '86%',
    aspectRatio: 9 / 16,
  },
  // "Compartir entreno" — ahora la acción principal de la sección: pill
  // magenta suave, no un link suelto.
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.magentaTint,
    borderWidth: 1,
    borderColor: colors.magentaTint2,
  },
  shareLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    color: colors.magenta,
  },
})
