import { monthCellPosition, processDuration, trainedByMonth } from '../share-logic'

describe('processDuration · el tiempo como héroe de la tarjeta', () => {
  test('15 ago 2024 → 14 jul 2026 son 22 meses (le faltan días al 23)', () => {
    expect(processDuration('2024-08-15', '2026-07-14')).toEqual({ value: '22', unit: 'meses' })
  })
  test('menos de dos semanas: días', () => {
    expect(processDuration('2026-10-01', '2026-10-06')).toEqual({ value: '5', unit: 'días' })
    expect(processDuration('2026-10-01', '2026-10-02')).toEqual({ value: '1', unit: 'día' })
  })
  test('menos de dos meses: semanas', () => {
    expect(processDuration('2026-08-01', '2026-09-15')).toEqual({ value: '6', unit: 'semanas' })
  })
  test('años exactos: años', () => {
    expect(processDuration('2024-07-14', '2026-07-14')).toEqual({ value: '2', unit: 'años' })
  })
})

describe('trainedByMonth', () => {
  test('cuenta por mes, con ceros en medio y fuera de rango ignorado', () => {
    expect(
      trainedByMonth(
        ['2026-05-03', '2026-07-01', '2026-07-02', '2026-04-30', '2026-08-01'],
        '2026-05-01',
        '2026-07-31',
      ),
    ).toEqual([
      { month: '2026-05', count: 1 },
      { month: '2026-06', count: 0 },
      { month: '2026-07', count: 2 },
    ])
  })
})

test('monthCellPosition: octubre 2026 empieza en jueves (columna 3)', () => {
  expect(monthCellPosition('2026-10', 1)).toEqual({ col: 3, row: 0 })
  expect(monthCellPosition('2026-10', 5)).toEqual({ col: 0, row: 1 })
})
