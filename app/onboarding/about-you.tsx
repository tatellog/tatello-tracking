import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Image as SvgImage,
  LinearGradient,
  Rect,
  RadialGradient,
  Stop,
} from 'react-native-svg'

import {
  AtmosphericSky,
  DustMote,
  StepHeader,
  WarmBloomField,
  WizardLayout,
} from '@/features/onboarding/components'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)

// Painted galaxy used as a whisper-low background texture. The same PNG
// that ships as the SEMANA orb — here it bleeds past the edges as
// abstract nebular texture, never read as an object. (Shared with
// attribution's NebulaWash; here it is re-pivoted to the lower-LEFT.)
const NEBULA_ART = require('@/assets/orbits-art/orbit-week-art.png')

const MIN_AGE_YEARS = 13
const MAX_AGE_YEARS = 100
const DEFAULT_AGE_YEARS = 30

// Warm Stelar copy for a save failure. We never surface Supabase/network
// strings (English, technical) — that violates the manifiesto's voice
// line. A single warm fallback that keeps the CTA as the retry.
const SAVE_ERROR_COPY = 'No pudimos guardar esto. ¿Lo intentamos de nuevo?'

const SPANISH_MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const

/*
 * Identidad — Screen 1 of the split "Cuéntame de ti" pair. Asks only
 * the two questions that name *who* the user is: their name and the
 * date that defines their constellation. Body-base questions (height,
 * sex) live in the second screen, body-base.
 *
 * The base cosmic backdrop (starfield + Stelar presence) is mounted PER
 * SCREEN by WizardLayout (its own opaque <WizardBackdrop />) so the
 * slide transition fully occludes the screen behind it. The presence
 * breath is shared via WizardPresenceContext so it never restarts. The
 * KeyboardAvoidingView root is OPAQUE (colors.bg); this step's own
 * atmosphere (NebulaWash + AtmosphericSky + WarmBloomField + AboutYouSky)
 * layers above the backdrop via WizardLayout's `atmosphere` prop.
 *
 * Visual language is calmer than the previous combined form: no
 * presence-star glyphs on the left (those read as form-language), no
 * gradient underline — just a magenta hairline that appears under a
 * field when it's focused or filled. Question labels sit above each
 * input in serif italic at quiet opacity, so the field value is the
 * only voice that lifts off the page.
 *
 * HAIRLINE "IGNITION" (illustrator elevation): the active hairline no
 * longer sits flat — it LIGHTS UP like a constellation point coming
 * online. A filled-but-unfocused line carries a soft magentaHot halo;
 * focusing it brightens the halo (the user's attention "ignites" the
 * line). The halo opacity tweens on withTiming(200 ms, ease-out-quad) —
 * the SAME compás as atmoDim — so the screen breathes on one curve.
 *
 * ATMOSPHERE (illustrator pass, FORM-adapted): unlike attribution (a
 * chips screen), this is a form — usability wins over atmosphere. The
 * sky is composed as a CENTRAL CLEAR CHANNEL: weight goes to the
 * ceiling + the lower corners; the vertical centre (name input + date
 * picker) stays a calm zone with minimal atmosphere. Back→front:
 *   1. NebulaWash      — the painted galaxy PNG, re-pivoted to the
 *                        lower-LEFT corner (cx18%/cy92%), rotated +22°,
 *                        faded hard to black by offset 0.62 so nothing
 *                        crosses under the name field.
 *   2. AtmosphericSky  — the cool glow pulled HIGH up-LEFT (24%/34%/58%)
 *                        so the cold sits over the header.
 *   3. WarmBloomField  — variant="exposed-low-left": warm weight in the
 *                        lower-left corner only.
 *   4. AboutYouSky     — star strata in a "U" (ceiling + floor populated,
 *                        the central band 0.30–0.72 left empty), dust
 *                        rising only along the edges, plus a wide-and-low
 *                        COOL WISP in the media-baja zone (depth without a
 *                        focal star — keeps the central channel clear).
 *
 * PRECISION MODE — the whole atmosphere DIMS (opacity → 0.4) whenever the
 * name field is focused OR the date picker is open. The spinner renders
 * inline and its on-screen position varies by device/scroll/keyboard, so
 * we never try to protect it with static coordinates — we calm the entire
 * sky while the user is typing or scrolling the picker, then bring it back.
 *
 * The three clocks (5 s / 18 s / 40 s) are created ONCE on the screen and
 * shared by every atmosphere layer so there is one compás.
 */
