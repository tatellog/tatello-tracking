import { useBriefContext } from '@/features/brief/hooks'

import { MOCK_BRIEF_CONTEXT } from './mock'

import type { BriefContext } from '@/features/brief/api'

const SKIP_AUTH = process.env.EXPO_PUBLIC_SKIP_AUTH === 'true'

type HomeBriefState = {
  data: BriefContext | undefined
  isLoading: boolean
  isError: boolean
}

/*
 * Wraps useBriefContext with a dev-only fallback: when the real
 * query errors AND EXPO_PUBLIC_SKIP_AUTH is true, render the mock
 * so the Home can be iterated without running the magic-link flow.
 *
 * In production (SKIP_AUTH unset or false) this is a pass-through
 * and the mock file is tree-shaken out of the bundle.
 */
export function useHomeBrief(): HomeBriefState {
  const query = useBriefContext()
  if (SKIP_AUTH && query.isError) {
    return { data: MOCK_BRIEF_CONTEXT, isLoading: false, isError: false }
  }
  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
