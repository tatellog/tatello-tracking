---
description: Checklist final exhaustivo antes de enviar el build a las 5 usuarias beta · corre antes de cada eas build de preview. Alineado a manifiesto v3.0 y compromiso de lanzamiento del 27 jul 2026.
---

Estoy por enviar el build a las 5 usuarias beta. Verifica todo antes de que toquen la app.

## Proceso · 10 verificaciones en orden

### 1. Manifiesto · sin violaciones en código vivo

Invoca `manifesto-reviewer` contra todo el código que las usuarias verán:

- `app/**`
- `features/**`
- `components/**`

NO contra `docs/`, `scripts/`, `__tests__/`, ni archivos `*.test.*`.

Si hay issues de severidad alta · BLOQUEA. Las usuarias no pueden ver copy que rompa el manifiesto.

### 2. Marketing copy · sin lenguaje prohibido v3.0

Verifica archivos que constituyen "marketing" en la app (Capa 1):

- `app/onboarding/welcome.tsx` (o equivalente · primera pantalla)
- Cualquier archivo en `docs/marketing/` o `docs/app-store/`
- `app.json` description (si la tienes)

Busca términos prohibidos en Capa 1:

- "inteligencia emocional", "salud emocional", "salud mental"
- "atracones", "ansiedad", "trastorno"
- "tu coach", "tu nutrióloga", "tu terapeuta"
- "recomposición", "ganar músculo"
- "hábitos" (genérico)

Si encuentras alguno · BLOQUEA. Esto es crítico legalmente.

### 3. RLS · cada migración aplicada es segura

Invoca `rls-auditor` contra todas las migraciones en `supabase/migrations/`.

Si hay issues de severidad alta · BLOQUEA. Datos de usuarias en juego.

### 4. TypeScript · cero errores

```bash
pnpm tsc --noEmit
```

Cualquier error · BLOQUEA.

### 5. Build config · valores correctos

Verifica `app.json`:

- `name` es exactamente "Stelar" (no "STELAR", no "stelar", no "Stelar Beta")
- `slug` existe y es estable
- `icon` apunta a `assets/icons/stelar-icon-1024.png` (o equivalente al final aprobado)
- `ios.bundleIdentifier` está definido y es coherente
- `android.package` está definido y es coherente
- `android.adaptiveIcon` configurado con foreground + backgroundColor
- `version` está alineada con la última (preguntar si dudas)
- `runtimeVersion` o `runtimeVersion.policy` definido

Verifica `eas.json`:

- Perfil `preview` existe
- Distribución `internal`
- Channel correcto

Reporta cada uno como ✓ o ✗.

### 6. Disclaimers legales presentes

Verifica que existe en la app:

- Pantalla de Terms of Service (o link a versión web)
- Texto en onboarding aceptando que Stelar NO es servicio médico
- Texto en algún lugar visible: "Stelar no sustituye a profesionales (nutrióloga, coach, terapeuta)"

Si falta alguno · REPORTA con severidad alta. v3.0 requiere disclaimers explícitos.

### 7. Analytics · capturando los eventos críticos

Lee `lib/analytics.ts` y verifica que existe la función `track(eventName, metadata)`.

Verifica que `track()` se invoca para estos eventos (busca con grep):

- `app_opened`
- `onboarding_step_completed`
- `onboarding_completed`
- `meal_logged`
- `weight_logged`
- `orbit_viewed`
- `coach_message_shown`
- `tab_changed`

Si alguno NO está siendo invocado en código vivo · REPORTA. Sin esos eventos, no puedes medir validación.

Verifica que la tabla `analytics_events` existe en migraciones.

### 8. Feedback · botón funcional

Verifica:

- `components/BetaFeedbackButton.tsx` (o equivalente) existe
- Está montado en al menos Ajustes
- Escribe a tabla `beta_feedback`
- Tabla `beta_feedback` existe con RLS

### 9. Flag de beta · usuarias marcadas

Verifica con SQL (puedes generar la query, yo la corro):

```sql
SELECT id, email, is_beta FROM profiles WHERE is_beta = true;
```

Debe haber al menos 5 cuentas marcadas. Si hay menos · REPORTA.

### 10. ErrorBoundary · activo

Verifica:

- `components/ErrorBoundary.tsx` existe
- Envuelve el árbol en `app/_layout.tsx`
- Hay ErrorBoundary individual por tab en `app/(tabs)/_layout.tsx`

Sin esto, un crash mata la primera impresión con la usuaria · BLOQUEA.

## Output final

```
Pre-Beta Check

| # | Verificación              | Status              |
|---|---------------------------|---------------------|
| 1 | Manifiesto                | limpio / N issues   |
| 2 | Marketing copy v3.0       | clean / N issues    |
| 3 | RLS                       | clean / N issues    |
| 4 | TypeScript                | pasa / N errores    |
| 5 | Build config              | ✓ / N issues        |
| 6 | Disclaimers legales       | ✓ / falta X         |
| 7 | Analytics                 | ✓ / N eventos faltan|
| 8 | Feedback                  | ✓ / falta X         |
| 9 | Beta users                | N marcadas          |
| 10| ErrorBoundary             | ✓ / falta X         |

VEREDICTO: [LISTO PARA BUILD / FALTA ARREGLAR / NO MANDAR]

Issues bloqueantes (si hay):
<lista>
```

## Reglas

- LISTO PARA BUILD: todo verde.
- FALTA ARREGLAR: hay issues pero ninguno crítico (puedo decidir mandarlo igual con riesgo conocido).
- NO MANDAR: hay issues bloqueantes (RLS rota, manifiesto roto, marketing con lenguaje prohibido, disclaimers ausentes, ErrorBoundary ausente, tests rotos).

## Después de pasar el check

Si todo verde:

```bash
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

Y a invitar a las usuarias para las entrevistas iniciales del 20 de julio.

## Uso típico

```
/pre-beta-check
```

Inmediatamente antes de cada `eas build` de preview que vaya a usuarias reales. Especialmente antes del build final que va a las 5 usuarias el 27 de julio 2026.
