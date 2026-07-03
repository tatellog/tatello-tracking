import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg'

import { useSetWater, useWaterToday } from '@/features/water/hooks'
import { GLASS_ML, useWaterGoal } from '@/features/water/useWaterGoal'
import { useSleepLog, useUpsertSleep } from '@/features/sleep/hooks'
import { SkyBackground } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

import { MoodSky } from './MoodSky'
import { SleepMoonSkia } from './SleepMoonSkia'
import { WaterDropSkia } from './WaterDropSkia'

/*
 * Registro en contexto de Órbita · Día. Al tocar una señal que "aún no aparece"
 * (agua / ánimo / sueño) se abre este modal full-screen para registrarla SIN
 * salir de Órbita. Reusa los mismos hooks de escritura que Hoy (un solo "home"
 * por input: misma lógica, surgida donde estás), así los puntos de
 * transformación suben solos al asentar (cada hook invalida orbit.all).
 *
 * Voz cálida (Observadora que acompaña), nunca clínica ni de culpa. Cada
 * dimensión trae su propia pieza (gota / orbe / luna), adaptada al sistema
 * Stelar (negro cálido + color de dimensión), no a las apps de referencia.
 * Solo se abre para HOY; un día pasado sigue navegando a Hoy.
 */

export type DayLogKey = 'agua' | 'animo' | 'sueno'

export function DayLogModal({
  signalKey,
  date,
  onClose,
}: {
  signalKey: DayLogKey | null
  date: string
  onClose: () => void
}) {
  const open = signalKey != null
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      {/* GestureHandlerRootView: los gestos (slider de ánimo) NO funcionan dentro
          de un <Modal> de RN sin este root propio (vive en otra jerarquía). */}
      <GestureHandlerRootView style={styles.screen}>
        {signalKey === 'animo' ? (
          // Ánimo es una experiencia full-screen propia (fondo que morfea).
          <MoodSky date={date} onClose={onClose} />
        ) : (
          <>
            {/* Fondo cósmico compartido (estrellas + nebulosa) → profundidad. */}
            <SkyBackground />
            {/* Viñeta: oscurece los bordes y enfoca el centro (hondura). */}
            <Vignette />
            <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
              {signalKey === 'agua' ? <WaterLog date={date} onDone={onClose} /> : null}
              {signalKey === 'sueno' ? <SleepLog date={date} onDone={onClose} /> : null}
            </SafeAreaView>
          </>
        )}

        {/* Cerrar — hijo directo del screen, en la capa MÁS alta (zIndex +
            elevation), fuera de cualquier SafeAreaView/Canvas Skia que pudiera
            robarse el toque. Los canvas ya van con pointerEvents="none". */}
        <Pressable
          onPress={onClose}
          hitSlop={18}
          style={[styles.close, { top: insets.top + 6 }]}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M14 5 L7 12 L14 19"
              stroke={colors.leche}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  )
}

/* ── Shell de un registro: glow ambiental + encabezado + cuerpo + CTA ──── */
function LogShell({
  accent,
  eyebrow,
  title,
  children,
  ctaLabel,
  ctaDisabled,
  pending,
  onSubmit,
}: {
  accent: string
  eyebrow: string
  title: string
  children: React.ReactNode
  ctaLabel: string
  ctaDisabled: boolean
  pending: boolean
  onSubmit: () => void
}) {
  return (
    <Animated.View entering={FadeIn.duration(280)} style={styles.body}>
      {/* Glow ambiental de la dimensión, arriba y difuso. */}
      <AmbientGlow color={accent} />
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>

      <ScrollView
        style={styles.stage}
        contentContainerStyle={styles.stageContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View entering={FadeInUp.duration(360)} style={styles.stageInner}>
          {children}
        </Animated.View>
      </ScrollView>

      <Pressable
        onPress={onSubmit}
        disabled={ctaDisabled || pending}
        accessibilityRole="button"
        accessibilityState={{ disabled: ctaDisabled || pending }}
        style={[styles.cta, (ctaDisabled || pending) && styles.ctaDisabled]}
      >
        <Text style={styles.ctaText}>{pending ? 'Sumando...' : ctaLabel}</Text>
      </Pressable>
    </Animated.View>
  )
}

/* Viñeta full-screen: transparente al centro, oscurece hacia los bordes → el
 * arte del centro flota y el fondo gana profundidad. */
function Vignette() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id="log-vignette" cx="50%" cy="42%" r="75%">
          <Stop offset="0" stopColor={colors.bg} stopOpacity={0} />
          <Stop offset="0.7" stopColor={colors.bg} stopOpacity={0.18} />
          <Stop offset="1" stopColor={colors.bg} stopOpacity={0.72} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#log-vignette)" />
    </Svg>
  )
}

