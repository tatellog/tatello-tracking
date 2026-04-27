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
        tabBarActiveTintColor: colors.mauveDeep,
        tabBarInactiveTintColor: colors.labelDim,
        tabBarStyle: {
          backgroundColor: colors.pearlBase,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: 0.5,
          height: 72,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontFamily: typography.uiMedium,
          fontSize: typography.sizes.smallLabel,
          fontWeight: typography.fontWeight.medium,
          letterSpacing: typography.letterSpacing.bodyLoose,
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
        name="meals"
        options={{
          title: 'Comidas',
          tabBarIcon: ({ color }) => <TabIcon color={color} glyph="🍽" />,
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
