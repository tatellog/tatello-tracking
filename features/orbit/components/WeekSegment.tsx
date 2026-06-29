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

import { useIsoWeekSignals } from '../hooks'
import {
  buildAppearanceLine,
  buildWeekDimensions,
  dimObservation,
  dimensionLine,
  mainDiscovery,
  quietestSignal,
  weekAbsences,
  weekObservations,
  type DayCell,
  type DiscoveryArchetype,
  type MainDiscovery,
  type WeekDimKey,
} from '../week-orbit-logic'
import { consumeWeekFocus } from '../pending-week-focus'
import { EmptySegmentCard } from './EmptySegmentCard'
import { WeekOrbitGalaxy } from './WeekOrbitGalaxy'
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
  movimiento: '#FF9E57',
  nutricion: colors.dimension.alimento,
  proteina: colors.dimension.alimento,
  descanso: colors.dimension.sueno,
  hidratacion: colors.leche,
  energia: '#FF9E57',
}

/*
 * Órbita · Semana (v1 sin IA) — "¿Qué descubriste sobre ti esta semana?".
 *
 * No es un dashboard: es EVIDENCIA convertida en descubrimiento. Cada
 * conclusión sale de daily_signals y se puede explicar ("¿Por qué?"). No
 * interpreta, no diagnostica, no inventa. Secciones (ver
 * docs/orbita-semana-spec.md): descubrimiento principal → el cielo semanal
 * (galaxia) → lo más silencioso → tus ritmos → lo constante → la ausencia →
 * tu órbita cambia.
 */
