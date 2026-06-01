import { LinearGradient } from 'expo-linear-gradient'
import * as Notifications from 'expo-notifications'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
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
  DustMote,
  StepHeader,
  WarmBloomField,
  WizardLayout,
} from '@/features/onboarding/components'
import { type NotificationWindow } from '@/features/profile/api'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)

/** One reading-window option. `description` is the tagline below the
 *  label so each card carries weight — not a flat one-word row. */
type ReadingOption = {
  value: NotificationWindow
  label: string
  description: string
}

const OPTIONS: readonly ReadingOption[] = [
  {
    value: 'morning',
    label: 'En la mañana',
    description: 'Para abrir el día mirando tu cielo',
  },
  {
    value: 'midday',
    label: 'Al mediodía',
    description: 'Una pausa para volver a tu cielo',
  },
  {
    value: 'evening',
    label: 'Antes de dormir',
    description: 'Para cerrar el día bajo tu cielo',
  },
  {
    // "Aún no" is a LEGITIMATE preference, not a skip / opt-out. It is the
    // 4th ReadingCard with the SAME treatment as the other three (same
    // ignite, same dot, same serif italic). It is set apart only by AIR
    // (a larger marginTop on the card) because "sí / sí / sí" vs "ahora no"
    // is another logical category — NEVER by a dimmer dot or a degraded
    // hierarchy. It lives INSIDE the radiogroup as the 4th radio.
    value: 'not_yet',
    label: 'Aún no',
    description: 'Lo activas cuando quieras desde Ajustes',
  },
]

/*
 * Step 11 — notification warmup. The classic priming pattern: ask the user
 * WHEN they want to hear from Stelar before firing the iOS native
 * permission prompt. By the time the OS dialog lands, the user has already
 * mentally consented; grant rates go up 2-3x vs a cold prompt at app open.
 *
 * PRIMING (uxui override — usability/ethics wins on permission flows):
 *   • The CTA label is DYNAMIC — picking a real time-window names the
 *     action ("Activar mi lectura"), so the OS dialog is no surprise;
 *     'not_yet' / no selection keeps the neutral "Continuar".
 *   • A micro-copy below the cards ("Al continuar, tu teléfono te
 *     preguntará si Stelar puede avisarte.") disarms the iOS dialog
 *     honestly. Shown only when a real window is chosen.
 *   • handleContinue READS the permission status — denied is NOT an
 *     error: we still save the window (the user's intention) and reach
 *     reveal. The soft re-ask lives in Ajustes.
 *
 * The 'not_yet' value is a real preference, not a skip — the future
 * re-ask logic surfaces a gentle nudge later, never here.
 *
 * The actual scheduling of the recurring local notification lands later
 * (needs profile.timezone + the engine's daily-reading output) and will
 * consult the OS permission at RUNTIME — so we deliberately do NOT persist
 * a permission flag in the schema here (deferred to the scheduling
 * deliverable). For now we only read the status + leave a debt comment.
 *
 * ATMOSPHERE (illustrator pass — same line as steps 1–10): the screen
 * paints a full-screen sky so it breathes with the rest of the wizard.
 * The tint is WARM MAGENTA. There is NO focal anchor star — parity with
 * the sibling steps: no single answer is celebrated with an astro.
 *
 * COPY NOTE: "Activar mi lectura" + the priming micro-copy are PENDING
 * behavioral / voice-and-copy sign-off (next in the chain). Kept clean.
 *
 * SETTINGS RE-ENTRY (?source=settings): the same screen doubles as the
 * "Notificaciones" editor reachable from Ajustes. When fromSettings we
 * SAVE the window and pop straight back (router.back()) instead of
 * advancing to /onboarding/attribution; we still fire the OS prompt for a
 * real window (that's the whole point of re-entering), show a back chevron,
 * and the CTA reads "Guardar". This mirrors intention.tsx's re-entry.
 */
