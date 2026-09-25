# Sprint 2.5 — Capa de macros (logueo manual + sugerencias)

## Prerequisitos

- Sprint 2 completo (Home rediseñada con racha + grid + deltas + swipe + mood + tabs custom, design system con tokens y fuentes Cormorant funcionando, Reanimated configurado)
- Onboarding de Sprint 1 funcional (puedes crear cuenta y entrar)

## Objetivo del Sprint 2.5

Sumar la capa nutricional al producto, con logueo manual (sin foto ni IA todavía):

1. Onboarding skipeable de metas diarias (proteína + calorías)
2. Banner persistente en Home si no hay metas configuradas
3. Card de macros del día con anillos animados (proteína + calorías)
4. Mensajes contextuales con sugerencias concretas de comida (tabla hardcoded, sin LLM)
5. CTA "Loggear comida" que abre form de captura manual
6. Pantalla detalle del día con lista de comidas loggeadas (editable)
7. Tab Comidas en el tab bar (4 tabs ahora)

Sprint 3 reemplaza el form manual por captura por foto + Anthropic. Sprint 4 reemplaza los mensajes hardcoded por LLM. Los datos en DB son los mismos.

Al cierre del sprint: puedes loggear cada comida del día en ~15 segundos manualmente, ver tus anillos avanzar, recibir sugerencias útiles del tipo "te faltan 45g — 200g de pollo cubre", y al final del día revisar exactamente qué comiste.

---

## Stack que se agrega

- `react-native-svg` (probablemente ya instalado por Expo) — para los anillos circulares
- `react-hook-form` + `zod` — para form de captura manual y onboarding de metas
- `@react-native-community/datetimepicker` — selector de hora en form de meal
- `react-native-toast-message` (o equivalente) — confirmaciones después de guardar

---

## Tareas ordenadas

### Tarea 1 — Schema de meals + macro_targets

`supabase migration new meals_and_targets`:

```sql
create table public.macro_targets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  protein_g int not null check (protein_g > 0 and protein_g < 1000),
  calories int not null check (calories > 0 and calories < 10000),
  updated_at timestamptz not null default now()
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consumed_at timestamptz not null default now(),
  meal_date date generated always as ((consumed_at at time zone 'America/Mexico_City')::date) stored,
  name text not null,
  protein_g numeric(6,1) not null check (protein_g >= 0),
  calories int not null check (calories >= 0),
  -- Campos para Sprint 3 (foto + IA): los dejamos nulos por ahora
  photo_storage_path text,
  source text not null default 'manual' check (source in ('manual', 'photo_ai', 'text_ai')),
  ai_raw_response jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create index meals_user_date_idx on public.meals(user_id, meal_date desc, consumed_at desc);

alter table public.macro_targets enable row level security;
alter table public.meals enable row level security;

create policy "users read own targets" on public.macro_targets
  for select using (auth.uid() = user_id);
create policy "users upsert own targets" on public.macro_targets
  for insert with check (auth.uid() = user_id);
create policy "users update own targets" on public.macro_targets
  for update using (auth.uid() = user_id);

create policy "users read own meals" on public.meals
  for select using (auth.uid() = user_id);
create policy "users insert own meals" on public.meals
  for insert with check (auth.uid() = user_id);
create policy "users update own meals" on public.meals
  for update using (auth.uid() = user_id);
create policy "users delete own meals" on public.meals
  for delete using (auth.uid() = user_id);
```

Regenerar tipos: `pnpm types:db`.

**Done when:** migración aplicada local + remoto, tipos en cliente, dashboard muestra ambas tablas con RLS activa.

### Tarea 2 — Extender RPC get_brief_context con macros

Migración `supabase migration new add_macros_to_brief_context`:

Agregar a `get_brief_context`:

- `targets`: row de macro_targets (o null si no configurado)
- `today_macros`: suma de proteína y calorías de meals de HOY
- `meal_count_today`: cuántas comidas se loggearon hoy

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
  v_targets jsonb;
  v_today_macros jsonb;
  v_meal_count int;
