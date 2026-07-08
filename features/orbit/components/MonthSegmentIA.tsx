import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { useTransformProgress } from '@/features/emblem'
import { useMacroTargets } from '@/features/macros/hooks'
import { useProfile } from '@/features/profile/hooks'
import { RevealedEmblem } from '@/features/tabs/components/constellation/RevealedEmblem'
import { signName, zodiacFromDate } from '@/features/tabs/zodiac'
import { useSession } from '@/hooks/useSession'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { useAiVoice } from '../ai-voice'
import { useSignalsHistory } from '../hooks'
import { buildMonthChat, monthChatInsights } from '../month-chat'
import { monthCalendar, presenceSummary } from '../month-built'
import { useSaveReflection } from '../reflections'

import { MonthChatView } from './MonthChatView'
import { MonthGlanceCalendar } from './MonthGlanceCalendar'
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

export function MonthSegmentIA({ onPickDay }: { onPickDay?: (date: string) => void }) {
  const today = todayInTimezone()
  const month = today.slice(0, 7)
  const { data: history } = useSignalsHistory(31)
  const signals = useMemo(() => history ?? [], [history])
  const targets = useMacroTargets().data
  const { data: profile } = useProfile()
  const sign = profile ? zodiacFromDate(profile.date_of_birth) : null
  const { progress } = useTransformProgress()
  const saveReflection = useSaveReflection(month)
  const { session } = useSession()
  const uid = session?.user?.id ?? null

  const chat = useMemo(
    () =>
      buildMonthChat(signals, {
        calorieTarget: targets?.calories ?? null,
        proteinTarget: targets?.protein_g ?? null,
      }),
    [signals, targets?.calories, targets?.protein_g],
  )

  // Voz de IA (Release 1): gpt-4o-mini redacta la apertura EXPLICANDO los
  // hallazgos deterministas del mes, cacheada por context_hash. Gateada por
  // AI_VOICE_ENABLED dentro del hook; si falla o está apagada → null y el
  // chat usa su intro determinista. Solo se llama con datos suficientes.
  const insights = useMemo(() => monthChatInsights(chat), [chat])
  const aiVoice = useAiVoice(
    uid,
    chat.ready
      ? {
          feature: 'orbita_mes',
          periodType: 'month',
          periodStart: `${month}-01`,
          periodEnd: today,
          insights,
        }
      : null,
  )

  const firstDataDay = signals.length > 0 ? signals[0]!.day : null
  const calendar = useMemo(
    () => monthCalendar(signals, { today, calorieTarget: targets?.calories ?? null, firstDataDay }),
    [signals, today, targets?.calories, firstDataDay],
  )
  const presence = useMemo(() => presenceSummary(signals), [signals])

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

      {/* ── Lo que aprendimos este mes: el chat guiado ── */}
      <View style={styles.section}>
        <Text style={styles.eyebrow}>Lo que aprendimos este mes</Text>
        <MonthChatView
          chat={chat}
          aiIntro={aiVoice.data}
          onSaveReflection={(questionKey, answer) => saveReflection.mutate({ questionKey, answer })}
          onOpenCalendar={() => {
            /* El calendario ya vive abajo como evidencia; el turno cierra. */
          }}
        />
      </View>

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
  section: { gap: 14 },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
})
