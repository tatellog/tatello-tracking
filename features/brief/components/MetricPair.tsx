import { Text, View } from 'react-native'

import { Editorial, Meta, Title } from '@/design/typography'

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
    <View>
      <Editorial>Esta mañana</Editorial>
      <View className="mt-3 flex-row">
        {items.map((item, idx) => (
          <View
            key={item.label}
            className={idx === 0 ? 'flex-1 border-r border-muted pr-4' : 'flex-1 pl-4'}
          >
            <View className="flex-row items-baseline">
              <Title>{item.value}</Title>
              {item.unit !== undefined && (
                <Text className="ml-1 font-sans text-sm text-tertiary">{item.unit}</Text>
              )}
            </View>
            <Meta className="mt-1">{item.label}</Meta>
          </View>
        ))}
      </View>
    </View>
  )
}
