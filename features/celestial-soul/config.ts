/*
 * Config del Alma Celeste — la ÚNICA fuente de verdad de las 6 regiones, sus
 * nodos y líneas. Las 6 regiones (sistemas que despiertan) son IGUALES para los
 * 12 signos; solo cambian el arte y el node-map por signo. Expandir = editar
 * ESTO, nunca logic.ts ni la UI.
 *
 * ⚠️ COORDS PLACEHOLDER: las (x,y) son una semilla para tener el sistema
 * corriendo. Las reales salen del node-map de cada arte. Un arte (y node-map)
 * por signo → cuando lleguen, se indexan en NODE_MAP_BY_SIGN.
 */

import type { ZodiacSign } from '@/features/tabs/zodiac/types'

import type { RevealSource, SoulConfig, SoulNode, SoulRegionDef } from './types'

/** Hitos de racha (días) que despiertan cada nodo de Órbitas Eternas
 *  (constancia). El nodo k-ésimo se revela al alcanzar CONSISTENCY_MILESTONES[k];
 *  hay tantos hitos como nodos de constancia en el node-map (semilla = 4). */
export const CONSISTENCY_MILESTONES = [3, 7, 14, 21] as const

/** Verbo de cada acción (para copy / controles dev). */
export const SOURCE_ACTION: Record<RevealSource, string> = {
  training: 'Movimiento',
  protein: 'Proteína',
  water: 'Agua',
  sleep: 'Sueño',
  mood: 'Ánimo',
  consistency: 'Constancia',
}

// Las 6 regiones universales. Cada una despierta con UNA fuente (1:1):
//   Núcleo Astral ← ánimo (identidad/presencia)
//   Órbitas Eternas ← constancia (hábito)
//   Constelaciones Ocultas ← agua (conexiones/claridad)
//   Flujo Estelar ← movimiento (impulso)
//   Geometría Sagrada ← proteína (forma/conciencia del cuerpo)
//   Halo Cósmico ← sueño (integración) · es la FINAL
export const SOUL_REGIONS: readonly SoulRegionDef[] = [
  {
    key: 'nucleo',
    label: 'Núcleo Astral',
    source: 'mood',
    meaning: 'Identidad · presencia · energía interior',
    revelation: { title: 'Núcleo Astral Despierto', line: 'Tu centro ya ilumina tu cielo.' },
  },
  {
    key: 'orbitas',
    label: 'Órbitas Eternas',
    source: 'consistency',
    meaning: 'Constancia · hábito',
    revelation: {
      title: 'Órbitas Eternas Despiertas',
      line: 'Lo que repites comienza a sostenerte.',
    },
  },
  {
    key: 'constelaciones',
    label: 'Constelaciones Ocultas',
    source: 'water',
    meaning: 'Las conexiones que descubres',
    revelation: {
      title: 'Constelaciones Ocultas Despiertas',
      line: 'Las conexiones que no veías ya brillan.',
    },
  },
  {
    key: 'flujo',
    label: 'Flujo Estelar',
    source: 'training',
    meaning: 'Impulso',
    revelation: { title: 'Flujo Estelar Despierto', line: 'Tu impulso se volvió corriente.' },
  },
  {
    key: 'geometria',
    label: 'Geometría Sagrada',
    source: 'protein',
    meaning: 'Conciencia',
    revelation: { title: 'Geometría Sagrada Despierta', line: 'Lo que entiendes toma forma.' },
  },
  {
    key: 'halo',
    label: 'Halo Cósmico',
    source: 'sleep',
    meaning: 'Integración',
    revelation: {
      title: 'Halo Cósmico Despierto',
      line: 'Todo lo que eres respira a tu alrededor.',
    },
  },
]

