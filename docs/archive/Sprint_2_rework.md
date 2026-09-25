# Sprint 2 — Design system + Home visual

## Prerequisitos

- Sprint 1 completo (Supabase corriendo, auth funcional, tablas de workouts / body_measurements / photos / briefs / profiles, RLS activa, morning brief consumiendo data real vía `get_brief_context` RPC)
- Home actual funcional pero con diseño "v1" (el del Sprint 0/1, sin animaciones, fuentes system)

## Objetivo del Sprint 2

Reemplazar la Home actual con la nueva composición:
**header → racha (grid 7×4 + número) → deltas (peso/cintura) → ancla del día → swipe-to-seal → quick actions → mood picker → tab bar**

Todo animado, tipografía custom, paleta refinada con tokens. El texto del "mensaje contextual" y el "ancla del día" aún se generan con reglas hardcoded en el cliente (Sprint 3 los migra a Anthropic). Los mood check-ins se capturan y guardan en DB.

Al cierre del sprint, cuando abras la app en la mañana:

- La pantalla se compone con cascada animada ~2.3s
- El cuadro de HOY respira con halo pulsante
- Puedes deslizar para sellar el día → racha sube 14→15 con count-up
- Puedes tapear un mood → se guarda en DB

---

## Stack que se agrega

- `react-native-reanimated@^3.10` — animaciones
- `react-native-gesture-handler@^2.16` — para swipe-to-seal
- `expo-haptics` — vibración al completar swipe, al tapear mood
- `expo-font` — cargar Cormorant Garamond + EB Garamond (fallback)
- `@expo-google-fonts/cormorant-garamond` — fuentes vía Google Fonts (más fácil que self-hosted)
- `@expo-google-fonts/eb-garamond` — fallback serif display

---

## Tareas ordenadas

### Tarea 1 — Theme tokens

`/theme/colors.ts`:

```ts
export const colors = {
  // Cream / background family
  creamWarm: '#F7F1E6',
  creamSoft: '#F5EFE4',
  creamDeep: '#F2EBDC',
  creamShade: '#EFE6D3',
  creamPaper: '#FAF4E8',
  creamShelf: '#F5EED9',

  // Forest / primary text
  forestDeep: '#15302A',
  forestMid: '#1a3c34',
  forestShade: '#0f241f',
  forestSoft: '#3E4841',

  // Copper / accent (today, CTA highlights)
  copperBright: '#D97847',
  copperVivid: '#B8633D',
  copperShade: '#9a4e2d',

  // Gold / tertiary labels and dividers
  goldBurnt: '#8B6F3E',
  goldSoft: '#A89B84',
  goldMute: '#C1B7A3',
  goldDivider: '#C9BFA8',

  // Alpha utilities (for overlays, borders)
  overlayWhite35: 'rgba(255, 255, 255, 0.35)',
  overlayWhite40: 'rgba(255, 255, 255, 0.4)',
  overlayWhite60: 'rgba(255, 255, 255, 0.6)',
  goldAlpha08: 'rgba(139, 111, 62, 0.08)',
  goldAlpha10: 'rgba(139, 111, 62, 0.10)',
  goldAlpha12: 'rgba(139, 111, 62, 0.12)',
  goldAlpha18: 'rgba(139, 111, 62, 0.18)',
  goldAlpha20: 'rgba(139, 111, 62, 0.20)',
  goldAlpha25: 'rgba(139, 111, 62, 0.25)',
  forestAlpha15: 'rgba(21, 48, 42, 0.15)',
  forestAlpha08: 'rgba(21, 48, 42, 0.08)',
  copperShadow: 'rgba(184, 99, 61, 0.35)',
} as const

export type ColorToken = keyof typeof colors
```

`/theme/typography.ts`:

```ts
export const typography = {
  // Display serif (racha, deltas, anclas)
  display: 'CormorantGaramond_400Regular',
  displayMedium: 'CormorantGaramond_500Medium',

  // Prose serif (mensajes narrativos)
  prose: 'EBGaramond_400Regular_Italic',

  // Sans (labels pequeños, UI chrome)
  ui: undefined, // system default (SF Pro iOS, Roboto Android)

  sizes: {
    tinyLabel: 9.5,
    smallLabel: 10,
    body: 14,
    prose: 14.5,
    anchor: 22,
    delta: 34,
    streakNumber: 50,
  },

  letterSpacing: {
    label: 2,
    softLabel: 0.3,
    display: -0.8,
  },

  lineHeight: {
    tight: 0.95,
    display: 1.25,
    prose: 1.5,
  },
} as const
```

