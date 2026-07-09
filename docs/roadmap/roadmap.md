# Roadmap · Stelar Intelligence

> Documento vivo. Derivado de los 6 PRDs (Release 1–6) y el estado real del
> código a jul 2026. La fuente de "qué NO hacer / cómo habla" sigue siendo
> `features/docs/product-manifesto.md` (v3.0); esto es el "qué construir".

## La tesis

Stelar convierte miles de registros en **conocimiento**. La detección es
**determinística** (confiable, de la DB); la IA solo **comunica** los hallazgos.
El norte es la pérdida de peso sostenible; sueño, energía, movimiento, ciclo y
emociones son dimensiones que alimentan el motor, no metas propias.

Ver `../architecture/ai-philosophy.md` para el principio y sus barreras.

## Los releases

| #   | Release                                                        | Objetivo en una línea                                                                 | Estado                                                                       |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| R1  | [Intelligence Engine](../epics/epic-01-intelligence-engine.md) | Motor determinístico: registros → hechos → findings → historias → ranking → hipótesis | En curso (implementación temprana fusionada en `features/orbit/findings.ts`) |
| R2  | [Órbita AI](../epics/epic-02-orbita-ai.md)                     | Mostrar los hallazgos del mes como descubrimiento guiado; GPT solo explica            | En curso (teaser → reporte → chat fact-led ya en rama)                       |
| R3  | [Progress](../epics/epic-03-progress.md)                       | La evolución completa (no solo peso): Resumen + Historia                              | Parcial (features/progress WIP congelado)                                    |
| R4  | [Wearables](../epics/epic-04-wearables.md)                     | Apple Health/Garmin/Fitbit/Oura/… alimentan el Facts Engine                           | Planeado (spec en `docs/wearables-integration-spec.md`)                      |
| R5  | [Experiments](../epics/epic-05-experiments.md)                 | Hipótesis → experimentos medibles y reversibles                                       | Planeado                                                                     |
| R6  | [Stelar Intelligence](../epics/epic-06-stelar-intelligence.md) | Memoria mensual que aprende; la IA conecta meses                                      | Visión                                                                       |

## Dependencias

```
R1 (motor)  ──▶ R2 (Órbita AI)  ──▶ R6 (aprende con el tiempo)
   │                                  ▲
   ├──▶ R3 (Progress) ────────────────┤
   ├──▶ R5 (Experiments) ─────────────┤
   └──◀ R4 (Wearables: alimenta el Facts Engine de R1)
```

- **R1 es la base de todo.** Facts/Findings/Ranking/Hypothesis los consumen R2, R3, R5, R6.
- **R4 no depende de nadie y nadie depende de él** (regla: si no hay wearable, Stelar sigue). Solo enriquece el Facts Engine.
- **R6 requiere que R1, R2 y R5 hayan corrido varios meses** (necesita memoria histórica).

## Principio de éxito (R6, aplica a todo)

No se mide porque la usuaria converse más con la IA. Se mide porque **cada mes
entiende mejor su comportamiento y toma mejores decisiones con menos esfuerzo**.

## Estado a jul 2026 (honesto)

Lo construido estos días (Órbita Mes) es el **arranque real de R1 + R2**:

- Findings + Ranking + Hypothesis viven **fusionados client-side** en `features/orbit/findings.ts` (no como 5 engines separados con tablas).
- El reporte de evidencia (veredicto → dónde se te va → puerta abierta) y el
  chat guiado fact-led (`stelar-insight` / `orbita_mes_chat`) ya existen.
- **Falta** para cerrar R1: los engines separados (Facts, Story) y las tablas
  `facts / findings / stories / hypothesis / monthly_reports / conversation_cache`.
