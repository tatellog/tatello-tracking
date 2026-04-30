# Sprint Estabilización — Hacer la app realmente usable

**Tipo:** Bugfix + completion sprint. NO se agregan features nuevas (foto IA, HealthKit, etc.).
**Objetivo:** Que en 5-7 días la app sea genuinamente usable a diario por ti misma. Sin bugs críticos. Sin pantallas vacías. Flujos completos end-to-end.

**Definition of done:** Puedes usarla 7 días seguidos sin abrir el código para arreglar algo.

---

## Prerequisitos

- Sprints 0, 1, 2, 2.5, 2-task-9 ejecutados (76 commits acumulados según último resumen)
- Conocimiento de qué está roto (inventory ya capturado en chat)

## Decisiones tomadas para este sprint

- Auth real: pospuesto (post-sprint). Mientras tanto, dev user auto-login.
- Settings: mínimo (editar metas + sign out + perfil básico)
- Progress: mínimo (gráfica simple de peso histórico)
- Comidas: arreglar 2 botones redundantes + clarificar navegación entre días

---

## Stack adicional

- `victory-native` o `react-native-svg-charts` para gráfica de peso (Progress)
  - Recomendación: `victory-native@^41` — más activo, mejor soporte Reanimated 3
  - Alternativa más light: SVG manual con react-native-svg si la gráfica es muy simple

```bash
pnpm add victory-native@^41
```

---

## Tareas en orden de ejecución

### Bloque 0 — Setup de dev user (preliminar, indispensable)

**Esta tarea va PRIMERO porque sin ella no puedes debuggear los demás bugs correctamente.**

#### Tarea 0.1 — Dev user auto-login

Crear un user de prueba en Supabase y configurar auto-login en modo dev.

**En Supabase dashboard:**

1. Authentication → Users → Add user manually
2. Email: `dev@local.test`
3. Password: `devpassword123`
4. Email confirmed: ✓ (skip verification)
5. Copiar el UUID del user creado

**En el cliente, crear `/lib/devAuth.ts`:**

```ts
import { supabase } from './supabase'

const DEV_EMAIL = 'dev@local.test'
const DEV_PASSWORD = 'devpassword123'

export async function ensureDevUserSession() {
  // Solo en development
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
    console.error('[devAuth] Failed to sign in:', error)
    return
  }

  console.log('[devAuth] Signed in as', data.user?.email)
}
```

**En `/app/_layout.tsx`, llamar al inicio:**

```tsx
import { ensureDevUserSession } from '@/lib/devAuth'

useEffect(() => {
  ensureDevUserSession()
}, [])
```

**Verificación:**

1. Borrar y reabrir la app
2. En consola debe aparecer `[devAuth] Signed in as dev@local.test`
3. Las queries de TanStack que dependen de `auth.uid()` ahora deben devolver data
4. En Settings (cuando exista) debe mostrar el email del dev user

**Done when:** al abrir la app, el user dev está autenticado automáticamente, y `supabase.auth.getUser()` devuelve un user válido en cualquier parte del código.

#### Tarea 0.2 — Seed data en el dev user

Para que el Home no se vea vacío y puedas validar visualmente:

