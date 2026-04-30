import { View } from 'react-native'

import type { PhotoAngle } from '@/features/onboarding/photos/hooks/usePhotosToday'

import { SilhouetteBack } from './SilhouetteBack'
import { SilhouetteFront } from './SilhouetteFront'
import { SilhouetteSide } from './SilhouetteSide'

type Props = {
  angle: PhotoAngle
}

/*
 * Picks the right silhouette for the angle. side_left reuses the
 * side_right SVG mirrored horizontally so the user only sees the
 * artwork from one direction; the mirror keeps the head looking
 * left vs. right consistent with the camera's preview.
 */
export function SilhouetteRenderer({ angle }: Props) {
  switch (angle) {
    case 'front':
      return <SilhouetteFront />
    case 'side_right':
      return <SilhouetteSide />
    case 'side_left':
      return (
        <View style={{ transform: [{ scaleX: -1 }] }}>
          <SilhouetteSide />
        </View>
      )
    case 'back':
      return <SilhouetteBack />
  }
}
