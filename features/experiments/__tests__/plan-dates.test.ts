import { nextReminderDate, occurrenceOf, planDates, planMoment, type WeekdayPlan } from '../plan'

const plan: WeekdayPlan = {
  id: 'e',
  hypothesisId: 'h',
  weekday: 5,
  text: 'Entrenar ese día',
  reminderMinutes: 13 * 60,
  startedOn: '2026-10-06',
  endsOn: '2026-11-03',
}

test('planDates: los 4 viernes de la ventana', () => {
  expect(planDates(plan)).toEqual(['2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30'])
})

test('planMoment: el viernes es "hoy"; el sábado pide el cierre si no respondió', () => {
  expect(planMoment(plan, '2026-10-09', new Set())).toEqual({ kind: 'today', date: '2026-10-09' })
  expect(planMoment(plan, '2026-10-10', new Set())).toEqual({ kind: 'checkin', date: '2026-10-09' })
  expect(planMoment(plan, '2026-10-10', new Set(['2026-10-09']))).toBeNull()
  expect(planMoment(plan, '2026-10-12', new Set())).toBeNull()
})

test('occurrenceOf: viernes 2 de 4', () => {
  expect(occurrenceOf(plan, '2026-10-16')).toEqual({ n: 2, of: 4 })
})

test('nextReminderDate: el siguiente viernes a la 1 pm; nada al terminar', () => {
  const next = nextReminderDate(plan, new Date(2026, 9, 9, 14, 0))!
  expect([next.getDate(), next.getHours()]).toEqual([16, 13])
  expect(nextReminderDate(plan, new Date(2026, 9, 31))).toBeNull()
  expect(nextReminderDate({ ...plan, reminderMinutes: null }, new Date(2026, 9, 6))).toBeNull()
})
