import { formatLongDate } from '../present-logic'

describe('formatLongDate', () => {
  it('formatea en español sin correrse por timezone', () => {
    // 2026-05-16 es sábado (UTC).
    expect(formatLongDate('2026-05-16')).toBe('Sábado, 16 de mayo')
  })

  it('cadena vacía ante fecha inválida', () => {
    expect(formatLongDate('nope')).toBe('')
  })
})
