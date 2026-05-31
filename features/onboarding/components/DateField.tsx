import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { createElement, useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { colors, typography } from '@/theme'

type Props = {
  /** Label drawn above the field. */
  label: string
  /** Selected date, or null when the user hasn't picked yet. */
  value: Date | null
  onChange: (next: Date) => void
  /** Date shown by the picker until the user makes a choice. */
  defaultDate?: Date
  minDate?: Date
  maxDate?: Date
  /** Optional placeholder shown when value is null. */
  placeholder?: string
  /**
   * Optional explicit accessibility label for the trigger button. When
   * omitted, the label is derived from `label` ("Elegir <label>…").
   */
  accessibilityLabel?: string
  /**
   * Reports the native picker open/close so a parent can react (e.g.
   * dim the atmosphere / scroll the spinner into view). No-op default,
   * so existing call sites are unaffected.
   */
  onPickerToggle?: (open: boolean) => void
}

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

function formatDateLong(d: Date): string {
  const month = SPANISH_MONTHS[d.getMonth()] ?? 'ene'
  return `${d.getDate()} ${month} ${d.getFullYear()}`
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/*
 * A generic single-date field used by onboarding steps beyond DOB.
 * Same interaction shape as DateOfBirthInput (so the wizard stays
 * coherent), but accepts an arbitrary label. iOS uses the inline
 * spinner; Android the native dialog; web a `type=date` input.
 *
 * IGNITION (illustrator elevation, uxui override): the underline is no
 * longer a flat 2 px line that only swaps colour. It "lights up" like a
 * constellation point — the SAME vocabulary as about-you's ActiveHairline:
 *
 *   · idle (no value, picker closed) → a VERY faint hairline
 *     (rgba(255,255,255,0.06), ~1.5 px). NOT borderless: next to the
 *     Stepper's framed buttons, a line-less field would read as loose
 *     text. The tenuous line keeps it legible as an input.
 *   · filled (value, picker closed)  → the line ignites to magenta with a
 *     resting magentaHot halo (shadowOpacity 0.35 / radius 4).
 *   · picker open                    → the halo strengthens
 *     (shadowOpacity 0.6 / radius 7).
 *
 * Idle→filled crossfades on withTiming(200 ms, ease-out-quad). The
 * animated channel is ONLY opacity (numeric, UI-thread safe) — we never
 * animate shadowRadius/shadowOpacity; two static-strength halo layers
 * (rest / focus) crossfade instead. On Android, View shadows don't blur →
 * graceful degrade to the flat magenta line (iOS is the validation target).
 *
 * LABEL (uxui override #5): the label is sentence-case Hanken upright
 * (uiMedium, letterSpacing ~0.2, bone) — a clear, human field label, NOT
 * uppercase technical tracking. Sensitive themes (e.g. menstruation in
 * cycle) read warmer this way. COPY of the label string itself is the
 * caller's responsibility (pending behavioral / voice-and-copy sign-off).
 */
export function DateField({
  label,
  value,
  onChange,
  defaultDate,
  minDate,
  maxDate,
  placeholder = 'Toca para elegir',
  accessibilityLabel,
  onPickerToggle,
}: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const seed = value ?? defaultDate ?? new Date()

  const filled = value !== null
  const triggerLabel = accessibilityLabel ?? `Elegir ${label.toLowerCase()}`

  const togglePicker = () => {
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
    if (next) onChange(next)
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        <WebDateInput
          value={value ? toISODate(value) : ''}
          min={minDate ? toISODate(minDate) : undefined}
          max={maxDate ? toISODate(maxDate) : undefined}
          onChange={(iso) => {
            const parsed = parseISODate(iso)
            if (parsed) onChange(parsed)
          }}
        />
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={togglePicker}
        style={styles.tapTarget}
        accessibilityRole="button"
        accessibilityLabel={triggerLabel}
        // Expose the formatted date so VoiceOver reads "12 ago 2024",
        // not just "botón, elegir…". Closes an a11y regression.
        accessibilityValue={value ? { text: formatDateLong(value) } : undefined}
      >
        <Text style={[styles.value, filled ? styles.valueFilled : styles.valuePlaceholder]}>
          {value ? formatDateLong(value) : placeholder}
        </Text>
      </Pressable>
      <ActiveHairline filled={filled} pickerOpen={showPicker} />
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

/* ─────────────────────── ActiveHairline ─────────────────────── */

/*
 * The field underline that "ignites". Three stacked layers in a fixed
 * 1.5 px footprint:
 *   · idle line  — a very faint always-on hairline (0.06 white) so the
 *     field never reads as loose text next to framed controls.
 *   · magenta line — crossfades IN over the idle line when filled/open.
 *   · two halo layers (rest 0.35/r4, focus 0.6/r7) — magentaHot iOS
 *     shadows whose OPACITY is the only animated channel.
 *
 * We drive two 0→1 shared values (lineGlow = idle→magenta + resting halo;
 * focusGlow = the stronger picker-open halo) on withTiming(200 ms,
 * ease-out-quad). Each is cancelled on unmount.
 */
function ActiveHairline({ filled, pickerOpen }: { filled: boolean; pickerOpen: boolean }) {
  const active = filled || pickerOpen

  // lineGlow: the magenta line + resting halo (shown when the field is
  // filled OR the picker is open). focusGlow: the stronger halo that only
  // adds while the picker is open.
  const lineGlow = useSharedValue(active ? 1 : 0)
  const focusGlow = useSharedValue(pickerOpen ? 1 : 0)

  useEffect(() => {
    const cfg = { duration: 200, easing: Easing.out(Easing.quad) }
    lineGlow.value = withTiming(active ? 1 : 0, cfg)
    focusGlow.value = withTiming(pickerOpen ? 1 : 0, cfg)
    return () => {
      cancelAnimation(lineGlow)
      cancelAnimation(focusGlow)
    }
  }, [active, pickerOpen, lineGlow, focusGlow])

  const lineStyle = useAnimatedStyle(() => ({ opacity: lineGlow.value }))
  const focusStyle = useAnimatedStyle(() => ({ opacity: focusGlow.value }))

  return (
    <View style={styles.hairlineWrap} pointerEvents="none">
      {/* Idle hairline — always present, very faint. */}
      <View style={styles.hairlineIdle} />
      {/* Magenta line + resting halo — crossfades in when active. */}
      <Animated.View style={[styles.hairlineGlow, styles.hairlineGlowRest, lineStyle]} />
      {/* Stronger halo — adds only while the picker is open. */}
      <Animated.View style={[styles.hairlineGlow, styles.hairlineGlowFocus, focusStyle]} />
    </View>
  )
}

function parseISODate(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return null
  const [, y, mo, d] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? null : date
}

function WebDateInput({
  value,
  min,
  max,
  onChange,
}: {
  value: string
  min: string | undefined
  max: string | undefined
  onChange: (iso: string) => void
}) {
  return createElement('input', {
    type: 'date',
    value,
    min,
    max,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    style: {
      fontFamily: typography.uiBold,
      fontSize: typography.sizes.segmentTitle,
      letterSpacing: -0.5,
      color: colors.leche,
      backgroundColor: 'transparent',
      border: 'none',
      borderBottom: `1.5px solid rgba(255,255,255,0.06)`,
      padding: '10px 0',
      outline: 'none',
      width: '100%',
      colorScheme: 'dark',
    },
  })
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  // Sentence-case Hanken upright (uxui override #5) — a clear, human field
  // label, not uppercase technical tracking. bone for warm legibility.
  label: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
    letterSpacing: 0.2,
  },
  // 44 pt min so the whole line is a comfortable touch target, not just
  // the height of the typed value.
  tapTarget: {
    minHeight: 44,
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 10,
  },
  value: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.segmentTitle,
    letterSpacing: -0.5,
  },
  // Filled value — leche, NO warm halo. The about-you fields glow the
  // value because a name/birthday is celebratory; here the date is a
  // MENSTRUAL datum (behavioral): the ignited hairline alone already
  // says "filled" — a second magenta glow over the value would read a
  // grade too celebratory on a sensitive datum, so the value stays flat
  // light. (Sensitivity pass; the hairline carries the ignition.)
  valueFilled: {
    color: colors.leche,
  },
  // Placeholder — bone (not bruma): bruma/niebla over bg fall below
  // 4.5:1; bone (#C9B8A5) clears it comfortably (~9:1) while staying
  // warmer than cold white. The empty field reads as a warm invitation.
  valuePlaceholder: {
    color: colors.bone,
  },
  /* Hairline stack — the idle line + the magenta line + two crossfading
     halo layers, all sharing one 1.5 px footprint at the field's foot. */
  hairlineWrap: {
    height: 1.5,
  },
  // Idle hairline — always on, very faint, so the field never reads as
  // loose text next to the Stepper's framed controls.
  hairlineIdle: {
    ...StyleSheet.absoluteFillObject,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  // Magenta line + halo — opacity is the ONLY animated channel. Two
  // static-strength variants (rest / focus) crossfade so neither
  // shadowOpacity nor shadowRadius is animated. Android: shadow doesn't
  // blur → degrades to the flat magenta line (iOS is the validation target).
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
  picker: {
    marginTop: 4,
    alignSelf: 'stretch',
  },
})
