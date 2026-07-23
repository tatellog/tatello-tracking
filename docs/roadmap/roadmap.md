# Roadmap · Stelar Intelligence

> Documento vivo. Derivado de los 6 PRDs (Release 1–6) y el estado real del
> código a jul 2026. La fuente de "qué NO hacer / cómo habla" sigue siendo
> `docs/product-manifesto.md` (v3.0); esto es el "qué construir".
>
> **El ORDEN de ejecución ya no vive aquí:** lo marca
> `docs/product-vision-roadmap.md` (fases V-01…V-19). Este doc queda como
> índice de los releases R1–R6 del motor de inteligencia y sus dependencias.

## La tesis

Stelar convierte miles de registros en **conocimiento**. La detección es
**determinística** (confiable, de la DB); la IA solo **comunica** los hallazgos.
El norte es la pérdida de peso sostenible; sueño, energía, movimiento, ciclo y
emociones son dimensiones que alimentan el motor, no metas propias.

Ver `../architecture/ai-philosophy.md` para el principio y sus barreras.

## Los releases

| #   | Release                                                        | Objetivo en una línea                                                                 | Estado                                                                                                                                                    |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | [Intelligence Engine](../epics/epic-01-intelligence-engine.md) | Motor determinístico: registros → hechos → findings → historias → ranking → hipótesis | Construido (pipeline en `_shared` + 5 tablas + writer `compute-findings`; flip ON solo en superficie dev; convergencia `month-built.ts` pendiente → V-10) |
| R2  | [Órbita AI](../epics/epic-02-orbita-ai.md)                     | Mostrar los hallazgos del mes como descubrimiento guiado; GPT solo explica            | Construido · gated a dev (card IA + chat guiado + memoria de patrones F1 + N7; falta validar en dev build y abrir a beta)                                 |
| R3  | [Progress](../epics/epic-03-progress.md)                       | La evolución completa (no solo peso): Resumen + Historia                              | Parcial (Progress 3.0 épicas 00–06 y 08 construidas, varias gated; milestones spine ✓; mapa corporal diferido)                                            |
| R4  | [Wearables](../epics/epic-04-wearables.md)                     | Apple Health/Garmin/Fitbit/Oura/… alimentan el Facts Engine                           | Fase 1 construida (workouts/sueño/pasos); composición corporal gated OFF; Apple Health + Health Connect → V-14                                            |
| R5  | [Experiments](../epics/epic-05-experiments.md)                 | Hipótesis → experimentos medibles y reversibles                                       | Spine construido (tabla + edge `experiment-lifecycle` + lógica pura); IA redactora y UI diferidas → V-12                                                  |
| R6  | [Stelar Intelligence](../epics/epic-06-stelar-intelligence.md) | Memoria mensual que aprende; la IA conecta meses                                      | Visión                                                                                                                                                    |

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

## Estado a fines de jul 2026 (honesto)

- **R1 cerró su construcción** (Epic 01): pipeline de 5 engines en
  `_shared/intelligence/`, tablas persistidas y writer `compute-findings`.
  `USE_PERSISTED_MONTH_REPORT` ya está ON, pero solo impacta la superficie
  IA gateada a dev. Deuda declarada: `month-built.ts` sigue siendo motor
  divergente (converge en V-10, ADR 0002).
- **R2 está construido y gateado a dev** (`aiEnabledForEmail`): la beta ve
  el Órbita Mes determinista de siempre.
- Lo que corre en producción para la beta HOY sigue siendo el motor
  client-side + la Lectura Semanal determinística (V-05, sin IA).
