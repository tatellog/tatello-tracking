/*
 * N9 · "Nuevo patrón encontrado" (dueña 5 oct 2026): cuando el motor de Mes
 * encuentra un hallazgo IMPORTANTE, Stelar lo avisa con el hallazgo mismo
 * (sin números) y el tap abre "La evidencia" de ese patrón en Descubre.
 *
 * Cuáles avisan (lista aprobada): los que conectan con el déficit y dejan una
 * palanca, más entreno × proteína. Nunca los de exceso (superávit, días sobre
 * la meta): un push de exceso se lee como regaño. Ni constancias peladas.
 *
 * Reposo: un patrón avisa a lo más una vez cada 14 días. Abrir su evidencia
 * cuenta como visto (no se avisa lo que ya leíste). El registro vive en
 * AsyncStorage por usuaria; la lógica de elección es PURA.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

/** Prioridad (menor = primero) de los hallazgos que avisan. */
export const FINDING_PUSH_PRIORITY: Readonly<Record<string, number>> = {
  'movement-deficit': 0,
  'sleep-deficit': 1,
  'workout-type-deficit': 2,
  'deficit-daytype': 3,
  'training-protein': 4,
}

export const FINDING_REST_DAYS = 14
const DAY_MS = 86_400_000

/** id del patrón → ISO del aviso agendado (o de cuando se vio su evidencia). */
export type FindingLedger = Record<string, string>

export type FindingCandidate = { id: string; title: string; kind?: string }

/**
 * El hallazgo a anunciar, o null. Si ya hay uno agendado a futuro y el motor
 * lo sigue viendo, se conserva (re-abrir la app no lo reemplaza). Si no, el
 * de mayor prioridad que no se haya avisado ni visto en los últimos 14 días.
 */
export function pickFindingToAnnounce(
  patterns: readonly FindingCandidate[],
  ledger: Readonly<FindingLedger>,
  now: Date,
): FindingCandidate | null {
  const eligible = patterns.filter(
    (p) => (p.kind === undefined || p.kind === 'pattern') && p.id in FINDING_PUSH_PRIORITY,
  )
  const pending = eligible.find((p) => {
    const at = ledger[p.id]
    return at != null && new Date(at).getTime() > now.getTime()
  })
  if (pending) return pending
  const rested = eligible.filter((p) => {
    const at = ledger[p.id]
    return at == null || now.getTime() - new Date(at).getTime() >= FINDING_REST_DAYS * DAY_MS
  })
  rested.sort((a, b) => FINDING_PUSH_PRIORITY[a.id]! - FINDING_PUSH_PRIORITY[b.id]!)
  return rested[0] ?? null
}

/** El texto del push: el hallazgo tal cual lo dice Descubre, sin números. */
export function findingPushCopy(finding: FindingCandidate): { title: string; body: string } {
  return { title: 'Nuevo patrón encontrado', body: finding.title }
}

/* ── El registro (AsyncStorage, por usuaria) ──────────────────────────── */

const ledgerKey = (uid: string) => `stelar.notif.finding-ledger:${uid}`

export async function readFindingLedger(uid: string): Promise<FindingLedger> {
  try {
    const raw = await AsyncStorage.getItem(ledgerKey(uid))
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: FindingLedger = {}
    for (const [k, v] of Object.entries(parsed)) if (typeof v === 'string') out[k] = v
    return out
  } catch {
    return {}
  }
}

export async function writeFindingLedgerEntry(uid: string, id: string, iso: string): Promise<void> {
  const ledger = await readFindingLedger(uid)
  ledger[id] = iso
  await AsyncStorage.setItem(ledgerKey(uid), JSON.stringify(ledger)).catch(() => {})
}
