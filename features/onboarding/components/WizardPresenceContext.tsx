import { createContext } from 'react'
import type { SharedValue } from 'react-native-reanimated'

/*
 * Shared "presence" breath for the onboarding flow.
 *
 * The cosmic backdrop (WizardBackdrop) is re-mounted PER SCREEN — each
 * onboarding step paints its own opaque backdrop so the slide
 * transition fully occludes the screen behind it (no double content,
 * no two "Continuar"). The deterministic starfield re-paints identical
 * pixels on every mount, so its remount is imperceptible. What DID pop
 * was Stelar's breathing presence mark: its own useSharedValue(0) reset
 * to 0 on every screen, restarting the breath cycle mid-animation.
 *
 * The fix: the onboarding Stack layout (which persists for the whole
 * flow) owns ONE presence shared value, runs its breath loop once, and
 * provides it here. Every WizardBackdrop consumes this value instead of
 * creating its own, so the breath is continuous across navigations.
 *
 * Fallback: when there is no provider (WizardBackdrop used outside the
 * onboarding flow) the value is null and WizardBackdrop creates + drives
 * its own local shared value, so it never breaks.
 */
export const WizardPresenceContext = createContext<SharedValue<number> | null>(null)