`/theme/spacing.ts`:

```ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
} as const

export const radius = {
  cell: 6,
  card: 22,
  screen: 38,
  pill: 100,
} as const

export const shadows = {
  card: {
    shadowColor: '#15302A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  copperToday: {
    shadowColor: '#B8633D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
} as const
```

`/theme/index.ts`: barrel export de los tres.

**Done when:** importar `colors.forestDeep` desde cualquier componente autocompleta y compila. Cero hex sueltos en componentes futuros — regla estricta.

### Tarea 2 — Fuentes custom

- `pnpm add expo-font @expo-google-fonts/cormorant-garamond @expo-google-fonts/eb-garamond`
- En `/app/_layout.tsx`:

```tsx
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
} from '@expo-google-fonts/cormorant-garamond'
import { EBGaramond_400Regular_Italic } from '@expo-google-fonts/eb-garamond'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    EBGaramond_400Regular_Italic,
  })

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  // ... resto del layout
}
```

- Verificar que un `<Text style={{ fontFamily: typography.display }}>14</Text>` renderiza con el serif correcto en simulator, NO con system font.

**Done when:** screenshot de un Text con fontFamily display se ve idéntico al mockup (contraste alto, letterforms elegantes).

### Tarea 3 — Reanimated setup

- `pnpm add react-native-reanimated react-native-gesture-handler expo-haptics`
- Seguir el setup exacto de docs de Expo (babel plugin `react-native-reanimated/plugin` al final de plugins, `GestureHandlerRootView` en root layout)
- Verificar con un smoke test: un `<Animated.View>` con `useAnimatedStyle` cambiando opacity funciona

**Done when:** un componente de prueba con `withTiming` anima correctamente en simulator.

### Tarea 4 — Migración de mood_checkins

`supabase migration new mood_checkins`:

```sql
create table public.mood_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  value text not null check (value in ('good', 'neutral', 'struggle')),
  checked_at timestamptz not null default now(),
  checkin_date date generated always as ((checked_at at time zone 'America/Mexico_City')::date) stored,
  created_at timestamptz not null default now()
);

create index mood_checkins_user_date_idx on public.mood_checkins(user_id, checkin_date desc);

-- RLS
alter table public.mood_checkins enable row level security;

create policy "users read own moods" on public.mood_checkins
  for select using (auth.uid() = user_id);
create policy "users insert own moods" on public.mood_checkins
  for insert with check (auth.uid() = user_id);
create policy "users update own moods" on public.mood_checkins
  for update using (auth.uid() = user_id);
create policy "users delete own moods" on public.mood_checkins
  for delete using (auth.uid() = user_id);
```

Permitir múltiples check-ins por día (no unique constraint) — el usuario puede cambiar su mood durante el día, cada uno se registra.

Regenerar tipos: `pnpm types:db`.

**Done when:** migración aplicada local + remoto, tipos actualizados en el cliente.

### Tarea 5 — Extender RPC get_brief_context

Nueva migración `supabase migration new extend_brief_context`:

El RPC existente devuelve streak, today_workout, latest_measurement, measurement_30d_ago. Agregar:

- `grid_28_days`: array de 28 booleans (último día = hoy) indicando si hubo workout ese día
- `latest_mood`: mood_checkins más reciente de HOY o null
- `day_of_week`: nombre del día en español (para el header)

