import { useEffect, useMemo, useState } from 'react'
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg'
import { BlurView } from 'expo-blur'
import { useIsFocused } from '@react-navigation/native'

import { colors, typography } from '@/theme'

import { useScreenActive } from '@/features/orbit/useScreenActive'
import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry'
import { useTransformProgress, useTransformProgressAsOf, withSign } from '@/features/emblem'
import { useProfile } from '@/features/profile/hooks'
import { emitReplayReveal, useRevelationHistory } from '@/features/revelations'
import { RevealedEmblem } from '@/features/tabs/components/constellation/RevealedEmblem'
import { signName, zodiacFromDate } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { useMacroTargets } from '@/features/macros/hooks'
import { GLASS_ML, useWaterGoal } from '@/features/water/useWaterGoal'
import { todayInTimezone } from '@/lib/time'

import { useHasAnySignals, useSignalsHistory } from '../hooks'
import {
  comboPhrase,
  comboReveal,
  correlationForKind,
  daysInDeficit,
  deficitTrajectoryRead,
  detectMonthPatterns,
  monthCalendar,
  monthChange,
  monthReveals,
  presenceSummary,
  revealDayMap,
  weeklyComboLever,
  winningCombo,
  type ComboReveal,
  type EvidenceBar,
  type MonthPattern,
  type MonthReveals,
  type WeekdayShape,
  type WinningCombo as WinningComboData,
} from '../month-built'
import { isDeficitDay } from '../deficit'
import { weeklyMovementLever } from '../week-orbit-logic'
import { EmptySegmentCard } from './EmptySegmentCard'
import { MonthGlanceCalendar } from './MonthGlanceCalendar'
import { PatternDiscovery } from './PatternDiscovery'
import { PatternRevealModal } from './PatternRevealModal'
import { PresenceFinale } from './PresenceFinale'
import { DiscoveryStar } from './month-glyphs'

/* El detalle de un patrón (modal de evidencia) acepta tanto los patrones del
 * motor (`MonthPattern`) como la combinación ganadora, adaptada a esta forma. */
type EvidenceItem = {
  title: string
  evidence: { bars: EvidenceBar[]; caption: string; unit: string }
  /** Las fechas concretas que anclan el conteo ("¿de dónde salen las N?"). */
  dates?: string[]
  why?: string
  /** Solo deficit-daytype: la forma por día de semana (picos/valles). */
  weekdayShape?: WeekdayShape
}

/*
 * El segmento Mes — "¿En qué me estoy transformando?". Ver
 * docs/orbita-mes-spec.md (fuente de verdad).
 *
 * No es un dashboard: es donde la usuaria descubre en quién se está
 * convirtiendo por lo que repite. Sin IA, todo nace de contar lo registrado
 * (ver month-built.ts). Se separan dos sistemas: TRANSFORMACIÓN (déficit,
 * proteína, movimiento, sueño, agua) y PRESENCIA (abrir/registrar/volver). El
 * orden de la pantalla:
 *   1 · Hero — la pregunta + la constelación del signo revelándose (% revelado).
 *   2 · Tu mes de un vistazo — el calendario de déficit del mes en curso.
 *   3 · Haz visible lo invisible — descubrimientos demostrables, con evidencia.
 *   4 · No sabías que... — hallazgos de astrónomo (correlaciones + evidencia).
 *   5 · La combinación que más funcionó — la fórmula de hábitos que mejor terminó.
 *   6 · Lo que aún no sabemos — dimensiones sin evidencia suficiente.
 *   7 · Así cambió tu mes — Semana 1 vs Semana 4 en cápsulas + resumen.
 *   8 · Tu presencia — la última sección: el final del viaje (presencia +
 *       estrella con halo rosado + frase de cierre, en una sola tarjeta).
 */
const HERO_SIZE = Math.round(Math.min(Dimensions.get('window').width * 0.84, 360))

// Color por hábito para los puntos y barras de evidencia — cada uno reconocible
// por su tono de dimensión (igual que los chips de Día), no todo en oro plano.
const BAR_COLOR: Record<string, string> = {
  comida: colors.dimension.alimento,
  cuerpo: colors.dimension.cuerpo,
  sueno: colors.dimension.sueno,
  ciclo: colors.dimension.ciclo,
  agua: colors.signal.agua,
  proteina: colors.signal.proteina,
}

// El color de la estrella de un reveal = su dimensión. 'deficit' NO está en el
// mapa a propósito → cae a oro: el déficit es el norte de la app, su estrella
// brilla en oro, no en un color de dimensión.
const revealColor = (colorKey: string): string => BAR_COLOR[colorKey] ?? colors.oro

// Umbral para "encendida" — espejo de REVEAL_MIN en month-built.ts.
const REVEAL_THRESHOLD = 8

// Fase 8 · bajo este % el número héroe del emblema se lee como montaña
// ("1% revelado" en día 2 = anti-pago); hasta cruzarlo, el hero habla en
// cualitativo y explica el mecanismo. El % vuelve cuando cuenta historia.
const EMBLEM_PCT_THRESHOLD = 8

/* El detalle al tocar una fila de "Lo que sostuviste este mes". */
type RevealDetail = {
  key: string
  label: string
  colorKey: string
  revealed: boolean
  count: number
  threshold: number
  days: string[]
  /** Solo déficit: promedio kcal por debajo de la meta EN los días de déficit
   *  (la "conclusión" que la usuaria pedía como total, sin ser una suma). */
  avgOnDeficitDays?: number | null
  /** Solo déficit: dirección dentro del mes (inicio vs final) — el "¿voy bien?"
   *  como comparación contigo misma, no como % que reprueba. */
  direction?: string | null
  /** Solo déficit: días en déficit de cada una de las 4 semanas del mes, para
   *  dibujar las barras + la hairline de TU promedio (Apple Trends, self-only). */
  weeklyDeficit?: number[] | null
}

/** Qué CUENTA como cada dimensión (criterio transparente, sin jerga). */
const REVEAL_CRITERION: Record<string, string> = {
  deficit: 'Un día cuenta cuando tu comida estuvo dentro de tu objetivo, sin bajar de más.',
  sueno: 'Una noche cuenta cuando dormiste alrededor de 7 horas.',
  registro: 'Un día cuenta cuando registraste tu comida.',
  proteina: 'Un día cuenta cuando alcanzaste tu meta de proteína.',
  agua: 'Un día cuenta cuando llegaste a tu meta de agua.',
  movimiento: 'Un día cuenta cuando entrenaste.',
}
/** El ROL de cada dimensión (por qué importa) — observacional, sin recetar y SIN
 *  jerga ("palanca"/"ancla" ya se retiraron por confusas). Distinto por dimensión
 *  (nada de molde repetido) Y por ESTADO: `on` (encendida) habla en pasado del
 *  logro; `off` (pendiente) SOLO anticipa — nunca elogia en pasado algo que no
 *  encendió (esa era la mentira de Agua). Copy provisional → pasar por voice-and-copy. */
const REVEAL_ROLE: Record<string, { on: string; off: string }> = {
  deficit: {
    on: 'El déficit es lo que más te acerca a bajar de peso.',
    off: 'Cuando se encienda, cambia el tono de tu mes.',
  },
  sueno: {
    on: 'El descanso sostiene tus demás días.',
    off: 'Cuando se encienda, será una base para tus días.',
  },
  registro: {
    on: 'Anotar sostuvo todo lo demás.',
    off: 'Cuando se encienda, verás lo demás con más claridad.',
  },
  proteina: {
    on: 'Tu proteína cuida tu músculo mientras bajas.',
    off: 'Cuando se encienda, acompañará tu déficit.',
  },
  agua: {
    on: 'El agua ya es casi un hábito tuyo.',
    off: 'Cuando se encienda, sumará a tu constancia.',
  },
  movimiento: {
    on: 'Moverte se volvió parte de tu mes.',
    off: 'Cuando se encienda, será otra de tus constantes.',
  },
}

/** Una estrellita de 4 puntas con pequeño flare — el "día" de la parrilla.
 *  Encendida: color pleno + halo tenue (el flare). Apagada: estrella diminuta y
 *  muy tenue (el día que no contó). */
function DayStar({ on, color }: { on: boolean; color: string }) {
  return (
    <Svg width={9} height={9} pointerEvents="none">
      {on ? <Circle cx={4.5} cy={4.5} r={4.5} fill={color} opacity={0.16} /> : null}
      {/* Apagada = slot NEUTRO perceptible (no el color de dimensión casi invisible):
          así se lee el "de N", el denominador honesto. */}
      <Path
        d={fourPointStarPath(4.5, 4.5, on ? 3.2 : 2.4)}
        fill={on ? color : colors.niebla}
        opacity={on ? 1 : 0.42}
      />
    </Svg>
  )
}

/** Medidor de proporción de ANCHO FIJO: siempre `GAUGE_STARS` estrellas; se
 *  encienden `round(count/total * N)`. El ancho es igual en TODAS las filas → el
 *  largo ya no miente (antes 27 estrellas vs 8 se comparaban como misma unidad y
 *  el déficit se veía "más lleno" que agua sin serlo). El conteo exacto vive en el
 *  texto de la fila (ese es el ancla honesta); esto solo dibuja qué tan lleno. */
const GAUGE_STARS = 10
function DayStars({ count, total, color }: { count: number; total: number; color: string }) {
  const frac = total > 0 ? Math.max(0, Math.min(1, count / total)) : 0
  const lit = Math.round(frac * GAUGE_STARS)
  return (
    <View style={styles.dayStars}>
      {Array.from({ length: GAUGE_STARS }, (_, i) =>
        i < lit ? (
          <Animated.View key={i} entering={FadeIn.duration(220).delay(i * 34)}>
            <DayStar on color={color} />
          </Animated.View>
        ) : (
          <DayStar key={i} on={false} color={color} />
        ),
      )}
    </View>
  )
}

