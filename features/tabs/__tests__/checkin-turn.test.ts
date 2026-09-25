import { CHECKIN_MORNING_UNTIL_HOUR, checkInTurn } from '../checkin-turn'

const pending = {
  workoutAnswered: false,
  sleepAnswered: false,
  workoutOpen: null,
  sleepOpen: null,
} as const

describe('checkInTurn', () => {
  it('por la mañana pregunta el sueño y deja el entreno como puerta quieta', () => {
    expect(checkInTurn({ ...pending, hour: 7 })).toEqual({ workout: 'quiet', sleep: 'ask' })
    expect(checkInTurn({ ...pending, hour: CHECKIN_MORNING_UNTIL_HOUR - 1 }).sleep).toBe('ask')
  })

  it('por la mañana, con la noche anotada, el entreno sigue quieto (aún no pasó)', () => {
    expect(checkInTurn({ ...pending, hour: 8, sleepAnswered: true })).toEqual({
      workout: 'quiet',
      sleep: 'answered',
    })
  })

  it('desde el mediodía pregunta el entreno y el sueño espera como puerta', () => {
    expect(checkInTurn({ ...pending, hour: CHECKIN_MORNING_UNTIL_HOUR })).toEqual({
      workout: 'ask',
      sleep: 'quiet',
    })
    expect(checkInTurn({ ...pending, hour: 21 })).toEqual({ workout: 'ask', sleep: 'quiet' })
  })

  it('al responder el entreno de noche, el sueño abre una vez si sigue pendiente', () => {
    expect(checkInTurn({ ...pending, hour: 21, workoutAnswered: true })).toEqual({
      workout: 'answered',
      sleep: 'ask',
    })
  })

  it('todo respondido: dos filas colapsadas', () => {
    expect(
      checkInTurn({ ...pending, hour: 21, workoutAnswered: true, sleepAnswered: true }),
    ).toEqual({ workout: 'answered', sleep: 'answered' })
  })

  it('"Después" deja el sueño quieto el resto del día, sin abrir el entreno por la mañana', () => {
    expect(checkInTurn({ ...pending, hour: 8, sleepOpen: false })).toEqual({
      workout: 'quiet',
      sleep: 'quiet',
    })
    expect(checkInTurn({ ...pending, hour: 21, workoutAnswered: true, sleepOpen: false })).toEqual({
      workout: 'answered',
      sleep: 'quiet',
    })
  })

  it('"anotar" / "cambiar" abren a mano, aunque esté respondido o no sea su hora', () => {
    expect(checkInTurn({ ...pending, hour: 8, workoutOpen: true })).toEqual({
      workout: 'ask',
      sleep: 'quiet',
    })
    expect(checkInTurn({ ...pending, hour: 21, sleepAnswered: true, sleepOpen: true })).toEqual({
      workout: 'quiet',
      sleep: 'ask',
    })
    expect(
      checkInTurn({ ...pending, hour: 21, workoutAnswered: true, workoutOpen: true }).workout,
    ).toBe('ask')
  })

  it('nunca hay dos preguntas vivas a la vez', () => {
    for (const hour of [7, 12, 21]) {
      for (const workoutOpen of [null, true, false] as const) {
        for (const sleepOpen of [null, true, false] as const) {
          const t = checkInTurn({ ...pending, hour, workoutOpen, sleepOpen })
          expect([t.workout, t.sleep].filter((m) => m === 'ask').length).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('un día pasado ofrece el entreno (backfill) y nunca pregunta el sueño solo', () => {
    expect(checkInTurn({ ...pending, hour: 8, past: true })).toEqual({
      workout: 'ask',
      sleep: 'quiet',
    })
    expect(checkInTurn({ ...pending, hour: 8, past: true, workoutAnswered: true })).toEqual({
      workout: 'answered',
      sleep: 'quiet',
    })
    expect(checkInTurn({ ...pending, hour: 8, past: true, sleepOpen: true }).sleep).toBe('ask')
  })
})