// Node-map SEMILLA por región (source = el de su región). Coords placeholder
// ubicadas por la "Location" del spec (núcleo al centro, órbitas en anillo,
// constelaciones arriba/fondo, flujo en el cabello/lados, geometría abajo,
// halo en el entorno exterior).
const SEED_NODES: readonly SoulNode[] = [
  // Núcleo Astral (ánimo) — centro del pecho
  { id: 'nucleo-1', region: 'nucleo', source: 'mood', x: 0.5, y: 0.47 },
  { id: 'nucleo-2', region: 'nucleo', source: 'mood', x: 0.45, y: 0.51 },
  { id: 'nucleo-3', region: 'nucleo', source: 'mood', x: 0.55, y: 0.51 },
  // Órbitas Eternas (constancia) — anillo alrededor
  { id: 'orbitas-1', region: 'orbitas', source: 'consistency', x: 0.5, y: 0.16 },
  { id: 'orbitas-2', region: 'orbitas', source: 'consistency', x: 0.84, y: 0.5 },
  { id: 'orbitas-3', region: 'orbitas', source: 'consistency', x: 0.5, y: 0.84 },
  { id: 'orbitas-4', region: 'orbitas', source: 'consistency', x: 0.16, y: 0.5 },
  // Constelaciones Ocultas (agua) — cielo de fondo
  { id: 'constel-1', region: 'constelaciones', source: 'water', x: 0.2, y: 0.14 },
  { id: 'constel-2', region: 'constelaciones', source: 'water', x: 0.78, y: 0.18 },
  { id: 'constel-3', region: 'constelaciones', source: 'water', x: 0.64, y: 0.08 },
  // Flujo Estelar (movimiento) — cabello / corrientes
  { id: 'flujo-1', region: 'flujo', source: 'training', x: 0.34, y: 0.34 },
  { id: 'flujo-2', region: 'flujo', source: 'training', x: 0.66, y: 0.34 },
  { id: 'flujo-3', region: 'flujo', source: 'training', x: 0.3, y: 0.6 },
  // Geometría Sagrada (proteína) — símbolos/estructuras
  { id: 'geom-1', region: 'geometria', source: 'protein', x: 0.5, y: 0.72 },
  { id: 'geom-2', region: 'geometria', source: 'protein', x: 0.4, y: 0.8 },
  { id: 'geom-3', region: 'geometria', source: 'protein', x: 0.6, y: 0.8 },
  // Halo Cósmico (sueño) — entorno exterior
  { id: 'halo-1', region: 'halo', source: 'sleep', x: 0.1, y: 0.3 },
  { id: 'halo-2', region: 'halo', source: 'sleep', x: 0.9, y: 0.3 },
  { id: 'halo-3', region: 'halo', source: 'sleep', x: 0.12, y: 0.72 },
  { id: 'halo-4', region: 'halo', source: 'sleep', x: 0.88, y: 0.72 },
]

const SEED_LINES: readonly (readonly [string, string])[] = [
  ['nucleo-2', 'nucleo-1'],
  ['nucleo-1', 'nucleo-3'],
  ['orbitas-1', 'orbitas-2'],
  ['orbitas-2', 'orbitas-3'],
  ['orbitas-3', 'orbitas-4'],
  ['orbitas-4', 'orbitas-1'],
  ['constel-1', 'constel-3'],
  ['constel-3', 'constel-2'],
  ['flujo-1', 'flujo-3'],
  ['flujo-1', 'nucleo-2'],
  ['flujo-2', 'nucleo-3'],
  ['geom-1', 'geom-2'],
  ['geom-1', 'geom-3'],
  ['geom-1', 'nucleo-1'],
  ['halo-1', 'halo-3'],
  ['halo-2', 'halo-4'],
]

// Node-maps REALES por signo (cuando lleguen del arte). Lo que no esté aquí usa
// la semilla. Las 6 regiones y fuentes son COMPARTIDAS; solo cambian nodos/líneas.
const NODE_MAP_BY_SIGN: Partial<
  Record<ZodiacSign, { nodes: readonly SoulNode[]; lines: readonly (readonly [string, string])[] }>
> = {
  // leo: { nodes: [...], lines: [...] },  ← reemplazar con el node-map real
}