export function MonthSegment({
  onPickDay,
  onScrollTop,
}: {
  onPickDay?: (date: string) => void
  /** Volver al inicio del scroll de Órbita (botón al final del Mes). */
  onScrollTop?: () => void
} = {}) {
  const { data: hasAny } = useHasAnySignals()
  const {
    data: history,
    isLoading: historyLoading,
    isError: historyError,
    refetch: refetchHistory,
  } = useSignalsHistory(31)
  const signals = useMemo(() => history ?? [], [history])
  // Los PATRONES son acumulativos: se aprenden con el tiempo, no pertenecen a un
  // mes calendario (si no, se borrarían cada día 1). Leen una ventana larga (90d),
  // no monthSignals. El calendario y el KPI sí son del mes en curso.
  const { data: longHistory } = useSignalsHistory(90)
  const patternSignals = useMemo(() => longHistory ?? [], [longHistory])
  // Días con señal en la ventana de patrones — decide el TONO del estado
  // vacío: pocos días = promesa con siluetas (anticipación honesta); muchos
  // días sin patrón = el "sin relleno" honesto de siempre.
  const patternDataDays = useMemo(
    () => patternSignals.filter((s) => s.day != null).length,
    [patternSignals],
  )

  const targets = useMacroTargets().data
  const proteinTarget = targets?.protein_g ?? null
  const calorieTarget = targets?.calories ?? null
  const { goalMl } = useWaterGoal()
  const waterGoalGlasses = Math.max(1, Math.round(goalMl / GLASS_ML))

  // El KPI de déficit y el calendario "Tu mes de un vistazo" hablan del MES EN
  // CURSO (no de la ventana rodante de 31 días), así sus conteos coinciden
  // exactamente: mismos días-con-comida, mismos días en déficit.
  const today = todayInTimezone()
  const monthStr = today.slice(0, 7) // 'YYYY-MM' del mes en curso

  // "Tu mes de un vistazo": calendario con NAVEGADOR de mes. 0 = mes en curso;
  // negativo = meses pasados (usa la ventana de 90d para poder ojearlos, útil los
  // primeros días del mes cuando el actual está vacío).
  const [monthOffset, setMonthOffset] = useState(0)
  const selectedMonth = useMemo(() => shiftMonth(today, monthOffset), [today, monthOffset])
  const calendarSignals = useMemo(
    () => patternSignals.filter((s) => s.day != null && s.day.startsWith(selectedMonth)),
    [patternSignals, selectedMonth],
  )
  // Mes pasado → su "día 31" (inexistente): todo el mes visible, sin futuro ni
  // "hoy". El mes en curso usa el hoy real.
  const calendarToday = monthOffset === 0 ? today : `${selectedMonth}-31`
  // Primer día con datos (en 90d) — guard del "muy bajo" de arranque (5.3).
  const firstDataDay = useMemo(() => {
    let min: string | null = null
    for (const s of patternSignals) {
      if (s.day == null) continue
      if ((s.meal_count ?? 0) <= 0 && (s.calories ?? 0) <= 0) continue
      if (min == null || s.day < min) min = s.day
    }
    return min
  }, [patternSignals])
  const glance = useMemo(
    () => monthCalendar(calendarSignals, { today: calendarToday, calorieTarget, firstDataDay }),
    [calendarSignals, calendarToday, calorieTarget, firstDataDay],
  )
  // Hasta dónde se puede retroceder: el mes más viejo con registro (en 90d).
  const oldestMonth = useMemo(() => {
    let min = monthStr
    for (const s of patternSignals) {
      const m = s.day?.slice(0, 7)
      if (m && (s.meal_count ?? 0) > 0 && m < min) min = m
    }
    return min
  }, [patternSignals, monthStr])
  const canPrevMonth = selectedMonth > oldestMonth
  const canNextMonth = monthOffset < 0

  // "Tus patrones": el patrón dominante = la combinación de hábitos que más
  // coincidió y mejor terminó en déficit. ACUMULATIVO (ventana larga, no el mes)
  // → un patrón es de tu historia, no se borra el día 1.
  const combo = useMemo(
    () => winningCombo(patternSignals, { calorieTarget, proteinTarget, waterGoalGlasses }),
    [patternSignals, calorieTarget, proteinTarget, waterGoalGlasses],
  )
  // Patrones de apoyo: correlaciones demostrables del motor (kind 'pattern'). Se
  // excluye lo que ya dijo el combo (sin redundancia) y se ordena por relevancia
  // (déficit es el norte). Tope: 2 con combo, 3 sin él (el astrónomo no abruma).
  const supportPatterns = useMemo(() => {
    const comboKeys = new Set(combo?.signals.map((s) => s.key) ?? [])
    const coveredByCombo = (id: string): boolean => {
      if (id === 'sleep-deficit') return comboKeys.has('sueno')
      if (id === 'training-protein') return comboKeys.has('cuerpo') && comboKeys.has('proteina')
      // El combo ya conecta movimiento con el déficit → no repetir.
      if (id === 'movement-deficit') return comboKeys.has('cuerpo')
      return false
    }
    const PRIORITY: Record<string, number> = {
      // La FALLA primero (dónde se rompe tu déficit) — es la promesa.
      'deficit-daytype': 0,
      // El par que conecta esfuerzo (movimiento) ↔ norte (déficit): alto valor.
      'movement-deficit': 1,
      'surplus-concentration': 2,
      'sleep-deficit': 3,
      'training-protein': 4,
    }
    return detectMonthPatterns(patternSignals, { calorieTarget, proteinTarget })
      .filter((p) => p.kind === 'pattern' && !coveredByCombo(p.id))
      .sort((a, b) => (PRIORITY[a.id] ?? 9) - (PRIORITY[b.id] ?? 9))
      .slice(0, combo ? 2 : 3)
  }, [patternSignals, calorieTarget, proteinTarget, combo])
  // Puente con la ceremonia fechada: si una PIEZA del combo dominante ya se
  // reveló y guardó (tabla `revelations`), mostramos su procedencia factual
  // ("Entreno → déficit · 18/22 días · descubierto el 30 jun") que revive la
  // ceremonia REAL con su fecha + barras. Solo entreno/sueño tienen correlación
  // de déficit (los únicos `kind` que correlationForKind mapea). El combo es el
  // zoom-out del mes; la ceremonia, el zoom-in del momento en que se notó.
  const revelations = useRevelationHistory()
  const provenance = useMemo(() => {
    if (!combo) return null
    const HABIT_KIND: Record<string, string> = {
      cuerpo: 'training_consistent',
      sueno: 'sleep_consistent',
    }
    const HABIT_LABEL: Record<string, string> = { cuerpo: 'Entreno', sueno: 'Sueño' }
    const kindToKey = (k: string) =>
      (Object.keys(HABIT_KIND) as string[]).find((key) => HABIT_KIND[key] === k) ?? null
    const comboKinds = new Set(
      combo.signals.map((s) => HABIT_KIND[s.key]).filter((k): k is string => Boolean(k)),
    )
    const row = (revelations.data ?? [])
      .filter((r) => r.tier === 'pattern' && comboKinds.has(r.kind))
      .sort((a, b) => (a.shown_at < b.shown_at ? 1 : -1))[0] // más reciente
    if (!row) return null
    const corr = correlationForKind(patternSignals, { calorieTarget, proteinTarget }, row.kind)
    if (!corr) return null
    const key = kindToKey(row.kind)
    if (!key) return null
    const bar = corr.bars.find((b) => b.highlight) ?? corr.bars[0]
    const proof = bar?.total ? ` · ${bar.value}/${bar.total} días` : ''
    const d = row.shown_at.slice(0, 10)
    const when = `${Number(d.slice(8, 10))} ${MONTHS_SHORT[Number(d.slice(5, 7)) - 1]}`
    const lever =
      row.kind === 'training_consistent'
        ? weeklyMovementLever(patternSignals, calorieTarget, today)
        : null
    return {
      label: `${HABIT_LABEL[key]} → déficit${proof} · descubierto el ${when}`,
      onReplay: () =>
        emitReplayReveal({
          tier: row.tier,
          kind: row.kind,
          title: corr.title,
          message: lever ?? corr.insight,
          evidenceBars: corr.bars,
          correlationInsight: lever ?? corr.insight,
          date: d,
        }),
    }
  }, [combo, revelations.data, patternSignals, calorieTarget, proteinTarget, today])

  // Sistema PRESENCIA: separado del progreso físico.
  const presence = useMemo(() => presenceSummary(signals), [signals])

  // Hero — la constelación del signo revelándose por los puntos de
  // transformación (suma de hábitos del mes), y cuánto subió este mes.
  const { data: profile } = useProfile()
  const sign = profile ? zodiacFromDate(profile.date_of_birth) : null
  const { progress, stage } = useTransformProgress()
  const firstOfMonth = `${todayInTimezone().slice(0, 8)}01`
  const { progress: prevProgress } = useTransformProgressAsOf(firstOfMonth)
  const delta = prevProgress != null ? Math.max(0, progress - prevProgress) : null
  // Las dos listas del héroe: lo que sostuviste (★) y lo que falta (○). VENTANA
  // RODANTE de 31 días (informativo, no se vacía el día 1). Su modal de evidencia
  // (RevealDaysGrid) dibuja EXACTAMENTE esa ventana → el conteo coincide con los
  // días mostrados, aunque abarque dos meses.
  const reveals = useMemo(
    () => monthReveals(signals, { calorieTarget, proteinTarget, waterGoalGlasses }),
    [signals, calorieTarget, proteinTarget, waterGoalGlasses],
  )
  // Tendencia del déficit vs tu mes pasado (Apple Trends, self-only). SOLO al
  // alza y SIN número: mes cerrado = evidencia retrospectiva → la dirección sí, el
  // conteo del delta no (manifesto-reviewer). A la baja/plano → sin chip, para no
  // meter comparación/presión en una sección de celebración.
  const deficitTrendUp = useMemo(() => {
    const lit = reveals.revealed.find((r) => r.key === 'deficit')
    if (lit == null || calorieTarget == null || calorieTarget <= 0) return false
    const [y, m] = selectedMonth.split('-').map(Number) as [number, number]
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    const prevCount = patternSignals.filter(
      (s) =>
        s.day != null &&
        s.day.startsWith(prev) &&
        s.calories != null &&
        s.calories > 0 &&
        isDeficitDay(s.calories, calorieTarget),
    ).length
    return prevCount > 0 && lit.count > prevCount
  }, [reveals, calorieTarget, selectedMonth, patternSignals])
  // Los días concretos por dimensión — MISMA ventana de 31d que `reveals`, para
  // que los días de la rejilla del modal cuadren con el conteo.
  const revealDays = useMemo(
    () => revealDayMap(signals, { calorieTarget, proteinTarget, waterGoalGlasses }),
    [signals, calorieTarget, proteinTarget, waterGoalGlasses],
  )
  // Resumen de déficit — de aquí sale la "intensidad diaria" (avgOnDeficitDays)
  // que corona el modal de "Déficit constante" (lo que la usuaria pedía como
  // "déficit total", pero como conclusión, no como suma gastable).
  const deficitSummary = useMemo(
    () => daysInDeficit(signals, { calorieTarget }),
    [signals, calorieTarget],
  )
  // Dirección del déficit DENTRO del mes (inicio vs final) — la flecha "Trends"
  // de Apple: responde "¿voy bien?" comparándote CONTIGO, no contra un 100% que
  // reprueba. Reusa monthChange + deficitTrajectoryRead (§8, hoy sin renderizar).
  const deficitTrend = useMemo(() => {
    const cats = monthChange(signals, {
      today,
      calorieTarget,
      proteinTarget,
      waterGoalGlasses,
    })
    const def = cats.find((c) => c.key === 'deficit')
    if (!def) return null
    const counts = def.weeks.map((w) => w.count ?? 0)
    const traj = deficitTrajectoryRead(counts)
    return {
      takeaway: traj.state === 'low' ? null : traj.takeaway,
      weeks: counts,
    }
  }, [signals, today, calorieTarget, proteinTarget, waterGoalGlasses])

  const [evidence, setEvidence] = useState<EvidenceItem | null>(null)
  // El patrón dominante abre el modal cinemático a pantalla completa (no el panel).
  const [reveal, setReveal] = useState<ComboReveal | null>(null)
  const [revealDetail, setRevealDetail] = useState<RevealDetail | null>(null)
  const openReveal = (item: MonthReveals['revealed'][number], revealed: boolean) =>
    setRevealDetail({
      key: item.key,
      label: item.label,
      colorKey: item.colorKey,
      revealed,
      count: item.count,
      threshold: REVEAL_THRESHOLD,
      days: revealDays[item.key] ?? [],
      avgOnDeficitDays: item.key === 'deficit' ? (deficitSummary?.avgOnDeficitDays ?? null) : null,
      direction: item.key === 'deficit' ? (deficitTrend?.takeaway ?? null) : null,
      weeklyDeficit: item.key === 'deficit' ? (deficitTrend?.weeks ?? null) : null,
    })

  // 9.4 · carga y error explícitos (mismo par cálido de Día): sin esto, un
  // fetch fallido dejaba el Mes en blanco sin salida.
  if (historyLoading && history == null) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        <HeroHeader />
        <View style={styles.stateCard}>
          <Text style={styles.stateBody}>Mirando tu mes…</Text>
        </View>
      </Animated.View>
    )
  }
  if (historyError && history == null) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        <HeroHeader />
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Tu mes no terminó de cargar</Text>
          <Text style={styles.stateBody}>Vuelve a intentarlo en un momento.</Text>
          <Pressable
            style={styles.stateRetryBtn}
            onPress={() => void refetchHistory()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
          >
            <Text style={styles.stateRetry}>Reintentar</Text>
          </Pressable>
        </View>
      </Animated.View>
    )
  }

  if (hasAny === false) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        <HeroHeader />
        {sign ? (
          <EmblemHero
            sign={sign}
            progress={0}
            delta={null}
            message="Tu constelación apenas empieza a formarse."
            reveals={{ revealed: [], pending: [] }}
          />
        ) : null}
        <EmptySegmentCard
          eyebrow="Tu constelación se forma día a día"
          body="Cada registro suma evidencia y revela un poco más tu constelación. Registra desde Hoy y el mes empieza a construirse."
          hint="La constelación nunca se reinicia: lo que revelas, queda."
        />
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {/* 1 · Hero — la pregunta + la constelación revelada. */}
      <HeroHeader />
      {sign ? (
        <EmblemHero
          sign={sign}
          progress={progress}
          delta={delta}
          message={withSign(stage.message, signName(sign))}
          reveals={reveals}
          deficitTrendUp={deficitTrendUp}
          onOpenReveal={openReveal}
        />
      ) : null}

      {/* La pantalla se lee como una HISTORIA de 4 tiempos, no un dashboard:
          T1 ¿avanzo? (el héroe) → T2 ¿qué lo movió? → T3 ¿qué hago distinto? →
          T4 ¿sigo así? Cada tiempo abre con su pregunta humana. El detalle
          (calendario, patrones, parrilla) baja a "ver más" contextual (slice 2). */}

      {/* ── Tiempo 2 · El calendario de déficit, con navegador de mes (‹ mes ›)
          para ojear meses pasados. Si el mes seleccionado no tiene registro, un
          estado de inicio (con hint para retroceder). */}
      <View style={[styles.beat, styles.glancePanel]}>
        {/* Un solo encabezado apilado en el riel izquierdo: categoría → el MES (el
            título, navegable) → qué muestran los puntos. Igual para lleno y vacío. */}
        <View style={styles.calHeader}>
          <Text style={styles.eyebrow}>Tu mes de un vistazo</Text>
          <View style={styles.monthPagerRow}>
            <Pressable
              onPress={() => setMonthOffset((o) => o - 1)}
              disabled={!canPrevMonth}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Mes anterior"
            >
              <Text style={[styles.monthArrow, !canPrevMonth && styles.monthArrowOff]}>‹</Text>
            </Pressable>
            <Text style={styles.monthTitle} accessibilityRole="header">
              {monthLabelOf(selectedMonth, today)}
            </Text>
            <Pressable
              onPress={() => setMonthOffset((o) => o + 1)}
              disabled={!canNextMonth}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Mes siguiente"
            >
              <Text style={[styles.monthArrow, !canNextMonth && styles.monthArrowOff]}>›</Text>
            </Pressable>
          </View>
          {/* "El oro son tus días en déficit" se enseñaba 3 veces (aquí, la
              leyenda y la silueta de Semana). Relevo: este sub enseña mientras
              la leyenda aún no aparece (<5 días); con ≥5 la leyenda toma el
              lugar y el sub se retira. Un solo maestro a la vez. */}
          {(glance?.dataDays ?? 0) < 5 ? (
            <Text style={styles.calQuestion}>
              El oro son tus días en déficit. Lo que el mes fue construyendo.
            </Text>
          ) : null}
        </View>

        {glance ? (
          <>
            <MonthGlanceCalendar data={glance} onPickDay={onPickDay} />
            {/* Arranque de mes (pocos días): NO dejar a la usuaria sola frente al
                conteo bajo — junio, con historia real, a un tap. */}
            {monthOffset === 0 && glance.dataDays < 5 && canPrevMonth ? (
              <Text style={styles.monthEmptyHint}>
                Este mes va empezando. Usa ‹ para ver meses anteriores.
              </Text>
            ) : null}
          </>
        ) : (
          <View style={styles.monthEmpty}>
            <Text style={styles.monthEmptyBody}>
              {monthOffset === 0
                ? 'El calendario se irá encendiendo conforme registres tus días.'
                : 'Aún no hay días con comida en este mes.'}
            </Text>
            {monthOffset === 0 && canPrevMonth ? (
              <Text style={styles.monthEmptyHint}>Usa las flechas para ver meses anteriores.</Text>
            ) : null}
          </View>
        )}
      </View>

      {/* ── Tiempo 3 · Tus patrones — lo que Stelar encontró. La usuaria ya tiene
          datos (el guard de arriba lo asegura), así que la sección SIEMPRE está: con
          patrón probado, lo muestra; sin uno, un estado vacío HONESTO — nunca un
          patrón débil de relleno (Apple/Yazio: jamás fingir). */}
      <View style={styles.beat}>
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Tus patrones</Text>
          {combo || supportPatterns.length > 0 ? (
            <>
              <Text style={styles.sectionLede}>Lo que apareció junto en tus días.</Text>
              {combo ? (
                <DominantPatternCard
                  combo={combo}
                  provenance={provenance}
                  onOpen={() => {
                    const base = comboReveal(combo)
                    // La palanca de esta semana reemplaza al cierre retrospectivo.
                    const lever = weeklyComboLever(
                      patternSignals,
                      combo,
                      { calorieTarget, proteinTarget, waterGoalGlasses },
                      today,
                    )
                    setReveal({ ...base, takeaway: lever ?? base.takeaway })
                  }}
                />
              ) : null}
              {supportPatterns.map((p, i) => (
                <PatternFindingCard
                  key={p.id}
                  pattern={p}
                  index={i}
                  leading={!combo && i === 0}
                  onOpen={() => setEvidence(p)}
                />
              ))}
            </>
          ) : patternDataDays < 14 ? (
            /* Semanas 1-2: el diferenciador entero de Stelar aún no puede
               hablar. Un "no hay nada" sin forma se lee como "esta sección no
               sirve"; lo bloqueado-pero-visible (siluetas de QUÉ va a
               descubrir) convierte la ausencia en anticipación. Umbral
               aproximado, sin countdown (retention-spec · Mecánica C). */
            <View style={styles.patternsEmpty}>
              <Text style={styles.patternsEmptyLede}>Tus patrones se están formando.</Text>
              <Text style={styles.patternsEmptyBody}>
                Con unas dos semanas de registros, tus primeros patrones aparecen aquí. Cosas como:
              </Text>
              <View style={styles.patternSilhouettes}>
                {[
                  'Qué días son distintos en tu rutina',
                  'Qué acompaña tus mejores días',
                  'Qué combinación te sostiene en déficit',
                ].map((t) => (
                  <View key={t} style={styles.patternSilhouetteRow}>
                    <View style={styles.patternSilhouetteStar} />
                    <Text style={styles.patternSilhouetteText}>{t}</Text>
                  </View>
                ))}
              </View>
              {/* El horizonte honesto (GAP 5): el umbral concreto que abre la
                  puerta, sin countdown ni prometer CUÁL patrón llega primero
                  (eso depende de sus datos, no lo fingimos). */}
              <Text style={styles.patternsEmptyHorizon}>
                Un patrón nace cuando algo se repite unas tres veces en tus datos.
              </Text>
            </View>
          ) : (
            <View style={styles.patternsEmpty}>
              <Text style={styles.patternsEmptyLede}>Aún no emerge un patrón claro.</Text>
              <Text style={styles.patternsEmptyBody}>
                Stelar solo te muestra un patrón cuando tus datos lo sostienen. Con más días,
                aparecerá.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Tiempo 4 · ¿Sigo así? — el cierre emocional (volver sin culpa). */}
      {/* 9.6 · la coda de presencia se gana su lugar con ≥7 días de datos:
          en la primera semana era la cuarta promesa apilada de un pasillo de
          puertas cerradas ("Apenas empieza"); sin historia de regresos que
          contar, la promesa de patrones (con siluetas + horizonte) ya cierra
          el recorrido. */}
      {presence && patternDataDays >= 7 ? <PresenceFinale presence={presence} /> : null}

      {/* Fin del recorrido: volver al inicio sin tener que hacer scroll a mano. */}
      {onScrollTop ? (
        <Pressable
          style={styles.backTop}
          onPress={onScrollTop}
          accessibilityRole="button"
          accessibilityLabel="Volver arriba"
        >
          <Text style={styles.backTopArrow}>↑</Text>
          <Text style={styles.backTopText}>Volver arriba</Text>
        </Pressable>
      ) : null}

      <EvidenceModal pattern={evidence} onClose={() => setEvidence(null)} />
      {/* Modal cinemático del patrón dominante (se monta al abrir → replaya). */}
      {reveal ? (
        <PatternRevealModal
          phrase={reveal.phrase}
          countLine={reveal.countLine}
          takeaway={reveal.takeaway}
          lifeline
          onClose={() => setReveal(null)}
        />
      ) : null}
      <RevealEvidenceModal
        detail={revealDetail}
        today={today}
        onClose={() => setRevealDetail(null)}
      />
    </Animated.View>
  )
}

