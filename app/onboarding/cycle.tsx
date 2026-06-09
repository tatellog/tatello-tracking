import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Ellipse, G, RadialGradient, Stop } from 'react-native-svg'

import {
  AtmosphericSky,
  DateField,
  DustMote,
  StepHeader,
  WarmBloomField,
  WizardLayout,
} from '@/features/onboarding/components'
import { type CycleSituation } from '@/features/profile/api'
import { useProfile, useRecordLastPeriodStart, useUpdateProfile } from '@/features/profile/hooks'
import { useLastPeriodStart } from '@/features/progress/hooks'
import { colors, typography } from '@/theme'

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)

type CycleOption = {
  value: CycleSituation
  label: string
  description: string
  /** When true, hide the period input — that question doesn't apply to
   *  this situation. */
  hidesCycleInputs: boolean
}

// MENSTRUAL-FLOW-ONLY REDUCTION (owner decision, 2026-05): the screen used
// to surface FIVE situations — including reproductive-state questions
// (contraception / pregnant / postmenopause) that felt invasive to ask up
// front. We now offer ONLY THREE menstrual-flow answers as cards + the
// "Prefiero no decir" opt-out below. The OTHER enum values
// (contraception / pregnant / postmenopause) STILL EXIST in
// CYCLE_SITUATION_VALUES / the DB — existing rows use them — the UI just
// stops OFFERING them. No migration: this UI writes a SUBSET of the enum.
const SITUATION_OPTIONS: readonly CycleOption[] = [
  {
    value: 'menstruates',
    label: 'Mi ciclo es regular',
    description: 'Llega cada mes',
    hidesCycleInputs: false,
  },
  {
    value: 'irregular',
    label: 'Es irregular',
    description: 'No siempre llega igual',
    hidesCycleInputs: false,
  },
  {
    // "No tengo ciclo" — the engine treats it like the old `skip`: no
    // cycle dimension, no optional date. We deliberately do NOT assert a
    // REASON (menopause / pregnancy / etc.) — that would re-introduce the
    // reproductive-state question the owner asked us to drop. Neutral copy.
    value: 'skip',
    label: 'No tengo ciclo',
    description: 'Stelar funciona igual',
    hidesCycleInputs: true,
  },
]

// La duración del ciclo NO se pregunta en onboarding: casi nadie la sabe de
// memoria y la feature que la usa (derivación de fase) vive en el cycle
// sprint. Se persiste default 28 (DEFAULT_CYCLE_LENGTH) y el motor DERIVARÁ
// la duración real del gap entre period_start registrados (cycle_events).
// Patrones en datos propios, no un número adivinado en frío. Por eso esta
// pantalla NO renderiza un Stepper de duración — solo se escribe el default
// silencioso para las situaciones cycle-active (regular / irregular).
const DEFAULT_CYCLE_LENGTH = 28
const PERIOD_WINDOW_DAYS = 60

// "Prefiero no decir" opt-out — a LOCAL selection sentinel, NOT an enum
// value (so it stays visually distinct from the "No tengo ciclo" card even
// though both persist the same thing). On continue it behaves exactly like
// before: it writes `cycle_situation: 'skip'` and lets the user advance,
// without surfacing the optional date. Kept separate from the 'skip' card
// purely so the radiogroup selection reads as two different choices.
const OPT_OUT = 'opt-out' as const
type Selection = CycleSituation | typeof OPT_OUT

