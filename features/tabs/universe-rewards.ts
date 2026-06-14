/*
 * "Tu universo hoy" — la capa de recompensa visible para los registros
 * que NO encienden estrellas de la constelación (esas son SOLO de
 * "Entrené"). Cuatro atributos del universo personal, cada uno
 * alimentado por un ritual diario distinto:
 *
 *   Energía     ← comida (proteína vs objetivo; el macro más cuidado)
 *   Claridad    ← agua (vasos vs meta diaria)
 *   Estabilidad ← sueño (duración vs 7 h, ver SLEEP_FULL_MIN) + descanso
 *   Brillo      ← check-in de bienestar (energía registrada)
 *
 * PURO y determinístico — la UI anima lo que esto calcula. Manifiesto:
 * los estados nunca son de fallo ("en calma", no "incompleto"); el
 * faltante concreto solo se nombra en `almost`, como invitación, y solo
 * para lo accionable AHORA (proteína, agua — el sueño de anoche ya no
 * se puede "completar", así que no se le pide nada). El faltante de
 * proteína además se calla cuando es grande o es de noche (ver
 * PROTEIN_HINT_*): "42 g a las 22:00" dejaría de ser invitación y
 * empujaría a comer para llenar una barra — el patrón de comida tardía
 * que el propio motor detecta.
 *
 * Revisado por behavioral-specialist + voice-and-copy (jun 2026).
 */

export type UniverseAttributeKey = 'energia' | 'claridad' | 'estabilidad' | 'brillo'

/** Nombre visible de cada atributo — compartido por cards, toast y detalle. */
export const ATTRIBUTE_LABEL: Record<UniverseAttributeKey, string> = {
  energia: 'Energía',
  claridad: 'Claridad',
  estabilidad: 'Estabilidad',
  brillo: 'Brillo',
}

export type UniverseState = 'empty' | 'partial' | 'almost' | 'complete'

export type UniverseAttribute = {
  key: UniverseAttributeKey
  label: string
  /** 0–100, entero. */
  pct: number
  state: UniverseState
  /** La línea bajo la barra — voz cálida, nunca de juicio. */
  microcopy: string
  /** Cómo se LEE el atributo, no solo cómo se calcula:
   *   · 'progress' — esfuerzo gradual y proporcional (proteína, agua,
   *     sueño). El astro orbita y la órbita se va llenando.
   *   · 'gesture'  — un acto, no una barra a llenar (escucharte = el
   *     check-in). Encendido / en calma; sin arco proporcional, para no
   *     ponerlo a competir en la misma métrica que un esfuerzo continuo
   *     (un tap no debe leerse "igual de difícil" que 135 g de proteína). */
  kind: 'progress' | 'gesture'
}

export type UniverseInput = {
  /** Proteína de hoy + objetivo (ctx.today_macros / ctx.targets). */
  proteinG: number
  proteinTarget: number | null
  /** Comidas registradas hoy — fallback cuando no hay objetivo. */
  mealCount: number
  /** Vasos tomados + meta en vasos (250 ml c/u). */
  waterGlasses: number
  waterGoalGlasses: number
  /** Minutos dormidos anoche; null = sin registrar. */
  sleepMinutes: number | null
  /** "Descansé" marcado hoy — mejora Estabilidad ligeramente. */
  restedToday: boolean
  /** Energía del check-in (1–5); null = sin registrar. */
  energy: number | null
  /** ¿Hay CUALQUIER señal de bienestar hoy (mood/motivación/estrés)? */
  hasWellbeingSignal: boolean
  /** Hora local (0–23) — gatea el faltante de proteína de noche. */
  localHour: number
}

/** La noche de referencia para Estabilidad: 7 h. Con 8 h la mayoría
 *  vivía en un "casi" permanente que nunca podía cerrar hoy — tensión
 *  sin resolución que además convertía el sueño en meta (es dimensión).
 *  Dormir más no resta — esto es una capa de recompensa, no un juez. */
const SLEEP_FULL_MIN = 420

/** Lo que "Descansé" aporta a Estabilidad (puntos pct, con tope 100). */
const REST_BONUS_PCT = 10

/** El faltante de proteína solo se nombra si es chico (un snack, no una
 *  comida grande) y todavía es de día. Después de esta hora, o con más
 *  gramos, vale el genérico "Casi se alinea." */
const PROTEIN_HINT_MAX_G = 20
const PROTEIN_HINT_LAST_HOUR = 21

