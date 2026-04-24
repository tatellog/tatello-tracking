import { View } from 'react-native'

import { Display, Editorial, Meta } from '@/design/typography'

type Props = {
  days: number
}

export function StreakHero({ days }: Props) {
  return (
    <View className="items-center border-t border-muted pt-6">
      <Meta>día</Meta>
      <Display className="mt-2">{days}</Display>
      <Editorial className="mt-3 text-secondary">sin romper la racha</Editorial>
    </View>
  )
}