/*
 * Step 7 — Tu ciclo. Asks for the user's MENSTRUAL-FLOW situation first;
 * only surfaces the OPTIONAL last-period date when the situation implies an
 * active cycle (menstruates, irregular).
 *
 * INPUTS (owner, 2026-05): for the active-cycle situations the screen asks
 * ONE required thing (situation) plus, in the revealed cycle-active block,
 * the OPTIONAL last-period date. The cycle LENGTH is deliberately NOT asked
 * here — it's persisted as a silent default (28) and the engine derives the
 * real value from the gap between registered period_start dates in the cycle
 * sprint (see DEFAULT_CYCLE_LENGTH). Skip / opt-out ask nothing beyond the
 * situation.
 *
 * MENSTRUAL-FLOW-ONLY (owner decision): the screen no longer asks about
 * reproductive state (contraception / pregnancy / menopause). It offers
 * exactly THREE menstrual-flow cards + the "Prefiero no decir" opt-out. See
 * SITUATION_OPTIONS for the enum-subset note.
 *
 * Visual: a leaner local CycleCard with light borders + tight padding;
 * "Prefiero no decir" lives as a quiet text-link below the cards (opt-out,
 * not a 4th equal option); a hairline divider separates the cards from the
 * cycle-active input.
 *
 * INPUT ELEVATION (illustrator + uxui):
 *   • The conditional DateField "ignites": a faint idle hairline that lights
 *     up to magenta + a magentaHot halo when filled / picking. Placeholder
 *     warmed to bone, "Toca para elegir", 44 pt tap target,
 *     accessibilityValue exposes the chosen date to VoiceOver.
 *   • The field's label carries an explicit "· opcional". COPY pending
 *     behavioral / voice-and-copy sign-off.
 *   • PRECISION-DIM: opening the date picker dims ONLY the atmosphere
 *     (atmoDim → 0.4) on the same 200 ms curve as about-you.
 *   • SCROLL-INTO-VIEW: scrollToEnd when the inline spinner mounts.
 *
 * ELEVATION PASS (illustrator):
 *   • CycleCard "ignites" with a 200 ms OPACITY crossfade. The idle card
 *     ALWAYS keeps its solid bgCard + hairline border (legibility); a
 *     magenta fill (0.10), a magenta border and a magenta halo fade IN on a
 *     per-card `glow` shared value.
 *   • The conditional cycle input REVEALS with a fade+rise on a
 *     screen-level `reveal` shared value.
 *   • CycleSky gains a low COOL WISP so the cold lower half has ambient
 *     depth without a focal star to celebrate.
 *
 * ATMOSPHERE PARITY (illustrator): shared atmosphere primitives
 * (AtmosphericSky + WarmBloomField + a local CycleSky), DELIBERATELY COLDER
 * and CALMER than steps 1–6 (no NebulaWash PNG; the sensitive theme calls
 * for a calm, contained cool sky). Three clocks (5 s / 18 s / 40 s) created
 * ONCE here, shared by every layer (one compás, same periods as steps 1–6).
 */