export default function AboutYouScreen() {
  const router = useRouter()
  // Opened from Ajustes (?source=settings) → save and return there;
  // otherwise this is the onboarding wizard → advance to body-base.
  const { source } = useLocalSearchParams<{ source?: string }>()
  const fromSettings = source === 'settings'
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  const { defaultDate, minDate, maxDate } = useMemo(() => boundsForAdult(), [])

  const initialDob = useMemo(() => parseISODate(profile?.date_of_birth), [profile?.date_of_birth])

  const [name, setName] = useState(profile?.display_name ?? '')
  const [dob, setDob] = useState<Date | null>(initialDob)

  // Precision mode — lifted state. The atmosphere dims while the name
  // field is focused or the picker is open (see PrecisionMode worklet).
  const [nameFocused, setNameFocused] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const dimmed = nameFocused || pickerOpen

  const trimmedName = name.trim()
  const nameValid = trimmedName.length >= 1 && trimmedName.length <= 40
  const dobValid = dob !== null && isAdultAge(dob)

  const canContinue = nameValid && dobValid

  // Shared clocks for the whole step — created ONCE here so every
  // atmosphere layer (NebulaWash, WarmBloomField, star strata + dust)
  // breathes on the SAME values (same periods as steps 1/2/3):
  //   clock  5 s  warm-field breath + nebula-texture breath
  //   dust  18 s  cosmic-dust drift + cool-wisp breath
  //   orbit 40 s  star-strata parallax
  const clock = useSharedValue(0)
  const dust = useSharedValue(0)
  const orbit = useSharedValue(0)

  // Precision-mode atmosphere dimmer — withTiming target driven by the
  // lifted dimmed flag. 1 = full sky, 0.4 = calm (typing / picking).
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
    atmoDim.value = withTiming(dimmed ? 0.4 : 1, { duration: 200, easing: Easing.out(Easing.quad) })
    // Defensive cleanup — withTiming is one-shot, but cancel on unmount
    // so a teardown mid-tween never leaves a dangling animation.
    return () => cancelAnimation(atmoDim)
  }, [dimmed, atmoDim])

  const atmoDimStyle = useAnimatedStyle(() => ({ opacity: atmoDim.value }))

  const handleContinue = () => {
    if (!canContinue || !dob) return
    updateProfile.mutate(
      {
        display_name: trimmedName,
        date_of_birth: toISODate(dob),
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
          if (fromSettings) router.back()
          else router.push('/onboarding/body-base')
        },
      },
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.kb}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <WizardLayout
        step={4}
        totalSteps={9}
        canContinue={canContinue}
        loading={updateProfile.isPending}
        // Map any raw Supabase/network error to warm Stelar copy — never
        // surface the technical English string (manifiesto voice line).
        errorMessage={updateProfile.error ? SAVE_ERROR_COPY : null}
        onContinue={handleContinue}
        // From Ajustes this is a profile edit, not onboarding step 4 of 9:
        // hide the phase progress bar (a 4-step meter makes no sense here)
        // and label the CTA "Guardar". Mirrors intention.tsx's settings mode.
        continueLabel={fromSettings ? 'Guardar' : 'Continuar'}
        showProgress={!fromSettings}
        ctaVariant="soft"
        ctaTransform="none"
        atmosphere={
          // Precision-mode wrapper — the ONE Animated.View whose opacity
          // dims the whole sky while typing / picking. a11y-hidden +
          // pointerEvents none so VoiceOver never reads it between the
          // name and date fields.
          <Animated.View
            style={[StyleSheet.absoluteFill, atmoDimStyle]}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {/* 1. Painterly texture — the painted galaxy, re-pivoted to
                the lower-LEFT, faded hard so nothing crosses the centre. */}
            <NebulaWash clock={clock} />
            {/* 2. Cool glow pulled HIGH up-left, over the header. */}
            <AtmosphericSky glow={{ cx: '24%', cy: '34%', r: '58%' }} />
            {/* 3. Warm weight in the lower-left corner only. */}
            <WarmBloomField clock={clock} variant="exposed-low-left" />
            {/* 4. Star strata in a "U" + edge dust + a low cool wisp.
                When the birth date becomes valid, ONE floor star blooms
                once (no figure, no lines) so the user feels her date
                register. */}
            <AboutYouSky dust={dust} orbit={orbit} dobValid={dobValid} />
          </Animated.View>
        }
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepHeader
            // PLACEHOLDER copy (voice-and-copy): in Ajustes the screen is
            // an edit of data we already hold, so first-person "cuéntame"
            // copy reads wrong. Onboarding keeps the original invitation.
            eyebrow={fromSettings ? 'Tus datos' : 'Para conocerte'}
            eyebrowColor="magenta"
            question={fromSettings ? 'Lo que eres.' : 'Cuéntame de ti.'}
            questionEmphasis={fromSettings ? 'eres' : 'Cuéntame'}
            // PLACEHOLDER copy (voice-and-copy): honesty fix — this data
            // is saved to your account (Supabase), NOT kept only on the
            // phone. The promise is about CUSTODY (we never share it with
            // third parties), never about locality.
            hint="Solo para ti. Nunca lo compartimos."
          />

          <Section question="¿Cómo te llamas?">
            <LineInput
              value={name}
              onChangeText={setName}
              placeholder="Tu nombre"
              filled={nameValid}
              onFocusChange={setNameFocused}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={40}
            />
          </Section>

          <Section question="¿Cuándo naciste?" hint="De aquí nace tu cielo.">
            <DateTrigger
              value={dob}
              onChange={setDob}
              filled={dobValid}
              defaultDate={defaultDate}
              minDate={minDate}
              maxDate={maxDate}
              onPickerToggle={setPickerOpen}
            />
          </Section>
        </ScrollView>
      </WizardLayout>
    </KeyboardAvoidingView>
  )
}

