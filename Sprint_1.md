# Sprint 1 — Supabase + data layer + auth

## Prerequisitos

- Sprint 0 completo (app corriendo con mock data, morning brief renderizando en iOS simulator)
- Cuenta gratis en [supabase.com](https://supabase.com) creada
- Supabase CLI instalada (`brew install supabase/tap/supabase`)
- Apple Developer account si se va a usar Sign in with Apple real (opcional en este sprint — magic link email es suficiente para validación local)

## Objetivo del Sprint 1

App corriendo contra Supabase real en lugar de mocks. Puedes crear cuenta, marcar entrenamientos, agregar medidas corporales, y el morning brief muestra tu racha real calculada desde Postgres.

## Stack que se agrega

- `@supabase/supabase-js` — SDK cliente
- `@supabase/ssr` o auth helpers nativos de Expo
- `expo-secure-store` — persistir session tokens seguros (reemplaza AsyncStorage para auth)
- `@react-native-async-storage/async-storage` — ya instalado en Sprint 0 para TanStack Query persist

---

## Tareas ordenadas

### Tarea 1 — Crear proyecto Supabase

- Crear proyecto en [supabase.com](https://supabase.com/dashboard) (plan free)
- Región: `us-west-1` o la más cercana a CDMX
- Guardar Project URL y anon key
- Crear `.env.local` (gitignored) en la raíz del repo con:
  ```
  EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  ```
- Agregar `.env.local` a `.gitignore`
- Crear `.env.example` con las variables vacías (commiteable)

**Done when:** las env vars cargan en la app (`console.log(process.env.EXPO_PUBLIC_SUPABASE_URL)` imprime la URL).

### Tarea 2 — Supabase CLI + init local

- Instalar CLI: `brew install supabase/tap/supabase` (si no está)
- En la raíz del repo: `supabase init` (crea `/supabase` folder con config, migrations, functions)
- `supabase login`
- `supabase link --project-ref <ref>` (ref lo ves en la URL del dashboard)
- Verificar con `supabase status`

**Done when:** la carpeta `/supabase` existe, está linkeada al remoto, y `supabase db pull` trae el schema vacío.

### Tarea 3 — Schema inicial (migración)

`supabase migration new initial_schema`

En el archivo SQL generado, definir:

```sql
-- profiles: datos extra del usuario, linked a auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  goal text check (goal in ('recomposition', 'lose_fat', 'gain_muscle', 'maintain')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- workouts: check-in diario de entreno
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  workout_date date generated always as ((completed_at at time zone 'America/Mexico_City')::date) stored,
  type text,
  notes text,
  created_at timestamptz not null default now()
);

create unique index workouts_user_date_unique on public.workouts(user_id, workout_date);
create index workouts_user_date_idx on public.workouts(user_id, workout_date desc);

-- body_measurements: peso + medidas corporales
create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_kg numeric(5,2),
  waist_cm numeric(5,2),
  chest_cm numeric(5,2),
  hip_cm numeric(5,2),
  thigh_cm numeric(5,2),
  arm_cm numeric(5,2),
  created_at timestamptz not null default now()
);

create index body_measurements_user_date_idx on public.body_measurements(user_id, measured_at desc);

-- photos: fotos de progreso (schema ahora, upload real en Sprint 2)
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_at timestamptz not null default now(),
  storage_path text not null,
  angle text check (angle in ('front', 'side', 'back')),
  created_at timestamptz not null default now()
);

create index photos_user_date_idx on public.photos(user_id, taken_at desc);

-- briefs: contenido del morning brief generado (generación real en Sprint 2)
create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brief_date date not null,
  content jsonb not null,
  generated_at timestamptz not null default now()
);

create unique index briefs_user_date_unique on public.briefs(user_id, brief_date);

-- trigger para auto-crear profile al signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Done when:** `supabase db reset` corre sin errores. Las 5 tablas existen localmente.

### Tarea 4 — RLS policies

Nueva migración: `supabase migration new rls_policies`

```sql
alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.body_measurements enable row level security;
alter table public.photos enable row level security;
alter table public.briefs enable row level security;

-- profiles: cada user ve y edita su propio profile
create policy "users read own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id);

-- workouts: CRUD solo de los propios
create policy "users read own workouts" on public.workouts
  for select using (auth.uid() = user_id);
create policy "users insert own workouts" on public.workouts
  for insert with check (auth.uid() = user_id);
create policy "users update own workouts" on public.workouts
  for update using (auth.uid() = user_id);
create policy "users delete own workouts" on public.workouts
  for delete using (auth.uid() = user_id);

-- body_measurements: mismo patrón
create policy "users read own measurements" on public.body_measurements
  for select using (auth.uid() = user_id);
create policy "users insert own measurements" on public.body_measurements
  for insert with check (auth.uid() = user_id);
create policy "users update own measurements" on public.body_measurements
  for update using (auth.uid() = user_id);
create policy "users delete own measurements" on public.body_measurements
  for delete using (auth.uid() = user_id);

-- photos, briefs: mismo patrón (copia-pega + ajusta nombres)
-- ... (aplicar mismo patrón a photos y briefs)
```

**Done when:** RLS activa en las 5 tablas. Testeable con `supabase db reset` + query desde dashboard como anon vs authenticated.

### Tarea 5 — RPCs para el brief

Nueva migración: `supabase migration new brief_rpcs`

```sql
-- Calcula racha de días consecutivos con workout, partiendo de hoy hacia atrás
create or replace function public.get_current_streak(p_user_id uuid, p_timezone text default 'America/Mexico_City')
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_streak int := 0;
  v_today date := (now() at time zone p_timezone)::date;
  v_check_date date := v_today;
  v_found boolean;
begin
  loop
    select exists(
      select 1 from public.workouts
      where user_id = p_user_id and workout_date = v_check_date
    ) into v_found;

    if v_found then
      v_streak := v_streak + 1;
      v_check_date := v_check_date - interval '1 day';
    else
      -- si el día faltante es HOY, aún no rompe la racha (todavía puede entrenar)
      if v_check_date = v_today then
        v_check_date := v_check_date - interval '1 day';
      else
        exit;
      end if;
    end if;

    -- safety break
    if v_streak > 3650 then exit; end if;
  end loop;

  return v_streak;
end;
$$;

-- Contexto completo para generar un brief (consumido por la Edge Function en Sprint 2,
-- y por el cliente mientras tanto para poblar el render)
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
  v_result jsonb;
begin
  -- streak
  v_streak := public.get_current_streak(p_user_id);

  -- workout de hoy
  select exists(
    select 1 from public.workouts
    where user_id = p_user_id and workout_date = v_today
  ) into v_today_workout;

  -- medida más reciente
  select to_jsonb(m) into v_latest_measurement
  from public.body_measurements m
  where user_id = p_user_id
  order by measured_at desc
  limit 1;

  -- medida ~30 días atrás (la más cercana a v_today - 30)
  select to_jsonb(m) into v_measurement_30d_ago
  from public.body_measurements m
  where user_id = p_user_id
    and measured_at <= (v_today - interval '25 days')
  order by measured_at desc
  limit 1;

  v_result := jsonb_build_object(
    'date', v_today,
    'streak_days', v_streak,
    'today_workout_completed', v_today_workout,
    'latest_measurement', v_latest_measurement,
    'measurement_30d_ago', v_measurement_30d_ago
  );

  return v_result;
end;
$$;
```

**Done when:** llamar `select public.get_brief_context('<un user_id>'::uuid);` desde el SQL editor de Supabase devuelve un JSON bien formado.

### Tarea 6 — Generar tipos TypeScript

- `supabase gen types typescript --local > types/database.types.ts`
- Agregar script en `package.json`: `"types:db": "supabase gen types typescript --local > types/database.types.ts"`
- Verificar que los tipos importen limpio en el cliente

**Done when:** `import { Database } from '@/types/database.types'` funciona y autocompleta nombres de tablas.

### Tarea 7 — Supabase client en el cliente

`/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import type { Database } from '@/types/database.types'

// Adapter para que Supabase use SecureStore (tokens) + AsyncStorage (fallback)
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
)
```

`/hooks/useSession.ts`:

- Hook que mantiene session state con `supabase.auth.onAuthStateChange`
- Exportar `useSession()` → `{ session, user, loading }`

**Done when:** un `console.log` en un componente muestra `session: null` al inicio y cambia a session válida después de login.

### Tarea 8 — Auth flow (magic link email por ahora)

`/app/auth.tsx`:

- Pantalla simple: logo / título / input de email / botón "Enviarme link"
- `supabase.auth.signInWithOtp({ email })` con `shouldCreateUser: true`
- Mensaje: "revisa tu email"
- Manejo de deep link de regreso (Supabase envía link que abre la app)
- Config `scheme` en `app.json` para deep linking

`/app/_layout.tsx`:

- Leer session con `useSession()`
- Si loading → splash
- Si no session → redirect a `/auth`
- Si session → renderiza `(tabs)`

**Done when:** puedes meter tu email, recibes el magic link en el correo, lo abres en el simulator, y entras a la app autenticada.

**Nota sobre Apple Sign In:** dejarlo para Sprint 4 (cuando armes TestFlight). Magic link alcanza para validar sola y con 2-3 amigos cercanos.

### Tarea 9 — Data layer en el cliente

Estructura por feature. Ejemplo para brief:

`/features/brief/api.ts`:

```ts
import { supabase } from '@/lib/supabase'

export async function fetchBriefContext(date?: string) {
  const { data, error } = await supabase.rpc('get_brief_context', {
    p_user_id: (await supabase.auth.getUser()).data.user!.id,
    p_date: date ?? null,
  })
  if (error) throw error
  return data
}
```

`/features/brief/hooks.ts`:

- `useBriefContext(date?)` — wrap con TanStack Query
- Query key: `['brief', date ?? 'today']`
- `staleTime: 5 * 60 * 1000` (5 min)

Análogamente para workouts y measurements:

- `/features/streak/api.ts` + `hooks.ts` — `markWorkoutComplete()`, `unmarkWorkoutComplete()`
- `/features/measurements/api.ts` + `hooks.ts` — `addMeasurement()`, `useLatestMeasurement()`

Mutations deben invalidar queries relevantes (`brief`, `streak`, `measurements`) después de success.

### Tarea 10 — TanStack Query setup con persist

`/app/_layout.tsx`:

- Wrap app con `QueryClientProvider`
- Config de `QueryClient`: `staleTime`, `gcTime`, retries
- Setup de `persistQueryClient` con AsyncStorage para offline-friendly

### Tarea 11 — Conectar morning brief a data real

En `/app/(tabs)/index.tsx`:

- Reemplazar `import mockBriefData` por `useBriefContext()`
- Manejar estados: loading (skeleton), error (retry), empty (onboarding CTA)
- Si el context viene vacío (user sin workouts ni medidas) → mostrar "Agrega tu primera medida para empezar"
- El WorkoutCheckIn debe llamar `markWorkoutComplete` mutation al tap
- Verificar que al marcar entreno, la racha se actualiza (debe pasar de 0 a 1 si era el primer día)

### Tarea 12 — Pantalla de onboarding mínima

`/app/onboarding.tsx`:

- Se muestra si: user autenticado + zero workouts + zero measurements
- Steps:
  1. "¿Cuál es tu objetivo?" — opciones: recomposición, bajar grasa, subir músculo, mantener
  2. "¿Cuál es tu peso actual?" — input numérico kg
  3. "¿Cintura actual? (opcional)" — input cm
- Al terminar: upsert en `profiles` (goal), insert en `body_measurements`, redirect a `/(tabs)`
- En `/app/_layout.tsx`, agregar check: si session + sin profile completo → redirect a `/onboarding`

### Tarea 13 — Seed data para desarrollo local

`/supabase/seed.sql`:

- Crear un user de prueba (vía `auth.users` directo con password hasheado, o usar `supabase.auth.admin.createUser` en un script TS separado)
- 14 días de workouts para ese user
- 2-3 medidas a distintas fechas (hoy + hace 30 días)

Script alterno: `/scripts/seed.ts` con supabase-js admin que llene la DB local.

**Done when:** `supabase db reset && pnpm seed` crea un user con 14 días de racha y measurements variadas.

### Tarea 14 — Deploy migration a remoto

- Verificar que en local todo corre: `supabase db reset && pnpm start`
- `supabase db push` para aplicar migrations al proyecto remoto
- Verificar en dashboard de Supabase que las tablas existen con RLS activa
- Verificar en la sección Auth > Email templates que el magic link template se ve decente

---

## Acceptance criteria (Sprint 1 done)

1. Puedes registrarte con magic link email
2. Después de login, si no hay profile, te manda a onboarding
3. Onboarding guarda goal + peso inicial, redirige a morning brief
4. Morning brief muestra tu racha real (1 al marcar primer entreno, 2 al día siguiente, etc.)
5. El tap en "¿Entrenaste hoy?" guarda workout en DB y actualiza UI inmediatamente (optimistic update)
6. Puedes agregar una medida de peso desde un screen de Settings o similar (simple form)
7. Al cerrar y reabrir la app, la session persiste y entras directo
8. Sign out funciona y redirige a auth
9. RLS verificada: si creas un segundo user, no ve data del primero
10. `pnpm typecheck` y `pnpm lint` pasan
11. App corre en iOS simulator conectada a Supabase remoto real

---

## Lo que NO se hace en Sprint 1

- Edge Functions para generar texto del brief → Sprint 2
- Captura real de fotos + upload a Storage → Sprint 2 (solo schema de photos queda listo)
- HealthKit / Health Connect → Sprint 3
- Apple Sign In / Google Sign In → Sprint 4
- Dark mode → futuro
- Pattern detection logic sofisticada → Sprint 2 (por ahora el brief muestra fijo un mensaje genérico si es sábado)
- Dashboard de progreso completo (Progress tab) → Sprint 2-3
- Notifications push → futuro

---

## Notas para Claude Code

- **Migraciones son append-only una vez pusheadas a remoto.** Si hay error en una migración ya pusheada, crea una nueva migración para arreglarlo, no edites la vieja. Esto evita drift.
- **RLS se testea desde el dashboard:** entra como anon role en SQL editor y verifica que `select * from workouts` retorna zero rows.
- **Session tokens van a SecureStore, no AsyncStorage.** AsyncStorage es para caches y datos no sensibles (TanStack Query persist).
- **Los RPCs usan `security definer` con search_path fijo.** Esto es crítico para evitar search_path injection.
- **TanStack Query keys estructurados:** usa arrays con prefijo + parámetros (`['brief', date]`, `['measurements', 'latest']`). Evita strings planos.
- **Optimistic updates en las mutations de workout.** El tap debe sentirse instantáneo; el rollback en error es aceptable.
- **Magic link en simulator:** el link va a tu email real. Si el simulator no intercepta el deep link automáticamente, probablemente falte config del `scheme` en `app.json`. Check docs de Expo Router + Supabase Auth.
- **Commits atómicos:** uno por migración, uno por feature implementada. Mensajes convencionales.
- **Antes de pasar a Sprint 2:** verifica los 11 Acceptance Criteria uno por uno.