export default function CycleScreen() {
  const router = useRouter()
  // Reachable from Progreso → Tu ciclo (?source=settings) to anchor the
  // last period after onboarding. From there it's an edit: hide the wizard
  // chrome, label the CTA "Guardar", and return to Progreso on save.
  const { source } = useLocalSearchParams<{ source?: string }>()
  const fromSettings = source === 'settings'
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const recordPeriod = useRecordLastPeriodStart()

  const [situation, setSituation] = useState<Selection | null>(
    (profile?.cycle_situation as CycleSituation | null) ?? null,
  )
  const [lastPeriod, setLastPeriod] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingError, setSavingError] = useState<string | null>(null)

  // Prefill the date field with the period already on file (editing from
  // Progreso → Tu ciclo), so it shows the current anchor instead of an
  // empty picker. Seeds once; never clobbers a date the user is editing.
  const { data: existingPeriod } = useLastPeriodStart()
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current || !existingPeriod) return
    const parsed = parseISODateLocal(existingPeriod)
    if (parsed) {
      setLastPeriod(parsed)
      seededRef.current = true
    }
  }, [existingPeriod])

  // Precision-dim — the date picker open flag. While the inline spinner
  // is open the atmosphere dims (atmoDim → 0.4) and we scroll it into view.
  const [pickerOpen, setPickerOpen] = useState(false)

  // ScrollView ref so we can pull the inline spinner into view when it
  // mounts (on small devices the ~200 px spinner can push the CTA below
  // the fold).
  const scrollRef = useRef<ScrollView>(null)

  // Shared clocks for the whole step — created ONCE here so every
  // atmosphere layer (WarmBloomField, star strata + dust) breathes on
  // the SAME values (no duplicated shared values, same periods as
  // steps 1–6 → same compás):
  //   clock  5 s  warm-field breath
  //   dust  18 s  cosmic-dust drift + cool-wisp breath
  //   orbit 40 s  star-strata parallax
  const clock = useSharedValue(0)
  const dust = useSharedValue(0)
  const orbit = useSharedValue(0)

  // Precision-mode atmosphere dimmer — withTiming target driven by the
  // pickerOpen flag. 1 = full sky, 0.4 = calm (while picking a date).
  // Same compás (200 ms / ease-out-quad) as about-you / body-base.
  const atmoDim = useSharedValue(1)

  useEffect(() => {
    clock.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false)
    dust.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.linear }), -1, false)
    orbit.value = withRepeat(withTiming(1, { duration: 40000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(clock)
      cancelAnimation(dust)
      cancelAnimation(orbit)
    }
  }, [clock, dust, orbit])

  useEffect(() => {
    atmoDim.value = withTiming(pickerOpen ? 0.4 : 1, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    })
    // Defensive cleanup — withTiming is one-shot, but cancel on unmount
    // so a teardown mid-tween never leaves a dangling animation.
    return () => cancelAnimation(atmoDim)
  }, [pickerOpen, atmoDim])

  const atmoDimStyle = useAnimatedStyle(() => ({ opacity: atmoDim.value }))

  // The optional last-period date is offered ONLY for the active-cycle
  // answers. With reproductive-state cards gone, that's just the two flow
  // cards whose hidesCycleInputs is false (menstruates + irregular). "No
  // tengo ciclo" ('skip') and the "Prefiero no decir" opt-out never show it.
  const situationMeta = SITUATION_OPTIONS.find((o) => o.value === situation) ?? null
  const askCycleInputs = situationMeta !== null && !situationMeta.hidesCycleInputs

  // Conditional-input reveal — a fade+rise on a screen-level shared value
  // (NOT a layout animation: those are fragile inside a ScrollView). Goes
  // to 1 when the cycle input should show, back to 0 when it hides. The
  // Animated.View container below tweens opacity + a 16→0 px translateY.
  const reveal = useSharedValue(0)
  useEffect(() => {
    reveal.value = withTiming(askCycleInputs ? 1 : 0, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    })
    return () => cancelAnimation(reveal)
  }, [askCycleInputs, reveal])
  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 16 }],
  }))

  // When the situation changes away from an active cycle, the input hides;
  // make sure the picker-open flag (and its dim) clears too.
  useEffect(() => {
    if (!askCycleInputs && pickerOpen) setPickerOpen(false)
  }, [askCycleInputs, pickerOpen])

  // Picker open/close — dim the atmosphere + pull the inline spinner into
  // view so it never hides the CTA on small devices.
  const handlePickerToggle = (open: boolean) => {
    setPickerOpen(open)
    if (open) {
      // Defer to the next frame so the spinner has mounted before we
      // measure / scroll to the end of the content.
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
    }
  }

  // Period picker bounds — last 60 days. A first period that long
  // ago would already mean an irregular cycle.
  const { defaultDate, minDate, maxDate } = useMemo(() => {
    const today = new Date()
    const min = new Date(today)
    min.setDate(today.getDate() - PERIOD_WINDOW_DAYS)
    const def = new Date(today)
    def.setDate(today.getDate() - 14)
    return { defaultDate: def, minDate: min, maxDate: today }
  }, [])

  // Solo la situación de ciclo bloquea Continuar. La fecha de última
  // menstruación es OPCIONAL (opt-in): se guarda si la usuaria la da, pero
  // nunca es requisito — puede decirla más adelante.
  const canContinue = situation !== null

  const handlePick = (next: Selection) => {
    Haptics.selectionAsync().catch(() => {})
    setSituation(next)
  }

  const handleContinue = async () => {
    if (!canContinue || !situation) return
    setSavingError(null)
    setSaving(true)
    try {
      // The "Prefiero no decir" opt-out persists the same thing the card
      // "No tengo ciclo" does ('skip') — it advances without a cycle
      // dimension and without an optional date. Only the LOCAL selection
      // sentinel differs (so the two read as distinct choices in the UI).
      const cycleSituation: CycleSituation = situation === OPT_OUT ? 'skip' : situation
      await updateProfile.mutateAsync({
        cycle_situation: cycleSituation,
        // Cycle length is NOT asked in onboarding (owner, 2026-05): persist a
        // SILENT default (28) for any active-cycle situation (regular +
        // irregular) so the engine has a value to work with until the cycle
        // sprint DERIVES the real duration from registered period_start gaps.
        // Skip / opt-out write nothing here (no cycle dimension).
        ...(askCycleInputs ? { cycle_length_days: DEFAULT_CYCLE_LENGTH } : {}),
      })
      // The date is OPTIONAL: only record a period when the user actually
      // gave one. If she left it empty we advance without inserting it.
      if (askCycleInputs && lastPeriod) {
        await recordPeriod.mutateAsync(toISODate(lastPeriod))
      }
      if (fromSettings) router.back()
      else router.push('/onboarding/rhythm')
    } catch (e) {
      setSavingError(e instanceof Error ? e.message : 'No pudimos guardar tu ciclo.')
    } finally {
      setSaving(false)
    }
  }

  const skipSelected = situation === OPT_OUT

  return (
    <WizardLayout
      step={8}
      totalSteps={9}
      canContinue={canContinue}
      loading={saving}
      errorMessage={savingError}
      onContinue={handleContinue}
      continueLabel={fromSettings ? 'Guardar' : 'Continuar'}
      showProgress={!fromSettings}
      ctaVariant="soft"
      ctaTransform="none"
      atmosphere={
        // Precision-mode wrapper — the ONE Animated.View whose opacity
        // dims the WHOLE sky (never the content) while the date picker is
        // open. a11y-hidden + pointerEvents none so VoiceOver never reads
        // it between the cards and the inputs.
        <Animated.View
          style={[StyleSheet.absoluteFill, atmoDimStyle]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {/* 1. Shared cool glow — pulled up-mid so the cold recedes
              (aerial perspective); the warm lives lower. NO NebulaWash
              PNG here: the sensitive theme calls for a calm, contained
              cool sky, not a painterly warm stage. */}
          <AtmosphericSky glow={{ cx: '58%', cy: '38%', r: '66%' }} />
          {/* 2. Deep warm atmosphere — REUSED 'exposed-low-right' (step 6
              uses 'exposed'; reuse here avoids chaining two identical
              skies and protects steps 4/5/6 — no new variant authored). */}
          <WarmBloomField clock={clock} variant="exposed-low-right" />
          {/* 3. Painted depth — COLD star strata + dimmed dust + a low cool
              wisp, full-screen, whisper-low, hidden from VoiceOver. Cooler
              + quieter than step 3 (silver-blue micro-stars, thinned). */}
          <CycleSky dust={dust} orbit={orbit} />
        </Animated.View>
      }
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepHeader
          eyebrow="Tu ciclo"
          eyebrowColor="magenta"
          question="¿Cómo trabaja tu cuerpo?"
          questionEmphasis="trabaja"
          hint="Stelar lee tu ciclo cuando lo hay."
        />

        {/* Single-select group — the three cards + the opt-out form ONE
            logical radiogroup so VoiceOver announces the mutual exclusion
            (picking a card clears the opt-out and vice-versa). */}
        <View
          style={styles.optionsBlock}
          accessibilityRole="radiogroup"
          accessibilityLabel="¿Cómo trabaja tu cuerpo?"
        >
          {SITUATION_OPTIONS.map((opt) => (
            <CycleCard
              key={opt.value}
              option={opt}
              selected={situation === opt.value}
              onPress={() => handlePick(opt.value)}
            />
          ))}

          {/* Prefiero no decir — opt-out as a quiet text-link below the
              real options. It is a radio inside the group above so it
              deselects (and is deselected by) the cards. */}
          <Pressable
            onPress={() => handlePick(OPT_OUT)}
            style={styles.skipRow}
            accessibilityRole="radio"
            accessibilityLabel="Prefiero no decir"
            accessibilityState={{ selected: skipSelected }}
          >
            <SkipDot selected={skipSelected} />
            <Text style={[styles.skipLabel, skipSelected && styles.skipLabelOn]}>
              Prefiero no decir
            </Text>
          </Pressable>
        </View>

        {askCycleInputs ? (
          <Animated.View style={revealStyle}>
            <View style={styles.divider} />
            <View style={styles.cycleBlock}>
              {/* La duración del ciclo NO se pregunta aquí (owner, 2026-05):
                  casi nadie la sabe de memoria y la derivación de fase vive
                  en el cycle sprint. Solo se persiste el default 28 y el
                  motor DERIVARÁ la duración real del gap entre period_start
                  registrados (cycle_events). Por eso este bloque solo expone
                  la fecha de última menstruación (opcional), que es la que
                  siembra esos cycle_events. */}
              <View style={styles.field}>
                <DateField
                  // Sentence-case label with an explicit "· opcional" so the
                  // field never reads as a requirement — the date is opt-in.
                  // COPY pending behavioral / voice-and-copy sign-off.
                  label="Tu última menstruación · opcional"
                  accessibilityLabel="Elegir tu última menstruación (opcional)"
                  value={lastPeriod}
                  onChange={setLastPeriod}
                  defaultDate={defaultDate}
                  minDate={minDate}
                  maxDate={maxDate}
                  placeholder="Toca para elegir"
                  onPickerToggle={handlePickerToggle}
                />
                <Text style={styles.caveat}>
                  Si no recuerdas la fecha exacta, una aproximación está bien. También puedes
                  decírmelo más adelante.
                </Text>
              </View>
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>
    </WizardLayout>
  )
}

/* ─────────────────────── Card ─────────────────────── */

/** A leaner card than the shared SelectableCard. The idle treatment is
 *  ALWAYS the solid bgCard + warm hairline (legibility over the cosmic
 *  backdrop); selection is layered on top as a 200 ms OPACITY crossfade
 *  rather than a binary style swap — parity with body-base's SexPill
 *  glow + about-you's hairline ignition. Three absoluteFill layers fade
 *  IN on a per-card `glow` shared value:
 *    (a) shadow layer — static magenta iOS shadow, opacity-crossfaded;
 *    (b) magenta fill 0.10;
 *    (c) magenta 1 px border.
 *  All three share the EXACT borderRadius (12) of the idle card so no
 *  corner peeks out as they fade. The scale spring is unchanged.
 *
 *  (The earlier `subdued` flag — which suppressed the festive magenta halo
 *  for the pregnant / postmenopause answers — was removed along with those
 *  cards. None of the three remaining flow answers is a sensitive
 *  reproductive-state reply, so every card ignites with the full halo.) */
function CycleCard({
  option,
  selected,
  onPress,
}: {
  option: CycleOption
  selected: boolean
  onPress: () => void
}) {
  // Scale spring (unchanged) — the existing tactile bounce on selection.
  const scale = useSharedValue(1)
  useEffect(() => {
    scale.value = withSpring(selected ? 1.015 : 1, { damping: 18, stiffness: 220 })
    return () => cancelAnimation(scale)
  }, [selected, scale])
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  // Glow crossfade — the selected card's magenta treatment fades IN/OUT on
  // OPACITY (200 ms / ease-out-quad, the twin compás of body-base's pill
  // glow). We never animate shadowRadius/shadowOpacity or border/fill colors
  // numerically; instead dedicated layers carry the static look and only
  // their opacity tweens.
  const glow = useSharedValue(selected ? 1 : 0)
  useEffect(() => {
    glow.value = withTiming(selected ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad) })
    return () => cancelAnimation(glow)
  }, [selected, glow])
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }))

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityLabel={option.label}
        accessibilityState={{ selected }}
        android_ripple={{ color: 'rgba(217, 39, 102, 0.14)', borderless: false }}
        style={({ pressed }) => [pressed && styles.cardPressed]}
      >
        {/* Idle card — ALWAYS solid bgCard + warm hairline so the label
            stays legible over the cosmic backdrop regardless of selection. */}
        <View style={styles.card}>
          {/* (a) Shadow layer — static magenta iOS shadow, crossfaded by
              opacity. Behind the content so the halo blooms under the card. */}
          <Animated.View style={[styles.cardGlowShadow, glowStyle]} pointerEvents="none" />
          {/* (b) Magenta fill — 0.10 tint, crossfaded in. */}
          <Animated.View style={[styles.cardGlowFill, glowStyle]} pointerEvents="none" />
          {/* (c) Magenta border — 1 px, crossfaded in over the hairline. */}
          <Animated.View style={[styles.cardGlowBorder, glowStyle]} pointerEvents="none" />

          <Text style={[styles.cardLabel, selected && styles.cardLabelOn]}>{option.label}</Text>
          <Text style={[styles.cardDescription, selected && styles.cardDescriptionOn]}>
            {option.description}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  )
}

