/*
 * Polvo de estrellas (dueña 5 oct 2026) — lógica PURA.
 *
 * Cada comida registrada manda unas estrellas finas desde la tarjeta de
 * comidas al emblema: entran, flotan adentro con su bruma, el centro las va
 * jalando y al final se las chupa en cascada. El emblema guarda un BRILLO
 * INTERNO que crece rumbo al siguiente hallazgo de Descubre (sus etapas por
 * días con datos: 3, 8, 21, 60, 180). Al cruzar una etapa, Stelar avisa que
 * encontró algo.
 *
 * Honesto con el spec de Descubre: el avance se mide en DÍAS con datos (no
 * por comida) y nunca se muestra como número ni cuenta regresiva: solo luz.
 */
import { dataMaturity, type MaturityStage } from '@/features/orbit/maturity'
import type { DailySignals } from '@/features/orbit/api'

/** Umbrales de etapa de Descubre (días con datos útiles). */
export const STAGE_THRESHOLDS = [3, 8, 21, 60, 180] as const

export type DiscoveryProgress = {
  stage: MaturityStage
  /** 0..1 hacia la siguiente etapa (1 en la última). */
  fill: number
}

/** Qué tan cerca está Descubre de su siguiente etapa, de las señales. */
export function discoveryProgress(signals: readonly DailySignals[]): DiscoveryProgress {
  const m = dataMaturity(signals)
  const d = Math.max(m.days.food, m.days.sleep, m.days.movement)
  let lo = 0
  for (const hi of STAGE_THRESHOLDS) {
    if (d < hi) return { stage: m.stage, fill: (d - lo) / (hi - lo) }
    lo = hi
  }
  return { stage: m.stage, fill: 1 }
}

/** Opacidad del brillo interno del emblema: siempre un fondo tenue, nunca
 *  apagado (no es deuda), y crece con el avance. */
export function innerGlowLevel(fill: number): number {
  return 0.12 + Math.max(0, Math.min(1, fill)) * 0.6
}

/* ── La coreografía ─────────────────────────────────────────────────── */

export const STARDUST_COUNT = 14
/** Cuánto tarda cada estrella en succionarse al final (s). */
export const SUCK_S = 0.72

export type StardustGeo = {
  /** Origen (la tarjeta de comidas), en ventana. */
  ox: number
  oy: number
  /** Centro y radio del emblema, en ventana. */
  cx: number
  cy: number
  r: number
}

/** Una estrella, en arreglos planos (los worklets solo capturan primitivos). */
export type Stardust = {
  /** Curva de vuelo (bezier cúbica): p0 → p1 → p2 → p3. */
  p0x: number[]
  p0y: number[]
  p1x: number[]
  p1y: number[]
  p2x: number[]
  p2y: number[]
  p3x: number[]
  p3y: number[]
  delay: number[]
  flight: number[]
  /** Segundo (absoluto) en que empieza su succión. */
  suckAt: number[]
  driftAmp: number[]
  driftSpeed: number[]
  driftPhase: number[]
  twinkle: number[]
  size: number[]
  /** 0 oro · 1 champaña · 2 crema · 3 destello (punto). */
  tone: number[]
  /** Fin de la coreografía (s). */
  total: number
}