/* ─────────────────────── Section ─────────────────────── */

/** A field block: a serif-italic question label above its input. No
 *  presence glyph on the left — the question carries itself, and the
 *  input is the only thing that lights when answered. */
function Section({
  question,
  hint,
  children,
}: {
  question: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{question}</Text>
      <View style={styles.sectionBody}>{children}</View>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  )
}

/* ─────────────────────── ActiveHairline ─────────────────────── */

/*
 * The field underline that "ignites" like a constellation point.
 *
 * Two stacked layers:
 *   · the flat magenta line (rendered only when active = focused||filled)
 *   · an OVERLAY glow View whose magentaHot iOS shadow opacity tweens
 *     between three states on withTiming(200 ms, ease-out-quad) — the
 *     same curve + duration as the screen's atmoDim, so the whole step
 *     shares one compás:
 *        idle (not active)        → glow 0
 *        filled, not focused      → glow 0.35 / radius 4
 *        focused                  → glow 0.6  / radius 7
 *
 * The animated channel is a single 0→1 `glow` shared value; the static
 * shadowOpacity/Radius live in StyleSheet and we drive only the View's
 * opacity (numeric, UI-thread safe — never an animated length/%). On
 * Android, View shadows don't blur, so the glow layer degrades to a
 * harmless near-invisible line over the flat magenta hairline (iOS is
 * the validation platform); usability is untouched on both.
 */
function ActiveHairline({ active, focused }: { active: boolean; focused: boolean }) {
  // 0 = no glow, 0.35/4 = filled-resting, 0.6/7 = focused-ignited. We
  // tween a single 0→1 driver and map it to the two glow strengths via
  // crossfading two static shadow layers (resting + focused), so neither
  // shadowOpacity nor shadowRadius is animated as a numeric prop on the
  // View (those are not on the RN animated fast-path) — only opacity is.
  const restGlow = useSharedValue(active && !focused ? 1 : 0)
  const focusGlow = useSharedValue(active && focused ? 1 : 0)

  useEffect(() => {
    const cfg = { duration: 200, easing: Easing.out(Easing.quad) }
    restGlow.value = withTiming(active && !focused ? 1 : 0, cfg)
    focusGlow.value = withTiming(active && focused ? 1 : 0, cfg)
    return () => {
      cancelAnimation(restGlow)
      cancelAnimation(focusGlow)
    }
  }, [active, focused, restGlow, focusGlow])

  const restStyle = useAnimatedStyle(() => ({ opacity: restGlow.value }))
  const focusStyle = useAnimatedStyle(() => ({ opacity: focusGlow.value }))

  return (
    <View style={styles.hairlineWrap} pointerEvents="none">
      {/* Flat magenta line — the base hairline, shown only when active. */}
      <View style={[styles.border, active && styles.borderActive]} />
      {/* Resting halo — filled but not focused (magentaHot 0.35 / r4). */}
      <Animated.View style={[styles.hairlineGlow, styles.hairlineGlowRest, restStyle]} />
      {/* Ignited halo — focused (magentaHot 0.6 / r7). Crossfades over
          the resting layer so the line "brightens" when attended. */}
      <Animated.View style={[styles.hairlineGlow, styles.hairlineGlowFocus, focusStyle]} />
    </View>
  )
}