/* ─────────────────────── Opt-out dot ─────────────────────── */

/** The opt-out radio dot. Cheap crossfade of opacity between the idle and
 *  selected dot so it shares the screen's ignition vocabulary (the dot grows
 *  + glows when selected; the magenta state simply fades in over the idle). */
function SkipDot({ selected }: { selected: boolean }) {
  const glow = useSharedValue(selected ? 1 : 0)
  useEffect(() => {
    glow.value = withTiming(selected ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad) })
    return () => cancelAnimation(glow)
  }, [selected, glow])
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }))

  return (
    <View style={styles.skipDotWrap}>
      <View style={styles.skipDot} />
      <Animated.View style={[styles.skipDotOn, glowStyle]} pointerEvents="none" />
    </View>
  )
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a 'YYYY-MM-DD' event_date as a LOCAL date (not UTC) so the
 *  prefilled picker lands on the same calendar day the user saved,
 *  never one off due to timezone. */
function parseISODateLocal(v: string | null | undefined): Date | null {
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  if (!m) return null
  const [, y, mo, d] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? null : date
}

/* ───────────────────── Full-screen star sky ────────────────────── */

// Star strata — a COLD, THINNED clone of step 3's AttributionSky. x/y are
// 0→1 fractions of the screen; parallax amplitude grows toward the viewer
// (far 2px / mid 5px / micro 9px). Concentrated in the LOWER half so the
// depth pools under the cards, never behind their text. The band is held
// to y≥0.58 (same as step 3) so xMidYMid slice on a tall viewport keeps
// stars clear of the card stack / skip text.
//
// DIFFERENCES vs step 3 (calm + cool register): each array drops 1–2
// motes (more quietude), and the micro-stars are silver-blue (cycle
// accent) instead of warm pink.
const FAR_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.1, y: 0.58, r: 0.6, opacity: 0.1 },
  { x: 0.92, y: 0.6, r: 0.7, opacity: 0.12 },
  { x: 0.74, y: 0.74, r: 0.6, opacity: 0.1 },
  { x: 0.5, y: 0.87, r: 0.5, opacity: 0.08 },
]

