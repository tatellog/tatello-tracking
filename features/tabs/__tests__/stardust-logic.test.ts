import {
  buildStardust,
  innerGlowLevel,
  stardustAt,
  STARDUST_COUNT,
  SUCK_S,
} from '../stardust-logic'

const g = { ox: 120, oy: 700, cx: 195, cy: 260, r: 130 }

describe('buildStardust + stardustAt · la coreografía', () => {
  const s = buildStardust(42, g)

  test('14 estrellas, y la coreografía termina después de la última succión', () => {
    expect(s.tone).toHaveLength(STARDUST_COUNT)
    expect(s.total).toBeGreaterThan(Math.max(...s.suckAt) + SUCK_S)
  })

  test('antes de su salida no existe; al salir está en la tarjeta de comidas', () => {
    expect(stardustAt(s, g, 5, s.delay[5]! - 0.01)).toBeNull()
    const start = stardustAt(s, g, 0, s.delay[0]!)!
    expect(start.phase).toBe(0)
    expect(Math.abs(start.y - g.oy)).toBeLessThan(1)
  })

  test('mientras flota, cada estrella está DENTRO del emblema (no en el anillo)', () => {
    for (let i = 0; i < STARDUST_COUNT; i++) {
      const T = s.delay[i]! + s.flight[i]! + 1
      const at = stardustAt(s, g, i, T)!
      expect(at.phase).toBe(1)
      expect(Math.hypot(at.x - g.cx, at.y - g.cy)).toBeLessThan(g.r * 0.85)
    }
  })

  test('la succión la lleva al centro y luego desaparece', () => {
    const i = 3
    const near = stardustAt(s, g, i, s.suckAt[i]! + SUCK_S * 0.95)!
    expect(near.phase).toBe(2)
    expect(Math.hypot(near.x - g.cx, near.y - g.cy)).toBeLessThan(20)
    expect(stardustAt(s, g, i, s.suckAt[i]! + SUCK_S + 0.01)).toBeNull()
  })

  test('la succión es en cascada: no empiezan todas al mismo tiempo', () => {
    expect(new Set(s.suckAt.map((x) => x.toFixed(2))).size).toBeGreaterThan(STARDUST_COUNT / 2)
  })
})

test('innerGlowLevel: nunca apagado y crece con el avance', () => {
  expect(innerGlowLevel(0)).toBeCloseTo(0.12)
  expect(innerGlowLevel(1)).toBeCloseTo(0.72)
  expect(innerGlowLevel(0.5)).toBeGreaterThan(innerGlowLevel(0.2))
  expect(innerGlowLevel(5)).toBeCloseTo(0.72)
})