function AmbientGlow({ color }: { color: string }) {
  return (
    <Svg style={styles.glow} width="100%" height={340} pointerEvents="none">
      <Defs>
        <RadialGradient id="log-glow" cx="50%" cy="42%" r="55%">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="55%" stopColor={color} stopOpacity={0.06} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="340" fill="url(#log-glow)" />
    </Svg>
  )
}

/* ── AGUA — la gota que se llena ───────────────────────────────────────── */
const WATER = colors.signal.agua

function WaterLog({ date, onDone }: { date: string; onDone: () => void }) {
  const { goalMl } = useWaterGoal()
  const goalGlasses = Math.max(1, Math.round(goalMl / GLASS_ML))
  const { data: current } = useWaterToday(date)
  const setWater = useSetWater(date)
  const [glasses, setGlasses] = useState<number | null>(null)
  const value = glasses ?? current ?? 0
  const ratio = Math.min(1, value / goalGlasses)

  const step = (d: number): void => setGlasses(Math.min(30, Math.max(0, value + d)))

  return (
    <LogShell
      accent={WATER}
      eyebrow="AGUA"
      title="¿Cuánta agua llevas hoy?"
      ctaLabel="Sumar a mi día"
      ctaDisabled={value === 0}
      pending={setWater.isPending}
      onSubmit={() => setWater.mutate(value, { onSuccess: onDone, onError: onDone })}
    >
      <View style={styles.dropWrap}>
        <WaterDropSkia size={168} ratio={ratio} />
      </View>

      <View style={styles.stepper}>
        <StepBtn label="−" onPress={() => step(-1)} disabled={value === 0} />
        <View style={styles.stepReadout}>
          <Text style={styles.stepNum}>{value}</Text>
          <Text style={styles.stepUnit}>{value === 1 ? 'vaso' : 'vasos'}</Text>
        </View>
        <StepBtn label="+" onPress={() => step(1)} disabled={value >= 30} accent={WATER} />
      </View>
      <Text style={styles.hint}>Tu meta es {goalGlasses} vasos al día.</Text>
    </LogShell>
  )
}

/* ── SUEÑO — registro simple de cuánto descansaste ─────────────────────── */
const SLEEP = colors.dimension.sueno
const SLEEP_PRESETS: { label: string; minutes: number }[] = [
  { label: '20 min', minutes: 20 },
  { label: '30 min', minutes: 30 },
  { label: '1 h', minutes: 60 },
  { label: '6 h', minutes: 360 },
  { label: '7 h', minutes: 420 },
  { label: '8 h', minutes: 480 },
]

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

