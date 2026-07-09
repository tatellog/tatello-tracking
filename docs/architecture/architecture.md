# Arquitectura · Stelar

> Documento vivo (jul 2026). Panorama del sistema. Detalles por capa en
> `ai-philosophy.md`, `backend.md`, `frontend.md`.

## El pipeline de inteligencia

```
Health data (registros del usuario + wearables[R4])
        │
        ▼
   Supabase (Postgres + RLS)            ← fuente de verdad de datos
        │
        ▼
   Facts Engine        registros → hechos (agregados, nunca interpreta)
        │
        ▼
   Findings Engine     hechos → relaciones (reglas, sin IA)
        │
        ▼
   Story Engine        múltiples findings → una historia
        │
        ▼
   Ranking Engine      score por hallazgo (confianza/frecuencia/impacto/evidencia)
        │
        ▼
   Hypothesis Engine   sugiere (no afirma) posibles causas
        │
        ▼
   Front (Expo/RN)     reporte determinístico + chat guiado (GPT solo explica)
```

Regla transversal: **todo lo anterior a "Front" es determinístico.** La IA
(gpt-4o-mini) entra solo en el Front, para poner en palabras lo ya detectado.

## Capas y responsabilidades

| Capa    | Tecnología                                                                             | Responsabilidad                                                          |
| ------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Datos   | Supabase Postgres + RLS estricto                                                       | Guardar registros; una fila por usuario, `auth.uid() = user_id`          |
| Cómputo | Edge Functions (Deno) + lógica pura en `_shared/intelligence/` y `features/*/logic.ts` | Motores determinísticos; empujar cómputo al backend/puro                 |
| Voz IA  | Edge Function `stelar-insight` (gpt-4o-mini) + caché `ai_insights`                     | EXPLICAR hallazgos; nunca detectar, nunca ver datos crudos               |
| Cliente | Expo SDK 54 + React 19 + Expo Router + TanStack Query                                  | Renderizar; feature = `api.ts` + `hooks.ts` + `logic.ts` + `components/` |

## Flujo de una feature (patrón)

```
components/  ──usa──▶  hooks.ts (React Query)  ──llama──▶  api.ts (Zod + Supabase)
     │                                                          │
     └── logic.ts (puro, testeable) ◀───────────────────────────┘
```

## Estado actual vs target

- **Existe:** `daily_signals` (vista RLS de agregados por día), motor de findings
  client-side (`features/orbit/findings.ts`), `_shared/intelligence/` (contexto
  server+cliente), edge `stelar-insight`/`scan-meal`/`daily-intelligence`, caché
  `ai_insights`.
- **Target (R1):** engines separados (Facts, Findings, Story, Ranking, Hypothesis)
  con sus tablas; convergencia de `month-built.ts` (motor solo-cliente divergente)
  hacia `_shared/intelligence/`.

## Principios de diseño

1. **Determinismo detecta, IA comunica** (`ai-philosophy.md`).
2. **Empujar cómputo a Postgres/puro; app liviana.**
3. **RLS siempre**; nunca service role en cliente.
4. **Degradación grácil:** si la IA/wearable falla, Stelar sigue con lo determinístico.
5. **Tipos inferidos de Zod** en los bordes; validar respuestas Supabase/RPC.
