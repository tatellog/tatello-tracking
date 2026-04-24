import { Feather } from '@expo/vector-icons'
import { Tabs } from 'expo-router'

import { fontFamily, useColors } from '@/design/tokens'

export default function TabsLayout() {
  const color = useColors()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.accent.warm,
        tabBarInactiveTintColor: color.content.tertiary,
        tabBarStyle: {
          backgroundColor: color.surface.canvas,
          borderTopColor: color.border.subtle,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: fontFamily.serifItalic,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'brief',
          tabBarIcon: ({ color: c, size }) => <Feather name="sunrise" color={c} size={size} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'progreso',
          tabBarIcon: ({ color: c, size }) => <Feather name="activity" color={c} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'ajustes',
          tabBarIcon: ({ color: c, size }) => <Feather name="user" color={c} size={size} />,
        }}
      />
    </Tabs>
  )
}
