import { buildWeekObservations } from '../week-logic'
import { mkSig } from './signals.fixture'

// 2026-05-31 Sun(0), 06-01 Mon(1), 06-02 Tue(2), 06-03 Wed(3), 06-04 Thu(4), 06-05 Fri(5).
const TARGET = { calorieTarget: 1600, proteinTarget: 130 }
const find = (obs: ReturnType<typeof buildWeekObservations>, key: string) =>
  obs.find((o) => o.key === key)

describe('buildWeekObservations', () => {
  test('food over target → days, entries with calories + delta, watch state', () => {
    const obs = buildWeekObservations(
      [
        mkSig('2026-06-01', { calories: 2000 }), // Mon over (+400)
        mkSig('2026-06-02', { calories: 1400 }), // Tue under
        mkSig('2026-06-03', { calories: 2100 }), // Wed over (+500)
      ],
      3,
      TARGET,
    )
    const food = find(obs, 'food-over')
    expect(food?.state).toBe('watch')
    expect(food?.dimension).toBe('alimento')
    expect(food?.title).toBe('La mesa pidió más')
    expect(food?.days).toEqual([1, 3]) // Mon, Wed (Sunday-first)
    expect(food?.detail).toBe('2 días por encima de tu objetivo.')
    expect(food?.entries).toEqual([
      { dayIdx: 1, value: '2000 cal', delta: '+400' },
      { dayIdx: 3, value: '2100 cal', delta: '+500' },
    ])
  })

  test('wins carry their own entries (entreno, protein grams) and win state', () => {
    const obs = buildWeekObservations(
      [mkSig('2026-06-01', { trained: true, protein_g: 142 })],
      3,
      TARGET,
    )
    expect(find(obs, 'trained')?.state).toBe('win')
    expect(find(obs, 'trained')?.entries).toEqual([{ dayIdx: 1, value: 'entreno' }])
    expect(find(obs, 'protein')?.state).toBe('win')
    expect(find(obs, 'protein')?.entries).toEqual([{ dayIdx: 1, value: '142 g' }])
  })

  test('no calorie target → no food-over observation', () => {
    const obs = buildWeekObservations([mkSig('2026-06-01', { calories: 5000 })], 3, {
      calorieTarget: null,
      proteinTarget: null,
    })
    expect(find(obs, 'food-over')).toBeUndefined()
  })

  test('short sleep → entries with hours', () => {
    const obs = buildWeekObservations(
      [
        mkSig('2026-06-01', { sleep_minutes: 360 }), // Mon 6.0 h
        mkSig('2026-06-02', { sleep_minutes: 300 }), // Tue 5.0 h
      ],
      3,
    )
    const sleep = find(obs, 'sleep-short')
    expect(sleep?.days).toEqual([1, 2])
    expect(sleep?.entries).toEqual([
      { dayIdx: 1, value: '6.0 h' },
      { dayIdx: 2, value: '5.0 h' },
    ])
  })

  test('wins lead — a win comes before the watches', () => {
    const obs = buildWeekObservations(
      [mkSig('2026-06-01', { trained: true, calories: 2000, sleep_minutes: 300 })],
      3,
      TARGET,
    )
    expect(obs[0]!.state).toBe('win')
  })

  test('a watch that saturates the week (≥5 days) is suppressed', () => {
    const obs = buildWeekObservations(
      [
        mkSig('2026-05-31', { calories: 2000 }),
        mkSig('2026-06-01', { calories: 2000 }),
        mkSig('2026-06-02', { calories: 2000 }),
        mkSig('2026-06-03', { calories: 2000 }),
        mkSig('2026-06-04', { calories: 2000 }),
      ],
      6,
      TARGET,
    )
    expect(find(obs, 'food-over')).toBeUndefined()
  })

  test('at most 2 watches; future days are not counted', () => {
    const obs = buildWeekObservations(
      [
        mkSig('2026-06-01', { calories: 2000 }), // food over (Mon)
        mkSig('2026-06-02', { sleep_minutes: 300 }), // short night (Tue)
        mkSig('2026-06-03', { energy: 1 }), // low energy (Wed)
        mkSig('2026-06-05', { calories: 9000 }), // Friday — future vs Wed, ignored
      ],
      3,
      TARGET,
    )
    expect(obs.length).toBe(2)
    // The Friday over-target must not appear in food-over's days.
    expect(find(obs, 'food-over')?.days).toEqual([1])
  })
})
