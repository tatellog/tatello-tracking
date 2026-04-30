# Sprint Foundation — La app que usas todos los días

**Tipo:** Sprint completo de fundación. Bugfix + completion + rediseño Pareto del log de comida.

**Por qué este nombre:** este sprint es la fundación sobre la que se construye el resto. Sin él, los demás sprints (onboarding, IA, HealthKit) están construidos sobre arena. Al cerrarlo, tienes una app que se siente terminada en sus features básicas y que ya puedes usar tú misma todos los días.

**Objetivo concreto:** Que en 6-8 días puedas usar la app 7 días seguidos sin abrir el código para arreglar nada. Loggeas comidas en 2-3 taps cuando ya tienes historial. Marcar entreno funciona. Anillos de macros muestran datos correctos. Settings y Progress son funcionales. Navegación entre días es clara.

**Definition of done:** una semana entera de uso real sin frustraciones técnicas.

---

## Prerequisitos

- Sprints 0, 1, 2, 2.5, 2-task-9 ejecutados (76 commits acumulados)
- Conocimiento del inventario de bugs (ya capturado en sesiones previas)

## Decisiones tomadas para este sprint

- **Auth real: pospuesto** (post-sprint). Mientras tanto, dev user auto-login para acelerar dev loop.
- **Settings: mínimo** (editar metas + sign out + perfil básico)
- **Progress: mínimo** (gráfica simple de peso histórico)
- **Comidas: rediseño Pareto del log** validado visualmente:
  - Header dinámico con meal type por hora
  - 3 sugerencias en lista vertical (la primera destacada con border malva)
  - Inputs manuales abajo como plan B
  - Plato lleno con border malva + números Inter Tight grandes
  - Mensaje contextual ("Después de esta cena: 125g de proteína · cerraste el día.")
  - 2 botones redundantes → mantener solo el FAB
  - Navegación entre días con DateNavigator
- **Filosofía Pareto:** el 20% del trabajo que da el 80% del valor.

**Lo que se ELIMINÓ del MVP del log de comida (puede volver post-validación):**

- Bottom sheet selector con chips (10/25/35/50)
- Animaciones de barras horizontales con proyección
- Time tag editable con "Hace un momento"
- Diferenciación visual entre "Lo de ayer" / "Favorito 14×" / "Hace 3 días"
- Action links separados ("Cambiar plato", "Ajustar porción")
- Eyebrow "3a comida del día"
- Animaciones de números cambiando en vivo

---

## Stack adicional

```bash
pnpm add victory-native@^41
```

Para gráfica de peso histórico (Progress).

```bash
pnpm add @expo/react-native-action-sheet
```

Opcional para action sheet de "Cambiar o editar" en log de comida (modal). Si no, fallback a `Alert.alert` nativo.

---

## Estimación por bloque

| Bloque    | Contenido                                | Tiempo                 |
| --------- | ---------------------------------------- | ---------------------- |
| 0         | Dev user auto-login + seed               | 0.5d                   |
| 1         | Bugs críticos (marcar entreno + anillos) | 1-1.5d                 |
| 2         | Settings mínimo                          | 1d                     |
| 3         | Progress (gráfica peso)                  | 1.5d                   |
| 4         | Comidas (rediseño Pareto + UX fixes)     | 2-2.5d                 |
| **Total** |                                          | **6-8 días efectivos** |

A 2 tardes/semana = ~3-4 semanas calendario.

---

## Tareas en orden de ejecución

### Bloque 0 — Setup de dev user

**PRIMERO. Sin esto no puedes debuggear los demás bugs.**

#### Tarea 0.1 — Dev user auto-login

En Supabase dashboard:

1. Authentication → Users → Add user manually
2. Email: `dev@local.test`, Password: `devpassword123`
3. Email confirmed: ✓
4. Copiar el UUID

`/lib/devAuth.ts`:

```ts
import { supabase } from './supabase'

const DEV_EMAIL = 'dev@local.test'
const DEV_PASSWORD = 'devpassword123'

export async function ensureDevUserSession() {
  if (!__DEV__) return

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session) {
    console.log('[devAuth] Already signed in as', session.user.email)
    return
  }

  console.log('[devAuth] Signing in dev user...')
  const { data, error } = await supabase.auth.signInWithPassword({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
  })

  if (error) {
    console.error('[devAuth] Sign in failed:', error.message)
    return
  }
  console.log('[devAuth] Signed in as', data.user?.email)
}
```

Llamar en `/app/_layout.tsx` antes del root render:

```tsx
useEffect(() => {
  ensureDevUserSession()
}, [])
```

Si auth real entra después, eliminar este flow con un commit limpio: `chore: remove dev auto-login`.

#### Tarea 0.2 — Seed data en el dev user

