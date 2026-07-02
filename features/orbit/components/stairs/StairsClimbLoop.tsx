import { useEffect, useMemo } from 'react'
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { useScreenActive } from '../../useScreenActive'
import { buildStairLayout, sampleTrack, StairsScene, type StairsState } from './StairsScene'

/*
 * StairsClimbLoop · Capa 1 (compacta, en §0 de Órbita Semana) — el orquestador
 * Reanimated de la esfera que CONSTRUYE su camino de luz. Reemplaza la flechita
 * de dirección con una mini-escena contemplativa que se repite suave.
 *
 * La esfera sube su tramo (construyendo cada escalón al pisar) mientras la CÁMARA
 * la sigue centrada; el camino se va dibujando detrás. Al llegar al final el
 * ciclo reinicia, pero el reinicio ocurre DENTRO de un fade (enterOpacity cae en
 * los extremos), así nunca se ve un "teletransporte" — coherente con la filosofía
 * ("nunca reinicia" a los ojos de la usuaria). El estado (rising/steady/softer)
 * sólo cambia el acento/glow via StairsScene.
 *
 * Todo es shared values (regla de perf). Reduced motion → un frame estático a
 * media construcción (calmo, sin animación). Validar en release (Skia+worklets).
 */

// Camino compacto: pocos escalones, bien visibles, para el header.
const LOOP_CONFIG = { steps: 8, tread: 42, rise: 30, decay: 0.95 }
const CAM_SCALE = 1.15
const CLIMB_MS = 8200
const FADE = 0.06 // fracción del ciclo con fade en cada extremo (oculta el seam)

export function StairsClimbLoop({
  state,
  width,
  height = 112,
}: {
  state: StairsState
  width: number
  height?: number
}) {
  const reduce = useReducedMotion()
  // Pausa el loop (y el repintado del Canvas Skia) cuando Semana no está a la
  // vista o se está scrolleando — patrón useScreenActive; si no, la escalera
  // repinta cada frame off-tab y compite con el scroll (Órbita es el tab pesado).
  const active = useScreenActive()
  const layout = useMemo(() => buildStairLayout(LOOP_CONFIG), [])
  const track = layout.track
  const sphereLift = layout.sphereR * 0.9

  // t = progreso del ciclo (0..1) = posición de la esfera = frente de construcción.
  const t = useSharedValue(reduce ? 0.5 : 0)
  const pulse = useSharedValue(0)
  const scale = useSharedValue(CAM_SCALE)

  useEffect(() => {
    if (reduce || !active) return
    t.value = withRepeat(
      withTiming(1, { duration: CLIMB_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    )
    // La esfera respira siempre (glow), independiente del avance.
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    )
    return () => {
      cancelAnimation(t)
      cancelAnimation(pulse)
    }
  }, [reduce, active, t, pulse])

  // Cámara sigue a la esfera (centrada a ~42% ancho, ~62% alto). La posición se
  // muestrea UNA vez por frame y se comparte con ambos ejes (evita recorrer la
  // pista dos veces).
  const spherePt = useDerivedValue(() => sampleTrack(track, t.value))
  const camTranslateX = useDerivedValue(() => width * 0.42 - spherePt.value.x * scale.value)
  const camTranslateY = useDerivedValue(
    () => height * 0.62 - (spherePt.value.y - sphereLift) * scale.value,
  )

  // Fade en los extremos → el reinicio del ciclo no se ve (sin teletransporte).
  const enterOpacity = useDerivedValue(() => {
    const x = t.value
    return Math.max(0, Math.min(1, x / FADE, (1 - x) / FADE))
  })

  // Squash & stretch sutil, oscilando con el avance (aire de "saltos suaves").
  const wobble = useDerivedValue(() => Math.sin(t.value * Math.PI * LOOP_CONFIG.steps * 2))
  const squashY = useDerivedValue(() => 1 + wobble.value * 0.05)
  const squashX = useDerivedValue(() => 1 - wobble.value * 0.05)

  return (
    <StairsScene
      config={LOOP_CONFIG}
      state={state}
      width={width}
      height={height}
      progress={t}
      builtUpTo={t}
      camTranslateX={camTranslateX}
      camTranslateY={camTranslateY}
      camScale={scale}
      pulse={pulse}
      squashX={squashX}
      squashY={squashY}
      enterOpacity={enterOpacity}
    />
  )
}