// Sin morfemas de género: el sujeto implícito alterna entre femenino
// (Energía, Claridad, Estabilidad) y masculino (Brillo) — "quieto" o
// "completo" chocaban con tres de los cuatro (voice-and-copy).
// Exportado: la UI lo usa para saber si el microcopy es el genérico
// del estado (y no duplicarlo con el chip de estado de la tarjeta).
export const STATE_COPY: Record<UniverseState, string> = {
  empty: 'Aún está en calma.',
  partial: 'Ya empezó a brillar.',
  almost: 'Casi se alinea.',
  complete: 'Hoy se cerró.',
}

export function stateForPct(pct: number): UniverseState {
  if (pct <= 0) return 'empty'
  if (pct >= 100) return 'complete'
  if (pct >= 70) return 'almost'
  return 'partial'
}

const clampPct = (n: number): number => Math.max(0, Math.min(100, Math.round(n)))

/* ── Energía ← comida ─────────────────────────────────────────────── */
function energia(input: UniverseInput): UniverseAttribute {
  let pct: number
  if (input.proteinTarget && input.proteinTarget > 0) {
    pct = clampPct((input.proteinG / input.proteinTarget) * 100)
    // Comió pero la proteína aún casi no aparece (p. ej. solo carbos):
    // el registro igual mueve el universo. Math.max, no `if pct===0` —
    // 8 g nunca debe mostrar menos barra que 0 g.
    if (input.mealCount > 0) pct = Math.max(pct, 12)
  } else {
    // Sin objetivo de macros: 3 comidas completan el día.
    pct = clampPct((input.mealCount / 3) * 100)
  }
  const state = stateForPct(pct)
  let microcopy = STATE_COPY[state]
  if (state === 'almost' && input.proteinTarget) {
    const missing = Math.max(1, Math.ceil(input.proteinTarget - input.proteinG))
    // Solo si es un cierre chico y de día — un número grande o nocturno
    // sería instrucción de comer, no invitación.
    if (missing <= PROTEIN_HINT_MAX_G && input.localHour < PROTEIN_HINT_LAST_HOUR) {
      microcopy = `${missing} g y tu Energía llega.`
    }
  }
  return { key: 'energia', label: ATTRIBUTE_LABEL.energia, pct, state, microcopy, kind: 'progress' }
}

/* ── Claridad ← agua ──────────────────────────────────────────────── */
function claridad(input: UniverseInput): UniverseAttribute {
  const goal = Math.max(1, input.waterGoalGlasses)
  const pct = clampPct((input.waterGlasses / goal) * 100)
  const state = stateForPct(pct)
  let microcopy = STATE_COPY[state]
  if (state === 'almost') {
    const missing = Math.max(1, goal - input.waterGlasses)
    // "…y llega", no "…y se alinea": el genérico de almost ya dice
    // "se alinea" y repetirlo leía doble (voice-and-copy).
    microcopy = missing === 1 ? 'Un vaso y llega.' : `${missing} vasos y llega.`
  }
  return {
    key: 'claridad',
    label: ATTRIBUTE_LABEL.claridad,
    pct,
    state,
    microcopy,
    kind: 'progress',
  }
}

/* ── Estabilidad ← sueño (+ descanso) ─────────────────────────────── */
function estabilidad(input: UniverseInput): UniverseAttribute {
  let pct = 0
  if (input.sleepMinutes != null) {
    pct = clampPct((input.sleepMinutes / SLEEP_FULL_MIN) * 100)
  }
  // "Descansé" no enciende estrella, pero sí asienta el universo: suma
  // un poco sobre la noche registrada, o deja una primera chispa solo.
  if (input.restedToday) {
    pct = clampPct(pct + REST_BONUS_PCT)
  }
  const state = stateForPct(pct)
  // Sin faltante concreto aquí: la noche de anoche ya pasó — pedirle
  // "duerme 40 min más" no es accionable y leería a reproche.
  return {
    key: 'estabilidad',
    label: ATTRIBUTE_LABEL.estabilidad,
    pct,
    state,
    microcopy: STATE_COPY[state],
    kind: 'progress',
  }
}

/* ── Brillo ← check-in de bienestar ───────────────────────────────── */
function brillo(input: UniverseInput): UniverseAttribute {
  // Registrar la energía completa el Brillo — el atributo premia el
  // gesto de escucharse, no el nivel reportado (energía 1 vale igual
  // que 5: contarlo ES el ritual). Otra señal (ánimo/estrés) deja el
  // atributo en 70 — "casi", un pull suave hacia el check-in de
  // energía, que es la señal que más alimenta el motor de patrones.
  const pct = input.energy != null ? 100 : input.hasWellbeingSignal ? 70 : 0
  const state = stateForPct(pct)
  return {
    key: 'brillo',
    label: ATTRIBUTE_LABEL.brillo,
    pct,
    state,
    microcopy: STATE_COPY[state],
    kind: 'gesture',
  }
}