const MID_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.16, y: 0.62, r: 0.8, opacity: 0.24 },
  { x: 0.9, y: 0.76, r: 0.9, opacity: 0.26 },
  { x: 0.12, y: 0.78, r: 0.8, opacity: 0.24 },
  { x: 0.62, y: 0.66, r: 0.7, opacity: 0.2 },
]

// Micro-stars — nearest field, COOL (dimension.ciclo) silver-blue, halo +
// parallax. Thinned from step 3's 8 → 6 motes for more quietness.
const MICRO_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.24, y: 0.68, r: 1.1, opacity: 0.42 },
  { x: 0.8, y: 0.7, r: 1.0, opacity: 0.38 },
  { x: 0.5, y: 0.76, r: 0.9, opacity: 0.34 },
  { x: 0.14, y: 0.89, r: 1.0, opacity: 0.36 },
  { x: 0.88, y: 0.8, r: 0.85, opacity: 0.3 },
  { x: 0.58, y: 0.9, r: 0.8, opacity: 0.28 },
]

// DUST — thinned from step 3's 6 → 4 motes, opacities dimmed ~0.04, rising
// through the lower half. They whisper behind the cards without competing.
const DUST: {
  x: number
  baseR: number
  period: number
  sway: number
  opacity: number
  phase: number
}[] = [
  { x: 0.22, baseR: 0.9, period: 1.05, sway: 9, opacity: 0.36, phase: 0.1 },
  { x: 0.52, baseR: 1.0, period: 0.95, sway: 11, opacity: 0.42, phase: 0.5 },
  { x: 0.78, baseR: 0.7, period: 1.15, sway: 8, opacity: 0.32, phase: 0.3 },
  { x: 0.66, baseR: 0.75, period: 1.1, sway: 10, opacity: 0.28, phase: 0.2 },
]

