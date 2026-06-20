/*
 * Detección de líquidos en una comida → aporte estimado a la hidratación.
 *
 * PURO y determinístico (sin IA, sin side effects): recibe el nombre de la
 * comida + sus ingredientes y devuelve qué bebidas/alimentos líquidos
 * reconoció y cuántos vasos podrían aportar. La UI (LiquidDetectionSheet)
 * SUGIERE el aporte; nunca se suma sin confirmación.
 *
 * Reglas de aporte (factor de hidratación por tipo de líquido):
 *   100 % → agua, agua mineral, té/infusiones sin azúcar, agua con limón
 *    75 % → jugo verde, agua fresca ligera, electrolitos sin azúcar
 *    50 % → licuado, smoothie, café, leche, caldo, sopa, jugo de fruta,
 *           refresco zero/light/sin azúcar (casi pura agua, sin azúcar)
 *     0 % → alcohol, refresco normal, malteada, bebidas azucaradas (se VETAN)
 *
 * Un vaso = 250 ml (GLASS_ML). Cuando el ingrediente trae gramos (≈ ml de
 * un líquido) estimamos vasos = gramos / 250; si solo hay nombre, asumimos
 * una ración (1 vaso). El factor escala el aporte y redondeamos a 0.25.
 *
 * Capa 3 (código): nombres técnicos OK. Nada de esto sale al usuario salvo
 * las labels, que son el texto que la propia usuaria escribió/escaneó.
 */

// Un vaso = 250 ml. Espejo de GLASS_ML en useWaterGoal.ts; se inlinea aquí
// para mantener este módulo PURO (useWaterGoal importa AsyncStorage, un
// módulo nativo que rompería los tests de lógica).
const GLASS_ML = 250

export type HydrationFactor = 1 | 0.75 | 0.5

export type DetectedLiquid = {
  /** id estable para listas/edición (índice de detección). */
  id: string
  /** Lo que la usuaria ve — el nombre del líquido tal cual lo registró. */
  label: string
  /** Proporción que cuenta como hidratación (1 / 0.75 / 0.5). */
  factor: HydrationFactor
  /** Vasos estimados que aporta (múltiplos de 0.25, ya con el factor). */
  glasses: number
  /** 'low' para líquidos ambiguos (licuado/caldo/sopa…) → pide confirmar. */
  confidence: 'high' | 'low'
}

export type LiquidDetection = {
  items: DetectedLiquid[]
  /** Suma de los aportes (vasos, redondeada a 0.25). */
  totalGlasses: number
  /** 'low' si TODO lo detectado es ambiguo → header "Detecté posibles…". */
  confidence: 'high' | 'low'
}

type Ingredient = { name: string; grams?: number }

/** Máximo de vasos que UNA comida puede aportar (espejo del CHECK de
 *  meal_hydration: 8 vasos = 2 L). */
const MAX_GLASSES = 8
const QUARTER = 0.25

/* ── Tablas de keywords (normalizadas: minúsculas, sin acentos) ──────── */

// VETO: si el texto contiene cualquiera de estos, no aporta hidratación.
// Nota: usamos adjetivos/frases ('azucarada', 'con azucar') — NUNCA 'azucar'
// a secas, que vetaría por error "te sin azucar".
const VETO = [
  'alcohol',
  'cerveza',
  'vino',
  'tequila',
  'mezcal',
  'whisky',
  'vodka',
  'ron',
  'michelada',
  'refresco',
  'soda',
  'coca cola',
  'coca',
  'pepsi',
  'malteada',
  'milkshake',
  'frappe',
  'energizante',
  'azucarada',
  'azucarado',
  'con azucar',
]

// Refrescos: vetados (0%) si son normales, PERO los zero/light/sin azúcar son
// casi pura agua sin azúcar → cuentan 50%. Detectamos un indicador de refresco
// + un modificador "sin azúcar" para hacer la excepción ANTES del veto.
const SODA = ['refresco', 'soda', 'coca', 'pepsi', 'sprite', 'fanta']
const DIET_MODIFIER = ['zero', 'light', 'diet', 'dieta', 'sin azucar', 'sin calorias']

// Líquidos que SÍ cuentan, con su factor. El orden no importa aquí: el
// match elige la keyword MÁS LARGA que aparezca (más específica gana, p.ej.
// "agua fresca" 0.75 antes que "agua" 1.0).
const POSITIVE: { keyword: string; factor: HydrationFactor }[] = [
  // 100 %
  { keyword: 'agua mineral', factor: 1 },
  { keyword: 'agua con limon', factor: 1 },
  { keyword: 'agua', factor: 1 },
  { keyword: 'te verde', factor: 1 },
  { keyword: 'te negro', factor: 1 },
  { keyword: 'te', factor: 1 },
  { keyword: 'infusion', factor: 1 },
  { keyword: 'infusiones', factor: 1 },
  { keyword: 'manzanilla', factor: 1 },
  // 75 %
  { keyword: 'jugo verde', factor: 0.75 },
  { keyword: 'agua fresca', factor: 0.75 },
  { keyword: 'electrolitos', factor: 0.75 },
  { keyword: 'suero', factor: 0.75 },
  // 50 %
  { keyword: 'licuado', factor: 0.5 },
  { keyword: 'smoothie', factor: 0.5 },
  { keyword: 'cafe', factor: 0.5 },
  { keyword: 'capuchino', factor: 0.5 },
  { keyword: 'latte', factor: 0.5 },
  { keyword: 'leche', factor: 0.5 },
  { keyword: 'caldo', factor: 0.5 },
  { keyword: 'sopa', factor: 0.5 },
  { keyword: 'atole', factor: 0.5 },
  // Jugos de fruta (naranja, manzana, etc.): tienen agua + azúcar natural.
  // 'jugo verde' (0.75) gana por ser más específico (keyword más larga).
  // Los azucarados industriales/refrescos siguen vetados (VETO arriba).
  { keyword: 'jugo', factor: 0.5 },
]

