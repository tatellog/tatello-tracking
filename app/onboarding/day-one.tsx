import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useBriefContext } from '@/features/brief/hooks'
import { DayOneTask, WizardBackdrop } from '@/features/onboarding/components'
import { type MonthlyFocus } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { LunarConstellation } from '@/features/tabs/components/constellation/LunarConstellation'
import { ZODIAC, ZodiacFigure, zodiacFromDate, type ZodiacSign } from '@/features/tabs/zodiac'
import { markVisitedDayOne } from '@/lib/onboardingFlags'
import { colors, typography } from '@/theme'

const TASKS: { num: number; text: string }[] = [
  {
    num: 1,
    text: 'Registra tu primera comida del día. La señal más rápida que Stelar lee.',
  },
  {
    num: 2,
    text: 'Marca tu primer entreno cuando lo termines, aunque sea caminar.',
  },
]

/** Phrases the recap card uses when listing what Stelar already
 *  knows from the wizard. Same vocabulary as the reveal so the
 *  Día 1 lands as continuation, not as a new screen. */
const FOCUS_RECAP: Record<MonthlyFocus, string> = {
  weight: 'quieres bajar de peso',
  energy: 'quieres más energía',
  sleep: 'quieres dormir mejor',
  food: 'quieres cambiar tu relación con la comida',
  cycle: 'quieres conocer tu ciclo',
  patterns: 'quieres entender tus patrones',
  mind: 'quieres calmar la mente',
  other: 'tienes una intención propia',
}

/*
 * Día 1 — the bridge between the wizard and the real Home. After
 * the reveal's cosmic moment, this page used to break the spell
 * with a light pearl theme. Now it stays in the same dark+magenta
 * register as the rest of onboarding, opens with the SAME progress
 * constellation the user will see every day in the Hoy tab — now
 * with its FIRST star lit (today) and the next one pulsing — then a
 * recap card that names back what Stelar captured (sunk-cost
 * validation), then the small tasks for today.
 *
 * THE OPEN LOOP (illustrator-specialist spec): the reveal's
 * ceremony formed the sign's constellation and let it sink; Día 1
 * RECOVERS it as the live progress system. We MOUNT the real
 * <LunarConstellation> (the same component the tab renders) with
 * `trained=[true, …27×false]`, `todayIdx=0`, `committed=false`. The
 * `committed=false` is CRITICAL: it keeps the "next star" affordance
 * alive (the magenta halo that breathes around tomorrow's point) —
 * that pulsing next star IS the open loop, the reason to come back
 * mañana. `showCount=false` hides the "1/28" chip: a big count on
 * day one reads as "you're missing 27" = debt (manifiesto-prohibido);
 * the visual loop carries the meaning instead.
 *
 * The base cosmic backdrop (starfield + Stelar presence) is mounted PER
 * SCREEN (its own <WizardBackdrop />, opaque colors.bg base) so the
 * slide transition fully occludes the screen behind it. The presence
 * breath is shared via WizardPresenceContext so it never restarts.
 *
 * The expectation note at the bottom (formerly the reveal's "QUÉ SIGUE"
 * block) was moved here off the peak: it sets the longer arc — Stelar
 * arma la lectura cada día, y los patrones llegan a partir del segundo
 * ciclo — without crowding the reveal. Phrased as coach voice (serif
 * italic), it lands as a calm promise, not a target to hit.
 *
 * The body composition track (4 photos + initial weight) lives in
 * Settings → Track corporal; not surfaced here so Día 1 stays
 * focused on signals, not measurements.
 */
