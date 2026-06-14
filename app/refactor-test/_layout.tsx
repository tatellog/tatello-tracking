import { Redirect, Stack } from 'expo-router'

import { useDevAllowed } from '@/components/withDevGuard'
import { colors, typography } from '@/theme'

/*
 * Refactor-test layout — opts INTO the stack header for this subtree
 * so the detail screen ([stateId].tsx) gets a back button + breadcrumb
 * automatically. The rest of the app keeps headerShown=false from the
 * root layout.
 *
 * Lifetime: removed when /refactor-test is deleted at F24.
 */
export default function RefactorTestLayout() {
  // Solo dev / is_dev — esta subárbol no debe ser navegable en producción.
  const allowed = useDevAllowed()
  if (allowed === null) return null
  if (!allowed) return <Redirect href="/" />
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.leche,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: typography.uiBold,
          fontSize: typography.sizes.label,
        },
        headerBackTitle: 'atrás',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'REFACTOR-TEST' }} />
      <Stack.Screen name="[stateId]" />
    </Stack>
  )
}
