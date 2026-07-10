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
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { type Finding, hashFindings } from '../findings'
import { useSignalsHistory } from '../hooks'
import { buildMonthChat } from '../month-chat'
import { monthCalendar, presenceSummary } from '../month-built'
import { usePriorReflections, useSaveReflection } from '../reflections'
import { useMonthlyReport } from '../report-hooks'

import { MonthChatSheet } from './MonthChatSheet'
import { MonthDiscoveryTeaser } from './MonthDiscoveryTeaser'
import { MonthGlanceCalendar } from './MonthGlanceCalendar'
import { MonthReport } from './MonthReport'
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

/** La línea honesta del teaser híbrido: sobre qué es el hallazgo líder (para
 *  que la promesa no sea una caja de misterio vacía). */
function teaserDimension(f: Finding): string {
  switch (f.id) {
    case 'deficit-summary':
      return 'sobre tu déficit del mes'
    case 'water-deficit':
      return 'sobre tus días con agua'
    case 'training-deficit':
      return 'sobre los días que entrenaste'
    case 'weekday-calories':
      return 'sobre un día de tu semana'
    default:
      return 'sobre tu mes'
  }
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

  // El teaser invita; al tocar, se revela el REPORTE de evidencia (los hechos).
  const [revealed, setRevealed] = useState(false)
  // Profundizar: tocar un hecho abre una conversación corta (fact-led). El
  // reporte es el hub; la conversación cierra de vuelta a él (sin loop, sin
  // repetir la metacognición en cada hecho).
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

      {/* ── El teaser invita; al tocar, revela el reporte de evidencia (los
          hechos: veredicto → dónde se te va → puerta abierta). ── */}
      {chat.ready && cards.length > 0 ? (
        <View style={styles.antesala}>
          {revealed ? (
            <MonthReport
              cards={cards}
              onPickFact={(f) => {
                // "Profundizó": abrió un hecho para entenderlo.
                track('orbit_month_finding_opened', {
                  finding_id: f.id,
                  is_obstacle: f.isObstacle ?? false,
                })
                setOpenFinding(f)
              }}
            />
          ) : (
            <MonthDiscoveryTeaser
              dimension={teaserDimension(cards[0]!)}
              onStart={() => {
                // "Descubrió": tocó el teaser y reveló el reporte de evidencia.
                track('orbit_month_report_revealed', { dimension: cards[0]!.id })
                setRevealed(true)
              }}
            />
          )}
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