```sql
create or replace function public.get_brief_context(p_user_id uuid, p_date date default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_today date := coalesce(p_date, (now() at time zone 'America/Mexico_City')::date);
  v_streak int;
  v_today_workout boolean;
  v_latest_measurement jsonb;
  v_measurement_30d_ago jsonb;
  v_grid jsonb;
  v_latest_mood jsonb;
  v_day_name text;
begin
  v_streak := public.get_current_streak(p_user_id);

  select exists(
    select 1 from public.workouts
    where user_id = p_user_id and workout_date = v_today
  ) into v_today_workout;

  select to_jsonb(m) into v_latest_measurement
  from public.body_measurements m
  where user_id = p_user_id
  order by measured_at desc limit 1;

  select to_jsonb(m) into v_measurement_30d_ago
  from public.body_measurements m
  where user_id = p_user_id
    and measured_at <= (v_today - interval '25 days')
  order by measured_at desc limit 1;

  -- grid: 28 días, más viejo primero, hoy al final
  select jsonb_agg(
    jsonb_build_object(
      'date', d::date,
      'completed', exists(
        select 1 from public.workouts
        where user_id = p_user_id and workout_date = d::date
      )
    ) order by d
  ) into v_grid
  from generate_series(v_today - interval '27 days', v_today, interval '1 day') d;

  -- mood más reciente de hoy
  select to_jsonb(m) into v_latest_mood
  from public.mood_checkins m
  where user_id = p_user_id and checkin_date = v_today
  order by checked_at desc limit 1;

  -- día de la semana en español
  v_day_name := case extract(dow from v_today)
    when 0 then 'Domingo'
    when 1 then 'Lunes'
    when 2 then 'Martes'
    when 3 then 'Miércoles'
    when 4 then 'Jueves'
    when 5 then 'Viernes'
    when 6 then 'Sábado'
  end;

  return jsonb_build_object(
    'date', v_today,
    'day_of_week', v_day_name,
    'streak_days', v_streak,
    'today_workout_completed', v_today_workout,
    'latest_measurement', v_latest_measurement,
    'measurement_30d_ago', v_measurement_30d_ago,
    'grid_28_days', v_grid,
    'latest_mood', v_latest_mood
  );
end;
$$;
```

**Done when:** llamar el RPC desde SQL editor devuelve un JSON con los 8 campos. El grid tiene exactamente 28 elementos.

### Tarea 6 — Derivar estado del día (regla hardcoded)

En `/features/home/logic.ts`:

```ts
import type { BriefContext } from '@/types/brief'

export type DayState = 'on-level' | 'caution' | 'risk'

export function deriveDayState(ctx: BriefContext): DayState {
  // TODO Sprint 3: reemplazar con LLM structured output
  const now = new Date()
  const hour = now.getHours()
  const dayOfWeek = new Date(ctx.date).getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

  // Si ya entrenó hoy → on-level siempre
  if (ctx.today_workout_completed) return 'on-level'

  // Si es tarde y no ha entrenado → risk
  if (hour >= 19) return 'risk'

  // Si es fin de semana sin entrenar antes de las 2pm → caution
  if (isWeekend && hour >= 14) return 'caution'

  // Default
  return 'on-level'
}

export function deriveAnchorAction(ctx: BriefContext, state: DayState): string {
  if (ctx.today_workout_completed) {
    return '✓ Entreno de hoy hecho.'
  }

  const now = new Date()
  const hour = now.getHours()
  const dayOfWeek = new Date(ctx.date).getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

  if (state === 'risk') return 'Entrena antes de dormir.'
  if (state === 'caution' && isWeekend) return 'Entrena antes de las 6.'
  if (hour < 10) return 'Marca tu entreno cuando termines.'
  return 'Entrena antes de las 6.'
}

export function deriveContextMessage(ctx: BriefContext, state: DayState): string {
  const dayOfWeek = new Date(ctx.date).getDay()
  const isSaturday = dayOfWeek === 6
  const gridLast4Saturdays = ctx.grid_28_days
    .filter((d) => new Date(d.date).getDay() === 6)
    .slice(-4, -1) // las 3 anteriores a hoy

  if (isSaturday && gridLast4Saturdays.every((d) => !d.completed)) {
    return 'Hoy es sábado. Tus últimos 3 fueron los huecos.'
  }
  if (state === 'risk') {
    return 'Ya es tarde. No dejes que hoy sea un hueco.'
  }
  if (ctx.today_workout_completed) {
    return 'Hoy ya está sellado. Mantén el ritmo.'
  }
  return `Vas ${ctx.streak_days} días seguidos. Uno más.`
}
```

Estas funciones son **temporales**. Sprint 3 las reemplaza con la salida de Anthropic (más humana, más específica). Por ahora: reglas que funcionan para validar la Home visualmente.

**Done when:** ejecutando cada función con un context de prueba devuelve string razonable.

