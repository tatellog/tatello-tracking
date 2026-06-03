import type { OrbitSegment } from './components'

/*
 * One-shot deep-link into the Órbita tab's segment. Expo Router params
 * don't reliably reach a tab screen's useLocalSearchParams when switching
 * tabs, so we hand the desired segment through this tiny module-level
 * mailbox instead: the caller (e.g. the pattern reveal's "Verlo en mi
 * órbita") drops a request, navigates to /orbit, and the Órbita screen
 * consumes it on focus. Cleared on read so it never re-fires.
 */
let pending: OrbitSegment | null = null

export function requestOrbitSegment(segment: OrbitSegment): void {
  pending = segment
}

export function consumeOrbitSegment(): OrbitSegment | null {
  const p = pending
  pending = null
  return p
}
