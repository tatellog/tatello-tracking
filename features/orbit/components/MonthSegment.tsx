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
import { RevealedEmblem } from '@/features/tabs/components/constellation/RevealedEmblem'
import { signName, zodiacFromDate } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { useMacroTargets } from '@/features/macros/hooks'
import { GLASS_ML, useWaterGoal } from '@/features/water/useWaterGoal'
import { todayInTimezone } from '@/lib/time'

import { useHasAnySignals, useSignalsHistory } from '../hooks'
import {
  detectMonthPatterns,
  finalPhrase,
  monthCalendar,
  monthReveals,
  presenceSummary,
  revealDayMap,
  winningCombo,
  type EvidenceBar,
  type MonthPattern,
  type MonthReveals,
  type WinningCombo as WinningComboData,
} from '../month-built'
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

/* El detalle al tocar una fila de "Lo que sostuviste este mes". */
type RevealDetail = {
  key: string
  label: string
  colorKey: string
  revealed: boolean
  count: number
  threshold: number
  days: string[]
}

/** Qué CUENTA como cada dimensión (criterio transparente, sin jerga). */
const REVEAL_CRITERION: Record<string, string> = {
  deficit: 'Un día cuenta cuando comiste dentro de tu rango sano.',
  sueno: 'Una noche cuenta cuando dormiste alrededor de 7 horas.',
  registro: 'Un día cuenta cuando registraste tu comida.',
  proteina: 'Un día cuenta cuando alcanzaste tu meta de proteína.',
  agua: 'Un día cuenta cuando llegaste a tu meta de agua.',
  movimiento: 'Un día cuenta cuando entrenaste.',
}
/** El ROL de cada dimensión (por qué importa) — observacional, sin recetar. */
const REVEAL_ROLE: Record<string, string> = {
  deficit: 'Es tu palanca principal hacia la pérdida de peso.',
  sueno: 'Sostuvo tu constancia este mes.',
  registro: 'Sostuvo tu constancia este mes.',
  proteina: 'Acompaña tu déficit, mes a mes.',
  agua: 'Sostuvo tu constancia este mes.',
  movimiento: 'Sostuvo tu constancia este mes.',
}

/** Una estrellita de 4 puntas con pequeño flare — el "día" de la parrilla.
 *  Encendida: color pleno + halo tenue (el flare). Apagada: estrella diminuta y
 *  muy tenue (el día que no contó). */
function DayStar({ on, color }: { on: boolean; color: string }) {
  return (
    <Svg width={9} height={9} pointerEvents="none">
      {on ? <Circle cx={4.5} cy={4.5} r={4.5} fill={color} opacity={0.16} /> : null}
      <Path d={fourPointStarPath(4.5, 4.5, on ? 3.2 : 2.2)} fill={color} opacity={on ? 1 : 0.26} />
    </Svg>
  )
}

/** "Días como estrellas": una estrellita por día del denominador; los sostenidos
 *  encendidos (encendiéndose en secuencia al entrar), el resto tenues. Se VE la
 *  proporción "16 de 27" sin barra ni cálculo mental. */