export default function NotificationsScreen() {
  const router = useRouter()
  const { source } = useLocalSearchParams<{ source?: string }>()
  const fromSettings = source === 'settings'
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [window, setWindow] = useState<NotificationWindow | null>(
    (profile?.notification_window as NotificationWindow | null) ?? null,
  )
  const [requestingPermission, setRequestingPermission] = useState(false)

  // The screen already names itself; no per-name suffix (parity with
  // intention / rhythm).
  const eyebrow = 'Cuando quieras'

  const canContinue = window !== null
  // A real time-window means the next tap fires the OS permission prompt.
  const willAskPermission = window !== null && window !== 'not_yet'

  // CTA label primes the permission: a real window names the action; a
  // neutral "Continuar" for 'not_yet' / no selection. From Ajustes this is
  // an edit, so the verb is "Guardar". ctaVariant="soft" + ctaTransform="none"
  // preserved.
  const continueLabel = fromSettings
    ? 'Guardar'
    : willAskPermission
      ? 'Activar mi lectura'
      : 'Continuar'

  // dotClock — slow 8 s ping-pong breath driving the resting state of
  // every ReadingCard's presence dot so the column reads as alive.
  const dotClock = useSharedValue(0)

  // Atmosphere clocks — created ONCE here so every atmosphere layer
  // (WarmBloomField, star strata + dust + warm wisps) breathes on the
  // SAME values (same periods as steps 1–10 → same compás):
  //   clock  5 s  warm-field breath
  //   dust  18 s  cosmic-dust drift + warm-wisp breath
  //   orbit 40 s  star-strata parallax
  const clock = useSharedValue(0)
  const dust = useSharedValue(0)
  const orbit = useSharedValue(0)

  useEffect(() => {
    dotClock.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    clock.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false)
    dust.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.linear }), -1, false)
    orbit.value = withRepeat(withTiming(1, { duration: 40000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(dotClock)
      cancelAnimation(clock)
      cancelAnimation(dust)
      cancelAnimation(orbit)
    }
  }, [dotClock, clock, dust, orbit])

  const handleContinue = async () => {
    if (!canContinue || !window) return
    setRequestingPermission(true)
    try {
      // Only fire the OS prompt when the user actually wants notifications.
      // 'not_yet' saves the preference + skips the ask — Stelar surfaces a
      // soft re-ask later, not now.
      if (window !== 'not_yet') {
        const settings = await Notifications.getPermissionsAsync()
        if (settings.status !== 'granted' && settings.canAskAgain) {
          const result = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
          })
          // DIGNIFIED handling — a 'denied' status is NOT an error. We do
          // NOT regañar, do NOT block: the user's WINDOW preference is
          // their intention and gets saved either way; the soft re-ask
          // lives in Ajustes. We only READ the status here.
          // DEBT: persisting a denied flag is deferred to the scheduling
          // deliverable — the scheduler will consult the OS permission at
          // runtime, so no schema field is added now.
          if (result.status !== 'granted') {
            console.warn('notification permission not granted:', result.status)
          }
        } else if (settings.status !== 'granted' && !settings.canAskAgain) {
          // The OS will not show a prompt (canAskAgain false). We advance
          // with dignity and do NOT claim we activated anything — the
          // window preference is still honoured, re-ask lives in Ajustes.
          // DEBT: same as above — no schema flag, runtime check later.
          console.warn('notification permission cannot be re-asked (canAskAgain false)')
        }
      }
      await updateProfile.mutateAsync({ notification_window: window })
      // From Ajustes this is an edit: pop back to Settings. In the wizard,
      // advance to the next step.
      if (fromSettings) router.back()
      else router.push('/onboarding/attribution')
    } catch (err) {
      // Permission errors are not blocking — we save the preference either
      // way so the user reaches reveal (or returns to Settings) and the ask
      // can resurface.
      console.warn('notification permission flow:', err)
      try {
        await updateProfile.mutateAsync({ notification_window: window })
      } catch {
        // Soft failure on the profile patch; reveal / Settings re-fetches.
      }
      if (fromSettings) router.back()
      else router.push('/onboarding/attribution')
    } finally {
      setRequestingPermission(false)
    }
  }

  return (
    <WizardLayout
      step={11}
      showProgress={false}
      // From Ajustes this is a re-entry edit, not a forward wizard step, so
      // we surface the back chevron (it pops to Settings via router.back()).
      // In the wizard the step has no back affordance (parity preserved).
      showBack={fromSettings}
      canContinue={canContinue}
      loading={requestingPermission || updateProfile.isPending}
      errorMessage={updateProfile.error?.message}
      onContinue={handleContinue}
      continueLabel={continueLabel}
      ctaVariant="soft"
      ctaTransform="none"
      atmosphere={
        <>
          {/* 1. Shared warm glow — pulled to cx58%/cy46% so the warmth sits
              behind the question, distinct from neighbouring steps. */}
          <AtmosphericSky glow={{ cx: '58%', cy: '46%', r: '68%' }} />
          {/* 2. Deep warm atmosphere — REUSED 'exposed-low-right' (pure
              reuse; this step is not adjacent to the step that used it, so
              no chaining concern — no new variant authored). */}
          <WarmBloomField clock={clock} variant="exposed-low-right" />
          {/* 3. Painted depth — WARM MAGENTA star strata + dust + two low
              warm wisps in counter-phase, full-screen, whisper-low, hidden
              from VoiceOver. NO focal anchor star (parity: no answer is
              celebrated with an astro). */}
          <NotificationsSky dust={dust} orbit={orbit} />
        </>
      }
    >
      {/* Scroll stage — the ScrollView plus two bg-coloured edge fades so the
          card column emerges from the sky at the top and dissolves back into
          it at the bottom. The fades are absolute siblings with pointerEvents
          none, so they never intercept taps. */}
      <View style={styles.scrollStage}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepHeader
            eyebrow={eyebrow}
            eyebrowColor="magenta"
            question="¿Cuándo quieres tu lectura del día?"
            questionEmphasis="lectura"
            hint="Una vez al día, en el momento que tú elijas. Puedes cambiarlo después."
          />

          {/* Single-select group — the four cards form ONE logical radiogroup
              so VoiceOver announces the mutual exclusion. The ReadingCards are
              role="radio". paddingHorizontal 14 gives the selected card's
              magenta shadow room (anti-clip). */}
          <View
            style={styles.optionsBlock}
            accessibilityRole="radiogroup"
            accessibilityLabel="¿Cuándo quieres tu lectura del día?"
          >
            {OPTIONS.map((opt) => {
              const selected = window === opt.value
              const isAnySelected = window !== null
              return (
                <ReadingCard
                  key={opt.value}
                  option={opt}
                  // 'not_yet' is set apart by AIR (a larger marginTop) — it
                  // is another logical category, NOT a lesser one. Same
                  // ignite, same dot, same serif italic as the others.
                  separated={opt.value === 'not_yet'}
                  selected={selected}
                  dim={isAnySelected && !selected}
                  onPress={() => setWindow(opt.value)}
                  clock={dotClock}
                />
              )
            })}
          </View>

          {/* Honest priming micro-copy — only when a real window is chosen.
              Disarms the surprise of the iOS dialog. Hidden for 'not_yet' /
              no selection. PENDING voice-and-copy sign-off. */}
          {willAskPermission ? (
            <Text style={styles.priming}>
              Al continuar, tu teléfono te preguntará si Stelar puede avisarte.
            </Text>
          ) : null}
        </ScrollView>

        {/* Top edge fade — bg (#0A0608) → transparent, pegado bajo el
            StepHeader. The cards emerge from the sky here. */}
        <LinearGradient
          colors={[colors.bg, 'rgba(10, 6, 8, 0)']}
          style={styles.fadeTop}
          pointerEvents="none"
        />
        {/* Bottom edge fade — transparent → bg (#0A0608), pegado al fondo del
            área scrolleable (sobre el CTA). The cards dissolve into the sky. */}
        <LinearGradient
          colors={['rgba(10, 6, 8, 0)', colors.bg]}
          style={styles.fadeBottom}
          pointerEvents="none"
        />
      </View>
    </WizardLayout>
  )
}