begin
  v_streak := public.get_current_streak(p_user_id);

  select exists(select 1 from public.workouts where user_id = p_user_id and workout_date = v_today) into v_today_workout;

  select to_jsonb(m) into v_latest_measurement
  from public.body_measurements m where user_id = p_user_id
  order by measured_at desc limit 1;

  select to_jsonb(m) into v_measurement_30d_ago
  from public.body_measurements m
  where user_id = p_user_id and measured_at <= (v_today - interval '25 days')
  order by measured_at desc limit 1;

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

  select to_jsonb(m) into v_latest_mood
  from public.mood_checkins m
  where user_id = p_user_id and checkin_date = v_today
  order by checked_at desc limit 1;

  v_day_name := case extract(dow from v_today)
    when 0 then 'Domingo' when 1 then 'Lunes' when 2 then 'Martes'
    when 3 then 'Miércoles' when 4 then 'Jueves' when 5 then 'Viernes'
    when 6 then 'Sábado'
  end;

  select to_jsonb(t) into v_targets
  from public.macro_targets t where t.user_id = p_user_id;

  select jsonb_build_object(
    'protein_g', coalesce(sum(protein_g), 0),
    'calories', coalesce(sum(calories), 0)
  ) into v_today_macros
  from public.meals where user_id = p_user_id and meal_date = v_today;

  select count(*) into v_meal_count
  from public.meals where user_id = p_user_id and meal_date = v_today;

  return jsonb_build_object(
    'date', v_today,
    'day_of_week', v_day_name,
    'streak_days', v_streak,
    'today_workout_completed', v_today_workout,
    'latest_measurement', v_latest_measurement,
    'measurement_30d_ago', v_measurement_30d_ago,
    'grid_28_days', v_grid,
    'latest_mood', v_latest_mood,
    'targets', v_targets,
    'today_macros', v_today_macros,
    'meal_count_today', v_meal_count
  );
