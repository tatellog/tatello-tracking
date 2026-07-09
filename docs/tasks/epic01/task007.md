# Task 007 · Hypothesis Engine · tabla + generación

**Epic:** 01 · **Estado:** Parcial · **Depende de:** task003, task006

## Descripción

Generar hipótesis que **sugieren, no afirman** (ej. "Es posible que tus noches
cortas estén dificultando mantener el déficit"). Determinístico. Persistir para
que R5 (Experiments) y R6 (memoria) las consuman.

## Alcance

- Tabla `hypothesis` (id, user_id, period, `finding_id`/`story_id`, text,
  confidence, status: open/experimenting/confirmed/discarded/inconclusive) + RLS.
- Generación desde stories/findings con cruce real (base: `crossHypothesis`).

## Criterios de aceptación

- [ ] Redacción tentativa ("es posible", "podría"), nunca afirmación causal.
- [ ] Sin culpa/clínico; pasa `manifesto-reviewer`.
- [ ] `status` listo para el ciclo de experimentos (R5).

## Notas

Hoy `crossHypothesis` produce el texto tentativo pero no se persiste. Esta task lo
formaliza y le da estado.
