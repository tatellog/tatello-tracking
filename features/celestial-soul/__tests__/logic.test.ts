import { soulConfigForSign } from '../config'
import {
  awakeningLevel,
  computeSoulProgress,
  litLineIndexes,
  milestoneCrossed,
  milestoneForPct,
  nextNodeForSource,
  regionsJustAwoke,
  sourcesToReveal,
  stageCrossed,
  stageForPct,
} from '../logic'
import type { RevealSource } from '../types'

const CONFIG = soulConfigForSign('leo')
const ALL_IDS = CONFIG.nodes.map((n) => n.id)
const setOf = (ids: string[]) => new Set(ids)
const idsForRegion = (region: string) =>
  CONFIG.nodes.filter((n) => n.region === region).map((n) => n.id)

describe('computeSoulProgress', () => {
  it('0 revelados → 0 %, no fully awake, sin hito', () => {
    const p = computeSoulProgress(CONFIG, setOf([]))
    expect(p.pct).toBe(0)
    expect(p.fullyAwake).toBe(false)
    expect(p.milestone).toBeNull()
    expect(p.regions).toHaveLength(6)
  })

  it('todos revelados → 100 %, fully awake, hito final', () => {
    const p = computeSoulProgress(CONFIG, setOf(ALL_IDS))
    expect(p.pct).toBe(100)
    expect(p.fullyAwake).toBe(true)
    expect(p.milestone?.pct).toBe(100)
    for (const r of p.regions) {
      expect(r.pct).toBe(100)
      expect(r.level).toBe('awake')
    }
  })

  it('despertar TODA una región la pone al 100 % sin afectar las demás', () => {
    const nucleo = idsForRegion('nucleo')
    const p = computeSoulProgress(CONFIG, setOf(nucleo))
    const reg = p.regions.find((r) => r.key === 'nucleo')!
    expect(reg.pct).toBe(100)
    expect(reg.level).toBe('awake')
    expect(p.fullyAwake).toBe(false)
    expect(p.regions.filter((r) => r.pct === 100)).toHaveLength(1)
  })
})

describe('awakeningLevel', () => {
  it('mapea % a nivel', () => {
    expect(awakeningLevel(0)).toBe('asleep')
    expect(awakeningLevel(20)).toBe('stirring')
    expect(awakeningLevel(50)).toBe('awakening')
    expect(awakeningLevel(99)).toBe('awakening')
    expect(awakeningLevel(100)).toBe('awake')
  })
})

describe('milestones', () => {
  it('milestoneForPct devuelve el más alto alcanzado', () => {
    expect(milestoneForPct(24)).toBeNull()
    expect(milestoneForPct(25)?.pct).toBe(25)
    expect(milestoneForPct(100)?.pct).toBe(100)
  })
  it('milestoneCrossed solo dispara al cruzar', () => {
    expect(milestoneCrossed(20, 26)?.pct).toBe(25)
    expect(milestoneCrossed(26, 40)).toBeNull()
  })
})

describe('nextNodeForSource', () => {
  it('mood despierta los nodos del Núcleo Astral en orden, luego null', () => {
    const nucleo = idsForRegion('nucleo')
    let revealed = new Set<string>()
    for (const id of nucleo) {
      expect(nextNodeForSource(CONFIG, 'mood', revealed)?.id).toBe(id)
      revealed = new Set([...revealed, id])
    }
    expect(nextNodeForSource(CONFIG, 'mood', revealed)).toBeNull()
  })
})

describe('regionsJustAwoke', () => {
  it('detecta la región que CRUZA a 100 %', () => {
    const nucleo = idsForRegion('nucleo')
    const prev = setOf(nucleo.slice(0, -1)) // a uno de completar
    const next = setOf(nucleo) // completa
    const crossed = regionsJustAwoke(CONFIG, prev, next)
    expect(crossed.map((r) => r.key)).toEqual(['nucleo'])
  })
  it('no dispara si la región ya estaba al 100 %', () => {
    const nucleo = idsForRegion('nucleo')
    expect(regionsJustAwoke(CONFIG, setOf(nucleo), setOf(nucleo))).toEqual([])
  })
})

describe('sourcesToReveal (cadencia por día sostenido)', () => {
  const srcs = (s: RevealSource[]) => new Set<RevealSource>(s)

  it('revela una fuente que cumplió hoy y aún no reveló', () => {
    const out = sourcesToReveal({
      config: CONFIG,
      revealed: setOf([]),
      metSources: srcs(['water']),
      revealedTodaySources: srcs([]),
    })
    expect(out).toEqual(['water'])
  })

  it('NO revela una fuente que ya reveló hoy (máx. 1/fuente/día)', () => {
    const out = sourcesToReveal({
      config: CONFIG,
      revealed: setOf([]),
      metSources: srcs(['water']),
      revealedTodaySources: srcs(['water']),
    })
    expect(out).toEqual([])
  })

  it('NO revela una fuente sin nodos ocultos restantes', () => {
    const water = idsForRegion('constelaciones') // fuente water
    const out = sourcesToReveal({
      config: CONFIG,
      revealed: setOf(water),
      metSources: srcs(['water']),
      revealedTodaySources: srcs([]),
    })
    expect(out).toEqual([])
  })

  it('NO revela fuentes cuya condición no se cumplió', () => {
    const out = sourcesToReveal({
      config: CONFIG,
      revealed: setOf([]),
      metSources: srcs([]),
      revealedTodaySources: srcs([]),
    })
    expect(out).toEqual([])
  })
})

describe('stages (etapas del despertar)', () => {
  it('stageForPct mapea % a la etapa correcta', () => {
    expect(stageForPct(0).key).toBe('nacimiento')
    expect(stageForPct(9).key).toBe('nacimiento')
    expect(stageForPct(10).key).toBe('primer-despertar')
    expect(stageForPct(49).key).toBe('comienza-a-moverse')
    expect(stageForPct(50).key).toBe('mitad-del-despertar')
    expect(stageForPct(89).key).toBe('avance-profundo')
    expect(stageForPct(99).key).toBe('casi-despierta')
    expect(stageForPct(100).key).toBe('despertada')
  })

  it('stageCrossed dispara solo al subir de etapa', () => {
    expect(stageCrossed(8, 12)?.key).toBe('primer-despertar')
    expect(stageCrossed(12, 20)).toBeNull() // misma etapa
    expect(stageCrossed(99, 100)?.key).toBe('despertada')
  })

  it('stageCrossed devuelve la etapa más alta cruzada (saltos)', () => {
    expect(stageCrossed(5, 55)?.key).toBe('mitad-del-despertar')
  })

  it('stageCrossed no dispara al bajar', () => {
    expect(stageCrossed(55, 20)).toBeNull()
  })
})

describe('litLineIndexes', () => {
  it('una línea enciende solo con ambos extremos revelados', () => {
    expect(litLineIndexes(CONFIG, setOf([]))).toEqual([])
    const [a, b] = CONFIG.lines[0]!
    expect(litLineIndexes(CONFIG, setOf([a, b]))).toContain(0)
    expect(litLineIndexes(CONFIG, setOf([a]))).toEqual([])
  })
})
