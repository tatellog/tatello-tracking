import { Text, View } from 'react-native'

import { SectionLabel } from './SectionLabel'

type Props = {
  days: number
}

export function StreakHero({ days }: Props) {
  return (
    <View className="items-center">
      <SectionLabel>RACHA</SectionLabel>
      <Text className="mt-3 text-6xl font-medium text-primary">{days}</Text>
      <Text className="mt-2 text-sm text-secondary">días entrenando seguido</Text>
    </View>
  )
}
