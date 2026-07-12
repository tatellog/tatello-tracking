# Epic 05 · Metacognition

**Status:** Draft · **Priority:** P1 · **Depende de:** Epic 04

---

## Objetivo

Generar **reflexión**. **No consejos. No diagnósticos.** Progress no le dice al
usuario qué hacer; le devuelve una pregunta que lo hace verse a sí mismo.

## Preguntas (guiadas)

- ¿Qué piensas?
- ¿También lo habías notado?
- ¿Esperabas este cambio?
- ¿Qué crees que cambió?

## Respuestas

**Siempre guiadas. Nunca input libre.** El usuario elige entre opciones (como la
metacognición de Órbita: "¿Esto ya lo sabías?" con opciones, no un textarea).

## Backend · Reflection Engine

- Reutilizar la tabla **`month_reflections`** (o su patrón) — ya guarda las
  respuestas de metacognición de Órbita con clave namespaced. Para Progress, una
  clave propia (p. ej. `progress:<insightId>`), misma tabla + RLS existente, sin
  migración nueva si el shape sirve.
- `Reflection Responses` — se guardan para **futuras conversaciones** (la semilla
  de continuidad / Epic 07). **No modifican los insights.**

## IA

**Solo adapta el lenguaje. Nunca interpreta.** La IA puede vestir la pregunta con
calidez; no elige la pregunta ni interpreta la respuesta.

## Reutiliza

- El componente y el flujo de metacognición de Órbita (la pregunta + opciones +
  reply guardado; ver `FindingChatView`/`onSaveReflection` y `useSaveReflection`).
- `month_reflections` como store (mismo patrón que los focos "Me lo quedo
  presente").

## Guardarraíles

- Nunca un consejo ("deberías…"), nunca un diagnóstico. Solo reflexión.
- La respuesta del usuario **no** cambia la evidencia (inmutable): se guarda como
  memoria, no reescribe el insight.
- Sin culpa en ninguna variante de la pregunta.

## Definition of Done

Un insight puede cerrar con una pregunta de metacognición (opciones guiadas), la
respuesta se persiste (reusando `month_reflections`) y queda disponible para
futuras conversaciones, sin tocar el insight. `tsc`/`eslint` limpios.

## Resultado

Respuestas de reflexión guardadas — memoria para Epic 04 (conversaciones futuras)
y Epic 07 (inteligencia longitudinal).
