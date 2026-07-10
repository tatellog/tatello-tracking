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

  // El hallazgo que lidera la conversación: ANCLADO EN EL NORTE (déficit /
  // objetivo), que es lo que la usuaria quiere saber ("¿voy bajando?"). Si no hay
  // uno de déficit, el que conecta con su objetivo; si no, el top del motor.
  const mainFinding = useMemo(() => {
    if (cards.length === 0) return null
    return (
      cards.find((c) => c.category === 'deficit') ??
      cards.find((c) => c.northLink) ??
      cards[0] ??
      null
    )
  }, [cards])

  // "Me lo quedo presente" (Stage 2): compromiso suave, sin veredicto. Los focos
  // guardados + la memoria "Lo que fuiste mirando". El keep es idempotente.
  const keep = useKeepFoco(month)
  const { data: keptFocos = [] } = useKeptFocos(uid)
  const mainKept = mainFinding ? keptFocos.some((f) => f.findingId === mainFinding.id) : false
  const availableIds = useMemo(() => new Set(cards.map((c) => c.id)), [cards])

  // Profundizar: tocar el CTA abre la conversación guiada sobre el hallazgo. El
  // chat es la experiencia principal (el motor detecta, la IA comunica).
  const [openFinding, setOpenFinding] = useState<Finding | null>(null)
  // El hash sale del reporte cuando el flip está ON (no recomputa); si no, se
  // computa local sobre los mismos hallazgos.
  const localHash = useMemo(() => hashFindings(chat.cards), [chat.cards])
  const findingsHash = source?.findingsHash ?? localHash
  const monthKey = `${month}-01`
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

      {/* ── El hallazgo principal como evidencia serena + UN CTA que abre la
          conversación (rediseño: el chat es la experiencia, no un experimento que
          la usuaria opera). El motor detecta; la IA comunica. ── */}
      {mainFinding ? (
        <View style={styles.antesala}>
          <MonthDiscovery
            finding={mainFinding}
            onExplore={() => setOpenFinding(mainFinding)}
            kept={mainKept}
            keeping={keep.isPending}
            onKeep={() => keep.mutate({ id: mainFinding.id, subject: mainFinding.subject })}
          />
        </View>
      ) : chat.reason ? (
        // Estado vacío HONESTO cuando aún no hay un hallazgo que conversar.
        <EmptySegmentCard {...EMPTY_COPY[chat.reason]} />
      ) : null}

      {/* "Lo que fuiste mirando": la memoria de focos, sin veredicto. Reabre el
          chat del hallazgo si sigue disponible este mes. */}
      {keptFocos.length > 0 ? (
        <View style={styles.section}>
          <MonthKeptFocos
            focos={keptFocos}
            availableIds={availableIds}
            onReopen={(fid) => {
              const f = cards.find((c) => c.id === fid)
              if (f) setOpenFinding(f)
            }}
          />
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
  heroPct: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.title,
    color: colors.magenta,
  },
  heroPctSign: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.magenta,
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
