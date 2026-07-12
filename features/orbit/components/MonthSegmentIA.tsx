import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { useTransformProgress } from '@/features/emblem'
import { useMacroTargets } from '@/features/macros/hooks'
import { useProfile } from '@/features/profile/hooks'
import { RevealedEmblem } from '@/features/tabs/components/constellation/RevealedEmblem'
import { signName, zodiacFromDate } from '@/features/tabs/zodiac'
import { useSession } from '@/hooks/useSession'
import { track } from '@/lib/analytics'
import { USE_PERSISTED_MONTH_REPORT } from '@/lib/featureFlags'
import { queryKeys } from '@/lib/queryKeys'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { useFindingTranscript } from '../chat-transcript'
import { type Finding, hashFindings } from '../findings'
import { useKeepFoco, useKeptFocos } from '../focos'
import { useSignalsHistory } from '../hooks'
import { buildMonthChat, type MonthChatEmptyReason } from '../month-chat'
import { monthCalendar, presenceSummary } from '../month-built'
import { usePriorReflections, useSaveReflection } from '../reflections'
import { useMonthlyReport } from '../report-hooks'

import { EmptySegmentCard } from './EmptySegmentCard'
import { MonthChatSheet } from './MonthChatSheet'
import { MonthDiscovery } from './MonthDiscovery'
import { MonthFocoCallback } from './MonthFocoCallback'
import { MonthGlanceCalendar } from './MonthGlanceCalendar'
import { MonthKeptFocos } from './MonthKeptFocos'
import { PresenceFinale } from './PresenceFinale'

/*
 * Órbita Mes IA (Release 2, tras el flag ORBITA_MES_IA_ENABLED) — el rediseño
 * a DESCUBRIMIENTO GUIADO. docs/orbita-mes-ia-spec.md. Reemplaza el chasis de
 * 4 tiempos por: hero (constelación, reusa) → "Lo que aprendimos este mes"
 * (chat con botones) → calendario (evidencia, tap→Día). Presencia y patrones
 * profundos se enchufan en fases siguientes.
 *
 * El motor de conversación (month-chat) y los datos (month-built) son puros y
 * ya testeados; aquí solo se orquesta y se viste.
 */

const HERO_SIZE = 200
/** Bajo este % el número deflaciona (anti-anillo de Apple): mismo umbral que
 *  el Mes actual. */
const PCT_THRESHOLD = 8

/** El estado vacío HONESTO de la antesala, diferenciado por la razón: no es lo
 *  mismo "aún faltan registros" que "registraste harto pero no hay un patrón
 *  claro todavía". Sin culpa, sin contar días (la frecuencia se siente, no se
 *  cuenta · manifiesto). */
const EMPTY_COPY: Record<MonthChatEmptyReason, { eyebrow: string; body: string; hint: string }> = {
  'insufficient-data': {
    eyebrow: 'Todavía estoy aprendiendo',
    body: 'Cuando tengas más días registrados, podré mostrarte lo que se repite en tu mes. Con cada día que registras desde Hoy, el mes se va dibujando.',
    hint: 'Tu constelación nunca se reinicia: lo que revelas, queda.',
  },
  'no-findings': {
    eyebrow: 'Sigo mirando tu mes',
    body: 'Tienes varios días registrados, pero todavía no aparece un patrón claro. No es un problema; a veces el mes necesita unos días más para mostrar su forma.',
    hint: 'En cuanto algo se repita lo suficiente, te lo muestro aquí.',
  },
}

