import { minMeasured, resultLine, resultTone } from '../verdict'

describe('minMeasured', () => {
  it('pide la mitad redondeada hacia arriba, con piso 4', () => {
    expect(minMeasured(14)).toBe(7)
    expect(minMeasured(7)).toBe(4)
    expect(minMeasured(5)).toBe(4)
  })

  it('nunca exige más días que la duración', () => {
    expect(minMeasured(3)).toBe(3)
    expect(minMeasured(1)).toBe(1)
  })
})

describe('resultLine', () => {
  it('confirmada y descartada hablan sin culpa y sin depender de los días', () => {
    expect(resultLine('confirmed', 0, 14)).toBe('Se sostuvo en tus días.')
    expect(resultLine('discarded', 0, 14)).toBe('No se sostuvo esta vez, y eso también dice algo.')
  })

  it('inconclusa por pocos días medidos: distingue un día de varios', () => {
    expect(resultLine('inconclusive', 0, 14)).toMatch(/^Lo probaste solo un día\./)
    expect(resultLine('inconclusive', 1, 14)).toMatch(/^Lo probaste solo un día\./)
    expect(resultLine('inconclusive', 5, 14)).toMatch(/^Lo seguiste 5 días\./)
    expect(resultLine('inconclusive', 5, 14)).toMatch(/los días que lo sigues, no los de antes\.$/)
  })

  it('inconclusa con días suficientes es señal ambigua genuina', () => {
    expect(resultLine('inconclusive', 7, 14)).toBe('Aún no alcanza para saberlo.')
    expect(resultLine('inconclusive', 4, 7)).toBe('Aún no alcanza para saberlo.')
  })

  it('sin duración conocida asume el máximo (14 días)', () => {
    expect(resultLine('inconclusive', 6, undefined)).toMatch(/^Lo seguiste 6 días\./)
    expect(resultLine('inconclusive', 7, undefined)).toBe('Aún no alcanza para saberlo.')
  })

  it('nunca usa lenguaje de culpa ni de fracaso', () => {
    const lines = [
      resultLine('confirmed', 10, 14),
      resultLine('discarded', 10, 14),
      resultLine('inconclusive', 0, 14),
      resultLine('inconclusive', 3, 14),
      resultLine('inconclusive', 9, 14),
    ]
    for (const line of lines) {
      expect(line).not.toMatch(/fall|fracas|mal|culpa|deb(es|iste)|cerraste/i)
      expect(line).not.toMatch(/—/)
    }
  })
})

describe('resultTone', () => {
  it('solo la confirmada se enciende', () => {
    expect(resultTone('confirmed')).toBe('good')
    expect(resultTone('discarded')).toBe('soft')
    expect(resultTone('inconclusive')).toBe('soft')
    expect(resultTone(undefined)).toBe('soft')
  })
})