/* ─────────────────────── LineInput ─────────────────────── */

/** A single-line text input. The underline only appears when the
 *  field is focused or filled — empty/idle inputs read as quiet
 *  invitations, not blank form fields. Reports focus changes upward so
 *  the screen can enter precision mode (dim the atmosphere). */
function LineInput({
  value,
  onChangeText,
  placeholder,
  filled,
  onFocusChange,
  ...rest
}: {
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  filled: boolean
  onFocusChange?: (focused: boolean) => void
} & Omit<
  TextInputProps,
  'value' | 'onChangeText' | 'placeholder' | 'placeholderTextColor' | 'style'
>) {
  const [focused, setFocused] = useState(false)
  const showBorder = focused || filled

  const handleFocus = () => {
    setFocused(true)
    onFocusChange?.(true)
  }
  const handleBlur = () => {
    setFocused(false)
    onFocusChange?.(false)
  }

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        // Leche-warm placeholder (not cold white) so the empty field
        // reads as a warm invitation, in temperature with the palette.
        placeholderTextColor="rgba(244,236,222,0.20)"
        selectionColor={colors.magenta}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={[
          styles.input,
          styles.inputField,
          filled && styles.inputFilled,
          Platform.OS === 'web' && styles.inputWeb,
        ]}
        {...rest}
      />
      <ActiveHairline active={showBorder} focused={focused} />
    </View>
  )
}

/* ─────────────────────── DateTrigger ─────────────────────── */

/** A pressable that opens the native date picker. Visual shell
 *  mirrors LineInput — same 28 px Hanken value, same active border.
 *  Reports open/close upward so the screen can dim the atmosphere
 *  while the user scrolls the inline spinner. */
function DateTrigger({
  value,
  onChange,
  filled,
  defaultDate,
  minDate,
  maxDate,
  onPickerToggle,
}: {
  value: Date | null
  onChange: (next: Date) => void
  filled: boolean
  defaultDate?: Date
  minDate?: Date
  maxDate?: Date
  onPickerToggle?: (open: boolean) => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const seed = value ?? defaultDate ?? new Date(2000, 0, 1)
  const showBorder = showPicker || filled

  // Last discrete day we fired a haptic for. The iOS spinner emits many
  // onChange events as it scrolls; we only tick when the landed Y-M-D
  // actually differs, so the device doesn't buzz continuously.
  const lastTickKey = useRef<string | null>(value ? dayKey(value) : null)

  const toggle = () => {
    setShowPicker((prev) => {
      const next = !prev
      onPickerToggle?.(next)
      return next
    })
  }

  const handleNativeChange = (_event: DateTimePickerEvent, next?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false)
      onPickerToggle?.(false)
    }
    if (next) {
      // Throttle the haptic to discrete landings: only tick when the
      // resulting day/month/year is different from the last one we
      // acknowledged. Avoids near-continuous vibration on iOS scroll.
      const key = dayKey(next)
      if (key !== lastTickKey.current) {
        lastTickKey.current = key
        Haptics.selectionAsync().catch(() => {})
      }
      onChange(next)
    }
  }

  return (
    <View>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel="Elegir fecha de nacimiento"
        accessibilityValue={value ? { text: formatDateLong(value) } : undefined}
        style={styles.dateTrigger}
      >
        <Text
          style={[styles.input, filled && styles.inputFilled, !value && styles.inputPlaceholder]}
        >
          {value ? formatDateLong(value) : 'Toca para elegir'}
        </Text>
      </Pressable>
      <ActiveHairline active={showBorder} focused={showPicker} />
      {showPicker ? (
        <DateTimePicker
          value={seed}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minDate}
          maximumDate={maxDate}
          onChange={handleNativeChange}
          textColor={colors.leche}
          themeVariant="dark"
          style={styles.picker}
        />
      ) : null}
    </View>
  )
}

/* ───────────────────── Full-screen star sky ────────────────────── */