end;
$$;
```

**Done when:** llamar el RPC desde SQL editor devuelve los 11 campos. Si no hay targets configurados, el campo `targets` viene null.

### Tarea 3 — Pantalla de configuración de metas

`/app/onboarding/macro-targets.tsx`:

Form simple con 2 inputs numéricos:

- "Tu meta diaria de proteína" → input + sufijo "g" → placeholder "130"
- "Tu meta diaria de calorías" → input + sufijo "cal" → placeholder "1800"
- Botón "Guardar"
- Validación zod: protein 1-999, calories 1-9999, ambos enteros

Al guardar: upsert en `macro_targets`, redirect a Home.

**Importante — esta pantalla tiene contexto dual:**

- Si viene del flujo de onboarding inicial: mostrar header "Configura tus metas" + botón secundario "Más tarde" (skip)
- Si viene desde Settings o desde el banner del Home: mostrar header "Editar metas diarias" + botón "Cancelar" (volver sin guardar)

Detectar contexto via param de navegación: `/onboarding/macro-targets?source=onboarding|settings|banner`.

`/features/macros/api.ts`:

```ts
export async function getMacroTargets() {
  const { data, error } = await supabase.from('macro_targets').select('*').single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function upsertMacroTargets(targets: { protein_g: number; calories: number }) {
  const user = (await supabase.auth.getUser()).data.user
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('macro_targets')
    .upsert({ user_id: user.id, ...targets, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}
```

**Done when:** puedes setear 130g/1800cal, recargar la app, y ver que persisten. Editar también funciona. El skip respeta tu elección y no te vuelve a forzar la pantalla.

### Tarea 4 — Onboarding integration (skipeable)

Actualizar el flujo de onboarding existente para incluir el paso de macros como **opcional al final**:

Flujo actual (Sprint 1):

1. Auth → 2. Profile básico (nombre, goal) → 3. Primera medida (peso) → Home

Flujo nuevo:

1. Auth → 2. Profile básico → 3. Primera medida → **4. Configurar metas (skipeable)** → Home

En el paso 4:

- Header: "Una cosa más"
- Subheader: "Si tienes tus metas diarias, configúralas ahora. Si no, puedes hacerlo después."
- Form igual que Tarea 3
- Dos botones: "Guardar y continuar" (primary) | "Más tarde" (link/secundario)
- Si tap "Más tarde" → directo a Home sin escribir nada en `macro_targets`

**Done when:** user nuevo puede completar onboarding sin configurar targets, llega al Home y ve el banner.

### Tarea 5 — Banner "Define tus metas" (estado vacío)

Si `targets === null` en el brief context, mostrar en el Home (en el lugar donde irían los anillos) un card alternativo:

`/features/macros/components/DefineTargetsBanner.tsx`:

```
┌────────────────────────────────────────┐
│  TRACKING DE COMIDAS                   │
│                                        │
│  Define tus metas diarias              │
│  para activar el seguimiento de        │
│  proteína y calorías.                  │
│                                        │
│  [   Configurar metas   ]              │
└────────────────────────────────────────┘
```

Mismo estilo visual que el resto (creamPaper background, border sutil, divider dashed).

Tap → navega a `/onboarding/macro-targets?source=banner`.

**Importante — el banner NO incluye dismiss.** Si el user no quiere configurar, simplemente lo ignora; el banner permanece. La razón: si dismissed, el user pierde la entrada al feature y la tab Comidas queda inutilizable. Aceptamos que algunos users decidan no usar esta capa, y para ellos el banner es ruido aceptable.

Si quisieras agregar un dismiss en el futuro, requiere persistir preferencia en `profiles.macro_banner_dismissed`. Por ahora no.

**Done when:** user sin targets ve el banner. User con targets ve los anillos. Banner navega correctamente.

### Tarea 6 — Componente MacroRing (anillo individual)

`/features/macros/components/MacroRing.tsx`:

SVG circular animado. Props:

```ts
{
  current: number
  target: number
  label: string
  unit: string
  color: 'protein' | 'calories'
  size?: number
}
```

Estructura SVG:

- Círculo de fondo (stroke goldDivider, opacity baja)
- Círculo de progreso (stroke según color: forestDeep para protein, copperVivid para calories)
- `stroke-dasharray = circunferencia` (= 2 _ π _ r). Para r=80 → ~502.65
- `stroke-dashoffset = circunferencia * (1 - clamp(current/target, 0, 1))`
- Animar dashoffset con `useSharedValue` + `useAnimatedProps` sobre `Animated.createAnimatedComponent(Circle)`
- Animación: `withTiming(targetOffset, { duration: 1200 })` con delay escalonado (proteína 0s, calorías 150ms)
- Cap line round
- Rotar -90deg para que empiece arriba

Texto en el centro:

- Número grande (current) en `typography.display`, size 32-34
- Subtexto pequeño (`/ {target} {unit}`) en goldBurnt

Behavior cuando current > target:

- Stroke se mantiene en 100% visualmente
- Indicador "+N" pequeño junto al número (proteína: verde sutil, calorías: cobre)
- Esto importa más en calorías (bad) que en proteína (good)

**Done when:** anillos animan al cargar, llegan al porcentaje correcto, número en el centro elegante.

### Tarea 7 — Tabla hardcoded de equivalencias proteicas

`/features/macros/proteinEquivalents.ts`:

Tabla curada para los mensajes contextuales. Solo proteínas comunes en dieta mexicana, números aproximados:

```ts
export type ProteinEquivalent = {
  food: string
  proteinPer100g: number
  category: 'pollo' | 'pescado' | 'res' | 'huevo' | 'lacteo' | 'legumbre' | 'suplemento'
}

export const PROTEIN_EQUIVALENTS: ProteinEquivalent[] = [
  { food: 'pechuga de pollo', proteinPer100g: 31, category: 'pollo' },
  { food: 'atún en lata (escurrido)', proteinPer100g: 25, category: 'pescado' },
  { food: 'salmón', proteinPer100g: 22, category: 'pescado' },
  { food: 'huevos enteros', proteinPer100g: 13, category: 'huevo' },
  { food: 'claras de huevo', proteinPer100g: 11, category: 'huevo' },
  { food: 'carne de res magra', proteinPer100g: 26, category: 'res' },
  { food: 'queso cottage', proteinPer100g: 11, category: 'lacteo' },
  { food: 'yogurt griego natural', proteinPer100g: 10, category: 'lacteo' },
  { food: 'lentejas cocidas', proteinPer100g: 9, category: 'legumbre' },
  { food: 'frijoles cocidos', proteinPer100g: 8, category: 'legumbre' },
  { food: 'whey protein (1 scoop ~30g)', proteinPer100g: 80, category: 'suplemento' },
]

export function suggestProteinSource(gramsNeeded: number, hour: number): string {
  // Snack rápido si <20g y entre comidas
  if (gramsNeeded <= 20) {
    if (hour < 11) return `2 huevos cubren ${Math.round(gramsNeeded)}g`
    if (hour >= 15 && hour < 19) return `un yogurt griego o un scoop de whey`
    return `1 scoop de whey o atún en lata`
  }

  // Comida fuerte si 20-50g
  if (gramsNeeded <= 50) {
    const grams = Math.round((gramsNeeded / 25) * 100) // basado en atún/res ~25g/100g
    if (hour >= 18) return `unos ${grams}g de pollo o pescado para la cena`
    return `unos ${grams}g de proteína magra`
  }

  // Mucho que recuperar
  return `te faltan más de 50g — 2 comidas con proteína sólida (pollo, pescado, res)`
}
```

Esta tabla es tu sustituto de LLM. Sprint 4 la reemplaza con sugerencias generadas dinámicamente.

**Done when:** función pura testeable. `suggestProteinSource(45, 19)` devuelve string razonable.

### Tarea 8 — Mensajes contextuales con sugerencias concretas

`/features/macros/logic.ts`:

```ts
import { suggestProteinSource } from './proteinEquivalents'

export function deriveMacroMessage(
  current: { protein_g: number; calories: number },
  target: { protein_g: number; calories: number },
  hour: number,
  mealCount: number,
): string {
  const proteinPct = current.protein_g / target.protein_g
  const calPct = current.calories / target.calories
  const proteinRemaining = Math.max(0, target.protein_g - current.protein_g)
  const calRemaining = Math.max(0, target.calories - current.calories)

  // Aún no come nada
  if (mealCount === 0) {
    if (hour < 11) return 'Empieza fuerte con proteína al desayuno. Huevos o yogurt griego.'
    if (hour < 16) return 'Ya es media tarde sin loggear. Empieza con algo proteico.'
    return 'No has loggeado nada hoy. ¿Olvido o ayuno?'
  }

  // Ya completó proteína
  if (proteinPct >= 1 && calPct < 1) {
    return `Proteína lista. Te quedan ${calRemaining} cal — espacio para algo de carbo.`
  }

  // Lejos en proteína, hora de cenar
  if (proteinRemaining > 30 && hour >= 17) {
    const suggestion = suggestProteinSource(proteinRemaining, hour)
    return `Te faltan ${Math.round(proteinRemaining)}g de proteína. ${capitalize(suggestion)}.`
  }

  // Lejos en proteína, pero aún hay día por delante
  if (proteinRemaining > 30 && hour < 17) {
    const suggestion = suggestProteinSource(proteinRemaining, hour)
    return `Faltan ${Math.round(proteinRemaining)}g — distribúyelos en lo que queda del día. ${capitalize(suggestion)}.`
  }

  // Bien encaminada, faltan cantidades manejables
  if (proteinPct >= 0.7 && proteinPct < 1) {
    const suggestion = suggestProteinSource(proteinRemaining, hour)
    return `Vas bien. Te quedan ${Math.round(proteinRemaining)}g — ${suggestion}.`
  }

  // Sobrepasó calorías significativamente
  if (calPct > 1.05) {
    const over = current.calories - target.calories
    return `Pasaste tu meta de calorías por ${over}. Si entrenas hoy, no pasa nada.`
  }

  // Sobrepasó proteína (es bueno generalmente)
  if (proteinPct > 1.1 && calPct <= 1) {
    return `Proteína superada. Buen día nutricional.`
  }

  // Default
  return `Te quedan ${Math.round(proteinRemaining)}g de proteína y ${calRemaining} cal.`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
```

**Done when:** mensajes se ven útiles en distintos escenarios:

- Mañana sin loggear → consejo de desayuno
- Tarde con poca proteína → sugerencia con gramos específicos
- Anocheciendo con mucho faltante → sugerencia de cena proteica
- Día completo → mensaje de cierre

### Tarea 9 — Card MacrosToday

`/features/macros/components/MacrosTodayCard.tsx`:

Estructura igual al card de Tu Racha en Sprint 2:

- Header: label "Hoy comiste" + label suave a la derecha "{count} comidas"
- Grid 2 columnas con los 2 MacroRings
- Divider horizontal con fade
- Mensaje contextual derivado de `deriveMacroMessage`

El mensaje contextual:

- Tipografía serif italic prose
- Resaltar números clave (gramos faltantes, calorías) en copperVivid no italic
- Centrado, line-height 1.5

**Done when:** card renderiza con datos reales, mensaje cambia por hora del día y consumo, sugerencias de comida son específicas y útiles.

### Tarea 10 — CTA gigante "Loggear comida"

`/features/macros/components/LogMealButton.tsx`:

Botón con gradient cobre vibrante (copperBright→copperVivid), border-radius pill, padding generoso.

```
[  📸 Loggear comida  ]
```

Texto en serif italic, 16px. Box-shadow copperShadow.

Tap → navega a `/log-meal`.

Nota: el ícono 📸 es aspiracional — Sprint 3 conecta cámara real. Por ahora el botón solo abre el form manual.

**Done when:** botón se ve protagonista, cobre vibrante destacando del cream del fondo.

### Tarea 11 — Pantalla de logueo manual

`/app/log-meal.tsx`:

Modal full-screen o stack screen con header "Loggear comida" + botón cerrar.

Form con `react-hook-form`:

- Input "¿Qué comiste?" (text, requerido) — placeholder "Pollo a la plancha con arroz"
- Input "Proteína" (numeric, requerido, sufijo "g") — placeholder "35"
- Input "Calorías" (numeric, requerido, sufijo "cal") — placeholder "520"
- Selector de hora (default: ahora) — DatePicker básico, importante para loggear comidas pasadas
- Botón "Guardar"

Validación zod:

- name: string, min 2, max 100
- protein_g: number, min 0, max 500
- calories: number, min 0, max 5000
- consumed_at: date, no en futuro, no más de 7 días en pasado

**Importante: el form acepta `defaultValues` como prop.** En este sprint siempre vienen vacíos, pero en Sprint 3 vendrán pre-llenados desde la respuesta del LLM tras analizar la foto. Diseñar el componente con esta reutilización en mente desde ahora.

Al guardar:

- Insert en `meals` con `source: 'manual'`
- Invalidar query del brief context
- Navegar de vuelta al Home
- Toast de confirmación: "Comida guardada"
- Anillos del Home re-animan con nuevos valores

**Done when:** puedes loggear "Pollo y arroz / 35g / 520 cal" y ver los anillos crecer en el Home.

### Tarea 12 — Tab Comidas (vista del día)

`/app/(tabs)/meals.tsx`:

Pantalla con lista de comidas de hoy + selector de fecha para días pasados.

Estructura:

- Header con fecha seleccionada (default "Hoy")
- Botón ‹ y › para navegar entre días
- Resumen arriba: "85g proteína · 1.470 cal · 3 comidas"
- Lista de cards, cada uno una comida:
  - Hora (08:30)
  - Nombre (Avena con plátano y proteína)
  - Macros (35g · 520 cal)
  - Tap → abre form de edición (misma pantalla que log-meal pero con `defaultValues`)
  - Swipe-to-delete con confirmación
- Si vacío: "No has loggeado nada este día" + CTA "Loggear comida"
- FAB en bottom-right "+" para loggear nueva

`/features/macros/api.ts` (agregar):

```ts
export async function getMealsForDate(date: string) {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('meal_date', date)
    .order('consumed_at', { ascending: true })
  if (error) throw error
  return data
}

export async function updateMeal(id: string, updates: Partial<Meal>) {
  const { data, error } = await supabase
    .from('meals')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMeal(id: string) {
  const { error } = await supabase.from('meals').delete().eq('id', id)
  if (error) throw error
}
```

**Done when:** puedes ver el día actual con todas las comidas, navegar a días pasados, editar y borrar.

### Tarea 13 — Integrar todo en Home + tab bar a 4 tabs

En `/app/(tabs)/index.tsx`, agregar entre el card de racha y los deltas:

```tsx
{
  /* Card de macros (o banner si no hay targets) */
}
;<Animated.View entering={FadeInDown.delay(1500)}>
  {ctx.targets ? (
    <MacrosTodayCard
      current={ctx.today_macros}
      target={ctx.targets}
      mealCount={ctx.meal_count_today}
    />
  ) : (
    <DefineTargetsBanner />
  )}
</Animated.View>

{
  /* CTA loggear comida — solo si tiene targets */
}
{
  ctx.targets && (
    <Animated.View entering={FadeInDown.delay(1700)}>
      <LogMealButton />
    </Animated.View>
  )
}

{
  /* Resto: deltas, ancla, swipe, mood — con delays ajustados */
}
```

Ajustar delays:

- Antes (Sprint 2): deltas 1700, ancla 1850, swipe 2000, actions 2150, mood 2150
- Ahora: macros 1500, log button 1700, deltas 1900, ancla 2050, swipe 2200, actions 2350, mood 2350

Tab bar a 4 tabs: agregar `meals` entre `index` y `progress`. Ícono 🍽 (placeholder, considerar reemplazar por SVG custom después).

**Done when:** Home renderiza con cascada coherente. Las 4 tabs funcionan. Si no hay targets, se ve el banner y NO el botón de loggear (no tendría sentido).

### Tarea 14 — Animación de update de anillos

Cuando guardas una comida desde `/log-meal`, regresas al Home y los anillos deben re-animar al nuevo valor (no aparecer estáticos).

Implementación:

- Guardar el valor anterior con `usePrevious` o `useEffect`
- Cuando `current` cambia, animar el dashoffset desde el valor anterior al nuevo con `withTiming(newOffset, { duration: 800 })`
- Sin esto, el anillo se actualiza instantáneo y no se siente vivo

**Done when:** loggear comida → regresar al Home → ver anillos crecer suavemente al nuevo valor durante ~800ms.

### Tarea 15 — Seed data de prueba

Actualizar `/scripts/seed.ts` o `/supabase/seed.sql` para incluir:

- 1 row en `macro_targets` (130g proteína, 1800 cal) para el user de prueba
- 3 meals de hoy: desayuno (8:30, 35g, 450 cal), comida (14:00, 40g, 700 cal), snack (17:00, 10g, 320 cal) — total 85g/1470cal

Esto permite ver el Home con anillos en buen porcentaje sin loggear manualmente cada vez que reseteas.

---

## Acceptance criteria (Sprint 2.5 done)

1. Onboarding inicial nuevo incluye paso opcional de macros con botón "Más tarde"
2. Skip de targets en onboarding deja al user en Home con banner persistente
3. Banner "Define tus metas" navega a la pantalla de configuración
4. Configurar 130g/1800cal persiste y reemplaza el banner por anillos al recargar
5. Anillos animan al abrir Home: stroke-dashoffset se llena al porcentaje correcto en ~1.2s, escalonado proteína→calorías
6. Mensaje contextual cambia útilmente según hora del día y consumo (al menos 6 escenarios distintos cubiertos)
7. Sugerencias de comida son específicas y razonables ("200g de pollo cubre 60g de proteína", no "come más proteína")
8. Tap "Loggear comida" abre form, puedes guardar manualmente, vuelves al Home con anillos actualizados (con animación de transición)
9. Tab Comidas muestra lista de hoy, puedes editar y borrar comidas individuales
10. Navegar a días pasados en tab Comidas funciona
11. Editar comida reusa el mismo componente form que crear (con defaultValues)
12. Si proteína >= 100% pero calorías no, mensaje refleja ese estado
13. Si calorías > 105%, mensaje indica overshoot
14. Tab bar tiene 4 tabs (Hoy, Comidas, Progreso, Ajustes)
15. Si no hay targets, no se muestra el botón "Loggear comida" (no tendría sentido sin metas)
16. RLS verificado: user B no puede leer meals ni targets de user A
17. `pnpm typecheck` y `pnpm lint` pasan sin errores
18. Cero hex sueltos en código nuevo — todo vía tokens de `/theme`

---

## Lo que NO se hace en Sprint 2.5

- Captura por foto + Anthropic IA → Sprint 3
- Texto libre tipo "pollo con arroz" → IA → Sprint 3
- Mensajes contextuales generados con LLM → Sprint 4 (los reemplaza con calidad superior)
- Calculadora de macros para users sin metas → post-MVP (no es nuestro problema central, los users tienen sus números)
- Recetas guardadas / favoritos → post-MVP
- Buscar en DB de alimentos → nunca (no es parte del producto)
- Código de barras → nunca
- Histórico más allá de día por día → post-MVP
- Gráficas de macros en el tiempo → post-MVP
- Notificaciones tipo "no has loggeado en 4 horas" → post-MVP
- Dismiss del banner de "Define tus metas" → considerarlo en post-MVP si datos lo justifican
- Integración con Apple Health para auto-popular calorías quemadas → Sprint 4 con HealthKit

---

## Notas para Claude Code

- **El form de comida es código que se queda.** Sprint 3 le añade una pantalla previa de "toma foto → IA llena los campos → tú confirmas/editas en este mismo form". Por eso debe aceptar `defaultValues` como prop desde ahora.
- **Anillos con AnimatedCircle de Reanimated:** importar `Animated.createAnimatedComponent(Circle)` de react-native-svg. Animar `strokeDashoffset` con `useAnimatedProps`, no como style.
- **Cuidado con la circunferencia:** para `r=80` la circunferencia es `~502.65`. Para otros radios: `2 * Math.PI * radius`.
- **Edge case de targets:** si el user borra y recrea targets diferentes, los anillos cambian de proporción. Eso es intencional.
- **Mensajes contextuales son temporales.** No invertir tiempo perfeccionando los strings — Sprint 4 los reemplaza con LLM. El bar es "razonablemente útil con sugerencias concretas", no "óptimo".
- **La tabla de equivalencias proteicas es throwaway pero útil.** Sprint 4 la reemplaza con LLM dinámico, pero por ahora sirve para que el producto se sienta inteligente desde Sprint 2.5.
- **Edición de comida pasada:** importante que `meal_date` sea generated column desde `consumed_at`, así si editas la fecha de una comida vieja, automáticamente se mueve al día correcto.
- **Selector de hora:** `@react-native-community/datetimepicker` es estándar. Default a "ahora", permitir hasta 7 días atrás.
- **Toast de confirmación:** `react-native-toast-message` o equivalente. NO usar `Alert.alert` — invasivo.
- **Optimistic update al guardar comida:** opcional pero recomendado — los anillos pueden actualizar antes de que el insert termine.
- **Banner sin dismiss es decisión consciente.** No agregar dismiss aunque parezca natural — perderías a users que se quedan en estado vacío permanente.
- **Commits atómicos:** uno por componente, uno por API endpoint.
- **Al cerrar el sprint:** valida los 18 Acceptance Criteria uno por uno.