Script `/scripts/seed-dev-user.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // NO usar anon
const DEV_USER_ID = '<UUID_DEL_DEV_USER>'

const admin = createClient(supabaseUrl, serviceKey)

async function seed() {
  console.log('Cleaning existing data...')
  await admin.from('workouts').delete().eq('user_id', DEV_USER_ID)
  await admin.from('meals').delete().eq('user_id', DEV_USER_ID)
  await admin.from('body_measurements').delete().eq('user_id', DEV_USER_ID)
  await admin.from('macro_targets').delete().eq('user_id', DEV_USER_ID)

  // 14 días de workouts (rachas pasadas)
  const today = new Date()
  const workouts = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    if (Math.random() > 0.2) {
      // 80% de días con workout
      workouts.push({
        user_id: DEV_USER_ID,
        completed_at: d.toISOString(),
      })
    }
  }
  await admin.from('workouts').insert(workouts)

  // Macro targets
  await admin.from('macro_targets').insert({
    user_id: DEV_USER_ID,
    protein_g: 130,
    calories: 1800,
    valid_from: '2024-01-01',
  })

  // 14 días de meals (3-4 por día con variedad)
  const meals = []
  const RECETARIO = [
    { name: 'Avena con plátano', meal_type: 'breakfast', protein_g: 18, calories: 380 },
    { name: 'Yogurt griego con almendras', meal_type: 'breakfast', protein_g: 22, calories: 320 },
    { name: 'Huevos con aguacate', meal_type: 'breakfast', protein_g: 24, calories: 420 },
    { name: 'Pollo con arroz y verduras', meal_type: 'lunch', protein_g: 40, calories: 520 },
    { name: 'Salmón con quinoa', meal_type: 'lunch', protein_g: 38, calories: 480 },
    { name: 'Tacos de pescado', meal_type: 'lunch', protein_g: 32, calories: 620 },
    { name: 'Pollo con arroz y verduras', meal_type: 'dinner', protein_g: 40, calories: 520 }, // mismo de comida — esto crea el patrón "lo de ayer"
    { name: 'Ensalada con atún', meal_type: 'dinner', protein_g: 35, calories: 380 },
    { name: 'Manzana con crema de cacahuate', meal_type: 'snack', protein_g: 6, calories: 200 },
  ]
  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)

    // Desayuno
    const b = RECETARIO[Math.floor(Math.random() * 3)]
    const bDate = new Date(d)
    bDate.setHours(8, 30)
    meals.push({ user_id: DEV_USER_ID, ...b, consumed_at: bDate.toISOString() })

    // Comida
    const l = RECETARIO[3 + Math.floor(Math.random() * 3)]
    const lDate = new Date(d)
    lDate.setHours(14, 0)
    meals.push({ user_id: DEV_USER_ID, ...l, consumed_at: lDate.toISOString() })

    // Cena (alta probabilidad de que sea pollo con arroz para crear "lo de ayer")
    const dn =
      i < 2
        ? RECETARIO[6] // pollo con arroz para que "lo de ayer" funcione hoy
        : RECETARIO[6 + Math.floor(Math.random() * 2)]
    const dDate = new Date(d)
    dDate.setHours(19, 30)
    meals.push({ user_id: DEV_USER_ID, ...dn, consumed_at: dDate.toISOString() })
  }
  await admin.from('meals').insert(meals)

  // Body measurements (1 por semana)
  const measurements = []
  for (let i = 0; i < 8; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i * 7)
    measurements.push({
      user_id: DEV_USER_ID,
      measured_at: d.toISOString(),
      weight_kg: 76.2 - i * 0.3 + (Math.random() - 0.5) * 0.4,
    })
  }
  await admin.from('body_measurements').insert(measurements)

  console.log('Seeded:', {
    workouts: workouts.length,
    meals: meals.length,
    measurements: measurements.length,
  })
}

seed().catch(console.error)
```

Ejecutar: `pnpm tsx scripts/seed-dev-user.ts` (instalar `tsx` si no está).

`SUPABASE_SERVICE_ROLE_KEY` viene del Supabase dashboard → Project Settings → API → `service_role` key. NO commitear.

---

### Bloque 1 — Bugs críticos

#### Tarea 1.1 — Arreglar marcar entreno

**Síntoma actual:** tap en TodayTile no hace nada o falla.

**Diagnósticos probables (en orden):**

1. **Pointer events del halo bloquean el tap**
   - El halo animado (`haloRing`) es un `<View>` absolute encima del tile
   - Verificar que tenga `pointerEvents="none"`
   - Si no lo tiene, agrégalo

2. **Auth no listo cuando se llama mutation**
   - Ya con dev user auto-login esto debería funcionar
   - Verificar logs: si dice "No auth" en `markWorkout` mutation, el dev login todavía no estaba listo. Agregar `enabled: !!session?.user` a la query / espera

3. **Query invalidation incorrecta**
   - La invalidación de `['briefContext']` puede no estar disparándose
   - Verificar `queryClient.invalidateQueries(['briefContext'])` en `onSuccess` de la mutation
   - También invalidar `['streakDays']` si es query separada

4. **Trigger `set_first_workout_at` rompe el insert**
   - Si Sprint 2.6 ya corrió el trigger pero tiene bug, el insert falla
   - Verificar logs de Postgres
   - Solución temporal: `drop trigger trg_set_first_workout_at` mientras debugueas, luego volver a crearlo

**Process de debug:**

1. Tap en tile → `console.log('[tile] tapped')` al inicio del handler
2. Si no llega ni el log → es pointer events, layout, o el handler no está registrado
3. Si llega pero no se ejecuta la mutation → revisar el spread de la mutation
4. Si la mutation falla → leer el error de Supabase (logs)
5. Si el insert succeed pero la UI no actualiza → query invalidation

Documentar el diagnóstico en commit message: `fix: tile pointer events blocked by halo`

#### Tarea 1.2 — Arreglar datos de anillos de macros

**Síntoma:** los anillos del Home no muestran las cantidades correctas (o muestran data vieja, o fallan al sumar).

**Diagnósticos probables:**

1. **Query de macros del día filtra mal por timezone**
   - El filtro probablemente es `consumed_at >= today_start` con `today_start = new Date().setHours(0,0,0,0)`
   - Si usas Date directamente en Supabase, el cliente y el server pueden estar en timezones distintos
   - Solución: pasar fechas como strings ISO con explicit timezone, o calcular el rango de día en el server con una RPC

2. **Sum no agrupa bien**
   - Si el query usa `.select('protein_g, calories')` y suma en JS, OK
   - Si usa SQL `sum`, verificar el RPC

3. **Cache de TanStack Query stale**
   - Verificar que `queryClient.invalidateQueries(['todayMacros'])` se llame en `onSuccess` de logging meal mutation

**Test:** loggea una comida con 30g proteína. El anillo debe sumar 30g. Si no, el bug está en el flow del invalidate o query.

---

### Bloque 2 — Settings mínimo

#### Tarea 2.1 — Implementar Settings

`/app/(tabs)/settings.tsx`:

Estructura:

- Header simple con título "Ajustes"
- Sección "Mi perfil": display_name, age, height, biological_sex (read-only por ahora — edit en Sprint 2.6)
- Sección "Mis metas":
  - Card con proteína g y calorías
  - Tap → abre modal `EditTargetsModal` con dos NumberInputs
  - Save → upsert en `macro_targets` con `valid_from` = hoy (preserva histórico)
- Sección "Cuenta":
  - Versión de la app
  - Sign out (con confirm Alert)

Componente `EditTargetsModal`:

```tsx
<Modal visible animationType="slide">
  <SafeAreaView>
    <View style={{ padding: 20 }}>
      <Text style={styles.title}>Editar metas</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Proteína (g)</Text>
        <TextInput value={protein} onChangeText={setProtein} keyboardType="number-pad" />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Calorías</Text>
        <TextInput value={calories} onChangeText={setCalories} keyboardType="number-pad" />
      </View>
      <Pressable onPress={save} style={styles.cta}>
        <Text>Guardar</Text>
      </Pressable>
      <Pressable onPress={onClose}>
        <Text>Cancelar</Text>
      </Pressable>
    </View>
  </SafeAreaView>
</Modal>
```

Validación: 50 ≤ protein ≤ 300, 1000 ≤ calories ≤ 5000.

Sign out: `await supabase.auth.signOut()` luego `router.replace('/auth')`. Pero como auth real no existe todavía, en dev solo dejarlo sin acción real ("Cerrar sesión disabled en dev").

---

### Bloque 3 — Progress (gráfica de peso)

#### Tarea 3.1 — Gráfica de peso histórico

`/app/(tabs)/progress.tsx`:

Estructura:

- Header simple con título "Progreso"
- Card grande con gráfica de peso (line chart)
- CTA "Registrar peso" abajo
- Lista de últimas 5 mediciones debajo

Componente `WeightChart`:

```tsx
import { CartesianChart, Line } from 'victory-native'

function WeightChart({ data }: { data: Array<{ date: Date; weight: number }> }) {
  if (!data.length) return <EmptyState />

  return (
    <View style={{ height: 220 }}>
      <CartesianChart
        data={data}
        xKey="date"
        yKeys={['weight']}
        domain={{ y: [minWeight - 1, maxWeight + 1] }}
        axisOptions={{
          tickCount: { x: 4, y: 5 },
          labelColor: colors.labelMuted,
        }}
      >
        {({ points }) => (
          <Line
            points={points.weight}
            color={colors.mauveDeep}
            strokeWidth={2}
            curveType="monotoneX"
          />
        )}
      </CartesianChart>
    </View>
  )
}
```

Estado vacío: "Aún no hay mediciones. Registra tu peso para empezar a ver tu progreso."

Hook:

```ts
export function useBodyMeasurements() {
  return useQuery({
    queryKey: ['bodyMeasurements'],
    queryFn: async () => {
      const { data } = await supabase
        .from('body_measurements')
        .select('*')
        .order('measured_at', { ascending: true })
      return data ?? []
    },
  })
}
```

#### Tarea 3.2 — Pantalla de log de medida

`/app/measurement/log.tsx`:

- Modal slide-up
- Pregunta "¿Cuánto pesas?" en Inter Tight Light grande
- NumberInput con value, unit "kg", decimal=true
- DatePicker (default: ahora) para `measured_at`
- CTA "Guardar"

Insert en `body_measurements`. Invalidate `['bodyMeasurements']`.

---

### Bloque 4 — Comidas (rediseño Pareto + UX fixes)

**Este bloque es el más grande del sprint.** Cubre 3 sub-tareas: rediseño del log, eliminar redundancia de botones, navegación entre días.

#### Tarea 4.1 — Rediseño Pareto del log de comida

##### 4.1.1 — Helper `inferMealType` y copy localizado

`/features/meals/utils/mealType.ts`:

```ts
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

type MealCopy = {
  type: MealType
  label: string // "Desayuno", "Comida", "Cena", "Snack"
  verb: string // "desayunaste", "comiste", "cenaste", "comiste de snack"
  saveLabel: string // "Guardar desayuno", etc.
}

export function inferMealType(date: Date = new Date()): MealCopy {
  const hour = date.getHours()
  if (hour >= 5 && hour < 11) {
    return {
      type: 'breakfast',
      label: 'Desayuno',
      verb: 'desayunaste',
      saveLabel: 'Guardar desayuno',
    }
  }
  if (hour >= 11 && hour < 16) {
    return { type: 'lunch', label: 'Comida', verb: 'comiste', saveLabel: 'Guardar comida' }
  }
  if (hour >= 16 && hour < 21) {
    return { type: 'dinner', label: 'Cena', verb: 'cenaste', saveLabel: 'Guardar cena' }
  }
  return { type: 'snack', label: 'Snack', verb: 'comiste de snack', saveLabel: 'Guardar snack' }
}

export function formatMealHeaderTime(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const period = hours >= 12 ? 'pm' : 'am'
  const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${h12}:${minutes.toString().padStart(2, '0')}${period}`
}
```

##### 4.1.2 — RPC `get_meal_suggestions`

Migration nueva:

```sql
create or replace function public.get_meal_suggestions(
  p_meal_type text,
  p_limit int default 3
)
returns table (
  id uuid,
  source text,
  name text,
  protein_g numeric,
  calories int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  return query
  with yesterday_meal as (
    select m.id, 'yesterday'::text as source, m.name, m.protein_g, m.calories, 1 as rank
    from meals m
    where m.user_id = v_user_id
      and m.meal_type = p_meal_type
      and m.consumed_at::date = (now() - interval '1 day')::date
    order by m.consumed_at desc
    limit 1
  ),
  recent_meals as (
    select distinct on (m.name) m.id, 'recent'::text as source, m.name, m.protein_g, m.calories,
           row_number() over (order by m.consumed_at desc) + 1 as rank
    from meals m
    where m.user_id = v_user_id
      and m.meal_type = p_meal_type
      and m.consumed_at >= now() - interval '14 days'
      and m.id not in (select coalesce(id, '00000000-0000-0000-0000-000000000000'::uuid) from yesterday_meal)
  )
  select sub.id, sub.source, sub.name, sub.protein_g, sub.calories
  from (
    select * from yesterday_meal
    union all
    select * from recent_meals
  ) sub
  order by rank
  limit p_limit;
end;
$$;

grant execute on function public.get_meal_suggestions to authenticated;
```

Regenerar types: `pnpm types:db`.

##### 4.1.3 — Hook `useMealSuggestions`

`/features/meals/hooks/useMealSuggestions.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MealType } from '../utils/mealType'

export type MealSuggestion = {
  id: string
  source: 'yesterday' | 'recent'
  name: string
  protein_g: number
  calories: number
}