/*
 * AboutYouSky — full-screen painted depth for the FORM, cloned from
 * attribution's AttributionSky but composed as a "U": stars populate the
 * CEILING (y 0.06–0.20) and the FLOOR (y 0.80–0.94), and the central
 * band (y 0.30–0.72, where the inputs + date picker live) is left
 * EMPTY. Dust rises only along the EDGES (x ≈ 0.10 / 0.88), never up
 * the centre. Same three strata + parallax (2/5/9 px) on the orbit
 * clock, dust on the dust clock.
 *
 * COOL WISP (illustrator elevation): a single wide-and-LOW cool ellipse
 * (ciclo #B5C4DD) in the media-baja zone (cy 0.66) that breathes very
 * faintly on the dust clock. It adds atmospheric DEPTH between the date
 * field and the CTA without ever becoming a focal star — keeping the
 * manifiesto's central channel clear (bruma, no point of light there).
 *
 * CONSTELLATION (manifiesto-safe): we do NOT draw connected points or a
 * figure — that risks reading as a horoscope ("NO horóscopo decorativo").
 * The only completion feedback here is a single BLOOM on ONE floor star
 * when the birth date becomes valid (a one-shot withSequence on that one
 * star's opacity + numeric radius). No lines, no dots joined, no glyph —
 * just one point of light answering "Tu fecha define tu constelación".
 */
const CEIL_FAR: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.12, y: 0.07, r: 0.6, opacity: 0.1 },
  { x: 0.88, y: 0.09, r: 0.7, opacity: 0.12 },
  { x: 0.5, y: 0.06, r: 0.5, opacity: 0.08 },
  { x: 0.3, y: 0.15, r: 0.6, opacity: 0.09 },
  { x: 0.72, y: 0.17, r: 0.5, opacity: 0.08 },
]
const CEIL_MID: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.18, y: 0.12, r: 0.8, opacity: 0.22 },
  { x: 0.82, y: 0.14, r: 0.7, opacity: 0.2 },
  { x: 0.6, y: 0.1, r: 0.7, opacity: 0.2 },
  { x: 0.4, y: 0.19, r: 0.7, opacity: 0.18 },
]
const CEIL_MICRO: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.26, y: 0.1, r: 1.0, opacity: 0.36 },
  { x: 0.78, y: 0.08, r: 0.9, opacity: 0.32 },
  { x: 0.54, y: 0.18, r: 0.85, opacity: 0.3 },
]

// FLOOR strata.
const FLOOR_FAR: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.1, y: 0.84, r: 0.6, opacity: 0.1 },
  { x: 0.9, y: 0.86, r: 0.7, opacity: 0.12 },
  { x: 0.34, y: 0.92, r: 0.5, opacity: 0.08 },
  { x: 0.66, y: 0.9, r: 0.6, opacity: 0.1 },
]
const FLOOR_MID: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.16, y: 0.88, r: 0.8, opacity: 0.22 },
  { x: 0.86, y: 0.82, r: 0.7, opacity: 0.2 },
  { x: 0.5, y: 0.94, r: 0.7, opacity: 0.2 },
]
const FLOOR_MICRO: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.24, y: 0.86, r: 1.0, opacity: 0.34 },
  { x: 0.8, y: 0.9, r: 0.9, opacity: 0.3 },
  { x: 0.46, y: 0.81, r: 0.85, opacity: 0.3 },
  { x: 0.62, y: 0.85, r: 0.8, opacity: 0.28 },
]

// The single "date star" that blooms once when dobValid flips true. It
// sits low-centre, in the empty channel just below the floor band, so it
// reads as a lone point — never a figure, never joined to its neighbours.
const DATE_STAR = { x: 0.5, y: 0.79, baseR: 1.6 }

// Dust — reduced to 4 motes rising up the EDGES only (x 0.10 / 0.88),
// never the centre.
const DUST: {
  x: number
  baseR: number
  period: number
  sway: number
  opacity: number
  phase: number
}[] = [
  { x: 0.1, baseR: 0.9, period: 1.05, sway: 7, opacity: 0.34, phase: 0.1 },
  { x: 0.88, baseR: 0.8, period: 0.95, sway: 8, opacity: 0.3, phase: 0.5 },
  { x: 0.12, baseR: 0.65, period: 1.2, sway: 6, opacity: 0.26, phase: 0.7 },
  { x: 0.86, baseR: 0.7, period: 1.12, sway: 7, opacity: 0.28, phase: 0.3 },
]

