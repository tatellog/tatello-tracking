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
    // Desglose del día: agua directa + agua derivada de comidas.
    breakdown: (date: string) => ['water', 'breakdown', date] as const,
    // El agua que las comidas de un día aportan (suma aceptada).
    fromMeals: (date: string) => ['water', 'fromMeals', date] as const,
    // La decisión de hidratación guardada para UNA comida (para recalc al editar).
    meal: (mealId: string) => ['water', 'meal', mealId] as const,
  },
  rest: {
    all: ['rest'] as const,
    day: (date: string) => ['rest', date] as const,
  },
  workout: {
    all: ['workout'] as const,
    // Tipo de entreno de un día (chips del check-in en Hoy).
    typeForDay: (date: string) => ['workout', 'type', date] as const,
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
  revelations: {
    all: ['revelations'] as const,
    // El orquestador (T1/T2/T3) que decide qué revelación mostrar al abrir Hoy.
    pending: () => ['revelations', 'pending'] as const,
    // El timeline de Historia (todas las revelaciones mostradas).
    history: () => ['revelations', 'history'] as const,
  },
  emblem: {
    all: ['emblem'] as const,
    // La meta de agua entra en la key: cambiarla recalcula el acumulado
    // (los días "agua completa" dependen de la vara).
    points: (waterGoalGlasses: number) => ['emblem', 'points', waterGoalGlasses] as const,
  },
  orbit: {
    all: ['orbit'] as const,
    // Las keys de órbita van SCOPEADAS POR USUARIO (`uid`) y por día. Sin el uid,
    // la caché persistida (AsyncStorage 24 h) servía las señales de OTRA cuenta a
    // un usuario nuevo en el mismo dispositivo (un usuario nuevo "heredaba" los
    // datos de un seed de dev). Con el uid en la key, un usuario distinto = key
    // distinta = cache miss = fetch real. El día también va en la key para no
    // mostrar las señales de ayer como hoy al cruzar la medianoche.
    //
    // El uid va DESPUÉS del segmento de tipo para que las invalidaciones por
    // prefijo sigan funcionando: orbit.all (['orbit']) matchea todo; una
    // invalidación de ['orbit','today'] matchea ['orbit','today', uid, day].
    today: (uid: string, day?: string) =>
      day ? (['orbit', 'today', uid, day] as const) : (['orbit', 'today', uid] as const),
    day: (uid: string, day: string) => ['orbit', 'day', uid, day] as const,
    week: (uid: string, fromDate: string, toDate: string) =>
      ['orbit', 'week', uid, fromDate, toDate] as const,
    history: (uid: string, fromDate: string, toDate: string) =>
      ['orbit', 'history', uid, fromDate, toDate] as const,
    hasAny: (uid: string) => ['orbit', 'hasAny', uid] as const,
    totalDays: (uid: string) => ['orbit', 'totalDays', uid] as const,
  },
} as const