/** Los cuatro atributos del universo de hoy, en orden de render. */
export function calculateTodayUniverseRewards(input: UniverseInput): UniverseAttribute[] {
  return [energia(input), claridad(input), estabilidad(input), brillo(input)]
}

/* ── Detalle por atributo (tap en el card) ────────────────────────── */

export type UniverseDetailLine = { label: string; value: string }

export type UniverseDetail = {
  /** Qué representa el atributo — una línea en voz del coach. */
  essence: string
  /** Cómo CRECE el atributo — línea instructiva (UI), conecta la acción
   *  con la recompensa. Va al pie del detalle, por debajo de la esencia,
   *  para no chocar el registro poético con el instructivo. */
  grows: string
  /** Las cifras reales de hoy detrás del porcentaje. */
  lines: UniverseDetailLine[]
}

const ESSENCE: Record<UniverseAttributeKey, string> = {
  energia: 'Lo que tu comida le dio a tu día.',
  claridad: 'El agua que acompañó tu día.',
  estabilidad: 'Cómo te sostuvo la noche.',
  brillo: 'El gesto de escucharte.',
}

// "Cómo crece" — la regla mecánica de cada atributo, en voz UI (no coach):
// el puente acción → recompensa que faltaba para que el símbolo se vuelva
// información. Mapeo REAL diario (Energía←comida · Claridad←agua ·
// Estabilidad←sueño de anoche · Brillo←check-in). Sin prescribir ("la
// proteína" se omite para no leer como consejo nutricional).
// Exportado: lo usan tanto la cara del card (subtítulo persistente) como
// el detalle al tocar — una sola fuente para la evidencia.
export const ATTRIBUTE_GROWS: Record<UniverseAttributeKey, string> = {
  energia: 'Crece con cada comida que registras.',
  claridad: 'Crece con el agua que registras.',
  estabilidad: 'Crece con cómo dormiste anoche.',
  brillo: 'Crece cuando registras cómo estás.',
}

const fmtSleep = (min: number): string => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h} h ${m} min` : `${h} h`
}

/**
 * El "de dónde viene" del porcentaje — responde "¿y eso qué significa?"
 * con las cifras reales del día, sin juicio: lo no registrado se nombra
 * como espera ("Te espera", "Aún sin registro"), nunca como fallo.
 */
export function detailForAttribute(
  key: UniverseAttributeKey,
  input: UniverseInput,
): UniverseDetail {
  const essence = ESSENCE[key]
  switch (key) {
    case 'energia': {
      // El hecho primero ("X g hoy"), el objetivo como referencia
      // secundaria — nunca "X de Y", que enmarca déficit / countdown.
      const meals = (n: number) => (n === 1 ? '1 registrada' : `${n} registradas`)
      const lines: UniverseDetailLine[] =
        input.proteinTarget && input.proteinTarget > 0
          ? [
              { label: 'Proteína', value: `${Math.round(input.proteinG)} g hoy` },
              { label: 'Tu objetivo', value: `${Math.round(input.proteinTarget)} g` },
              { label: 'Comidas', value: meals(input.mealCount) },
            ]
          : [{ label: 'Comidas', value: meals(input.mealCount) }]
      return { essence, grows: ATTRIBUTE_GROWS.energia, lines }
    }
    case 'claridad': {
      const goal = Math.max(1, input.waterGoalGlasses)
      return {
        essence,
        grows: ATTRIBUTE_GROWS.claridad,
        lines: [
          { label: 'Vasos', value: `${input.waterGlasses} hoy` },
          { label: 'Tu meta', value: `${goal}` },
        ],
      }
    }
    case 'estabilidad': {
      const lines: UniverseDetailLine[] = [
        {
          label: 'Dormiste',
          value: input.sleepMinutes != null ? fmtSleep(input.sleepMinutes) : 'Aún sin registro',
        },
      ]
      if (input.restedToday) lines.push({ label: 'Descanso', value: 'Hoy ✓' })
      return { essence, grows: ATTRIBUTE_GROWS.estabilidad, lines }
    }
    case 'brillo': {
      const value =
        input.energy != null
          ? 'Hecho ✓'
          : input.hasWellbeingSignal
            ? 'Una señal tuya ✓'
            : 'Te espera'
      return { essence, grows: ATTRIBUTE_GROWS.brillo, lines: [{ label: 'Check-in', value }] }
    }
  }
}
