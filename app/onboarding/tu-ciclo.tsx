import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
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
  Stepper,
  WarmBloomField,
  WizardLayout,
} from '@/features/onboarding/components'
import { type CycleSituation } from '@/features/profile/api'
import { useProfile, useRecordLastPeriodStart, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)

type CycleOption = {
  value: CycleSituation
  label: string
  description: string
  /** When true, hide the period + length inputs — those questions
   *  don't apply to this situation. */
  hidesCycleInputs: boolean
}

// Five real situations rendered as cards. "skip" lives as a tertiary
// text-link below so the screen doesn't read as 6 equal options when
// one is an opt-out.
const SITUATION_OPTIONS: readonly CycleOption[] = [
  {
    value: 'menstruates',
    label: 'Tengo ciclo menstrual',
    description: 'Más o menos regular cada mes',
    hidesCycleInputs: false,
  },
  {
    value: 'contraception',
    label: 'Tomo anticonceptivo',
    description: 'Píldora, parche, inyección, DIU hormonal',
    hidesCycleInputs: false,
  },
  {
    value: 'irregular',
    label: 'Mi ciclo es irregular',
    description: 'Sangrado o ausencia sin patrón claro',
    hidesCycleInputs: false,
  },
  {
    value: 'pregnant',
    label: 'Estoy embarazada',
    description: 'Stelar pausa el track de ciclo',
    hidesCycleInputs: true,
  },
  {
    value: 'postmenopause',
    label: 'No menstrúo · menopausia',
    description: 'Stelar lee tu cuerpo sin la pieza ciclo',
    hidesCycleInputs: true,
  },
]

const MIN_CYCLE_LENGTH = 21
const MAX_CYCLE_LENGTH = 45
const DEFAULT_CYCLE_LENGTH = 28
const PERIOD_WINDOW_DAYS = 60

/*
 * Step 7 — Tu ciclo. Asks for the user's cycle situation first; only
 * surfaces the last-period date + cycle length when the situation
 * implies an active cycle (menstruates, contraception, irregular).
 *
 * Visual upgrades over the previous version (which read as saturated
 * with 6 stacked SelectableCards + two input sections + two caveats):
 *   • Local CycleCard with lighter borders + tighter padding so 5
 *     cards take ~80 px less than the 6 SelectableCards did.
 *   • "Prefiero no decir" moves out of the card list and becomes a
 *     small text-link below — opt-out, not a 6th option.
 *   • Hairline divider between the cards and the cycle-active inputs
 *     so the two zones read as separate without taking extra space.
 *   • Caveats tightened, voseo corrected to MX Spanish.
 *
 * ELEVATION PASS (illustrator — incremental, parity with cuerpo-base):
 *   • CycleCard "ignites" with a 200 ms OPACITY crossfade (the twin of
 *     cuerpo-base's SexPill glow + about-you's hairline ignition) rather
 *     than swapping styles binary. The idle card ALWAYS keeps its solid
 *     bgCard + hairline border (legibility); two absoluteFill layers (a
 *     magenta fill 0.10 + a magenta border) and a separate shadow layer
 *     fade IN on a per-card `glow` shared value. The card "breathes toward
 *     magenta" instead of flickering.
 *   • The conditional cycle inputs REVEAL with a 280 ms fade+rise on a
 *     screen-level `reveal` shared value (robust inside the ScrollView,
 *     no fragile layout animations).
 *   • CicloSky gains a low COOL WISP (ported from cuerpo-base) so the cold
 *     lower half has ambient depth without a focal star to celebrate.
 *
 * SENSITIVITY PASS (behavioral validation — manifiesto care): the magenta
 * halo (cardGlowShadow — the festive "bloom under the card") is SUPPRESSED
 * for the two sensitive answers (pregnant + postmenopause, i.e. the cards
 * with hidesCycleInputs). Magenta is Stelar's color-afirmación; blooming it
 * under "Estoy embarazada" / "menopausia" can read as CELEBRATING a reply
 * the user may not be celebrating. Those cards still "ignite" clearly via
 * the fill (rgba magenta 0.10) + the 1 px magenta border — the selected
 * state stays unmistakable — just without the festive halo. See `subdued`
 * (derived from option.hidesCycleInputs) in CycleCard.
 *
 * ATMOSPHERE PARITY (illustrator pass — bring step 7 to the SAME line as
 * steps 1–6): this screen was a bare dark page while every step before it
 * paints a full-screen sky. We reuse the shared atmosphere primitives
 * (AtmosphericSky + WarmBloomField + a local CicloSky) so it breathes with
 * the rest of the wizard — but DELIBERATELY COLDER and CALMER:
 *   • NO NebulaWash PNG. Steps 3's painted galaxy lends a "scene" warmth;
 *     here the theme is sensitive (cycle / pregnancy / menopause) and the
 *     beat is CONTAINMENT, not a painterly stage. The bare cool sky reads
 *     as calm holding-space.
 *   • WarmBloomField variant="exposed-low-right" — REUSED, not new. Step 6
 *     (weight) already uses "exposed", so reusing it here would chain two
 *     identical skies; "exposed-low-right" gives step 7 its own composition
 *     while protecting steps 4/5/6 (pure reuse, no new variant authored).
 *   • CicloSky — a reduced, COLD clone of step 3's AtribucionSky. The
 *     micro-stars switch from warm pink (#FBD7E3) to dimension.ciclo
 *     (#B5C4DD, the cool silver-blue cycle accent), the strata are thinned
 *     (1–2 motes pulled from each band) and the dust dimmed, so the field
 *     is quieter than step 3 — quietness as the emotional register, no
 *     focal anchor star to celebrate any one answer.
 *
 * Three clocks (5 s / 18 s / 40 s) created ONCE on the screen, shared by
 * every layer (one compás, no duplicated shared values), same periods as
 * steps 1–6.
 */
