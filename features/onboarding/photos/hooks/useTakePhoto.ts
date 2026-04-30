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
      qc.invalidateQueries({ queryKey: queryKeys.photos.all })
    },
  })
}
