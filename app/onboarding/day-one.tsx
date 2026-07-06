import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DayOneTask, WizardBackdrop } from '@/features/onboarding/components'
import { type CycleSituation, type MonthlyFocus } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { ZodiacArt } from '@/features/tabs/components/constellation'
import { ZODIAC, ZodiacFigure, zodiacFromDate, type ZodiacSign } from '@/features/tabs/zodiac'
import { markVisitedDayOne } from '@/lib/onboardingFlags'
import { colors, shadows, typography } from '@/theme'

const TASKS: { num: number; text: string }[] = [
  {
    num: 1,
    text: 'Registra tu primera comida. Enciende tu primera estrella hoy.',
  },
]

/** Phrases the recap card uses when listing what Stelar already
 *  knows from the wizard. Phrased as the pact going forward ("bajar
 *  de peso, a tu ritmo"), never as a quoted testimony ("quieres
 *  bajar de peso") — quoting the user back reads as a case file. */
const FOCUS_RECAP: Record<MonthlyFocus, string> = {
  weight: 'bajar de peso, a tu ritmo',
  energy: 'más energía en tus días',
  sleep: 'dormir mejor',
  food: 'entender cómo comes',
  cycle: 'conocer tu ciclo',
  patterns: 'entender tus patrones',
  mind: 'calmar la mente',
  other: 'una intención tuya',
}

/** TU CICLO recap value — a real FACT per situation (not the old
 *  "leyéndose mes a mes" process phrase). Warm, factual, never clinical.
 *  The current wizard only writes menstruates / irregular / skip; the
 *  other three exist in the model for legacy/completeness. */
const CYCLE_RECAP: Record<CycleSituation, string> = {
  menstruates: 'regular',
  irregular: 'sin patrón fijo',
  contraception: 'con anticoncepción',
  pregnant: 'en embarazo',
  postmenopause: 'en otra etapa',
  skip: 'no lo seguimos',
}

/*
 * Día 1 — the bridge between the wizard and the real Home. After
 * the reveal's cosmic moment, this page stays in the same
 * dark+magenta register as the rest of onboarding.
 *
 * THE SKY, NOT THE METER (illustrator-specialist spec): the LIVE
 * progress constellation lives in the Hoy tab — repeating it here in
 * the same framed card read as redundant. So Día 1 shows ONLY the
 * sign's pictorial art floating free over a diffuse golden halo, with
 * NO card frame. That echoes the reveal's RESTING state (arte + aura,
 * sin contenedor) and visually distinguishes this screen from the tab.
 * The art + halo are fully static — no Reanimated, no stars, no count.
 *
 * COLOUR ECONOMY: the art introduced GOLD (oro). The surrounding chrome
 * follows it — eyebrows, the recap glyph, the task chip and every border
 * are gold, read as the sky's light spilling onto the page. MAGENTA is
 * kept to exactly two beats (the screen's voice): the "hoy empieza"
 * title emphasis and the CTA. That honours the "max 2 magenta/screen"
 * rule in colors.ts and lets the gold do the unifying.
 *
 * The base cosmic backdrop (starfield + Stelar presence) is mounted PER
 * SCREEN (its own <WizardBackdrop />, opaque colors.bg base) so the
 * slide transition fully occludes the screen behind it. The presence
 * breath is shared via WizardPresenceContext so it never restarts.
 *
 * The expectation note at the bottom (formerly the reveal's "QUÉ SIGUE"
 * block) was moved here off the peak: it sets the longer arc as a value
 * ladder in plain units (hoy una estrella, primera semana señales,
 * patrones en unas semanas). "Ciclo" is RESERVED for the menstrual cycle
 * everywhere in the app — the recap card above has a TU CICLO row, so
 * using it here for the 28-day constellation collided head-on. Coach
 * voice (serif italic): a calm promise, not a target to hit.
 *
 * The body composition track (4 photos + initial weight) lives in
 * Settings → Track corporal; not surfaced here so Día 1 stays
 * focused on signals, not measurements. The starting weight is NOT
 * re-shown here either: the user confirmed it two steps ago, and
 * framing it in gold next to her sign read as a dossier, not a start
 * line (target-user validation, jul 2026).
 */
