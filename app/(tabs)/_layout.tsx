import { Tabs } from 'expo-router'
import Svg, { Circle, Ellipse, Path } from 'react-native-svg'

import { AppTabBar } from '@/features/tabs/components'

type IconProps = {
  color: string
  size?: number
}

/* Tab glyphs. Each tab carries a crafted icon rather than a bare
 * outline — a filled core or node gives the set weight so it reads as
 * designed, not wireframe. Color comes from the tab's active/inactive
 * tint, applied as both stroke and fill. */

// Hoy — a sun: filled core, eight rays. "Today" as the day itself.
function SunIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Circle cx={12} cy={12} r={4.6} fill={color} />
      <Path
        d="M12 2v2.6M12 19.4V22M2 12h2.6M19.4 12H22M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M5.3 18.7L7 17"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  )
}

// Comidas — a bowl holding a star. The bowl reads unambiguously as
// food; the star inside anchors it to the celestial set and to the
// app's own metaphor — a meal is a star you light in your sky.
function MealBowlIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M3.4 10.5H20.6M5 10.5C5 16.2 8.2 19.6 12 19.6C15.8 19.6 19 16.2 19 10.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 11 13 13.1 15.1 14 13 14.9 12 17 11 14.9 8.9 14 11 13.1Z" fill={color} />
    </Svg>
  )
}

// Órbita — a core with a body orbiting it on a tilted ellipse. The
// app's central metaphor, distilled into a glyph.
function OrbitIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Ellipse
        cx={12}
        cy={12}
        rx={10}
        ry={4.4}
        stroke={color}
        strokeWidth={2}
        transform="rotate(-30 12 12)"
      />
      <Circle cx={12} cy={12} r={3.2} fill={color} />
      <Circle cx={20.7} cy={7} r={2.5} fill={color} />
    </Svg>
  )
}

// Progreso — a rising trend line with a bright node at its peak.
function TrendIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M3 17l6.5-6.5 4 3.5L20 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={20} cy={6} r={2.7} fill={color} />
    </Svg>
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
          tabBarIcon: ({ color, size }) => <SunIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: 'Comidas',
          tabBarIcon: ({ color, size }) => <MealBowlIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color, size }) => <TrendIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orbita"
        options={{
          title: 'Órbita',
          tabBarIcon: ({ color, size }) => <OrbitIcon color={color} size={size} />,
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
