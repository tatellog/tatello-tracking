import type { BriefData } from '@/features/brief/types'
import { mockBriefData } from '@/mocks/briefData'

export function useBriefData(): BriefData {
  return mockBriefData
}
