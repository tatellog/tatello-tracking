import { View } from 'react-native'

import { Display, Editorial } from '@/design/typography'

type Props = {
  days: number
}

/*
 * Closing block — the streak reads as a sentence: big numeric hero, then a
 * plain-spoken subtitle. Singular/plural tail handles day 1 correctly.
 */
export function StreakHero({ days }: Props) {
  const tail = days === 1 ? 'día sin faltar' : 'días sin faltar'

  return (
    <View className="items-center border-t border-muted pt-6">
      <Display>{days}</Display>
      <Editorial className="mt-3 text-secondary">{tail}</Editorial>
    </View>
  )
}