/* ── Hero — la pregunta que abre la pantalla ─────────────────────────── */
function HeroHeader() {
  return (
    <View style={styles.heroHeader}>
      <Text style={styles.heroQuestion}>¿Qué estás construyendo?</Text>
      <Text style={styles.heroSubtitle}>
        No es una meta. Es lo que tus acciones empezaron a construir.
      </Text>
    </View>
  )
}

/* Avance del mes en palabras (sin un segundo %): qué proporción del total
 * revelado ocurrió este mes. Mata el choque "75% vs +64%". */
function deltaPhrase(delta: number, progress: number): string {
  const ratio = progress > 0 ? delta / progress : 0
  if (ratio >= 0.6) return 'La mayor parte la revelaste este mes.'
  if (ratio >= 0.3) return 'Buena parte la revelaste este mes.'
  // "Algo se reveló" conserva el ancla de "revelar" (la constelación); un
  // genérico "Avanzaste" lo perdía (voice-and-copy).
  return 'Algo se reveló este mes.'
}

/* ── Hero — la constelación del signo revelándose ────────────────────── */
function EmblemHero({
  sign,
  progress,
  delta,
  message,
  reveals,
  deficitTrendUp,
  onOpenReveal,
}: {
  sign: ZodiacSign
  progress: number
  delta: number | null
  message: string
  reveals: MonthReveals
  /** El déficit subió vs el mes pasado (chip de dirección, solo al alza). */
  deficitTrendUp?: boolean
  onOpenReveal?: (item: MonthReveals['revealed'][number], revealed: boolean) => void
}) {
  const [w, setW] = useState(0)
  const onLayout = (e: LayoutChangeEvent): void => {
    const next = e.nativeEvent.layout.width
    setW((p) => (Math.abs(p - next) < 1 ? p : next))
  }
  // Respiración del halo — un loop, gateado en foco (pausa fuera de tab/scroll)
  // + reduced-motion. Opacidad + escala en compositor; no repinta Skia ni SVG.
  const active = useScreenActive()
  const focused = useIsFocused()
  const reduce = useReducedMotion() ?? false
  const breath = useSharedValue(0)
  useEffect(() => {
    if (!active || reduce) {
      cancelAnimation(breath)
      breath.value = withTiming(0, { duration: 400 })
      return
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [active, reduce, breath])
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.28 + breath.value * 0.55,
    transform: [{ scale: 0.88 + breath.value * 0.22 }],
  }))

  // El chevron es un affordance ESTÁTICO y discreto (‹›): un chevron ya invita al
  // toque. Antes latía en bucle en CADA fila → la pantalla "vibraba" en vez de
  // respirar. Órbita Mes debe sentirse en calma.

  // El módulo "Lo que encendió tu cielo" (consolidado): el déficit coronado
  // aparte (norte), el resto de dimensiones como contexto, las pendientes "en
  // sombra" (absorben la vieja sección "Lo que aún no sabemos"), y una línea de
  // FOCO ("lo más cerca de encender"). "Registro" sale del módulo (es presencia,
  // no transformación → vive en "Tu presencia").
  const deficitLit = reveals.revealed.find((r) => r.key === 'deficit') ?? null
  const ctxLit = reveals.revealed.filter((r) => r.key !== 'deficit' && r.key !== 'registro')
  // UN solo foco: la pendiente MÁS cerca de encender (no un roster de carencias
  // stackeado bajo tus logros). Solo si ya pasó la mitad del umbral → anticipación
  // sana; mostrar una lejana ("2 de 8") deflaciona en vez de motivar.
  const shadow = reveals.pending
    .filter((r) => r.key !== 'registro' && r.count >= REVEAL_THRESHOLD / 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 1)
  // El FOCO ya NO vive en el héroe: subió al Tiempo 3 ("¿qué hago distinto?").
  const hasModule = reveals.revealed.length > 0

  return (
    <View style={styles.heroWrap}>
      <View style={styles.heroStage} onLayout={onLayout}>
        {/* Disco de vacío cálido — recorta el wash magenta justo detrás de la
            figura para que el oro del emblema no se enturbie (capa de fondo). */}
        <VoidDisc size={w || HERO_SIZE} />
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.heroGlow, glowStyle]}
          pointerEvents="none"
        >
          <EmblemGlow size={w || HERO_SIZE} />
        </Animated.View>
        <StaticField size={w || HERO_SIZE} />
        {/* En Mes el emblema NO recede (no hay constelación natal encima): es el
            protagonista, así que sube su opacidad para coronar (default = receso
            de Tab Hoy). */}
        {w > 0 && focused ? (
          <RevealedEmblem
            sign={sign}
            transformProgress={progress}
            size={w}
            masterOpacity={0.95}
            frameOpacity={0.6}
            glyphOpacity={0.78}
            bloomMaxOpacity={0.72}
          />
        ) : null}
      </View>

      {/* El signo — el nombre de lo que se está revelando. */}
      <Text style={styles.heroSign}>{signName(sign)}</Text>
      {/* % revelado — el reveal del arte ES la barra; el número acompaña.
          Fase 8: bajo el umbral, el número deflaciona ("1%" = "esto es una
          montaña" en el momento más frágil — anti-anillo de Apple). El %
          aparece cuando ya cuenta una historia (misma regla que el calendario
          gana su % con ≥5 días); antes, cualitativo + el mecanismo explícito
          (qué lo hace subir, y que no retrocede). El frame cambia; la
          honestidad no: nada se acelera. */}
      {progress < EMBLEM_PCT_THRESHOLD ? (
        <Text style={styles.heroPct}>Apenas empieza a revelarse</Text>
      ) : (
        <Text style={styles.heroPct}>
          {progress}
          <Text style={styles.heroPctSign}>% revelado</Text>
        </Text>
      )}
      {/* Ancla de significado del número (estilo "unidad" de anillo Apple): dice
          QUÉ mide el % y NIEGA el peso — así "93% revelado" no se lee como "93%
          de mi meta de peso" (countdown, línea roja). Y de paso, el "por qué un
          {signo}": es tu signo, dibujado por tu constancia. */}
      <Text style={styles.heroAnchor}>
        Tu {signName(sign)} se dibuja con tu constancia, no con tu peso.
      </Text>
      {/* El mecanismo, solo en el arranque: la usuaria no sabía qué lo hace
          subir, y "no se apaga" es la regla de inmutabilidad hecha promesa. */}
      {progress < EMBLEM_PCT_THRESHOLD ? (
        <Text style={styles.heroMechanism}>
          Cada día que registras suma luz. Lo que enciendes no se apaga.
        </Text>
      ) : null}
      {/* Avance del mes en CUALITATIVO, sin un segundo "%": dos porcentajes
          juntos competían y confundían cuál era cuál. El número héroe es el %
          revelado; esto solo dice cuánto de ese avance ocurrió este mes. */}
      {delta != null && delta > 0 ? (
        <Text style={styles.heroDelta}>{deltaPhrase(delta, progress)}</Text>
      ) : null}
      <Text style={styles.heroMessage}>{message}</Text>

      {/* "Lo que encendió tu cielo" — el desglose HUMANO del % de arriba: qué
          dimensiones lo encendieron (con su denominador honesto), qué está en
          sombra, y el foco de lo más cerca de encender. Una sola vez, un solo
          umbral: absorbe la vieja sección "Lo que aún no sabemos". */}
      {hasModule ? (
        <View style={styles.revealGroup}>
          <Text style={styles.revealHeading}>Lo que sostuviste este mes</Text>

          {/* La proporción se VE como días-estrella (sin barra). El déficit (el
              norte) va coronado: fila propia, estrella e ilustración mayores. */}
          {deficitLit ? (
            <Pressable
              style={styles.deficitRow}
              accessibilityRole="button"
              accessibilityLabel={`Déficit constante, ${deficitLit.count} de ${deficitLit.total} días que registraste. Ver evidencia.`}
              onPress={() => onOpenReveal?.(deficitLit, true)}
            >
              <DiscoveryStar color={revealColor('deficit')} mag={0.72} size={26} />
              <View style={styles.deficitBody}>
                <Text style={styles.deficitLabel}>{deficitLit.label}</Text>
                {/* Solo el LOGRO (no la fracción "X de N", que se lee como examen
                    reprobado). El denominador honesto vive en la cuadrícula del
                    modal. + chip de dirección vs tu mes pasado (solo al alza). */}
                <View style={styles.deficitSubRow}>
                  <Text style={styles.deficitSub}>{deficitLit.count} días</Text>
                  {deficitTrendUp ? (
                    <Text style={styles.trendChip}>↑ Más que el mes pasado</Text>
                  ) : null}
                </View>
                <DayStars
                  count={deficitLit.count}
                  total={deficitLit.total}
                  color={revealColor('deficit')}
                />
                {/* El veredicto (voz coach) SOLO en el déficit — es el norte. Las
                    otras 3 se colapsan sin frase (antes las 4 se leían iguales). */}
                <Text style={styles.deficitVerdict}>{REVEAL_ROLE.deficit?.on ?? ''}</Text>
              </View>
              <Text style={styles.revChevron}>›</Text>
            </Pressable>
          ) : null}

          {deficitLit && ctxLit.length > 0 ? (
            <>
              <View style={styles.revealDivider} />
              {/* Jerarquía: el déficit es el norte; estas 3 son lo que lo sostuvo.
                  El encabezado lo hace explícito (antes las 4 se leían iguales). */}
              <Text style={styles.accompHeading}>Lo que lo acompañó</Text>
            </>
          ) : null}

          {/* Lo que lo sostuvo (contexto): COMPACTO (una línea, sin medidor) para
              que el déficit —único con medidor + veredicto— siga siendo el héroe.
              El conteo ancla el número a la derecha. */}
          {ctxLit.map((it, i) => (
            <AnimatedPressable
              key={it.key}
              entering={FadeIn.duration(360).delay(i * 80)}
              style={styles.ctxRow}
              accessibilityRole="button"
              accessibilityLabel={`${it.label}, ${it.count} días. Ver evidencia.`}
              onPress={() => onOpenReveal?.(it, true)}
            >
              <DiscoveryStar color={revealColor(it.colorKey)} mag={0.5} size={16} />
              <Text style={styles.ctxLabel} numberOfLines={1}>
                {it.label}
              </Text>
              <Text style={styles.ctxCount}>
                {it.count} {it.key === 'sueno' ? 'noches' : 'días'}
              </Text>
              <Text style={styles.revChevronSm}>›</Text>
            </AnimatedPressable>
          ))}

          {/* Aún por encender (lo pendiente): MISMO lenguaje que las encendidas
              (estrella + título + sub + estrellitas), pero el denominador es el
              UMBRAL (8) → se ve "6 de 8, te faltan 2". Estrella tenue: aún no
              enciende. Nunca en tono de reproche. */}
          {shadow.length > 0 ? (
            <>
              {/* Divisor: el salto de "esto ya lo tienes" a "esto viene" debe ser
                  inequívoco (no una sola lista). */}
              <View style={styles.revealDivider} />
              <Text style={styles.shadowHeading}>Lo más cerca de encender</Text>
              {shadow.map((it) => (
                <Pressable
                  key={it.key}
                  style={styles.ctxRow}
                  accessibilityRole="button"
                  accessibilityLabel={
                    it.count > 0
                      ? `${it.label}, ${it.count} de ${REVEAL_THRESHOLD} días para encender. Ver evidencia.`
                      : `${it.label}, apenas empieza. Ver evidencia.`
                  }
                  onPress={() => onOpenReveal?.(it, false)}
                >
                  <DiscoveryStar color={revealColor(it.colorKey)} mag={0.3} size={16} />
                  <View style={styles.ctxBody}>
                    <Text style={styles.shadowTitle}>{it.label}</Text>
                    <Text style={styles.ctxSub}>
                      {it.count > 0
                        ? `${it.count} de ${REVEAL_THRESHOLD} · ${REVEAL_THRESHOLD - it.count} más para encender`
                        : 'Apenas empieza'}
                    </Text>
                    <DayStars
                      count={it.count}
                      total={REVEAL_THRESHOLD}
                      color={revealColor(it.colorKey)}
                    />
                  </View>
                  <Text style={styles.revChevronSm}>›</Text>
                </Pressable>
              ))}
            </>
          ) : null}
        </View>
      ) : (
        // Aún nada revelado: anticipación cálida, nunca una lista de huecos.
        <Text style={styles.revealAwait}>
          Tu cielo aún se está formando. Lo que repitas, se revela.
        </Text>
      )}
    </View>
  )
}

