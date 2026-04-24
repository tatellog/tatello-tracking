import { useBriefContext } from '@/features/brief/hooks'

import { MOCK_BRIEF_CONTEXT } from './mock'

import type { BriefContext } from '@/features/brief/api'

const SKIP_AUTH = process.env.EXPO_PUBLIC_SKIP_AUTH === 'true'

type HomeBriefState = {
  data: BriefContext | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

/*
 * Wraps useBriefContext with a dev-only fallback: when the real
 * query errors AND EXPO_PUBLIC_SKIP_AUTH is true, render the mock
 * so the Home can be iterated without running the magic-link flow.
 *
 * Exposes refetch so the Home's error state can surface a retry
 * button that reaches back into TanStack Query without components
 * needing to import useQueryClient themselves.
 *
 * In production (SKIP_AUTH unset or false) this is a pass-through
 * and the mock file is tree-shaken out of the bundle.
 */
export function useHomeBrief(): HomeBriefState {
  const query = useBriefContext()
  if (SKIP_AUTH && query.isError) {
    return {
      data: MOCK_BRIEF_CONTEXT,
      isLoading: false,
      isError: false,
      refetch: () => {},
    }
  }
  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      query.refetch()
    },
  }
}
