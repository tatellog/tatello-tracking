import { stepsRhythm } from '../steps'
import { mkSig } from './signals.fixture'

// 2026-09-21 es lunes; hoy = viernes 25.
const MON = '2026-09-21'
const TODAY = '2026-09-25'

describe('stepsRhythm (spec wearables §9)', () => {
  it('calla con menos de 3 días con pasos', () => {
    expect(
      stepsRhythm(
        [mkSig('2026-09-21', { steps: 8000 }), mkSig('2026-09-22', { steps: 9000 })],
        MON,
        TODAY,
      ),
    ).toBeNull()
  })

  it('promedio a centenas + los días que destacan, en orden de semana', () => {
    const r = stepsRhythm(
      [
        mkSig('2026-09-21', { steps: 6000 }),
        mkSig('2026-09-22', { steps: 12000 }),
        mkSig('2026-09-23', { steps: 6100 }),
        mkSig('2026-09-24', { steps: 11000 }),
        mkSig('2026-09-25', { steps: 5900 }),
      ],
      MON,
      TODAY,
    )
    expect(r).toEqual({ avgSteps: 8200, daysWithData: 5, topDays: ['martes', 'jueves'] })
  })

  it('semana pareja → sin días destacados; ignora días fuera de lunes→hoy y sin pasos', () => {
    const r = stepsRhythm(
      [
        mkSig('2026-09-19', { steps: 30000 }), // sábado pasado: fuera
        mkSig('2026-09-21', { steps: 8000 }),
        mkSig('2026-09-22', { steps: 8200 }),
        mkSig('2026-09-23', { steps: 0 }),
        mkSig('2026-09-24', { steps: 7900 }),
      ],
      MON,
      TODAY,
    )
    expect(r).toEqual({ avgSteps: 8000, daysWithData: 3, topDays: [] })
  })
})