// Ordenadas por longitud desc UNA vez — la específica gana sobre la genérica.
const POSITIVE_BY_LEN = [...POSITIVE].sort((a, b) => b.keyword.length - a.keyword.length)

/** minúsculas + sin acentos + solo [a-z0-9] separados por espacios simples. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** ¿La keyword aparece como palabra/frase completa en el texto normalizado?
 *  Padding con espacios → boundary sin regex (evita que "te" matchee "filete"). */
function hasWord(norm: string, keyword: string): boolean {
  return ` ${norm} `.includes(` ${keyword} `)
}

const roundQuarter = (n: number): number => Math.round(n / QUARTER) * QUARTER

/**
 * El factor de hidratación de UN texto suelto (nombre o ingrediente), o null
 * si no es líquido (o está vetado). Público para que el flujo de comida pueda
 * decidir si un registro es "agua pura" mirando SOLO el nombre (factor === 1)
 * y no confundir un caldo/sopa/jugo con agua.
 */
export function liquidFactor(text: string): HydrationFactor | null {
  return classify(text)
}

/** El factor del texto, o null si no es líquido (o está vetado). */
function classify(text: string): HydrationFactor | null {
  const norm = normalize(text)
  if (!norm) return null
  // Refresco zero/light/sin azúcar → 50% (excepción antes del veto). Un
  // refresco normal (sin modificador) cae al veto de abajo.
  if (SODA.some((s) => hasWord(norm, s)) && DIET_MODIFIER.some((m) => hasWord(norm, m))) return 0.5
  if (VETO.some((k) => hasWord(norm, k))) return null
  for (const { keyword, factor } of POSITIVE_BY_LEN) {
    if (hasWord(norm, keyword)) return factor
  }
  return null
}

/** Primera letra en mayúscula, respeta el resto. */
function titleize(s: string): string {
  const t = s.trim()
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/**
 * Detecta líquidos en una comida y estima su aporte de hidratación.
 *
 * Combina dos señales: los INGREDIENTES (con gramos → estimación precisa)
 * y el NOMBRE del platillo (sin gramos → una ración). Deduplica por tipo de
 * líquido (mismo factor de origen) para no contar "jugo verde" dos veces si
 * aparece en el nombre y en un ingrediente; conserva el mayor aporte.
 */
export function detectLiquids(input: {
  name: string
  ingredients?: Ingredient[]
}): LiquidDetection {
  const ingredients = input.ingredients ?? []
  // keyword canónica → mejor candidato (mayor aporte) de cualquier origen.
  const byKeyword = new Map<string, { label: string; factor: HydrationFactor; glasses: number }>()

  const consider = (label: string, factor: HydrationFactor, rawGlasses: number) => {
    const glasses = Math.min(MAX_GLASSES, roundQuarter(rawGlasses * factor))
    if (glasses < QUARTER) return
    // Clave por (factor + primer término del label) para fusionar el mismo
    // líquido visto en nombre e ingrediente, sin colapsar líquidos distintos.
    const key = `${factor}:${normalize(label).split(' ')[0]}`
    const prev = byKeyword.get(key)
    if (!prev || glasses > prev.glasses) byKeyword.set(key, { label, factor, glasses })
  }

  // Ingredientes: gramos ≈ ml para un líquido → vasos = gramos / 250.
  for (const ing of ingredients) {
    const factor = classify(ing.name)
    if (factor == null) continue
    const grams = typeof ing.grams === 'number' && ing.grams > 0 ? ing.grams : GLASS_ML
    consider(titleize(ing.name), factor, grams / GLASS_ML)
  }

  // Nombre del platillo: sin gramos → asumimos una ración (1 vaso).
  const nameFactor = classify(input.name)
  if (nameFactor != null) consider(titleize(input.name), nameFactor, 1)

  const items: DetectedLiquid[] = [...byKeyword.values()]
    .sort((a, b) => b.glasses - a.glasses)
    .map((c, i) => ({
      id: `liq-${i}`,
      label: c.label,
      factor: c.factor,
      glasses: c.glasses,
      // Los 50 % (licuado/café/leche/caldo/sopa) son ambiguos: pueden ser
      // sobre todo sólidos → pedimos confirmación suave.
      confidence: c.factor === 0.5 ? 'low' : 'high',
    }))

  const totalGlasses = Math.min(MAX_GLASSES, roundQuarter(items.reduce((s, i) => s + i.glasses, 0)))
  const confidence: 'high' | 'low' =
    items.length > 0 && items.every((i) => i.confidence === 'low') ? 'low' : 'high'

  return { items, totalGlasses, confidence }
}

/** Vasos sin ceros sobrantes: 3 → "3", 0.5 → "0.5", 0.75 → "0.75". */
export function formatGlasses(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

/** "vaso" / "vasos" según la cantidad (0.5 → vasos, 1 → vaso). */
export function glassesWord(n: number): string {
  return n === 1 ? 'vaso' : 'vasos'
}
