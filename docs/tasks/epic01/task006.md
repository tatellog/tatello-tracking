# Task 006 · Story Engine · encadenar findings

**Epic:** 01 · **Estado:** Todo · **Depende de:** task003, task005

## Descripción

Relacionar múltiples findings en una HISTORIA determinística (no IA). Ejemplo del
PRD: dormir poco → menos proteína → más hambre → no déficit.

## Alcance

- Tabla `stories` (id, user_id, period, `finding_ids[]`, `chain` jsonb, score) + RLS.
- Función `buildStories(findings, facts): Story[]` — encadena por coincidencia
  determinística (mismos días / dimensiones relacionadas), sin afirmar causa.

## Criterios de aceptación

- [ ] Una historia enlaza ≥2 findings con evidencia real (días compartidos).
- [ ] Tentativa, nunca causal ("coinciden", no "causa").
- [ ] Sin IA.

## Notas

Es la pieza que hoy NO existe (el chat arriesga una `hypothesis` de cruce, pero no
hay un Story Engine que encadene 3+). Cuidar el manifiesto: sin causalidad dura.
