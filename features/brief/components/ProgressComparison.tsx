import { Image, Text, View } from 'react-native'
import type { ImageSourcePropType } from 'react-native'

import { Editorial, Meta, Title } from '@/design/typography'
import { formatDelta } from '@/features/brief/format'

type Props = {
  before: ImageSourcePropType
  after: ImageSourcePropType
  beforeLabel: string
  afterLabel: string
  weightDeltaKg: number
  waistDeltaCm: number
  periodWeeks: number
}

export function ProgressComparison({
  before,
  after,
  beforeLabel,
  afterLabel,
  weightDeltaKg,
  waistDeltaCm,
  periodWeeks,
}: Props) {
  return (
    <View>
      <View className="flex-row gap-3">
        <Photo source={before} label={beforeLabel} />
        <Photo source={after} label={afterLabel} />
      </View>

      <View className="mt-5 flex-row items-baseline justify-between">
        <View>
          <Title>{formatDelta(weightDeltaKg, 'kg')}</Title>
          <Meta className="mt-1">peso</Meta>
        </View>
        <View className="items-end">
          <Title>{formatDelta(waistDeltaCm, 'cm')}</Title>
          <Meta className="mt-1">cintura</Meta>
        </View>
      </View>

      <Editorial className="mt-4 text-secondary">en {periodWeeks} semanas</Editorial>
    </View>
  )
}

function Photo({ source, label }: { source: ImageSourcePropType; label: string }) {
  return (
    <View className="relative flex-1 overflow-hidden rounded-lg border border-subtle bg-sunken">
      <Image source={source} resizeMode="cover" className="aspect-[3/4] w-full" />
      <View className="absolute bottom-3 left-3 rounded-sm bg-canvas/85 px-2 py-1">
        <Text className="font-serif-italic text-xs text-primary">{label}</Text>
      </View>
    </View>
  )
}