function DayStars({ count, total, color }: { count: number; total: number; color: string }) {
  const n = Math.max(0, Math.min(60, total)) // techo de cordura
  const lit = Math.max(0, Math.min(n, count))
  return (
    <View style={styles.dayStars}>
      {Array.from({ length: n }, (_, i) =>
        i < lit ? (
          <Animated.View key={i} entering={FadeIn.duration(220).delay(Math.min(i, 24) * 22)}>
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
  const { data: history } = useSignalsHistory(31)
  const signals = useMemo(() => history ?? [], [history])
  // Los PATRONES son acumulativos: se aprenden con el tiempo, no pertenecen a un
  // mes calendario (si no, se borrarían cada día 1). Leen una ventana larga (90d),
  // no monthSignals. El calendario y el KPI sí son del mes en curso.
  const { data: longHistory } = useSignalsHistory(90)
  const patternSignals = useMemo(() => longHistory ?? [], [longHistory])

  const targets = useMacroTargets().data
  const proteinTarget = targets?.protein_g ?? null
  const calorieTarget = targets?.calories ?? null
  const { goalMl } = useWaterGoal()
  const waterGoalGlasses = Math.max(1, Math.round(goalMl / GLASS_ML))

  // El KPI de déficit y el calendario "Tu mes de un vistazo" hablan del MES EN
  // CURSO (no de la ventana rodante de 31 días), así sus conteos coinciden
  // exactamente: mismos días-con-comida, mismos días en déficit.
  const today = todayInTimezone()
  const monthStr = today.slice(0, 7) // 'YYYY-MM'
  const monthSignals = useMemo(
    () => signals.filter((s) => s.day != null && s.day.startsWith(monthStr)),
    [signals, monthStr],
  )

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
  const glance = useMemo(
    () => monthCalendar(calendarSignals, { today: calendarToday, calorieTarget }),
    [calendarSignals, calendarToday, calorieTarget],
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
      return false
    }
    const PRIORITY: Record<string, number> = {
      'sleep-deficit': 0,
      'deficit-weekday': 1,
      'training-protein': 2,
      'weekend-surplus': 3,
    }
    return detectMonthPatterns(patternSignals, { calorieTarget, proteinTarget })
      .filter((p) => p.kind === 'pattern' && !coveredByCombo(p.id))
      .sort((a, b) => (PRIORITY[a.id] ?? 9) - (PRIORITY[b.id] ?? 9))
      .slice(0, combo ? 2 : 3)
  }, [patternSignals, calorieTarget, proteinTarget, combo])
  // Sistema PRESENCIA: separado del progreso físico.
  const presence = useMemo(() => presenceSummary(signals), [signals])
  const phrase = useMemo(() => finalPhrase(signals), [signals])

  // Hero — la constelación del signo revelándose por los puntos de
  // transformación (suma de hábitos del mes), y cuánto subió este mes.
  const { data: profile } = useProfile()
  const sign = profile ? zodiacFromDate(profile.date_of_birth) : null
  const { progress, stage } = useTransformProgress()
  const firstOfMonth = `${todayInTimezone().slice(0, 8)}01`
  const { progress: prevProgress } = useTransformProgressAsOf(firstOfMonth)
  const delta = prevProgress != null ? Math.max(0, progress - prevProgress) : null
  // Las dos listas del héroe: lo que se reveló este mes (★) y lo que falta (○).
  const reveals = useMemo(
    () => monthReveals(signals, { calorieTarget, proteinTarget, waterGoalGlasses }),
    [signals, calorieTarget, proteinTarget, waterGoalGlasses],
  )
  // Los días concretos por dimensión — la evidencia al tocar una fila del héroe.
  // Usa monthSignals porque la rejilla del modal (RevealDaysGrid) es del mes en
  // curso; alimentarla con 31d pondría días de otro mes que no caben en la rejilla.
  const revealDays = useMemo(
    () => revealDayMap(monthSignals, { calorieTarget, proteinTarget, waterGoalGlasses }),
    [monthSignals, calorieTarget, proteinTarget, waterGoalGlasses],
  )

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
    })

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
      <View style={styles.beat}>
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
          <Text style={styles.calQuestion}>¿En qué días estuviste en déficit?</Text>
        </View>

        {glance ? (
          <MonthGlanceCalendar data={glance} onPickDay={onPickDay} />
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

      {/* ── Tiempo 3 · ¿Qué hago distinto el próximo mes? — UN foco (la palanca
          más cerca de encender), y los patrones como su evidencia/por qué. */}
      {combo || supportPatterns.length > 0 ? (
        <View style={styles.beat}>
          {/* El bloque "Tu foco" se quitó (decisión dueña). El tiempo 3 abre con
              los patrones. */}
          {/* Los patrones = la evidencia/"por qué". Siempre visibles
              (decisión dueña): sin colapsable. */}
          {combo || supportPatterns.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.eyebrow}>Tus patrones</Text>
              <Text style={styles.sectionLede}>Lo que apareció junto en tus días.</Text>
              {combo ? (
                <DominantPatternCard combo={combo} onOpen={() => setReveal(comboReveal(combo))} />
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
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Tiempo 4 · ¿Sigo así? — el cierre emocional (volver sin culpa). */}
      {presence ? <PresenceFinale presence={presence} phrase={phrase} /> : null}

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
  onOpenReveal,
}: {
  sign: ZodiacSign
  progress: number
  delta: number | null
  message: string
  reveals: MonthReveals
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

  // "Tap me": los chevrons de las filas hacen un nudge suave (se corren y se
  // encienden) para invitar al toque. Gateado (foco + reduced-motion).
  const nudge = useSharedValue(0)
  useEffect(() => {
    if (!active || reduce) {
      cancelAnimation(nudge)
      nudge.value = withTiming(0, { duration: 300 })
      return
    }
    nudge.value = withRepeat(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(nudge)
  }, [active, reduce, nudge])
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: nudge.value * 3 }],
    opacity: 0.5 + nudge.value * 0.45,
  }))

  // El módulo "Lo que encendió tu cielo" (consolidado): el déficit coronado
  // aparte (norte), el resto de dimensiones como contexto, las pendientes "en
  // sombra" (absorben la vieja sección "Lo que aún no sabemos"), y una línea de
  // FOCO ("lo más cerca de encender"). "Registro" sale del módulo (es presencia,
  // no transformación → vive en "Tu presencia").
  const deficitLit = reveals.revealed.find((r) => r.key === 'deficit') ?? null
  const ctxLit = reveals.revealed.filter((r) => r.key !== 'deficit' && r.key !== 'registro')
  const shadow = reveals.pending
    .filter((r) => r.key !== 'registro')
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
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
      {/* % revelado — el reveal del arte ES la barra; el número acompaña. */}
      <Text style={styles.heroPct}>
        {progress}
        <Text style={styles.heroPctSign}>% revelado</Text>
      </Text>
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
              accessibilityLabel={`Déficit constante, ${deficitLit.count} de ${deficitLit.total} días con comida. Ver evidencia.`}
              onPress={() => onOpenReveal?.(deficitLit, true)}
            >
              <DiscoveryStar color={revealColor('deficit')} mag={0.72} size={26} />
              <View style={styles.deficitBody}>
                <Text style={styles.deficitLabel}>{deficitLit.label}</Text>
                <Text style={styles.deficitSub}>
                  {deficitLit.count} de {deficitLit.total} días con comida
                </Text>
                <DayStars
                  count={deficitLit.count}
                  total={deficitLit.total}
                  color={revealColor('deficit')}
                />
              </View>
              <Animated.Text style={[styles.revChevron, chevronStyle]}>›</Animated.Text>
            </Pressable>
          ) : null}

          {deficitLit && ctxLit.length > 0 ? <View style={styles.revealDivider} /> : null}

          {/* Lo que lo sostuvo (contexto): mismo lenguaje de días-estrella, más
              chico. El conteo ancla el número exacto a la derecha. */}
          {ctxLit.map((it, i) => (
            <AnimatedPressable
              key={it.key}
              entering={FadeIn.duration(360).delay(i * 80)}
              style={styles.ctxRow}
              accessibilityRole="button"
              accessibilityLabel={`${it.label}, ${it.count} de ${it.total} días. Ver evidencia.`}
              onPress={() => onOpenReveal?.(it, true)}
            >
              <DiscoveryStar color={revealColor(it.colorKey)} mag={0.5} size={18} />
              <View style={styles.ctxBody}>
                <Text style={styles.ctxLabel}>{it.label}</Text>
                <Text style={styles.ctxSub}>
                  {it.count} de {it.total} {it.key === 'sueno' ? 'noches' : 'días'}
                </Text>
                <DayStars count={it.count} total={it.total} color={revealColor(it.colorKey)} />
              </View>
              <Animated.Text style={[styles.revChevronSm, chevronStyle]}>›</Animated.Text>
            </AnimatedPressable>
          ))}

          {/* Aún por encender (lo pendiente): MISMO lenguaje que las encendidas
              (estrella + título + sub + estrellitas), pero el denominador es el
              UMBRAL (8) → se ve "6 de 8, te faltan 2". Estrella tenue: aún no
              enciende. Nunca en tono de reproche. */}
          {shadow.length > 0 ? (
            <>
              <Text style={styles.shadowHeading}>Aún por encender</Text>
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
                        ? `${it.count} de ${REVEAL_THRESHOLD} · te faltan ${REVEAL_THRESHOLD - it.count} para encender`
                        : 'Apenas empieza'}
                    </Text>
                    <DayStars
                      count={it.count}
                      total={REVEAL_THRESHOLD}
                      color={revealColor(it.colorKey)}
                    />
                  </View>
                  <Animated.Text style={[styles.revChevronSm, chevronStyle]}>›</Animated.Text>
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

/* Verbos naturales por hábito para NOMBRAR el combo en la frase (no etiquetas
 * sueltas): "Entrenar y tomar tu agua fueron de la mano con tu déficit." */
const COMBO_VERB: Record<string, string> = {
  cuerpo: 'entrenar',
  agua: 'hidratarte',
  sueno: 'dormir bien',
  proteina: 'cuidar tu proteína',
}

/** La frase que NOMBRA el combo (sin genéricos "estas señales"). El combo es
 *  siempre ≥2 hábitos → verbo plural ("fueron"). Voz Observadora: "de la mano
 *  con", nunca causa. */
function comboPhrase(combo: WinningComboData): string {
  const verbs = combo.signals.map((s) => COMBO_VERB[s.key] ?? s.label.toLowerCase())
  if (verbs.length === 0) return ''
  const last = verbs[verbs.length - 1]!
  // "e" antes de sonido i- ("entrenar e hidratarte"); "y" en el resto.
  const conj = /^h?i/i.test(last) ? 'e' : 'y'
  const list = verbs.length > 1 ? `${verbs.slice(0, -1).join(', ')} ${conj} ${last}` : verbs[0]!
  return `${list.charAt(0).toUpperCase() + list.slice(1)} fueron de la mano con tu déficit.`
}

/** Las líneas de la evidencia del patrón: la frase (observación, coach), el
 *  conteo y las fechas (la prueba). Las usa el modal cinemático de revelación. */
type ComboReveal = { phrase: string; countLine: string; takeaway: string }
function comboReveal(combo: WinningComboData): ComboReveal {
  const allDeficit = combo.deficits >= combo.occurrences
  return {
    phrase: comboPhrase(combo),
    countLine: allDeficit
      ? `Coincidieron ${combo.occurrences} días. Los ${combo.occurrences}, en déficit.`
      : `Coincidieron ${combo.occurrences} días. ${combo.deficits}, en déficit.`,
    // El cierre útil (modal): qué significa para ti (una señal en la que apoyarte).
    takeaway: 'Cuando aparecen juntas, es tu señal más confiable.',
  }
}

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
  cuerpo: '#FF9E57',
  agua: colors.leche,
}

