import { nextOfferState, shouldOffer, windowForHour } from '../offer-logic'

describe('oferta de avisos en contexto', () => {
  it('la primera comida ofrece una vez; el primer patrón solo si dijo "Ahora no"', () => {
    expect(shouldOffer('meal', 'none', null)).toBe(true)
    expect(shouldOffer('meal', 'declined', null)).toBe(false)
    expect(shouldOffer('pattern', 'none', null)).toBe(false)
    expect(shouldOffer('pattern', 'declined', null)).toBe(true)
    expect(shouldOffer('pattern', 'done', null)).toBe(false)
  })

  it('quien eligió "Aún no" en el onboarding viejo sí recibe la oferta; quien ya tiene hora, no', () => {
    expect(shouldOffer('meal', 'none', 'not_yet')).toBe(true)
    expect(shouldOffer('meal', 'none', 'evening')).toBe(false)
    expect(shouldOffer('pattern', 'declined', 'morning')).toBe(false)
  })

  it('dos "Ahora no" cierran la oferta; aceptar también', () => {
    expect(nextOfferState('meal', false)).toBe('declined')
    expect(nextOfferState('pattern', false)).toBe('done')
    expect(nextOfferState('meal', true)).toBe('done')
  })

  it('la hora sale de cuándo aceptó', () => {
    expect([6, 10, 11, 16, 17, 23].map(windowForHour)).toEqual([
      'morning',
      'morning',
      'midday',
      'midday',
      'evening',
      'evening',
    ])
  })
})