Crear `/scripts/seed-dev-user.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // del .env.local, NUNCA en cliente
)

const DEV_USER_ID = 'PEGAR-AQUI-EL-UUID-DEL-DEV-USER'

async function seed() {
  // Limpiar data previa del dev user
  await supabase.from('workouts').delete().eq('user_id', DEV_USER_ID)
  await supabase.from('meals').delete().eq('user_id', DEV_USER_ID)
  await supabase.from('body_measurements').delete().eq('user_id', DEV_USER_ID)
  await supabase.from('mood_checkins').delete().eq('user_id', DEV_USER_ID)
  await supabase.from('macro_targets').delete().eq('user_id', DEV_USER_ID)

  // Macro targets
  await supabase.from('macro_targets').insert({
    user_id: DEV_USER_ID,
    protein_g: 130,
    calories: 1800,
  })

  // 14 workouts: últimos 14 días seguidos
  const workouts = Array.from({ length: 14 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - i - 1) // ayer hasta hace 14 días (NO hoy, para que tile gigante aparezca)
    return {
      user_id: DEV_USER_ID,
      completed_at: date.toISOString(),
      type: 'gym',
    }
  })
  await supabase.from('workouts').insert(workouts)

  // 2 measurements: hoy y hace 30 días
  const today = new Date().toISOString()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  await supabase.from('body_measurements').insert([
    {
      user_id: DEV_USER_ID,
      measured_at: thirtyDaysAgo.toISOString(),
      weight_kg: 78.0,
      waist_cm: 76,
    },
    {
      user_id: DEV_USER_ID,
      measured_at: today,
      weight_kg: 76.2,
      waist_cm: 74,
    },
  ])

  // 3 meals de hoy
  const morning = new Date()
  morning.setHours(8, 30, 0, 0)
  const lunch = new Date()
  lunch.setHours(14, 0, 0, 0)
  const snack = new Date()
  snack.setHours(17, 0, 0, 0)

  await supabase.from('meals').insert([
    {
      user_id: DEV_USER_ID,
      consumed_at: morning.toISOString(),
      name: 'Avena con plátano y proteína',
      protein_g: 35,
      calories: 450,
      source: 'manual',
    },
    {
      user_id: DEV_USER_ID,
      consumed_at: lunch.toISOString(),
      name: 'Pollo con arroz y verduras',
      protein_g: 40,
      calories: 700,
      source: 'manual',
    },
    {
      user_id: DEV_USER_ID,
      consumed_at: snack.toISOString(),
      name: 'Yogurt griego con nueces',
      protein_g: 10,
      calories: 320,
      source: 'manual',
    },
  ])

  console.log('Dev user seeded with:')
  console.log('- 14 workouts (yesterday and 13 prior days)')
  console.log('- 2 measurements (today and 30 days ago)')
  console.log('- 3 meals today (85g protein, 1470 cal)')
  console.log('- targets: 130g protein, 1800 cal')
}

seed().catch(console.error)
```

Agregar al `package.json`:

```json
"scripts": {
  "seed:dev": "tsx scripts/seed-dev-user.ts"
}
```

Necesitarás `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` (la del dashboard, NUNCA committeada).

**Done when:** ejecutar `pnpm seed:dev` resetea el dev user a estado conocido. Reabrir la app debe mostrar 14 días en grid + tile pendiente HOY + anillos al ~65% proteína / 80% cal + delta -1.8kg / -2cm.

---

### Bloque 1 — Bugs críticos (sin esto no hay app)

#### Tarea 1.1 — Debuggear y arreglar marcar entreno

Esta es la cosa más importante del sprint. Diagnóstico paso a paso:

**Setup de debug:**

En el componente TodayTile, agregar logs temporales:

```ts
const handlePress = async () => {
  console.log('[TodayTile] Tap detected')
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    console.log('[TodayTile] Haptic done')

    console.log('[TodayTile] Calling onPress...')
    const result = await onPress()
    console.log('[TodayTile] onPress result:', result)
  } catch (err) {
    console.error('[TodayTile] Error:', err)
  }
}
```

En el hook que maneja el mutation (`useMarkWorkout` o similar):

```ts
const markWorkout = useMutation({
  mutationFn: async () => {
    console.log('[useMarkWorkout] Starting mutation')
    const user = await supabase.auth.getUser()
    console.log('[useMarkWorkout] Current user:', user.data.user?.id)

    if (!user.data.user) {
      throw new Error('No authenticated user')
    }

    const { data, error } = await supabase
      .from('workouts')
      .insert({
        user_id: user.data.user.id,
        completed_at: new Date().toISOString(),
        type: 'gym',
      })
      .select()
      .single()

    if (error) {
      console.error('[useMarkWorkout] Insert error:', error)
      throw error
    }

    console.log('[useMarkWorkout] Insert success:', data)
    return data
  },
  onSuccess: () => {
    console.log('[useMarkWorkout] Invalidating queries')
    queryClient.invalidateQueries({ queryKey: ['briefContext'] })
  },
  onError: (err) => {
    console.error('[useMarkWorkout] Mutation error:', err)
  },
})
```

**Identificar la falla específica:**

Tapea el tile y mira los logs. Las posibilidades son:

1. **No aparece "[TodayTile] Tap detected"** → el Pressable no recibe el tap. Posibles causas:
   - El TodayTile está dentro de un componente que captura los toques
   - El `pointerEvents` está mal configurado
   - El halo absolute está bloqueando el tap (agregar `pointerEvents="none"` al halo)

2. **Aparece "Tap detected" pero no "Calling onPress"** → el haptic está fallando o está bloqueando. Quitar el `await` del haptic, dispararlo fire-and-forget.

