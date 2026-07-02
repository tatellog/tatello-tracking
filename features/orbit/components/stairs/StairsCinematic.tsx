import { useEffect, useMemo } from 'react'
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { colors, typography } from '@/theme'

import { buildStairLayout, sampleTrack, StairsScene, type StairsState } from './StairsScene'

/*
 * StairsCinematic · Capa 2 (full-screen) — el cine completo de la esfera que
 * CONSTRUYE su camino de luz. Las 8 escenas del brief, adaptadas a Stelar:
 * la esfera aparece, construye su camino subiendo, se DETIENE, la cámara hace
 * dolly-in (la pausa se agranda), luego dolly-OUT lento revelando que la pausa
 * ocupa muy poco dentro del camino que YA construyó (esta es la escena madre),
 * la cámara vuelve, y la esfera RETOMA exactamente donde estaba (nunca reinicia)
 * y sigue subiendo. Termina mientras avanza: el camino continúa, no terminó.
 * "La pausa no es fracaso; es perspectiva."
 *
 * Toda la coreografía sale de UN reloj maestro `clock` (0..1) → cada shared value
 * se DERIVA de él por tramos (worklet-safe). Sin texto que explique la emoción:
 * la cámara la cuenta. Reduced motion → un frame contemplativo estático.
 */

// Config del camino: más largo que la Capa 1 para que el dolly-out revele tramo.
const CONFIG = { steps: 16, tread: 46, rise: 32, decay: 0.95 }

// Línea de tiempo (ms acumulados). TOTAL = duración del cine.
const TOTAL = 13800
const CLIMB1_A = 1500 // la esfera arranca a subir
const CLIMB1_B = 3600 // llega al ~35%
const PAUSE_A = 3600 // se detiene (respira)
const DOLLY_IN_A = 4700
const DOLLY_IN_B = 6000
const DOLLY_OUT_B = 8300 // dolly-out: la escena madre (~2.3s)
const DOLLY_BACK_B = 9900 // la cámara vuelve
const CLIMB2_B = TOTAL // retoma y sigue

const P_PAUSE = 0.35 // progreso donde se detiene
const P_END = 0.82 // progreso al final

// Worklet helpers (memo worklet-helpers-need-worklet-directive).
function clamp01(x: number): number {
  'worklet'
  return x < 0 ? 0 : x > 1 ? 1 : x
}
function smooth(x: number): number {
  'worklet'
  return x * x * (3 - 2 * x)
}
function seg(v: number, a: number, b: number): number {
  'worklet'
  return clamp01((v - a) / (b - a))
}
function mix(a: number, b: number, t: number): number {
  'worklet'
  return a + (b - a) * t
}

export function StairsCinematic({ state, onClose }: { state: StairsState; onClose: () => void }) {
  const { width: W, height: H } = useWindowDimensions()
  const reduce = useReducedMotion()
  // Skia Paths + track: memoizar (CONFIG es constante) para no recrearlos por
  // render ni re-serializar el track a los worklets.
  const layout = useMemo(() => buildStairLayout(CONFIG), [])
  const track = layout.track
  const lift = layout.sphereR * 0.9

  const clock = useSharedValue(reduce ? 0.52 : 0)

  useEffect(() => {
    if (reduce) return
    clock.value = withTiming(1, { duration: TOTAL, easing: Easing.linear })
  }, [reduce, clock])

  // Progreso de la esfera (= frente de construcción). Sube, se detiene, retoma.
  const progress = useDerivedValue(() => {
    const ms = clock.value * TOTAL
    if (ms < CLIMB1_A) return 0
    if (ms < CLIMB1_B) return mix(0, P_PAUSE, smooth(seg(ms, CLIMB1_A, CLIMB1_B)))
    if (ms < DOLLY_BACK_B) return P_PAUSE // quieta durante pausa + dolly
    return mix(P_PAUSE, P_END, smooth(seg(ms, DOLLY_BACK_B, CLIMB2_B)))
  })

  // Cámara: sigue a la esfera; en el dolly cambia la escala manteniéndola centrada.
  const camScale = useDerivedValue(() => {
    const ms = clock.value * TOTAL
    if (ms < DOLLY_IN_A) return 1.25
    if (ms < DOLLY_IN_B) return mix(1.25, 2.3, smooth(seg(ms, DOLLY_IN_A, DOLLY_IN_B)))
    if (ms < DOLLY_OUT_B) return mix(2.3, 0.4, smooth(seg(ms, DOLLY_IN_B, DOLLY_OUT_B)))
    if (ms < DOLLY_BACK_B) return mix(0.4, 1.25, smooth(seg(ms, DOLLY_OUT_B, DOLLY_BACK_B)))
    return 1.25
  })

  // Mantiene la esfera centrada en pantalla a cualquier escala (follow + dolly).
  // La posición se muestrea UNA vez por frame y se comparte con ambos ejes.
  const spherePt = useDerivedValue(() => sampleTrack(track, progress.value))
  const camTranslateX = useDerivedValue(() => W * 0.5 - spherePt.value.x * camScale.value)
  const camTranslateY = useDerivedValue(() => H * 0.5 - (spherePt.value.y - lift) * camScale.value)

  // Respira siempre; respira más fuerte en la pausa ("pensando").
  const pulse = useDerivedValue(() => {
    const ms = clock.value * TOTAL
    const base = (Math.sin(ms / 720) + 1) / 2
    const think = seg(ms, PAUSE_A, PAUSE_A + 700) * (1 - seg(ms, DOLLY_IN_B, DOLLY_OUT_B))
    return clamp01(base * 0.6 + think * 0.5)
  })

  // Squash sutil mientras sube (oscila con el avance); casi nulo en la pausa.
  const wob = useDerivedValue(() => Math.sin(progress.value * Math.PI * CONFIG.steps * 2))
  const squashY = useDerivedValue(() => 1 + wob.value * 0.05)
  const squashX = useDerivedValue(() => 1 - wob.value * 0.05)

  const enterOpacity = useDerivedValue(() => seg(clock.value * TOTAL, 0, 900))
  const sphereOpacity = useDerivedValue(() => seg(clock.value * TOTAL, 900, 1600))

  return (
    <View style={styles.fill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={styles.scene} pointerEvents="none">
        <StairsScene
          config={CONFIG}
          state={state}
          width={W}
          height={H}
          progress={progress}
          builtUpTo={progress}
          camTranslateX={camTranslateX}
          camTranslateY={camTranslateY}
          camScale={camScale}
          pulse={pulse}
          squashX={squashX}
          squashY={squashY}
          enterOpacity={enterOpacity}
          sphereOpacity={sphereOpacity}
        />
      </View>
      {/* Cierre discreto (se puede tocar en cualquier lado también). El brief
          pide que la CÁMARA cuente la emoción: sin texto que la explique. */}
      <Animated.View entering={FadeIn.duration(500).delay(1400)} style={styles.closeWrap}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
          <Text style={styles.closeText}>Cerrar</Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
  },
  scene: {
    ...StyleSheet.absoluteFillObject,
  },
  closeWrap: {
    position: 'absolute',
    top: 56,
    right: 22,
  },
  closeText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
    color: colors.niebla,
  },
})