export default function TuCicloScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const recordPeriod = useRecordLastPeriodStart()

  const [situation, setSituation] = useState<CycleSituation | null>(
    (profile?.cycle_situation as CycleSituation | null) ?? null,
  )
  const [lastPeriod, setLastPeriod] = useState<Date | null>(null)
  const [cycleLength, setCycleLength] = useState<number>(
    profile?.cycle_length_days ?? DEFAULT_CYCLE_LENGTH,
  )
  const [saving, setSaving] = useState(false)
  const [savingError, setSavingError] = useState<string | null>(null)

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

  const situationMeta =
    SITUATION_OPTIONS.find((o) => o.value === situation) ??
    (situation === 'skip'
      ? { value: 'skip' as const, label: '', description: '', hidesCycleInputs: true }
      : null)
  const askCycleInputs = situationMeta !== null && !situationMeta.hidesCycleInputs

  // Conditional-inputs reveal — a 280 ms fade+rise on a screen-level shared
  // value (NOT a layout animation: those are fragile inside a ScrollView).
  // Goes to 1 when the cycle inputs should show, back to 0 when they hide.
  // The Animated.View container below tweens opacity + a 12→0 px translateY.
  const reveal = useSharedValue(0)
  useEffect(() => {
    reveal.value = withTiming(askCycleInputs ? 1 : 0, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    })
    return () => cancelAnimation(reveal)
  }, [askCycleInputs, reveal])
  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 12 }],
  }))

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

  const canContinue = situation !== null && (askCycleInputs ? lastPeriod !== null : true)

  const handlePick = (next: CycleSituation) => {
    Haptics.selectionAsync().catch(() => {})
    setSituation(next)
  }

  const handleContinue = async () => {
    if (!canContinue || !situation) return
    setSavingError(null)
    setSaving(true)
    try {
      await updateProfile.mutateAsync({
        cycle_situation: situation,
        ...(askCycleInputs ? { cycle_length_days: cycleLength } : {}),
      })
      if (askCycleInputs && lastPeriod) {
        await recordPeriod.mutateAsync(toISODate(lastPeriod))
      }
      router.push('/onboarding/tu-ritmo')
    } catch (e) {
      setSavingError(e instanceof Error ? e.message : 'No pudimos guardar tu ciclo.')
    } finally {
      setSaving(false)
    }
  }

  const skipSelected = situation === 'skip'

  return (
    <WizardLayout
      step={8}
      totalSteps={12}
      canContinue={canContinue}
      loading={saving}
      errorMessage={savingError}
      onContinue={handleContinue}
      continueLabel="Continuar"
      ctaVariant="soft"
      ctaTransform="none"
      atmosphere={
        <>
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
          <CicloSky dust={dust} orbit={orbit} />
        </>
      }
    >
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepHeader
          eyebrow="Tu ciclo"
          eyebrowColor="magenta"
          question="¿Cómo trabaja tu cuerpo?"
          questionEmphasis="trabaja"
          hint="Stelar lee tu ciclo cuando lo hay. Si no, lee el resto igual."
        />

        {/* Single-select group — the five cards + the opt-out form ONE
            logical radiogroup so VoiceOver announces the mutual exclusion
            (picking a card clears skip and vice-versa). */}
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
              // Sensitive answers (pregnant + postmenopause) suppress the
              // festive magenta halo when selected — see CycleCard / the
              // SENSITIVITY PASS note above. Fill + border still ignite.
              subdued={opt.hidesCycleInputs}
              onPress={() => handlePick(opt.value)}
            />
          ))}

          {/* Prefiero no decir — opt-out as a quiet text-link below the
              real options. It is a radio inside the group above so it
              deselects (and is deselected by) the cards. */}
          <Pressable
            onPress={() => handlePick('skip')}
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
              <View style={styles.field}>
                <DateField
                  label="ÚLTIMA MENSTRUACIÓN"
                  value={lastPeriod}
                  onChange={setLastPeriod}
                  defaultDate={defaultDate}
                  minDate={minDate}
                  maxDate={maxDate}
                  placeholder="Tocar para elegir"
                />
                <Text style={styles.caveat}>
                  Si no recuerdas exacto, una aproximación está bien.
                </Text>
              </View>

              <View style={styles.field}>
                <Stepper
                  label="DURACIÓN DEL CICLO"
                  value={cycleLength}
                  onChange={setCycleLength}
                  min={MIN_CYCLE_LENGTH}
                  max={MAX_CYCLE_LENGTH}
                  step={1}
                  unit="días"
                />
                <Text style={styles.caveat}>
                  Entre 21 y 45 días. Si no estás segura, 28 es el promedio.
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
 *  rather than a binary style swap — parity with cuerpo-base's SexPill
 *  glow + about-you's hairline ignition. Three absoluteFill layers fade
 *  IN on a per-card `glow` shared value:
 *    (a) shadow layer — static magenta iOS shadow, opacity-crossfaded;
 *    (b) magenta fill 0.10;
 *    (c) magenta 1 px border.
 *  All three share the EXACT borderRadius (12) of the idle card so no
 *  corner peeks out as they fade. The scale spring is unchanged.
 *
 *  `subdued` (manifiesto / sensitivity) — when true (pregnant +
 *  postmenopause), layer (a), the festive magenta HALO, is NOT rendered:
 *  magenta is Stelar's color-afirmación and blooming it under a sensitive
 *  answer can read as CELEBRATING it. The fill (b) + border (c) still
 *  crossfade in, so the selected state stays unmistakable — it simply
 *  "lights up" without the festive bloom. */