function AboutYouSky({
  dust,
  orbit,
  dobValid,
}: {
  dust: SharedValue<number>
  orbit: SharedValue<number>
  dobValid: boolean
}) {
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
  // A wide, low ellipse of cool ciclo light in the media-baja zone. It
  // breathes between 0.04 and 0.06 on the SAME 18 s dust clock so it
  // shares the existing compás — opacity only (numeric, UI-thread safe),
  // never an animated radius/transform. Depth without a focal star.
  const coolWispProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(dust.value * 2 * Math.PI)
    return { opacity: 0.04 + w * 0.02 }
  })

  // ── Date-star bloom ──────────────────────────────────────────────
  // ONE point of light that answers the user's date. When dobValid
  // flips false→true, `bloom` runs a one-shot 0 → 1 → rest sequence;
  // we never animate radius/opacity as a string percentage — the radius
  // is a numeric interpolation and opacity is a plain number, both safe
  // on the UI thread.
  const bloom = useSharedValue(dobValid ? 1 : 0)
  const wasValid = useRef(dobValid)
  useEffect(() => {
    if (dobValid && !wasValid.current) {
      // false → true: a perceptible single-shot bloom (~600 ms total).
      // overshoot to a peak, then settle to a quiet resting glow.
      bloom.value = withSequence(
        withTiming(1.4, { duration: 360, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) }),
      )
    } else if (!dobValid) {
      // Cleared / invalid again — fade the lone star back out.
      bloom.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) })
    }
    wasValid.current = dobValid
    return () => cancelAnimation(bloom)
  }, [dobValid, bloom])

  // Bloom core — numeric radius (1× baseR at rest → ~1.5× at peak) and
  // a 0 → ~0.9 opacity. Glow halo doubles the radius. No transforms as
  // percentages; r is a number, opacity is a number.
  const bloomCoreProps = useAnimatedProps(() => {
    'worklet'
    const t = Math.min(bloom.value, 1.4)
    return {
      r: DATE_STAR.baseR * (1 + t * 0.35),
      opacity: Math.min(t, 1) * 0.9,
    }
  })
  const bloomGlowProps = useAnimatedProps(() => {
    'worklet'
    const t = Math.min(bloom.value, 1.4)
    return {
      r: DATE_STAR.baseR * (2.6 + t * 1.2),
      opacity: Math.min(t, 1) * 0.5,
    }
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
          {/* Tight white falloff so micro-stars glow rather than read
              as flat drawn dots. */}
          <RadialGradient id="aboutyou-starGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          {/* Warm magenta-leaning falloff for the lone date star's halo. */}
          <RadialGradient id="aboutyou-bloomGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.magentaHot} stopOpacity="0.85" />
            <Stop offset="1" stopColor={colors.magentaHot} stopOpacity="0" />
          </RadialGradient>
          {/* Cool wisp — silver-blue ciclo, faint, falls off to nothing.
              A bruma band in the media-baja zone (NOT a star). */}
          <RadialGradient id="aboutyou-coolWisp" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.dimension.ciclo} stopOpacity="0.06" />
            <Stop offset="1" stopColor={colors.dimension.ciclo} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Cool wisp — wide-and-low ellipse between the date field and
            the CTA (cy 0.66). Breathes faintly on the dust clock. Depth
            without a focal point; central channel stays bruma-only. */}
        <AnimatedEllipse
          cx={0.5 * SKY_W}
          cy={0.66 * SKY_H}
          rx={0.55 * SKY_W}
          ry={0.06 * SKY_H}
          fill="url(#aboutyou-coolWisp)"
          animatedProps={coolWispProps}
        />

        {/* Cosmic dust rising along the EDGES only. */}
        {DUST.map((d, i) => (
          <DustMote key={`sky-dust-${i}`} {...d} clock={dust} stage={SKY_H} fill="#F8DBCE" />
        ))}

        {/* ── CEILING strata ── populated y 0.06–0.20 ── */}
        <AnimatedG animatedProps={farDriftProps}>
          {CEIL_FAR.map((s, i) => (
            <G key={`cfar-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.4}
                fill="url(#aboutyou-starGlow)"
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
        <AnimatedG animatedProps={midDriftProps}>
          {CEIL_MID.map((s, i) => (
            <Circle
              key={`cmid-${i}`}
              cx={s.x * SKY_W}
              cy={s.y * SKY_H}
              r={s.r}
              fill="#E8D9DD"
              opacity={s.opacity}
            />
          ))}
        </AnimatedG>
        <AnimatedG animatedProps={microGroupProps}>
          {CEIL_MICRO.map((s, i) => (
            <G key={`cmicro-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.5}
                fill="url(#aboutyou-starGlow)"
                opacity={0.15}
              />
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r}
                fill="#FBD7E3"
                opacity={s.opacity}
              />
            </G>
          ))}
        </AnimatedG>

        {/* ── FLOOR strata ── populated y 0.80–0.94 ── */}
        <AnimatedG animatedProps={farDriftProps}>
          {FLOOR_FAR.map((s, i) => (
            <G key={`ffar-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.4}
                fill="url(#aboutyou-starGlow)"
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
        <AnimatedG animatedProps={midDriftProps}>
          {FLOOR_MID.map((s, i) => (
            <Circle
              key={`fmid-${i}`}
              cx={s.x * SKY_W}
              cy={s.y * SKY_H}
              r={s.r}
              fill="#E8D9DD"
              opacity={s.opacity}
            />
          ))}
        </AnimatedG>
        <AnimatedG animatedProps={microGroupProps}>
          {FLOOR_MICRO.map((s, i) => (
            <G key={`fmicro-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.5}
                fill="url(#aboutyou-starGlow)"
                opacity={0.15}
              />
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r}
                fill="#FBD7E3"
                opacity={s.opacity}
              />
            </G>
          ))}
        </AnimatedG>

        {/* ── Date star ── a SINGLE point that blooms once when the
            birth date validates. Halo first (behind), then the core.
            One point of light, never connected to anything. ── */}
        <AnimatedCircle
          cx={DATE_STAR.x * SKY_W}
          cy={DATE_STAR.y * SKY_H}
          r={DATE_STAR.baseR * 2.6}
          fill="url(#aboutyou-bloomGlow)"
          animatedProps={bloomGlowProps}
        />
        <AnimatedCircle
          cx={DATE_STAR.x * SKY_W}
          cy={DATE_STAR.y * SKY_H}
          r={DATE_STAR.baseR}
          fill={colors.leche}
          animatedProps={bloomCoreProps}
        />
      </Svg>
    </View>
  )
}

