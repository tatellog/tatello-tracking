/*
 * TDEE ADAPTATIVO (M2 · plan Parte 4) — el invisible #1 hecho visible.
 *
 * En vez de confiar en la fórmula poblacional (Mifflin-St Jeor,
 * calcMacros.ts, que típicamente falla ±200-500 kcal por persona), el
 * gasto real se DESPEJA de los propios datos por balance energético:
 *
 *   TDEE real = kcal promedio comidas + (kg perdidos × 7700 / días)
 *
 * Robusto por diseño al estilo de registro de la usuaria: un sesgo
 * CONSISTENTE (siempre subestima ~15%) se absorbe en la calibración — su
 * déficit calculado contra este número sigue siendo correcto en la
 * práctica. Lo que sí lo rompe son los días faltantes; por eso los
 * mínimos de datos son guardas duras, no sugerencias.
 *
 * Guardas de manifiesto:
 *   · Bajo los mínimos → null (jamás un número inventado).
 *   · El resultado es una OBSERVACIÓN ("tu cuerpo gasta ~1,900 según tus
 *     últimas 4 semanas"), nunca una sentencia ni una meta automática:
 *     la meta la sigue eligiendo ella (macro-targets respeta
 *     MIN_CALORIES aparte).
 *   · Pura y testeable: sin side effects, corre en app y en server.
 */

import type { DailySignals } from './types.ts'

/** ~kcal por kg de tejido corporal (constante estándar de balance). */
const KCAL_PER_KG = 7700

/** Ventana de estimación: las últimas 4 semanas cerradas. */
const WINDOW_DAYS = 28
/** Días con registro creíble requeridos dentro de la ventana. */
const MIN_DATA_DAYS = 14
/** Umbral de "día creíble": menos que esto lee a registro incompleto
 *  (un yogurt suelto), y un día a medias envenena el promedio. */
const MIN_DAY_KCAL = 800
/** Ancho del racimo de pesajes en cada extremo de la ventana. */
const WEIGH_CLUSTER_DAYS = 10
/** Separación mínima entre los centros de ambos racimos. */
const MIN_SPAN_DAYS = 14
/** Resultado fuera de este rango = datos rotos, no un metabolismo. */
const TDEE_FLOOR = 1200
const TDEE_CEIL = 4500

export type AdaptiveTdee = {
  /** Gasto diario estimado, redondeado a 10 kcal. */
  tdee: number
  /** Promedio de kcal de los días creíbles de la ventana. */
  kcalAvg: number
  /** Cambio de peso suavizado entre ambos extremos (negativo = bajó). */
  deltaKg: number
  /** Días reales entre los centros de los dos racimos de pesajes. */
  spanDays: number
  /** Días con registro creíble que alimentaron el promedio. */
  dataDays: number
  /** 'solida' con ≥21 días creíbles y sin clamps; si no, 'temprana'. */
  quality: 'solida' | 'temprana'
}

function isoDaysAgo(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d - n, 12)
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${dd}`
}

/** Días de diferencia a >= b en ISO locales (aprox por Date a mediodía). */
function diffDays(aIso: string, bIso: string): number {
  const [ay, am, ad] = aIso.split('-').map(Number) as [number, number, number]
  const [by, bm, bd] = bIso.split('-').map(Number) as [number, number, number]
  const a = new Date(ay, am - 1, ad, 12).getTime()
  const b = new Date(by, bm - 1, bd, 12).getTime()
  return Math.round((a - b) / 86_400_000)
}

type WeighPoint = { day: string; kg: number }

/** Media del racimo de pesajes dentro de [fromIso, toIso] (inclusive) +
 *  el centro temporal del racimo. null sin pesajes ahí. */
function cluster(
  points: WeighPoint[],
  fromIso: string,
  toIso: string,
): { kg: number; centerOffsetFrom: (iso: string) => number; centerDay: string } | null {
  const inRange = points.filter((p) => p.day >= fromIso && p.day <= toIso)
  if (inRange.length === 0) return null
  const kg = inRange.reduce((s, p) => s + p.kg, 0) / inRange.length
  // Centro temporal = el día "promedio" del racimo (para el span real).
  const sorted = [...inRange].sort((a, b) => (a.day < b.day ? -1 : 1))
  const mid = sorted[Math.floor(sorted.length / 2)]!
  return { kg, centerDay: mid.day, centerOffsetFrom: (iso: string) => diffDays(mid.day, iso) }
}

/**
 * Estima el gasto real desde daily_signals (calorías + pesajes).
 * `todayIso` = hoy local; la ventana son los 28 días CERRADOS anteriores
 * (hoy no cuenta: sus comidas siguen sumando).
 */
export function adaptiveTdee(signals: DailySignals[], todayIso: string): AdaptiveTdee | null {
  const end = isoDaysAgo(todayIso, 1)
  const start = isoDaysAgo(todayIso, WINDOW_DAYS)

  const inWindow = signals.filter((s) => s.day != null && s.day >= start && s.day <= end)

  // Días creíbles de comida.
  const foodDays = inWindow.filter((s) => (s.calories ?? 0) >= MIN_DAY_KCAL)
  if (foodDays.length < MIN_DATA_DAYS) return null
  const kcalAvg = foodDays.reduce((sum, s) => sum + (s.calories ?? 0), 0) / foodDays.length

  // Racimos de pesajes en ambos extremos de la ventana.
  const weighs: WeighPoint[] = inWindow
    .filter((s): s is DailySignals & { day: string } => s.day != null && s.weight_kg != null)
    .map((s) => ({ day: s.day, kg: s.weight_kg as number }))
  const startCluster = cluster(
    weighs,
    start,
    isoDaysAgo(todayIso, WINDOW_DAYS - WEIGH_CLUSTER_DAYS + 1),
  )
  const endCluster = cluster(weighs, isoDaysAgo(todayIso, WEIGH_CLUSTER_DAYS), end)
  if (!startCluster || !endCluster) return null

  const spanDays = diffDays(endCluster.centerDay, startCluster.centerDay)
  if (spanDays < MIN_SPAN_DAYS) return null

  const deltaKg = endCluster.kg - startCluster.kg

  // Balance: bajar de peso (delta negativo) = gastó MÁS de lo que comió.
  const raw = kcalAvg - (deltaKg * KCAL_PER_KG) / spanDays
  const clamped = Math.min(TDEE_CEIL, Math.max(TDEE_FLOOR, raw))

  return {
    tdee: Math.round(clamped / 10) * 10,
    kcalAvg: Math.round(kcalAvg),
    deltaKg: Math.round(deltaKg * 100) / 100,
    spanDays,
    dataDays: foodDays.length,
    quality: foodDays.length >= 21 && clamped === raw ? 'solida' : 'temprana',
  }
}
