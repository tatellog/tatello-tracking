import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useEffect } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { StelarModal, StelarModalPanel } from '@/components/ui/StelarModal'
import {
  FRAMES_BY_SIGN,
  frameIndexFor,
} from '@/features/tabs/components/constellation/RevealedEmblem'
import { GLYPH_BY_SIGN } from '@/features/tabs/zodiac/glyphs'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, typography } from '@/theme'

import { useTransformProgress } from '../hooks'
import { EVIDENCE_ORDER, nextStageForecast, type EvidenceKey } from '../logic'
import { MonthConstellation } from './MonthConstellation'

export type EmblemStar = { name: string; role: string }

type TuEmblemaModalProps = {
  visible: boolean
  onClose: () => void
  /** Clave del signo — para el emblema correcto (el MISMO emblema del Tab Hoy). */
  sign: ZodiacSign
  /** La etiqueta del signo en MAYÚSCULAS ("LEO", "ARIES", …). */
  signLabel: string
  /** Figure stars lit THIS MONTH (any registered day) + the figure total. */
  trained: number
  total: number
  /** Named figure stars already lit, in lighting order. */
  litStars: EmblemStar[]
  /** The next star to light (named, anticipation — not a countdown). */
  nextStar: EmblemStar | null
  /** Días con registro, acumulado de por vida (nunca racha). Vive aquí desde
   *  sep 2026: en Hoy era un tercer contador. */
  daysInOrbit?: number
  /** "19 de septiembre": el día en que se completó la figura (el logro). */
  completedOn?: string | null
  /** Qué hábitos de HOY cuentan para el reveal (misma vara que el RPC). */
  todayEvidence?: readonly EvidenceKey[]
  /** Promedio de puntos/día de los últimos 7 días cerrados (para el pronóstico). */
  pointsPerDay?: number
}

/**
 * Calienta el caché de RN Image con el frame del emblema ANTES de abrir el modal.
 * El hero pinta el emblema en Skia (otro caché), así que sin esto la primera
 * apertura del modal decodifica el PNG en frío y se nota el retraso. Render
 * persistente y oculto en Hoy: decodifica una vez y queda caliente.
 */
export function EmblemFramePreloader({ sign }: { sign: ZodiacSign }) {
  const { progress } = useTransformProgress()
  const frames = FRAMES_BY_SIGN[sign]
  const frame = frames[frameIndexFor(progress)] ?? frames[frames.length - 1]
  return (
    <Image
      source={frame}
      style={styles.preloader}
      fadeDuration={0}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  )
}

/**
 * "Tu {signo}" — se abre desde el emblema de Hoy. Con el lenguaje común de los
 * modales (StelarModal, dueña 6 oct 2026): el signo como categoría en oro, un
 * titular con lo que llevas, el emblema y su avance en un panel, y la estrella
 * que sigue en otro. Dice cuántas faltan: la dueña antepone la claridad y la
 * honestidad a la regla anti-countdown del manifiesto (6 oct 2026).
 */
