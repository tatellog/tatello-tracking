import {
  INVITE_COPY,
  nextInviteDate,
  nextSealDate,
  SEAL_COPY,
  sealAbsorbsClose,
  WINDOW_TIME,
} from '../invite'

describe('nextInviteDate', () => {
  it('agenda para MAÑANA en la hora de la ventana, nunca hoy', () => {
    // 4 jul 2026, 8:00 — antes de la ventana morning de hoy: aun así, mañana.
    const now = new Date(2026, 6, 4, 8, 0)
    const d = nextInviteDate(now, 'morning')
    expect(d.getDate()).toBe(5)
    expect(d.getHours()).toBe(WINDOW_TIME.morning.hour)
    expect(d.getMinutes()).toBe(WINDOW_TIME.morning.minute)
  })

  it('cruza fin de mes correctamente', () => {
    const now = new Date(2026, 6, 31, 22, 0)
    const d = nextInviteDate(now, 'evening')
    expect(d.getMonth()).toBe(7) // agosto
    expect(d.getDate()).toBe(1)
    expect(d.getHours()).toBe(19)
    expect(d.getMinutes()).toBe(30)
  })

  it('cada ventana usa su hora', () => {
    const now = new Date(2026, 6, 4, 12, 0)
    expect(nextInviteDate(now, 'midday').getHours()).toBe(13)
    expect(nextInviteDate(now, 'evening').getHours()).toBe(19)
  })
})

describe('INVITE_COPY', () => {
  it('invita, jamás cobra: sin rachas, sin pérdida, sin culpa', () => {
    const all = `${INVITE_COPY.title} ${INVITE_COPY.body}`
    expect(all).not.toMatch(/racha|pierd|romp|falta|debe|olvid/i)
    expect(INVITE_COPY.body).toContain('cuando quieras')
  })
})

describe('nextSealDate — la cita del lunes', () => {
  it('sábado → el lunes que viene', () => {
    const d = nextSealDate(new Date(2026, 6, 4, 17, 0), 'morning') // sáb 4 jul
    expect(d.getDay()).toBe(1)
    expect(d.getDate()).toBe(6)
    expect(d.getHours()).toBe(WINDOW_TIME.morning.hour)
  })

  it('domingo → mañana lunes', () => {
    const d = nextSealDate(new Date(2026, 6, 5, 22, 0), 'evening')
    expect(d.getDay()).toBe(1)
    expect(d.getDate()).toBe(6)
  })

  it('lunes → el PRÓXIMO lunes (nunca encima del día en curso)', () => {
    const d = nextSealDate(new Date(2026, 6, 6, 8, 0), 'midday')
    expect(d.getDay()).toBe(1)
    expect(d.getDate()).toBe(13)
  })
})

describe('sealAbsorbsClose — techo 1/día', () => {
  it('lunes con datos: el sello absorbe al cierre', () => {
    expect(sealAbsorbsClose(new Date(2026, 6, 6, 12, 0), true)).toBe(true) // lun 6 jul
  })

  it('lunes sin datos: no hay sello que absorba, el cierre vive', () => {
    expect(sealAbsorbsClose(new Date(2026, 6, 6, 12, 0), false)).toBe(false)
  })

  it('martes a domingo: el cierre vive', () => {
    for (let day = 7; day <= 12; day++) {
      expect(sealAbsorbsClose(new Date(2026, 6, day, 12, 0), true)).toBe(false) // mar..dom
    }
  })
})

describe('SEAL_COPY', () => {
  it('invita sin deuda ni score', () => {
    const all = `${SEAL_COPY.title} ${SEAL_COPY.body}`
    expect(all).not.toMatch(/racha|pierd|romp|falta|debe|logr|puntaje/i)
    expect(all).toMatch(/cuando quieras/i)
  })
})
