---
description: Valida un feature completo antes de merge · invoca a los sub-agents relevantes en orden y resume resultados. Alineado a manifiesto v3.0.
---

Vas a validar el feature en $ARGUMENTS (ej: `features/patterns` o `features/orbit`).

## Proceso

1. Lee `features/docs/product-manifesto.md` para tener contexto. Verifica que esté en versión 3.0 o posterior.
2. Lee `CLAUDE.md` del root.
3. Si existe `$ARGUMENTS/CLAUDE.md` local, léelo también.
4. Lista los archivos modificados en este feature respecto a main:
   ```bash
   git diff main...HEAD --name-only $ARGUMENTS
   ```
5. Si no hay archivos modificados, di "nada que validar en $ARGUMENTS" y termina.

## Invocación de sub-agents (en orden)

Para cada sub-agent abajo, pásale el diff relevante con `git diff main...HEAD $ARGUMENTS`:

### 1. Manifiesto (siempre)

Invoca `manifesto-reviewer` con el diff. Anota el resultado. Este sub-agent ahora verifica las 3 capas de lenguaje y los 10 principios de v3.0.

### 2. Reanimated (condicional)

SI el diff toca alguno de estos:

- archivos con `import * from 'react-native-reanimated'`
- `features/tabs/components/LunarConstellation*`
- `features/orbit/**`
- cualquier archivo con `.worklet` / `useAnimatedStyle` / `useSharedValue` / `useDerivedValue`

Entonces invoca `reanimated-guardian` con el diff. Anota el resultado.

### 3. Voice and copy (condicional)

SI el diff toca strings visibles al usuario · típicamente archivos con extensión `.tsx`, archivos en `messages.ts`, o strings literales largos en español:

Entonces invoca `voice-and-copy` con los strings encontrados. Anota el resultado.

### 4. RLS auditor (condicional)

SI el diff incluye archivos en `supabase/migrations/`:

Entonces invoca `rls-auditor` con esas migraciones. Anota el resultado.

## Output final

Tabla resumen en formato markdown:

```
Validación de feature: $ARGUMENTS

| Sub-agent             | Status              | Resumen                                    |
|-----------------------|---------------------|--------------------------------------------|
| manifesto-reviewer    | limpio / N issues   | <una frase del resultado>                  |
| reanimated-guardian   | N/A / verde / issues| <una frase o "no aplica">                  |
| voice-and-copy        | N/A / limpio / issues| <una frase o "no aplica">                 |
| rls-auditor           | N/A / clean / issues| <una frase o "no aplica">                  |

Veredicto: [LISTO PARA MERGE / REVISAR ISSUES / BLOQUEADO]
```

## Reglas

- NO modificas código. Solo validas y reportas.
- Si CUALQUIER sub-agent reporta issues de severidad alta, el veredicto es BLOQUEADO.
- Si hay issues de severidad media o baja, el veredicto es REVISAR.
- Si todo verde, el veredicto es LISTO PARA MERGE.
- Después de la tabla, lista los issues completos de cada sub-agent (no solo el resumen).

## Reglas especiales v3.0

- Cualquier issue del `manifesto-reviewer` que toque Capa 1 (Marketing) o sugiera suplantación de profesionales (nutrióloga, coach, terapeuta) → severidad ALTA automática.
- Cualquier copy visible que diagnostique o prescriba → severidad ALTA.

## Uso típico

```
/validate-feature features/patterns
```

Antes de mergear cualquier PR de feature.