3. **Aparece "Calling onPress" pero no "Starting mutation"** → el callback `onPress` prop no está conectado al mutation. Bug en el padre que pasa la prop.

4. **Aparece "Current user: undefined"** → no hay sesión activa. El dev auto-login (Tarea 0.1) no se ejecutó o falló.

5. **Aparece error de RLS o permission denied** → políticas de RLS mal configuradas para workouts. Revisar policies en Supabase.

6. **Insert success pero UI no actualiza** → la query no se invalida correctamente. El query key del Home no coincide con el que se está invalidando.

**Posibles fixes según diagnóstico:**

- Pointer events del halo:

  ```tsx
  <View
    style={[styles.halo]}
    pointerEvents="none" // CRÍTICO: el halo NO debe interceptar taps
  />
  ```

- Query invalidation correcta:

  ```ts
  // El Home usa queryKey: ['briefContext'] o similar — debe COINCIDIR
  queryClient.invalidateQueries({ queryKey: ['briefContext'] })
  // o si tiene parámetros:
  queryClient.invalidateQueries({ queryKey: ['briefContext', userId] })
  ```

- Optimistic update (recomendado para que el tap se sienta instantáneo):

  ```ts
  const markWorkout = useMutation({
    mutationFn: ...,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['briefContext'] })
      const previous = queryClient.getQueryData(['briefContext'])

      // Update optimista: marca el today_workout_completed como true
      queryClient.setQueryData(['briefContext'], (old: any) => ({
        ...old,
        today_workout_completed: true,
        streak_days: (old.streak_days ?? 0) + 1,
      }))

      return { previous }
    },
    onError: (err, _, context) => {
      // Rollback si falla
      queryClient.setQueryData(['briefContext'], context?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['briefContext'] })
    },
  })
  ```

**Done when:**

1. Tapeo el tile gigante
2. Haptic Medium se siente
3. El tile desaparece con animación
4. Las 4 celdas que reemplazan al tile aparecen, incluyendo HOY filled
5. El número de la racha sube de 14 a 15
6. Si recargo la app, el estado persiste (el workout sigue marcado)
7. Si tapeo de nuevo el mismo día, no se duplica (constraint único `workouts_user_date_unique`)

#### Tarea 1.2 — Debuggear y arreglar datos de anillos de macros

"No sé de dónde está sacando los aros" — diagnóstico:

**Verificar fuente de datos:**

En `/features/macros/components/MacroRing.tsx` o donde se renderice, agregar log:

```ts
console.log('[MacroRing] Rendering with:', { current, target, label })
```

En el hook que provee los datos al Home (probablemente `useBriefContext`):

```ts
console.log('[useBriefContext] Data received:', data)
```

Recargar la app. Posibilidades:

1. **`current` y `target` son hardcoded en algún lugar** (mock data que sobrevivió Sprint 0/1). Buscar `mockBriefData` o similar y eliminar.

2. **El RPC `get_brief_context` no está devolviendo `today_macros` correctamente**. Probarlo directo en SQL editor de Supabase:

   ```sql
   select public.get_brief_context('PEGAR-DEV-USER-UUID', null);
   ```

   Verificar que `today_macros` y `targets` vengan poblados.

3. **El cliente está mostrando data del query cache previo**. Hacer pull-to-refresh o reload completo.

4. **Los meals de hoy no se están sumando bien** porque `meal_date` (generated column) no está calculando con el timezone correcto. Verificar:

   ```sql
   select meal_date, name, protein_g, calories
   from meals
   where user_id = 'DEV-USER-UUID'
   order by consumed_at desc
   limit 5;
   ```

   Si `meal_date` es del día anterior cuando deberían ser de hoy, el timezone está mal. Fix:

   ```sql
   alter table meals drop column meal_date;
   alter table meals add column meal_date date generated always as
     ((consumed_at at time zone 'America/Mexico_City')::date) stored;
   ```

5. **No hay `macro_targets` configurados** y el código no maneja bien el null. El banner "Define tus metas" debería mostrarse, no anillos con valores raros.

**Fixes específicos:**

- Si los datos vienen del RPC pero el render está mal:

  ```tsx
  // En el Home, antes de renderizar MacrosTodayCard
  if (!ctx.targets) return <DefineTargetsBanner />
  if (!ctx.today_macros) return <Loading /> // shouldn't happen, but safety

  return (
    <MacrosTodayCard
      current={ctx.today_macros} // {protein_g: number, calories: number}
      target={ctx.targets} // {protein_g: number, calories: number}
      mealCount={ctx.meal_count_today}
    />
  )
  ```

