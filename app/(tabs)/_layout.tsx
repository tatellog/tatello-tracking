import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { View } from 'react-native'

import { BetaFeedbackButton } from '@/components/BetaFeedbackButton'
import { IgnitionToast } from '@/features/orbit/components/IgnitionToast'
import { AppTabBar } from '@/features/tabs/components'
import { colors } from '@/theme'

/* Tab glyphs. Library icons from `@expo/vector-icons`:
 *   • Feather (today, progress)
 *   • Ionicons (orbit)
 *   • MaterialIcons (meals)
 *
 * Each set has its own helper so the `name` prop stays strongly typed
 * to that set's glyph map. Shared focused-state treatment across all:
 *   • inactive  → opacity 0.45 + no scale     (recedes)
 *   • active    → opacity 1.0  + scale 1.08   (pops)
 *
 * Earlier iterations used custom SVGs from assets/icons (sol2 for Hoy,
 * progress-1 for Progreso, food-vect / orbit-vect for the rest). They
 * read too thin / pixel-noisy at tab scale; the library glyphs carry
 * weight out of the box. The legacy SVGs are no longer referenced from
 * this file — safe to delete if not used elsewhere. */
function FeatherTabIcon({
  name,
  size = 26,
  focused = false,
}: {
  name: React.ComponentProps<typeof Feather>['name']
  size?: number
  focused?: boolean
}) {
  return (
    <View
      style={{
        opacity: focused ? 1 : 0.45,
        transform: [{ scale: focused ? 1.08 : 1 }],
      }}
    >
      <Feather name={name} size={size} color={colors.leche} />
    </View>
  )
}

/* Same shell, Ionicons set — used for Órbita (`planet-outline`).
 * The outline variants match Feather's stroke weight closely enough
 * that the two read as the same icon family inside the pill. */
function IoniconsTabIcon({
  name,
  size = 26,
  focused = false,
}: {
  name: React.ComponentProps<typeof Ionicons>['name']
  size?: number
  focused?: boolean
}) {
  return (
    <View
      style={{
        opacity: focused ? 1 : 0.45,
        transform: [{ scale: focused ? 1.08 : 1 }],
      }}
    >
      <Ionicons name={name} size={size} color={colors.leche} />
    </View>
  )
}

/* Same shell, MaterialIcons set — used for Comidas (`dinner-dining`).
 * MaterialIcons carries Google's Material balance; the `dinner-dining`
 * glyph is a bowl with three steam lines — clean and unambiguous as
 * "meals". Feather has no food icon and Ionicons' food glyphs are
 * plates/burgers/etc., not bowls. */
function MaterialIconsTabIcon({
  name,
  size = 26,
  focused = false,
}: {
  name: React.ComponentProps<typeof MaterialIcons>['name']
  size?: number
  focused?: boolean
}) {
  return (
    <View
      style={{
        opacity: focused ? 1 : 0.45,
        transform: [{ scale: focused ? 1.08 : 1 }],
      }}
    >
      <MaterialIcons name={name} size={size} color={colors.leche} />
    </View>
  )
}

// The bottom chrome is a custom component (AppTabBar): a navigation
// pill plus a detached magenta ✦ that opens the quick-log. Screen
// options here only carry each tab's title + icon — AppTabBar reads
// them off the route descriptors. Ajustes is the exception: it has no
// icon here because it's not in the pill — it's the header gear, and
// AppTabBar skips its route.
export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <AppTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Hoy',
            tabBarIcon: ({ focused }) => <FeatherTabIcon name="sun" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="meals"
          options={{
            title: 'Comidas',
            tabBarIcon: ({ focused }) => (
              <MaterialIconsTabIcon name="dinner-dining" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progreso',
            tabBarIcon: ({ focused }) => <FeatherTabIcon name="activity" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="orbit"
          options={{
            title: 'Órbita',
            tabBarIcon: ({ focused }) => (
              <IoniconsTabIcon name="planet-outline" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Ajustes',
          }}
        />
      </Tabs>
      <BetaFeedbackButton />
      <IgnitionToast />
    </View>
  )
}
