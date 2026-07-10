# Epic 05 · Experiments (R5)

**Estado:** Planeado · **PRD:** Release 5 · **Depende de:** R1 (Hypothesis Engine)

## Objetivo

Transformar hallazgos en **acciones**. No consejos: **experimentos** medibles.

## Ejemplo

```
Hipótesis: dormir más puede ayudarte
     ▼
Experimento: dormir 30 min antes, 7 días
     ▼
Medición ▼
     ▼
Resultado: confirmada / descartada / inconclusa
```

## Reglas

- **Un** experimento activo a la vez.
- Máximo **dos semanas**.
- Siempre **medible**. Siempre **reversible**.

## IA

Solo **redacta** el experimento. **Nunca inventa la hipótesis** (viene del
Hypothesis Engine determinístico, R1).

## Frontera de manifiesto (cuidar)

"Experimento medible y reversible" es la forma manifiesto-safe de accionar sin
recetar dieta/rutina ni presionar — cae bajo "Órbita recomienda un FOCO/palanca"
(recomendación, no orden). El copy no puede volverse orden/culpa ni racha rígida.
Pasar por `manifesto-reviewer` + `voice-and-copy`.

## Criterios de éxito

- [~] Proponer un experimento desde una hipótesis (IA redacta, no inventa) —
  spine determinístico listo (scaffold sin prosa); la IA que redacta es C (gated).
- [x] Un solo activo, ≤2 semanas, medible, reversible — garantizado a nivel DB
      (índice parcial `where status='running'`, CHECK `ends_on ≤ started_on+14`).
- [x] Registrar resultado: confirmada / descartada / inconclusa — el motor decide
      (`measureExperiment`), lo escribe la edge `experiment-lifecycle`.

## Tasks (Epic 01-style · F-A spine, F-B lógica, F-C IA, F-D UI)

**Hecho (spine + lógica determinística · scope A+B):**

- **A1** tabla `experiments` + RLS (FK compuesto same-user, ≤1 activo, ≤2 semanas).
- **A2** edge `experiment-lifecycle` (start/close · muta `hypotheses.status`).
- **A3** readers `useActiveExperiment` + `useHypotheses` (status real).
- **B1** `buildExperimentScaffold` (spec medible, sin prosa) + máquina de estados + guard.
- **B2** `measureExperiment` / `computeMetricRate` (el motor decide el resultado).

**Diferido (gated · tras validar flip/IA en device):**

- **C** IA que redacta el experimento (`feature:'experimento'` en `stelar-insight`,
  backstop + `manifesto-reviewer`/`voice-and-copy`).
- **D** UI dentro de Órbita (proponer → activo → medición → resultado).