/* Polvo estelar tenue detrás del emblema — estático, cero costo. */
const FIELD = [
  [0.14, 0.18, 1.4, 0.16],
  [0.82, 0.12, 1, 0.18],
  [0.68, 0.3, 0.8, 0.1],
  [0.3, 0.78, 1, 0.12],
  [0.88, 0.62, 0.7, 0.1],
  [0.1, 0.55, 0.8, 0.12],
  [0.5, 0.08, 0.7, 0.1],
  [0.92, 0.85, 0.9, 0.1],
] as const
function StaticField({ size }: { size: number }) {
  if (size <= 0) return null
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      {FIELD.map(([fx, fy, r, o], i) => (
        <Circle key={i} cx={fx * size} cy={fy * size} r={r} fill={colors.leche} opacity={o} />
      ))}
    </Svg>
  )
}

function EmblemGlow({ size }: { size: number }) {
  if (size <= 0) return null
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="emblem-breath" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.oroLight} stopOpacity={0.5} />
          <Stop offset="55%" stopColor={colors.oro} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={colors.oro} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#emblem-breath)" />
    </Svg>
  )
}

/* Disco de vacío — un radial del fondo (#0A0608) que oscurece el wash magenta
 * detrás de la figura, devolviéndole pureza al oro del emblema (iluminación
 * selectiva: una pieza brilla, el resto descansa). Capa de fondo, estática. */
