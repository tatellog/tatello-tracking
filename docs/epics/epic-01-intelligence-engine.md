# Epic 01 · Intelligence Engine (R1)

**Estado:** En curso · **Prioridad:** Crítica · **PRD:** Release 1

## Objetivo

El motor determinístico que convierte registros en conocimiento estructurado.
Cinco engines encadenados, **cero IA para detectar**. La IA solo explica después.

```
Facts → Findings → Story → Ranking → Hypothesis
```

## Alcance

- **Facts Engine** — registros → hechos (agregados). Nunca interpreta.
- **Findings Engine** — hechos → relaciones por reglas.
- **Story Engine** — múltiples findings → una historia.
- **Ranking Engine** — score por hallazgo.
- **Hypothesis Engine** — sugiere (no afirma).
- **Tablas:** `facts`, `findings`, `stories`, `hypothesis`, `monthly_reports`, `conversation_cache`.

## Fuera de alcance

- IA/GPT (eso es R2).
- Wearables como fuente (R4; el Facts Engine debe aceptarlos pero no depender).

## Dependencias

Ninguna aguas arriba. Es la base de R2, R3, R5, R6.

## Estado actual (jul 2026)

Findings + Ranking + Hypothesis viven **fusionados client-side** en
`features/orbit/findings.ts` (detectores de déficit, obstáculos "dónde se te va",
palancas, contrapunto, `crossHypothesis`, `buildFindings` con score y cap). El
contexto server+cliente está en `_shared/intelligence/`. `month-built.ts` es un
motor solo-cliente divergente. **No existen** los engines separados ni las tablas.

## Criterios de éxito (del PRD)

- [ ] Generar reporte mensual
- [ ] Generar ranking
- [ ] Generar historias
- [ ] Cero IA en la detección

## Tasks

| #   | Task                                                                                 | Estado                      |
| --- | ------------------------------------------------------------------------------------ | --------------------------- |
| 001 | [Facts Engine · tabla + RLS](../tasks/epic01/task001.md)                             | Todo                        |
| 002 | [Facts Engine · cómputo de agregados](../tasks/epic01/task002.md)                    | Todo                        |
| 003 | [Findings Engine · tabla + formalizar detectores](../tasks/epic01/task003.md)        | Parcial                     |
| 004 | [Findings Engine · migrar detectores de `findings.ts`](../tasks/epic01/task004.md)   | Parcial                     |
| 005 | [Ranking Engine · modelo de score](../tasks/epic01/task005.md)                       | Parcial                     |
| 006 | [Story Engine · encadenar findings](../tasks/epic01/task006.md)                      | Todo                        |
| 007 | [Hypothesis Engine · tabla + generación](../tasks/epic01/task007.md)                 | Parcial                     |
| 008 | [monthly_reports · ensamblado + persistencia](../tasks/epic01/task008.md)            | Todo                        |
| 009 | [conversation_cache · tabla](../tasks/epic01/task009.md)                             | Parcial (usa `ai_insights`) |
| 010 | [Convergencia `month-built.ts` → `_shared/intelligence`](../tasks/epic01/task010.md) | Todo                        |
