/*
 * Buzón one-shot para abrir "Antes y ahora" con A/B ya elegidos (mismo patrón
 * que features/orbit/pending-segment.ts). Lo dejan el guardado de una medición,
 * la importación y el detalle de una métrica; Progreso lo consume al enfocarse,
 * abre Cuerpo y baja al módulo. Se limpia al leerlo.
 */
export type CompareRequest = { a: string; b: string }

let pending: CompareRequest | null = null

export function requestBodyCompare(req: CompareRequest): void {
  pending = req
}

export function consumeBodyCompare(): CompareRequest | null {
  const p = pending
  pending = null
  return p
}