function VoidDisc({ size }: { size: number }) {
  if (size <= 0) return null
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="emblem-void" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.bg} stopOpacity={0.6} />
          <Stop offset="62%" stopColor={colors.bg} stopOpacity={0.32} />
          <Stop offset="100%" stopColor={colors.bg} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#emblem-void)" />
    </Svg>
  )
}

/* ── "Tus patrones" — el patrón dominante + los de apoyo ─────────────── */

// Navegador de mes del calendario.
const MONTHS_FULL = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

/** Desplaza el mes de una fecha 'YYYY-MM-DD' por `delta` meses → 'YYYY-MM'. */
function shiftMonth(ymd: string, delta: number): string {
  const y = Number(ymd.slice(0, 4))
  const m = Number(ymd.slice(5, 7)) - 1 + delta
  const d = new Date(Date.UTC(y, m, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** "Junio" (mismo año) o "Junio 2025" (otro año). */
function monthLabelOf(monthStr: string, today: string): string {
  const y = Number(monthStr.slice(0, 4))
  const name = MONTHS_FULL[Number(monthStr.slice(5, 7)) - 1] ?? ''
  return y === Number(today.slice(0, 4)) ? name : `${name} ${y}`
}

const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const

/** "Fueron el 3, 8, 12 y 25 de jun." — las fechas concretas que anclan el conteo.
 *  Como los patrones son acumulativos, pueden abarcar varios meses → se agrupan
 *  por mes: "Fueron el 3, 8 y 12 de jun · 2 de jul." (dates vienen ordenadas). */
function formatDates(dates: string[]): string {
  if (dates.length === 0) return ''
  const byMonth = new Map<string, number[]>()
  for (const d of dates) {
    const key = d.slice(0, 7)
    const arr = byMonth.get(key)
    if (arr) arr.push(Number(d.slice(8, 10)))
    else byMonth.set(key, [Number(d.slice(8, 10))])
  }
  const groups = [...byMonth.entries()].map(([key, nums]) => {
    const mo = MONTHS_SHORT[Number(key.slice(5, 7)) - 1]
    const list =
      nums.length > 1 ? `${nums.slice(0, -1).join(', ')} y ${nums[nums.length - 1]}` : `${nums[0]}`
    return `${list} de ${mo}`
  })
  return `Fueron el ${groups.join(' · ')}.`
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

// Etiqueta corta + color por astro del combo (los nodos del asterismo `*—*—*`).
const NODE_LABEL: Record<string, string> = {
  sueno: 'Sueño',
  proteina: 'Proteína',
  cuerpo: 'Entreno',
  agua: 'Agua',
}
const NODE_COLOR: Record<string, string> = {
  sueno: colors.dimension.sueno,
  proteina: colors.dimension.alimento,
  cuerpo: colors.signal.entreno,
  agua: colors.leche,
}

/* El patrón dominante: la combinación de hábitos que más fue de la mano con el
 * déficit. La card es una ESCENA DE DESCUBRIMIENTO (PatternDiscovery): una
 * constelación que Stelar traza sola + el insight. Sigue tappable → modal
 * life-line. Highlight que respira en el borde como "tócame". */
function DominantPatternCard({
  combo,
  onOpen,
  provenance,
}: {
  combo: WinningComboData
  onOpen: () => void
  /** Procedencia factual: la pieza del combo que ya se reveló y guardó, con su
   *  fecha. Toca → revive la ceremonia real. `null` si ninguna pieza se reveló. */
  provenance?: { label: string; onReplay: () => void } | null
}) {
  const active = useScreenActive()
  const reduce = useReducedMotion() ?? false
  const pulse = useSharedValue(0)
  useEffect(() => {
    if (!active || reduce) {
      cancelAnimation(pulse)
      pulse.value = withTiming(0, { duration: 400 })
      return
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(pulse)
  }, [active, reduce, pulse])
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.28 + pulse.value * 0.55 }))
  // Afordancia "tócame": la flecha del CTA hace un nudge suave.
  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pulse.value * 3 }],
    opacity: 0.6 + pulse.value * 0.4,
  }))

  const nodes = [
    ...combo.signals.map((s) => ({
      label: NODE_LABEL[s.key] ?? s.label,
      color: NODE_COLOR[s.key] ?? colors.leche,
    })),
    { label: 'Déficit', color: colors.oroSoft },
  ]

  return (
    <AnimatedPressable
      entering={FadeIn.duration(420)}
      style={styles.dominantCard}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Tu patrón dominante: ${comboPhrase(combo)} Ver la revelación.`}
    >
      <Animated.View style={[styles.dominantGlow, glowStyle]} pointerEvents="none" />
      <Text style={styles.dominantEyebrow}>Tu patrón dominante</Text>
      <PatternDiscovery nodes={nodes} />
      <View style={styles.discoverCta} pointerEvents="none">
        <Text style={styles.discoverCtaText}>Ver la revelación</Text>
        <Animated.Text style={[styles.discoverCtaArrow, ctaStyle]}>→</Animated.Text>
      </View>
      {/* Procedencia: acción SECUNDARIA (Pressable anidado → captura el toque, el
          padre no abre el combo). Revive la ceremonia fechada de esa pieza. */}
      {provenance ? (
        <Pressable
          style={styles.provenanceRow}
          onPress={provenance.onReplay}
          accessibilityRole="button"
          accessibilityLabel={`${provenance.label}. Revivir la revelación.`}
        >
          <Text style={styles.provenanceText}>{provenance.label}</Text>
          <Text style={styles.provenanceChevron}>›</Text>
        </Pressable>
      ) : null}
    </AnimatedPressable>
  )
}

/* Un patrón de apoyo: tarjeta elegante (glifo oro + la frase observacional +
 * "Ver el patrón →" que abre el detalle). Si no hay combo, el primero lleva un
 * eyebrow para coronarlo sin badge de ranking. */
function PatternFindingCard({
  pattern,
  index,
  leading,
  onOpen,
}: {
  pattern: MonthPattern
  index: number
  leading: boolean
  onOpen: () => void
}) {
  // Entrada escalonada (solo opacidad → segura con reduced-motion).
  return (
    <Animated.View entering={FadeIn.duration(360).delay(index * 90)}>
      <Pressable
        style={styles.findingCard}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Ver el patrón: ${pattern.title}`}
      >
        {leading ? <Text style={styles.findingEyebrow}>Un patrón de tu mes</Text> : null}
        <View style={styles.findingGlyph}>
          <DiscoveryStar color={colors.oro} mag={0.72} size={26} />
        </View>
        <Text style={styles.findingTitle}>{pattern.title}</Text>
        <View style={styles.findingCta}>
          <Text style={styles.findingCtaText}>Ver el patrón</Text>
          <Text style={styles.findingCtaArrow}>→</Text>
        </View>
      </Pressable>
    </Animated.View>
  )
}

