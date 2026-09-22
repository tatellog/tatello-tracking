import { useIsFocused } from '@react-navigation/native'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Easing, cancelAnimation, useSharedValue, withTiming } from 'react-native-reanimated'

import {
  HERO_REACTION_MS,
  heroReactionFromMutationEvent,
  type HeroReaction,
  type HeroReactionKind,
} from '@/features/tabs/hero-reaction'

/*
 * Hero vivo (V-13) — el disparador.
 *
 * Escucha el mutation cache de React Query: cada mutation marcada con
 * `logMeta(kind)` que tiene ÉXITO se vuelve una reacción del emblema. Vive en
 * el padre (Hoy), no dentro de LunarConstellation: así la constelación sigue
 * siendo pura en props (los snapshots de refactor-safety la renderizan sin
 * QueryClientProvider) y el hero de Órbita Mes no se suscribe a nada.
 *
 * Una reacción a la vez: un registro nuevo mientras otra corre la reemplaza
 * (cancel + reinicio del reloj), nunca se apilan. El reloj `t` es UN
 * SharedValue estable por hook — el worklet de la capa Skia lo captura una
 * vez. El estado React solo cambia dos veces por reacción (montar/desmontar),
 * no por frame.
 *
 * `enabled` false = no suscribe (flag apagado, reduce-motion).
 *
 * Foco: la mayoría de los registros ocurren con Hoy TAPADO (scan-meal es una
 * ruta encima de los tabs; los modales de Órbita Día viven en otro tab). Sin
 * foco el listener solo anota el registro en un ref (sin setState ni
 * withTiming: cero costo) y la reacción se toca cuando Hoy vuelve a pantalla
 * dentro de la ventana `PENDING_WINDOW_MS`: "volvés y el cielo te recibió".
 * Más tarde que eso, silencio (una reacción vieja leería a glitch).
 * LunarConstellation además ignora la reacción si no está en pantalla.
 */

/** Cuánto puede esperar una reacción a que Hoy vuelva al frente. */
export const PENDING_WINDOW_MS = 6000
export function useHeroReaction(enabled: boolean): HeroReaction | null {
  const qc = useQueryClient()
  const focused = useIsFocused()
  const t = useSharedValue(0)
  const [active, setActive] = useState<{
    kind: HeroReactionKind
    seed: number
    key: number
  } | null>(null)
  const keyRef = useRef(0)
  // Registro ocurrido sin foco, a la espera de que Hoy vuelva al frente.
  const pendingRef = useRef<{ kind: HeroReactionKind; at: number } | null>(null)
  // Wrapper ESTABLE que lee el foco fresco (el listener del cache se crea una
  // vez por `enabled`; no debe capturar un `focused` viejo).
  const focusedRef = useRef(focused)
  focusedRef.current = focused

  const play = useRef((kind: HeroReactionKind) => {
    const key = ++keyRef.current
    setActive({ kind, seed: key * 7919 + (Date.now() % 997), key })
    cancelAnimation(t)
    t.value = 0
    t.value = withTiming(1, { duration: HERO_REACTION_MS[kind], easing: Easing.out(Easing.quad) })
  }).current

  useEffect(() => {
    if (!enabled) return
    return qc.getMutationCache().subscribe((event) => {
      const kind = heroReactionFromMutationEvent(event)
      if (!kind) return
      if (focusedRef.current) play(kind)
      else pendingRef.current = { kind, at: Date.now() }
    })
  }, [enabled, qc, play])

  // Hoy vuelve al frente: si hay un registro reciente esperando, ahora se ve.
  useEffect(() => {
    if (!enabled || !focused) return
    const pending = pendingRef.current
    pendingRef.current = null
    if (pending && Date.now() - pending.at <= PENDING_WINDOW_MS) play(pending.kind)
  }, [enabled, focused, play])

  // Desmontar sola al terminar (temporizador JS, keyed: una reacción nueva
  // que reemplazó a esta no se apaga por el timer viejo).
  useEffect(() => {
    if (!active) return
    const id = setTimeout(
      () => setActive((a) => (a?.key === active.key ? null : a)),
      HERO_REACTION_MS[active.kind] + 80,
    )
    return () => clearTimeout(id)
  }, [active])

  return active ? { kind: active.kind, seed: active.seed, t } : null
}