export function TuEmblemaModal({
  visible,
  onClose,
  sign,
  signLabel,
  trained,
  total,
  completedOn,
  todayEvidence = [],
  pointsPerDay = 0,
}: TuEmblemaModalProps) {
  const complete = total > 0 && trained >= total
  const nextMonth = MONTHS[(new Date().getMonth() + 1) % 12]
  // Tope en 100: con la figura completa las luces siguen sumando (28 de 25).
  const pct = total > 0 ? Math.min(100, Math.round((trained / total) * 100)) : 0
  // El signo en title-case para leerlo dentro de una frase.
  const signTitle = signLabel.charAt(0).toUpperCase() + signLabel.slice(1).toLowerCase()
  const Glyph = GLYPH_BY_SIGN[sign]
  // El emblema TAL COMO VA REVELADO (el mismo frame del Tab Hoy): se revela con
  // tus hábitos (acumulado, nunca retrocede). La constelación del mes va encima.
  const { progress: revealPct, stage } = useTransformProgress()
  const frames = FRAMES_BY_SIGN[sign]
  const emblemFrame = frames[frameIndexFor(revealPct)] ?? frames[frames.length - 1]
  // Lo que sigue, honesto: la etapa siguiente y, si hay ritmo reciente, en
  // cuántos días como los suyos llega (sin ritmo no se inventa un número).
  const forecast = nextStageForecast(revealPct, pointsPerDay)
  const forecastLine = !forecast.next
    ? `Tu ${signTitle} ya está completo.`
    : forecast.days != null
      ? `A tu ritmo de los últimos 7 días, en ~${forecast.days} ${forecast.days === 1 ? 'día' : 'días'}.`
      : 'Cada día con déficit, entreno o proteína la acerca.'

  const title = complete
    ? completedOn
      ? `Completaste tu ${signTitle} el ${completedOn}`
      : `Completaste tu ${signTitle}`
    : trained > 0
      ? `Llevas ${trained} ${trained === 1 ? 'estrella' : 'estrellas'} este mes`
      : 'Tu figura empieza con tu primer registro'

  return (
    <StelarModal
      visible={visible}
      onClose={onClose}
      kicker={`Tu ${signTitle}`}
      kickerColor={colors.oroSoft}
      icon={
        <View style={styles.iconDisc}>
          <Glyph width={18} height={18} color={colors.oroSoft} />
        </View>
      }
      title={title}
    >
      <StelarModalPanel style={styles.emblemPanel}>
        {/* Tu Acuario como va revelado + tu constelación del mes encendida
            encima (como en Hoy): dos avances distintos, uno sobre otro. */}
        <View style={styles.figure}>
          <Image
            source={emblemFrame}
            style={styles.figureArt}
            resizeMode="contain"
            accessibilityLabel={`Tu ${signTitle}, ${revealPct} por ciento revelado.`}
          />
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <MonthConstellation sign={sign} lit={Math.min(trained, total)} size={FIGURE} />
          </View>
        </View>

        <View style={styles.meter}>
          <View style={styles.meterHead}>
            <MaterialCommunityIcons name="star-four-points" size={14} color={colors.oroSoft} />
            <Text style={styles.meterLabel}>Tu constelación de este mes</Text>
          </View>
          <Text style={styles.count}>
            <Text style={styles.countNum}>{trained}</Text>
            <Text style={styles.countOf}>
              {complete || total - trained <= 0
                ? ` de ${total} estrellas`
                : ` de ${total} estrellas · te faltan ${total - trained}`}
            </Text>
          </Text>
          <ProgressBar pct={pct} color={colors.oroSoft} />
        </View>

        <View style={styles.meter}>
          <View style={styles.meterHead}>
            <MaterialCommunityIcons name="eye-outline" size={14} color={colors.magenta} />
            <Text style={styles.meterLabel}>{`Tu ${signTitle} revelado`}</Text>
          </View>
          <Text style={styles.count}>
            <Text style={[styles.countNum, { color: colors.magenta }]}>{revealPct}%</Text>
            <Text style={styles.countOf}>{`  ${stage.label}`}</Text>
          </Text>
          <ProgressBar pct={revealPct} color={colors.magenta} />
          {forecast.next ? (
            <Text style={styles.nextStage}>
              <Text style={styles.nextStageLabel}>{`Siguiente: ${forecast.next.label}. `}</Text>
              {forecastLine}
            </Text>
          ) : (
            <Text style={styles.nextStage}>{forecastLine}</Text>
          )}
        </View>

        {/* Qué de HOY ya revela (la causa con nombre): encendido lo que cuenta. */}
        <View style={styles.today}>
          <Text style={styles.todayLabel}>
            {todayEvidence.length > 0 ? 'Hoy ya suma' : 'Hoy aún no suma'}
          </Text>
          <View style={styles.chips}>
            {EVIDENCE_ORDER.map((k) => (
              <EvidenceChip key={k} k={k} on={todayEvidence.includes(k)} />
            ))}
          </View>
        </View>
      </StelarModalPanel>

      {/* Qué mueve cada cosa, con ícono: que se entienda. */}
      <View style={styles.howList}>
        <HowRow icon="star-four-points" color={colors.oroSoft}>
          Cada día con registro enciende una estrella. Se reinicia cada mes.
        </HowRow>
        <HowRow icon="eye-outline" color={colors.magenta}>
          {`Tu ${signTitle} se revela con déficit, entrenos, proteína, sueño de 7 h y agua. Nunca retrocede.`}
        </HowRow>
        <HowRow icon="check-decagram-outline" color={colors.oroSoft}>
          {complete
            ? `Completaste tus ${total} estrellas. En ${nextMonth} empieza una constelación nueva.`
            : `Con las ${total} estrellas cierras tu constelación del mes.`}
        </HowRow>
      </View>
    </StelarModal>
  )
}

