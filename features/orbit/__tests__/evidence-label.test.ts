import {
  EARLY_MATURITY_MAX_STAGE,
  EVIDENCE_LABEL_TEXT,
  monthPatternLabel,
  PATTERN_MIN_DAYS_PER_GROUP,
  patternSampleLine,
} from '../evidence-label'
import { detectMonthPatterns } from '../month-built'
import { rankSurprises, rescueAfterOver, shortNightEffect } from '../surprise'
import { addDays, mkSig, monIdxUTC } from './signals.fixture'

/*
 * ST-005 · contrato de evidencia: cada patrón del mes dice QUÉ TIPO de
 * afirmación es y sobre cuántos días se apoya — sin umbrales nuevos.
 */
const BASE = '2026-06-01' // lunes
const TARGET = 1800

function month(count: number, override: (i: number) => Record<string, unknown>) {
  return Array.from({ length: count }, (_, i) => mkSig(addDays(BASE, i), override(i)))
}

describe('monthPatternLabel', () => {
  it('una constancia es un dato registrado, a cualquier madurez', () => {
    expect(monthPatternLabel({ kind: 'discovery' }, 0)).toBe('dato')
    expect(monthPatternLabel({ kind: 'discovery' }, 5)).toBe('dato')
  })

  const sample = (a: number, b: number) => ({
    groups: [
      { label: 'Con entreno', days: a },
      { label: 'Sin entreno', days: b },
    ],
  })

  it('un patrón con poca historia es observación inicial; con historia y muestra, detectado', () => {
    const p = { kind: 'pattern' as const, sample: sample(8, 6) }
    expect(monthPatternLabel(p, EARLY_MATURITY_MAX_STAGE)).toBe('observacion')
    expect(monthPatternLabel(p, EARLY_MATURITY_MAX_STAGE + 1)).toBe('patron')
  })

  it('P13: con historia madura, un grupo bajo el mínimo sigue siendo observación inicial', () => {
    const stage = EARLY_MATURITY_MAX_STAGE + 1
    const min = PATTERN_MIN_DAYS_PER_GROUP
    expect(monthPatternLabel({ kind: 'pattern', sample: sample(8, min - 1) }, stage)).toBe(
      'observacion',
    )
    expect(monthPatternLabel({ kind: 'pattern', sample: sample(min, min) }, stage)).toBe('patron')
  })

  it('sin muestra declarada nunca es "detectado"', () => {
    const stage = EARLY_MATURITY_MAX_STAGE + 1
    expect(monthPatternLabel({ kind: 'pattern' }, stage)).toBe('observacion')
    expect(monthPatternLabel({ kind: 'pattern', sample: { groups: [] } }, stage)).toBe(
      'observacion',
    )
  })

  it('el mínimo por grupo es 5 (decisión de la dueña, P13)', () => {
    expect(PATTERN_MIN_DAYS_PER_GROUP).toBe(5)
  })

  it('el corte es el mismo "Empieza a asomar" que ya usaba la UI (etapa ≤ 2)', () => {
    expect(EARLY_MATURITY_MAX_STAGE).toBe(2)
  })

  it('usa el vocabulario único del plan (§7)', () => {
    expect(EVIDENCE_LABEL_TEXT.observacion).toBe('Observación inicial')
    expect(EVIDENCE_LABEL_TEXT.patron).toBe('Patrón detectado')
    expect(EVIDENCE_LABEL_TEXT.dato).toBe('Dato registrado')
  })
})

describe('patternSampleLine', () => {
  it('suma los grupos comparados y los nombra', () => {
    expect(
      patternSampleLine({
        groups: [
          { label: 'Con entreno', days: 15 },
          { label: 'Sin entreno', days: 12 },
        ],
      }),
    ).toBe('27 días comparados · Con entreno 15 · Sin entreno 12')
  })

  it('sin muestra declarada → null (nunca se estima)', () => {
    expect(patternSampleLine(undefined)).toBeNull()
    expect(patternSampleLine({ groups: [] })).toBeNull()
    expect(patternSampleLine({ groups: [{ label: 'X', days: 0 }] })).toBeNull()
  })

  it('sin guion largo ni lenguaje de juicio', () => {
    const line = patternSampleLine({ groups: [{ label: 'Entre semana', days: 1 }] })!
    expect(line).toBe('1 día comparado · Entre semana 1')
    expect(line).not.toMatch(/—/)
  })
})