function CycleCard({
  option,
  selected,
  subdued,
  onPress,
}: {
  option: CycleOption
  selected: boolean
  subdued: boolean
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
  // OPACITY (200 ms / ease-out-quad, the twin compás of cuerpo-base's pill
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
              opacity. Behind the content so the halo blooms under the card.
              SUPPRESSED for `subdued` cards (pregnant + postmenopause): the
              festive magenta bloom must not "celebrate" a sensitive answer.
              Fill + border below still ignite, so selection stays clear. */}
          {subdued ? null : (
            <Animated.View style={[styles.cardGlowShadow, glowStyle]} pointerEvents="none" />
          )}
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

/* ───────────────────── Full-screen star sky ────────────────────── */

// Star strata — a COLD, THINNED clone of step 3's AtribucionSky. x/y are
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
 * CicloSky — full-screen painted depth for step 7. A reduced, COLD clone
 * of AtribucionSky: three star strata + rising dust + a low cool wisp,
 * behind the content. The stars sit in the LOWER half (the cards own the
 * top, so the sky stays a whisper there). Differential parallax (2/5/9px)
 * on the 40 s orbit clock, dust + wisp on the 18 s clock. All whisper-low
 * alphas, pointerEvents none, hidden from VoiceOver (the reading order is
 * the cards, never the decorative sky).
 *
 * COOL WISP — ported from cuerpo-base: a wide-and-low cool ellipse (ciclo
 * #B5C4DD) at cy ~0.66 that breathes 0.04↔0.06 on the dust clock. It
 * enriches the cold lower half with ambient depth, NO free-floating focal
 * star to celebrate any one answer (sensitive theme → containment).
 *
 * Parallax/twinkle move ONLY a numeric translate(px px) + opacity — never
 * an animated r/length as a string % (re-resolves against the viewport
 * every frame → jank). Gradient ids are namespaced `ciclo-*` so they
 * cannot collide with step 3's `atrib-*` / step 5's `cuerpo-*` defs.
 */
function CicloSky({ dust, orbit }: { dust: SharedValue<number>; orbit: SharedValue<number> }) {
  const SKY_W = 360
  const SKY_H = 760

  const farDriftProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    return { transform: `translate(${Math.sin(u) * 2} ${Math.cos(u) * 2})` }
  })
  const midDriftProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    return { transform: `translate(${Math.sin(u) * 5} ${Math.cos(u) * 5})` }
  })
  const microGroupProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    const flicker = 0.85 + 0.15 * Math.sin(orbit.value * 2 * Math.PI * 3)
    return { transform: `translate(${Math.sin(u) * 9} ${Math.cos(u) * 9})`, opacity: flicker }
  })

  // ── Cool wisp breath ─────────────────────────────────────────────
  // A wide, low ellipse of cool ciclo light at cy 0.66 (media-baja). It
  // breathes between 0.04 and 0.06 on the 18 s dust clock — opacity only
  // (numeric, UI-thread safe). Carries the cold lower half as ambient
  // depth (ported from cuerpo-base; reuses the shared dust clock, no new
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
  // overflow:hidden. Same fix pattern as the sex pills in cuerpo-base.
  optionsBlock: {
    marginTop: 18,
    gap: 10,
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
  // rounded silhouette. NOT rendered for `subdued` cards (pregnant +
  // postmenopause) — see CycleCard's SENSITIVITY PASS note.
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
  /* Opt-out as a tertiary text-link, not a 6th equal-weight option.
     marginTop 10 (vs the 6 between cards) so it reads as a meta-option
     set apart from the card stack — without a full divider. */
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 10,
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
  /* Hairline divider between cards and cycle-active inputs. marginTop 20
     (was 22): the reveal animation now supplies its own separation. */
  divider: {
    height: 1,
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  cycleBlock: {
    marginTop: 22,
    gap: 24,
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
    // Homogeneity with cuerpo-base / about-you's quiet labels. textAlign
    // stays left (the caveats accompany left-aligned fields).
    color: colors.bone,
  },
})
