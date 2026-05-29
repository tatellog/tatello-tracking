import { useMemo } from 'react'
import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { Circle, G, Path } from 'react-native-svg'

import { AnimatedG } from '../../animation/animated-components'
import { AMBIENT_BUCKET_COUNT } from '../../constants'
import { BUCKET_DRIFT, buildAmbientField } from '../../data/scatter'
import { fourPointStarPath } from '../../geometry'
import type { AmbientStar } from '../../types'

export function AmbientField({ t, drift }: { t: SharedValue<number>; drift: SharedValue<number> }) {
  const buckets = useMemo(() => buildAmbientField(), [])
  return (
    <G>
      {buckets.map((stars, bucketIdx) => (
        <AmbientBucket key={bucketIdx} stars={stars} bucketIdx={bucketIdx} t={t} drift={drift} />
      ))}
    </G>
  )
}

function AmbientBucket({
  stars,
  bucketIdx,
  t,
  drift,
}: {
  stars: AmbientStar[]
  bucketIdx: number
  t: SharedValue<number>
  drift: SharedValue<number>
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const phase = bucketIdx / AMBIENT_BUCKET_COUNT
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    const b = BUCKET_DRIFT[bucketIdx % BUCKET_DRIFT.length]!
    const a = (drift.value + b.phase) * 2 * Math.PI
    return {
      opacity: 0.35 + 0.65 * wave,
      transform: [{ translateX: Math.sin(a) * b.ax }, { translateY: Math.cos(a) * b.ay }],
    }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      {stars.map((s, i) =>
        s.sparkle ? (
          <Path
            key={i}
            d={fourPointStarPath(s.x, s.y, s.r * 2.4)}
            fill="#F4ECDE"
            opacity={s.baseOp * 4}
          />
        ) : (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F4ECDE" opacity={s.baseOp * 4} />
        ),
      )}
    </AnimatedG>
  )
}
