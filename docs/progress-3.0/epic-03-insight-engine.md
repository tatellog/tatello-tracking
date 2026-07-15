# Epic 03 · Progress Insight Engine

**Status:** Draft · **Priority:** P0 · **Depende de:** Epic 00 (idealmente 01/02
para tener datos que analizar)

---

## Objetivo

Detectar **automáticamente** los cambios importantes en el usuario. **Todo
determinístico. Sin IA.** Este es el motor de Progress — el gemelo del motor de
Órbita (`_shared/intelligence/findings.ts`), pero responde _qué cambió_, no _por
qué_.

## Qué detecta

Cambios importantes · estabilidad · mejoras · retrocesos · coincidencias ·
tendencias. Ejemplos:

- Peso estable **+** grasa bajó → insight (recomposición visible).
- Fotos **+** cambio visible → insight.
- Proteína alta **+** músculo estable → insight.

## Contrato: `ProgressInsight`

Espeja el tipo `Finding` de Órbita para poder reutilizar el chat (Epic 04) y la
metacognición (Epic 05). Cada insight:

```
{
  id            // estable, para cache/de-dup
  title         // titular corto
  subject       // "tu grasa corporal"
  lead          // la lectura en voz del coach (QUÉ cambió)
  support       // la evidencia con números (del motor, nunca de IA)
  contrast      // el otro lado ("...mientras tu peso se mantuvo")
  confidence    // 0-100, umbral de dignidad como en Órbita
  relatedMetrics// ['weight','body_fat'] para enlazar cards
  northLink     // conexión con el objetivo (opcional)
}
```

## Backend

- `supabase/functions/_shared/intelligence/progress-insights.ts` (NUEVO, mismo
  hogar que el motor de Órbita) — detectores **puros**, re-exportados al cliente.
- `generateProgressInsights(input) → ProgressInsight[]` — como `buildFindings`.
- Lee agregados: `body_measurements` (peso/composición suavizados),
  `daily_signals` (hábitos), `photos` (existencia de fotos nuevas).
- `hashProgressInsights()` — llave de caché (como `hashFindings`), para invalidar
  la voz de IA de Epic 04 solo cuando cambia lo que se muestra.

**Regla:** los detectores nuevos van a `_shared/intelligence/` (no a un motor
solo-cliente divergente — mismo aprendizaje que `month-built.ts` en Órbita).

## IA

**No.** Cero IA en la detección. La IA de Epic 04 solo **explica** estos insights.

## Reutiliza

- El patrón de detectores puros + tipo `Finding` + `hashFindings` de Órbita.
- El umbral de confianza y la idea de "señal naciente" (emerging) vs consolidada.
- Convergencia con el spine de hitos ya existente
  (`_shared/intelligence/milestones.ts`, `detectMilestones` → `revelations`
  tier='milestone'): los **hitos de primera vez** ya se detectan; Epic 03 añade
  los **cambios/tendencias** (no de primera vez). Reutilizar, no duplicar.

## Guardarraíles

- Un retroceso es un insight **sin culpa** (hecho + números), nunca "empeoraste".
- El motor NO hipotetiza el porqué (eso es Órbita). `northLink` conecta al
  objetivo, no explica causa.
- Sin contar frecuencia como reproche (ver `features/patterns/CLAUDE.md`).

## Definition of Done

`generateProgressInsights` produce `ProgressInsight[]` determinísticos con
evidencia real, cubierto por tests puros (casos: recomposición, retroceso,
estabilidad, sin-datos → []). `tsc`/`eslint` limpios.

## Resultado

`ProgressInsight[]` — el insumo de Epic 04 (conversaciones) y Epic 05
(metacognición).
