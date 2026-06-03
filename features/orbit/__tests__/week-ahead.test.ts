import type { Patron } from '../mock'
import { buildWeekAhead } from '../week-logic'

/** Minimal weekday Patron — the function only reads id + data. */
function wkPatron(id: string, focus: number): Patron {
  return { id, data: { kind: 'weekday', focus, week: [], weeks: [] } } as unknown as Patron
}
const weekendFood = {
  id: 'weekend-food',
  data: { kind: 'paired', groups: [] },
} as unknown as Patron

// JS getDay: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
describe('buildWeekAhead', () => {
  test('names the soonest upcoming patterned day', () => {
    // weekday-low focus = Wednesday (Mon-first index 2). Today = Monday.
    const hint = buildWeekAhead([wkPatron('weekday-low-2', 2)], 1)
    expect(hint).toBe('El miércoles suele costar un poco más.')
  })

  test('weekend-food surfaces as RHYTHM (never anticipated food)', () => {
    const hint = buildWeekAhead([weekendFood], 4 /* Thu */)
    expect(hint).toBe('El finde suele moverse a otro ritmo.')
    expect(hint).not.toMatch(/mesa|comida|kcal|cal/i)
  })

  test('nothing ahead → null (Saturday, weekend already here)', () => {
    expect(buildWeekAhead([weekendFood], 6 /* Sat */)).toBeNull()
  })

  test('a pattern whose day already passed this week → null', () => {
    // tension focus = Monday (index 0); today = Wednesday → Monday is behind.
    expect(buildWeekAhead([wkPatron('weekday-tension-0', 0)], 3)).toBeNull()
  })

  test('the SOONEST upcoming day wins over a later one', () => {
    const patterns = [wkPatron('low-sleep-4', 4) /* Fri */, wkPatron('weekday-low-2', 2) /* Wed */]
    expect(buildWeekAhead(patterns, 1 /* Mon */)).toBe('El miércoles suele costar un poco más.')
  })

  test('phrases per pattern type', () => {
    expect(buildWeekAhead([wkPatron('weekday-tension-3', 3)], 1)).toBe(
      'El jueves suele pedir más de vos.',
    )
    expect(buildWeekAhead([wkPatron('low-sleep-4', 4)], 1)).toBe(
      'El viernes la noche suele acortarse.',
    )
    expect(buildWeekAhead([wkPatron('weekday-high-1', 1)], 0)).toBe('El martes suele encenderse.')
  })
})