/* ─────────────────────── ReadingCard ─────────────────────── */

/** One reading-window card — a LOCAL clone of intention's IntentCard
 *  (the shared SelectableCard is deliberately NOT touched). The idle
 *  treatment is ALWAYS the solid bgCard + hairline (legibility over the
 *  cosmic backdrop); selection is layered on top as a 200 ms OPACITY
 *  crossfade of three absoluteFill layers (shadow / fill 0.12 / 1 px
 *  border), all sharing borderRadius 16. The scale spring (1.02), the
 *  text slide (translateX 4) and the dot breath (on dotClock) are
 *  unchanged. Maps option.label → label, option.description → tagline.
 *
 *  `separated` lifts the card with extra marginTop — for 'Aún no', which
 *  is another logical category. It is NOT visually penalised: same ignite,
 *  same dot, same serif italic. Set apart by SPACE only. */
function ReadingCard({
  option,
  separated,
  selected,
  dim,
  onPress,
  clock,
}: {
  option: ReadingOption
  separated: boolean
  selected: boolean
  dim: boolean
  onPress: () => void
  clock: SharedValue<number>
}) {
  // Scale spring — the tactile bounce on selection.
  const scale = useSharedValue(1)
  useEffect(() => {
    scale.value = withSpring(selected ? 1.02 : 1, { damping: 16, stiffness: 220 })
    return () => cancelAnimation(scale)
  }, [selected, scale])

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  // Glow crossfade — the selected card's magenta treatment fades IN/OUT on
  // OPACITY (200 ms / ease-out-quad). We never animate shadowRadius/Opacity
  // or border/fill colors numerically; dedicated layers carry the static
  // look and only their opacity tweens.
  const glow = useSharedValue(selected ? 1 : 0)
  useEffect(() => {
    glow.value = withTiming(selected ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad) })
    return () => cancelAnimation(glow)
  }, [selected, glow])
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }))

  // Label slides 4 px to the right when claimed.
  const textStyle = useAnimatedStyle(() => {
    'worklet'
    return { transform: [{ translateX: selected ? 4 : 0 }] }
  })

  // Tagline reveal — at rest a legible 0.92; on selection it climbs to full
  // presence. Opacity only, numeric, UI-thread safe.
  const taglineStyle = useAnimatedStyle(() => {
    'worklet'
    return { opacity: selected ? 1 : 0.92 }
  })

  // Idle dots breathe; selected dots ignite + grow.
  const dotStyle = useAnimatedStyle(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    const s = selected ? 1.25 : 1
    const breathDepth = selected ? 0.12 : 0.08
    return {
      transform: [{ scale: s * (1 + b * breathDepth) }],
      // dim 0.30: the non-selected options must read as "still available if
      // I picked wrong", not "closed / discarded".
      opacity: selected ? 1 : dim ? 0.3 : 0.42 + b * 0.12,
    }
  })

  return (
    <View style={separated ? styles.separatedGroup : undefined}>
      <Animated.View style={[styles.cardOuter, cardStyle]}>
        <Pressable
          onPress={onPress}
          accessibilityRole="radio"
          accessibilityLabel={option.label}
          accessibilityState={{ selected }}
          android_ripple={{ color: 'rgba(217, 39, 102, 0.18)', borderless: false }}
          style={({ pressed }) => [pressed && styles.cardPressed]}
        >
          {/* Idle card — ALWAYS solid bgCard + hairline so the label stays
              legible over the cosmic backdrop regardless of selection. */}
          <View style={styles.card}>
            {/* (a) Shadow layer — static magenta iOS shadow, crossfaded. */}
            <Animated.View style={[styles.cardGlowShadow, glowStyle]} pointerEvents="none" />
            {/* (b) Magenta fill — 0.12 tint, crossfaded in. */}
            <Animated.View style={[styles.cardGlowFill, glowStyle]} pointerEvents="none" />
            {/* (c) Magenta border — 1 px, crossfaded in over the hairline. */}
            <Animated.View style={[styles.cardGlowBorder, glowStyle]} pointerEvents="none" />

            <Animated.View
              style={[styles.dot, selected ? styles.dotOn : styles.dotOff, dotStyle]}
            />
            <Animated.View style={[styles.textCol, textStyle]}>
              <Text style={[styles.label, selected && styles.labelOn]}>{option.label}</Text>
              <Animated.Text style={[styles.tagline, selected && styles.taglineOn, taglineStyle]}>
                {option.description}
              </Animated.Text>
            </Animated.View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  )
}