export function MonthSegmentIA({ onPickDay }: { onPickDay?: (date: string) => void }) {
  const today = todayInTimezone()
  const month = today.slice(0, 7)
  const { data: history } = useSignalsHistory(31)
  const signals = useMemo(() => history ?? [], [history])
  const targets = useMacroTargets().data
  const { data: profile } = useProfile()
  const sign = profile ? zodiacFromDate(profile.date_of_birth) : null
  const { progress } = useTransformProgress()
  const { session } = useSession()
  const uid = session?.user?.id ?? null

  // "Cerrar el loop": respuestas de meses anteriores → Stelar recuerda lo que
  // dijiste la última vez. Vacío en el primer mes (sin pasado, sin callbacks).
  const prior = usePriorReflections(month, uid).data
  // Persistir la metacognición (month_reflections): la semilla de continuidad
  // entre meses (R6). La pregunta hoy solo la hace el chat scripteado de la beta
  // (FindingView); en el flujo IA está apagada por decisión de producto.
  const saveReflection = useSaveReflection(month)

  const chat = useMemo(
    () =>
      buildMonthChat(
        signals,
        { calorieTarget: targets?.calories ?? null, proteinTarget: targets?.protein_g ?? null },
        prior ?? {},
      ),
    [signals, targets?.calories, targets?.protein_g, prior],
  )

  const firstDataDay = signals.length > 0 ? signals[0]!.day : null
  const calendar = useMemo(
    () => monthCalendar(signals, { today, calorieTarget: targets?.calories ?? null, firstDataDay }),
    [signals, today, targets?.calories, firstDataDay],
  )
  const presence = useMemo(() => presenceSummary(signals), [signals])

  // Flip (T5.3): con USE_PERSISTED_MONTH_REPORT ON, los hallazgos + el hash
  // vienen del REPORTE persistido (writer compute-findings → monthly_reports).
  // Por construcción son idénticos al compute-local (mismo motor, misma ventana
  // de 31 días · hay test de paridad). OFF por default → el hook duerme (cero
  // red) y todo sale de `chat` exactamente como hoy.
  const persistedReport = useMonthlyReport({
    uid,
    month,
    period: 'last30',
    periodStart: firstDataDay ?? `${month}-01`,
    periodEnd: today,
    signals,
    ctx: { calorieTarget: targets?.calories ?? null, proteinTarget: targets?.protein_g ?? null },
    prior: prior ?? {},
    enabled: USE_PERSISTED_MONTH_REPORT,
  }).data
  const source = USE_PERSISTED_MONTH_REPORT ? persistedReport : null
  const cards = source?.findings ?? chat.cards

  // El hero lidera con el VEREDICTO de déficit (el norte: "¿voy bajando?"), que
  // es la estrella, no un cruce naciente de 3 días. Su palanca (el foco) la ARMA
  // el motor (`lever`: "cuida los viernes"), no la IA. Si no hay veredicto aún
  // (pocos días), cae al top del ranking.
  const mainFinding = useMemo(() => {
    if (cards.length === 0) return null
    return cards.find((c) => c.id === 'deficit-summary') ?? cards[0] ?? null
  }, [cards])

  // "Me lo quedo presente" (Stage 2): compromiso suave, sin veredicto. El keep
  // guarda la PALANCA concreta del cierre del chat (no un gesto vago). El keep es
  // idempotente. `focoByFinding` mapea hallazgo → su foco guardado (para pintarlo).
  const keep = useKeepFoco(month)
  const { data: keptFocos = [] } = useKeptFocos(uid)
  const focoByFinding = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of keptFocos) if (!m.has(f.findingId)) m.set(f.findingId, f.foco)
    return m
  }, [keptFocos])
  // La memoria "Lo que fuiste mirando" solo muestra meses ANTERIORES (el actual
  // ya vive en la discovery), así que solo aparece si hay focos de otros meses.
  const hasPastFocos = keptFocos.some((f) => f.month !== month)

  // Loop de regreso (Stage 3): el foco del mes PASADO reaparece arriba hasta que
  // la usuaria se queda un foco de este mes (o lo posterga). `stillPresent` = si
  // el patrón que lo originó volvió a asomar (observación, no examen).
  const [callbackDismissed, setCallbackDismissed] = useState(false)
  const prevFoco = keptFocos.find((f) => f.month < month) ?? null
  const hasCurrentFoco = keptFocos.some((f) => f.month === month)
  const showCallback = !!prevFoco && !hasCurrentFoco && !callbackDismissed
  const focoStillPresent = prevFoco ? cards.some((c) => c.id === prevFoco.findingId) : false

  // Profundizar: tocar el CTA abre la conversación guiada sobre el hallazgo. El
  // chat es la experiencia principal (el motor detecta, la IA comunica).
  const [openFinding, setOpenFinding] = useState<Finding | null>(null)
  // El hash sale del reporte cuando el flip está ON (no recomputa); si no, se
  // computa local sobre los mismos hallazgos.
  const localHash = useMemo(() => hashFindings(chat.cards), [chat.cards])
  const findingsHash = source?.findingsHash ?? localHash
  const monthKey = `${month}-01`

  // ¿Ya conversaste este hallazgo? Si hay transcript guardado (mismo hash), el
  // CTA de la discovery pasa de invitar a RETOMAR. Se re-lee al cerrar el chat
  // (setOpenFinding(null) re-renderiza) y en cada arranque (persistido 24 h).
  const { read: readMainTranscript } = useFindingTranscript(
    uid,
    mainFinding?.id ?? '',
    findingsHash,
  )
  const talkedToMain = mainFinding != null && readMainTranscript() != null
  const factTitle = openFinding
    ? openFinding.subject.charAt(0).toUpperCase() + openFinding.subject.slice(1)
    : ''

  // Analytics del loop de descubrimiento (T3): entró → descubrió → profundizó.
  // "Entró" = el reporte quedó a la vista. Ref-guard por findingsHash → un evento
  // por reporte distinto, no uno en cada render.
  const seenHashRef = useRef<string | null>(null)
  useEffect(() => {
    if (!chat.ready || cards.length === 0) return
    if (seenHashRef.current === findingsHash) return
    seenHashRef.current = findingsHash
    track('orbit_month_teaser_seen', { findings_count: cards.length, dimension: cards[0]!.id })
  }, [chat.ready, cards, findingsHash])

  // Cuando el reporte persistido carga, el writer YA escribió las hipótesis
  // (compute-findings persiste y LUEGO responde). useHypotheses/useActiveExperiment
  // pudieron montar antes con la tabla vacía → invalidamos para que refetcheen y
  // aparezcan los "hilos" sin tener que salir y volver a entrar.
  const qc = useQueryClient()
  const invalidatedHashRef = useRef<string | null>(null)
  useEffect(() => {
    if (!persistedReport || !uid) return
    if (invalidatedHashRef.current === persistedReport.findingsHash) return
    invalidatedHashRef.current = persistedReport.findingsHash
    void qc.invalidateQueries({ queryKey: queryKeys.hypotheses.all })
    void qc.invalidateQueries({ queryKey: queryKeys.experiments.active(uid) })
  }, [persistedReport, uid, qc])

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {/* ── Hero: constelación + signo + % revelado ── */}
      <View style={styles.hero}>
        <View style={styles.emblem}>
          {sign ? (
            <RevealedEmblem
              sign={sign}
              transformProgress={progress}
              size={HERO_SIZE}
              masterOpacity={0.95}
              frameOpacity={0.6}
              glyphOpacity={0.78}
              bloomMaxOpacity={0.72}
              breathe
            />
          ) : null}
        </View>
        <Text style={styles.heroSign}>{sign ? signName(sign) : ''}</Text>
        {progress < PCT_THRESHOLD ? (
          <Text style={styles.heroPct}>Apenas empieza a revelarse</Text>
        ) : (
          <Text style={styles.heroPct}>
            {progress}
            <Text style={styles.heroPctSign}>% revelado</Text>
          </Text>
        )}
        <Text style={styles.heroLine}>
          No es una meta. Es lo que tus acciones empezaron a construir.
        </Text>
      </View>

      {/* ── Loop de regreso: el foco del mes pasado te recibe (Stelar recuerda). ── */}
      {showCallback && prevFoco ? (
        <View style={styles.section}>
          <MonthFocoCallback
            foco={prevFoco.foco}
            stillPresent={focoStillPresent}
            following={keep.isPending}
            onFollow={() => keep.mutate({ findingId: prevFoco.findingId, foco: prevFoco.foco })}
            onDismiss={() => setCallbackDismissed(true)}
          />
        </View>
      ) : null}

      {/* ── El hallazgo principal como evidencia serena + UN CTA que abre la
          conversación (rediseño: el chat es la experiencia, no un experimento que
          la usuaria opera). El motor detecta; la IA comunica. ── */}
      {mainFinding ? (
        <View style={styles.antesala}>
          <MonthDiscovery
            finding={mainFinding}
            talked={talkedToMain}
            onExplore={() => setOpenFinding(mainFinding)}
          />
        </View>
      ) : chat.reason ? (
        // Estado vacío HONESTO cuando aún no hay un hallazgo que conversar.
        <EmptySegmentCard {...EMPTY_COPY[chat.reason]} />
      ) : null}

      {/* "Lo que fuiste mirando": memoria de focos de meses ANTERIORES (el del mes
          actual ya está en la discovery). Read-only: es un recuerdo, no otra
          puerta al mismo chat. */}
      {hasPastFocos ? (
        <View style={styles.section}>
          <MonthKeptFocos focos={keptFocos} currentMonth={month} />
        </View>
      ) : null}

      {/* ── Tu mes de un vistazo: el calendario (evidencia, tap→Día) ── */}
      {calendar ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Tu mes de un vistazo</Text>
          <MonthGlanceCalendar data={calendar} onPickDay={onPickDay} />
        </View>
      ) : null}

      {/* ── Presencia: cierre callado (reusa PresenceFinale). Se gana su lugar
          con ≥7 días de presencia (nunca presentado como progreso físico). ── */}
      {presence && presence.presentDays >= 7 ? <PresenceFinale presence={presence} /> : null}

      {/* ── Profundizar: la conversación corta sobre UN hecho (fact-led). El
          reporte es el hub, así que cierra de vuelta (sin ciclo, sin metacognición
          repetida por hecho). ── */}
      <MonthChatSheet
        finding={openFinding}
        title={factTitle}
        sign={sign}
        periodStart={monthKey}
        periodEnd={monthKey}
        findingsHash={findingsHash}
        askMetacognition={false}
        hasMore={false}
        onSaveReflection={(questionKey, answer) => saveReflection.mutate({ questionKey, answer })}
        // "Me lo quedo presente" desde el cierre del chat: guarda la palanca
        // concreta que aterrizó la IA como foco de ESTE hallazgo.
        onKeepFoco={(foco) => openFinding && keep.mutate({ findingId: openFinding.id, foco })}
        kept={openFinding ? focoByFinding.has(openFinding.id) : false}
        onNext={() => setOpenFinding(null)}
        onClose={() => setOpenFinding(null)}
        onPickDay={(date) => {
          setOpenFinding(null)
          onPickDay?.(date)
        }}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 40, gap: 30 },
  hero: {
    alignItems: 'center',
    paddingTop: 8,
    gap: 4,
  },
  emblem: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSign: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displayMd,
    color: colors.leche,
    letterSpacing: -0.6,
    marginTop: 6,
  },
  // El % es CEREMONIA (progreso del cielo), no acción → oro, no magenta. Así el
  // magenta queda solo para "aquí Stelar habla / actúas" (el CTA), sin competir.
  heroPct: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.title,
    color: colors.oroSoft,
  },
  heroPctSign: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.oro,
  },
  heroLine: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.bone,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 28,
  },
  section: { gap: 16 },
  antesala: { gap: 24 },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
})
