# features/patterns · contexto local v3.0

Este archivo aplica SOLO a `features/patterns/`. Es el feature core de Stelar · el diferenciador. Las reglas aquí son más estrictas que en el resto del repo porque un error en este feature toca terreno sensible (relación de la usuaria con su cuerpo).

## Estado v3.0 (mayo 2026)

Estamos en MVP. **Los detectores son determinísticos** · reglas if/else basadas en datos crudos. La migración a IA generativa viene DESPUÉS de validar con las 5 usuarias el 27 de julio 2026.

## Regla #1 · siempre

Antes de tocar este código, lee:

- `docs/branding/PRODUCT_MANIFESTO.md` v3.0 · especialmente "La feature core" y "La línea roja"
- El último commit que tocó esta carpeta · para entender el estilo de los patrones existentes

Si vas a agregar un patrón nuevo, usa el comando `/new-pattern <nombre>` en lugar de improvisar la estructura.

## Convenciones técnicas

### Estructura de archivos

```
features/patterns/
├── logic.ts            · funciones puras (detectores determinísticos)
├── messages.ts         · mensajes del coach por patrón
├── hooks.ts            · usePatternDetection y similares
├── api.ts              · queries a Supabase (detected_patterns table)
├── types.ts            · DetectedPattern, DailySignal, etc
├── __fixtures__/
│   └── signals.ts      · fixtures para tests
└── logic.test.ts       · tests vitest
```

### Firma estándar de detectores

```typescript
export function detect<NombrePattern>(
  signals: DailySignal[],
  context?: DetectionContext,
): DetectedPattern | null
```

- Función PURA · sin side effects, sin React, sin queries, sin fechas globales (`new Date()`). El contexto entra como parámetro.
- Retorna `null` si no se detecta · retorna `DetectedPattern` si sí.
- Ventana de análisis explícita en el código, NO hardcoded en un número mágico. Constante con nombre · `const WINDOW_DAYS = 7;`
- **Determinístico:** misma entrada → misma salida. Sin random, sin LLMs, sin heurísticas vagas.

### Mensajes del coach (messages.ts)

Cada patrón tiene un array de 2-3 variantes. El hook hace random pick para no repetir el mismo mensaje.

```typescript
export const messages_<patternName>: CoachMessage[] = [
  { id: '<patternName>-1', text: '...' },
  { id: '<patternName>-2', text: '...' },
  { id: '<patternName>-3', text: '...' },
];
```

Antes de mergear mensajes nuevos, invoca `voice-and-copy` para validar.

## Línea roja v3.0 (no negociable)

### Palabras prohibidas en mensajes (visibles al usuario)

- atracón, atracones → usar "comida tardía", "comer fuera de tu rutina"
- trastorno, disorder, TCA → prohibido
- restricción, purga → prohibido
- diagnóstico, "tu trastorno", "tu condición" → prohibido
- anorexia, bulimia, EDNOS, ortorexia, BED → prohibido
- ansiedad, depresión (como diagnóstico) → prohibido

### Palabras prohibidas en suplantación de profesionales

- "como tu nutrióloga" → prohibido
- "como tu coach" → prohibido
- "como tu terapeuta" → prohibido
- "te recomendamos comer X" → prohibido (prescripción de dieta)
- "deberías entrenar Y" → prohibido (prescripción de gym)
- "para tu salud mental" → prohibido (suplantación clínica)

### Patrones prohibidos en lógica

- NO inferir trastornos. Detectas comportamientos, no condiciones.
- NO contar "fallos" ni "éxitos". Detectas frecuencias y patrones, sin juicio.
- NO categorizar a la usuaria ("eres una atracadora compulsiva"). Categorizas observaciones, no personas.

### Si un patrón cruza la línea (severo)

Si detectas algo que parece severo (comidas tardías diarias durante semanas, ingesta muy baja sostenida, mención de auto-daño), el detector NO debe mostrar un mensaje del coach. Debe:

1. Escribir a la tabla `severe_signals` que se revisa manualmente
2. Mostrar un mensaje suave del coach que sugiera hablar con un profesional
3. Linkear a recursos profesionales (a definir antes del launch)

Ese flujo es **separado del coaching normal**. NO es el mismo mensaje.

## Naming técnico (Capa 3 del manifiesto)

En código (no visible al usuario) puedes usar términos descriptivos técnicos:

✅ Permitido en código:

- `detectLateNightEating()` (descriptivo)
- `detectAbandonmentRisk()` (descriptivo)
- `nightEatingPattern` como key
- Comentario: `// detects late-night eating pattern`

❌ Evitar incluso en código:

- `detectBingeEating` (binge eating es término clínico)
- `detectAnxietyEating` (ansiedad es término clínico)
- `eatingDisorderRisk` (TCA es término clínico)

La regla: incluso en código interno, evita términos clínicos. Reduce el riesgo de que se filtren a logs, comentarios visibles, o documentación pública.

## Performance y tamaño

- Los detectores corren en cada apertura de Tab Hoy o Tab Órbita. Deben ser rápidos: <50ms por detector con dataset normal (90 días, ~300 eventos).
- Si un detector necesita más de 50ms, el problema es el algoritmo, no el hardware · revisa complejidad.
- Si necesitas O(n²) en signals, primero pregúntate si puedes ordenar y hacer O(n log n).

## Mocks y testing

- Cada detector tiene mínimo 4 tests: happy / borderline / extreme / false-positive.
- Fixtures en `__fixtures__/signals.ts` · reutiliza fixtures entre tests cuando aplique.
- Tests con vitest. Si un test toma más de 50ms, refactoriza · algo está mal.
- Nombres de tests evitan terminología clínica (incluso si es descriptivo internamente).

## Antes de commit en este feature

1. `pnpm test features/patterns/` · todos verdes
2. Invoca `manifesto-reviewer` con el diff
3. Si tocaste `messages.ts`, invoca `voice-and-copy` con los strings nuevos
4. Si tocaste `logic.ts`, revisa que la complejidad sigue siendo razonable

## Recordatorio del compromiso de lanzamiento

Cualquier feature nueva en patterns durante las próximas 8 semanas (hasta 27 jul 2026) DEBE ser parte del MVP definido. Si propones agregar un patrón nuevo que no está en los 5 prompts del MVP, BLOQUEA · va a post-launch.
