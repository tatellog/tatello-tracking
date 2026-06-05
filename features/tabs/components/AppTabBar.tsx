import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

import { QuickLogSheet } from './QuickLogSheet'

// A 4-point star with WIDE arms — reads as a "+" (add) AND keeps the
// "enciende una estrella" brand glyph (the deep-concave sparkle didn't say
// "create" to a first-time user; widening the waist toward a plus does,
// without throwing away the star). Same family as MealComposer/TodayMealLog.
const STAR_PATH = 'M12 2 L15.3 8.7 L21.5 12 L15.3 15.3 L12 22 L8.7 15.3 L2.5 12 L8.7 8.7 Z'
const PILL_HEIGHT = 62
const FAB_SIZE = 56

function StarGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={STAR_PATH} fill="#FFFFFF" />
    </Svg>
  )
}

/*
 * The create button — a magenta disc with the star glyph. Its job is
 * to read as *tappable* without a label:
 *   - a lighter rim + drop shadow give it a raised, button-like body;
 *   - a halo behind it breathes slowly, so it's a live element, not
 *     a flat sticker (matches the breathing glyphs elsewhere);
 *   - press drives a spring-y scale-down for a tactile click.
 * Reduced-motion users get the static disc — only the loop is gated.
 */
function QuickLogFab({ onPress }: { onPress: () => void }) {
  const reduceMotion = useReducedMotion()
  const breath = useSharedValue(0)
  const press = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) return
    breath.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [breath, reduceMotion])

  // Halo — a soft magenta disc behind the FAB, breathing in scale and
  // opacity. This is the "slight animation" and also pulls the eye.
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + breath.value * 0.24,
    transform: [{ scale: 1 + breath.value * 0.16 }],
  }))

  // The disc itself: a faint breath, then press scales it down.
  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: (1 + breath.value * 0.04) * (1 - press.value * 0.12) }],
  }))

  return (
    <Pressable
      onPressIn={() => {
        press.value = withTiming(1, { duration: 110 })
      }}
      onPressOut={() => {
        press.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.quad) })
      }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel="Registro rápido"
      accessibilityHint="Registra una comida, tu peso o tu agua"
      style={styles.fabColumn}
    >
      <View style={styles.fabWrap}>
        <Animated.View style={[styles.fabHalo, haloStyle]} pointerEvents="none" />
        <Animated.View style={[styles.fab, fabStyle]}>
          <StarGlyph size={23} />
        </Animated.View>
      </View>
      {/* Micro-label: the FAB was the only unnamed element in a bar where
          every tab is labelled — the word is what makes the ✦ legible as
          "create" to a first-time user. */}
      <Text style={styles.fabLabel}>Registrar</Text>
    </Pressable>
  )
}

/*
 * The app's bottom chrome — a navigation pill plus a detached create
 * button, two distinct jobs kept visually apart:
 *
 *   pill → navegar  (Hoy · Comidas · Órbita · Progreso)
 *   ✦    → crear    (quick-log de comida, desde cualquier tab)
 *
 * Ajustes is intentionally NOT in the pill — it's a gear button in
 * each tab's TabHeader. Settings is configuration, not a destination
 * you orbit between, so it doesn't share the navigation surface.
 *
 * The ✦ is NOT a tab: it doesn't change the route, it opens the
 * QuickLogSheet over whatever screen is showing. Keeping it outside
 * the pill is the whole point — creation isn't navigation, so it
 * doesn't share the navigation surface.
 */
export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const [quickLogVisible, setQuickLogVisible] = useState(false)

  return (
    <>
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.pill}>
          {state.routes.map((route, index) => {
            const descriptor = descriptors[route.key]
            if (!descriptor) return null
            // Ajustes is reached from the header gear, not the pill —
            // skip it here while keeping the route navigable.
            if (route.name === 'settings') return null
            const { options } = descriptor
            const label = options.title ?? route.name
            const focused = state.index === index
            const color = focused ? colors.magenta : colors.niebla

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              })
              if (!focused && !event.defaultPrevented) {
                // Light selection tick on tab change — the BitePal-style
                // tactile feel, consistent with the buttons that already
                // haptic. Respects the OS haptic setting; no-ops if off.
                Haptics.selectionAsync().catch(() => {})
                navigation.navigate(route.name)
              }
            }

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={[styles.tab, focused && styles.tabActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
              >
                {options.tabBarIcon?.({ focused, color, size: 40 })}
                <Text
                  style={[styles.label, { color, opacity: focused ? 1 : 0.5 }]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <QuickLogFab onPress={() => setQuickLogVisible(true)} />
      </View>

      <QuickLogSheet visible={quickLogVisible} onClose={() => setQuickLogVisible(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  // Solid canvas-coloured bar; the pill + FAB float as elements
  // within it. Screens render above this, exactly as with the
  // default tab bar — no per-screen scroll-inset retuning needed.
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  // The navigation pill — a stadium holding the four tabs. Bg
  // shifted to a magenta-tinted darker tone so it separates from
  // the page bg. Subtle black shadow for elevation (no longer a
  // magenta glow — that was overpowering and made the whole pill
  // halo brightly when combined with the active capsule). Border
  // opacity 0.22 so the perimeter reads as a clear surface edge.
  pill: {
    flex: 1,
    flexDirection: 'row',
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    backgroundColor: '#1A0810',
    borderWidth: 1,
    borderColor: 'rgba(244, 236, 222, 0.22)',
    padding: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: (PILL_HEIGHT - 10) / 2,
  },
  // Active tab — an inset magenta-tint capsule inside the pill,
  // bumped to magentaTint2 (0.18 opacity) so it reads clearly as
  // "this is the active one" without being loud.
  tabActive: {
    backgroundColor: colors.magentaTint2,
  },
  label: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  // FAB column = disc + its micro-label, centred against the pill.
  fabColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  // Micro-label under the FAB — same rhythm as the tab labels but magenta,
  // because it names the primary action (not a destination).
  fabLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.magenta,
  },
  // Layout box for the FAB — sized to the disc; the halo overflows it.
  fabWrap: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Breathing glow behind the disc — pulls the eye to the action.
  fabHalo: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.magenta,
  },
  // The create action — solid magenta disc with a lighter rim and a
  // drop shadow so it reads as a raised, pressable button.
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.magenta,
    borderWidth: 1.5,
    borderColor: colors.magentaHot,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.38,
    shadowRadius: 9,
    elevation: 5,
  },
})