export function useMealSuggestions(mealType: MealType) {
  return useQuery({
    queryKey: ['mealSuggestions', mealType],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_meal_suggestions', {
        p_meal_type: mealType,
        p_limit: 3,
      })
      if (error) throw error
      return (data ?? []) as MealSuggestion[]
    },
    staleTime: 1000 * 60 * 5, // 5 min cache
  })
}
```

##### 4.1.4 — Pantalla nueva `/app/meal/log-meal.tsx`

Reemplazar la pantalla actual completa.

```tsx
import { useState, useMemo } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'

import { inferMealType, formatMealHeaderTime } from '@/features/meals/utils/mealType'
import { useMealSuggestions, type MealSuggestion } from '@/features/meals/hooks/useMealSuggestions'
import { useLogMeal } from '@/features/meals/hooks/useLogMeal'
import { useTodayMacros } from '@/features/meals/hooks/useTodayMacros'
import { useMacroTargets } from '@/features/macros/hooks/useMacroTargets'
import { colors } from '@/theme/colors'

import { OrnamentShape } from '@/features/onboarding/components/OrnamentShape' // si existe de Sprint 2.6, reusar
import { SuggestionsList } from '@/features/meals/components/SuggestionsList'
import { FilledMealCard } from '@/features/meals/components/FilledMealCard'
import { FeedbackCard } from '@/features/meals/components/FeedbackCard'
import { ManualInputs } from '@/features/meals/components/ManualInputs'
import { DividerWithText } from '@/components/DividerWithText'

export default function LogMealScreen() {
  const router = useRouter()
  const now = useMemo(() => new Date(), [])
  const meal = useMemo(() => inferMealType(now), [now])

  // Estados
  const [selectedSuggestion, setSelectedSuggestion] = useState<MealSuggestion | null>(null)
  const [manualName, setManualName] = useState('')
  const [manualProtein, setManualProtein] = useState('')
  const [manualCalories, setManualCalories] = useState('')

  // Data
  const { data: suggestions = [] } = useMealSuggestions(meal.type)
  const { data: todayMacros } = useTodayMacros()
  const { data: targets } = useMacroTargets()
  const logMeal = useLogMeal()

  // Estado computado: ¿hay plato seleccionado o data manual?
  const hasFilledMeal =
    selectedSuggestion !== null ||
    (manualName.trim().length > 0 &&
      parseFloat(manualProtein) > 0 &&
      parseFloat(manualCalories) > 0)

  // Macros del plato actual (sea suggestion o manual)
  const currentMeal = useMemo(() => {
    if (selectedSuggestion) {
      return {
        name: selectedSuggestion.name,
        protein_g: selectedSuggestion.protein_g,
        calories: selectedSuggestion.calories,
      }
    }
    return {
      name: manualName.trim(),
      protein_g: parseFloat(manualProtein) || 0,
      calories: parseInt(manualCalories) || 0,
    }
  }, [selectedSuggestion, manualName, manualProtein, manualCalories])

  // Proyección post-guardar
  const projected = useMemo(() => {
    const baseProtein = todayMacros?.protein_g ?? 0
    const baseCal = todayMacros?.calories ?? 0
    return {
      protein: baseProtein + currentMeal.protein_g,
      calories: baseCal + currentMeal.calories,
    }
  }, [todayMacros, currentMeal])

  // Handlers
  const handleSelectSuggestion = (s: MealSuggestion) => {
    Haptics.selectionAsync()
    setSelectedSuggestion(s)
    // Limpiar manual (porque ya hay plato seleccionado)
    setManualName('')
    setManualProtein('')
    setManualCalories('')
  }

  const handleChangeOrEdit = () => {
    setSelectedSuggestion(null)
  }

  const handleSave = async () => {
    if (!hasFilledMeal) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    try {
      await logMeal.mutateAsync({
        meal_type: meal.type,
        name: currentMeal.name,
        protein_g: currentMeal.protein_g,
        calories: currentMeal.calories,
        consumed_at: now.toISOString(),
      })
      router.back()
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar. Intenta de nuevo.')
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.pearlBase }}>
      <OrnamentShape variant="tr" />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 22, paddingTop: 26 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ marginBottom: 22 }}>
          <Text style={styles.eyebrow}>
            {meal.label} · {formatMealHeaderTime(now)}
          </Text>
          <Text style={styles.title}>
            ¿Qué <Text style={styles.titleEmphasis}>{meal.verb}</Text>?
          </Text>
        </View>

        {/* Estado A: sin plato → mostrar sugerencias + inputs manuales */}
        {!selectedSuggestion && (
          <>
            <SuggestionsList suggestions={suggestions} onSelect={handleSelectSuggestion} />
            <DividerWithText text="o escribe" />
            <ManualInputs
              name={manualName}
              onNameChange={setManualName}
              protein={manualProtein}
              onProteinChange={setManualProtein}
              calories={manualCalories}
              onCaloriesChange={setManualCalories}
              mealVerb={meal.verb}
            />
          </>
        )}

        {/* Estado B: plato lleno → card grande + feedback */}
        {selectedSuggestion && (
          <>
            <FilledMealCard
              name={currentMeal.name}
              protein_g={currentMeal.protein_g}
              calories={currentMeal.calories}
              onChangeOrEdit={handleChangeOrEdit}
            />
            {targets && (
              <FeedbackCard
                projected={projected}
                targets={targets}
                mealLabel={meal.label.toLowerCase()}
              />
            )}
          </>
        )}
      </ScrollView>

      {/* Footer fijo */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleSave}
          disabled={!hasFilledMeal}
          style={[styles.cta, !hasFilledMeal && styles.ctaDisabled]}
        >
          {hasFilledMeal ? (
            <LinearGradient
              colors={[colors.mauveLight, colors.mauveDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          ) : null}
          <Text style={[styles.ctaLabel, !hasFilledMeal && styles.ctaLabelDisabled]}>
            {meal.saveLabel}
          </Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.ctaSecondary}>Cancelar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
```

Estilos del header y CTA:

```ts
const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.mauveDeep,
    marginBottom: 6,
  },
  title: {
    fontFamily: 'InterTight_300Light',
    fontSize: 32,
    letterSpacing: -1.4,
    color: colors.inkPrimary,
    lineHeight: 34,
  },
  titleEmphasis: {
    fontFamily: 'InterTight_500Medium',
    color: colors.mauveDeep,
  },
  footer: {
    padding: 14,
    paddingHorizontal: 22,
    paddingBottom: 22,
    backgroundColor: colors.pearlBase,
    borderTopWidth: 0.5,
    borderTopColor: colors.borderSubtle,
  },
  cta: {
    padding: 15,
    borderRadius: 100,
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 4,
    shadowColor: colors.mauveShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 14,
  },
  ctaDisabled: {
    backgroundColor: colors.borderSubtle,
    shadowOpacity: 0,
  },
  ctaLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14.5,
    letterSpacing: 0.3,
    color: colors.pearlElevated,
  },
  ctaLabelDisabled: {
    color: colors.labelDim,
  },
  ctaSecondary: {
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: colors.labelDim,
    padding: 10,
  },
})
```

##### 4.1.5 — Componente `SuggestionsList`

`/features/meals/components/SuggestionsList.tsx`:

```tsx
type SuggestionsListProps = {
  suggestions: MealSuggestion[]
  onSelect: (s: MealSuggestion) => void
}

