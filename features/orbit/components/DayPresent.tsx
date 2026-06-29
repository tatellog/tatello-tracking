import { BlurView } from 'expo-blur'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
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
import Svg, { Circle, Path } from 'react-native-svg'

import { usePressFeedback } from '@/components/ui/interaction'
import { useMacroTargets } from '@/features/macros/hooks'
import { GLASS_ML, useWaterGoal } from '@/features/water/useWaterGoal'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { useScreenActive } from '../useScreenActive'
import { useDaySignals, useTodaySignals } from '../hooks'
import { buildDayState, type DayState, type DayStateKey, type EvidenceTone } from '../day-state'
import { formatLongDate } from '../present-logic'
import { StateHeroSky } from './StateHeroSky'

const STAGE = 300

/*
 * Órbita · Día — "¿Quién fuiste hoy?" (Stelar v1, sin IA).
 *
 * No responde "¿qué comiste?" sino qué PREDOMINÓ en tu evidencia hoy: el día
 * resuelve a uno de 7 estados (ver day-state.ts + docs/orbita-dia-redesign-spec).
 * Un espejo, no un coach. La pantalla es un diario elegante: el héroe es el astro
 * GRANDE del estado sobre su cielo. Tocarlo abre un modal "por qué" con los datos
 * reales de las señales que decidieron el día (sistema de modales de Órbita Mes).
 * Debajo, LA EVIDENCIA, las señales ausentes (tappables → registrar) y un cierre
 * que conecta con Órbita Semana. Mucho aire, nada de dashboard.
 */

// El arte de cada estado (PNG) y su color (del spec).
const STATE_ART: Record<DayStateKey, number> = {
  constancia: require('@/assets/icons/orbit-day/constancia.png'),
  energia: require('@/assets/icons/orbit-day/energia.png'),
  recuperacion: require('@/assets/icons/orbit-day/recuperacion.png'),
  nutricion: require('@/assets/icons/orbit-day/nutricion.png'),
  equilibrio: require('@/assets/icons/orbit-day/equilibrio.png'),
  exploracion: require('@/assets/icons/orbit-day/exploracion.png'),
  presencia: require('@/assets/icons/orbit-day/presencia.png'),
}

const STATE_COLOR: Record<DayStateKey, string> = {
  constancia: colors.magentaHot, // rosa
  energia: '#FF9E57', // naranja
  recuperacion: colors.dimension.sueno, // azul
  nutricion: colors.dimension.alimento, // verde
  equilibrio: colors.leche, // blanco
  exploracion: colors.dimension.mente, // morado
  presencia: colors.oroSoft, // oro suave (neutral cálido)
}

// A qué slide de Hoy lleva cada señal ausente (cierra el loop "no lo vimos →
// regístralo"). Agua no tiene slide propio → cae a Hoy (quick-log ✦).
const ABSENT_SLIDE: Record<string, string | null> = {
  sueno: 'sleep',
  animo: 'wellbeing',
  ciclo: 'cycle',
  comida: 'meals', // la sección "Comidas de hoy" (no el slide de macros)
  agua: null,
}

// Color de cada señal ausente (= su dimensión) para el latido del chip.
const ABSENT_TONE: Record<string, string> = {
  sueno: colors.dimension.sueno,
  comida: colors.dimension.alimento,
  agua: colors.signal.agua,
  animo: colors.dimension.mente,
  ciclo: colors.dimension.ciclo,
}

/** Punto que LATE (núcleo + halo que se expande y disuelve) — afordancia viva de
 *  "esto se puede tocar". Gateado en pantalla activa + reduce-motion. */
function PulsingDot({ color }: { color: string }) {
  const reduced = useReducedMotion() ?? false
  const active = useScreenActive()
  const p = useSharedValue(0)
  useEffect(() => {
    if (active && !reduced) {
      p.value = withRepeat(
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
        -1,
        false,
      )
    } else {
      cancelAnimation(p)
      p.value = 0
    }
    return () => cancelAnimation(p)
  }, [active, reduced, p])
  const halo = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - p.value),
    transform: [{ scale: 1 + 1.8 * p.value }],
  }))
  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.dotHalo, { backgroundColor: color }, halo]} />
      <View style={[styles.dotCore, { backgroundColor: color }]} />
    </View>
  )
}

/** El astro GRANDE del estado sobre su cielo Skia (aura que respira + glow). El
 *  glifo PNG va ENCIMA del Canvas (patrón seguro, no dentro de Skia). */
function StateGlyph({ stateKey, color }: { stateKey: DayStateKey; color: string }) {
  return (
    <View style={styles.glyphStage}>
      <StateHeroSky color={color} />
      <Image source={STATE_ART[stateKey]} style={styles.glyphImgHero} resizeMode="contain" />
    </View>
  )
}