function SleepLog({ date, onDone }: { date: string; onDone: () => void }) {
  const { data: existing } = useSleepLog(date)
  const upsert = useUpsertSleep(date)
  const seed = existing?.duration_minutes ?? 420
  const [minutes, setMinutes] = useState<number>(seed)

  const step = (d: number): void => setMinutes((m) => Math.min(720, Math.max(15, m + d)))

  return (
    <LogShell
      accent={SLEEP}
      eyebrow="SUEÑO"
      title="¿Cuánto descansaste?"
      ctaLabel="Sumar a mi día"
      ctaDisabled={minutes <= 0}
      pending={upsert.isPending}
      onSubmit={() =>
        upsert.mutate(
          { durationMinutes: minutes, quality: null },
          { onSuccess: onDone, onError: onDone },
        )
      }
    >
      <View style={styles.moonWrap}>
        <SleepMoonSkia size={260} />
        <Text style={[styles.sleepReadout, styles.sleepReadoutOnMoon]}>{fmtDuration(minutes)}</Text>
      </View>

      <View style={styles.presetRow}>
        {SLEEP_PRESETS.map((p) => {
          const on = p.minutes === minutes
          return (
            <Pressable
              key={p.minutes}
              onPress={() => setMinutes(p.minutes)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.presetChip, on && styles.presetChipOn]}
            >
              <Text style={[styles.presetLabel, on && styles.presetLabelOn]}>{p.label}</Text>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.stepper}>
        <StepBtn label="−15" onPress={() => step(-15)} disabled={minutes <= 15} small />
        <Text style={styles.stepFine}>ajuste fino</Text>
        <StepBtn label="+15" onPress={() => step(15)} disabled={minutes >= 720} small />
      </View>
    </LogShell>
  )
}

/* ── Botón de stepper reutilizable ─────────────────────────────────────── */
function StepBtn({
  label,
  onPress,
  disabled,
  small,
  accent,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  small?: boolean
  /** Si se pasa, el botón lleva ese color (borde + glifo) y DESTELLA en él cada
   *  vez que se toca (feedback de "sumé"). */
  accent?: string
}) {
  const flash = useSharedValue(0)
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value * 0.5 }))
  const handlePress = (): void => {
    if (accent) {
      flash.value = withSequence(
        withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 460, easing: Easing.out(Easing.quad) }),
      )
    }
    onPress()
  }
  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.stepBtn,
        small && styles.stepBtnSmall,
        disabled && styles.stepBtnDisabled,
        accent ? { borderColor: accent } : null,
      ]}
    >
      {accent ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.stepBtnFlash, { backgroundColor: accent }, flashStyle]}
        />
      ) : null}
      <Text
        style={[
          styles.stepBtnText,
          small && styles.stepBtnTextSmall,
          accent ? { color: accent } : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  // Botón cerrar — absoluto en la capa más alta, imposible de tapar.
  close: {
    position: 'absolute',
    left: 16,
    zIndex: 30,
    elevation: 30,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgCard2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  body: {
    flex: 1,
    paddingHorizontal: 26,
    paddingBottom: 8,
  },
  glow: {
    position: 'absolute',
    top: -40,
    left: 0,
    right: 0,
  },
  head: {
    marginTop: 26,
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  // Título-pregunta = Hanken display (igual que "¿Cómo voy hoy?" / "¿Qué estás
  // construyendo?"); el serif italic se reserva para la voz del coach.
  title: {
    marginTop: 12,
    fontFamily: typography.displaySemi,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: colors.leche,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  stage: {
    flex: 1,
  },
  // El contenido se centra si cabe y hace scroll si no → la luna nunca se encoge
  // y nada se corta en pantallas cortas (el CTA queda fijo abajo, fuera del scroll).
  stageContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  stageInner: {
    alignItems: 'center',
  },
  // ── CTA ───────────────────────────────────────────────
  cta: {
    alignSelf: 'stretch',
    paddingVertical: 17,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: colors.oroTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    color: colors.oroLeche,
  },
  // ── Agua ──────────────────────────────────────────────
  dropWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  stepReadout: {
    minWidth: 92,
    alignItems: 'center',
  },
  stepNum: {
    fontFamily: typography.uiBold,
    fontSize: 40,
    lineHeight: 44,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  stepUnit: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  stepFine: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    letterSpacing: 0.4,
    color: colors.niebla,
  },
  hint: {
    marginTop: 18,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    textAlign: 'center',
  },
  stepBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.lecheTint,
    overflow: 'hidden', // recorta el destello al círculo del botón
  },
  // El destello de color que aparece al sumar (opacidad animada sobre el botón).
  stepBtnFlash: {
    ...StyleSheet.absoluteFillObject,
  },
  stepBtnSmall: {
    width: 60,
    height: 44,
    borderRadius: 22,
  },
  stepBtnDisabled: {
    opacity: 0.35,
  },
  stepBtnText: {
    fontFamily: typography.uiBold,
    fontSize: 26,
    color: colors.leche,
  },
  stepBtnTextSmall: {
    fontSize: typography.sizes.label,
  },
  // ── Sueño ─────────────────────────────────────────────
  moonWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepReadout: {
    marginTop: 18,
    fontFamily: typography.uiBold,
    fontSize: 34,
    lineHeight: 38,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  // Sobre el canvas de la luna (el arte no captura toque): centrado, abajo.
  sleepReadoutOnMoon: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    textAlign: 'center',
    marginTop: 0,
  },
  presetRow: {
    marginTop: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  presetChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  presetChipOn: {
    borderColor: SLEEP,
    backgroundColor: 'rgba(124, 143, 255, 0.12)',
  },
  presetLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  presetLabelOn: {
    color: colors.leche,
  },
})