### Tarea 7 — Componente StreakGrid

`/features/home/components/StreakGrid.tsx`:

Layout: `grid-template-columns: 1fr auto auto` con la cuadrícula + divider vertical + número grande.

Cuadrícula: 28 items en grid de 7 columnas, gap 4px.

Cada celda es un `Animated.View`:

- `aspect-ratio: 1`
- `borderRadius: radius.cell`
- Fondo según estado:
  - Completed (viejo, índices 0-6): gradient forestMid→forestDeep→forestShade, opacity 0.55
  - Completed (mid, 7-20): misma gradient, opacity 0.76
  - Completed (recent, 21-27): misma gradient, opacity 1
  - Empty: transparent + border dashed 0.5px goldMute
  - Today (último): gradient copperBright→copperVivid→copperShade + boxShadow copper + halo animado

Props:

```ts
{
  days: Array<{ date: string; completed: boolean }>
  streakCount: number
}
```

Animación de entrada:

- Cada celda usa `Animated.View` con `entering={FadeIn.delay(index * 40).springify().damping(12)}`
- La celda de HOY además tiene un `useAnimatedStyle` con `withRepeat(withTiming(scale, 1300), -1, true)` para breathing
- El halo del HOY es un segundo View absoluto con border copperVivid + scale animation 1→2.3 con opacity 0.8→0 en loop

El número a la derecha (`streakCount`):

- `fontFamily: typography.display`, size 50, color forestDeep
- Entra con fade + translateY después de la cascada (delay 1.2s)
- Opcional stretch: count-up animation 0→streakCount con `useAnimatedProps` sobre un `ReText` de Reanimated

**Done when:** renderiza con data mock (array de 28 booleans), la cascada se siente escalonada, el HOY pulsa visualmente distinto.

### Tarea 8 — Componente DeltaPair

`/features/home/components/DeltaPair.tsx`:

Dos columnas separadas por divider vertical con gradient fade (transparent→goldDivider→transparent).

Cada delta:

- Número grande: `typography.displayMedium`, size `typography.sizes.delta`, color forestDeep
- Formato: `-1.8 kg` con "kg" más chico en goldBurnt
- Label debajo: "peso · 4 sem" en tinyLabel style

Animación: micro-pulse (scale 1→1.025→1) con `withRepeat` cada 4.5s, delay 2.5s para empezar después de que la pantalla termine de entrar.

Props:

```ts
{
  weightDeltaKg?: number
  waistDeltaCm?: number
  periodWeeks?: number
}
```

Si no hay measurement de hace 30 días → renderizar placeholder: "Agrega tu primera medida" con CTA a Settings.

**Done when:** dos números grandes, divider vertical, pulso sutil al cargar.

### Tarea 9 — Componente SwipeToSeal

`/features/home/components/SwipeToSeal.tsx`:

Este es el reemplazo del botón "¿Entrenaste hoy?". Swipe horizontal de izquierda a derecha que al completar dispara `onSeal()`.

Estructura:

- Track exterior con gradient animado (forestDeep→forestMid→forestDeep, background-position animado = shimmer)
- Thumb circular (38x38) con gradient cream que el user arrastra
- Label "Desliza para sellar el día" en serif italic
- Flechas hint `›››` a la derecha con animación `slideHint`

Gesture handling con `Gesture.Pan()`:

- Track `translationX` del thumb
- Clamp entre 0 y `trackWidth - thumbWidth`
- En `onEnd`:
  - Si translationX > 80% del track → completar: haptic Medium, `onSeal()`, thumb snaps a la derecha, el track cambia a estado sealed (color más claro, label cambia a "✓ Día sellado")
  - Si < 80% → spring back a 0

Estado sealed persiste visualmente hasta que se recargue la pantalla (o se invalide la query de brief).

Si ya está sealed al montar (porque `today_workout_completed === true`): renderizar directamente en estado sealed, sin gesto disponible.

Props:

```ts
{
  sealed: boolean
  onSeal: () => void | Promise<void>
}
```

**Done when:** el gesto funciona fluido en simulator (con mouse cuenta como touch). Feedback háptico al completar. Si sealed, se ve distinto y no reacciona a gestos.

### Tarea 10 — Componente MoodPicker

`/features/home/components/MoodPicker.tsx`:

Tres orbs circulares (42x42) con fondo overlayWhite40 y border 0.5px goldAlpha20.

Al tapear uno:

- Ese orb escala a 1.18 con spring
- Los otros dos escalan a 0.9 y opacity 0.5
- Border del seleccionado se vuelve copperVivid
- Trigger haptic Light
- Mutation a `mood_checkins` table

Props:

```ts
{
  value: 'good' | 'neutral' | 'struggle' | null
  onChange: (value: 'good' | 'neutral' | 'struggle') => void
}
```

Emojis: `😌` good, `😐` neutral, `😣` struggle.

**Done when:** tap feedback visual + haptic, estado se persiste en DB, al recargar la Home muestra el mood seleccionado.

### Tarea 11 — Componente HomeHeader, AnchorLine, QuickActions

Componentes más simples, no requieren detalle exhaustivo:

**HomeHeader** — día de la semana + fecha + hora + ícono modo día/noche (placeholder, no functional).

**AnchorLine** — label "ANCLA DE HOY" + frase serif display 22px centrada.

**QuickActions** — dos pills semi-transparentes "📸 Progreso" y "⚖ Medida" que navegan a las screens correspondientes (las screens pueden ser placeholders vacías esta sprint).

### Tarea 12 — Home screen ensamblada

En `/app/(tabs)/index.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query'
import { ScrollView, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useBriefContext } from '@/features/home/hooks'
import {
  HomeHeader,
  StreakCard,
  DeltaPair,
  AnchorLine,
  SwipeToSeal,
  QuickActions,
  MoodPicker,
} from '@/features/home/components'
import { deriveDayState, deriveAnchorAction, deriveContextMessage } from '@/features/home/logic'

export default function HomeScreen() {
  const { data: ctx, isLoading } = useBriefContext()

  if (isLoading || !ctx) return <HomeSkeleton />

  const state = deriveDayState(ctx)
  const anchor = deriveAnchorAction(ctx, state)
  const contextMsg = deriveContextMessage(ctx, state)

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Animated.View entering={FadeInDown.delay(50)}>
        <HomeHeader dayOfWeek={ctx.day_of_week} date={ctx.date} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150)}>
        <StreakCard
          days={ctx.grid_28_days}
          streakCount={ctx.streak_days}
          contextMessage={contextMsg}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(1700)}>
        <DeltaPair
          weightDeltaKg={calcWeightDelta(ctx)}
          waistDeltaCm={calcWaistDelta(ctx)}
          periodWeeks={4}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(1850)}>
        <AnchorLine text={anchor} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(2000)}>
        <SwipeToSeal sealed={ctx.today_workout_completed} onSeal={() => markWorkoutComplete()} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(2150)}>
        <QuickActions />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(2150)}>
        <MoodPicker
          value={ctx.latest_mood?.value ?? null}
          onChange={(value) => saveMoodCheckin(value)}
        />
      </Animated.View>
    </ScrollView>
  )
}
```

Los delays coinciden con la coreografía: header 50ms, card 150ms, el resto espera a que la cascada de la card termine (~1.6s) y luego encadena.

### Tarea 13 — Tab bar custom

Reemplazar el tab bar de Expo Router default con uno custom que matchee el diseño:

- Tres tabs: Hoy (☀ icon), Progreso (◇), Ajustes (○)
- Labels en serif italic, size 11px
- Active: copperVivid; inactive: goldSoft
- Fondo `creamSoft` con border-top 0.5px goldAlpha10

Usar `Tabs.Screen options.tabBarIcon` y `tabBarLabel` custom.

### Tarea 14 — Home skeleton

`/features/home/components/HomeSkeleton.tsx`:

Versión shimmer de la Home durante loading del primer fetch. Placeholder rectángulos con pulso de opacity 0.3↔0.6 cada 1.5s. Respeta la estructura de la pantalla real (mismo layout, mismos tamaños) para evitar layout shift.

### Tarea 15 — Animación reducida en aperturas frecuentes

Si el usuario abre la app más de una vez en la misma hora, usar animación reducida (300ms total, solo fade) en lugar de la coreografía completa.

Implementación simple: `AsyncStorage` con key `last_home_open_timestamp`. Si menos de 60 min desde la última → usar `FadeIn` básico sin delays escalonados. Si más → coreografía completa.