export function SuggestionsList({ suggestions, onSelect }: SuggestionsListProps) {
  if (suggestions.length === 0) {
    return null // Si no hay sugerencias (user nuevo), solo se muestran inputs manuales
  }

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Probable</Text>
        <Text style={styles.labelSoft}>
          {suggestions.length} {suggestions.length === 1 ? 'opción' : 'opciones'}
        </Text>
      </View>

      <View style={{ gap: 8, marginBottom: 22 }}>
        {suggestions.map((s, idx) => (
          <Pressable
            key={s.id}
            onPress={() => onSelect(s)}
            style={[styles.item, idx === 0 && styles.itemSpecial]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.tag, idx === 0 ? styles.tagSpecial : styles.tagMuted]}>
                {s.source === 'yesterday' ? 'Lo de ayer' : 'Reciente'}
              </Text>
              <Text style={styles.name}>{s.name}</Text>
              <Text style={styles.stats}>
                <Text style={styles.statsBold}>{s.protein_g}g</Text> proteína ·{' '}
                <Text style={styles.statsBold}>{s.calories}</Text> cal
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
```

Estilos clave:

- `item`: bg `pearlElevated`, border 0.5 `borderSubtle`, borderRadius 14, padding 14px 16px, flexDirection row, justifyContent space-between, gap 10, alignItems center
- `itemSpecial`: border 1px `mauveDeep`, bg gradient `[pearlElevated, '#FCF7F9']` (LinearGradient absolute child), boxShadow `mauveShadow`
- `tag`: Inter UI 9px weight 600 letterSpacing 1.6 uppercase, mb 4
- `tagSpecial`: color `mauveDeep`
- `tagMuted`: color `labelDim`
- `name`: Inter UI 14px weight 500 color `inkPrimary` lineHeight 18 mb 1
- `stats`: Inter UI 11px color `labelMuted`
- `statsBold`: Inter Tight 11px weight 500 letterSpacing -0.2 color `inkPrimary`
- `arrow`: Inter Tight 22px weight 200 color `labelDim`

Para el gradient de `itemSpecial`, opción A (más simple):

```tsx
<Pressable style={[styles.item, idx === 0 && styles.itemSpecialBase]}>
  {idx === 0 && (
    <LinearGradient
      colors={[colors.pearlElevated, '#FCF7F9']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
  )}
  {/* contenido */}
</Pressable>
```

##### 4.1.6 — Componente `FilledMealCard`

`/features/meals/components/FilledMealCard.tsx`:

```tsx
type FilledMealCardProps = {
  name: string
  protein_g: number
  calories: number
  onChangeOrEdit: () => void
}

export function FilledMealCard({ name, protein_g, calories, onChangeOrEdit }: FilledMealCardProps) {
  const handleChangeOrEdit = () => {
    Alert.alert('Cambiar plato', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Elegir otra sugerencia', onPress: onChangeOrEdit },
      {
        text: 'Editar números',
        onPress: () => {
          /* TODO: modal de edit */
        },
      },
    ])
  }

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[colors.pearlElevated, '#FCF7F9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <Text style={styles.tag}>Tu plato</Text>
      <Text style={styles.name}>{name}</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <View style={styles.numRow}>
            <Text style={styles.num}>{protein_g}</Text>
            <Text style={styles.unit}>g</Text>
          </View>
          <Text style={styles.statLabel}>Proteína</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <View style={styles.numRow}>
            <Text style={styles.num}>{calories}</Text>
            <Text style={styles.unit}>cal</Text>
          </View>
          <Text style={styles.statLabel}>Calorías</Text>
        </View>
      </View>

      <Pressable onPress={handleChangeOrEdit} style={styles.linkWrap}>
        <Text style={styles.link}>Cambiar o editar →</Text>
      </Pressable>
    </View>
  )
}
```

Estilos:

- `card`: borderRadius 18, padding 18, mb 16, border 1px `mauveDeep`, position relative, overflow hidden, shadow malva
- `tag`: Inter UI 9px weight 600 letterSpacing 2 uppercase color `mauveDeep` mb 6
- `name`: Inter Tight 20px weight 400 letterSpacing -0.5 color `inkPrimary` lineHeight 24 mb 14
- `statsRow`: flexDirection row justifyContent space-around alignItems center
- `stat`: flexDirection column alignItems center gap 4
- `numRow`: flexDirection row alignItems baseline gap 3
- `num`: Inter Tight 32px weight 300 letterSpacing -1.2 color `inkPrimary` lineHeight 32
- `unit`: Inter UI 13px weight 500 color `labelMuted`
- `statLabel`: Inter UI 9px weight 600 letterSpacing 2 uppercase color `mauveDeep`
- `divider`: width 0.5px height 50 backgroundColor `borderSubtle` (idealmente con gradient masking pero StyleSheet de RN no lo soporta directo, usar View simple)
- `linkWrap`: mt 14 pt 12 borderTopWidth 0.5 borderTopColor `borderSubtle` borderStyle dashed
- `link`: Inter UI 11px weight 500 letterSpacing 1 uppercase color `labelMuted` textAlign center

##### 4.1.7 — Componente `FeedbackCard`

`/features/meals/components/FeedbackCard.tsx`:

```tsx
type FeedbackCardProps = {
  projected: { protein: number; calories: number }
  targets: { protein_g: number; calories: number }
  mealLabel: string // "desayuno", "comida", "cena", "snack"
}

export function FeedbackCard({ projected, targets, mealLabel }: FeedbackCardProps) {
  const message = useMemo(() => {
    const proteinPct = projected.protein / targets.protein_g
    const calPct = projected.calories / targets.calories

    if (proteinPct >= 1) {
      return {
        text: `Después de esta ${mealLabel}: <strong>${Math.round(projected.protein)}g</strong> de proteína · <strong>cerraste el día</strong>.`,
      }
    }

    const remaining = targets.protein_g - projected.protein
    return {
      text: `Después de esta ${mealLabel}: <strong>${Math.round(projected.protein)}g</strong> de proteína · te faltan <strong>${Math.round(remaining)}g</strong>.`,
    }
  }, [projected, targets, mealLabel])

  return (
    <View style={styles.card}>
      <Text style={styles.text}>{renderHTML(message.text)}</Text>
    </View>
  )
}

function renderHTML(html: string) {
  // Parse simple <strong>...</strong> y devuelve <Text> con styles
  const parts = html.split(/(<strong>.*?<\/strong>)/g)
  return parts.map((part, i) => {
    if (part.startsWith('<strong>')) {
      const inner = part.replace(/<\/?strong>/g, '')
      return (
        <Text key={i} style={{ color: colors.mauveDeep, fontWeight: '600' }}>
          {inner}
        </Text>
      )
    }
    return <Text key={i}>{part}</Text>
  })
}
```

Estilos:

- `card`: bg `rgba(168, 94, 124, 0.08)` borderRadius 14 padding 14px 16px
- `text`: Inter UI 13px lineHeight 19.5 color `inkPrimary` textAlign center

Variantes de mensaje según contexto (lo dejamos hardcoded en este sprint, LLM en Sprint 4):

```ts
function getMessage(projected, targets, mealLabel) {
  const proteinPct = projected.protein / targets.protein_g
  const calPct = projected.calories / targets.calories
  const remaining = targets.protein_g - projected.protein

  // Caso: proteína cerrada
  if (proteinPct >= 1 && calPct <= 1.05) {
    return `Después de esta ${mealLabel}: <strong>${Math.round(projected.protein)}g</strong> de proteína · <strong>cerraste el día</strong>.`
  }

  // Caso: proteína cerrada pero calorías excedidas
  if (proteinPct >= 1 && calPct > 1.05) {
    const exceso = Math.round(projected.calories - targets.calories)
    return `<strong>Cerraste proteína.</strong> Te pasaste por ${exceso} cal — si entrenaste hoy, no pasa nada.`
  }

  // Caso: proteína insuficiente
  if (remaining > 30) {
    return `Después de esta ${mealLabel}: <strong>${Math.round(projected.protein)}g</strong> · te faltan <strong>${Math.round(remaining)}g</strong>.`
  }

  // Caso: cerca de cerrar proteína
  return `Vas en <strong>${Math.round(projected.protein)}g</strong> · te faltan <strong>${Math.round(remaining)}g</strong> para cerrar.`
}
```

##### 4.1.8 — Componente `ManualInputs`

`/features/meals/components/ManualInputs.tsx`:

```tsx
type ManualInputsProps = {
  name: string
  onNameChange: (v: string) => void
  protein: string
  onProteinChange: (v: string) => void
  calories: string
  onCaloriesChange: (v: string) => void
  mealVerb: string
}

export function ManualInputs({
  name,
  onNameChange,
  protein,
  onProteinChange,
  calories,
  onCaloriesChange,
  mealVerb,
}: ManualInputsProps) {
  return (
    <View>
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.fieldLabel}>¿Qué {mealVerb}?</Text>
        <TextInput
          value={name}
          onChangeText={onNameChange}
          placeholder="Pollo con arroz..."
          placeholderTextColor={colors.labelDim}
          style={styles.inputText}
          maxLength={80}
          autoCapitalize="sentences"
        />
      </View>

      <View style={styles.row}>
        <View style={styles.numField}>
          <Text style={styles.numLabel}>Proteína</Text>
          <View style={styles.numRow}>
            <TextInput
              value={protein}
              onChangeText={onProteinChange}
              placeholder="35"
              placeholderTextColor={colors.labelDim}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.numInput}
            />
            <Text style={styles.numUnit}>g</Text>
          </View>
        </View>
        <View style={styles.numField}>
          <Text style={styles.numLabel}>Calorías</Text>
          <View style={styles.numRow}>
            <TextInput
              value={calories}
              onChangeText={onCaloriesChange}
              placeholder="600"
              placeholderTextColor={colors.labelDim}
              keyboardType="number-pad"
              maxLength={4}
              style={styles.numInput}
            />
            <Text style={styles.numUnit}>cal</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
```

Estilos:

- `fieldLabel`: Inter UI 9px weight 600 letterSpacing 2 uppercase color `labelMuted` mb 6
- `inputText`: bg `pearlElevated` border 0.5px `borderSubtle` borderRadius 12 padding 13px 14px Inter UI 14px color `inkPrimary`
- `row`: flexDirection row gap 8
- `numField`: flex 1 bg `pearlElevated` border 0.5px `borderSubtle` borderRadius 12 padding 10px 14px
- `numLabel`: Inter UI 9px weight 600 letterSpacing 1.8 uppercase color `labelMuted` mb 4
- `numRow`: flexDirection row alignItems baseline gap 4
- `numInput`: flex 1 Inter Tight 22px weight 300 letterSpacing -0.6 color `inkPrimary` padding 0
- `numUnit`: Inter UI 11px weight 500 color `labelMuted`

##### 4.1.9 — Componente `DividerWithText`

`/components/DividerWithText.tsx`:

```tsx
type DividerWithTextProps = {
  text: string
}

export function DividerWithText({ text }: DividerWithTextProps) {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.text}>{text}</Text>
      <View style={styles.line} />
    </View>
  )
}
```

Estilos:

- `row`: flexDirection row alignItems center gap 12 mb 16
- `line`: flex 1 height 0.5 backgroundColor `borderSubtle`
- `text`: Inter UI 9px weight 500 letterSpacing 1.8 uppercase color `labelDim`

##### 4.1.10 — Hook `useTodayMacros` y `useLogMeal`

Estos probablemente ya existen. Verificar que:

- `useTodayMacros` invalide correctamente al loggear una comida
- `useLogMeal` invalide `['todayMacros']`, `['mealSuggestions']`, y `['dayMeals', date]` en `onSuccess`

#### Tarea 4.2 — Eliminar redundancia de los 2 botones

Hay 2 botones que abren la misma pantalla del log de comida (uno en header de tab Comidas, otro como FAB). Decidir cuál mantener:

**Mantener: FAB**

- Es el patrón estándar para "crear nuevo"
- Más visible, mejor touch target
- Permanece visible mientras scrolleas

**Eliminar: botón en header**

- Redundante
- Ocupa espacio del header

En `/app/(tabs)/meals.tsx`, eliminar el `headerRight` del Stack.Screen options. Mantener el FAB que ya existe.

#### Tarea 4.3 — DateNavigator entre días

Componente nuevo `/features/meals/components/DateNavigator.tsx`:

```tsx
type DateNavigatorProps = {
  date: Date
  onDateChange: (d: Date) => void
}

export function DateNavigator({ date, onDateChange }: DateNavigatorProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dateStart = new Date(date)
  dateStart.setHours(0, 0, 0, 0)

  const isToday = dateStart.getTime() === today.getTime()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = dateStart.getTime() === yesterday.getTime()

  const isFuture = dateStart.getTime() > today.getTime()

  const goPrev = () => {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    onDateChange(d)
    Haptics.selectionAsync()
  }

  const goNext = () => {
    if (isToday) return // No permitir futuro
    const d = new Date(date)
    d.setDate(d.getDate() + 1)
    onDateChange(d)
    Haptics.selectionAsync()
  }

  const label = useMemo(() => {
    if (isToday) return 'HOY'
    if (isYesterday) return 'AYER'
    return formatLongDate(date) // "sábado 23 abr"
  }, [date, isToday, isYesterday])

  return (
    <View style={styles.row}>
      <Pressable onPress={goPrev} style={styles.chevron}>
        <Text style={styles.chevronText}>‹</Text>
      </Pressable>
      <View style={styles.center}>
        {(isToday || isYesterday) && (
          <View style={[styles.badge, isToday && styles.badgeToday]}>
            <Text style={[styles.badgeText, isToday && styles.badgeTextToday]}>{label}</Text>
          </View>
        )}
        {!isToday && !isYesterday && <Text style={styles.dateText}>{label}</Text>}
      </View>
      <Pressable
        onPress={goNext}
        disabled={isToday}
        style={[styles.chevron, isToday && styles.chevronDisabled]}
      >
        <Text style={[styles.chevronText, isToday && styles.chevronTextDisabled]}>›</Text>
      </Pressable>
    </View>
  )
}
```

Estilos:

- `row`: flexDirection row alignItems center justifyContent space-between paddingHorizontal 22 paddingVertical 12
- `chevron`: width 36 height 36 borderRadius 18 alignItems center justifyContent center
- `chevronText`: Inter Tight 28px weight 200 color `inkPrimary`
- `chevronDisabled`: opacity 0.3
- `chevronTextDisabled`: color `labelDim`
- `badge`: paddingHorizontal 10 paddingVertical 4 borderRadius 4 borderWidth 0.5 borderColor `borderSubtle`
- `badgeToday`: bg `mauveDeep` borderColor `mauveDeep`
- `badgeText`: Inter UI 10px weight 600 letterSpacing 1.8 uppercase color `labelMuted`
- `badgeTextToday`: color `pearlElevated`

Helper:

```ts
function formatLongDate(date: Date): string {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const months = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ]
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`
}
```

Integrar en `/app/(tabs)/meals.tsx`:

```tsx
const [selectedDate, setSelectedDate] = useState(new Date())
const { data: meals } = useDayMeals(selectedDate)

return (
  <View>
    <DateNavigator date={selectedDate} onDateChange={setSelectedDate} />
    <MealsList meals={meals} />
    <FAB onPress={() => router.push('/meal/log-meal')} />
  </View>
)
```

`useDayMeals(date)` query con filtro de día completo:

```ts
const { data } = await supabase
  .from('meals')
  .select('*')
  .gte('consumed_at', startOfDay(date).toISOString())
  .lt('consumed_at', endOfDay(date).toISOString())
  .order('consumed_at', { ascending: true })
```

---

## Acceptance criteria (sprint cerrado)

### Bloque 0 — Dev user

1. Dev user existe en Supabase con email `dev@local.test`
2. App auto-loguea al dev user en modo `__DEV__`
3. Script de seed pueblan 14 días de workouts, meals, body_measurements, macro_targets
4. Comida "Pollo con arroz y verduras" cenada hace 1 día existe en seed (para que "Lo de ayer" funcione)

### Bloque 1 — Bugs

5. Tap en TodayTile marca workout exitosamente
6. Después de marcar, el tile cambia a state completed con cascada de celdas
7. Streak count se actualiza en vivo
8. Anillos de macros muestran data correcta del día
9. Después de loggear comida, anillos suman los macros nuevos
10. Anillos en el Home se actualizan sin necesidad de pull-to-refresh

### Bloque 2 — Settings

11. Pantalla Settings accesible desde tab bar
12. Muestra perfil read-only (display_name, age, height, biological_sex)
13. Muestra macros actuales con tap para editar
14. Edit modal valida 50≤protein≤300 y 1000≤cal≤5000
15. Save crea row nuevo en `macro_targets` con `valid_from` = hoy
16. Sign out (en dev) no hace nada o muestra mensaje "deshabilitado en dev"
17. Versión de la app se muestra correctamente

### Bloque 3 — Progress

18. Pantalla Progress accesible desde tab bar
19. Muestra gráfica de peso histórico con victory-native
20. Eje Y se ajusta automáticamente a min/max ±1
21. Estado vacío si no hay measurements
22. CTA "Registrar peso" abre modal slide-up
23. Modal valida 30≤weight≤300
24. Save inserta en `body_measurements` y actualiza la gráfica
25. Lista de últimas 5 mediciones se muestra debajo

### Bloque 4 — Comidas

26. Header del log de comida muestra "{Label} · {hour}pm" según hora actual
27. Pregunta del header usa verbo correcto (desayunaste/comiste/cenaste)
28. Sugerencias se cargan con RPC `get_meal_suggestions`
29. La primera sugerencia tiene tag "Lo de ayer" si existe match, primera con border malva
30. Otras sugerencias tienen tag "Reciente" en gris suave
31. Tap en sugerencia muestra FilledMealCard con datos
32. FilledMealCard muestra números en Inter Tight 32px Light
33. FeedbackCard muestra mensaje contextual con palabras destacadas en mauveDeep
34. Mensaje cambia según proteína cerrada vs no cerrada vs excedida en cal
35. "Cambiar o editar" abre Alert con 2 opciones (elegir otra / editar números — última puede ser stub)
36. Inputs manuales abajo del DividerWithText son editables
37. CTA disabled hasta que haya plato (sugerencia o data manual completa)
38. CTA con copy "Guardar {meal_label}" según meal type
39. Save inserta en `meals` con `meal_type` correcto y vuelve a la pantalla anterior
40. Tab Comidas tiene un solo botón de log (FAB), header sin botón
41. DateNavigator muestra HOY/AYER en badges, fecha completa para días anteriores
42. Chevron derecho disabled si la fecha actual es HOY (no permite futuro)
43. Tap en chevrons cambia el día con haptic
44. Lista de meals filtra correctamente por el día seleccionado

### Generales

45. `pnpm typecheck` pasa
46. `pnpm lint` pasa
47. Cero hex inline en código nuevo — todo via tokens
48. Todos los componentes nuevos siguen Pearl Mauve design system

---

## Lo que NO se hace

- **Bottom sheet selector premium** con chips +/− y números grandes (post-validación, Sprint 2.7)
- **Animaciones de barras de progreso** con proyección en vivo (post-validación)
- **Time tag editable** con picker de fecha pasada (post-validación)
- **Diferenciación visual** entre "Lo de ayer" / "Favorito 14×" / "Hace 3 días" (post-validación)
- **Auth real** (Apple Sign In, Google) — Sprint 5
- **IA para fotos de comida** — Sprint 3
- **HealthKit integration** — Sprint 4
- **Onboarding wizard real** — Sprint 2.6 (después de este)
- **Editar perfil del user** desde Settings — Sprint 2.6 lo cubre
- **Edición de macros de un meal ya guardado** — post-MVP
- **Comparativa visual de fotos progreso** — Sprint Progress 2.0

---

## Notas para Claude Code

- **Empezar SIEMPRE por Bloque 0.** Sin dev user con seed data, no puedes probar las sugerencias del Bloque 4. Todo el sprint depende de tener data realista.

- **Bloque 1 antes que 4.** Los bugs de marcar entreno y anillos pueden estar relacionados con cómo se invalidan queries. Si arreglas el patrón ahí, el Bloque 4 hereda buenas prácticas.

- **Probar en device real para haptics.** En simulator no se sienten — pareceran no existir.

- **Para el RPC de sugerencias:**
  - Probar con dev user que tiene seed data
  - Verificar que devuelva 1 yesterday + 2 recent en hora de cena
  - Si yesterday no existe, devolver 3 recent
  - Si nada existe (user nuevo), devuelve array vacío y la UI muestra solo inputs manuales

- **Hapticos:**
  - `Selection` al tap en sugerencia
  - `Selection` al cambiar día con DateNavigator
  - `Medium` al tap "Guardar comida"
  - `Success` no necesario aquí (el navigate de vuelta es feedback suficiente)

- **Edge cases que probar:**
  - User sin meals previos (sugerencias array vacío) — solo se muestran inputs manuales sin "Probable" label
  - User loggea a las 5am (caso "snack tardío" si pasa de 12am, ajustar copy)
  - Cambiar día a 30 días atrás (chevrons no deben fallar si no hay límite)
  - Tap rápido en "Guardar" 3 veces seguidas (mutation debe ser idempotente o tener disabled durante request)
  - Loggear comida → cambiar día con DateNavigator → comida aparece en el día correcto

- **Si el seed falla con RLS:** asegurate de usar el `service_role` key en el script, NO el anon key. El service_role bypassa RLS.

- **Commits atómicos por sub-tarea:**
  - `chore: add dev user auto-login`
  - `chore: add seed script for dev user`
  - `fix: tile pointer events blocked by halo`
  - `fix: macros query timezone offset`
  - `feat: add settings screen with edit targets`
  - `feat: add weight chart with victory-native`
  - `feat: add log measurement screen`
  - `feat(meals): add inferMealType helper`
  - `feat(meals): add get_meal_suggestions RPC`
  - `feat(meals): redesign log-meal with suggestions list`
  - `feat(meals): add FilledMealCard and FeedbackCard`
  - `refactor(meals): remove redundant log button from header`
  - `feat(meals): add DateNavigator between days`

- **Al cerrar sprint:** correr los 48 acceptance criteria uno por uno. Reportar cualquiera que falle.

---

## Estimación final

- Bloque 0: 0.5 días (setup + seed)
- Bloque 1: 1-1.5 días (debug + fix)
- Bloque 2: 1 día (settings)
- Bloque 3: 1.5 días (progress + chart)
- Bloque 4: 2-2.5 días (rediseño completo + UX fixes)

**Total: 6-8 días efectivos.** A 2 tardes/semana (~6-8h por semana) = 3-4 semanas calendario.

Si el sprint se sale a 9-10 días, las tareas más diferibles son:

- 4.3 (DateNavigator) → puede esperar a Sprint 2.7
- 3.2 (modal de log measurement) → puede ser Alert simple en MVP

Lo no diferible: 0, 1, 2 entero, 3.1 (al menos la gráfica), 4.1, 4.2.

Después de cerrar este sprint: pausa de validación de 7 días usando la app contigo misma. Solo después arrancar Sprint 2.6 (onboarding real).
