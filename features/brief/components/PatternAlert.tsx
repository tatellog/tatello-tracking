import { View } from 'react-native'

import { Body, Editorial } from '@/design/typography'

type Props = {
  detected: boolean
  message: string
}

export function PatternAlert({ detected, message }: Props) {
  if (!detected) return null

  return (
    <View className="rounded-lg border border-accent-warm/30 bg-accent-warm-soft p-5">
      <Editorial className="text-accent-warm-strong">una nota para ti</Editorial>
      <Body className="mt-3">{message}</Body>
    </View>
  )
}
