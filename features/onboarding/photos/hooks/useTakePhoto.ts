import { useMutation, useQueryClient } from '@tanstack/react-query'

import { processAndUploadFromUri } from '@/features/onboarding/photos/api'
import type { PhotoAngle } from '@/features/onboarding/photos/hooks/usePhotosToday'
import { queryKeys } from '@/lib/queryKeys'

export function useTakePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uri, angle }: { uri: string; angle: PhotoAngle }) =>
      processAndUploadFromUri(uri, angle),
    onSuccess: () => {
      // Fire-and-forget — do NOT await. The spinner is tied to this
      // mutation's pending state, and awaiting the refetch (which re-signs
      // every photo URL) kept the spinner up for the whole round-trip AFTER
      // the upload already finished. Invalidate in the background; the
      // diptych fills in a beat later when the refetch lands.
      // `refetchType: 'all'` forces inactive queries to refetch too —
      // covers the case where the antes/después preview was mounted
      // earlier but is paused while the picker is up.
      void qc.invalidateQueries({ queryKey: queryKeys.photos.all, refetchType: 'all' })
    },
  })
}
