import { Feather } from '@expo/vector-icons'
import { Image, View } from 'react-native'
import type { ImageSourcePropType } from 'react-native'

import { useColors } from '@/design/tokens'
import { Editorial, Meta, Title } from '@/design/typography'
import { formatDelta } from '@/features/brief/format'

type Props = {
  before?: ImageSourcePropType
  after?: ImageSourcePropType
  beforeLabel: string
  afterLabel: string
  weightDeltaKg: number
  waistDeltaCm: number
  periodWeeks: number
}

/*
 * Before/after as polaroid mount: each photo sits on an ivory mat with extra
 * bottom padding for a caption, like an album page. When no photo is set
 * yet, the slot renders an intentional empty state (dashed inset + camera
 * glyph + 'añade tu primera foto') instead of looking like broken UI.
 */
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
        <PolaroidPhoto source={before} label={beforeLabel} />
        <PolaroidPhoto source={after} label={afterLabel} />
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

function PolaroidPhoto({ source, label }: { source?: ImageSourcePropType; label: string }) {
  return (
    <View className="flex-1 rounded-lg border border-subtle bg-paper p-2.5 pb-3">
      {source ? (
        <View className="overflow-hidden rounded-sm bg-sunken">
          <Image source={source} resizeMode="cover" className="aspect-[3/4] w-full" />
        </View>
      ) : (
        <EmptySlot />
      )}
      <Editorial className="mt-3 text-center">{label}</Editorial>
    </View>
  )
}

function EmptySlot() {
  const colors = useColors()
  return (
    <View className="aspect-[3/4] w-full items-center justify-center rounded-sm border border-dashed border-subtle bg-sunken/20 px-4">
      <Feather name="camera" size={22} color={colors.content.tertiary} />
      <Editorial className="mt-3 text-center">Añade tu primera foto</Editorial>
    </View>
  )
}
