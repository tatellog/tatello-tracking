import { logMeta } from '@/lib/logMeta'

import {
  HERO_REACTION_MS,
  heroReactionFromMutationEvent,
  heroReactionSpec,
  pickStars,
  type MutationEventLike,
} from '../hero-reaction'

const success = (
  meta: Record<string, unknown> | undefined,
  state: { variables?: unknown; context?: unknown } = {},
): MutationEventLike => ({
  type: 'updated',
  action: { type: 'success' },
  mutation: { options: { meta }, state },
})

describe('heroReactionFromMutationEvent', () => {
  it('reacciona al ÉXITO de una mutation marcada como registro', () => {
    expect(heroReactionFromMutationEvent(success(logMeta('comida')))).toBe('comida')
    expect(heroReactionFromMutationEvent(success(logMeta('animo')))).toBe('animo')
    expect(heroReactionFromMutationEvent(success(logMeta('sueno')))).toBe('sueno')
  })

  it('calla en pending, error, hidratación y mutations sin meta', () => {
    expect(
      heroReactionFromMutationEvent({ ...success(logMeta('comida')), action: { type: 'pending' } }),
    ).toBeNull()
    expect(
      heroReactionFromMutationEvent({ ...success(logMeta('comida')), action: { type: 'error' } }),
    ).toBeNull()
    expect(
      heroReactionFromMutationEvent({
        type: 'added',
        mutation: success(logMeta('comida')).mutation,
      }),
    ).toBeNull()
    expect(heroReactionFromMutationEvent(success(undefined))).toBeNull()
    expect(heroReactionFromMutationEvent(success({ log: 'peso' }))).toBeNull()
  })

  it('agua con guard glasses-up: solo cuenta si el total sube', () => {
    const meta = logMeta('agua', 'glasses-up')
    expect(
      heroReactionFromMutationEvent(success(meta, { variables: 3, context: { prev: 2 } })),
    ).toBe('agua')
    expect(
      heroReactionFromMutationEvent(success(meta, { variables: 1, context: { prev: 2 } })),
    ).toBeNull()
    expect(
      heroReactionFromMutationEvent(success(meta, { variables: 2, context: { prev: 2 } })),
    ).toBeNull()
    // Sin snapshot previo: cualquier vaso cuenta.
    expect(heroReactionFromMutationEvent(success(meta, { variables: 1 }))).toBe('agua')
  })

  it('agua con guard delta-up: solo deltas positivos', () => {
    const meta = logMeta('agua', 'delta-up')
    expect(heroReactionFromMutationEvent(success(meta, { variables: { delta: 1 } }))).toBe('agua')
    expect(heroReactionFromMutationEvent(success(meta, { variables: { delta: -1 } }))).toBeNull()
    expect(heroReactionFromMutationEvent(success(meta, { variables: {} }))).toBeNull()
  })
})

describe('pickStars', () => {
  it('es determinístico por semilla y sin repetidos', () => {
    const a = pickStars(42, 3, 30)
    expect(a).toEqual(pickStars(42, 3, 30))
    expect(new Set(a).size).toBe(3)
    expect(a.every((i) => i >= 0 && i < 30)).toBe(true)
    expect(pickStars(43, 3, 30)).not.toEqual(a)
  })

  it('nunca pide más estrellas de las que hay', () => {
    expect(pickStars(7, 5, 2)).toHaveLength(2)
    expect(pickStars(7, 3, 0)).toEqual([])
  })
})

describe('heroReactionSpec', () => {
  const geo = { cx: 145, cy: 145, ax: 200, ay: 90 }

  it('cada tipo tiene su origen: comida en el centro, agua en la alfa, ánimo entre ambas', () => {
    expect(heroReactionSpec('comida', geo, 1, 30)).toMatchObject({ x: 145, y: 145, shape: 'bloom' })
    expect(heroReactionSpec('agua', geo, 1, 30)).toMatchObject({ x: 200, y: 90, shape: 'ripple' })
    const animo = heroReactionSpec('animo', geo, 1, 30)
    expect(animo.x).toBeGreaterThan(145)
    expect(animo.x).toBeLessThan(200)
  })

  it('es sutil: ningún pico pasa de 0.55 y sueño es el más tenue y el más lento', () => {
    for (const kind of ['comida', 'agua', 'animo', 'sueno'] as const) {
      expect(heroReactionSpec(kind, geo, 1, 30).peak).toBeLessThanOrEqual(0.55)
    }
    expect(heroReactionSpec('sueno', geo, 1, 30).peak).toBeLessThan(
      heroReactionSpec('comida', geo, 1, 30).peak,
    )
    expect(HERO_REACTION_MS.sueno).toBeGreaterThan(HERO_REACTION_MS.comida)
  })

  it('toda reacción dura menos de 1.6 s (recompensa breve, no estado)', () => {
    for (const ms of Object.values(HERO_REACTION_MS)) expect(ms).toBeLessThanOrEqual(1600)
  })
})
