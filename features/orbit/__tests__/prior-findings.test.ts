import { priorCategoriesFromRow } from '../prior-findings'

/*
 * ST-005 · la fila de `monthly_reports` guarda el reporte en `payload`
 * (no en `report`). Antes se leía `report` → la consulta fallaba en silencio
 * y el estado "confirmado por recurrencia" (finding-arc) nunca se encendía.
 */
describe('priorCategoriesFromRow', () => {
  it('lee las categorías del reporte desde la columna payload, sin repetir', () => {
    const row = {
      payload: {
        month: '2026-09',
        findings: [
          { id: 'weekday-calories', category: 'ritmo' },
          { id: 'rescue', category: 'rescate' },
          { id: 'diet-break', category: 'ritmo' },
        ],
      },
    }
    expect(priorCategoriesFromRow(row).sort()).toEqual(['rescate', 'ritmo'])
  })

  it('la forma vieja ({ report }) ya no se acepta en silencio como válida', () => {
    expect(priorCategoriesFromRow({ report: { findings: [{ category: 'ritmo' }] } })).toEqual([])
  })

  it('fila vacía o malformada → [] (sin historia, nunca error)', () => {
    expect(priorCategoriesFromRow(null)).toEqual([])
    expect(priorCategoriesFromRow({ payload: { findings: 'x' } })).toEqual([])
    expect(priorCategoriesFromRow({ payload: { findings: [] } })).toEqual([])
  })
})
