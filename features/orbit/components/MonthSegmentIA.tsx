import { useMemo, useState } from 'react'
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

import type { Finding, FindingCategory } from '../findings'
import { useSignalsHistory } from '../hooks'
import { buildMonthChat } from '../month-chat'
import { monthCalendar, presenceSummary } from '../month-built'
import { usePriorReflections, useSaveReflection } from '../reflections'

import { MonthChatSheet } from './MonthChatSheet'
import { StelarSpeaks } from './MonthChatView'
import { MonthGlanceCalendar } from './MonthGlanceCalendar'
import { MonthPatternCards } from './MonthPatternCards'
import { MonthReading } from './MonthReading'
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

/** El título del header del detalle, por categoría del hallazgo. */
const CATEGORY_LABEL: Record<FindingCategory, string> = {
  deficit: 'Déficit',
  movimiento: 'Movimiento',
  sueno: 'Sueño',
  agua: 'Agua',
  proteina: 'Proteína',
  alimentacion: 'Alimentación',
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
  const saveReflection = useSaveReflection(month)
  const { session } = useSession()
  const uid = session?.user?.id ?? null

  // "Cerrar el loop": respuestas de meses anteriores → Stelar recuerda lo que
  // dijiste la última vez. Vacío en el primer mes (sin pasado, sin callbacks).
  const prior = usePriorReflections(month, uid).data

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

  const cards = chat.cards

  // Pantalla 1: Stelar "lee tu mes" (orbe + onda + texto) antes de revelar los
  // hallazgos. Se muestra una vez por montaje cuando ya hay datos.
  const [read, setRead] = useState(false)

  // El detalle guiado del hallazgo se abre en su sala (sheet).
  const [openFinding, setOpenFinding] = useState<Finding | null>(null)

  // "Muéstrame otro patrón" desde el detalle: abre el siguiente hallazgo.
  const nextFinding = () => {
    if (cards.length <= 1) {
      setOpenFinding(null)
      return
    }
    const i = cards.findIndex((c) => c.id === openFinding?.id)
    setOpenFinding(cards[(i + 1) % cards.length]!)
  }

  const introBubbles = chat.intro

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

      {/* ── Pantalla 1: Stelar leyendo tu mes (orbe + onda + texto cíclico). ── */}
      {chat.ready && !read ? (
        <MonthReading days={signals.length} onDone={() => setRead(true)} />
      ) : null}

      {/* ── Pantalla 2: la apertura + las cards de patrón (sesión de
          descubrimiento). Cada card abre su detalle guiado. ── */}
      {chat.ready && read ? (
        <View style={styles.antesala}>
          <StelarSpeaks bubbles={introBubbles} />
          <MonthPatternCards cards={cards} onPick={setOpenFinding} />
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

      {/* ── La sala: el detalle guiado del hallazgo, full-screen. ── */}
      <MonthChatSheet
        finding={openFinding}
        title={openFinding ? CATEGORY_LABEL[openFinding.category] : ''}
        sign={sign}
        onSaveReflection={(questionKey, answer) => saveReflection.mutate({ questionKey, answer })}
        onNext={nextFinding}
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
