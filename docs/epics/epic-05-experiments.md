# Epic 05 · Experiments (R5)

**Estado:** Construido · gated dev (V-12, sep 2026) · **PRD:** Release 5 · **Depende de:** R1 (Hypothesis Engine)

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

**Hecho (UI · gateada a dev · V-12 "la prueba nace del chat", decisión dueña):**

- **D** La UI-laboratorio (`MonthExperiments.tsx`) se RECHAZÓ en device y quedó
  huérfana (nadie la monta; su copy de veredicto vive en
  `features/experiments/verdict.ts`). La superficie vigente es conversacional:
  - El cierre del chat del hallazgo principal (`FindingChatView` vía
    `MonthChatSheet`) ofrece "Probarlo unos días" si su hipótesis está `open`,
    la dimensión es medible (espejo de `METRIC_BY_DIMENSION`) y no hay otra
    prueba activa. "Dejar la prueba" vive en el mismo lugar (cancel reversible).
  - El seguimiento es una línea en el arco de la card (`MonthDiscovery`):
    "Lo estamos siguiendo · día 4 de tu prueba". Cero sección aparte.
  - Al vencer, el experimento se AUTO-CIERRA en la siguiente visita a Mes
    (`MonthSegmentIA`: el motor mide y decide); el veredicto es UNA línea en la
    card durante 7 días. Hipótesis confirmada → el arco avanza a Confirmado.
  - Mutations `useStart/Close/CancelExperiment` → edge `experiment-lifecycle`
    (desplegada). Tests: `experiments-verdict.test.ts` cubre el veredicto.

**Hecho (IA · gateada a dev):**

- **C** IA que redacta el FOCO del experimento (`feature:'experimento'` en
  `stelar-insight`, gpt-4o-mini, caché `ai_insights`). Recibe solo métrica humana
  - hipótesis, escribe UNA frase de foco ("pon un ojo en…"), NUNCA receta.
    Blindaje: prompt reforzado + backstop propio `EXPERIMENT_PRESCRIPTIVE` (atrapa
    verbos de conducta sin bloquear los de observación · hueco del `BANNED_LEXICON`
    compartido que halló manifesto-reviewer). Fallback: la hipótesis determinística.

**Diferido:**

- Abrir la UI a la beta (hoy solo dev, tras `aiEnabledForEmail`).
- Validar en device el ciclo completo (ofrecer → correr → dejar / auto-cierre →
  veredicto) y el avance del arco a Confirmado.
- **C quedó desconectada:** `useExperimentCopy` (la IA que redacta el foco) solo
  la consumía la UI huérfana; la superficie conversacional no la llama. Decidir
  si se conecta a la oferta del chat o se retira.
- Destino final de `MonthExperiments.tsx` (borrar o conservar como referencia).