/*
 * Node-map del FLUJO ESTELAR por signo = las CORRIENTES (cabello / energía)
 * como POLILÍNEAS (puntos 0..1 sobre el arte). La luz fluye por estas rutas.
 * Trazadas a mano sobre cada arte (empezamos por Leo; el resto hereda DEFAULT
 * hasta trazarlo). Es el node-map visual de la región `flujo`.
 */
export type FlujoPoint = { x: number; y: number }
export type FlujoStream = readonly FlujoPoint[]

// Default — perfil genérico, cabello cayendo por la derecha (sirve de base
// razonable hasta trazar cada signo).
const DEFAULT_FLUJO_STREAMS: readonly FlujoStream[] = [
  [
    { x: 0.52, y: 0.26 },
    { x: 0.6, y: 0.36 },
    { x: 0.65, y: 0.48 },
    { x: 0.65, y: 0.6 },
    { x: 0.6, y: 0.72 },
  ],
  [
    { x: 0.5, y: 0.32 },
    { x: 0.55, y: 0.44 },
    { x: 0.54, y: 0.56 },
    { x: 0.51, y: 0.68 },
  ],
]

// Géminis y Libra comparten el MISMO arte (mujer con búho) → mismas corrientes.
const GEMINIS_STREAMS: readonly FlujoStream[] = [
  // cascada principal (derecha, la gran onda)
  [
    { x: 0.6, y: 0.28 },
    { x: 0.66, y: 0.38 },
    { x: 0.7, y: 0.5 },
    { x: 0.69, y: 0.62 },
    { x: 0.64, y: 0.74 },
    { x: 0.58, y: 0.84 },
  ],
  // hebra interior derecha
  [
    { x: 0.56, y: 0.34 },
    { x: 0.62, y: 0.46 },
    { x: 0.62, y: 0.58 },
    { x: 0.58, y: 0.7 },
  ],
  // mechón frontal (sobre el pecho / cuello)
  [
    { x: 0.46, y: 0.42 },
    { x: 0.46, y: 0.52 },
    { x: 0.49, y: 0.62 },
  ],
]