/*
 * CycleSky — full-screen painted depth for step 7. A reduced, COLD clone
 * of AttributionSky: three star strata + rising dust + a low cool wisp,
 * behind the content. The stars sit in the LOWER half (the cards own the
 * top, so the sky stays a whisper there). Differential parallax (2/5/9px)
 * on the 40 s orbit clock, dust + wisp on the 18 s clock. All whisper-low
 * alphas, pointerEvents none, hidden from VoiceOver (the reading order is
 * the cards, never the decorative sky).
 *
 * COOL WISP — ported from body-base: a wide-and-low cool ellipse (ciclo
 * #B5C4DD) at cy ~0.66 that breathes 0.04↔0.06 on the dust clock. It
 * enriches the cold lower half with ambient depth, NO free-floating focal
 * star to celebrate any one answer (sensitive theme → containment).
 *
 * Parallax/twinkle move ONLY a numeric translate(px px) + opacity — never
 * an animated r/length as a string % (re-resolves against the viewport
 * every frame → jank). Gradient ids are namespaced `ciclo-*` so they
 * cannot collide with step 3's `atrib-*` / step 5's `cuerpo-*` defs.
 */
function CycleSky({ dust, orbit }: { dust: SharedValue<number>; orbit: SharedValue<number> }) {
  const SKY_W = 360
  const SKY_H = 760

  const farDriftProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    return { transform: [{ translateX: Math.sin(u) * 2 }, { translateY: Math.cos(u) * 2 }] }
  })
  const midDriftProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    return { transform: [{ translateX: Math.sin(u) * 5 }, { translateY: Math.cos(u) * 5 }] }
  })
  const microGroupProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    const flicker = 0.85 + 0.15 * Math.sin(orbit.value * 2 * Math.PI * 3)
    return {
      transform: [{ translateX: Math.sin(u) * 9 }, { translateY: Math.cos(u) * 9 }],
      opacity: flicker,
    }
  })

  // ── Cool wisp breath ─────────────────────────────────────────────
  // A wide, low ellipse of cool ciclo light at cy 0.66 (media-baja). It
  // breathes between 0.04 and 0.06 on the 18 s dust clock — opacity only
  // (numeric, UI-thread safe). Carries the cold lower half as ambient
  // depth (ported from body-base; reuses the shared dust clock, no new
  // shared value).
  const coolWispProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(dust.value * 2 * Math.PI)
    return { opacity: 0.04 + w * 0.02 }
  })

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SKY_W} ${SKY_H}`}
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          {/* Tight white falloff so micro-stars glow rather than read as
              flat drawn dots. Namespaced to avoid colliding with step 3. */}
          <RadialGradient id="ciclo-starGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          {/* Cool wisp — silver-blue ciclo, faint, falls off to nothing. */}
          <RadialGradient id="ciclo-coolWisp" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.dimension.ciclo} stopOpacity="0.06" />
            <Stop offset="1" stopColor={colors.dimension.ciclo} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Cool wisp — wide-and-low ellipse at cy 0.66. Breathes faintly on
            the dust clock; depth without a free-floating focal point. */}
        <AnimatedEllipse
          cx={0.5 * SKY_W}
          cy={0.66 * SKY_H}
          rx={0.55 * SKY_W}
          ry={0.06 * SKY_H}
          fill="url(#ciclo-coolWisp)"
          animatedProps={coolWispProps}
        />

        {/* Cosmic dust rising through the lower half — silver-blue, dimmed. */}
        {DUST.map((d, i) => (
          <DustMote
            key={`sky-dust-${i}`}
            {...d}
            clock={dust}
            stage={SKY_H}
            fill={colors.dimension.ciclo}
          />
        ))}

        {/* Far COOL stars — distant silver-blue stratum, 2px parallax. */}
        <AnimatedG animatedProps={farDriftProps}>
          {FAR_STARS.map((s, i) => (
            <G key={`far-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.4}
                fill="url(#ciclo-starGlow)"
                opacity={s.opacity * 0.6}
              />
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r}
                fill={colors.dimension.ciclo}
                opacity={s.opacity}
              />
            </G>
          ))}
        </AnimatedG>

        {/* Mid stars — middle depth, intermediate tint, 5px drift. */}
        <AnimatedG animatedProps={midDriftProps}>
          {MID_STARS.map((s, i) => (
            <Circle
              key={`mid-${i}`}
              cx={s.x * SKY_W}
              cy={s.y * SKY_H}
              r={s.r}
              fill="#E8D9DD"
              opacity={s.opacity}
            />
          ))}
        </AnimatedG>

        {/* Micro stars — nearest field, COOL silver-blue (cycle accent),
            halo + 9px parallax + group twinkle. Halo first so the point
            sits on a glow. */}
        <AnimatedG animatedProps={microGroupProps}>
          {MICRO_STARS.map((s, i) => (
            <G key={`micro-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.5}
                fill="url(#ciclo-starGlow)"
                opacity={0.15}
              />
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r}
                fill={colors.dimension.ciclo}
                opacity={s.opacity}
              />
            </G>
          ))}
        </AnimatedG>
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  // Padding horizontal so the selected card's magenta shadow
  // (radius 14) doesn't get clipped by the ScrollView's implicit
  // overflow:hidden. Same fix pattern as the sex pills in body-base.
  optionsBlock: {
    marginTop: 18,
    gap: 8,
    paddingHorizontal: 14,
  },
  /* CycleCard — much lighter than the shared SelectableCard. */
  cardPressed: {
    opacity: 0.85,
  },
  // Idle card — ALWAYS solid bg + warm hairline (legibility over the cosmic
  // backdrop). Selection is layered on top via the glow layers below, so
  // this stays the single constant base regardless of state. The glow
  // layers MUST match this borderRadius exactly (12) so no corner peeks.
  card: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: colors.bgCard,
    borderColor: colors.hairline,
  },
  // (a) Shadow layer — static magenta iOS shadow, opacity-crossfaded by the
  // per-card glow value. backgroundColor stays transparent (Android View
  // shadows don't blur → harmless transparent rect; iOS is the validation
  // platform). borderRadius matches `card` so the halo blooms from the same
  // rounded silhouette.
  cardGlowShadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: 'transparent',
    shadowColor: colors.magenta,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  // (b) Magenta fill — 0.10 tint, crossfaded in over the idle bg.
  cardGlowFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: 'rgba(217, 39, 102, 0.10)',
  },
  // (c) Magenta border — 1 px, crossfaded in over the warm hairline.
  cardGlowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.magenta,
  },
  cardLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    letterSpacing: -0.1,
  },
  cardLabelOn: {
    color: colors.leche,
  },
  cardDescription: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 17,
    color: colors.niebla,
    letterSpacing: 0.1,
  },
  cardDescriptionOn: {
    color: colors.bone,
  },
  /* Opt-out as a tertiary text-link, not a 4th equal-weight option.
     marginTop 14 (vs the 8 between cards) so it reads as a meta-option
     set apart from the card stack — without a full divider. */
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 14,
    gap: 10,
  },
  // The dot is a crossfade stack: an idle dot with the selected dot fading
  // in on top. The wrap is sized to the larger (selected) dot so layout
  // never shifts as the opacity crossfades.
  skipDotWrap: {
    width: 7,
    height: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  skipDotOn: {
    ...StyleSheet.absoluteFillObject,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  skipLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 13.5,
    color: colors.niebla,
    letterSpacing: 0.3,
  },
  skipLabelOn: {
    color: colors.leche,
  },
  /* Hairline divider between cards and the cycle-active input. marginTop 20:
     the reveal animation supplies its own separation. */
  divider: {
    height: 1,
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  // The conditional input block — only the optional last-period DateField
  // now (the cycle-length Stepper was removed per owner, 2026-05: duration is
  // derived from period_start gaps in the cycle sprint, not asked here).
  // paddingBottom keeps the CTA clear on small devices (scrollToEnd handles
  // the picker spinner).
  cycleBlock: {
    marginTop: 22,
    paddingBottom: 24,
  },
  field: {
    gap: 10,
  },
  caveat: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    lineHeight: 17,
    // bone (not niebla) — sensitive data reads neutral + still, NO glow.
    // Homogeneity with body-base / about-you's quiet labels. textAlign
    // stays left (the caveats accompany left-aligned fields).
    color: colors.bone,
  },
})
