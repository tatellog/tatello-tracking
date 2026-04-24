import { Image, Text, View } from 'react-native'
import type { ImageSourcePropType } from 'react-native'

import { formatProgressDeltas } from '@/features/brief/format'

import { SectionLabel } from './SectionLabel'

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
      <SectionLabel>TU PROGRESO</SectionLabel>
      <View className="mt-3 flex-row gap-2">
        <Photo source={before} label={beforeLabel} />
        <Photo source={after} label={afterLabel} />
      </View>
      <Text className="mt-3 text-center text-sm text-secondary">
        {formatProgressDeltas({ weightDeltaKg, waistDeltaCm, periodWeeks })}
      </Text>
    </View>
  )
}

function Photo({ source, label }: { source: ImageSourcePropType; label: string }) {
  return (
    <View className="relative flex-1">
      <Image source={source} resizeMode="cover" className="aspect-[3/4] w-full rounded-md" />
      <View className="absolute bottom-2 left-2 rounded-sm bg-white/85 px-2 py-1">
        <Text className="text-xs text-primary">{label}</Text>
      </View>
    </View>
  )
}