- Si el problema es que `today_macros` viene como string en lugar de number (Postgres a veces serializa decimales como strings):
  ```ts
  const proteinG = Number(ctx.today_macros.protein_g)
  const calories = Number(ctx.today_macros.calories)
  ```

**Done when:**

1. Si reseteo el dev user con seed → Home muestra anillo proteína a ~65% (85/130) y calorías a ~82% (1470/1800)
2. Si añado una comida nueva (50g proteína, 400 cal) desde la app → los anillos suben a ~104% y ~104%
3. Si borro todas las metas → aparece el banner "Define tus metas" en lugar de anillos rotos
4. Los números dentro de los anillos coinciden EXACTAMENTE con la suma de meals del día en DB

---

### Bloque 2 — Pantalla Settings (mínima)

#### Tarea 2.1 — Implementar Settings

`/app/(tabs)/settings.tsx`:

Layout: ScrollView con secciones separadas por dividers sutiles.

```tsx
<ScrollView style={{ backgroundColor: colors.pearlBase, padding: spacing.lg }}>
  {/* Sección: Perfil */}
  <SettingsSection title="Perfil">
    <SettingsRow
      label="Nombre"
      value={profile?.display_name ?? '—'}
      onPress={() => router.push('/settings/edit-name')}
    />
    <SettingsRow label="Email" value={user?.email ?? '—'} readonly />
    <SettingsRow
      label="Objetivo"
      value={localizeGoal(profile?.goal)}
      onPress={() => router.push('/settings/edit-goal')}
    />
  </SettingsSection>

  {/* Sección: Metas diarias */}
  <SettingsSection title="Metas diarias">
    <SettingsRow
      label="Proteína"
      value={`${targets?.protein_g ?? '—'} g`}
      onPress={() => router.push('/onboarding/macro-targets?source=settings')}
    />
    <SettingsRow
      label="Calorías"
      value={`${targets?.calories ?? '—'} cal`}
      onPress={() => router.push('/onboarding/macro-targets?source=settings')}
    />
  </SettingsSection>

  {/* Sección: Sesión */}
  <SettingsSection title="Sesión">
    <SettingsRow label="Cerrar sesión" value="" onPress={handleSignOut} destructive />
  </SettingsSection>

  {/* App version footer */}
  <Text style={styles.versionFooter}>v0.1.0 · dev</Text>
</ScrollView>
```

**Componentes a crear:**

`/features/settings/components/SettingsSection.tsx`:

- Título en `labelMuted` uppercase letterSpacing wide
- Children dentro de un card `pearlElevated` con border `borderSubtle` y radius
- Margen inferior para separar de la siguiente sección

`/features/settings/components/SettingsRow.tsx`:

- Layout horizontal: label izquierda, value/chevron derecha
- Tap area completa
- Border bottom dashed `borderSubtle` excepto última row de cada section
- Si `destructive`, color del label es `feedbackError`
- Si `readonly`, sin chevron y sin tap

**Pantallas auxiliares (placeholders simples):**

`/app/settings/edit-name.tsx`: form simple con un input para `display_name`
`/app/settings/edit-goal.tsx`: selector de los 4 goals (recomp/lose/gain/maintain)

**Sign out:**

```ts
async function handleSignOut() {
  Alert.alert('Cerrar sesión', '¿Estás segura?', [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Cerrar sesión',
      style: 'destructive',
      onPress: async () => {
        await supabase.auth.signOut()
        // En dev, esto debe re-trigger el auto-login
      },
    },
  ])
}
```

**Done when:**

1. Tab Settings ya no es placeholder
2. Puedes ver tu email del dev user
3. Puedes editar tu nombre desde Settings y persiste al recargar
4. Tap en "Proteína" o "Calorías" lleva al form de macro-targets para editar
5. Sign out funciona (en prod cerraría sesión, en dev re-loggea automáticamente)
6. La pantalla respeta tokens de Pearl Mauve

---

### Bloque 3 — Pantalla Progress (gráfica de peso)

#### Tarea 3.1 — Implementar gráfica de peso histórico

`/app/(tabs)/progress.tsx`:

Estructura:

- Header pequeño: "Tu peso"
- Selector de rango: 7d / 30d / 90d / Todo (chips horizontales arriba de la gráfica)
- Card grande con la gráfica
- Resumen abajo: peso actual, peso inicial del rango, delta absoluto, delta porcentual

