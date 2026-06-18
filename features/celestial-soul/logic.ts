/*
 * Motor PURO del Alma Celeste. Todo se DERIVA del set de ids de nodos
 * revelados + la config. Sin React, sin side effects, O(n) (escala a 100+).
 * La figura SIEMPRE está visible; lo que se calcula es cuánto despertó cada
 * sistema (región) alrededor de ella.
 */

import type {
  AwakeningLevel,
  RegionProgress,
  RevealSource,
  SoulConfig,
  SoulMilestone,
  SoulNode,
  SoulProgress,
  SoulStage,
} from './types'

/*
 * Etapas del despertar TOTAL (los boards). Cada tramo de % tiene nombre y voz.
 * Cruzar a la siguiente dispara el momento de revelación (contenido, no
 * full-screen). minPct inclusivo, ordenadas de menor a mayor.
 */
export const SOUL_STAGES: readonly SoulStage[] = [
  { key: 'nacimiento', name: 'Nacimiento', minPct: 0, line: 'Tu Alma Celeste está despertando.' },
  {
    key: 'primer-despertar',
    name: 'Primer Despertar',
    minPct: 10,
    line: 'Tu energía comienza a encenderse.',
  },
  {
    key: 'comienza-a-moverse',
    name: 'Comienza a moverse',
    minPct: 26,
    line: 'Tu luz empieza a expandirse.',
  },
  {
    key: 'mitad-del-despertar',
    name: 'Mitad del despertar',
    minPct: 50,
    line: 'Tu Alma comienza a reconocerse.',
  },
  {
    key: 'avance-profundo',
    name: 'Avance profundo',
    minPct: 66,
    line: 'Cada paso ilumina tu cielo.',
  },
  {
    key: 'casi-despierta',
    name: 'Casi despierta',
    minPct: 90,
    line: 'Tu cosmos está casi completo.',
  },
  {
    key: 'despertada',
    name: 'Despertada',
    minPct: 100,
    line: 'Tu Alma Celeste ha despertado.',
  },
]

/** Etapa actual según el % total (la de mayor minPct alcanzado). Nunca null:
 *  el 0 % ya es "Nacimiento". */
export function stageForPct(pct: number): SoulStage {
  let hit: SoulStage = SOUL_STAGES[0]!
  for (const s of SOUL_STAGES) if (pct >= s.minPct) hit = s
  return hit
}

/** La etapa a la que se CRUZA entre prev→next (para disparar la revelación), o
 *  null si no cambió de etapa. Devuelve la etapa más alta cruzada. */
export function stageCrossed(prevPct: number, nextPct: number): SoulStage | null {
  const prev = stageForPct(prevPct)
  const next = stageForPct(nextPct)
  if (next.minPct > prev.minPct) return next
  return null
}

/** Copy de los hitos del progreso TOTAL (voz del coach). Las revelaciones
 *  fuertes son por región al 100 % (region.revelation); esto es el arco global. */
export const SOUL_MILESTONES: readonly SoulMilestone[] = [
  { pct: 25, copy: 'El Alma empieza a despertar.' },
  { pct: 50, copy: 'Tu cosmos cobra vida.' },
  { pct: 75, copy: 'Casi todo en ti despierta.' },
  { pct: 100, copy: 'Tu Alma Celeste ha despertado.' },
]

export function milestoneForPct(pct: number): SoulMilestone | null {
  let hit: SoulMilestone | null = null
  for (const m of SOUL_MILESTONES) if (pct >= m.pct) hit = m
  return hit
}

export function milestoneCrossed(prevPct: number, nextPct: number): SoulMilestone | null {
  for (const m of SOUL_MILESTONES) if (prevPct < m.pct && nextPct >= m.pct) return m
  return null
}

/** Nivel de despertar de una región según su %. */
export function awakeningLevel(pct: number): AwakeningLevel {
  if (pct <= 0) return 'asleep'
  if (pct >= 100) return 'awake'
  if (pct < 50) return 'stirring'
  return 'awakening'
}

/** Etiqueta del nivel (voz del coach, para la UI). */
export const AWAKENING_LABEL: Record<AwakeningLevel, string> = {
  asleep: 'Dormido',
  stirring: 'Despertando',
  awakening: 'Latiendo',
  awake: 'Despierto',
}

