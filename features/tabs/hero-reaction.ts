/*
 * Hero vivo (V-13) — lógica PURA.
 *
 * El emblema de Hoy reacciona cuando la usuaria registra algo: una onda desde
 * la estrella alfa, un calor que se abre desde el centro, tres estrellas que
 * vibran. Es recompensa sensorial de "el sistema te recibió" — NO desbloqueo,
 * NO progreso, NO conteo. Por eso cada reacción es breve (≈1 s), sutil y se
 * desmonta sola; nada queda encendido después.
 *
 * Este módulo decide QUÉ reacción toca (a partir de la meta de la mutation que
 * acaba de tener éxito) y CÓMO se ve (origen, tinte, escala, pico), sin tocar
 * React ni Skia. `use-hero-reaction.ts` la dispara; `skia-hero-reaction.tsx`
 * la pinta. Todo lo que sale de acá son primitivos (los worklets solo capturan
 * primitivos).
 */

import type { SharedValue } from 'react-native-reanimated'

import { LOG_GUARD_KEY, LOG_META_KEY, type LogGuard, type LogKind } from '@/lib/logMeta'
import { colors } from '@/theme'

export type HeroReactionKind = LogKind

/** La reacción viva: qué es + semilla (elige las estrellas) + su reloj 0→1. */
export type HeroReaction = {
  kind: HeroReactionKind
  seed: number
  t: SharedValue<number>
}

/** Duración total de cada reacción. Todas arrancan visibles en el primer
 *  frame (el pico llega antes de la mitad), así "registrar → reacción" queda
 *  bien por debajo de 1 s aunque la cola se apague más despacio. */
export const HERO_REACTION_MS: Record<HeroReactionKind, number> = {
  comida: 1100,
  agua: 900,
  animo: 1200,
  sueno: 1500,
}

/* ── ¿Este evento del mutation cache es un registro? ─────────────────── */

/** Forma mínima del evento de `QueryClient.getMutationCache().subscribe`. */
export type MutationEventLike = {
  type: string
  action?: { type: string }
  mutation?: {
    options: { meta?: Record<string, unknown> }
    state: { variables?: unknown; context?: unknown }
  }
}

function passesGuard(guard: LogGuard | undefined, variables: unknown, context: unknown): boolean {
  if (!guard) return true
  if (guard === 'glasses-up') {
    const prev = (context as { prev?: unknown } | undefined)?.prev
    return typeof variables === 'number' && variables > (typeof prev === 'number' ? prev : 0)
  }
  const delta = (variables as { delta?: unknown } | undefined)?.delta
  return typeof delta === 'number' && delta > 0
}

/** Devuelve el tipo de registro si el evento es el ÉXITO de una mutation
 *  marcada con `logMeta`, o null (hidratación, pending, error, no-registro,
 *  o un guard que no pasa). */
export function heroReactionFromMutationEvent(event: MutationEventLike): HeroReactionKind | null {
  if (event.type !== 'updated' || event.action?.type !== 'success') return null
  const meta = event.mutation?.options.meta
  const kind = meta?.[LOG_META_KEY]
  if (kind !== 'comida' && kind !== 'agua' && kind !== 'animo' && kind !== 'sueno') return null
  const guard = meta?.[LOG_GUARD_KEY] as LogGuard | undefined
  const state = event.mutation?.state
  return passesGuard(guard, state?.variables, state?.context) ? kind : null
}

/* ── Cómo se ve cada reacción ────────────────────────────────────────── */

export type HeroReactionSpec = {
  /** bloom = calor que se abre (círculos concéntricos) · ripple = onda (anillo). */
  shape: 'bloom' | 'ripple'
  tint: string
  /** Origen en coords viewBox. */
  x: number
  y: number
  scaleFrom: number
  scaleTo: number
  /** Opacidad pico del grupo (0..1). Sutil a propósito. */
  peak: number
  /** Índices (en la lista plana de estrellas ambiente) que vibran. */
  stars: number[]
}

/** Elige `count` índices distintos de `total`, determinísticos por semilla. */
export function pickStars(seed: number, count: number, total: number): number[] {
  if (total <= 0 || count <= 0) return []
  const n = Math.min(count, total)
  const out: number[] = []
  let x = Math.abs(Math.floor(seed)) % 2147483647 || 1
  while (out.length < n) {
    x = (x * 48271) % 2147483647
    const idx = x % total
    if (!out.includes(idx)) out.push(idx)
  }
  return out
}

/**
 * La receta visual por tipo de registro. `cx,cy` = centro del lienzo;
 * `ax,ay` = estrella alfa (la fuente de la luz en la figura).
 *   comida → calor dorado que se abre desde el corazón del cielo.
 *   agua   → una onda de leche desde la estrella alfa.
 *   animo  → la nebulosa cálida respira (bloom magenta sesgado hacia la alfa).
 *   sueno  → el campo profundo titila: bloom leche muy tenue, lento, más
 *            estrellas vibrando.
 */
export function heroReactionSpec(
  kind: HeroReactionKind,
  geometry: { cx: number; cy: number; ax: number; ay: number },
  seed: number,
  starTotal: number,
): HeroReactionSpec {
  const { cx, cy, ax, ay } = geometry
  switch (kind) {
    case 'comida':
      return {
        shape: 'bloom',
        tint: colors.oroSoft,
        x: cx,
        y: cy,
        scaleFrom: 0.55,
        scaleTo: 1.35,
        peak: 0.5,
        stars: pickStars(seed, 3, starTotal),
      }
    case 'agua':
      return {
        shape: 'ripple',
        tint: colors.leche,
        x: ax,
        y: ay,
        scaleFrom: 0.2,
        scaleTo: 2.2,
        peak: 0.55,
        stars: pickStars(seed, 3, starTotal),
      }
    case 'animo':
      return {
        shape: 'bloom',
        tint: colors.magenta,
        x: cx + (ax - cx) * 0.6,
        y: cy + (ay - cy) * 0.6,
        scaleFrom: 0.7,
        scaleTo: 1.25,
        peak: 0.35,
        stars: pickStars(seed, 3, starTotal),
      }
    case 'sueno':
      return {
        shape: 'bloom',
        tint: colors.leche,
        x: cx,
        y: cy,
        scaleFrom: 1.0,
        scaleTo: 1.6,
        peak: 0.18,
        stars: pickStars(seed, 5, starTotal),
      }
  }
}
