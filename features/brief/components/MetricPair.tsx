import { Text, View } from 'react-native'

type Item = {
  label: string
  value: number | string
  unit?: string
}

type Props = {
  items: Item[]
}

export function MetricPair({ items }: Props) {
  return (
    <View className="flex-row gap-2">
      {items.map((item) => (
        <View key={item.label} className="flex-1 rounded-md bg-secondary p-4">
          <Text className="text-xs text-secondary">{item.label}</Text>
          <View className="mt-1 flex-row items-baseline">
            <Text className="text-lg font-medium text-primary">{item.value}</Text>
            {item.unit !== undefined && (
              <Text className="ml-1 text-sm text-tertiary">{item.unit}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  )
}