/* ───────────────────── Full-screen star sky ────────────────────── */

// Star strata — a WARM clone of intention's IntentionSky, tinted toward
// magenta. x/y are 0→1 fractions of the screen; parallax amplitude grows
// toward the viewer (far 2px / mid 5px / micro 9px). Concentrated in the
// LOWER half so the depth pools under the cards, never behind their text.
// A few micro-stars are DISPLACED relative to step 10 so the field does not
// calque the sibling screen.
const FAR_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.12, y: 0.59, r: 0.6, opacity: 0.1 },
  { x: 0.9, y: 0.62, r: 0.7, opacity: 0.12 },
  { x: 0.7, y: 0.75, r: 0.6, opacity: 0.1 },
  { x: 0.46, y: 0.88, r: 0.5, opacity: 0.08 },
]

const MID_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.2, y: 0.63, r: 0.8, opacity: 0.24 },
  { x: 0.86, y: 0.77, r: 0.9, opacity: 0.26 },
  { x: 0.1, y: 0.8, r: 0.8, opacity: 0.24 },
  { x: 0.66, y: 0.67, r: 0.7, opacity: 0.2 },
]

// Micro-stars — nearest field, MAGENTA, halo + parallax. 2–3 of these are
// shifted vs step 10 (the 0.24→0.30 / 0.8→0.74 / 0.5→0.42 trio) so the
// screens don't calque each other.
const MICRO_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.3, y: 0.69, r: 1.1, opacity: 0.42 },
  { x: 0.74, y: 0.71, r: 1.0, opacity: 0.38 },
  { x: 0.42, y: 0.77, r: 0.9, opacity: 0.34 },
  { x: 0.16, y: 0.9, r: 1.0, opacity: 0.36 },
  { x: 0.86, y: 0.82, r: 0.85, opacity: 0.3 },
  { x: 0.6, y: 0.91, r: 0.8, opacity: 0.28 },
]