const FLUJO_STREAMS_BY_SIGN: Partial<Record<ZodiacSign, readonly FlujoStream[]>> = {
  // Leo — perfil a la izquierda; cabello en cascada por la derecha + hebra
  // interior + mechón frontal.
  leo: [
    [
      { x: 0.53, y: 0.24 },
      { x: 0.61, y: 0.33 },
      { x: 0.67, y: 0.45 },
      { x: 0.68, y: 0.57 },
      { x: 0.64, y: 0.69 },
      { x: 0.57, y: 0.8 },
    ],
    [
      { x: 0.5, y: 0.3 },
      { x: 0.55, y: 0.42 },
      { x: 0.55, y: 0.54 },
      { x: 0.52, y: 0.66 },
    ],
    [
      { x: 0.45, y: 0.4 },
      { x: 0.43, y: 0.5 },
      { x: 0.46, y: 0.6 },
      { x: 0.5, y: 0.68 },
    ],
  ],
  // Aries — perfil a la izquierda, cabello recogido (chongo): el flujo vive en
  // un mechón del rostro, una hebra del chongo hacia atrás y la caída del manto.
  aries: [
    [
      { x: 0.46, y: 0.36 },
      { x: 0.43, y: 0.46 },
      { x: 0.44, y: 0.56 },
      { x: 0.47, y: 0.66 },
    ],
    [
      { x: 0.6, y: 0.34 },
      { x: 0.58, y: 0.46 },
      { x: 0.55, y: 0.58 },
      { x: 0.52, y: 0.7 },
    ],
    [
      { x: 0.5, y: 0.54 },
      { x: 0.5, y: 0.68 },
      { x: 0.49, y: 0.8 },
    ],
  ],
  // Tauro — perfil a la izquierda, cuernos; cabello cae por la derecha + hebra
  // interior + mechón frontal.
  tauro: [
    [
      { x: 0.56, y: 0.3 },
      { x: 0.62, y: 0.4 },
      { x: 0.64, y: 0.52 },
      { x: 0.62, y: 0.64 },
      { x: 0.57, y: 0.76 },
    ],
    [
      { x: 0.5, y: 0.34 },
      { x: 0.54, y: 0.46 },
      { x: 0.53, y: 0.58 },
      { x: 0.5, y: 0.7 },
    ],
    [
      { x: 0.44, y: 0.42 },
      { x: 0.43, y: 0.52 },
      { x: 0.46, y: 0.62 },
    ],
  ],
  geminis: GEMINIS_STREAMS,
  libra: GEMINIS_STREAMS,
  // Cáncer — perfil a la izquierda, recogido + marco oval: hebra trasera, mechón
  // del cuello y la caída del vestido.
  cancer: [
    [
      { x: 0.6, y: 0.3 },
      { x: 0.62, y: 0.42 },
      { x: 0.6, y: 0.54 },
      { x: 0.56, y: 0.66 },
    ],
    [
      { x: 0.46, y: 0.36 },
      { x: 0.45, y: 0.46 },
      { x: 0.47, y: 0.56 },
    ],
    [
      { x: 0.52, y: 0.58 },
      { x: 0.52, y: 0.7 },
      { x: 0.5, y: 0.82 },
    ],
  ],
  // Escorpio — perfil a la izquierda, melena lush a AMBOS lados (cascada
  // izquierda frontal + derecha trasera + hebra interior).
  escorpio: [
    [
      { x: 0.42, y: 0.3 },
      { x: 0.34, y: 0.42 },
      { x: 0.3, y: 0.56 },
      { x: 0.32, y: 0.7 },
      { x: 0.38, y: 0.82 },
    ],
    [
      { x: 0.6, y: 0.28 },
      { x: 0.68, y: 0.4 },
      { x: 0.72, y: 0.54 },
      { x: 0.7, y: 0.68 },
      { x: 0.62, y: 0.8 },
    ],
    [
      { x: 0.5, y: 0.36 },
      { x: 0.52, y: 0.5 },
      { x: 0.5, y: 0.64 },
      { x: 0.46, y: 0.76 },
    ],
  ],
  // Capricornio — perfil a la izquierda, cabello por ambos lados (montañas
  // detrás): cascada izquierda + derecha + hebra interior.
  capricornio: [
    [
      { x: 0.44, y: 0.3 },
      { x: 0.4, y: 0.42 },
      { x: 0.4, y: 0.56 },
      { x: 0.43, y: 0.7 },
    ],
    [
      { x: 0.6, y: 0.3 },
      { x: 0.65, y: 0.42 },
      { x: 0.65, y: 0.56 },
      { x: 0.61, y: 0.7 },
    ],
    [
      { x: 0.52, y: 0.36 },
      { x: 0.54, y: 0.48 },
      { x: 0.52, y: 0.62 },
    ],
  ],
  // Piscis — perfil a la izquierda, recogido parcial + agua en la base: hebra
  // trasera, mechón frontal y una corriente de agua al pie.
  piscis: [
    [
      { x: 0.6, y: 0.3 },
      { x: 0.63, y: 0.42 },
      { x: 0.62, y: 0.54 },
      { x: 0.58, y: 0.66 },
    ],
    [
      { x: 0.45, y: 0.34 },
      { x: 0.43, y: 0.44 },
      { x: 0.45, y: 0.54 },
    ],
    [
      { x: 0.4, y: 0.78 },
      { x: 0.5, y: 0.8 },
      { x: 0.6, y: 0.78 },
    ],
  ],
}

/** Corrientes del Flujo Estelar de un signo (su node-map, o el default). */
export function flujoStreamsForSign(sign: ZodiacSign): readonly FlujoStream[] {
  return FLUJO_STREAMS_BY_SIGN[sign] ?? DEFAULT_FLUJO_STREAMS
}

/** Config del Alma Celeste de un signo (regiones comunes, node-map por signo). */
export function soulConfigForSign(sign: ZodiacSign): SoulConfig {
  const map = NODE_MAP_BY_SIGN[sign]
  return {
    version: 1,
    regions: SOUL_REGIONS,
    nodes: map?.nodes ?? SEED_NODES,
    lines: map?.lines ?? SEED_LINES,
  }
}