export default function DayOneScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data: profile } = useProfile()
  const { data: brief } = useBriefContext()

  const firstName = (profile?.display_name ?? '').trim().split(' ')[0] || 'tú'

  // Signo zodiacal — SAME derivation as the reveal (zodiacFromDate over
  // date_of_birth). We gate the whole constellation render on it: if
  // there's no birth date we never invent a sign (the reveal doesn't
  // either), and Día 1 falls back to its prior layout (no constellation)
  // without breaking.
  const sign: ZodiacSign | null = useMemo(
    () => (profile?.date_of_birth ? zodiacFromDate(profile.date_of_birth) : null),
    [profile?.date_of_birth],
  )

  // The 28-day grid with ONLY today (index 0) lit — the first star of the
  // cycle. Memoized with an empty dep so the array reference is stable
  // across re-renders (LunarConstellation memoizes its derived progress on
  // `trained`'s reference; a fresh array each render would invalidate the
  // whole downstream tree — see docs/perf/lunar-constellation-audit.md).
  const trained = useMemo<boolean[]>(() => [true, ...Array<boolean>(27).fill(false)], [])

  const constellationA11yLabel = sign
    ? `Tu constelación de ${ZODIAC[sign].label}: tu primera estrella encendida, la próxima esperándote`
    : undefined

  const handleEnter = async () => {
    await markVisitedDayOne()
    router.replace('/(tabs)')
  }

  // Build the recap list of what Stelar already knows. Each line is
  // a fact the user just confirmed in the wizard; the card
  // validates the 11 steps of input by surfacing them back. The
  // sign line includes the actual zodiac glyph so the recap reads
  // visually, not just textually.
  type Row = { label: string; value: string } | { label: string; value: string; zodiac: ZodiacSign }
  const recapLines = useMemo<Row[]>(() => {
    const out: Row[] = []
    if (profile?.date_of_birth) {
      const s = zodiacFromDate(profile.date_of_birth)
      out.push({ label: 'TU SIGNO', value: ZODIAC[s].label, zodiac: s })
    }
    if (
      profile?.cycle_situation === 'menstruates' ||
      profile?.cycle_situation === 'contraception'
    ) {
      out.push({ label: 'TU CICLO', value: 'leyéndose mes a mes' })
    }
    const w = brief?.latest_measurement?.weight_kg
    if (w != null) {
      out.push({ label: 'TU BASE', value: `${w.toFixed(1)} kg` })
    }
    const f = (profile?.monthly_focus as MonthlyFocus | null) ?? null
    if (f) {
      out.push({ label: 'TU FOCO', value: FOCUS_RECAP[f] })
    }
    return out
  }, [profile, brief])

  return (
    <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Per-screen opaque backdrop (starfield + shared breathing
          presence) so the slide occludes and the breath never restarts. */}
      <WizardBackdrop />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>Tu primer día</Text>
        <Text style={styles.title}>
          {firstName}, <Text style={styles.titleEm}>hoy empieza</Text>.
        </Text>

        {/* The open loop — the SAME progress constellation the Hoy tab
            shows, recovered from the reveal with its FIRST star lit.
            committed=false keeps the next star pulsing (the reason to
            return); showCount=false hides the "1/28" chip so no number
            reads as debt. Contained to ~64% width — the component is
            width:100% of its parent, so we size it via the wrapper, not
            the component. Only when we actually have a derived sign. */}
        {sign ? (
          <View
            style={styles.constellation}
            accessible
            accessibilityRole="image"
            accessibilityLabel={constellationA11yLabel}
          >
            <LunarConstellation
              sign={sign}
              trained={trained}
              todayIdx={0}
              committed={false}
              showCount={false}
            />
          </View>
        ) : null}

        {/* Coach line (serif italic) — names the loop the constellation
            just made visible: one star lit, the next waiting. */}
        <Text style={styles.sub}>
          Encendiste tu primera estrella. Mañana enciendes la siguiente, y tu cielo empieza a tomar
          forma.
        </Text>

        {/* Recap — "Stelar ya sabe esto de vos". Validates the 11
            wizard inputs by naming them back as facts Stelar holds. */}
        {recapLines.length > 0 ? (
          <View style={styles.recapCard}>
            <Text style={styles.recapEyebrow}>Stelar ya sabe esto de ti</Text>
            <View style={styles.recapList}>
              {recapLines.map((row) => (
                <View key={row.label} style={styles.recapRow}>
                  <Text style={styles.recapLabel}>{row.label}</Text>
                  <View style={styles.recapValueWrap}>
                    {'zodiac' in row ? (
                      <ZodiacFigure sign={row.zodiac} size={20} color={colors.magenta} />
                    ) : null}
                    <Text style={styles.recapValue}>{row.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.tasksList}>
          {TASKS.map((task) => (
            <DayOneTask key={task.num} num={task.num} text={task.text} />
          ))}
        </View>

        {/* Expectation note — moved off the reveal's peak. Sets the longer
            arc in coach voice: Stelar reads every day, and the confirmed
            patterns arrive from the second cycle on. A calm promise, no
            target. PLACEHOLDER COPY — voice-and-copy should review. */}
        <View style={styles.horizonNote}>
          <Text style={styles.horizonEyebrow}>Lo que viene</Text>
          <Text style={styles.horizonBody}>
            Cada día que registras, Stelar arma tu lectura. Los patrones se confirman a partir de tu
            segundo ciclo: ahí es donde de verdad empieza a verte.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleEnter}
          style={styles.cta}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Entrar a tu órbita"
        >
          <Text style={styles.ctaLabel}>Entrar a tu órbita →</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // OPAQUE so the incoming screen occludes the outgoing one during the
  // slide; the per-screen WizardBackdrop paints the sky on top of this.
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 24,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 10.5,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.magenta,
    marginBottom: 12,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: 34,
    letterSpacing: -1.4,
    lineHeight: 38,
    color: colors.leche,
  },
  titleEm: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 34,
    color: colors.magenta,
    letterSpacing: -1,
  },
  // The recovered progress constellation — centred + contained so the
  // component (width:100% of parent) reads as a portrait, not a full-bleed
  // canvas. Sits between the title and the coach line.
  constellation: {
    alignSelf: 'center',
    width: '64%',
    marginTop: 8,
    marginBottom: 18,
  },
  sub: {
    marginTop: 12,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 21,
    color: colors.bone,
  },
  recapCard: {
    marginTop: 26,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  recapEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.magenta,
  },
  recapList: {
    marginTop: 12,
    gap: 12,
  },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 16,
  },
  recapLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.8,
    color: colors.niebla,
    flexShrink: 0,
  },
  recapValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  recapValue: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 14.5,
    color: colors.leche,
    textAlign: 'right',
  },
  tasksList: {
    marginTop: 24,
    gap: 10,
  },
  // Expectation note — quiet horizon line below the tasks. Separated by a
  // hairline so it reads as an aside, not a 4th task. Coach voice (serif
  // italic), bone tone so it sits softer than the tasks.
  horizonNote: {
    marginTop: 22,
    borderTopWidth: 1,
    borderTopColor: colors.bruma,
    paddingTop: 16,
  },
  horizonEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 8,
  },
  horizonBody: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 14,
  },
  cta: {
    backgroundColor: colors.magenta,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0.5,
    color: colors.leche,
  },
})
