/*
 * context-hash — huella determinística de un PeriodContext (AI Foundation).
 *
 * La regla del release: si el `context_hash` no cambió, NO se re-llama la IA.
 * Este hash es esa clave. No necesita ser criptográfico: solo un fingerprint
 * ESTABLE del contenido. Se computa sobre un stringify con claves ordenadas
 * (para que el mismo contexto produzca siempre el mismo hash sin importar el
 * orden de inserción de las propiedades).
 *
 * Puro y portable: sin crypto de Node ni APIs de Deno — corre en Metro, Deno
 * y jest por igual (FNV-1a de 32 bits sobre el JSON canónico).
 */

/** JSON.stringify con claves ordenadas recursivamente → salida canónica. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
  return `{${parts.join(',')}}`
}

/** FNV-1a 32-bit → hex de 8 chars. Estable entre plataformas. */
export function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    // hash *= 16777619, en aritmética de 32 bits sin overflow de JS.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/** Hash de un contexto (u objeto serializable). La misma entrada → el mismo
 *  hash; cualquier cambio en un agregado lo cambia. */
export function hashContext(context: unknown): string {
  return fnv1aHex(stableStringify(context))
}