export default function DayOneScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data: profile } = useProfile()

  const firstName = (profile?.display_name ?? '').trim().split(' ')[0] || 'tú'

  // Signo zodiacal — SAME derivation as the reveal (zodiacFromDate over
  // date_of_birth). We gate the whole sky render on it: if there's no
  // birth date we never invent a sign (the reveal doesn't either), and
  // Día 1 falls back to its prior layout (no art, no halo) without
  // breaking.
  const sign: ZodiacSign | null = useMemo(
    () => (profile?.date_of_birth ? zodiacFromDate(profile.date_of_birth) : null),
    [profile?.date_of_birth],
  )

  const skyA11yLabel = sign ? `Tu cielo de ${ZODIAC[sign].label}` : undefined

  // Primary CTA drops her INSIDE the first-meal flow (same /capture-meal
  // the Comidas tab opens), with Comidas underneath so closing the capture
  // lands her on her first logged entry. Every screen between "decidí
  // registrar" and "registré" loses users; the task chip above already
  // created the intent, the CTA must not disperse it.
  const handleLogFirstMeal = async () => {
    await markVisitedDayOne()
    router.replace('/(tabs)/meals')
    router.push('/capture-meal')
  }

  // Quiet escape for the user who opens the app before having eaten:
  // straight to Hoy, no guilt attached.
  const handleSeeSky = async () => {
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
    // TU CICLO — a real fact per situation (regular / sin patrón fijo / no
    // lo seguimos), shown ALWAYS when the situation is set. Not the old
    // "leyéndose mes a mes" process phrase.
    const cs = (profile?.cycle_situation as CycleSituation | null) ?? null
    if (cs) {
      out.push({ label: 'TU CICLO', value: CYCLE_RECAP[cs] })
    }
    const f = (profile?.monthly_focus as MonthlyFocus | null) ?? null
    if (f) {
      out.push({ label: 'TU FOCO', value: FOCUS_RECAP[f] })
    }
    return out
  }, [profile])

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

        {/* The sky — ONLY the sign's pictorial art floating free over a
            diffuse golden halo, no card frame. Echoes the reveal's resting
            state and stays distinct from the live constellation in the Hoy
            tab. Static art + halo, gated on an actual derived sign. */}
        {sign ? (
          <View
            style={styles.skyArt}
            accessible
            accessibilityRole="image"
            accessibilityLabel={skyA11yLabel}
          >
            <ZodiacArt sign={sign} size={164} />
          </View>
        ) : null}

        {/* Coach line (serif italic) — names the sky the art just made
            visible, framed as something that reveals itself over time. */}
        <Text style={styles.sub}>
          Este es tu cielo. Cada día que registras, se revela un poco más.
        </Text>

        {/* Recap — "Stelar ya sabe esto de vos". Validates the 11
            wizard inputs by naming them back as facts Stelar holds. The
            card carries a faint gold halo at its top edge so the sky's
            light feels like it spills down onto the recap. */}
        {recapLines.length > 0 ? (
          <View style={styles.recapCard}>
            {/* Gold halo bleeding down from the top — the observatory light
                falling onto the card. Behind the content, non-interactive. */}
            <LinearGradient
              colors={[colors.oroTint, 'transparent']}
              style={styles.recapGlow}
              pointerEvents="none"
            />
            <Text style={styles.recapEyebrow}>Stelar ya sabe esto de ti</Text>
            <View style={styles.recapList}>
              {recapLines.map((row, i) => (
                <View
                  key={row.label}
                  style={[styles.recapRow, i < recapLines.length - 1 && styles.recapRowDivider]}
                >
                  <Text style={styles.recapLabel}>{row.label}</Text>
                  <View style={styles.recapValueWrap}>
                    {'zodiac' in row ? (
                      <ZodiacFigure sign={row.zodiac} size={20} color={colors.oro} />
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

        {/* Movement as a soft, UN-numbered coach aside — not a second task.
            Kept off the numbered chip so it reads as permission, not duty:
            move if you moved, otherwise it waits for tomorrow. */}
        <Text style={styles.moveAside}>
          Y si hoy te moviste, aunque sea caminar, márcalo. Si no, mañana sigue ahí.
        </Text>

        {/* Expectation note — the value ladder in plain units (hoy /
            primera semana / unas semanas). Arrival of gifts, not deadlines.
            Never say "ciclo" here: the recap card above uses TU CICLO for
            the menstrual cycle and the word collided in testing. */}
        <View style={styles.horizonNote}>
          <Text style={styles.horizonEyebrow}>Lo que viene</Text>
          <Text style={styles.horizonBody}>
            Cada día que registras enciende una estrella y afina tu lectura. En una semana ya verás
            tus primeras señales. Tus patrones de verdad llegan en unas semanas, cuando Stelar ya te
            conoce.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleLogFirstMeal}
          style={styles.cta}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Registrar mi primera comida"
        >
          <Text style={styles.ctaLabel}>Registrar mi primera comida →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSeeSky}
          style={styles.ctaSecondary}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Primero quiero ver mi cielo"
        >
          <Text style={styles.ctaSecondaryLabel}>Primero quiero ver mi cielo</Text>
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
    color: colors.oro,
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
  // The sky — sign art floating free over its golden halo. 164×164 box
  // (down from 188 so the "Lo que viene" promise closes above the fold),
  // overflow:'visible' so the halo can bleed past the edges without
  // clipping into a hard ring. Sits between the title and the coach line.
  skyArt: {
    width: 164,
    height: 164,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.58,
  },
  sub: {
    marginTop: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 21,
    color: colors.bone,
  },
  // overflow:'hidden' so the gold glow gradient respects the 16 radius.
  recapCard: {
    marginTop: 30,
    backgroundColor: colors.bgCard2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    paddingHorizontal: 16,
    paddingVertical: 16,
    // NO overflow:'hidden' — it clipped the sign glyph in the first row.
    // The gold glow rounds its OWN top corners instead (see recapGlow).
  },
  // Gold halo over the top ~40% of the card — the sky's light spilling
  // down. Absolute, behind content (zIndex untouched = paint order). Its
  // top corners are rounded to match the card so it doesn't need the
  // card's overflow:'hidden' (which was clipping the glyph).
  recapGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  recapEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.oro,
  },
  recapList: {
    marginTop: 12,
  },
  // Rows read as an "astral chart" register: a faint gold hairline divides
  // each entry (skipped on the last). paddingBottom gives the rule air.
  recapRow: {
    // 'center' (not 'baseline'): the sign row carries an SVG glyph, which
    // has no text baseline — under 'baseline' it was pushed up out of the
    // row and clipped by the card's overflow:'hidden'. Centering keeps the
    // glyph in bounds and reads clean against the label/value.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 12,
  },
  recapRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.oroHairlineSoft,
    marginBottom: 12,
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
  // Movement aside — coach voice (serif italic, bone) so it sits softer
  // than the numbered task above and reads as an invitation, not a duty.
  moveAside: {
    marginTop: 16,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
  },
  // Expectation note — quiet horizon line below the tasks. Separated by a
  // gold hairline so it reads as an aside, not a 4th task. Coach voice
  // (serif italic), bone tone so it sits softer than the tasks.
  horizonNote: {
    marginTop: 22,
    borderTopWidth: 1,
    borderTopColor: 'rgba(217, 174, 111, 0.14)',
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
  // Magenta CTA with the brand glow (shadows.ctaMagenta) — NOT a gradient.
  // This is one of the screen's two permitted magenta beats.
  cta: {
    backgroundColor: colors.magenta,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.ctaMagenta,
  },
  ctaLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0.5,
    color: colors.leche,
  },
  // Quiet escape under the CTA — a text link, deliberately not a second
  // button, so the meal CTA keeps all the visual weight.
  ctaSecondary: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 4,
  },
  ctaSecondaryLabel: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
})
