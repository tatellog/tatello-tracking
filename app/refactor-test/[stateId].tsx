import { Stack, useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { LunarConstellation } from '@/features/tabs/components'
import { findState } from '@/features/tabs/components/__fixtures__/lunar-constellation-states'
import { colors, typography } from '@/theme'

/*
 * Refactor safety-net detail screen (Paso 3) — full-canvas render of
 * a single deterministic LunarConstellation state. The route segment
 * (`stateId`) matches the keys used by the Jest snapshot test and the
 * filenames expected by scripts/visual-diff.sh.
 *
 * Route: /refactor-test/<state-id>
 *
 * Lifetime: lives for the duration of the strangler-fig refactor.
 */

export default function RefactorTestDetail() {
  const { stateId } = useLocalSearchParams<{ stateId: string }>()
  const state = stateId ? findState(stateId) : undefined

  if (!state) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <Stack.Screen options={{ title: 'unknown' }} />
          <Text style={styles.notFound}>state-id no encontrado: {stateId}</Text>
        </SafeAreaView>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: state.id }} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.meta}>
          <Text style={styles.id}>{state.id}</Text>
          <Text style={styles.detail}>
            sign={state.sign} · today={state.todayIdx} · committed=
            {String(state.committed)}
          </Text>
        </View>
        <View style={styles.canvasWrap}>
          <LunarConstellation
            trained={state.trained}
            todayIdx={state.todayIdx}
            sign={state.sign}
            committed={state.committed}
          />
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  meta: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(244,236,222,0.18)',
  },
  id: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  detail: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    color: colors.niebla,
    marginTop: 2,
  },
  // The canvas is centred + sized exactly as the Hoy tab renders it,
  // so visual-diff captures match production framing.
  canvasWrap: {
    width: '100%',
    marginTop: 8,
  },
  notFound: {
    padding: 20,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.magenta,
  },
})
