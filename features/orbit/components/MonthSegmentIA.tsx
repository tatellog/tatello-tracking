import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { useTransformProgress } from '@/features/emblem'
import { useMacroTargets } from '@/features/macros/hooks'
import { useProfile } from '@/features/profile/hooks'
import { RevealedEmblem } from '@/features/tabs/components/constellation/RevealedEmblem'
import { signName, zodiacFromDate } from '@/features/tabs/zodiac'
import { useSession } from '@/hooks/useSession'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { useSignalsHistory } from '../hooks'
import { buildMonthChat, type PatternCard } from '../month-chat'
import { monthCalendar, presenceSummary } from '../month-built'
import type { InsightDetail } from '../month-insight'
import { usePriorReflections, useSaveReflection } from '../reflections'

import { MonthChatSheet } from './MonthChatSheet'
import { StelarSpeaks } from './MonthChatView'
import { MonthGlanceCalendar } from './MonthGlanceCalendar'
import { MonthPatternCards } from './MonthPatternCards'
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

  // El detalle guiado se abre en su sala (sheet) desde la tarjeta de hallazgo.
  // `open` = { detalle, título } | null.
  const [open, setOpen] = useState<{ detail: InsightDetail; title: string } | null>(null)
  const openCard = (card: PatternCard) => setOpen({ detail: card.detail, title: card.label })

  // "Una sola cosa": se muestra UNA tarjeta a la vez; "Explorar otra" avanza a
  // la siguiente (opt-in, no un muro). Con 1 mes de datos, casi siempre 1.
  const [cardIdx, setCardIdx] = useState(0)
  const cards = chat.cards
  const currentCard = cards.length > 0 ? cards[cardIdx % cards.length] : null

  // "Explorar otro hallazgo" desde el detalle: avanza a la siguiente tarjeta y
  // abre su detalle (una lectura continua, sin volver al muro).
  const exploreOther = () => {
    if (cards.length <= 1) {
      setOpen(null)
      return
    }
    const next = (cardIdx + 1) % cards.length
    setCardIdx(next)
    setOpen({ detail: cards[next]!.detail, title: cards[next]!.label })
  }

  // Apertura de la antesala: gancho corto determinista (el párrafo largo de IA
  // abrumaba · feedback dueña). El detalle vive dentro de la conversación.
  const introBubbles = chat.picker?.intro ?? []

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

      {/* ── Antesala PODADA (feedback dueña: mes 1 abrumaba): gancho corto +
          UNA tarjeta de hallazgo a la vez + "Explorar otra" opcional. Sin
          párrafo largo de IA, sin fila de chips. ── */}
      {chat.ready && chat.picker ? (
        <View style={styles.section}>
          <StelarSpeaks bubbles={introBubbles} />
          {currentCard ? <MonthPatternCards cards={[currentCard]} onPick={openCard} /> : null}
          {cards.length > 1 ? (
            <Pressable
              onPress={() => setCardIdx((i) => i + 1)}
              accessibilityRole="button"
              accessibilityLabel="Explorar otra cosa"
              style={styles.explore}
            >
              <Text style={styles.exploreText}>Explorar otra ✦</Text>
            </Pressable>
          ) : null}
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

      {/* ── La sala: la conversación del tema elegido, full-screen. ── */}
      <MonthChatSheet
        detail={open?.detail ?? null}
        title={open?.title ?? ''}
        sign={sign}
        onSaveReflection={(questionKey, answer) => saveReflection.mutate({ questionKey, answer })}
        onExploreOther={exploreOther}
        onClose={() => setOpen(null)}
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
  section: { gap: 14 },
  // "Explorar otra ✦" — opt-in, discreto (no un CTA que empuja).
  explore: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  exploreText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    color: colors.oroSoft,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
})
