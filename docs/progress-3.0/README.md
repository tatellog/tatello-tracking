# Progress 3.0 · Roadmap

**Status:** Draft · **Owner:** Product · **Módulo:** Progress (tab Progreso)

Documentación para el rediseño y los nuevos features del tab **Progreso**. Cada
épica está escrita para que Claude pueda tomarla **una por una, con el mínimo
contexto**, reutilizando la arquitectura que ya existe para Órbita.

---

## La pregunta que responde Progress

> **"¿Qué ha cambiado en mí?"**

Progress **NO** explica por qué. **NO** genera hipótesis. **NO** diagnostica.
Eso pertenece a **Órbita**. Esta es la línea divisoria dura de todo el módulo:

|          | Progress                                           | Órbita                                     |
| -------- | -------------------------------------------------- | ------------------------------------------ |
| Pregunta | ¿Qué cambió?                                       | ¿Por qué? ¿Qué comportamiento lo acompañó? |
| Muestra  | evolución (física + hábitos) como evidencia visual | patrones, palancas, foco                   |
| IA       | solo **explica** un cambio ya detectado            | observa y recomienda un foco               |

**Nunca duplicar información entre los dos.** Progress muestra _qué_ cambió;
Órbita muestra _qué comportamiento acompañó_ ese cambio.

---

## Principio arquitectónico (heredado de Órbita)

**"El motor piensa, la IA comunica."** Un motor **determinístico** detecta los
cambios (Epic 03); la IA (gpt-4o-mini vía edge, gateada + cacheada) **solo
reformula** en voz cálida (Epic 04). La IA nunca detecta, nunca calcula, nunca
inventa números (backstop obligatorio, ver Órbita `stelar-insight`).

---

## Roadmap

```
Epic 00 · Foundation            (P0 · base técnica, sin UI visible)
   ↓
Epic 01 · Historia              (P1 · ¿cómo cambiaron mis hábitos?)
   ↓
Epic 02 · Body                  (P1 · ¿cómo cambió mi cuerpo?)
   ↓
Epic 03 · Progress Insight Engine   (P0 · motor determinístico, sin IA)
   ↓
Epic 04 · Guided Insight Conversations (P1 · IA solo explica)
   ↓
Epic 05 · Metacognition         (P1 · reflexión guiada, sin consejo)
   ↓
Epic 06 · Progress Ecosystem    (P2 · conexión con el resto de Stelar)
   ↓
Epic 07 · Longitudinal Intelligence (P3 · documentar hoy, construir en 6-12 meses)
```

Los P0 (00 Foundation, 03 Insight Engine) son la columna: sin ellos, lo demás
refactoriza. Epic 07 **no se construye aún** pero se documenta para que los
modelos de datos de 00–06 la soporten sin refactors.

---

## Qué YA existe en el repo (reutilizar, no reconstruir)

- **`features/progress/`** — `api.ts` + `hooks.ts` + `logic.ts` + componentes
  (`TuHistoria`, `WeightChart`, `BeforeAfterSlider`, `ComparativaCard`,
  `HeroStat`, `DayHistorySheet`, `MovementConstellation`, `RangeChips`…).
- **Tablas**: `body_measurements`, `photos`, `cycle_events`, `wearable_body_composition`,
  `wearable_sleep/steps/workouts`, `workouts`, `sleep_logs`.
- **Spine de hitos**: `supabase/functions/_shared/intelligence/milestones.ts`
  (`detectMilestones`) + `features/progress/milestones.ts`, que converge en
  `revelations` tier='milestone' (gateado por `MILESTONES_ENABLED`, hoy OFF).
- **Ingesta de composición corporal** (Apple Health) gateada por
  `WEARABLE_BODY_COMPOSITION_ENABLED` (hoy OFF).

## Qué reutilizar de Órbita (infra probada)

- **Motor**: patrón de `supabase/functions/_shared/intelligence/` (detectores
  puros, tipo `Finding`, `hashFindings`).
- **IA + chat**: `supabase/functions/stelar-insight/` (edge gpt-4o-mini, cache
  `ai_insights`, `PROMPT_VERSION`, backstops anti-alucinación) y
  `features/orbit/components/FindingChatView.tsx` + `MonthChatSheet.tsx` (chat
  guiado + persistencia de transcript que rehidrata sin red).
- **Metacognición / focos**: tabla `month_reflections` (respuestas guiadas).
- **Gating**: `aiEnabledForEmail` (dev-only hasta validar).

---

## Guardarraíles del manifiesto (aplican a TODO el módulo)

- El peso se muestra como **evidencia de cambio**, nunca como countdown, meta
  comparativa ("47% de tu meta") ni presión ("pésate hoy").
- Voz del coach: cálida, Cormorant italic para lo emocional, **nunca clínica ni
  de culpa**. Un retroceso se muestra como hecho, sin reproche.
- Sin lenguaje clínico ("atracón", "trastorno").
- Respuestas de reflexión **siempre guiadas**, nunca input libre.
- Toda tabla nueva lleva RLS (`auth.uid() = user_id`) — pasar por `rls-auditor`.

## Cómo Claude usa estos docs

Para trabajar una épica: leer **este README** + **el doc de esa épica** +
`.claude/CLAUDE.md` + `docs/product-manifesto.md`. Cada épica declara
sus **dependencias** (qué debe existir antes) y **qué reutiliza**. Mostrar el
diff antes de aplicar; no commitear sin aprobación.
