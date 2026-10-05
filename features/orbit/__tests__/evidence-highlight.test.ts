import { colors } from '@/theme'

import { barFractions, evidenceChip, evidenceLook } from '../evidence-highlight'

describe('evidenceLook', () => {
  test('entreno × proteína: mancuerna + proteína, en coral', () => {
    const look = evidenceLook('training-protein', colors.oro)
    expect(look.kicker).toBe('Proteína')
    expect(look.icons.map((i) => i.name)).toEqual(['dumbbell', 'food-drumstick'])
    expect(look.accent).toBe(colors.signal.proteina)
  })
  test('patrón desconocido: estrella en el color de respaldo', () => {
    const look = evidenceLook('algo-nuevo', colors.oro)
    expect(look.kicker).toBe('Patrón')
    expect(look.icons).toEqual([{ name: 'star-four-points', color: colors.oro }])
  })
})

describe('evidenceChip', () => {
  test('valores: la diferencia con su unidad y el lado resaltado', () => {
    expect(
      evidenceChip(
        'training-protein',
        [
          { label: 'Con entreno', value: 90, highlight: true },
          { label: 'Sin entreno', value: 64 },
        ],
        'g',
      ),
    ).toBe('+26 g con entreno')
  })
  test('tasas: porcentaje contra porcentaje', () => {
    expect(
      evidenceChip(
        'movement-deficit',
        [
          { label: 'Con entreno', value: 9, total: 12, highlight: true },
          { label: 'Sin entreno', value: 6, total: 14 },
        ],
        'días',
      ),
    ).toBe('75% contra 43%')
  })
  test('patrones de exceso: sin chip', () => {
    expect(
      evidenceChip(
        'weekend-surplus',
        [
          { label: 'Entre semana', value: 100 },
          { label: 'Fin de semana', value: 900, highlight: true },
        ],
        'kcal',
      ),
    ).toBeNull()
  })
  test('sin barra resaltada, una sola barra o diferencia en contra: sin chip', () => {
    expect(
      evidenceChip(
        'x',
        [
          { label: 'A', value: 3 },
          { label: 'B', value: 2 },
        ],
        'días',
      ),
    ).toBeNull()
    expect(
      evidenceChip('x', [{ label: 'A', value: 3, total: 5, highlight: true }], 'días'),
    ).toBeNull()
    expect(
      evidenceChip(
        'x',
        [
          { label: 'A', value: 2, highlight: true },
          { label: 'B', value: 5 },
        ],
        'g',
      ),
    ).toBeNull()
  })
})

test('barFractions: tasa con denominador, relativo al mayor sin él', () => {
  expect(
    barFractions([
      { label: 'A', value: 9, total: 12 },
      { label: 'B', value: 6, total: 14 },
    ]),
  ).toEqual([0.75, 6 / 14])
  expect(
    barFractions([
      { label: 'A', value: 90 },
      { label: 'B', value: 45 },
    ]),
  ).toEqual([1, 0.5])
})
