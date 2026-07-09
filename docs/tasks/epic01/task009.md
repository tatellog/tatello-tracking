# Task 009 · conversation_cache · tabla

**Epic:** 01 · **Estado:** Parcial (hoy usa `ai_insights`) · **Depende de:** task008

## Descripción

El caché de conversación del chat guiado (R2). Hoy vive en `ai_insights` como un
árbol de turnos (`{ turns: { [pathKey]: {message, chips} } }`, keyed por
`findingsHash + path`). Decidir si se separa a `conversation_cache` propia o se
mantiene en `ai_insights`.

## Alcance

- Evaluar: mantener en `ai_insights` (sin migración, ya funciona) vs tabla dedicada.
- Si dedicada: `conversation_cache` (user_id, feature, period, `findings_hash`,
  `path_key`, `payload`, `prompt_version`, `expires_at`) + RLS.

## Criterios de aceptación

- [ ] Regenera solo si cambian los hallazgos (`findings_hash`) o `PROMPT_VERSION`.
- [ ] Cero llamada a GPT si la ruta ya se visitó.
- [ ] Decisión documentada (por qué separar o no).

## Notas

Recomendación actual: **mantener en `ai_insights`** hasta que haya razón fuerte
(respeta el freeze; ya probado). Esta task es sobre todo una decisión.