/* ─────────────────────── Painted galaxy texture ─────────────────────── */

/*
 * NebulaWash — the painterly base layer, cloned from attribution and
 * re-pivoted for this FORM. A single painted galaxy PNG blown up to
 * ~150% of the reference width so it bleeds past every edge and reads
 * as nebular TEXTURE, never an object. Pivoted to the lower-LEFT corner
 * (cx 18% / cy 92%) and rotated +22°, then dropped to whisper opacity.
 *
 * The vertical fade is MORE aggressive than attribution's (fades to
 * transparent by offset 0.62 instead of 0.5) so absolutely nothing
 * crosses under the name field in the central channel.
 *
 * Only the PNG OPACITY breathes (0.08 ↔ 0.11) on the shared 5 s clock.
 * Transform / size / position are STATIC. pointerEvents none, hidden
 * from VoiceOver.
 */
function NebulaWash({ clock }: { clock: SharedValue<number> }) {
  const SKY_W = 360
  const SKY_H = 760

  const IMG_W = SKY_W * 1.5
  const IMG_H = IMG_W // square source art
  // Pivot lower-LEFT: (18% w, 92% h). Top-left = pivot − half.
  const PIVOT_X = SKY_W * 0.18
  const PIVOT_Y = SKY_H * 0.92
  const IMG_X = PIVOT_X - IMG_W / 2
  const IMG_Y = PIVOT_Y - IMG_H / 2

  const imgProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    return { opacity: 0.08 + w * 0.03 }
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
          {/* Vertical fade — bg opaque at the top → transparent by 0.62
              so the PNG's upper edge melts well before the central
              input channel; nothing crosses under the name field. */}
          <LinearGradient id="aboutyou-nebulaFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bg} stopOpacity="1" />
            <Stop offset="0.62" stopColor={colors.bg} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Painted galaxy — rotated +22°, lower-left, breathing opacity. */}
        <AnimatedG animatedProps={imgProps}>
          <G transform={`rotate(22 ${PIVOT_X} ${PIVOT_Y})`}>
            <SvgImage
              href={NEBULA_ART}
              x={IMG_X}
              y={IMG_Y}
              width={IMG_W}
              height={IMG_H}
              preserveAspectRatio="xMidYMid slice"
            />
          </G>
        </AnimatedG>

        {/* Fade the PNG's top edge into bg (no seam in the centre). */}
        <Rect x={0} y={0} width={SKY_W} height={SKY_H} fill="url(#aboutyou-nebulaFade)" />
      </Svg>
    </View>
  )
}

/* ─────────────────────── Date helpers ─────────────────────── */

