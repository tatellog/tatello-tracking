import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

type IconProps = {
  color: string
  size?: number
}

// Stroke-only icons so the tab's active/inactive tint controls the
// glyph color without per-icon overrides.
function StarIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M12 3v2M5.6 5.6l1.4 1.4M3 12h2m1.4 6.4l1.4-1.4M12 21v-2m6.4 1.4l-1.4-1.4M21 12h-2m-1.4-6.4l-1.4 1.4"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={1.8} />
    </Svg>
  )
}

function CircleIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={1.8} />
    </Svg>
  )
}

function DiamondsIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M12 4l-4 4 4 4 4-4-4-4zm0 8l-4 4 4 4 4-4-4-4z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function SettingsIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.8} />
    </Svg>
  )
}

// `backdrop-filter: blur(12px)` from the prototype isn't cross-platform
// in RN; a flat dark bg reads the same against the canvas without
// the per-frame blur cost.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.magenta,
        tabBarInactiveTintColor: colors.niebla,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 86 : 72,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 22 : 10,
        },
        tabBarItemStyle: {
          gap: 4,
        },
        tabBarLabelStyle: {
          fontFamily: typography.uiBold,
          fontSize: 9.5,
          letterSpacing: 1.7,
          textTransform: 'uppercase',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoy',
          tabBarIcon: ({ color }) => <StarIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: 'Comidas',
          tabBarIcon: ({ color }) => <CircleIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color }) => <DiamondsIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <SettingsIcon color={color} />,
        }}
      />
    </Tabs>
  )
}
