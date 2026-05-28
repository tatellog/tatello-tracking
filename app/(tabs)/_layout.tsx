import { Tabs } from 'expo-router'
import { View } from 'react-native'

import FoodIcon from '@/assets/icons/food-vect.svg'
import OrbitIcon from '@/assets/icons/orbit-vect.svg'
import ProgressIcon from '@/assets/icons/progress-vect.svg'
import TodayIcon from '@/assets/icons/today-vect.svg'
import { AppTabBar } from '@/features/tabs/components'

type IconProps = {
  color: string
  size?: number
  focused?: boolean
}

/* Tab glyphs. Illustrated white vectors from assets/icons.
 * Hierarchy treatment:
 *   • inactive  → opacity 0.45 + no scale     (recedes)
 *   • active    → opacity 1.0  + scale 1.08   (pops)
 *
 * `bold` prop renders the icon 5 times at sub-pixel offsets
 * (centre + 4 cardinals) for faux-thicker linework. Used for
 * thin-line icons (today, progress) where the raw SVG strokes
 * read too thin against the dark pill bg. */
function TabIcon({
  Component,
  size = 32,
  focused = false,
  bold = false,
}: IconProps & {
  Component: React.ComponentType<{
    width: number
    height: number
    preserveAspectRatio?: string
  }>
  bold?: boolean
}) {
  const icon = <Component width={size} height={size} preserveAspectRatio="xMidYMid meet" />
  return (
    <View
      style={{
        opacity: focused ? 1 : 0.45,
        transform: [{ scale: focused ? 1.08 : 1 }],
      }}
    >
      {bold ? (
        <View style={{ width: size, height: size }}>
          <View style={{ position: 'absolute', left: -0.7, top: 0 }}>{icon}</View>
          <View style={{ position: 'absolute', left: 0.7, top: 0 }}>{icon}</View>
          <View style={{ position: 'absolute', left: 0, top: -0.7 }}>{icon}</View>
          <View style={{ position: 'absolute', left: 0, top: 0.7 }}>{icon}</View>
          {icon}
        </View>
      ) : (
        icon
      )}
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
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Component={TodayIcon} color={color} size={size} focused={focused} bold />
          ),
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: 'Comidas',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Component={FoodIcon} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Component={ProgressIcon} color={color} size={size} focused={focused} bold />
          ),
        }}
      />
      <Tabs.Screen
        name="orbit"
        options={{
          title: 'Órbita',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Component={OrbitIcon} color={color} size={size} focused={focused} />
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
  )
}