```tsx
<ScrollView style={{ backgroundColor: colors.pearlBase, padding: spacing.lg }}>
  <View style={styles.header}>
    <Text style={styles.label}>Tu peso</Text>
  </View>

  <RangeChips selected={range} onSelect={setRange} />

  {measurements && measurements.length >= 2 ? (
    <Card>
      <WeightChart data={measurements} />
      <DeltaSummary measurements={measurements} />
    </Card>
  ) : (
    <EmptyState
      title="Necesitas al menos 2 medidas"
      description="Agrega tu peso desde el Home o desde aquí para empezar a ver tu progreso."
      cta="Agregar medida"
      onPress={() => router.push('/log-measurement')}
    />
  )}
</ScrollView>
```

**WeightChart con victory-native:**

```tsx
import { CartesianChart, Line, useChartPressState } from 'victory-native'

function WeightChart({ data }: { data: BodyMeasurement[] }) {
  const chartData = data.map((m) => ({
    date: new Date(m.measured_at).getTime(),
    weight: m.weight_kg,
  }))

  return (
    <View style={{ height: 200 }}>
      <CartesianChart
        data={chartData}
        xKey="date"
        yKeys={['weight']}
        domainPadding={{ left: 16, right: 16, top: 16, bottom: 8 }}
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

**API para fetchear measurements:**

`/features/progress/api.ts`:

```ts
export async function getMeasurements(rangeDays?: number) {
  let query = supabase
    .from('body_measurements')
    .select('*')
    .order('measured_at', { ascending: true })

  if (rangeDays) {
    const since = new Date()
    since.setDate(since.getDate() - rangeDays)
    query = query.gte('measured_at', since.toISOString())
  }

  const { data, error } = await query
  if (error) throw error
  return data
}
```

**Empty state importante:**

Si solo hay 1 medida, mostrar empty state explicando que necesita 2+ para gráfica. NO renderizar gráfica con un solo punto (se ve roto).

**Done when:**

1. Tab Progress muestra gráfica con las 2 measurements del seed (78kg y 76.2kg)
2. Si agrego una nueva medida, aparece en la gráfica al recargar
3. Cambiar de rango (7d/30d/90d) filtra correctamente
4. Empty state aparece si hay menos de 2 medidas
5. Delta resumen abajo muestra "−1.8 kg en 30 días"

#### Tarea 3.2 — Pantalla de logger medida

`/app/log-measurement.tsx`:

Form mínimo similar al log-meal:

- Input "Peso" (numeric, requerido, sufijo "kg")
- Input "Cintura" (numeric, opcional, sufijo "cm")
- Selector de fecha (default ahora)
- Botón "Guardar"

Insert en `body_measurements`. Invalidar query de progress.

**Done when:** desde el Home (mini action chip "⚖ Medida") o desde Progress (CTA "Agregar medida"), puedes loggear una nueva medida.

---

### Bloque 4 — Comidas (UX fixes)

#### Tarea 4.1 — Eliminar redundancia de botones

El problema: hay un FAB (floating action button) y también un botón "Loggear comida" en el header de la pantalla, ambos van al mismo `/log-meal`.

**Decisión:** mantener UN solo CTA, eliminar el otro.

Mi recomendación: **mantener el FAB, eliminar el botón del header.**

Razones:

- FAB es el patrón estándar para "crear nuevo" en listas (Material, iOS apps modernas)
- Está siempre accesible al scrollear, no se pierde arriba
- Visual más limpio en el header

Implementación:

- En `/app/(tabs)/meals.tsx`, eliminar el botón "Loggear comida" del header
- Mantener el FAB en bottom-right (44x44 mínimo, mauve gradient, sombra)
- El FAB navega a `/log-meal`

**Done when:** solo hay UN botón visible para loggear comida en la pantalla de Comidas. El FAB es el correcto.

#### Tarea 4.2 — Clarificar navegación entre días

El problema: la navegación entre días está confusa. Posibles causas:

- Los botones ‹ y › son muy chicos o invisibles
- No queda claro qué fecha estás viendo
- Falta un indicador visual del día actual ("hoy")
- No puedes saltar directo a una fecha específica

**Solución propuesta:**

Header de la pantalla con date navigator más prominente:

```
┌─────────────────────────────────────┐
│  ‹    Sábado 23 abril    ›          │  ← día actual
│       (HOY · centered)              │
└─────────────────────────────────────┘
```

Componente `DateNavigator`:

- Layout: 3 columnas (back chevron, fecha centered, forward chevron)
- Fecha en serif display medium, 18px, inkPrimary
- Si es hoy, badge "HOY" debajo en mauveDeep uppercase tiny
- Si es ayer, "AYER" en labelMuted
- Si es más viejo, mostrar día de la semana
- Chevrons grandes (touch target 44x44 mínimo) con padding generoso
- Forward chevron deshabilitado (opacity 0.3, no tap) si la fecha es HOY (no puedes ir al futuro)

```tsx
function DateNavigator({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const isToday = isSameDay(date, new Date())
  const isYesterday = isSameDay(date, subDays(new Date(), 1))

  return (
    <View style={styles.navigator}>
      <Pressable onPress={() => onChange(subDays(date, 1))} hitSlop={20}>
        <Text style={styles.chevron}>‹</Text>
      </Pressable>

      <View style={styles.dateColumn}>
        <Text style={styles.dateMain}>{format(date, "EEEE d 'de' MMMM", { locale: es })}</Text>
        {isToday && <Text style={styles.dateBadge}>HOY</Text>}
        {isYesterday && <Text style={styles.dateBadgeMuted}>AYER</Text>}
      </View>

      <Pressable onPress={() => onChange(addDays(date, 1))} hitSlop={20} disabled={isToday}>
        <Text style={[styles.chevron, isToday && styles.chevronDisabled]}>›</Text>
      </Pressable>
    </View>
  )
}
```

**Bonus opcional:** tap largo en la fecha abre date picker para saltar a un día específico. Si no da tiempo, dejarlo para post-sprint.

**Done when:**

1. Es obvio qué día estás viendo (tipografía grande, fecha completa en español)
2. El día actual tiene indicador visual claro (badge "HOY")
3. Los chevrons son fáciles de tapear (touch targets generosos)
4. No puedes navegar al futuro
5. Navegar entre días recarga el listado de comidas correctamente

---

## Acceptance criteria (sprint cerrado)

1. Dev user auto-login funciona — la app abre logueada
2. `pnpm seed:dev` resetea el dev user a estado conocido y se ve correcto en la app
3. Marcar entreno con tile gigante: tap → animación → racha sube → persiste al recargar
4. Anillos de macros muestran datos REALES de los meals de hoy, no mock ni hardcoded
5. Banner "Define tus metas" aparece si no hay targets configurados (probar borrándolos en DB)
6. Settings: editar nombre persiste, sign out funciona, navegar a editar metas funciona
7. Progress: gráfica de peso renderiza con 2+ measurements, empty state con menos de 2
8. Logger medida desde Home o Progress funciona y se refleja en gráfica
9. Comidas: solo un botón para loggear (FAB), no dos
10. Comidas: navegación entre días es clara, día actual etiquetado como "HOY"
11. `pnpm typecheck` y `pnpm lint` pasan
12. Cero hex inline en código nuevo

---

## Lo que NO se hace en este sprint

- Auth real / magic link / Apple Sign In → post-sprint
- Captura de fotos de comida → Sprint 3 (siguiente)
- IA de Anthropic para macros o brief → Sprint 3
- HealthKit / Garmin → Sprint 4
- Galería de fotos en Progress → post-MVP
- Gráficas de proteína/calorías históricas → post-MVP
- Notificaciones push → post-MVP

---

## Notas para Claude Code

- **Ejecuta el Bloque 0 PRIMERO.** Sin dev auto-login, los demás bugs no se diagnostican correctamente.
- **No optimices prematuramente.** El objetivo es funcionalidad básica, no performance.
- **Logs de debug son OK temporalmente.** Después de cada bug arreglado, eliminar los console.log de debug. NO dejar logs en producción.
- **Para el bug del marcar entreno:** PRIMERO diagnóstica con logs, DESPUÉS aplica fix. No asumas la causa.
- **Si encuentras bugs adicionales no listados aquí**, anotalos pero NO los arregles a menos que sean críticos. Puedo decidir si entran a este sprint o al siguiente.
- **El seed script usa SERVICE_ROLE_KEY** (nunca anon key) porque necesita bypassear RLS. Esa key vive en `.env.local`, NUNCA committeada al repo.
- **Commits atómicos** por tarea: `fix: today tile not marking workout`, `feat: add settings screen`, etc.
- **Al cerrar sprint:** correr los 12 acceptance criteria uno por uno. Reportar cualquiera que no se cumpla.
