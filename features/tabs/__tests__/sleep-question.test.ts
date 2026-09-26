import { nearestSleepChip, SLEEP_CHIPS, sleepAnsweredText } from '../sleep-question'

describe('SLEEP_CHIPS', () => {
  it('siete chips de media hora, con los extremos abiertos', () => {
    expect(SLEEP_CHIPS.map((c) => c.label)).toEqual(['‹6', '6', '6½', '7', '7½', '8', '8½+'])
    expect(SLEEP_CHIPS.map((c) => c.minutes)).toEqual([330, 360, 390, 420, 450, 480, 510])
  })
})

describe('nearestSleepChip', () => {
  it('resalta el chip más cercano a la noche anotada o del reloj', () => {
    expect(nearestSleepChip(465)?.label).toBe('7½')
    expect(nearestSleepChip(482)?.label).toBe('8')
    expect(nearestSleepChip(300)?.label).toBe('‹6')
    expect(nearestSleepChip(600)?.label).toBe('8½+')
    expect(nearestSleepChip(null)).toBeNull()
  })
})

describe('sleepAnsweredText', () => {
  it('imprime la cifra exacta para chips cerrados, reloj y registros viejos', () => {
    expect(sleepAnsweredText(450, { manual: true })).toBe('Dormiste 7 h 30')
    expect(sleepAnsweredText(465, { manual: false })).toBe('Dormiste 7 h 45')
    expect(sleepAnsweredText(420, { manual: true, past: true })).toBe('Esa noche dormiste 7 h')
  })

  it('un chip abierto anotado a mano se lee como lo que eligió', () => {
    expect(sleepAnsweredText(330, { manual: true })).toBe('Dormiste menos de 6 h')
    expect(sleepAnsweredText(510, { manual: true })).toBe('Dormiste 8 h 30 o más')
  })

  it('el reloj nunca se redondea a un extremo abierto', () => {
    expect(sleepAnsweredText(510, { manual: false })).toBe('Dormiste 8 h 30')
  })
})