/** Discrete day key (Y-M-D) — used to throttle the spinner haptic so it
 *  only ticks when the landed calendar day actually changes. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function formatDateLong(d: Date): string {
  const month = SPANISH_MONTHS[d.getMonth()] ?? 'ene'
  return `${d.getDate()} ${month} ${d.getFullYear()}`
}

function yearsAgo(years: number): Date {
  const now = new Date()
  return new Date(now.getFullYear() - years, now.getMonth(), now.getDate())
}

function boundsForAdult() {
  return {
    defaultDate: yearsAgo(DEFAULT_AGE_YEARS),
    minDate: yearsAgo(MAX_AGE_YEARS),
    maxDate: yearsAgo(MIN_AGE_YEARS),
  }
}

function isAdultAge(d: Date): boolean {
  const min = yearsAgo(MAX_AGE_YEARS).getTime()
  const max = yearsAgo(MIN_AGE_YEARS).getTime()
  const t = d.getTime()
  return t >= min && t <= max
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseISODate(v: string | null | undefined): Date | null {
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return null
  const [, y, mo, d] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? null : date
}

/* ─────────────────────── Styles ─────────────────────── */

const styles = StyleSheet.create({
  // OPAQUE root (colors.bg) so the incoming screen occludes the outgoing
  // one during the slide. WizardLayout mounts its own opaque
  // WizardBackdrop; this step paints its own atmosphere ABOVE that
  // backdrop via the `atmosphere` prop.
  kb: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  // Generous vertical breathing between the two questions — the spec
  // calls for ~40 px so the screen never feels like a form.
  section: {
    marginTop: 40,
  },
  // The question itself — serif italic, ~20 px, soft opacity. No
  // glyph on the left; the typography is the whole signal.
  sectionLabel: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.headingLg,
    lineHeight: 26,
    color: colors.leche,
    opacity: 0.55,
    letterSpacing: -0.2,
  },
  sectionBody: {
    marginTop: 12,
  },
  sectionHint: {
    marginTop: 10,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    // bone (not niebla) for contrast — consistent with attribution's
    // skip label; the value leche stays the only bright voice.
    color: colors.bone,
    letterSpacing: 0.1,
  },
  /* Input — large value typography. letterSpacing eased to -0.4 (more
     editorial breathing room than the original -0.6, same size). */
  input: {
    paddingTop: 6,
    paddingBottom: 10,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.deltaNum,
    letterSpacing: -0.4,
    color: colors.leche,
    backgroundColor: 'transparent',
  },
  // Filled value — a SUBTLE warm halo (magentaHot @ 0.18) only once the
  // field carries a real answer, so the value reads as premium light
  // rather than flat ink. At 0.18 it's warmth, not a legible shadow.
  inputFilled: {
    textShadowColor: 'rgba(255,72,134,0.18)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  // The editable name field: full-width + 44 pt min so tapping anywhere
  // along the line focuses it (not just the width of the typed text).
  inputField: {
    minHeight: 44,
    width: '100%',
  },
  inputPlaceholder: {
    // Warm niebla for the "Toca para elegir" prompt — a temperature
    // match to the palette, not a cold white translucency.
    color: colors.niebla,
  },
  inputWeb: {
    // @ts-expect-error — outline* is web-only; RNW accepts it.
    outlineStyle: 'none',
  },
  /* Date trigger — same visual shell as LineInput. */
  dateTrigger: {
    minHeight: 44,
    justifyContent: 'center',
  },
  picker: {
    marginTop: 4,
    alignSelf: 'stretch',
  },
  /* Hairline stack — the flat line + its two crossfading glow layers,
     all sharing the same 1.5 px footprint at the foot of the field. */
  hairlineWrap: {
    height: 1.5,
  },
  /* Border — a single magenta hairline that only renders when the
     field is focused or filled. Idle fields show no border so the
     screen reads as conversation, not a form. */
  border: {
    height: 1.5,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  borderActive: {
    backgroundColor: colors.magenta,
  },
  /* Glow halo over the hairline — a magentaHot iOS shadow whose opacity
     is the ONLY animated channel (200 ms tween). Two static-strength
     variants (rest / focus) crossfade so neither shadowOpacity nor
     shadowRadius is animated. Android: shadow doesn't blur → degrades
     to a near-invisible line, no break (iOS is the validation target). */
  hairlineGlow: {
    ...StyleSheet.absoluteFillObject,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: colors.magenta,
    shadowColor: colors.magentaHot,
    shadowOffset: { width: 0, height: 0 },
  },
  hairlineGlowRest: {
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  hairlineGlowFocus: {
    shadowOpacity: 0.6,
    shadowRadius: 7,
  },
})