export function WeekSegment({
  onOpenMes,
  onPickDay,
}: {
  onOpenMes?: () => void
  /** Abrir un día de la semana en Órbita Día (lo dispara la tira de 7 días). */
  onPickDay?: (date: string) => void
}) {
  const { data: signals, todayIso, isLoading } = useIsoWeekSignals()
  const macros = useMacroTargets()
  const proteinTarget = macros.data?.protein_g ?? null
  const ctx = useMemo(() => ({ proteinTarget }), [proteinTarget])

  const week = useMemo(() => signals ?? [], [signals])
  const dims = useMemo(() => buildWeekDimensions(week, todayIso, ctx), [week, todayIso, ctx])
  const discovery = useMemo(() => mainDiscovery(week, todayIso, ctx), [week, todayIso, ctx])
  const quiet = useMemo(() => quietestSignal(dims), [dims])
  const observations = useMemo(() => weekObservations(week, todayIso), [week, todayIso])
  const absences = useMemo(() => weekAbsences(week, todayIso), [week, todayIso])
  // Tus 7 días (lun→dom) con su estado de aparición — la tira para abrir un día.
  const appearanceCells = useMemo(() => buildAppearanceLine(week, todayIso), [week, todayIso])

  const hasEvidence = dims.some((d) => d.present > 0)
  // La galaxia muestra solo señales con presencia; las que nunca aparecieron
  // bajan a "La ausencia" (un planeta de 0 días se leería como falla).
  const galaxyDims = useMemo(() => dims.filter((d) => d.present > 0), [dims])

  // Planeta enfocado (tocado) → su panel de días. Arranca con el deep-link de
  // patrón ("Verlo en mi órbita") si lo hubo (one-shot).
  const [focusedDim, setFocusedDim] = useState<WeekDimKey | null>(() => consumeWeekFocus())
  const focused = focusedDim ? (dims.find((d) => d.key === focusedDim) ?? null) : null

  const [showEvidence, setShowEvidence] = useState(false)

  // Acento de la página = color del arquetipo (mismo criterio que Día). Tiñe
  // las ✦ de las listas y los links; los bloques de una dimensión usan su
  // propio color.
  const accent = discoveryColor(discovery.archetype)

  if (isLoading) {
    return <View style={styles.wrap} />
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {/* Hero — la pregunta que responde la pantalla. */}
      <View style={styles.hero}>
        <Text style={styles.title}>¿Qué descubriste esta semana?</Text>
        <Text style={styles.subtitle}>Estas son las huellas que dejaron tus hábitos.</Text>
      </View>

      {!hasEvidence ? (
        <EmptySegmentCard
          eyebrow="La galaxia se enciende con tu registro"
          body="Esta semana aún está en silencio. Registra desde Hoy y cada hábito deja una huella que verás aparecer aquí."
          hint="Cuando algo se repita, lo descubrirás."
        />
      ) : (
        <>
          {/* §1 · Descubrimiento principal — UN solo patrón, el más fuerte. */}
          <DiscoveryCard discovery={discovery} onWhy={() => setShowEvidence(true)} />

          {/* §2 · El cielo semanal — la galaxia ES evidencia: cada planeta,
              su masa por días presentes. */}
          <Text style={styles.sectionEyebrow}>El cielo semanal</Text>
          <WeekOrbitGalaxy
            dims={galaxyDims}
            onFocusChange={setFocusedDim}
            initialFocus={focusedDim}
          />
          {focused && focused.present > 0 ? (
            <Animated.View
              key={focused.key}
              entering={FadeInDown.duration(320)}
              style={styles.panel}
            >
              <Text style={[styles.panelLabel, { color: WEEK_DIM_COLOR[focused.key] }]}>
                {focused.label}
              </Text>
              <Text style={styles.panelCount}>
                {focused.present} de {focused.total} días
              </Text>
              <DayLine cells={dimensionLine(week, todayIso, focused.key, ctx)} />
              <Text style={styles.panelObs}>{dimObservation(focused.present, focused.total)}</Text>
            </Animated.View>
          ) : (
            <Text style={styles.tapHint}>Toca un planeta para ver sus días.</Text>
          )}

          {/* Tus 7 días — la tira para ABRIR cualquier día en Órbita Día. Vive
              junto a la galaxia (explorar días es su contexto). */}
          {onPickDay ? (
            <WeekDayStrip cells={appearanceCells} todayIso={todayIso} onPick={onPickDay} />
          ) : null}

          {/* §3-5 · Una sola zona de evidencia: la señal más callada (fila
              líder) + observaciones (ritmos + lo constante fusionados, con el
              sueño deduplicado). Trato uniforme de filas, no card vs lista. */}
          {quiet || observations.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.sectionEyebrow}>Lo que mostró tu semana</Text>
              <View style={styles.list}>
                {quiet ? (
                  <View style={styles.listRow}>
                    <Text style={[styles.listStar, { color: WEEK_DIM_COLOR[quiet.key] }]}>✦</Text>
                    <Text style={styles.listText}>
                      <Text style={[styles.listEm, { color: WEEK_DIM_COLOR[quiet.key] }]}>
                        {quiet.label}
                      </Text>
                      {` fue tu señal más callada: ${quiet.present} de ${quiet.total} días.`}
                    </Text>
                  </View>
                ) : null}
                {observations.map((text, i) => (
                  <Animated.View
                    key={`obs-${i}`}
                    entering={FadeIn.duration(360).delay(i * 80)}
                    style={styles.listRow}
                  >
                    <Text style={[styles.listStar, { color: accent }]}>✦</Text>
                    <Text style={styles.listText}>{text}</Text>
                  </Animated.View>
                ))}
              </View>
            </View>
          ) : null}

          {/* §6 · La ausencia también cuenta — lo que nunca apareció, sin culpa. */}
          {absences.length > 0 ? <AbsenceBlock items={absences} /> : null}

          {/* §7 · Tu órbita cambia — el cierre, solo: cada semana construye tu mes. */}
          <TransitionBlock onOpenMes={onOpenMes} accent={accent} />
        </>
      )}

      <EvidenceSheet
        visible={showEvidence}
        discovery={discovery}
        onClose={() => setShowEvidence(false)}
      />
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
    </Animated.View>
  )
}

/* §6 · "La ausencia también cuenta": lo que nunca apareció, en tono neutro
 * (aro hueco, no estrella; nunca culpabiliza). */