/* ── La forma de tu semana — 7 columnas, tu déficit por día (picos/valles) ── */
const DOW_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function WeekdayShapeChart({ shape }: { shape: WeekdayShape }) {
  // Sin % por barra (se leería como boletín): solo la SILUETA. Se ilumina el lado
  // que SOSTIENE (oro); el otro, atenuado. Nunca se resalta el día bajo.
  return (
    <View style={styles.shapeWrap}>
      <Text style={styles.shapeHeading}>Cómo sostuviste cada día</Text>
      <View style={styles.shapeRow}>
        {shape.week.map((d, i) => {
          const has = d.total > 0
          const isStrong = has && (shape.strongSide === 'weekend' ? i >= 5 : i < 5)
          return (
            <View key={i} style={styles.shapeCol}>
              <View style={styles.shapeTrack}>
                <View
                  style={[
                    styles.shapeFill,
                    {
                      height: `${has ? Math.max(6, Math.round(d.rate * 100)) : 0}%`,
                      backgroundColor: isStrong ? colors.oro : colors.oroSoft,
                      opacity: has ? (isStrong ? 1 : 0.42) : 0,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.shapeDow, isStrong ? styles.shapeDowHi : null]}>
                {DOW_LETTERS[i]}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

/* ── "Ver evidencia" — las barras que sostienen un hallazgo ──────────── */
function EvidenceModal({
  pattern,
  onClose,
}: {
  pattern: EvidenceItem | null
  onClose: () => void
}) {
  const ev = pattern?.evidence
  // Las señales SIN registro (0) no se dibujan como barra vacía (se leería como
  // hueco/falla): bajan a una nota al pie. La evidencia muestra lo que SÍ pasó.
  const shown = ev ? ev.bars.filter((b) => b.value > 0) : []
  const zeros = ev ? ev.bars.filter((b) => b.value === 0) : []
  const max = Math.max(1, ...shown.map((b) => b.value))
  const titleColor = ev
    ? (() => {
        const hi = ev.bars.find((b) => b.highlight) ?? ev.bars[0]
        return hi?.colorKey ? (BAR_COLOR[hi.colorKey] ?? colors.oro) : colors.oro
      })()
    : colors.oro
  return (
    <Modal visible={pattern != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        {/* Fondo difuminado: la pantalla detrás se va a desenfoque, el modal
            flota. El scrim cálido encima da separación y es el respaldo si en
            algún Android el BlurView no rinde. Ambos pointerEvents none → el tap
            afuera sigue cerrando vía el Pressable contenedor. */}
        <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={[StyleSheet.absoluteFill, styles.modalScrim]} pointerEvents="none" />
        <Pressable style={styles.modalCard} onPress={() => {}}>
          {pattern && ev ? (
            <>
              <Text style={styles.modalEyebrow}>La evidencia</Text>
              <View style={styles.modalTitleRow}>
                <View style={[styles.modalTitleDot, { backgroundColor: titleColor }]} />
                <Text style={styles.modalTitle}>{pattern.title}</Text>
              </View>
              {pattern.weekdayShape ? (
                // Forma por día de semana: la usuaria VE sus picos y valles + el
                // dato traducido en plano ("de cada 10 días entre semana sostienes 5").
                <>
                  <WeekdayShapeChart shape={pattern.weekdayShape} />
                  {pattern.why ? <Text style={styles.modalWhy}>{pattern.why}</Text> : null}
                </>
              ) : (
                <>
                  <View style={styles.bars}>
                    {shown.map((b, i) => {
                      const barColor = b.colorKey
                        ? (BAR_COLOR[b.colorKey] ?? colors.oro)
                        : colors.oro
                      // Con denominador, la barra dibuja la TASA (value/total), no el
                      // conteo crudo — si no, "11 de 22" (50%) se vería más largo que
                      // "7 de 8" (87%) y diría lo contrario a la verdad.
                      const rate = b.total != null ? b.value / b.total : null
                      const frac = rate != null ? rate : b.value / max
                      return (
                        <View key={`${b.label}-${i}`} style={styles.barRow}>
                          <Text style={styles.barLabel} numberOfLines={1}>
                            {b.label}
                          </Text>
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.barFill,
                                {
                                  width: `${Math.round(frac * 100)}%`,
                                  backgroundColor: barColor,
                                  opacity: b.highlight ? 1 : 0.32,
                                },
                              ]}
                            />
                          </View>
                          {rate != null ? (
                            // % protagonista (el número que golpea) + conteo como ancla.
                            <Text style={[styles.barValue, b.highlight ? styles.barValueHi : null]}>
                              {Math.round(rate * 100)}%
                              <Text style={styles.barValueTotal}>
                                {'  '}
                                {b.value}/{b.total}
                              </Text>
                            </Text>
                          ) : (
                            <Text style={[styles.barValue, b.highlight ? styles.barValueHi : null]}>
                              {b.value}
                            </Text>
                          )}
                        </View>
                      )
                    })}
                  </View>
                  <Text style={styles.modalCaption}>{ev.caption}</Text>
                  {/* Las fechas concretas — anclan el conteo ("¿de dónde salen?"). */}
                  {pattern.dates && pattern.dates.length > 0 ? (
                    <Text style={styles.modalDates}>{formatDates(pattern.dates)}</Text>
                  ) : null}
                  {zeros.length > 0 ? (
                    <Text style={styles.modalZeroNote}>
                      {zeros.map((z) => z.label).join(' · ')}: aún sin registro este mes.
                    </Text>
                  ) : null}
                  {/* "Por qué importa" — el lever que la usuaria puede mover (voz
                      Observadora: describe lo que pasó, no aconseja). Solo en los
                      patrones del motor; el combo no lo trae. */}
                  {pattern.why ? <Text style={styles.modalWhy}>{pattern.why}</Text> : null}
                </>
              )}
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalClose}>Cerrar</Text>
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/* Mini-calendario del mes con los días de UNA dimensión encendidos — la PRUEBA
 * de "¿de dónde salen esos días?". Días logrados en su color; el resto del mes
 * transcurrido, tenue; futuro, en blanco. */
const REVEAL_WINDOW = 31 // debe coincidir con useSignalsHistory(31) que alimenta reveals
const REVEAL_GRID_GAP = 6 // separación entre cuadros del mini-calendario (7 columnas)

function isoBack(today: string, back: number): string {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - back)
  return d.toISOString().slice(0, 10)
}

/** Día de semana con LUNES como columna 0 (0=lun … 6=dom). */
function weekdayMonIdx(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

/** Rango legible de la ventana: "Del 2 jun al 1 jul". */
function formatWindowRange(startIso: string, endIso: string): string {
  const day = (iso: string) => Number(iso.slice(8, 10))
  const mo = (iso: string) => MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]
  return `Del ${day(startIso)} ${mo(startIso)} al ${day(endIso)} ${mo(endIso)}`
}

/** La rejilla de días: la VENTANA RODANTE de 31 días (viejo → nuevo), no un mes
 *  calendario. Puede abarcar dos meses → cuadra con el conteo rodante del módulo. */
function RevealDaysGrid({ days, color, today }: { days: string[]; color: string; today: string }) {
  const onSet = new Set(days)
  const window = Array.from({ length: REVEAL_WINDOW }, (_, i) =>
    isoBack(today, REVEAL_WINDOW - 1 - i),
  )
  // Cuadros alineados a 7 COLUMNAS (lun→dom): así verticalmente se lee el patrón
  // ("tus lunes encienden, tus sábados tienen margen") sin números — la cuadrícula
  // habla. Huecos iniciales para que el primer día caiga en su columna de día de
  // semana. Sin números: numerar invita a contar lo que faltó (boleta).
  const lead = weekdayMonIdx(window[0]!)
  // Full-width: mido el ancho disponible y reparto en 7 columnas → las celdas
  // ESCALAN para llenar la tarjeta (antes fijas a 190 px, alineadas a la izq).
  const [gridW, setGridW] = useState(0)
  const cellW = gridW > 0 ? Math.floor((gridW - REVEAL_GRID_GAP * 6) / 7) : 22
  const cellH = Math.round(cellW * (20 / 22)) // conserva la proporción original
  const cellSize = { width: cellW, height: cellH, borderRadius: 5 }
  return (
    <>
      <View style={styles.revGrid} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
        {Array.from({ length: lead }, (_, i) => (
          <View key={`blank-${i}`} style={[cellSize, styles.revCellBlank]} />
        ))}
        {window.map((iso) => {
          const on = onSet.has(iso)
          return (
            <View
              key={iso}
              style={[cellSize, on ? { backgroundColor: color } : styles.revCellPast]}
            />
          )
        })}
      </View>
      <Text style={styles.revRange}>{formatWindowRange(window[0]!, today)}</Text>
    </>
  )
}

/** Las 4 semanas del mes como barras de días en déficit, con una hairline en TU
 *  promedio del mes (la "línea de promedio" de Apple Trends). Barras a la altura de
 *  tu promedio o encima = color pleno; debajo = atenuadas, nunca rojas. Es el glance
 *  "¿mi déficit sube o baja dentro del mes?" — comparación contigo, sin meta externa
 *  que batir. La línea de dirección debajo lo pone en palabras. */
function WeekDeficitBars({ weeks, color }: { weeks: number[]; color: string }) {
  const H = 72 // alto del área de barras
  const avg = weeks.reduce((a, b) => a + b, 0) / weeks.length
  const scale = Math.max(...weeks, 1) // la barra más alta llena el área
  const avgY = H - (avg / scale) * H // hairline medida desde arriba
  return (
    <View style={styles.wdWrap}>
      <View style={[styles.wdChart, { height: H }]}>
        <View style={[styles.wdAvgLine, { top: avgY }]} />
        {weeks.map((c, i) => (
          <View
            key={i}
            style={[
              styles.wdBar,
              {
                height: Math.max(3, (c / scale) * H),
                backgroundColor: color,
                opacity: c >= avg - 0.001 ? 1 : 0.38,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.wdEnds}>
        <Text style={styles.wdEndLabel}>hace un mes</Text>
        <Text style={styles.wdEndLabel}>esta semana</Text>
      </View>
      <View style={styles.wdLegend}>
        <View style={styles.wdLegendDash} />
        <Text style={styles.wdEndLabel}>tu promedio</Text>
      </View>
    </View>
  )
}

/* La evidencia de una fila de "Lo que sostuviste este mes": los días concretos
 * (mini-calendario), qué cuenta (criterio), el umbral/estado, y su rol. Para las
 * pendientes, cuánto falta. Mismo lenguaje de modal que EvidenceModal. */
function RevealEvidenceModal({
  detail,
  today,
  onClose,
}: {
  detail: RevealDetail | null
  today: string
  onClose: () => void
}) {
  const color = detail ? revealColor(detail.colorKey) : colors.oro
  return (
    <Modal visible={detail != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={[StyleSheet.absoluteFill, styles.modalScrim]} pointerEvents="none" />
        <Pressable style={styles.modalCard} onPress={() => {}}>
          {detail ? (
            <>
              <Text style={styles.modalEyebrow}>La evidencia</Text>
              <View style={styles.modalTitleRow}>
                <View style={[styles.modalTitleDot, { backgroundColor: color }]} />
                <Text style={styles.modalTitle}>{detail.label}</Text>
              </View>

              {/* Qué cuenta + el umbral/estado. */}
              <Text style={styles.revCriterion}>{REVEAL_CRITERION[detail.key] ?? ''}</Text>
              <Text style={styles.revThreshold}>
                {detail.revealed
                  ? `Con ${detail.threshold} días ya cuenta como una constante. Este mes la tienes.`
                  : `Con ${detail.threshold} días ya cuenta como una constante.`}
              </Text>

              {/* La prueba: los días concretos. */}
              <Text style={styles.revProofLabel}>Tus días</Text>
              <RevealDaysGrid days={detail.days} color={color} today={today} />

              {/* Dirección dentro del mes (inicio vs final) como GLANCE: las 4
                  barras + la hairline de tu promedio hablan solas, sin verso que
                  las repita. `direction` se conserva solo como guarda de honestidad
                  (null = datos muy delgados → no dibujar barras ruidosas). */}
              {detail.key === 'deficit' && detail.direction && detail.weeklyDeficit ? (
                <WeekDeficitBars weeks={detail.weeklyDeficit} color={color} />
              ) : null}

              {/* "Lo que sostuviste" (solo déficit revelado, con intensidad) —
                  la CONCLUSIÓN que la usuaria pedía como "déficit total": la
                  intensidad diaria (kcal por debajo de la meta en SUS días), no
                  una suma gastable, + un verso que reencuadra del número al hecho
                  de volver. Reemplaza al rol para no duplicar cierre serif. */}
              {detail.key === 'deficit' &&
              detail.revealed &&
              detail.avgOnDeficitDays != null &&
              detail.avgOnDeficitDays > 0 ? (
                <View style={styles.sustained}>
                  <Text style={styles.sustainedEyebrow}>Lo que sostuviste</Text>
                  <Text style={styles.sustainedLine}>
                    Esos días tu déficit promedio fue de{' '}
                    <Text style={styles.sustainedNum}>{detail.avgOnDeficitDays} kcal</Text>.
                  </Text>
                  <Text style={styles.sustainedVerse}>
                    No es la suma lo que te acerca a bajar de peso. Es que volviste, una y otra vez.
                  </Text>
                </View>
              ) : (
                <Text style={styles.revRole}>
                  {detail.revealed
                    ? (REVEAL_ROLE[detail.key]?.on ?? '')
                    : (REVEAL_ROLE[detail.key]?.off ?? '')}
                </Text>
              )}

              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalClose}>Cerrar</Text>
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
  },
  // 9.4 · carga/error — mismo par cálido de Día (card + Reintentar 44pt).
  stateCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  stateTitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    marginBottom: 6,
  },
  stateBody: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.niebla,
  },
  stateRetry: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.oro,
  },
  stateRetryBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.oroHairline,
  },
  // ── Hero header ───────────────────────────────────────────────
  // Mismo tratamiento que Día ("¿Quién fuiste hoy?"): título de página en
  // tipografía display (Hanken) alineado a la izquierda, y la línea secundaria
  // en Hanken medium / niebla (como la fecha de Día), no serif italic.
  heroHeader: {
    alignItems: 'flex-start',
  },
  // 9.2 · un solo título grande por vista (ver WeekSegment.title).
  heroQuestion: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.displaySm,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: colors.leche,
  },
  heroSubtitle: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // ── Hero constelación ─────────────────────────────────────────
  heroWrap: {
    alignItems: 'center',
    marginTop: 18,
  },
  heroStage: {
    width: '72%',
    maxWidth: HERO_SIZE,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGlow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSign: {
    marginTop: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 34,
    lineHeight: 40,
    color: colors.leche,
    textAlign: 'center',
  },
  heroPct: {
    marginTop: 6,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    fontVariant: ['tabular-nums'],
  },
  heroPctSign: {
    fontFamily: typography.uiBold,
    color: colors.oroSoft,
  },
  // Ancla de significado bajo el "%" (la "unidad" del número, estilo Apple):
  // quieta, niebla, para explicar sin competir con el número héroe.
  heroAnchor: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: typography.sizes.label * typography.lineHeight.body,
    color: colors.niebla,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  // El mecanismo del emblema en el arranque — qué lo hace subir + la promesa
  // de inmutabilidad. Un tono más presente que el ancla (es la respuesta a
  // "¿y yo qué hago para que suba?").
  heroMechanism: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: typography.sizes.label * typography.lineHeight.body,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  heroDelta: {
    marginTop: 6,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.4,
    color: colors.magentaHot,
  },
  heroMessage: {
    marginTop: 12,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 23,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  // ── Listas del héroe: estrella encendida (revelado) / apagada (falta) ──
  // Bloque centrado en pantalla, pero las filas alineadas a la izquierda → los
  // glifos forman una columna limpia que se lee como sistema, no como vitrina.
  revealGroup: {
    marginTop: 26,
    // Justificado a la izquierda: el bloque ocupa todo el ancho del héroe (que
    // centra a sus hijos) y alinea su contenido al margen izquierdo, como el
    // resto de secciones del Mes.
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    // Panel un poco más oscuro que el fondo: apaga el polvo estelar del cosmos
    // detrás del componente para que NO se confunda con las estrellas del medidor.
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingVertical: 22,
    paddingHorizontal: 18,
  },
  revealHeading: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    marginBottom: 16,
  },
  revealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 11,
    paddingVertical: 7,
  },
  revealOnText: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  // El ancla concreta ("18 días"): números en niebla, tabulares, a la derecha.
  revealCount: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  // ── Módulo consolidado: déficit coronado + contexto + sombra + foco ──
  // El déficit (norte): fila propia, estrella mayor, con su proporción.
  deficitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 12,
    paddingVertical: 4,
    marginBottom: 4,
  },
  deficitBody: {
    flex: 1,
    gap: 4,
  },
  deficitLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  // El número es la SEÑAL (el ancla honesta), no una nota al pie gris: leche + peso.
  deficitSubRow: {
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  deficitSub: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  // Chip de dirección (solo al alza) — oro, sin número: "la dirección sí".
  trendChip: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.oroSoft,
  },
  // Veredicto del déficit (voz coach) — serif italic, cálido.
  deficitVerdict: {
    marginTop: 10,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 22,
    color: colors.oroLeche,
  },
  revealDivider: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.oroHairlineSoft,
    marginVertical: 12,
  },
  // Contexto (lo que sostuvo): mismo layout que el déficit (título + sub-label
  // pequeño + estrellitas), un poco más chico para preservar la jerarquía.
  ctxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 11,
    paddingVertical: 6,
  },
  ctxBody: {
    flex: 1,
  },
  ctxLabel: {
    flex: 1,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  // El conteo, anclado a la derecha (compacto, sin medidor).
  ctxCount: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  ctxSub: {
    marginTop: 2,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  // Título de una fila "aún por encender": como el contexto pero en bone (un
  // punto más tenue) para leerse como "todavía no encendida".
  shadowTitle: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  // Medidor de proporción: 10 estrellas fijas (ancho igual en todas las filas).
  dayStars: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 5,
  },
  dayStar: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dayStarDim: {
    backgroundColor: 'rgba(244, 236, 222, 0.12)',
  },
  // La barra de proporción honesta (del módulo de revelados).
  revBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(244, 236, 222, 0.08)',
    overflow: 'hidden',
  },
  revBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  // "Aún en sombra" — lo pendiente, en tono callado (aro hueco, no estrella).
  shadowHeading: {
    marginTop: 2,
    marginBottom: 12,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    // Oro (oroSoft) como los demás eyebrows de Mes — antes gris (inconsistente
    // con "Lo que sostuviste este mes", que sí va en oro).
    color: colors.oroSoft,
  },
  // Encabezado de las dimensiones de contexto (bajo el déficit) — más tenue que
  // el título de sección, para que el déficit siga siendo el héroe.
  accompHeading: {
    marginTop: 2,
    marginBottom: 12,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  shadowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 11,
    paddingVertical: 6,
  },
  hollowStar: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.bruma,
  },
  shadowLabel: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  shadowCount: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.bruma,
    fontVariant: ['tabular-nums'],
  },
  // El FOCO — separado por una regla; el "para qué" del módulo.
  focusBlock: {
    alignSelf: 'stretch',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.oroHairlineSoft,
  },
  focusEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    marginBottom: 7,
  },
  focusText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 23,
    color: colors.bone,
  },
  // Aún nada revelado: línea de anticipación cálida (voz observadora), no huecos.
  revealAwait: {
    marginTop: 24,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 23,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  // ── Tiempos de la historia (T2, T3): cada uno abre con su pregunta humana ──
  beat: {
    marginTop: 8,
  },
  // La pregunta que abre el tiempo — voz de coach (serif italic), como capítulo.
  beatQuestion: {
    marginTop: 34,
    marginLeft: 2,
    marginBottom: 2,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    lineHeight: 28,
    color: colors.leche,
  },
  // ── "Ver más" contextual (el detalle vive detrás de un toque) ──────
  collapse: {
    alignSelf: 'stretch',
    marginTop: 12,
  },
  collapseToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  collapseLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.oroSoft,
    letterSpacing: 0.3,
  },
  collapseChevron: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.oroSoft,
  },
  collapseBody: {
    marginTop: 4,
  },
  // La frase-resumen del héroe ("Lo encendieron tu déficit y tu sueño").
  revealSummary: {
    marginTop: -4,
    marginBottom: 4,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  // ── Secciones ─────────────────────────────────────────────────
  section: {
    marginTop: 30,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    marginBottom: 14,
    marginLeft: 2,
  },
  // Línea serif (voz de coach) que corona la sección protagonista: la enmarca
  // sin gritar. Se sienta justo bajo el eyebrow (que ya trae su marginBottom).
  // Lede funcional (describe la sección) — etiqueta de datos, NO voz emocional de
  // coach → Hanken, no serif italic. Las FRASES de los patrones sí van en serif.
  sectionLede: {
    marginTop: -8,
    marginBottom: 18,
    marginLeft: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.niebla,
  },
  // Estado vacío honesto de "Tus patrones": calmo, sin patrón débil de relleno.
  patternsEmpty: {
    marginTop: 6,
    marginLeft: 2,
  },
  patternsEmptyLede: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  patternsEmptyBody: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.niebla,
  },
  // Siluetas de descubrimiento — bloqueado-pero-visible: estrellas tenues
  // sin encender, mismo lenguaje que los días sin datos del calendario.
  patternSilhouettes: {
    marginTop: 14,
    gap: 10,
  },
  patternSilhouetteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  patternSilhouetteStar: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1,
    borderColor: colors.bone,
    opacity: 0.45,
  },
  patternSilhouetteText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  patternsEmptyHorizon: {
    marginTop: 14,
    fontFamily: typography.ui,
    fontSize: typography.sizes.caption,
    lineHeight: 18,
    color: colors.niebla,
  },
  // ── Tu presencia — sistema separado ───────────────────────────
  presenceCard: {
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 18,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  presenceLede: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 22,
    color: colors.bone,
  },
  presenceRows: {
    marginTop: 14,
    gap: 2,
  },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
  },
  presenceLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  presenceValue: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  // ── Tus patrones — el patrón dominante (constelación) ────────
  // La tarjeta protagonista: más cuerpo y un borde oro tenue para coronarla sin
  // badge de ranking. La constelación tappable vive dentro.
  dominantCard: {
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 20,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
  },
  // Borde que respira (highlight de "tócame"): overlay con su propio borde oro,
  // opacidad animada. No captura toques (la card entera es el Pressable).
  dominantGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.oroSoft,
  },
  // La línea única de conteo (reemplaza chip + count): dato honesto, Hanken.
  dominantLine: {
    marginTop: 14,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  // El asterismo `*—*—*` de la card (astros conectados + etiquetas).
  asterism: {
    marginTop: 20,
    width: '100%',
  },
  asterismLabels: {
    height: 14,
    marginTop: 4,
  },
  asterismLabel: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    color: colors.niebla,
  },
  // "Volver arriba" al final del recorrido: pill sobrio, centrado, sin peso.
  backTop: {
    marginTop: 36,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  backTopArrow: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.oroSoft,
  },
  backTopText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // Encabezado del calendario: UN solo bloque en el riel izquierdo (categoría →
  // el MES como título navegable → la pregunta-lede). El mes es el protagonista.
  // Panel un poco más oscuro (igual que el grupo de constancias): apaga el polvo
  // estelar del fondo bajo el calendario para que sus puntos-día no se confundan
  // con las estrellas del cosmos.
  glancePanel: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  calHeader: {
    marginLeft: 2,
  },
  monthPagerRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthTitle: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.headingLg,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  monthArrow: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.segmentTitle,
    lineHeight: 24,
    color: colors.oroSoft,
  },
  monthArrowOff: {
    color: colors.hairline,
  },
  calQuestion: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.niebla,
  },
  // Estado vacío: MISMO frame (el header no cambia); sin título display para que
  // no parezca otra tarjeta, solo una línea cálida bajo la pregunta.
  monthEmpty: {
    marginTop: 20,
    marginLeft: 2,
  },
  monthEmptyBody: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
  },
  monthEmptyHint: {
    marginTop: 8,
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  dominantEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  // CTA "Ver la revelación →": la afordancia de que la card es tappable.
  discoverCta: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  discoverCtaText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
    color: colors.oroSoft,
  },
  discoverCtaArrow: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.oroSoft,
  },
  // Procedencia: acción secundaria, discreta (niebla, no oro) — factual, con
  // evidencia, sin poesía. No compite con "Ver la revelación".
  provenanceRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  provenanceText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  provenanceChevron: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.tinyLabel,
    color: colors.niebla,
  },
  // La frase serif es la protagonista: aquí vive el patrón (voz Observadora).
  dominantPhrase: {
    marginTop: 12,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 21,
    lineHeight: 29,
    color: colors.leche,
  },
  // Chip de conteo — el dato que ancla el patrón (DATOS, Hanken upright).
  dominantChip: {
    marginTop: 18,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  dominantChipText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  dominantChipNum: {
    fontFamily: typography.uiBold,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  dominantCount: {
    marginTop: 12,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 22,
    color: colors.niebla,
  },
  dominantCta: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dominantCtaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    letterSpacing: 0.6,
    color: colors.oroSoft,
  },
  dominantCtaArrow: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.oroSoft,
  },
  // ── Patrones de apoyo — tarjetas de hallazgo ─────────────────
  // Tarjeta con cuerpo y mucho aire: el patrón respira (Apple + Notion).
  findingCard: {
    marginTop: 12,
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 20,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  // Eyebrow del primero cuando NO hay combo: lo corona sin badge de ranking.
  findingEyebrow: {
    marginBottom: 12,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  findingGlyph: {
    marginBottom: 12,
    height: 26,
    width: 26,
    justifyContent: 'center',
  },
  // La frase serif es la protagonista: aquí vive el descubrimiento.
  findingTitle: {
    // Hanken, no serif italic: es una observación de dato, no voz de coach.
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.heading,
    lineHeight: 25,
    color: colors.leche,
  },
  findingCta: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  findingCtaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    letterSpacing: 0.6,
    color: colors.oroSoft,
  },
  findingCtaArrow: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.oroSoft,
  },
  // ── Lo que aún no sabemos ─────────────────────────────────────
  unknownCard: {
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 18,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  unknownLead: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
  },
  unknownChips: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  unknownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  // Anillo vacío (○) — el espacio aún sin llenar, sin culpa.
  unknownRing: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.4,
    borderColor: colors.niebla,
  },
  unknownChipLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  unknownHint: {
    marginTop: 16,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    lineHeight: 21,
    color: colors.bone,
  },
  // ── Frase final ───────────────────────────────────────────────
  finalWrap: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  finalRule: {
    width: 36,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.oroHairline,
    marginBottom: 18,
  },
  finalText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.headingLg,
    lineHeight: 28,
    color: colors.bone,
    textAlign: 'center',
  },
  // ── Modal de evidencia ────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  // Velo cálido sobre el blur (no negro plano): mantiene la temperatura de
  // Stelar y oscurece lo justo para que el modal flote.
  modalScrim: {
    backgroundColor: 'rgba(10, 6, 8, 0.55)',
  },
  modalCard: {
    width: '100%',
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 24,
    backgroundColor: colors.bgCard2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
    // Elevación suave para que el modal se despegue del blur (iOS; en Android
    // el blur + scrim ya dan separación).
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  modalEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  // La misma estrella de la dimensión que viste en la lista te recibe en el
  // modal (continuidad de identidad por color).
  modalTitleRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  modalTitleDot: {
    marginTop: 9,
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  modalTitle: {
    flex: 1,
    // Hanken: el hallazgo es dato, no frase emocional.
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.heading,
    lineHeight: 24,
    color: colors.leche,
  },
  bars: {
    marginTop: 18,
    gap: 10,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    width: 86,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(244, 236, 222, 0.06)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.oroHairline,
  },
  barValue: {
    width: 68,
    textAlign: 'right',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  barValueHi: {
    fontFamily: typography.uiBold,
    color: colors.leche,
  },
  // El denominador va atenuado para que el número grande pese.
  barValueTotal: {
    fontFamily: typography.ui,
    color: colors.niebla,
  },
  // ── Forma de tu semana (7 columnas) ──────────────────────────
  shapeWrap: {
    marginTop: 20,
  },
  shapeHeading: {
    marginBottom: 12,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  shapeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  shapeCol: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  shapeTrack: {
    width: '100%',
    height: 54,
    borderRadius: 5,
    backgroundColor: 'rgba(244, 236, 222, 0.06)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  shapeFill: {
    width: '100%',
    borderRadius: 5,
  },
  shapeDow: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
  shapeDowHi: {
    fontFamily: typography.uiBold,
    color: colors.bone,
  },
  modalCaption: {
    marginTop: 16,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 18,
    color: colors.bone,
  },
  // Las fechas concretas que anclan el conteo (la prueba, en tabulares).
  modalDates: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  // Nota al pie de las señales sin registro — neutra, sin culpa.
  modalZeroNote: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 18,
    color: colors.niebla,
  },
  // "Por qué importa" — serif (voz Observadora) cerrando el detalle del patrón.
  // "Por qué importa" — reflexión funcional (el rol/lever), no la frase-conclusión
  // de coach → Hanken (regla estricta: solo la conclusión va en serif).
  modalWhy: {
    marginTop: 16,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
  },
  modalCloseBtn: {
    marginTop: 20,
    alignSelf: 'center',
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  modalClose: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    color: colors.bone,
  },
  // Chevron de "esto abre evidencia" en la fila del déficit (héroe).
  revChevron: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.segmentTitle,
    color: colors.bruma,
    marginLeft: 4,
  },
  // Chevron más chico para las filas de contexto y "en sombra".
  revChevronSm: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.heading,
    color: colors.bruma,
    marginLeft: 4,
  },
  // ── Modal de evidencia de un reveal ───────────────────────────────
  revCriterion: {
    marginTop: 16,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: typography.sizes.bodyLarge * 1.45,
    color: colors.bone,
  },
  revThreshold: {
    marginTop: 8,
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    lineHeight: typography.sizes.body * 1.45,
    color: colors.niebla,
  },
  revProofLabel: {
    marginTop: 20,
    marginBottom: 10,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  revRole: {
    marginTop: 18,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 23,
    color: colors.bone,
  },
  // "Lo que sostuviste" — cierre de intensidad del déficit (solo déficit).
  sustained: {
    alignSelf: 'stretch',
    marginTop: 18,
  },
  sustainedEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 8,
  },
  // El dato duro (intensidad diaria) en Inter; el número en oro, no héroe.
  sustainedLine: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: typography.sizes.body * typography.lineHeight.body,
    color: colors.bone,
  },
  sustainedNum: {
    fontFamily: typography.uiBold,
    color: colors.oroLeche,
    fontVariant: ['tabular-nums'],
  },
  // El verso que reencuadra del número al hecho (voz de coach, serif italic).
  sustainedVerse: {
    marginTop: 10,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 23,
    color: colors.bone,
  },
  // Mini-calendario de días, 7 columnas (lun→dom). Full-width: ocupa todo el
  // ancho de la tarjeta y las celdas escalan (ancho medido en onLayout).
  revGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: REVEAL_GRID_GAP,
    alignSelf: 'stretch',
  },
  // Hueco de alineación (día de semana antes del primer día real): invisible.
  revCellBlank: {
    backgroundColor: 'transparent',
  },
  // Cuadro del calendario (sin número): encendido = color pleno; el resto, tenue.
  revCell: {
    width: 22,
    height: 20,
    borderRadius: 5,
  },
  revCellPast: {
    backgroundColor: 'rgba(244, 236, 222, 0.05)',
  },
  // El rango de la ventana bajo la rejilla ("Del 2 jun al 1 jul") — deja claro que
  // no es un mes calendario sino los últimos 31 días.
  revRange: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  // Barras de las 4 semanas del mes (días en déficit) + hairline de promedio.
  wdWrap: {
    alignSelf: 'stretch',
    marginTop: 18,
  },
  wdChart: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  wdBar: {
    width: 30,
    borderRadius: 6,
  },
  // La hairline del promedio del mes (referencia descriptiva, no meta a batir).
  wdAvgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(244, 236, 222, 0.4)',
  },
  wdEnds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  wdEndLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  wdLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  wdLegendDash: {
    width: 14,
    height: 1,
    backgroundColor: 'rgba(244, 236, 222, 0.4)',
  },
})
