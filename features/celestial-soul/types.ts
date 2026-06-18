/*
 * Alma Celeste — la evolución de LARGO PLAZO tras completar la Constelación
 * Natal. OJO al concepto (no es un segundo zodiaco, no es un personaje nuevo,
 * no hay alas/armaduras/coronas/RPG):
 *
 *   La FIGURA celeste ya está completa y visible. El arte no se revela más.
 *   Lo que despierta es el COSMOS alrededor de ella — 6 sistemas universales
 *   (mismos para los 12 signos; solo cambia el arte por signo). El usuario no
 *   "descubre quién es"; DESPIERTA lo que ya estaba dentro.
 *
 * ARQUITECTURA (future-proof · 100+ nodos, expansiones sin rediseño): todo es
 * DATA. Cada REGIÓN es un sistema visual que despierta; tiene NODOS que una
 * FUENTE (acción) enciende. La lógica (logic.ts) es pura y O(n). Lo persistido
 * es solo el set de ids de nodos revelados; el resto se DERIVA.
 */

/** Los 6 sistemas universales del Alma Celeste. El mapa de regiones es el mismo
 *  para los 12 signos. Expansión futura: agregar claves + nodos en config. */
export type SoulRegionKey =
  | 'nucleo' // Núcleo Astral — centro del pecho, estrella que late
  | 'orbitas' // Órbitas Eternas — anillos que giran alrededor
  | 'constelaciones' // Constelaciones Ocultas — el cielo de fondo
  | 'flujo' // Flujo Estelar — cabello / corrientes de energía
  | 'geometria' // Geometría Sagrada — símbolos y estructuras
  | 'halo' // Halo Cósmico — el entorno entero (final)

/** Qué acción despierta cada región (1:1 con las regiones). */
export type RevealSource = 'training' | 'protein' | 'water' | 'sleep' | 'mood' | 'consistency'

export type SoulNode = {
  /** Id único y ESTABLE (la persistencia se referencia a esto). */
  id: string
  region: SoulRegionKey
  source: RevealSource
  /** Posición en el arte, 0..1 (origen arriba-izquierda). Del node-map por signo. */
  x: number
  y: number
  /** Orden de encendido dentro de su fuente (menor = primero). */
  order?: number
}

export type SoulRegionDef = {
  key: SoulRegionKey
  /** Nombre visible (español). */
  label: string
  /** Acción que despierta esta región (1:1). */
  source: RevealSource
  /** Significado (voz del coach). */
  meaning: string
  /** Copy de la revelación full-screen al llegar al 100 %. */
  revelation: { title: string; line: string }
}

export type SoulConfig = {
  version: number
  regions: readonly SoulRegionDef[]
  nodes: readonly SoulNode[]
  lines: readonly (readonly [string, string])[]
}

/** Nivel de despertar de una región, derivado de su %. Para la UI
 *  ("Dormido / Despertando / Despierto"), nunca un número crudo solo. */
export type AwakeningLevel = 'asleep' | 'stirring' | 'awakening' | 'awake'

export type RegionProgress = {
  key: SoulRegionKey
  label: string
  source: RevealSource
  meaning: string
  total: number
  revealed: number
  /** 0..100. */
  pct: number
  level: AwakeningLevel
}

export type SoulMilestone = { pct: 25 | 50 | 75 | 100; copy: string }

/** Etapa del despertar TOTAL (los boards: Nacimiento → Despertada). Da nombre y
 *  voz del coach a cada tramo de %, y dispara el momento de revelación al
 *  cruzar de una a la siguiente. `minPct` = umbral inferior inclusivo. */
export type SoulStage = {
  key: string
  /** Nombre de la etapa (español). */
  name: string
  /** Línea del coach de la etapa (Cormorant italic, sin culpa). */
  line: string
  /** % inferior inclusivo donde empieza la etapa. */
  minPct: number
}

export type SoulProgress = {
  total: number
  revealed: number
  /** Alma Celeste % (0..100) — reemplaza a "Emblema 53 %". */
  pct: number
  /** ¿Las 6 regiones al 100 %? → el universo entero despierta (estado final). */
  fullyAwake: boolean
  milestone: SoulMilestone | null
  regions: readonly RegionProgress[]
}
