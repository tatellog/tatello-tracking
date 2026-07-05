import { BlurView } from 'expo-blur'
import { useMemo, useState, type ReactNode } from 'react'
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'

import Svg, {
  Circle as SvgCircle,
  Defs as SvgDefs,
  RadialGradient as SvgRadialGradient,
  Stop as SvgStop,
} from 'react-native-svg'

import { EmText } from '@/components/EmText'
import { usePressFeedback } from '@/components/ui/interaction'
import { useMacroTargets } from '@/features/macros/hooks'
import { colors, typography } from '@/theme'

import { WEEK_BASELINE_COPY, weekBaselineObservations } from '../baseline'
import { useIsoWeekSignals, useSignalsHistory } from '../hooks'
import {
  buildWeekDimensions,
  dayTimeline,
  daysAhead as computeDaysAhead,
  dimDeficitBridge,
  dimObservation,
  dimensionLine,
  emergingEvidence,
  mainDiscovery,
  mondayOf,
  needsMoreEvidence,
  weekAbsences,
  weekDirection,
  weekLever,
  weekSeal,
  weekSilhouette,
  type DayCell,
  type DayTimelineRow,
  type DiscoveryArchetype,
  type DiscoveryTimeline,
  type MainDiscovery,
  type WeekDimKey,
  type WeekLever,
} from '../week-orbit-logic'
import { consumeWeekFocus } from '../pending-week-focus'
import { EmptySegmentCard } from './EmptySegmentCard'
import { WeekOrbitGalaxy } from './WeekOrbitGalaxy'
import { WeekProgressHero } from './WeekProgressHero'
import { WeekSilhouette } from './WeekSilhouette'
import { hexA, WEEK_DIM_COLOR } from './week-dim-visual'

/* El símbolo del descubrimiento usa EL MISMO arte que Órbita Día (las 7
 * ilustraciones de estado), para que constancia/energía/etc. se vean idénticas
 * entre Día y Semana. Cada arquetipo de Semana mapea a su estado de Día más
 * cercano + su color (mismo criterio de color que Día). */
const DISCOVERY_ART: Record<DiscoveryArchetype, number> = {
  constancia: require('@/assets/icons/orbit-day/constancia.png'),
  comienzo: require('@/assets/icons/orbit-day/presencia.png'),
  movimiento: require('@/assets/icons/orbit-day/energia.png'),
  nutricion: require('@/assets/icons/orbit-day/nutricion.png'),
  proteina: require('@/assets/icons/orbit-day/nutricion.png'),
  descanso: require('@/assets/icons/orbit-day/recuperacion.png'),
  hidratacion: require('@/assets/icons/orbit-day/equilibrio.png'),
  energia: require('@/assets/icons/orbit-day/energia.png'),
}

const DISCOVERY_COLOR: Record<DiscoveryArchetype, string> = {
  constancia: colors.magentaHot,
  comienzo: colors.oroSoft,
  movimiento: colors.signal.entreno,
  nutricion: colors.dimension.alimento,
  proteina: colors.dimension.alimento,
  descanso: colors.dimension.sueno,
  hidratacion: colors.leche,
  energia: colors.signal.entreno,
}

/*
 * Órbita · Semana (v2 · evidencia sin IA) — "¿Qué empezó a repetirse esta
 * semana?".
 *
 * No es un dashboard: es EVIDENCIA convertida en descubrimiento. Cada
 * conclusión sale de daily_signals y se puede explicar ("¿Por qué?"). No
 * interpreta, no diagnostica, no inventa; observa, nunca afirma causa.
 * Secciones (ver docs/orbita-semana-spec.md): §1 descubrimiento principal
 * (co-ocurrencia, híbrido) → §2 el cielo semanal (galaxia) → §3 evidencia
 * emergente → §4 lo que podemos confirmar → §5 lo que aún necesita más
 * evidencia → §6 la semana día por día → §7 la ausencia → §8 repetir la
 * próxima semana.
 */
