import { mockBriefData } from '@/mocks/briefData'

import type { BriefData } from '@/features/brief/types'

export function useBriefData(): BriefData {
  return mockBriefData
}