function rng(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/**
 * Las estrellas: suben en abanico desde la tarjeta por curvas suaves, entran
 * cruzando el borde y se posan DENTRO del emblema con reparto áureo (parejo,
 * sin anillo). Flotan ~4 s y el centro se las chupa en cascada.
 */
export function buildStardust(seed: number, g: StardustGeo, n = STARDUST_COUNT): Stardust {
  const r = rng(seed)
  const out: Stardust = {
    p0x: [],
    p0y: [],
    p1x: [],
    p1y: [],
    p2x: [],
    p2y: [],
    p3x: [],
    p3y: [],
    delay: [],
    flight: [],
    suckAt: [],
    driftAmp: [],
    driftSpeed: [],
    driftPhase: [],
    twinkle: [],
    size: [],
    tone: [],
    total: 0,
  }
  const rot = r() * Math.PI * 2
  const inner = g.r * 0.8 // el arte vive dentro del anillo
  let total = 0
  for (let i = 0; i < n; i++) {
    const side = n > 1 ? i / (n - 1) - 0.5 : 0
    const slot = rot + i * 2.39996 // ángulo áureo
    const rad = inner * (0.22 + 0.72 * Math.sqrt((i + 0.5) / n))
    const ex = g.cx + Math.cos(slot) * rad
    const ey = g.cy + Math.sin(slot) * rad
    const rise = Math.max(140, (g.oy - g.cy) * 0.55)
    out.p0x.push(g.ox + side * 40)
    out.p0y.push(g.oy)
    out.p1x.push(g.ox + side * 160)
    out.p1y.push(g.oy - rise - Math.abs(side) * 60)
    out.p2x.push(g.cx + Math.cos(slot) * g.r * 1.45)
    out.p2y.push(g.cy + Math.sin(slot) * g.r * 1.45)
    out.p3x.push(ex)
    out.p3y.push(ey)
    const delay = i * 0.035 + r() * 0.04
    const flight = 1.05 + r() * 0.25
    out.delay.push(delay)
    out.flight.push(flight)
    // Flotan ~4 s; las de afuera un poco más y en orden → la succión se lee
    // como una cascada, una tras otra, en poco más de un segundo.
    const suckAt = delay + flight + 3.6 + (rad / inner) * 0.9 + i * 0.09
    out.suckAt.push(suckAt)
    total = Math.max(total, suckAt + SUCK_S)
    out.driftAmp.push(3 + r() * 4)
    out.driftSpeed.push(0.18 + r() * 0.22)
    out.driftPhase.push(r() * Math.PI * 2)
    out.twinkle.push(1.2 + r() * 1.6)
    const spark = i % 3 === 2
    out.size.push(spark ? 1.3 : 2.1 + (i % 4) * 0.3)
    out.tone.push(spark ? 3 : i % 3)
  }
  out.total = total + 1.6 // + la respiración final del emblema
  return out
}

/** ease-in-out cúbico (worklet: lo usa la capa Skia en el hilo de UI). */
export function easeInOut(t: number): number {
  'worklet'
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Posición de la estrella `i` en el segundo `T`; null si aún no sale o ya
 *  entró. `phase` 0 vuelo · 1 flota · 2 succión. */
export function stardustAt(
  s: Stardust,
  g: StardustGeo,
  i: number,
  T: number,
): { x: number; y: number; phase: number; k: number } | null {
  'worklet'
  const tau = T - s.delay[i]!
  if (tau < 0) return null
  const fl = s.flight[i]!
  if (tau < fl) {
    const e = easeInOut(tau / fl)
    const u = 1 - e
    const x =
      u * u * u * s.p0x[i]! +
      3 * u * u * e * s.p1x[i]! +
      3 * u * e * e * s.p2x[i]! +
      e * e * e * s.p3x[i]!
    const y =
      u * u * u * s.p0y[i]! +
      3 * u * u * e * s.p1y[i]! +
      3 * u * e * e * s.p2y[i]! +
      e * e * e * s.p3y[i]!
    return { x, y, phase: 0, k: tau / fl }
  }
  const holdStart = s.delay[i]! + fl
  const holdLen = s.suckAt[i]! - holdStart
  const hold = (tt: number) => {
    'worklet'
    const t = Math.min(tt, holdLen)
    // Mientras flota, el centro ya la va jalando, muy despacio.
    const pull = 1 - 0.35 * Math.min(1, t / holdLen)
    const bx = g.cx + (s.p3x[i]! - g.cx) * pull
    const by = g.cy + (s.p3y[i]! - g.cy) * pull
    const ph = s.driftPhase[i]! + t * s.driftSpeed[i]!
    const a = s.driftAmp[i]!
    return {
      x: bx + Math.sin(ph) * a + Math.sin(ph * 0.37 + 1.3) * a * 0.6,
      y: by + Math.cos(ph * 0.71) * a * 0.8 + Math.sin(ph * 0.23) * a * 0.5,
    }
  }
  if (T < s.suckAt[i]!) {
    const p = hold(T - holdStart)
    return { x: p.x, y: p.y, phase: 1, k: 0 }
  }
  const u = (T - s.suckAt[i]!) / SUCK_S
  if (u >= 1) return null
  // La succión: arranca lento y ACELERA (gravedad), en espiral hacia el centro.
  const e = u * u * u
  const start = hold(holdLen)
  const ang = Math.atan2(start.y - g.cy, start.x - g.cx) + e * 1.6
  const r0 = Math.hypot(start.x - g.cx, start.y - g.cy)
  const rr = r0 * (1 - e)
  return { x: g.cx + Math.cos(ang) * rr, y: g.cy + Math.sin(ang) * rr, phase: 2, k: u }
}
