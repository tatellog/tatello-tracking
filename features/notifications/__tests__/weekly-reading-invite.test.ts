import { READING_COPY, weeklyReadingGuaranteed } from '../invite'

/*
 * N8 · la garantía de la Lectura Semanal: el push SOLO se agenda cuando la
 * lectura del próximo lunes ya no puede fallar (la semana en curso juntó
 * los días mínimos con comida del motor). Nunca promesa vacía.
 */

type Row = { day: string | null; calories: number | null }
const food = (day: string, calories = 1800): Row => ({ day, calories })

// Semana de referencia: lunes 20 jul 2026 → domingo 26 jul 2026.
const TODAY = '2026-07-23' // jueves

describe('weeklyReadingGuaranteed', () => {
  it('3 días con comida en la semana en curso → garantizada', () => {
    const days = [food('2026-07-20'), food('2026-07-21'), food('2026-07-22')]
    expect(weeklyReadingGuaranteed(days, TODAY)).toBe(true)
  })

  it('2 días → todavía no (el motor callaría; sin push)', () => {
    const days = [food('2026-07-20'), food('2026-07-22')]
    expect(weeklyReadingGuaranteed(days, TODAY)).toBe(false)
  })

  it('los días de la semana PASADA no cuentan para la garantía', () => {
    // 3 días, pero dos son de la semana anterior (esa lectura es otra).
    const days = [food('2026-07-17'), food('2026-07-18'), food('2026-07-20')]
    expect(weeklyReadingGuaranteed(days, TODAY)).toBe(false)
  })

  it('días sin comida (calories null o 0) no cuentan', () => {
    const days: Row[] = [
      food('2026-07-20'),
      { day: '2026-07-21', calories: 0 },
      { day: '2026-07-22', calories: null },
      food('2026-07-23'),
    ]
    expect(weeklyReadingGuaranteed(days, TODAY)).toBe(false)
  })

  it('el lunes mismo cuenta (frontera inferior de la semana)', () => {
    const days = [food('2026-07-20'), food('2026-07-21'), food('2026-07-23')]
    expect(weeklyReadingGuaranteed(days, TODAY)).toBe(true)
  })

  it('en domingo la semana sigue siendo la misma (frontera superior)', () => {
    const days = [food('2026-07-24'), food('2026-07-25'), food('2026-07-26')]
    expect(weeklyReadingGuaranteed(days, '2026-07-26')).toBe(true)
  })

  it('sin señales → false (jamás push a una semana vacía)', () => {
    expect(weeklyReadingGuaranteed([], TODAY)).toBe(false)
  })
})

describe('READING_COPY', () => {
  it('lleva ✦ en el title (ganada, como cierre/sello/ciclo) y nunca emoji', () => {
    expect(READING_COPY.title).toContain('✦')
    // El catálogo prohíbe emojis; la ✦ tipográfica es la única marca.
    expect(READING_COPY.title).not.toMatch(/\p{Emoji_Presentation}/u)
    expect(READING_COPY.body).not.toMatch(/\p{Emoji_Presentation}/u)
  })

  it('no adelanta números ni conteos (el contenido vive en la lectura)', () => {
    expect(READING_COPY.title).not.toMatch(/\d/)
    expect(READING_COPY.body).not.toMatch(/\d/)
  })

  it('el body se sostiene solo si el canal trunca el title', () => {
    expect(READING_COPY.body.length).toBeGreaterThan(20)
    expect(READING_COPY.body).not.toMatch(/^(y|pero|además)/i)
  })
})