function sourceNodesInOrder(config: SoulConfig, source: RevealSource): SoulNode[] {
  return config.nodes
    .map((node, idx) => ({ node, idx }))
    .filter((e) => e.node.source === source)
    .sort((a, b) => (a.node.order ?? a.idx) - (b.node.order ?? b.idx))
    .map((e) => e.node)
}

/** Próximo nodo OCULTO que despertaría una acción de `source`. null si esa
 *  fuente ya encendió todos los suyos. */
export function nextNodeForSource(
  config: SoulConfig,
  source: RevealSource,
  revealed: ReadonlySet<string>,
): SoulNode | null {
  for (const node of sourceNodesInOrder(config, source)) {
    if (!revealed.has(node.id)) return node
  }
  return null
}

/** Progreso total + por región + hito global + estado final. */
export function computeSoulProgress(
  config: SoulConfig,
  revealed: ReadonlySet<string>,
): SoulProgress {
  const total = config.nodes.length

  const regionTotals = new Map<string, number>()
  const regionRevealed = new Map<string, number>()
  let revealedCount = 0
  for (const node of config.nodes) {
    regionTotals.set(node.region, (regionTotals.get(node.region) ?? 0) + 1)
    if (revealed.has(node.id)) {
      revealedCount += 1
      regionRevealed.set(node.region, (regionRevealed.get(node.region) ?? 0) + 1)
    }
  }

  const pct = total > 0 ? Math.round((revealedCount / total) * 100) : 0

  const regions: RegionProgress[] = config.regions.map((r) => {
    const rt = regionTotals.get(r.key) ?? 0
    const rr = regionRevealed.get(r.key) ?? 0
    const rpct = rt > 0 ? Math.round((rr / rt) * 100) : 0
    return {
      key: r.key,
      label: r.label,
      source: r.source,
      meaning: r.meaning,
      total: rt,
      revealed: rr,
      pct: rpct,
      level: awakeningLevel(rpct),
    }
  })

  const fullyAwake = regions.length > 0 && regions.every((r) => r.pct === 100)

  return {
    total,
    revealed: revealedCount,
    pct,
    fullyAwake,
    milestone: milestoneForPct(pct),
    regions,
  }
}

/** Las regiones que CRUZARON a 100 % entre dos estados (para disparar la
 *  revelación full-screen "<Región> Despierta"). Devuelve las defs cruzadas. */
export function regionsJustAwoke(
  config: SoulConfig,
  prev: ReadonlySet<string>,
  next: ReadonlySet<string>,
): SoulConfig['regions'][number][] {
  const before = computeSoulProgress(config, prev).regions
  const after = computeSoulProgress(config, next).regions
  const beforeByKey = new Map(before.map((r) => [r.key, r.pct]))
  const crossed: SoulConfig['regions'][number][] = []
  for (const r of after) {
    if (r.pct === 100 && (beforeByKey.get(r.key) ?? 0) < 100) {
      const def = config.regions.find((d) => d.key === r.key)
      if (def) crossed.push(def)
    }
  }
  return crossed
}

/*
 * Decide qué fuentes deben revelar un nodo AHORA, bajo la cadencia "por día
 * sostenido": una fuente revela si (1) cumplió su condición del día, (2) NO
 * reveló ya hoy (máx. 1 nodo/fuente/día) y (3) aún le queda algún nodo oculto.
 * Puro y determinista → testeable sin React ni red.
 */
export function sourcesToReveal(args: {
  config: SoulConfig
  revealed: ReadonlySet<string>
  metSources: ReadonlySet<RevealSource>
  revealedTodaySources: ReadonlySet<RevealSource>
}): RevealSource[] {
  const { config, revealed, metSources, revealedTodaySources } = args
  const out: RevealSource[] = []
  for (const src of metSources) {
    if (revealedTodaySources.has(src)) continue
    if (nextNodeForSource(config, src, revealed)) out.push(src)
  }
  return out
}

/** Índices de las líneas ENCENDIDAS (ambos extremos revelados). */
export function litLineIndexes(config: SoulConfig, revealed: ReadonlySet<string>): number[] {
  const out: number[] = []
  config.lines.forEach(([a, b], i) => {
    if (revealed.has(a) && revealed.has(b)) out.push(i)
  })
  return out
}
