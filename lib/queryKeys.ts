/*
 * Single registry of TanStack Query keys used across the app.
 *
 * Why not export each feature's keys from its own hooks.ts? Because
 * mutations routinely invalidate keys that belong to other features
 * (logging a meal touches the brief; setting a mood touches the
 * brief; toggling a workout touches the brief). When every feature
 * imports briefKeys from features/brief/hooks, the brief feature
 * becomes an implicit dependency of everything else and the
 * coupling is invisible from the outside.
 *
 * Centralising the keys here makes the dependency graph flat
 * (features → lib) and the invalidation surface explicit: if you
 * see `queryKeys.brief.all` being invalidated anywhere, you know
 * exactly which query is being refreshed without following an
 * import trail.
 *
 * Convention: arrays returned with `as const` so TanStack Query
 * sees tuple types — that's what its key-matching needs.
 */

export const queryKeys = {
  brief: {
    /** Root of every brief-scoped query. Invalidating this catches
     *  today + any historical date the UI might have cached. */
    all: ['brief'] as const,
    byDate: (date: string) => ['brief', date] as const,
  },
  macros: {
    all: ['macros'] as const,
    targets: () => ['macros', 'targets'] as const,
    meals: (date: string) => ['macros', 'meals', date] as const,
    meal: (id: string) => ['macros', 'meal', id] as const,
  },
  progress: {
    all: ['progress'] as const,
    measurements: (rangeDays: number | null) => ['progress', 'measurements', rangeDays] as const,
  },
  profile: {
    all: ['profile'] as const,
    me: () => ['profile', 'me'] as const,
  },
  photos: {
    all: ['photos'] as const,
    today: () => ['photos', 'today'] as const,
    latestSet: () => ['photos', 'latest-set'] as const,
  },
} as const
