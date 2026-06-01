import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useBriefContext } from '@/features/brief/hooks'
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
    text: 'Registra tu primera comida del día. La señal más rápida que Stelar lee.',
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
  // date_of_birth). We gate the whole sky render on it: if there's no
  // birth date we never invent a sign (the reveal doesn't either), and
  // Día 1 falls back to its prior layout (no art, no halo) without
  // breaking.
  const sign: ZodiacSign | null = useMemo(
    () => (profile?.date_of_birth ? zodiacFromDate(profile.date_of_birth) : null),
    [profile?.date_of_birth],
  )

  const skyA11yLabel = sign ? `Tu cielo de ${ZODIAC[sign].label}` : undefined

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
    // TU CICLO — a real fact per situation (regular / sin patrón fijo / no
    // lo seguimos), shown ALWAYS when the situation is set. Not the old
    // "leyéndose mes a mes" process phrase.
    const cs = (profile?.cycle_situation as CycleSituation | null) ?? null
    if (cs) {
      out.push({ label: 'TU CICLO', value: CYCLE_RECAP[cs] })
    }
    // TU BASE — the starting weight, shown as an honest fact. Día 1 is the
    // close of onboarding (where weight legitimately lives) and the number
    // IS the credible starting point for a weight-loss goal: it helps, it
    // doesn't shame — "esto es lo que soy y cómo empiezo". The manifiesto
    // lines that still hold are the ones about DOMINANCE: weight never shows
    // in Home, in notifications, or as a comparative goal ("47% de tu meta").
    // A one-time baseline at the close is honest, not preciousness.
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
            <ZodiacArt sign={sign} size={188} />
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
          accessibilityLabel="Entrar a tu constelación"
        >
          <Text style={styles.ctaLabel}>Entrar a tu constelación →</Text>
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
  // The sky — sign art floating free over its golden halo. 188×188 box,
  // overflow:'visible' so the ~240×240 halo can bleed past the edges
  // without clipping into a hard ring. Sits between the title and the
  // coach line.
  skyArt: {
    width: 188,
    height: 188,
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
})
