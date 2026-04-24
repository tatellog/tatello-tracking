import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { duration } from '@/design/motion'
import { Editorial, Headline, Meta } from '@/design/typography'
import { ThemePicker } from '@/features/settings/components/ThemePicker'

const enter = (delayMs: number) =>
  FadeInDown.duration(duration.slow).delay(delayMs).springify().damping(18)

export default function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-4 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={enter(0)}>
          <Headline>ajustes</Headline>
          <Meta className="mt-1">tracking-app · v1.0.0</Meta>
        </Animated.View>

        <View className="mt-10 gap-3">
          <Animated.View entering={enter(100)}>
            <Editorial>apariencia</Editorial>
          </Animated.View>
          <Animated.View entering={enter(180)}>
            <ThemePicker />
          </Animated.View>
        </View>

        <Animated.View entering={enter(280)} className="mt-16 items-center">
          <Editorial className="text-center">un acto silencioso cada mañana</Editorial>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}
