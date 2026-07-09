import { buildFindings, hashFindings } from '../findings'
import { buildHypotheses } from '../hypothesis'
import { buildMonthChat } from '../month-chat'
import { buildMonthlyReport } from '../report'
import { buildStories } from '../stories'
import { mkSig } from './signals.fixture'

const CTX = { calorieTarget: 1500, proteinTarget: 120 }

/** N días desde 2026-07-01, con override por día. */
function month(count: number, override: (i: number) => Record<string, unknown> = () => ({})) {
  const out = []
  for (let i = 0; i < count; i++) {
    const day = `2026-07-${String(i + 1).padStart(2, '0')}`
    out.push(mkSig(day, { calories: 1300, meal_count: 3, ...override(i) }))
  }
  return out
}

describe('buildMonthlyReport — integrador final (R1 · T5.2)', () => {
  it('ensambla el mes con el MISMO set de hallazgos que buildFindings', () => {
    const signals = month(24, (i) => ({
      trained: i < 10,
      calories: i < 9 ? 1200 : 1600,
      water_glasses: i < 8 ? 8 : 3,
    }))
    const report = buildMonthlyReport('2026-07', signals, CTX)
    const findings = buildFindings(signals, CTX)

    expect(report.month).toBe('2026-07')
    expect(report.findings).toEqual(findings)
    expect(report.findingsHash).toBe(hashFindings(findings))
    // Historias e hipótesis derivan de ESOS hallazgos, no de otro cálculo.
    expect(report.stories).toEqual(buildStories(findings))
    expect(report.hypotheses).toEqual(buildHypotheses(findings, buildStories(findings)))
  })

  it('el veredicto se ancla en el déficit sostenido (deficit-summary), no en el peso', () => {
    const signals = month(20, (i) => ({ calories: i < 14 ? 1200 : 1700 }))
    const report = buildMonthlyReport('2026-07', signals, CTX)
    expect(report.verdict).not.toBeNull()
    expect(report.verdict!.id).toBe('deficit-summary')
    expect(report.verdict!.category).toBe('deficit')
    // Es el mismo objeto que vive en findings (una sola fuente).
    expect(report.findings).toContain(report.verdict)
  })

  it('sin datos suficientes: veredicto null y reporte vacío pero válido', () => {
    const report = buildMonthlyReport('2026-07', [], CTX)
    expect(report.verdict).toBeNull()
    expect(report.findings).toEqual([])
    expect(report.stories).toEqual([])
    expect(report.hypotheses).toEqual([])
    // El hash sigue siendo estable (huella de un set vacío).
    expect(report.findingsHash).toBe(hashFindings([]))
  })

  it('es determinístico: mismas señales → mismo reporte (sin reloj ni random)', () => {
    const signals = month(24, (i) => ({ trained: i < 10, calories: i < 9 ? 1200 : 1600 }))
    const a = buildMonthlyReport('2026-07', signals, CTX)
    const b = buildMonthlyReport('2026-07', signals, CTX)
    expect(a).toEqual(b)
  })
})

// PARIDAD DEL FLIP (T5.3): el reporte persistido y el compute-local de la UI de
// hoy (buildMonthChat) deben producir los MISMOS hallazgos y el MISMO hash. Esto
// es lo que hace del flip un no-op sobre la salida: prender
// USE_PERSISTED_MONTH_REPORT no cambia lo que la usuaria ve, solo de dónde sale.
describe('paridad buildMonthlyReport ↔ buildMonthChat (flip T5.3)', () => {
  const cases: [string, number, (i: number) => Record<string, unknown>][] = [
    [
      'déficit + entreno + agua',
      24,
      (i) => ({
        trained: i < 10,
        calories: i < 9 ? 1200 : 1600,
        water_glasses: i < 8 ? 8 : 3,
        sleep_minutes: 430,
      }),
    ],
    [
      'ruptura de un día de la semana',
      28,
      (i) => {
        const wd = new Date(`2026-07-${String(i + 1).padStart(2, '0')}T00:00:00Z`).getUTCDay()
        return { calories: wd === 5 ? 2100 : 1250, trained: i % 3 === 0, sleep_minutes: 420 }
      },
    ],
  ]

  it.each(cases)('mismos findings + mismo hash: %s', (_name, count, override) => {
    const signals = month(count, override)
    const report = buildMonthlyReport('2026-07', signals, CTX)
    const chat = buildMonthChat(signals, CTX)
    expect(chat.ready).toBe(true) // el caso tiene datos suficientes
    // Los hallazgos del reporte == las cards que la UI muestra hoy.
    expect(report.findings).toEqual(chat.cards)
    // El hash del reporte == el que la UI computa hoy con hashFindings(cards).
    expect(report.findingsHash).toBe(hashFindings(chat.cards))
  })
})