**Done when:** al abrir la app 2 veces seguidas, la segunda vez se siente instantánea (<300ms), no la cascada de 2.3s.

---

## Acceptance criteria (Sprint 2 done)

1. Al abrir la Home fresca, la cascada de 28 cuadros ocurre en ~1.1s, el HOY pulsa halo continuo al terminar
2. Tipografía serif (Cormorant) se ve correcta en streak number, deltas y ancla
3. Paleta matchea el mockup: cream warm background, forest deep text, copper vivid en HOY y acciones
4. Swipe-to-seal funciona con gesto: completa → haptic → racha +1 en DB → UI refleja sellado
5. Mood picker: tap guarda en `mood_checkins`, visualmente elegido se destaca, otros se atenúan
6. Grid refleja data real de DB: 28 días hacia atrás, completed = lleno, else = vacío/dashed
7. Deltas muestran peso y cintura calculados desde `body_measurements` (latest vs hace ~30 días)
8. Si no hay measurement de hace 30 días → placeholder en lugar de delta
9. Mensaje contextual ("Hoy es sábado. Tus últimos 3...") cambia según reglas en `logic.ts`
10. Ancla del día cambia según hora + estado (ver logic.ts)
11. Segundo abrir dentro de 1h usa animación reducida (no la cascada completa)
12. Home skeleton aparece durante loading inicial, sin layout shift al resolver
13. Tab bar custom con 3 tabs estilizados; tabs Progreso y Ajustes pueden ser placeholders
14. `pnpm typecheck` y `pnpm lint` pasan limpio
15. Zero hex sueltos en componentes — todo vía tokens de `/theme`

---

## Lo que NO se hace en Sprint 2

- Edge Function con Anthropic → Sprint 3
- Texto generado dinámicamente con LLM → Sprint 3 (hardcoded con reglas es suficiente ahora)
- Captura real de fotos + upload → Sprint 3
- HealthKit / Garmin → Sprint 4
- Tab Progreso funcional (galería de fotos, gráficas) → post-MVP
- Tab Ajustes funcional (solo sign out por ahora) → Sprint 3-4
- Cambio de tema día/noche → post-MVP (el ícono en header es decorativo)
- Notificaciones push → post-MVP
- Animación de onboarding/first-open dedicada → post-MVP
- Count-up del streak number al abrir (nice-to-have) → si da tiempo al final del sprint

---

## Notas para Claude Code

- **Fuentes antes que animaciones.** Si las fuentes no cargan bien, todo el sistema visual se cae a system font y pierde 60% del impacto. Validar Tarea 2 antes de seguir.
- **Reanimated 3, no v2.** La API de v3 es `useAnimatedStyle` + `useSharedValue` + `with*` functions. Los `entering` props son v3-only y son lo que usa esta pantalla extensivamente.
- **`FadeInDown.delay(...).springify()`** es el patrón base para todos los bloques. No hacer animaciones custom donde este built-in alcance.
- **Gesture handler en iOS simulator:** el swipe funciona con click-drag del mouse. Si no responde, probablemente falta `GestureHandlerRootView` al root del app layout.
- **El halo del HOY es dos Views, no filter/shadow.** Un View absoluto con border + scale animation + opacity animation encima del cuadro. Box-shadow puro no se puede animar bien en RN.
- **Gradients en RN:** usar `expo-linear-gradient`. No CSS gradients (no existen en RN).
- **No usar `setTimeout` para delays de animación.** Siempre `.delay(ms)` en el entering prop. setTimeout crea race conditions.
- **Haptics:** `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` al completar swipe. Light para mood tap. NO usar Heavy, es demasiado.
- **Tokens estrictos:** si necesitas un color que no está en `/theme/colors.ts`, primero agrégalo al token file, luego úsalo. Nunca hex inline.
- **Mock data durante desarrollo:** usar el seed script de Sprint 1 para tener 14 días de workouts + 2 measurements (hoy y hace 30 días) + 1 mood checkin. Sin esto, la pantalla se ve vacía y no puedes validar el diseño.
- **Commits atómicos:** mínimo uno por tarea, idealmente uno por componente.
- **Al cerrar el sprint:** valida los 15 Acceptance Criteria uno por uno.
