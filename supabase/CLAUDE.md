# supabase · contexto local v3.0

Este archivo aplica a `supabase/` · migraciones, functions, configuración. Reglas más estrictas que en el resto del repo porque toca seguridad y datos de usuarias reales.

## Estado v3.0 (mayo 2026)

Lanzamiento a 5 usuarias beta: **lunes 27 de julio de 2026**. Toda tabla que se cree o modifique antes de esa fecha pasa por usuarias reales. Cero margen para errores de RLS.

## Regla #1 · antes de aplicar cualquier migración

Invoca `rls-auditor` con el archivo SQL. Si reporta issues de severidad alta, NO la apliques · arregla primero.

## Reglas no negociables

### RLS siempre

- Toda `CREATE TABLE` se sigue inmediatamente de `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` en la misma migración.
- Toda tabla con datos por usuario tiene al menos una policy con `auth.uid() = user_id` (o equivalente · `auth.uid() = profile_id`, `auth.uid() = owner_id`).
- Una tabla con RLS habilitado y sin policies = nadie puede leer nada. Si esa es la intención (tabla solo accesible por service role), comenta explícitamente:
  ```sql
  -- Sin policies por diseño: solo accesible vía service role
  ```

### Service role NUNCA en cliente

- En la app móvil solo se usa la `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- El `SUPABASE_SERVICE_ROLE_KEY` solo en scripts del backend (`scripts/`, edge functions).
- Si necesitas hacer algo desde el cliente que RLS no permite, el bug es de policy, no de cliente · diseña la policy correcta.

### CHECK constraints en datos sensibles

Tablas que guardan valores numéricos con rangos razonables deben tener CHECK explícito:

```sql
weight_kg numeric CHECK (weight_kg > 20 AND weight_kg < 400)
height_cm numeric CHECK (height_cm > 50 AND height_cm < 280)
calories integer CHECK (calories >= 0 AND calories <= 10000)
protein_g numeric CHECK (protein_g >= 0 AND protein_g <= 500)
carbs_g numeric CHECK (carbs_g >= 0 AND carbs_g <= 1000)
fat_g numeric CHECK (fat_g >= 0 AND fat_g <= 500)
sleep_hours numeric CHECK (sleep_hours >= 0 AND sleep_hours <= 24)
water_ml integer CHECK (water_ml > 0 AND water_ml <= 10000)
cycle_day integer CHECK (cycle_day >= 1 AND cycle_day <= 60)
```

Rangos generosos a propósito · atrapan basura, no juzgan cuerpos.

### Naming convenciones

- **Tablas**: snake_case, plural · `analytics_events`, `detected_patterns`, `body_measurements`.
- **Columnas**: snake_case · `user_id`, `created_at`, `consumed_at`.
- **Funciones RPC**: prefijo `fn_` · `fn_get_brief_context`, `fn_compute_tdee`.
- **Vistas**: prefijo `v_` · `v_daily_signals`.
- **Tipos enum**: PascalCase · `MealType`, `WorkoutCategory`.
- **Triggers**: `<verbo>_<tabla>_<momento>` · `update_profiles_updated_at`.

### Naming sensible v3.0

Para tablas relacionadas con patrones de comportamiento, usa nombres descriptivos técnicos PERO sin terminología clínica:

✅ Permitido:

- `detected_patterns`
- `pattern_observations`
- `late_night_meal_events`
- `consistency_signals`

❌ Evitar (incluso en código interno):

- `binge_eating_events`
- `anxiety_eating_patterns`
- `eating_disorder_signals`
- `mental_health_flags`

La regla: aunque no sea visible al usuario, evita terminología clínica. Reduce riesgo de filtración y de problemas legales si la BD se audita.

### Migraciones

- Una migración = un cambio atómico. NO mezclar "crear tabla" con "agregar policy a otra tabla" en la misma migración salvo que estén lógicamente acopladas.
- Idempotentes donde aplique:
  ```sql
  CREATE TABLE IF NOT EXISTS ...
  CREATE INDEX IF NOT EXISTS ...
  ALTER TABLE ... ADD COLUMN IF NOT EXISTS ... (PG 14+)
  ```
- Reversibles · comenta al inicio de la migración cómo deshacerla si algo sale mal.

### Foreign keys

Todas con ON DELETE explícito:

```sql
user_id uuid references auth.users(id) on delete cascade
```

Default Postgres es RESTRICT pero ser explícito previene bugs.

### Triggers de updated_at

Toda tabla con columna `updated_at` necesita trigger:

```sql
create trigger set_updated_at
before update on <tabla>
for each row execute function moddatetime(updated_at);
```

Sin trigger, `updated_at` no se actualiza solo · campo inútil.

### Vistas y security_invoker

En PG 15+, vistas que tocan tablas con RLS deben crearse con:

```sql
create view v_daily_signals
with (security_invoker = true) as
select ...
```

Sin esa opción, la vista corre con permisos del creador (típicamente service role) y bypasa RLS · filtración silenciosa de datos.

## Estructura de carpetas

```
supabase/
├── migrations/         · SQL versionado · una migración = un archivo
├── functions/          · edge functions (deno)
├── seed/               · datos seed para dev
└── config.toml         · configuración del proyecto
```

NO crear archivos sueltos fuera de esa estructura.

## Antes de cada migración · checklist

1. La migración tiene timestamp correcto en el nombre (`YYYYMMDDHHMMSS_description.sql`)
2. RLS habilitado en tablas nuevas
3. Al menos una policy por tabla
4. CHECK constraints donde aplique
5. ON DELETE explícito en foreign keys
6. Trigger de updated_at si la tabla lo tiene
7. Naming sin terminología clínica
8. Invocar `rls-auditor` antes de aplicar
9. Migración corre limpia en local antes de hacer push

## Edge functions

Si creas una edge function en `supabase/functions/`:

- TypeScript estricto · deno usa TS nativo
- Manejar errores explícitamente · `try/catch` en cada handler
- Logging con `console.log` (deno lo captura · sale en logs de Supabase)
- Nunca retornar datos sensibles en error messages al cliente
- Validar inputs con Zod antes de tocar nada

## Cuando dudes

Pregunta antes de aplicar una migración a producción. Una migración mala puede:

- Filtrar datos entre usuarias (RLS roto)
- Borrar datos por error (DROP CASCADE accidental)
- Romper la app si cambia un schema que el cliente espera

Mejor 10 minutos de revisión que 10 horas de cleanup.

## Recordatorio del compromiso de lanzamiento

Después del 19 de julio 2026 (feature freeze), NO se aplican migraciones que cambien estructura · solo migraciones de bugfix crítico. Cualquier cambio de schema durante feature freeze va a post-launch.
