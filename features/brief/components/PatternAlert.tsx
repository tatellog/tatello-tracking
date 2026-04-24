import { Text, View } from 'react-native'

type Props = {
  detected: boolean
  message: string
}

export function PatternAlert({ detected, message }: Props) {
  if (!detected) return null

  return (
    <View className="rounded-md bg-amber-soft p-4">
      <Text className="text-xs uppercase tracking-widest text-amber-strong">PATRÓN</Text>
      <Text className="mt-2 text-sm leading-relaxed text-amber-strong">{message}</Text>
    </View>
  )
}