export function WeekSegment({
  onOpenMes,
  onPickDay,
  onScrollTop,
}: {
  onOpenMes?: () => void
  /** Abrir un día de la semana en Órbita Día (lo dispara la tira de 7 días). */
  onPickDay?: (date: string) => void
  /** Volver al inicio del scroll (botón al final del recorrido). */
  onScrollTop?: () => void
}) {
  const { data: signals, todayIso, isLoading, isError, refetch } = useIsoWeekSignals()
  const macros = useMacroTargets()
  const proteinTarget = macros.data?.protein_g ?? null
  // La meta calórica habilita la evidencia de déficit (co-ocurrencias, §3-§6).
  // Sin ella, esas observaciones simplemente no aparecen (degradación segura).
  const calorieTarget = macros.data?.calories ?? null
  const ctx = useMemo(() => ({ proteinTarget, calorieTarget }), [proteinTarget, calorieTarget])

  const week = useMemo(() => signals ?? [], [signals])
  // Primera semana CON DATOS (sin señal alguna antes del lunes): gatea el
  // marco temporal del hero (5.1) y recorta denominadores/celdas al primer
  // día con señal (5.2). En el día 2 de uso, "1 día por delante" y "2 de 6
  // días" juzgan días en los que la app no existía en su vida.
  const monday = mondayOf(todayIso)
  const firstWeekOfData = useMemo(
    () => !week.some((s) => s.day != null && s.day < monday),
    [week, monday],
  )
  const denomFrom = useMemo(() => {
    if (!firstWeekOfData) return undefined
    let min: string | undefined
    for (const s of week) if (s.day != null && (min == null || s.day < min)) min = s.day
    return min
  }, [firstWeekOfData, week])
  const dims = useMemo(
    () => buildWeekDimensions(week, todayIso, ctx, denomFrom),
    [week, todayIso, ctx, denomFrom],
  )
  const discovery = useMemo(() => mainDiscovery(week, todayIso, ctx), [week, todayIso, ctx])
  // §3 evidencia emergente · §4 hechos · §5 honestidad · §6 día por día · §8.
  // §0 · rumbo de la semana vs la pasada (dirección, no conteo). null en la
  // primera semana medible → el hero muestra solo la ventana abierta.
  const direction = useMemo(() => weekDirection(week, todayIso, ctx), [week, todayIso, ctx])
  // §S · la silueta de los 7 días (la forma del tramo).
  const silhouette = useMemo(() => weekSilhouette(week, todayIso, ctx), [week, todayIso, ctx])
  // El sello de la semana pasada — solo el lunes (la cita: ese día siempre
  // hay algo nuevo). La ventana de 2 semanas ya trae la semana sellada.
  const seal = useMemo(() => weekSeal(week, todayIso, ctx), [week, todayIso, ctx])
  const sealCells = useMemo(
    () => (seal ? weekSilhouette(week, seal.prevSunday, ctx) : null),
    [seal, week, ctx],
  )
  const emerging = useMemo(() => emergingEvidence(week, todayIso, ctx), [week, todayIso, ctx])
  // Baseline "esta semana vs tu costumbre" (sueño, energía) — necesita historial
  // más largo que la ventana de 2 semanas; el detector filtra a los días previos
  // al lunes de esta semana. Comparación SIEMPRE contigo misma (Apple "Typical").
  const { data: historyData } = useSignalsHistory(35)
  const baseline = useMemo(() => {
    const history = historyData ?? []
    const monday = mondayOf(todayIso)
    const thisWeek = week.filter((s) => s.day != null && s.day >= monday && s.day <= todayIso)
    return weekBaselineObservations(thisWeek, history, monday)
  }, [historyData, week, todayIso])
  const moreEvidence = useMemo(() => needsMoreEvidence(week, todayIso, ctx), [week, todayIso, ctx])
  const timeline = useMemo(() => dayTimeline(week, todayIso, ctx), [week, todayIso, ctx])
  const lever = useMemo(() => weekLever(week, todayIso, ctx), [week, todayIso, ctx])
  const absences = useMemo(() => weekAbsences(week, todayIso), [week, todayIso])

  const hasEvidence = dims.some((d) => d.present > 0)
  // La galaxia muestra solo señales con presencia; las que nunca aparecieron
  // bajan a "La ausencia" (un planeta de 0 días se leería como falla).
  const galaxyDims = useMemo(() => dims.filter((d) => d.present > 0), [dims])

  // Planeta enfocado (tocado) → su panel de días. Arranca con el deep-link de
  // patrón ("Verlo en mi órbita") si lo hubo (one-shot).
  const [focusedDim, setFocusedDim] = useState<WeekDimKey | null>(() => consumeWeekFocus())
  const focused = focusedDim ? (dims.find((d) => d.key === focusedDim) ?? null) : null
  // 9.5 · la galaxia se gana su despliegue con historia (≥2 señales con ≥3
  // días); antes, colapsada tras un tap. Un deep-link de patrón la abre.
  const galaxyHasStory = galaxyDims.filter((d) => d.present >= 3).length >= 2
  const [galaxyOpen, setGalaxyOpen] = useState<boolean>(() => focusedDim != null)
  const galaxyVisible = galaxyHasStory || galaxyOpen

  const [showEvidence, setShowEvidence] = useState(false)
  // §S · día seleccionado en la silueta → su panel de etiquetas emerge abajo
  // (fusión de la vieja lista §6 con la silueta: una sola vista por-día).
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const selectedRow = selectedDay ? (timeline.find((r) => r.date === selectedDay) ?? null) : null

  // Acento de la página = color del arquetipo (mismo criterio que Día). Tiñe
  // las ✦ de las listas y los links; los bloques de una dimensión usan su
  // propio color.
  const accent = discoveryColor(discovery.archetype)

  // 9.4 · carga y error explícitos (mismo par cálido de Día): la pantalla en
  // blanco de antes se leía como rota, y un fetch fallido no tenía salida.
  if (isLoading && signals == null) {
    return (
      <View style={styles.wrap}>
        <View style={styles.stateCard}>
          <Text style={styles.stateBody}>Mirando tu semana…</Text>
        </View>
      </View>
    )
  }
  if (isError && signals == null) {
    return (
      <View style={styles.wrap}>
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Tu semana no terminó de cargar</Text>
          <Text style={styles.stateBody}>Vuelve a intentarlo en un momento.</Text>
          <Pressable
            style={styles.stateRetryBtn}
            onPress={() => void refetch()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
          >
            <Text style={styles.stateRetry}>Reintentar</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {/* Hero — la pregunta que responde la pantalla. El sub "todavía se está
          escribiendo" se oculta al final de la semana: convivía con "está por
          terminar" del hero y la contradicción confundía (¿se escribe o ya se
          acabó?). */}
      <View style={styles.hero}>
        <Text style={styles.title}>¿Qué descubriste esta semana?</Text>
        {firstWeekOfData || computeDaysAhead(todayIso) > 1 ? (
          <Text style={styles.subtitle}>Tu semana todavía se está escribiendo.</Text>
        ) : null}
      </View>

      {/* El sello del lunes (Fase 7) — la semana pasada como artefacto: la
          silueta final de sus 7 días + UNA observación + el puente. La razón
          estructural de volver cada lunes (cita con novedad garantizada).
          Sin score, sin "lograste": la semana se sella con lo que hubo. */}
      {seal && sealCells ? (
        <View style={styles.sealCard}>
          <Text style={styles.sealEyebrow}>El sello de tu semana</Text>
          <Text style={styles.sealTitle}>Tu semana quedó escrita.</Text>
          <WeekSilhouette cells={sealCells} />
          <Text style={styles.sealObservation}>{seal.observation}</Text>
          <Text style={styles.sealBridge}>Una semana nueva se abre.</Text>
        </View>
      ) : null}

      {/* §0 · Todavía puedo + dirección — lo único que solo Semana da (ver
          docs/orbita-semana-spec.md §0). Se muestra siempre que haya semana. */}
      <WeekProgressHero todayIso={todayIso} direction={direction} firstWeek={firstWeekOfData} />

      {!hasEvidence ? (
        <EmptySegmentCard
          eyebrow="La galaxia se enciende con tu registro"
          body="Esta semana aún está en silencio. Registra desde Hoy y cada hábito deja una huella que verás aparecer aquí."
          hint="Cuando algo se repita, lo descubrirás."
        />
      ) : (
        <>
          {/* §S · La silueta de tus 7 días — el ritmo/forma del tramo (héroe
              visual, eje horizontal). Va entre §0 y la galaxia. Ver spec §S. */}
          <Text style={styles.sectionEyebrow}>La forma de tu semana</Text>
          <WeekSilhouette
            cells={silhouette}
            selectedDate={selectedDay}
            onSelectDay={setSelectedDay}
          />
          {selectedRow ? (
            <DayFocusPanel row={selectedRow} accent={accent} onPick={onPickDay} />
          ) : (
            <Text style={styles.tapHint}>Toca un día para saber qué pasó.</Text>
          )}

          {/* §2 · El cielo semanal — la galaxia ES evidencia (cada planeta, su
              masa por días presentes). El centro que la usuaria ama; el eje
              vertical (qué hábitos) que complementa la silueta. Más aire arriba
              para separar de la silueta/tapHint.
              9.5 · on-demand mientras no tenga historia (≥2 señales con ≥3
              días): dos gramáticas interactivas maestras en una vista eran
              mucha maquinaria para decir "registraste 2 días". Un tap la abre
              cuando la usuaria quiera; se despliega sola al ganarse su lugar. */}
          <Text style={[styles.sectionEyebrow, styles.sectionEyebrowGap]}>El cielo semanal</Text>
          {!galaxyVisible ? (
            <Pressable
              style={styles.galaxyTeaser}
              onPress={() => setGalaxyOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Ver el cielo semanal"
            >
              <Text style={styles.galaxyTeaserBody}>
                Tus señales de la semana, como sistema. Se despliega solo cuando ya tiene historia
                que contar.
              </Text>
              <Text style={styles.galaxyTeaserLink}>Ver el cielo semanal ›</Text>
            </Pressable>
          ) : (
            <WeekOrbitGalaxy
              dims={galaxyDims}
              onFocusChange={setFocusedDim}
              initialFocus={focusedDim}
            />
          )}
          {galaxyVisible && focused && focused.present > 0 ? (
            <Animated.View
              key={focused.key}
              entering={FadeInDown.duration(320)}
              style={styles.panel}
            >
              <Text style={[styles.panelLabel, { color: WEEK_DIM_COLOR[focused.key] }]}>
                {focused.label}
              </Text>
              {/* La palabra manda (líder cualitativo), el número susurra (abajo).
                  La tira se tiñe con el color del dim → "pertenece" al planeta y
                  no se confunde con la silueta §S ni con el día-por-día. */}
              <Text style={styles.panelObs}>{dimObservation(focused.present, focused.total)}</Text>
              <DayLine
                cells={dimensionLine(week, todayIso, focused.key, ctx, denomFrom)}
                color={WEEK_DIM_COLOR[focused.key]}
              />
              {/* Puente hábito↔peso (solo proteína/movimiento, con meta): conecta
                  el hábito con el déficit → "progreso, no solo hábitos". */}
              {(() => {
                const bridge = dimDeficitBridge(focused.key, week, todayIso, ctx)
                return bridge ? (
                  <Text style={styles.panelBridge}>
                    <Text style={[styles.panelBridgeStar, { color: accent }]}>✦ </Text>
                    {bridge}
                  </Text>
                ) : null
              })()}
              <Text style={styles.panelCount}>
                {focused.present} de {focused.total} {focused.total === 1 ? 'día' : 'días'}
              </Text>
            </Animated.View>
          ) : galaxyVisible ? (
            <Text style={styles.tapHint}>Toca un planeta para ver sus días.</Text>
          ) : null}

          {/* §1 · Una observación de la semana — la co-ocurrencia más fuerte,
              DEMOVIDA a apoyo (ya no es el hero; los patrones profundos son de
              Mes). Solo co-ocurrencia: la degradación a presencia se suprime
              (redundante con Día/Mes). Ver docs/orbita-semana-spec.md §1. */}
          {discovery.kind === 'cooccurrence' ? (
            <View style={styles.block}>
              <Text style={styles.sectionEyebrow}>Una observación de la semana</Text>
              <DiscoveryCard discovery={discovery} onWhy={() => setShowEvidence(true)} />
            </View>
          ) : null}

          {/* §3 · Evidencia emergente — observaciones con número (sin la línea de
              conteo de déficit ni "día de más calorías"; ver logic §3). */}
          {emerging.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.sectionEyebrow}>Evidencia emergente</Text>
              <View style={styles.list}>
                {emerging.map((e, i) => (
                  <Animated.View
                    key={e.key}
                    entering={FadeIn.duration(360).delay(i * 70)}
                    style={styles.listRow}
                  >
                    <Text style={[styles.listStar, { color: accent }]}>✦</Text>
                    <Text style={styles.listText}>{e.text}</Text>
                  </Animated.View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Comparado con tu costumbre — el "Typical / distinto en ti" de Apple
              Health, pero SIEMPRE contra tu propia línea base (sueño, energía).
              Vive en Semana (compara por naturaleza), no en Día. Solo aparece con
              suficiente historial; si no, calla (Stelar no infiere sin evidencia). */}
          {baseline.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.sectionEyebrow}>Comparado con tu costumbre</Text>
              <View style={styles.list}>
                {baseline.map((b, i) => (
                  <Animated.View
                    key={b.key}
                    entering={FadeIn.duration(360).delay(i * 70)}
                    style={styles.listRow}
                  >
                    <Text style={[styles.listStar, { color: accent }]}>✦</Text>
                    <Text style={styles.listText}>{WEEK_BASELINE_COPY[b.key]?.[b.status]}</Text>
                  </Animated.View>
                ))}
              </View>
            </View>
          ) : null}

          {/* §6 (fusionada en §S): la lista día-por-día ya no existe como sección;
              sus etiquetas viven en el panel de la silueta (DayFocusPanel). */}

          {/* §7 · La ausencia también cuenta — lo que nunca apareció, sin culpa. */}
          {absences.length > 0 ? <AbsenceBlock items={absences} /> : null}

          {/* §5 · Lo que aún necesita más evidencia — SUSURRO (una línea tenue,
              sin eyebrow; ya no compite con los hallazgos). Va casi al final. */}
          {moreEvidence ? (
            <View style={styles.blockTight}>
              <Text style={styles.whisperNote}>{moreEvidence}</Text>
            </View>
          ) : null}

          {/* §8 · Tu palanca para los próximos días — cierre + transición a Mes. */}
          <TransitionBlock onOpenMes={onOpenMes} accent={accent} lever={lever} />
        </>
      )}

      <EvidenceSheet
        visible={showEvidence}
        discovery={discovery}
        onClose={() => setShowEvidence(false)}
      />

      {/* Fin del recorrido: volver al inicio sin hacer scroll a mano. */}
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
    </Animated.View>
  )
}

/* Halo de luz tras un símbolo — reusa el lenguaje luminoso de Día (el símbolo
 * FLOTA sobre su propia luz, no dentro de un disco gris con borde). */
function SymbolHalo({
  color,
  gid,
  size = 92,
  children,
}: {
  color: string
  gid: string
  size?: number
  children: ReactNode
}) {
  const r = size / 2
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <SvgDefs>
          <SvgRadialGradient id={gid} cx="50%" cy="50%" r="50%">
            <SvgStop offset="0" stopColor={color} stopOpacity={0.4} />
            <SvgStop offset="0.55" stopColor={color} stopOpacity={0.12} />
            <SvgStop offset="1" stopColor={color} stopOpacity={0} />
          </SvgRadialGradient>
        </SvgDefs>
        <SvgCircle cx={r} cy={r} r={r} fill={`url(#${gid})`} />
      </Svg>
      {children}
    </View>
  )
}

/** El acento de la página = el color del arquetipo del descubrimiento, con el
 *  MISMO criterio que Día (constancia → magenta). El oro se reserva para la
 *  dimensión proteína; nunca tiñe toda la pestaña. */
function discoveryColor(archetype: DiscoveryArchetype): string {
  return DISCOVERY_COLOR[archetype]
}

/** "el lunes" → "El lunes" — capitaliza la primera letra de la foto del día. */
function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/* §1 · El descubrimiento principal — card con chevron, mismo patrón que
 * PatternCard (fill cálido + glow + chevron al borde derecho + press-feedback).
 * El símbolo es el MISMO arte de estado de Día; la conclusión es voz de coach
 * (serif italic, en el acento del arquetipo) y el dato baja a subtexto. */
function DiscoveryCard({ discovery, onWhy }: { discovery: MainDiscovery; onWhy: () => void }) {
  const color = discoveryColor(discovery.archetype)
  const hasEvidence = discovery.evidence.length > 0
  const { onPressIn, onPressOut, animatedStyle } = usePressFeedback()
  return (
    <Animated.View entering={FadeIn.duration(420)} style={styles.discWrap}>
      <Pressable
        onPress={hasEvidence ? onWhy : undefined}
        onPressIn={hasEvidence ? onPressIn : undefined}
        onPressOut={hasEvidence ? onPressOut : undefined}
        disabled={!hasEvidence}
        accessibilityRole={hasEvidence ? 'button' : undefined}
        accessibilityLabel={hasEvidence ? discovery.title : undefined}
        accessibilityHint={hasEvidence ? 'Abre la evidencia de tu semana' : undefined}
      >
        <Animated.View style={[styles.discCard, { shadowColor: color }, animatedStyle]}>
          <View style={styles.discGlass}>
            <View style={styles.discTint} pointerEvents="none" />
            <SymbolHalo color={color} gid="halo-disc" size={80}>
              <Image
                source={DISCOVERY_ART[discovery.archetype]}
                style={styles.discArt}
                resizeMode="contain"
              />
            </SymbolHalo>
            <View style={styles.discRight}>
              <EmText
                text={discovery.phrase}
                emphasis={discovery.emphasis}
                style={styles.discPhrase}
                emStyle={[styles.discPhraseEm, { color }]}
              />
              {discovery.headline ? (
                <Text style={styles.discData}>{discovery.headline}</Text>
              ) : null}
              {discovery.sub ? <Text style={styles.discSub}>{discovery.sub}</Text> : null}
            </View>
            {hasEvidence ? (
              <Text
                style={styles.discChevron}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                ›
              </Text>
            ) : null}
          </View>
        </Animated.View>
      </Pressable>
      {/* La línea de evidencia del descubrimiento: las dos señales que
          coincidieron, una marca por día. Solo en co-ocurrencia (en presencia,
          la tira "Tus 7 días" y la galaxia ya cubren la aparición). */}
      {discovery.kind === 'cooccurrence' ? <HeroTimelines timelines={discovery.timelines} /> : null}
    </Animated.View>
  )
}

/** Color de una línea de evidencia del hero. Las dimensiones reusan su color;
 *  déficit y sueño +7 h toman el de su dimensión más cercana. */
function timelineColor(key: DiscoveryTimeline['key']): string {
  if (key === 'deficit') return colors.dimension.alimento
  if (key === 'sleep7h') return colors.dimension.sueno
  if (key === 'presencia') return colors.leche
  return WEEK_DIM_COLOR[key]
}

/* Las dos líneas L·M·M·J·V·S·D del descubrimiento de co-ocurrencia: cada señal
 * con su color, una marca por día (encendida = apareció). Lectura visual de la
 * coincidencia, sin interpretar. */
function HeroTimelines({ timelines }: { timelines: DiscoveryTimeline[] }) {
  return (
    <View style={styles.heroTl}>
      {timelines.map((t) => {
        const c = timelineColor(t.key)
        return (
          <View key={t.key} style={styles.heroTlRow}>
            <Text style={[styles.heroTlLabel, { color: c }]} numberOfLines={1}>
              {t.label}
            </Text>
            <View style={styles.heroTlDots}>
              {t.cells.map((cell, i) => (
                <View
                  key={i}
                  style={[
                    styles.heroTlDot,
                    cell.state === 'present' && { backgroundColor: c },
                    cell.state === 'absent' && styles.heroTlDotAbsent,
                    cell.state === 'future' && styles.heroTlDotFuture,
                  ]}
                />
              ))}
            </View>
          </View>
        )
      })}
    </View>
  )
}

/* §7 · "Un patrón por descubrir": las señales que aún no registras, como
 * INVITACIÓN CON PREMIO (no "lo que no hiciste"). Estrella hueca (✧) = una luz
 * que podría encenderse, no un aro de falta. Nunca culpabiliza. */
function AbsenceBlock({ items }: { items: readonly string[] }) {
  return (
    <View style={styles.blockTight}>
      <Text style={styles.sectionEyebrow}>Algo por descubrir</Text>
      <View style={styles.list}>
        {items.map((text, i) => (
          <View key={i} style={styles.listRow}>
            <Text style={styles.absenceMark}>✧</Text>
            <Text style={styles.absenceText}>{text}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

/* §8 · "Repetir la próxima semana": invitaciones a observar ("esto apareció
 * varias veces", nunca "deberías") + el cierre hacia Mes. */
function TransitionBlock({
  onOpenMes,
  accent,
  lever,
}: {
  onOpenMes?: () => void
  accent: string
  lever: WeekLever | null
}) {
  return (
    <>
      {/* §8 · UNA palanca de foco para los próximos días (recomendación, no
          orden; cercana, distinta de la palanca estructural de Mes). */}
      {lever ? (
        <View style={styles.block}>
          <Text style={styles.sectionEyebrow}>Tu palanca para los próximos días</Text>
          <View style={styles.listRow}>
            <Text style={[styles.listStar, { color: accent }]}>✦</Text>
            <Text style={styles.leverText}>{lever.focus}</Text>
          </View>
        </View>
      ) : null}
      <View style={styles.transition}>
        <Text style={styles.transitionLine}>Cada semana deja una huella en tu mes.</Text>
        {onOpenMes ? (
          <Pressable onPress={onOpenMes} hitSlop={8} accessibilityRole="button">
            {/* 9.3 · tint FIJO de navegación (oro): "esto navega" debe ser
                aprendible; el acento por arquetipo queda para las ✦. */}
            <Text style={[styles.transitionLink, { color: colors.oro }]}>
              Ver cómo se transforma tu mes ›
            </Text>
          </Pressable>
        ) : null}
      </View>
    </>
  )
}

/* "¿Por qué?" → la evidencia, totalmente transparente. Mismo lenguaje de modal
 * que la evidencia de Mes (blur + scrim cálido + tarjeta flotante). */
function EvidenceSheet({
  visible,
  discovery,
  onClose,
}: {
  visible: boolean
  discovery: MainDiscovery
  onClose: () => void
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={[StyleSheet.absoluteFill, styles.modalScrim]} pointerEvents="none" />
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalEyebrow}>La evidencia</Text>
          <View style={styles.modalTitleRow}>
            <View
              style={[
                styles.modalTitleDot,
                { backgroundColor: discoveryColor(discovery.archetype) },
              ]}
            />
            <Text style={styles.modalTitle}>{discovery.title}</Text>
          </View>
          {discovery.snapshot ? (
            // Foto del día: un solo registro esta semana → su instantánea, no
            // seis conteos de "1 día".
            <View style={styles.snapBlock}>
              <Text style={styles.snapDay}>
                {capitalize(discovery.snapshot.weekdayLabel)} registraste:
              </Text>
              <Text style={styles.snapItems}>{discovery.snapshot.items.join('  ·  ')}</Text>
            </View>
          ) : (
            <View style={styles.evList}>
              {discovery.evidence.map((e) => (
                <View key={e.key} style={styles.evRow}>
                  <Text style={styles.evCheck}>✓</Text>
                  <Text style={styles.evText}>{e.text}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.modalCaption}>
            {discovery.snapshot
              ? 'Todo esto salió de tu registro de ese día.'
              : 'Todo esto salió de tus registros de la semana.'}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            style={styles.modalCloseBtn}
          >
            <Text style={styles.modalClose}>Cerrar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/* Color de cada etiqueta de evidencia del día. Déficit/proteína cálidos (oro =
 * proteína, la métrica más cuidada); entreno naranja (movimiento). "Por encima
 * de tu meta" y "Sin registros" en gris niebla: evidencia neutra, nunca alarma. */
const TAG_COLOR: Record<string, string> = {
  Déficit: colors.dimension.alimento,
  Proteína: colors.oroLight,
  Entreno: colors.signal.entreno,
  'Por encima de tu meta': colors.niebla,
  'Sin registros': colors.bruma,
  Registro: colors.niebla,
  // 5.4 · las señales reales del día (mismos acentos que la galaxia/dims).
  Comida: colors.dimension.alimento,
  Sueño: colors.dimension.sueno,
  Agua: colors.signal.agua,
  Ánimo: colors.dimension.mente,
  Descanso: colors.dimension.ciclo,
}
const MUTED_TAGS = new Set(['Por encima de tu meta', 'Sin registros', 'Registro'])

/* §S · El panel del día seleccionado en la silueta (fusiona la vieja lista §6):
 * el día + sus ETIQUETAS de evidencia + link a Órbita Día. Una sola vista
 * por-día en la pantalla; misma gramática de "tocar → panel abajo" que la
 * galaxia. "Déficit" resalta (lo que la usuaria quiere ver); "Por encima de tu
 * meta" queda tenue (MUTED) → el día tiene jerarquía, no dos globitos iguales. */
function DayFocusPanel({
  row,
  accent,
  onPick,
}: {
  row: DayTimelineRow
  accent: string
  onPick?: (date: string) => void
}) {
  return (
    <Animated.View entering={FadeInDown.duration(280)} style={styles.dayFocus}>
      <Text style={styles.dayFocusName}>{row.weekdayLabel}</Text>
      <View style={styles.dayFocusTags}>
        {row.tags.length === 0 ? (
          <Text style={styles.tlFuture}>Sin registros</Text>
        ) : (
          row.tags.map((t, i) => {
            const c = TAG_COLOR[t] ?? colors.niebla
            const muted = MUTED_TAGS.has(t)
            return (
              <View key={i} style={[styles.tlTag, { backgroundColor: hexA(c, muted ? 0.1 : 0.2) }]}>
                <Text style={[styles.tlTagText, { color: c }]}>{t}</Text>
              </View>
            )
          })
        )}
      </View>
      {onPick ? (
        <Pressable
          onPress={() => onPick(row.date)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Ver el ${row.weekdayLabel.toLowerCase()} en Órbita Día`}
        >
          {/* 9.3 · tint fijo de navegación (oro), no el acento del arquetipo. */}
          <Text style={[styles.dayFocusLink, { color: colors.oro }]}>
            Ver el {row.weekdayLabel.toLowerCase()} en detalle ›
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  )
}

/* La línea L·M·M·J·V·S·D de una dimensión: en qué días apareció ese hábito.
 * Presente = punto encendido; ausente = aro vacío; futuro = punto tenue. */
function DayLine({ cells, color }: { cells: readonly DayCell[]; color?: string }) {
  return (
    <View style={styles.dayLine}>
      {cells.map((c, i) => (
        <View key={i} style={styles.dayCol}>
          <Text style={[styles.dayLetter, c.state === 'future' && styles.dayLetterFuture]}>
            {c.letter}
          </Text>
          <View
            style={[
              styles.dayMark,
              // El día presente se enciende en el COLOR de la dimensión tocada
              // (no el magenta genérico) → la tira pertenece a ese planeta.
              c.state === 'present' && (color ? { backgroundColor: color } : styles.dayPresent),
              c.state === 'absent' && styles.dayAbsent,
              c.state === 'future' && styles.dayFuture,
            ]}
          >
            {c.state === 'present' ? <Text style={styles.dayCheck}>✓</Text> : null}
          </View>
        </View>
      ))}
    </View>
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
  // ── Hero ──────────────────────────────────────────────────────────
  // La pregunta es voz de coach → serif italic, alineada a la izquierda, igual
  // que "¿Quién fuiste hoy?" de Día.
  hero: {
    alignItems: 'flex-start',
    marginBottom: 22,
  },
  // Título de página = tipografía display (Hanken), no serif italic: el serif
  // italic está reservado para la voz de coach. Va a la izquierda como héroe.
  // Mismo título que Día (Hanken displayHeavy), para un header consistente.
  // 9.2 · UN solo título grande por vista: el hero es "Tu Órbita" (36);
  // la pregunta baja a nivel de sección (24) para no competir (doble título
  // del mismo peso era la queja Apple). Mismo tamaño en Día/Semana/Mes.
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displaySm,
    lineHeight: 30,
    letterSpacing: -0.8,
    color: colors.leche,
  },
  // Mismo estilo que el subtítulo de Día (su línea de fecha): UI gris niebla.
  subtitle: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  tapHint: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  // Eyebrows neutros (gris niebla), misma métrica que Día — el eyebrow nunca
  // lleva color de marca.
  // ── El sello del lunes ─────────────────────────────────────────────
  sealCard: {
    marginBottom: 24,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    backgroundColor: colors.bgCard,
  },
  sealEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    marginBottom: 8,
  },
  sealTitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.headingLg,
    lineHeight: 26,
    color: colors.leche,
    marginBottom: 12,
  },
  sealObservation: {
    marginTop: 12,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
  },
  sealBridge: {
    marginTop: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // 9.5 · teaser de la galaxia colapsada.
  galaxyTeaser: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
    padding: 16,
  },
  galaxyTeaserBody: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.niebla,
  },
  galaxyTeaserLink: {
    marginTop: 10,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.oro,
  },
  sectionEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    // Eyebrow de sección en oro (oroSoft) — color canónico unificado con Mes y
    // Día (decisión dueña jul 2026). El oro es el metal de los títulos de Órbita.
    color: colors.oroSoft,
    marginBottom: 12,
    marginLeft: 2,
  },
  // Más aire arriba del eyebrow "El cielo semanal" para separarlo del tapHint /
  // panel de la silueta (§S) que viene justo antes.
  sectionEyebrowGap: {
    marginTop: 28,
  },
  block: {
    marginTop: 28,
  },
  // Para sub-bloques que pertenecen a la MISMA zona (ausencia tras evidencia):
  // gap chico para que se lean agrupados, no como secciones sueltas.
  blockTight: {
    marginTop: 18,
  },
  // ── §1 Descubrimiento principal (card con chevron, patrón PatternCard) ──
  discWrap: {
    marginBottom: 30,
  },
  // Wrapper — glow suave del color del arquetipo (shadowColor inline). Sin bg
  // ni borde: el panel cálido de adentro hace el look.
  discCard: {
    borderRadius: 20,
    shadowOpacity: 0.16,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  discGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
    backgroundColor: 'rgba(14,6,9,0.9)',
  },
  discTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(34,12,20,0.3)',
  },
  // El arte de estado de Día, a tamaño de símbolo (no héroe).
  discArt: {
    width: 56,
    height: 56,
  },
  discRight: {
    flex: 1,
    minWidth: 0,
  },
  // Voz de coach: serif italic en leche; solo la palabra clave toma el acento
  // (patrón EmText, como "Tu Órbita" / PatternCard).
  discPhrase: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 21,
    lineHeight: 27,
    color: colors.leche,
  },
  discPhraseEm: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
  },
  discData: {
    marginTop: 12,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
  },
  discSub: {
    marginTop: 5,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14.5,
    lineHeight: 20,
    color: colors.bone,
  },
  // Chevron de navegación al borde derecho — bone, grande (mismo token que
  // PatternCard: "esto abre algo").
  discChevron: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.segmentTitle,
    color: colors.bone,
    marginLeft: 2,
  },
  // ── §1 Línea(s) de evidencia del hero (co-ocurrencia) ─────────────
  heroTl: {
    marginTop: 12,
    gap: 8,
  },
  heroTlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroTlLabel: {
    width: 96,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
  },
  heroTlDots: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroTlDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  heroTlDotAbsent: {
    borderWidth: 1.5,
    borderColor: colors.bruma,
  },
  heroTlDotFuture: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: hexA(colors.leche, 0.12),
  },
  // ── §2 Panel del planeta enfocado ─────────────────────────────────
  panel: {
    marginTop: 14,
    gap: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  panelLabel: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    lineHeight: 26,
    textAlign: 'center',
  },
  // El número ahora SUSURRA (caption tenue, abajo de la tira): la palabra manda.
  panelCount: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    textAlign: 'center',
  },
  // Puente hábito↔peso: la co-ocurrencia con el déficit, observacional.
  panelBridge: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.bone,
    textAlign: 'center',
  },
  panelBridgeStar: {
    fontFamily: typography.uiMedium,
  },
  // La observación es el "aha" del hábito → protagonista (leche), bajo el título.
  panelObs: {
    marginTop: 4,
    marginBottom: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    textAlign: 'center',
  },
  // ── Lista de evidencia (silencioso + observaciones) ───────────────
  list: {
    gap: 12,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  listStar: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    marginTop: 1,
  },
  listText: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    lineHeight: typography.sizes.bodyLarge * 1.5,
  },
  // La palanca (§8) es recomendación de coach → serif italic, cálida.
  leverText: {
    flex: 1,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 23,
    color: colors.leche,
  },
  // El nombre de la dimensión dentro de una fila (silencioso) — su color.
  listEm: {
    fontFamily: typography.uiSemi,
  },
  // ── §4 Lo que podemos confirmar (✓ hechos) ────────────────────────
  // §5 en susurro: honesto y humilde, pero tenue (niebla) y sin eyebrow, para
  // que no compita con los hallazgos ni se lea como "sigue haciendo tarea".
  whisperNote: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 20,
    color: colors.niebla,
  },
  // ── §6 La semana día por día (timeline con etiquetas) ─────────────
  tlList: {
    gap: 10,
  },
  tlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 26,
  },
  tlDay: {
    width: 88,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  tlDayToday: {
    color: colors.magenta,
    fontFamily: typography.uiBold,
  },
  tlDayFuture: {
    color: colors.bruma,
  },
  tlTags: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tlTag: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tlTagText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 0.2,
  },
  // ── §S · panel del día seleccionado (chips + link a Día) ──────────
  dayFocus: {
    marginTop: 6,
    marginBottom: 20,
    alignItems: 'center',
    gap: 10,
  },
  dayFocusName: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
  },
  dayFocusTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  dayFocusLink: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
  },
  tlFuture: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.bruma,
  },
  // ── Ausencia ──────────────────────────────────────────────────────
  absenceMark: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.bruma,
    marginTop: 1,
  },
  absenceText: {
    flex: 1,
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    lineHeight: typography.sizes.body * 1.5,
  },
  // ── §7 Transición ─────────────────────────────────────────────────
  transition: {
    marginTop: 34,
    alignItems: 'center',
    gap: 10,
  },
  transitionLine: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 22,
    color: colors.bone,
    textAlign: 'center',
  },
  transitionLink: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // ── Semana en una línea ───────────────────────────────────────────
  dayLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  dayCol: {
    alignItems: 'center',
    gap: 9,
  },
  dayLetter: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.5,
    color: colors.niebla,
  },
  dayLetterFuture: {
    color: colors.bruma,
  },
  dayMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPresent: {
    backgroundColor: colors.magenta,
  },
  dayAbsent: {
    borderWidth: 1.5,
    borderColor: colors.bruma,
  },
  dayFuture: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: hexA(colors.leche, 0.12),
  },
  dayCheck: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.leche,
  },
  // ── Tira de fechas (picker de día) — distinta a la línea de presencia ──
  stripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  stripCol: {
    alignItems: 'center',
    gap: 8,
  },
  stripLetter: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.5,
    color: colors.niebla,
  },
  stripLetterToday: {
    color: colors.magenta,
  },
  stripLetterFuture: {
    color: colors.bruma,
  },
  stripPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripPillToday: {
    backgroundColor: colors.magenta,
  },
  stripNum: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  stripNumToday: {
    fontFamily: typography.uiBold,
    color: colors.leche,
  },
  // Día sin registro → número atenuado (presencia sutil, sin duplicar los ✓).
  stripNumAbsent: {
    color: colors.niebla,
  },
  stripNumFuture: {
    color: colors.bruma,
  },
  // Hint bajo la tira de 7 días.
  stripHint: {
    marginTop: 10,
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    marginLeft: 2,
  },
  // ── Modal de evidencia ────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
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
  modalTitleRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  modalTitleDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  modalTitle: {
    flex: 1,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    lineHeight: 27,
    color: colors.leche,
  },
  evList: {
    marginTop: 18,
    gap: 12,
  },
  // ── Foto del día (estado comienzo · un solo registro) ──────────────
  snapBlock: {
    marginTop: 18,
    gap: 8,
  },
  snapDay: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  // Las señales del día en una línea, separadas por puntos (no una lista de ✓
  // que repetiría "1 día"). Lectura de instantánea, no de conteos.
  snapItems: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: typography.sizes.bodyLarge * 1.5,
    color: colors.leche,
  },
  evRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  evCheck: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroLight,
    marginTop: 1,
  },
  evText: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    lineHeight: typography.sizes.bodyLarge * 1.4,
  },
  modalCaption: {
    marginTop: 18,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 18,
    color: colors.niebla,
  },
  modalCloseBtn: {
    marginTop: 22,
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
  // ── Volver arriba (fin del recorrido) ────────────────────────────
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
})