// DUST — 4 motes rising through the lower half. They whisper behind the
// cards without competing.
const DUST: {
  x: number
  baseR: number
  period: number
  sway: number
  opacity: number
  phase: number
}[] = [
  { x: 0.26, baseR: 0.9, period: 1.05, sway: 9, opacity: 0.36, phase: 0.1 },
  { x: 0.5, baseR: 1.0, period: 0.95, sway: 11, opacity: 0.42, phase: 0.5 },
  { x: 0.74, baseR: 0.7, period: 1.15, sway: 8, opacity: 0.32, phase: 0.3 },
  { x: 0.62, baseR: 0.75, period: 1.1, sway: 10, opacity: 0.28, phase: 0.2 },
]

/*
 * NotificationsSky — full-screen painted depth for step 11. A WARM clone
 * of intention's IntentionSky: three star strata + rising dust + two low
 * warm wisps, behind the content. The stars sit in the LOWER half (the
 * cards own the top, so the sky stays a whisper there). Differential
 * parallax (2/5/9px) on the 40 s orbit clock, dust + wisps on the 18 s
 * clock. All whisper-low alphas, pointerEvents none, hidden from VoiceOver.
 *
 * TINT — magenta cálido (micro-stars + far stratum magenta, mid stratum a
 * warm cream-neutral #E8D9DD so the field reads quiet, not neon).
 *
 * WARM WISPS — a wide-and-low primary magenta ellipse at cy 0.70 that
 * breathes on the dust clock, plus a SMALLER, fainter second ellipse at
 * cy 0.82 that breathes in COUNTER-PHASE on the SAME dust clock. Two crossing
 * layers give painted-vapor depth. Ambient only, NO free-floating focal star
 * to celebrate any one answer.
 *
 * Parallax/twinkle move ONLY a numeric translate(px px) + opacity — never an
 * animated r/length as a string % (re-resolves against the viewport every
 * frame → jank). Gradient ids are namespaced `notif-*` so they cannot collide
 * with step 10's `intencion-*` / earlier defs.
 */