/** Modal "¿Por qué este estado?" — los DATOS REALES de las señales que decidieron
 *  el día, en barras (mismo sistema que el modal de Órbita Mes). El valor es el
 *  dato registrado (no un puntaje). Se resalta el DRIVER del estado (la señal que
 *  lo causó), no "la más fuerte" — si no, contradice la razón (constancia la
 *  decide la amplitud, equilibrio que nada dominó). Cuando no hay driver, ninguna
 *  barra manda y se lidera con el dato real (cuántas señales presentes). */
function WhyModal({
  day,
  color,
  visible,
  onClose,
}: {
  day: DayState
  color: string
  visible: boolean
  onClose: () => void
}) {
  const present = day.strengths.filter((s) => s.present)
  const absent = day.strengths.filter((s) => !s.present)
  const driver = day.driver
  // La barra se normaliza al máximo de HOY (peso relativo entre tus señales), no
  // a 5 — así no es "% del ideal/meta" (línea roja del manifiesto).
  const maxStars = Math.max(1, ...present.map((s) => s.stars))
  // Para los estados que nacen de la amplitud, el dato real que los decidió.
  const breadthStat =
    day.key === 'constancia' || day.key === 'equilibrio'
      ? `${present.length} de ${day.strengths.length} señales presentes hoy`
      : null
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={[StyleSheet.absoluteFill, styles.modalScrim]} pointerEvents="none" />
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalEyebrow}>Por qué</Text>
          <View style={styles.modalTitleRow}>
            <View style={[styles.modalTitleDot, { backgroundColor: color }]} />
            <Text style={[styles.modalTitle, { color }]}>{day.title}</Text>
          </View>
          <Text style={styles.modalLead}>{day.explanation}</Text>
          {breadthStat ? <Text style={styles.modalStat}>{breadthStat}</Text> : null}

          <View style={styles.bars}>
            {present.map((s) => {
              // Resalta sólo el driver. Si no hay driver, todas parejas (ni una manda).
              const hi = driver != null && s.key === driver
              return (
                <View key={s.key} style={styles.barRow}>
                  <Text style={styles.barLabel} numberOfLines={1}>
                    {s.label}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.round((s.stars / maxStars) * 100)}%`,
                          backgroundColor: color,
                          opacity: driver == null ? 0.5 : hi ? 1 : 0.32,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barValue, hi && styles.barValueHi]} numberOfLines={1}>
                    {s.detail ?? ''}
                  </Text>
                </View>
              )
            })}
          </View>

          {absent.length > 0 ? (
            <Text style={styles.modalZeroNote}>
              {absent.map((a) => a.label).join(' · ')}: aún sin registro hoy.
            </Text>
          ) : null}

          <Pressable onPress={onClose} hitSlop={10} style={styles.modalCloseBtn}>
            <Text style={styles.modalClose}>Cerrar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// Cada evidencia se tinta al color de SU dimensión → un cielo multicolor, no una
// lista monocroma. (La lógica entrega el `tone`; aquí se resuelve a hex.)
const EVIDENCE_TONE: Record<EvidenceTone, string> = {
  cuerpo: colors.dimension.cuerpo,
  sueno: colors.dimension.sueno,
  alimento: colors.dimension.alimento,
  ciclo: colors.dimension.ciclo,
  energia: colors.dimension.energia,
  mente: colors.dimension.mente,
  proteina: colors.signal.proteina,
  agua: colors.signal.agua,
  leche: colors.leche,
}

/** La evidencia como ESTRELLA que se encendió en tu cielo (no una palomita). Dos
 *  tamaños: la del driver del estado brilla mayor + halo; las demás, menores. La
 *  punta ya apunta arriba en el path (sin rotación → seguro en Android release). */
function EvidenceStar({ color, major }: { color: string; major: boolean }) {
  const s = major ? 18 : 13
  return (
    <Svg width={s} height={s} viewBox="0 0 18 18">
      {major ? <Circle cx={9} cy={9} r={7} fill={color} opacity={0.16} /> : null}
      <Path
        d="M9 2.2 C9.5 6.7 11.3 8.5 15.8 9 C11.3 9.5 9.5 11.3 9 15.8 C8.5 11.3 6.7 9.5 2.2 9 C6.7 8.5 8.5 6.7 9 2.2 Z"
        fill={color}
        opacity={major ? 1 : 0.9}
      />
    </Svg>
  )
}

export function DayPresent({
  viewedDay = null,
  onReturnToToday,
}: {
  /** Día a mostrar (ISO 'YYYY-MM-DD'); null = hoy. Lo setea la tira de Semana. */
  viewedDay?: string | null
  onReturnToToday?: () => void
} = {}) {
  const todayIso = todayInTimezone()
  const isPast = viewedDay != null && viewedDay !== todayIso
  const targetDay = viewedDay ?? todayIso

  // Hoy comparte caché con el resto de la app (useTodaySignals); un día pasado
  // usa su propia query (solo activa cuando se está viendo un día pasado).
  const todayQ = useTodaySignals()
  const pastQ = useDaySignals(targetDay, isPast)
  const { data, isLoading, isError, refetch } = isPast ? pastQ : todayQ
  const signals = data ?? null
  const targets = useMacroTargets()
  const { goalMl } = useWaterGoal()

  const ctx = {
    proteinTarget: targets.data?.protein_g ?? null,
    calorieTarget: targets.data?.calories ?? null,
    waterGoalGlasses: Math.max(1, Math.round(goalMl / GLASS_ML)),
  }
  const day = buildDayState(signals, ctx, { past: isPast })

  const router = useRouter()
  const press = usePressFeedback({ haptic: true })
  const [whyOpen, setWhyOpen] = useState(false)
  const settled = !isLoading

  // Tocar una señal ausente → Hoy, con focus EXACTO en su slide (cierra el loop).
  // Mismo patrón probado que DaySegment: querystring, no params-object.
  const goRegister = (key: string) => {
    const slide = ABSENT_SLIDE[key]
    router.push(slide ? `/(tabs)?slide=${slide}` : '/(tabs)')
  }

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>{isPast ? '¿Cómo fue ese día?' : '¿Cómo fue tu día?'}</Text>
      <Text style={styles.date}>{formatLongDate(targetDay)}</Text>
      {isPast && onReturnToToday ? (
        <Pressable onPress={onReturnToToday} hitSlop={8} style={styles.backToToday}>
          <Text style={styles.backToTodayText}>‹ Volver a hoy</Text>
        </Pressable>
      ) : null}
    </View>
  )

  // Primera carga sin caché — placeholder cálido, no pantalla en blanco.
  if (!settled && signals == null) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        {header}
        <View style={styles.card}>
          <Text style={styles.cardBody}>Mirando tu cielo de hoy…</Text>
        </View>
      </Animated.View>
    )
  }

  if (isError) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        {header}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>El cielo de hoy no terminó de cargar</Text>
          <Text style={styles.cardBody}>Vuelve a intentarlo en un momento.</Text>
          <Text
            style={styles.retry}
            onPress={() => void refetch()}
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
          >
            Reintentar
          </Text>
        </View>
      </Animated.View>
    )
  }

  // Sin ningún registro hoy → invitación (no hay estado todavía).
  if (day == null) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        {header}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tu día aún no habla</Text>
          <Text style={styles.cardBody}>
            En cuanto registres una señal (comida, sueño, movimiento), tu día empieza a mostrar
            quién fuiste hoy.
          </Text>
        </View>
      </Animated.View>
    )
  }

  const color = STATE_COLOR[day.key]

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {header}

      {/* Hero — el astro GRANDE del estado, sobre su cielo. Tocarlo abre la
          constelación (el porqué) en un modal: el héroe queda limpio, el detalle
          a un tap. Debajo, el estado en palabra. */}
      <View style={styles.hero}>
        <Pressable
          onPress={() => setWhyOpen(true)}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          accessibilityRole="button"
          accessibilityLabel={day.title}
          accessibilityHint="Ver por qué predominó este estado"
        >
          <Animated.View style={press.animatedStyle}>
            <StateGlyph stateKey={day.key} color={color} />
          </Animated.View>
        </Pressable>
        <Text style={[styles.stateTitle, { color }]}>{day.title}</Text>
        <Text style={styles.stateExplanation}>{day.explanation}</Text>
        <Text style={[styles.whyHint, { color }]}>Toca el astro para ver por qué ›</Text>
      </View>

      <WhyModal day={day} color={color} visible={whyOpen} onClose={() => setWhyOpen(false)} />

      {/* LA EVIDENCIA — el cielo que encendiste hoy: cada señal una estrella
          tintada a SU dimensión, enhebradas por un hilo de luz. La del driver
          brilla mayor (confirma el titular). Se encienden escalonadas al montar. */}
      {day.evidence.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>La evidencia</Text>
          {day.evidence.map((e, i) => {
            const major = day.driver != null && e.signal === day.driver
            const last = i === day.evidence.length - 1
            return (
              <Animated.View
                key={e.label}
                entering={FadeIn.duration(420).delay(i * 70)}
                style={styles.evidenceRow}
              >
                <View style={styles.evidenceChannel}>
                  {!last ? <View style={styles.evidenceThread} /> : null}
                  <EvidenceStar color={EVIDENCE_TONE[e.tone]} major={major} />
                </View>
                <View style={styles.evidenceText}>
                  <Text style={[styles.evidenceLabel, major && styles.evidenceLabelMajor]}>
                    {e.label}
                  </Text>
                  {e.detail ? <Text style={styles.evidenceDetail}>{e.detail}</Text> : null}
                </View>
              </Animated.View>
            )
          })}
        </View>
      ) : null}

      {/* TODAVÍA NO VIMOS — ausencia, no error (secundaria a la evidencia). Cada
          una es un CTA suave: tocar lleva a registrarla (sin culpa, sin "te faltó"). */}
      {day.absent.length > 0 ? (
        <View style={styles.sectionAbsent}>
          <Text style={styles.eyebrowQuiet}>Todavía no vimos</Text>
          <Text style={styles.absentHint}>Tócalas para sumarlas a tu día.</Text>
          <View style={styles.absentRow}>
            {day.absent.map((a) => (
              <Pressable
                key={a.key}
                style={styles.absentItem}
                onPress={() => goRegister(a.key)}
                accessibilityRole="button"
                accessibilityLabel={`Registrar ${a.label}`}
              >
                <PulsingDot color={ABSENT_TONE[a.key] ?? colors.magentaHot} />
                <Text style={styles.absentLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Cierre — conecta con Órbita Semana (voz del coach). */}
      <Text style={styles.closing}>{day.closing}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 6,
  },
  header: {
    marginBottom: 22,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: 30,
    letterSpacing: -1.2,
    lineHeight: 36,
    color: colors.leche,
  },
  date: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  backToToday: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  backToTodayText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
    color: colors.magenta,
  },
  // ── Estados de carga / error / vacío ─────────────────────────────
  card: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  cardTitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 20,
    lineHeight: 27,
    color: colors.leche,
  },
  cardBody: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.niebla,
  },
  retry: {
    marginTop: 14,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.oro,
  },
  // ── Hero (el estado como constelación) ───────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 20,
  },
  glyphStage: {
    width: STAGE,
    height: STAGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // En el héroe el astro manda: grande y solo sobre el aura.
  glyphImgHero: {
    width: 196,
    height: 196,
  },
  stateTitle: {
    marginTop: 4,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 27,
    lineHeight: 33,
    textAlign: 'center',
  },
  stateExplanation: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  whyHint: {
    marginTop: 14,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
    opacity: 0.75,
  },
  // ── Modal "Por qué" (datos reales de las señales · sistema de Órbita Mes) ──
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
    alignItems: 'flex-start',
    gap: 9,
  },
  modalTitleDot: {
    marginTop: 10,
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  modalTitle: {
    flex: 1,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 22,
    lineHeight: 28,
  },
  modalLead: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 20,
    color: colors.bone,
  },
  // El dato concreto que decidió un estado de amplitud (constancia/equilibrio).
  modalStat: {
    marginTop: 12,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
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
    width: 84,
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
  },
  barValue: {
    width: 78,
    textAlign: 'right',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  barValueHi: {
    fontFamily: typography.uiBold,
    color: colors.leche,
  },
  modalZeroNote: {
    marginTop: 16,
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    lineHeight: 19,
    color: colors.niebla,
  },
  modalCloseBtn: {
    marginTop: 20,
    alignSelf: 'center',
  },
  modalClose: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    color: colors.niebla,
  },
  // ── Secciones (evidencia / ausencias) ────────────────────────────
  section: {
    marginTop: 26,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 14,
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    marginBottom: 18,
  },
  // Canal fijo: la estrella se centra y el hilo cae recto entre estrellas (el
  // hilo va absoluto desde debajo de esta estrella hasta el centro de la siguiente,
  // cruzando el gap con bottom negativo — funciona con filas de altura variable).
  evidenceChannel: {
    width: 20,
    paddingTop: 2,
    alignItems: 'center',
  },
  evidenceThread: {
    position: 'absolute',
    top: 20,
    bottom: -18,
    width: 1,
    backgroundColor: 'rgba(244, 236, 222, 0.13)',
  },
  evidenceText: {
    flex: 1,
  },
  evidenceLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  // La evidencia del driver del estado pesa más (confirma el titular).
  evidenceLabelMajor: {
    fontFamily: typography.uiBold,
  },
  evidenceDetail: {
    marginTop: 2,
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  // ── Todavía no vimos (secundaria) ────────────────────────────────
  sectionAbsent: {
    marginTop: 36,
  },
  // Eyebrow más callado que el de la evidencia: las ausencias no compiten.
  eyebrowQuiet: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.bruma,
    marginBottom: 12,
  },
  absentHint: {
    marginTop: -8,
    marginBottom: 14,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.bone,
  },
  absentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  absentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 44,
    paddingVertical: 11,
    paddingLeft: 13,
    paddingRight: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  absentLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.leche,
  },
  // Punto que late (núcleo + halo expansivo): afordancia de "tócame".
  dotWrap: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotHalo: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotCore: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  // ── Cierre ───────────────────────────────────────────────────────
  closing: {
    marginTop: 34,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 25,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
})