/* El patrón dominante: la combinación de hábitos que más fue de la mano con el
 * déficit. La card es una ESCENA DE DESCUBRIMIENTO (PatternDiscovery): una
 * constelación que Stelar traza sola + el insight. Sigue tappable → modal
 * life-line. Highlight que respira en el borde como "tócame". */
function DominantPatternCard({ combo, onOpen }: { combo: WinningComboData; onOpen: () => void }) {
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
              <View style={styles.bars}>
                {shown.map((b, i) => {
                  const barColor = b.colorKey ? (BAR_COLOR[b.colorKey] ?? colors.oro) : colors.oro
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
                              width: `${Math.round((b.value / max) * 100)}%`,
                              backgroundColor: barColor,
                              opacity: b.highlight ? 1 : 0.32,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.barValue, b.highlight ? styles.barValueHi : null]}>
                        {/* Denominador para anclar el número ("18 / 32"). */}
                        {b.value}
                        {b.total != null ? (
                          <Text style={styles.barValueTotal}> / {b.total}</Text>
                        ) : null}
                      </Text>
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
function RevealDaysGrid({ days, color, today }: { days: string[]; color: string; today: string }) {
  const monthStr = today.slice(0, 7)
  const daysInMonth = new Date(
    Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0),
  ).getUTCDate()
  const todayNum = Number(today.slice(8, 10))
  const onSet = new Set(days)
  return (
    <View style={styles.revGrid}>
      {Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1
        const date = `${monthStr}-${String(d).padStart(2, '0')}`
        const on = onSet.has(date)
        const future = d > todayNum
        return (
          <View
            key={d}
            style={[
              styles.revCell,
              on && { backgroundColor: color },
              !on && !future && styles.revCellPast,
            ]}
          >
            <Text
              style={[
                styles.revCellNum,
                on && styles.revCellNumOn,
                future && styles.revCellNumFuture,
              ]}
            >
              {d}
            </Text>
          </View>
        )
      })}
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
  const remaining = detail ? Math.max(0, detail.threshold - detail.count) : 0
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
                  ? `Una dimensión se enciende a los ${detail.threshold} días. Este mes llegaste.`
                  : `Se enciende a los ${detail.threshold} días. Te faltan ${remaining} para encenderla.`}
              </Text>

              {/* La prueba: los días concretos. */}
              <Text style={styles.revProofLabel}>Tus días</Text>
              <RevealDaysGrid days={detail.days} color={color} today={today} />

              {/* El rol (por qué importa). */}
              <Text style={styles.revRole}>{REVEAL_ROLE[detail.key] ?? ''}</Text>

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
  // ── Hero header ───────────────────────────────────────────────
  // Mismo tratamiento que Día ("¿Quién fuiste hoy?"): título de página en
  // tipografía display (Hanken) alineado a la izquierda, y la línea secundaria
  // en Hanken medium / niebla (como la fecha de Día), no serif italic.
  heroHeader: {
    alignItems: 'flex-start',
  },
  heroQuestion: {
    fontFamily: typography.displaySemi,
    fontSize: 27,
    lineHeight: 32,
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
    fontSize: 16,
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
    paddingLeft: 2,
  },
  revealHeading: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    marginBottom: 14,
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
  deficitSub: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
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
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  ctxSub: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  // Título de una fila "aún por encender": como el contexto pero en bone (un
  // punto más tenue) para leerse como "todavía no encendida".
  shadowTitle: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  // Días como estrellas: una por día, encendidas = sostenidas.
  dayStars: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
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
    marginTop: 18,
    marginBottom: 10,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
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
    fontSize: 16,
    lineHeight: 23,
    color: colors.bone,
  },
  // Aún nada revelado: línea de anticipación cálida (voz observadora), no huecos.
  revealAwait: {
    marginTop: 24,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 16,
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
    fontSize: 22,
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
    fontSize: 13,
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
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
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
    fontSize: 16,
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
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  monthArrow: {
    fontFamily: typography.uiMedium,
    fontSize: 22,
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
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 20,
    lineHeight: 28,
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
    fontSize: 15,
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
    fontSize: 20,
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
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 21,
    lineHeight: 27,
    color: colors.leche,
  },
  bars: {
    marginTop: 18,
    gap: 10,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barLabel: {
    width: 74,
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
    width: 52,
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
    color: colors.niebla,
    marginLeft: 4,
  },
  // Chevron más chico para las filas de contexto y "en sombra".
  revChevronSm: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.heading,
    color: colors.niebla,
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
    fontSize: 16,
    lineHeight: 23,
    color: colors.bone,
  },
  // Mini-calendario de días.
  revGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  revCell: {
    width: 28,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revCellPast: {
    backgroundColor: 'rgba(244, 236, 222, 0.05)',
  },
  revCellNum: {
    fontFamily: typography.uiSemi,
    fontSize: 11,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  revCellNumOn: {
    color: '#0A0608',
    fontFamily: typography.uiBold,
  },
  revCellNumFuture: {
    color: colors.bruma,
  },
})