function AbsenceBlock({ items }: { items: readonly string[] }) {
  return (
    <View style={styles.blockTight}>
      <Text style={styles.sectionEyebrow}>La ausencia también cuenta</Text>
      <View style={styles.list}>
        {items.map((text, i) => (
          <View key={i} style={styles.listRow}>
            <Text style={styles.absenceMark}>○</Text>
            <Text style={styles.absenceText}>{text}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

/* §7 · "Tu órbita cambia": el cierre — cada semana construye el mes. */
function TransitionBlock({ onOpenMes, accent }: { onOpenMes?: () => void; accent: string }) {
  return (
    <View style={styles.transition}>
      <Text style={styles.transitionLine}>Cada semana deja una huella en tu mes.</Text>
      {onOpenMes ? (
        <Pressable onPress={onOpenMes} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.transitionLink, { color: accent }]}>
            Ver cómo se transforma tu mes ›
          </Text>
        </Pressable>
      ) : null}
    </View>
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
          <View style={styles.evList}>
            {discovery.evidence.map((e) => (
              <View key={e.key} style={styles.evRow}>
                <Text style={styles.evCheck}>✓</Text>
                <Text style={styles.evText}>{e.text}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.modalCaption}>Todo esto salió de tus registros de la semana.</Text>
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

/* Tus 7 días — tira de FECHAS tappable (lun→dom): cada día abre Órbita Día
 * anclado a esa fecha. Distinta a la línea de presencia del panel del planeta:
 * aquí se lee "elegir fecha" (número de día), no "presencia" (puntos/✓). Hoy =
 * píldora magenta; días sin registro = número atenuado; futuro = tenue y no
 * tappable. */
function WeekDayStrip({
  cells,
  todayIso,
  onPick,
}: {
  cells: readonly DayCell[]
  todayIso: string
  onPick: (date: string) => void
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.sectionEyebrow}>Tus 7 días</Text>
      <View style={styles.stripRow}>
        {cells.map((c, i) => {
          const isToday = c.date === todayIso
          const isFuture = c.state === 'future'
          const dayNum = Number(c.date.slice(8, 10))
          return (
            <Pressable
              key={i}
              disabled={isFuture}
              onPress={() => onPick(c.date)}
              hitSlop={4}
              style={styles.stripCol}
              accessibilityRole="button"
              accessibilityLabel={`Ver el día ${dayNum} en detalle`}
            >
              <Text
                style={[
                  styles.stripLetter,
                  isToday && styles.stripLetterToday,
                  isFuture && styles.stripLetterFuture,
                ]}
              >
                {c.letter}
              </Text>
              <View style={[styles.stripPill, isToday && styles.stripPillToday]}>
                <Text
                  style={[
                    styles.stripNum,
                    isToday && styles.stripNumToday,
                    c.state === 'absent' && styles.stripNumAbsent,
                    isFuture && styles.stripNumFuture,
                  ]}
                >
                  {dayNum}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </View>
      <Text style={styles.stripHint}>Toca un día para verlo en detalle.</Text>
    </View>
  )
}

/* La línea L·M·M·J·V·S·D de una dimensión: en qué días apareció ese hábito.
 * Presente = punto encendido; ausente = aro vacío; futuro = punto tenue. */
function DayLine({ cells }: { cells: readonly DayCell[] }) {
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
              c.state === 'present' && styles.dayPresent,
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
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -1.2,
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
  sectionEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 12,
    marginLeft: 2,
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
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
  },
  panelCount: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    textAlign: 'center',
  },
  panelObs: {
    marginTop: 2,
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
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
    fontSize: 13,
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
  // El nombre de la dimensión dentro de una fila (silencioso) — su color.
  listEm: {
    fontFamily: typography.uiSemi,
  },
  // ── Ausencia ──────────────────────────────────────────────────────
  absenceMark: {
    fontFamily: typography.ui,
    fontSize: 13,
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
    fontSize: 16,
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
    fontSize: 11,
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
    fontSize: 12,
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
    fontSize: 11,
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
    fontSize: 15,
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
    fontSize: 22,
    lineHeight: 27,
    color: colors.leche,
  },
  evList: {
    marginTop: 18,
    gap: 12,
  },
  evRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  evCheck: {
    fontFamily: typography.uiBold,
    fontSize: 14,
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
})
