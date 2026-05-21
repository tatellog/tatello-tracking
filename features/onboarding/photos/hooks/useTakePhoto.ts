import { useMutation, useQueryClient } from '@tanstack/react-query'

import { processAndUploadFromUri } from '@/features/onboarding/photos/api'
import type { PhotoAngle } from '@/features/onboarding/photos/hooks/usePhotosToday'
import { queryKeys } from '@/lib/queryKeys'

export function useTakePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uri, angle }: { uri: string; angle: PhotoAngle }) =>
      processAndUploadFromUri(uri, angle),
    onSuccess: async () => {
      // `refetchType: 'all'` forces inactive queries to refetch too —
      // covers the case where the antes/después preview was mounted
      // earlier but is paused while the picker is up.
      await qc.invalidateQueries({
        queryKey: queryKeys.photos.all,
        refetchType: 'all',
      })
    },
  })
}
