# Backend · Stelar

> Supabase (Postgres + Auth + Storage) + Edge Functions (Deno). Reglas estrictas
> en `supabase/CLAUDE.md`. Este doc mapea el estado y el target.

## Reglas no negociables (de `supabase/CLAUDE.md`)

- **RLS siempre.** Toda tabla con datos por usuario: `ENABLE ROW LEVEL SECURITY`
  - policy `auth.uid() = user_id` en la misma migración.
- **Service role NUNCA en cliente.** App móvil solo `EXPO_PUBLIC_..._ANON_KEY`.
- **CHECK constraints** en numéricos con rango (peso, calorías, agua…).
- **Vistas con `security_invoker = true`** (PG15+) para no bypassar RLS.
- **Naming:** tablas snake*case plural, RPC `fn*`, vistas `v\_`, sin terminología clínica.
- Una migración = un cambio atómico; `rls-auditor` antes de aplicar.

## Tablas / vistas existentes (jul 2026)

| Objeto                                      | Rol                                                                                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                                  | usuario + `onboarding_completed_at`                                                                                                                        |
| `daily_signals` (vista, `security_invoker`) | agregados por día (calorías, proteína, agua, sueño, entreno, mood, peso). SIN timestamps de hora                                                           |
| `macro_targets`                             | metas de calorías/proteína                                                                                                                                 |
| `meals`                                     | comidas (scan-meal)                                                                                                                                        |
| `ai_insights`                               | **caché de IA** por (user, feature, period_type, period_start, period_end); freshness = `context_hash` + `prompt_version` + `expires_at`; `response` jsonb |
| `month_reflections`                         | respuestas de metacognición (continuidad entre meses, semilla de R6)                                                                                       |
| `revelations`, `mood_checkins`, …           | features de Hoy/Progreso                                                                                                                                   |

## Tablas del target R1 (aún no existen)

`facts`, `findings`, `stories`, `hypothesis`, `monthly_reports`,
`conversation_cache`. Hoy su lógica vive fusionada client-side
(`features/orbit/findings.ts`) y el caché de conversación usa `ai_insights`.

## Edge Functions (`supabase/functions/`)

| Función              | Modelo      | Rol                                                                                                                                                                                           |
| -------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stelar-insight`     | gpt-4o-mini | **Voz de IA.** 3 ramas: voz de periodo (Context Engine → `{voz}`), voz por hallazgo (`orbita_mes`), y chat guiado (`orbita_mes_chat`). Cachea en `ai_insights`. Backstop anti-relleno/clínico |
| `scan-meal`          | gpt-4o-mini | Foto de comida → macros                                                                                                                                                                       |
| `daily-intelligence` | —           | motor de patrones server-side (`_shared/intelligence/`)                                                                                                                                       |

Notas:

- `stelar-insight` es **self-contained a propósito** (el edge runtime de Supabase
  no bootea con imports relativos sin extensión). La fuente de verdad para
  app+tests es `_shared/intelligence/`; si cambia el hash, re-sincronizar la copia
  inline (tripwire: `features/orbit/__tests__/ai-prompt.test.ts`, "hash dorado").
- `PROMPT_VERSION` gobierna la invalidación del caché de IA (hoy `v2`).
- **Deploy antes de mergear a main** (regla de memoria): `supabase functions deploy <fn>`.

## El caché de conversación (chat de Órbita Mes)

`ai_insights.response = { turns: { [pathKey]: { message, chips } } }`, con
`pathKey = findingId + ruta de chips elegidos` y `context_hash = findingsHash`.
Árbol acumulativo, sin cambio de schema. Ver `ai-philosophy.md`.

## Motores determinísticos (dónde viven hoy)

- `_shared/intelligence/` — contexto + hash + prompt (server + cliente), fuente de verdad.
- `features/orbit/findings.ts` — detectores (Findings + Ranking + Hypothesis fusionados).
- `features/orbit/month-built.ts` — motor solo-cliente divergente (Mes), **a converger**.

## Target de convergencia (R1)

Separar en engines con tablas persistentes + converger `month-built.ts` hacia
`_shared/intelligence/`. Ver `../epics/epic-01-intelligence-engine.md`.