function NotificationsSky({
  dust,
  orbit,
}: {
  dust: SharedValue<number>
  orbit: SharedValue<number>
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

  // ── Warm wisp breath — wide, low ellipse at cy 0.70. Opacity only,
  // numeric. Reuses the shared dust clock (no new shared value). ──
  const warmWispProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(dust.value * 2 * Math.PI)
    return { opacity: 0.04 + w * 0.02 }
  })

  // ── Second warm wisp (counter-phase) — smaller, lower (cy 0.82). As the
  // primary swells this recedes. Opacity only, reuses the dust clock. ──
  const warmWisp2Props = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 - 0.5 * Math.sin(dust.value * 2 * Math.PI)
    return { opacity: 0.025 + w * 0.015 }
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
              flat drawn dots. Namespaced `notif-*` to avoid collisions. */}
          <RadialGradient id="notif-starGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          {/* Warm wisp — magenta, faint, falls off to nothing. */}
          <RadialGradient id="notif-warmWisp" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.magenta} stopOpacity="0.06" />
            <Stop offset="1" stopColor={colors.magenta} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Warm wisp — wide-and-low ellipse at cy 0.70. Breathes faintly on
            the dust clock; depth without a free-floating focal point. */}
        <AnimatedEllipse
          cx={0.5 * SKY_W}
          cy={0.7 * SKY_H}
          rx={0.55 * SKY_W}
          ry={0.06 * SKY_H}
          fill="url(#notif-warmWisp)"
          animatedProps={warmWispProps}
        />

        {/* Second warm wisp — smaller, lower (cy 0.82), counter-phase breath
            on the SAME dust clock. Painted vapor depth, no focal anchor. */}
        <AnimatedEllipse
          cx={0.5 * SKY_W}
          cy={0.82 * SKY_H}
          rx={0.35 * SKY_W}
          ry={0.045 * SKY_H}
          fill="url(#notif-warmWisp)"
          animatedProps={warmWisp2Props}
        />

        {/* Cosmic dust rising through the lower half — magenta, dimmed. */}
        {DUST.map((d, i) => (
          <DustMote key={`sky-dust-${i}`} {...d} clock={dust} stage={SKY_H} fill={colors.magenta} />
        ))}

        {/* Far stars — distant stratum, faintly magenta, 2px parallax. */}
        <AnimatedG animatedProps={farDriftProps}>
          {FAR_STARS.map((s, i) => (
            <G key={`far-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.4}
                fill="url(#notif-starGlow)"
                opacity={s.opacity * 0.6}
              />
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r}
                fill={colors.magenta}
                opacity={s.opacity}
              />
            </G>
          ))}
        </AnimatedG>

        {/* Mid stars — middle depth, warm cream-neutral tint, 5px drift. */}
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

        {/* Micro stars — nearest field, MAGENTA, halo + 9px parallax + group
            twinkle. Halo first so the point sits on a glow. */}
        <AnimatedG animatedProps={microGroupProps}>
          {MICRO_STARS.map((s, i) => (
            <G key={`micro-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.5}
                fill="url(#notif-starGlow)"
                opacity={0.15}
              />
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r}
                fill={colors.magenta}
                opacity={s.opacity}
              />
            </G>
          ))}
        </AnimatedG>
      </Svg>
    </View>
  )
}

/* ─────────────────────── Styles ─────────────────────── */

const styles = StyleSheet.create({
  // Scroll stage — flex container so the two edge fades can sit as absolute
  // siblings over the ScrollView (not over the CTA, which lives in
  // WizardLayout below this content slot).
  scrollStage: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  // Top edge fade — bg → transparent, ~28px, pinned under the StepHeader so
  // the card column emerges from the sky. pointerEvents none so it never
  // intercepts taps.
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
  },
  // Bottom edge fade — transparent → bg, ~40px, pinned to the bottom of the
  // scroll area (above the CTA) so the cards dissolve into the sky.
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  optionsBlock: {
    marginTop: 28,
    // Inset horizontally so the selected card's magenta shadow has room to
    // project without being clipped by the ScrollView.
    paddingHorizontal: 14,
  },
  // 'Aún no' opens its own beat — extra top room sets it apart from the three
  // time-windows by SPACE. Distinction without decoration, NOT degradation.
  separatedGroup: {
    marginTop: 18,
  },
  cardOuter: {
    marginBottom: 10,
  },
  cardPressed: {
    opacity: 0.92,
  },
  /* Reading card — idle treatment is ALWAYS the solid bgCard + hairline
     (legibility over the cosmic backdrop); selection layers on via the glow
     layers below. The glow layers MUST match this borderRadius exactly (16)
     so no corner peeks. */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.bgCard,
    borderColor: colors.hairline,
  },
  // (a) Shadow layer — static magenta iOS shadow, opacity-crossfaded.
  cardGlowShadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    backgroundColor: 'transparent',
    shadowColor: colors.magenta,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  // (b) Magenta fill — 0.12 tint, crossfaded in over the idle bg.
  cardGlowFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    backgroundColor: 'rgba(217, 39, 102, 0.12)',
  },
  // (c) Magenta border — 1 px, crossfaded in over the hairline.
  cardGlowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.magenta,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 14,
  },
  dotOff: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  dotOn: {
    backgroundColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOpacity: 0.95,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  textCol: {
    flex: 1,
  },
  label: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.anchor,
    lineHeight: 22,
    color: colors.bone,
    letterSpacing: -0.3,
  },
  labelOn: {
    color: colors.leche,
  },
  tagline: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    lineHeight: 14,
    letterSpacing: 0.4,
    color: colors.niebla,
  },
  taglineOn: {
    color: '#F4ABC8',
  },
  // Priming micro-copy — utilitario (NOT coach voice → Hanken, not serif).
  // niebla/bone, centred, micro. Disarms the iOS dialog honestly.
  priming: {
    marginTop: 20,
    paddingHorizontal: 14,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    lineHeight: 16,
    color: colors.niebla,
    textAlign: 'center',
  },
})
