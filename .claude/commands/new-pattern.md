---
description: Scaffolding para crear un detector de patrón nuevo siguiendo las convenciones de features/patterns. Detectores determinísticos para MVP · IA viene después. Argumento: nombre del patrón en snake_case (ej: late_night_eating)
---

Vas a crear un detector de patrón nuevo: $ARGUMENTS

## Pre-requisitos · lee antes de empezar

1. `features/docs/product-manifesto.md` (v3.0) · sección "La feature core" y "La línea roja".
2. `features/patterns/CLAUDE.md` · convenciones locales.
3. `features/patterns/logic.ts` · ver patrones existentes para seguir su estructura.
4. `features/patterns/messages.ts` · ver tono de mensajes existentes.
5. `features/patterns/__fixtures__/signals.ts` · estructura de fixtures.

## Recordatorio crítico v3.0

Para MVP, los detectores son **determinísticos** (reglas if/else basadas en datos crudos), NO usan LLMs. La migración a IA viene después de validar con 5 usuarias. Mantén la lógica simple, predecible, testeable.

## Lo que vas a generar

### 1. Función detector en `features/patterns/logic.ts`

Firma estándar (no inventes otra):

```typescript
export function detect$ARGUMENTS(
  signals: DailySignal[],
  context?: DetectionContext,
): DetectedPattern | null {
  // implementación
}
```

Reglas:

- Función pura. Sin side effects. Sin React.
- Ventana de análisis explícita (típicamente 7-14 días).
- Retorna `null` si no detecta · retorna `DetectedPattern` si sí.
- Si vas a hacer algún cómputo de fechas, usa `date-fns` (ya está en el proyecto), no `Date` nativa.
- Lógica determinística clara. NO uses ML, NO uses LLMs, NO uses heurísticas vagas.

### 2. Fixture en `features/patterns/__fixtures__/signals.ts`

Mínimo 4 escenarios:

- `$ARGUMENTS_happyPath` · caso donde el patrón se detecta claramente
- `$ARGUMENTS_edgeCase_borderline` · justo en el límite (1 evento menos del threshold)
- `$ARGUMENTS_edgeCase_extreme` · caso extremo (muchos eventos)
- `$ARGUMENTS_falsePositive` · caso que PARECE el patrón pero no debería detectarse

### 3. Mensajes en `features/patterns/messages.ts`

2-3 variantes del mensaje del coach para este patrón:

```typescript
export const messages_$ARGUMENTS: CoachMessage[] = [
  { id: '$ARGUMENTS-1', text: '...' },
  { id: '$ARGUMENTS-2', text: '...' },
  { id: '$ARGUMENTS-3', text: '...' },
]
```

Reglas para los mensajes (CRÍTICO v3.0):

- **NUNCA palabras clínicas:** atracón, trastorno, ansiedad, restricción, TCA, diagnóstico.
- **NUNCA prescripción:** "deberías", "tienes que", "te recomiendo".
- **NUNCA reemplazo de profesionales:** no actúes como nutrióloga, coach, ni terapeuta.
- **IA de Órbita = Observadora (V2):** describe el patrón en datos propios, no aconseja. "tu energía fue más estable cuando dormiste más de 7h" ✓ · "deberías dormir más" ✗.
- Observación empática, no diagnóstico.
- Voz Stelar (ver `voice-and-copy` para detalles).
- 1-2 frases máximo. Cortas.
- Pregunta más que afirma.
- Antes de finalizar, pide al sub-agent `voice-and-copy` que los revise.

### 4. Test en `features/patterns/logic.test.ts`

Cobertura mínima usando vitest:

- Detecta correctamente el happy path
- Retorna null en borderline
- Retorna null en false positive
- Retorna null con array vacío

Si no sabes la estructura exacta de tests, invoca al sub-agent `test-writer` con la función nueva.

### 5. Documentación en `docs/patterns-detected.md`

Agregar una entrada:

```markdown
## $ARGUMENTS

**Criterio:** <descripción técnica del detector>
**Ventana:** <días que analiza>
**Severidad:** observación / patrón / señal de línea roja
**Mensaje ejemplo:** <uno de los mensajes>
**Falsos positivos conocidos:** <lista>
**Capa de detección:** determinístico (v1) / IA-asistido (post-MVP)
```

## Proceso

1. Pregúntame al usuario: ¿cuál es el criterio del patrón en lenguaje natural? (ej: "comer 2+ veces después de las 21h en 7 días")
2. Una vez confirmado, genera los 5 entregables.
3. Muéstrame el diff completo ANTES de aplicar.
4. Pide validación con `voice-and-copy` para los mensajes ANTES de finalizar.
5. NO commitees. Espera mi aprobación.

## Conexión con V2

Los patrones alimentan las **Reliquias Celestes** (Brillo / Ancla / Pausa /
Señal Naciente) y las **Lecturas** (Diaria / Semanal / Mensual) de Órbita ·
ver `docs/PRD-v2.md`. Un detector nuevo debe poder mapearse a una de esas
categorías. Las dimensiones válidas de entrada son peso, comida, sueño,
energía, movimiento, ciclo y emociones (insumos del motor, no metas).

## Recordatorio crítico v3.0

Este es el feature core de Stelar. La línea entre "observación empática útil" y "diagnóstico clínico irresponsable" es delgada. Si dudas si un mensaje es apropiado, asume que NO lo es y propón alternativas más conservadoras.

Stelar es app de pérdida de peso, no es:

- Nutrióloga (no da consejos de qué comer)
- Coach (no da rutinas)
- Terapeuta (no trata salud mental)

Si el patrón cruza territorio severo (auto-daño, restricción extrema sostenida, comidas tardías diarias durante semanas), el detector NO debe mostrar mensaje normal. Debe activar el flujo de derivación a profesional (sección "Línea roja" del manifiesto).

## Uso típico

```
/new-pattern late_night_eating
/new-pattern abandonment_risk
/new-pattern weekend_inconsistency
```
