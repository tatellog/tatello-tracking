import { Text, View } from 'react-native'

import { Body, Editorial } from '@/design/typography'

type Props = {
  detected: boolean
  message: string
}

/*
 * Pattern alert as pulled quote: oversized opening double-quote decorates the
 * card from the left gutter; the note reads as if someone pinned a hand-
 * written slip to the page. The quote mark is muted (alpha 35%) so it feels
 * decorative rather than punctuation.
 */
export function PatternAlert({ detected, message }: Props) {
  if (!detected) return null

  return (
    <View className="flex-row gap-4 rounded-lg border border-accent-warm/30 bg-accent-warm-soft p-5">
      <Text
        className="font-serif text-accent-warm-strong/35"
        style={{ fontSize: 72, lineHeight: 64 }}
      >
        “
      </Text>
      <View className="flex-1 pt-3">
        <Editorial className="text-accent-warm-strong">Una nota para ti</Editorial>
        <Body className="mt-2">{message}</Body>
      </View>
    </View>
  )
}
