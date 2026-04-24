import { Tabs } from 'expo-router'
import { Text } from 'react-native'

import { colors, typography } from '@/theme'

type IconProps = {
  color: string
  glyph: string
}

/* Unicode-glyph icons — renders with the same typography system as
 * everything else, no vector-icon package roundtrip. */
function TabIcon({ color, glyph }: IconProps) {
  return <Text style={{ color, fontSize: 16 }}>{glyph}</Text>
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.copperVivid,
        tabBarInactiveTintColor: colors.goldSoft,
        tabBarStyle: {
          backgroundColor: colors.creamSoft,
          borderTopColor: colors.goldAlpha10,
          borderTopWidth: 0.5,
          height: 72,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontFamily: typography.prose,
          fontSize: typography.sizes.smallLabel + 1,
          fontStyle: 'italic',
          letterSpacing: typography.letterSpacing.softLabel,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoy',
          tabBarIcon: ({ color }) => <TabIcon color={color} glyph="☀" />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color }) => <TabIcon color={color} glyph="◇" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <TabIcon color={color} glyph="○" />,
        }}
      />
    </Tabs>
  )
}