describe('cada patrón accionable declara su muestra (mismos conteos que sus barras)', () => {
  it('movimiento × déficit: grupos = días con y sin entreno', () => {
    const signals = month(12, (i) => ({
      meal_count: 2,
      trained: i % 2 === 0,
      calories: i % 2 === 0 ? 1400 : 2400,
    }))
    const p = detectMonthPatterns(signals, { calorieTarget: TARGET }).find(
      (x) => x.id === 'movement-deficit',
    )!
    expect(p.sample?.groups).toEqual([
      { label: 'Con entreno', days: 6 },
      { label: 'Sin entreno', days: 6 },
    ])
    // La muestra coincide con los denominadores de las barras.
    expect(p.evidence.bars.map((b) => b.total)).toEqual(p.sample!.groups.map((g) => g.days))
  })

  it('déficit por tipo de día: grupos = días con comida entre semana y en fin de semana', () => {
    const signals = month(14, (i) => {
      const wd = monIdxUTC(addDays(BASE, i))
      return { meal_count: 2, calories: wd < 5 ? 1400 : 2400 }
    })
    const p = detectMonthPatterns(signals, { calorieTarget: TARGET }).find(
      (x) => x.id === 'deficit-daytype',
    )!
    expect(p.sample?.groups).toEqual([
      { label: 'Entre semana', days: 10 },
      { label: 'Fin de semana', days: 4 },
    ])
  })

  it('todo patrón kind "pattern" trae muestra; las constancias no la necesitan', () => {
    const signals = month(14, (i) => ({
      meal_count: 2,
      trained: i % 2 === 0,
      sleep_minutes: i % 2 === 0 ? 450 : 360,
      protein_g: i % 2 === 0 ? 150 : 110,
      calories: i % 2 === 0 ? 1400 : 2400,
    }))
    const ps = detectMonthPatterns(signals, { calorieTarget: TARGET, proteinTarget: 120 })
    const patterns = ps.filter((p) => p.kind === 'pattern')
    expect(patterns.length).toBeGreaterThan(0)
    for (const p of patterns) {
      expect(patternSampleLine(p.sample)).not.toBeNull()
    }
  })
})

describe('total declarado: grupos que se traslapan no se suman', () => {
  it('"el día después" contra tus días en general cuenta los días una vez', () => {
    expect(
      patternSampleLine({
        groups: [
          { label: 'El día después', days: 6 },
          { label: 'Tus días en general', days: 20 },
        ],
        total: 20,
      }),
    ).toBe('20 días comparados · El día después 6 · Tus días en general 20')
  })
})

describe('cada sorpresa declara su muestra (mismos conteos con los que decide)', () => {
  it('noche corta: grupos = noches cortas y noches de 7 h o más (días completos)', () => {
    const signals = month(14, (i) => ({
      meal_count: 3,
      sleep_minutes: i % 2 === 0 ? 300 : 450,
      calories: i % 2 === 0 ? 2100 : 1500,
    }))
    const s = shortNightEffect(signals)!
    expect(s.sample?.groups).toEqual([
      { label: 'Noches de menos de 6 h', days: 7 },
      { label: 'Noches de 7 h o más', days: 7 },
    ])
    expect(s.minSide).toBe(Math.min(...s.sample!.groups.map((g) => g.days)))
  })

  it('el rescate declara el total sin contar dos veces', () => {
    // Cada 4 días uno sobre la meta; el siguiente cierra en déficit.
    const signals = month(20, (i) => ({
      meal_count: 2,
      calories: i % 4 === 0 ? 2400 : i % 4 === 1 ? 1500 : 900,
    }))
    const s = rescueAfterOver(signals, { calorieTarget: TARGET })
    expect(s).not.toBeNull()
    expect(s!.sample).toEqual({
      groups: [
        { label: 'El día después', days: 5 },
        { label: 'Tus días en general', days: 20 },
      ],
      total: 20,
    })
    expect(patternSampleLine(s!.sample)).toBe(
      '20 días comparados · El día después 5 · Tus días en general 20',
    )
  })

  it('toda sorpresa del ranker trae muestra', () => {
    const signals = month(28, (i) => ({
      meal_count: 3,
      trained: i % 2 === 0,
      sleep_minutes: i % 3 === 0 ? 300 : 450,
      protein_g: i % 2 === 0 ? 90 : 140,
      steps: i % 2 === 0 ? 12000 : 3000,
      calories: i % 3 === 0 ? 2300 : 1500,
    }))
    const { hero, others } = rankSurprises(signals, { calorieTarget: TARGET })
    const all = [hero, ...others].filter((x): x is NonNullable<typeof x> => x != null)
    expect(all.length).toBeGreaterThan(0)
    for (const s of all) expect(patternSampleLine(s.sample)).not.toBeNull()
  })
})