/** Barra de avance que se llena al abrir el modal. */
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const reduce = useReducedMotion() ?? false
  const w = useSharedValue(reduce ? pct : 0)
  useEffect(() => {
    w.value = reduce
      ? pct
      : withDelay(250, withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) }))
  }, [pct, reduce, w])
  const fill = useAnimatedStyle(() => ({ width: `${w.value}%` }))
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, { backgroundColor: color }, fill]} />
    </View>
  )
}

const CHIP: Record<
  EvidenceKey,
  { label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }
> = {
  deficit: { label: 'Déficit', icon: 'silverware-fork-knife' },
  trained: { label: 'Entreno', icon: 'dumbbell' },
  protein: { label: 'Proteína', icon: 'food-drumstick' },
  sleep: { label: 'Sueño 7 h', icon: 'weather-night' },
  water: { label: 'Agua', icon: 'water' },
}

/** Un hábito del reveal: encendido (magenta) si hoy ya cuenta, tenue si no. */
function EvidenceChip({ k, on }: { k: EvidenceKey; on: boolean }) {
  const c = CHIP[k]
  return (
    <View
      style={[styles.chip, on && styles.chipOn]}
      accessibilityLabel={`${c.label}: ${on ? 'cuenta hoy' : 'aún no'}`}
    >
      <MaterialCommunityIcons name={c.icon} size={13} color={on ? colors.magenta : colors.niebla} />
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
    </View>
  )
}

function HowRow({
  icon,
  color,
  children,
}: {
  icon: 'star-four-points' | 'eye-outline' | 'check-decagram-outline'
  color: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.howRow}>
      <View style={styles.howIcon}>
        <MaterialCommunityIcons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.howText}>{children}</Text>
    </View>
  )
}

const FIGURE = 168

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const styles = StyleSheet.create({
  iconDisc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.oroTint,
  },
  emblemPanel: { alignItems: 'center', paddingTop: 10, paddingBottom: 16, gap: 14 },
  figure: { width: FIGURE, height: FIGURE },
  figureArt: { width: FIGURE, height: FIGURE },
  meter: { alignSelf: 'stretch' },
  meterHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meterLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  count: { marginTop: 2, alignSelf: 'stretch' },
  countNum: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.displayLg,
    letterSpacing: -0.8,
    color: colors.oroSoft,
    fontVariant: ['tabular-nums'],
  },
  countOf: { fontFamily: typography.uiBold, fontSize: typography.sizes.ui, color: colors.niebla },
  barTrack: {
    alignSelf: 'stretch',
    marginTop: 6,
    height: 8,
    borderRadius: 5,
    backgroundColor: colors.hairline,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 5 },
  nextStage: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 17,
    color: colors.bone,
  },
  nextStageLabel: { fontFamily: typography.uiBold, color: colors.leche },
  today: { alignSelf: 'stretch', gap: 8 },
  todayLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  chipOn: { borderColor: colors.magenta, backgroundColor: colors.magentaTint },
  chipText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  chipTextOn: { color: colors.leche },
  howList: { gap: 10 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  howIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
  },
  howText: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.bone,
  },
  // Preloader invisible — 1×1, fuera de layout, solo para calentar el caché.
  preloader: { position: 'absolute', width: 1, height: 1, opacity: 0 },
})
