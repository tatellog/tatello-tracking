import { workoutArrivedCopy } from '../workout-arrived'

jest.mock('expo-constants', () => ({ executionEnvironment: 'storeClient' }))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))

describe('workoutArrivedCopy', () => {
  it('dice qué llegó, cuánto y de dónde, sin romantizar', () => {
    expect(workoutArrivedCopy({ type: 'fuerza', minutes: 60 })).toEqual({
      title: 'Entreno registrado: Fuerza, 60 min',
      body: 'Lo trajo tu reloj. Toca para verlo en Stelar.',
    })
  })
  it('sin tipo conocido o sin duración, no inventa', () => {
    expect(workoutArrivedCopy({ type: 'otro', minutes: 30 }).title).toBe(
      'Entreno registrado, 30 min',
    )
    expect(workoutArrivedCopy({ type: 'cardio', minutes: null }).title).toBe(
      'Entreno registrado: Cardio',
    )
  })
  it('sin guiones largos', () => {
    const c = workoutArrivedCopy({ type: 'caminata', minutes: 45 })
    expect(`${c.title} ${c.body}`).not.toMatch(/—/)
  })
})
