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
    // Under the 'macros','meals' prefix so meal mutations that invalidate
    // ['macros','meals'] also refresh the weekly aggregate for free.
    weeklyStats: (today: string) => ['macros', 'meals', 'weekly', today] as const,
    // Under 'macros','meals' so a meal mutation that invalidates
    // ['macros','meals'] also refreshes the 10-day consistency window.
    nourishment: (today: string) => ['macros', 'meals', 'nourishment', today] as const,
    meal: (id: string) => ['macros', 'meal', id] as const,
    frequentMeals: () => ['macros', 'frequentMeals'] as const,
    suggestions: (mealType: string) => ['mealSuggestions', mealType] as const,
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
    beforeAfter: () => ['photos', 'before-after'] as const,
  },
  water: {
    all: ['water'] as const,
    day: (date: string) => ['water', date] as const,
    range: (start: string, end: string) => ['water', 'range', start, end] as const,
  },
  rest: {
    all: ['rest'] as const,
    day: (date: string) => ['rest', date] as const,
  },
  sleep: {
    all: ['sleep'] as const,
    day: (date: string) => ['sleep', date] as const,
  },
  wellbeing: {
    all: ['wellbeing'] as const,
    day: (date: string) => ['wellbeing', date] as const,
  },
  patterns: {
    all: ['patterns'] as const,
    // La detección (rate-limited a ~1 revelación / 7 días) se cachea bajo
    // esta key para no re-correr los detectores + inserts en cada focus de Hoy.
    detection: () => ['patterns', 'detection'] as const,
  },
  emblem: {
    all: ['emblem'] as const,
    // La meta de agua entra en la key: cambiarla recalcula el acumulado
    // (los días "agua completa" dependen de la vara).
    points: (waterGoalGlasses: number) => ['emblem', 'points', waterGoalGlasses] as const,
  },
  orbit: {
    all: ['orbit'] as const,
    today: () => ['orbit', 'today'] as const,
    week: (fromDate: string, toDate: string) => ['orbit', 'week', fromDate, toDate] as const,
    history: (fromDate: string, toDate: string) => ['orbit', 'history', fromDate, toDate] as const,
    hasAny: () => ['orbit', 'hasAny'] as const,
  },
} as const
