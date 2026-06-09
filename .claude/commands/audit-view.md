---
description: Audita una view desde lente de dirección de arte · invoca al illustrator-specialist con el modo correcto y entrega reporte estructurado
---

Vas a auditar visualmente la view: $ARGUMENTS

Si $ARGUMENTS está vacío, pregúntame: "¿Qué view quieres auditar?
Pásame ruta del archivo o screenshot." Si te paso un screenshot,
úsalo como referencia visual. Si te paso un archivo .tsx, léelo y
visualízalo mentalmente.

## Proceso

### Paso 1 · Contexto previo

Lee los siguientes archivos antes de auditar:

- `features/docs/product-manifesto.md` v3.0
- `theme/colors.ts` y `theme/typography.ts`
- El archivo de la view si es .tsx
- Otras views del mismo flujo si las identificas

### Paso 2 · Auditoría en modo 3

Invoca al sub-agent `illustrator-specialist` en modo 3 (auditoría
visual). Pásale el archivo o screenshot.

Espera el reporte estructurado con:

- Lo que está bien
- Issues de dirección de arte en orden de impacto
- Severidad de cada issue (alta/media/baja)
- Veredicto (encaja / necesita ajustes / no encaja)

### Paso 3 · Generación de propuestas (modo 1)

Si el reporte de modo 3 propone reemplazar arte (un nuevo SVG,
ornamento, decorador), invoca al mismo sub-agent en modo 1 para
que genere los SVGs concretos listos para React Native.

### Paso 4 · Cross-check con manifesto

Si la view tiene copy visible, invoca también a `voice-and-copy`
para revisar los strings · puede ser que el arte esté bien pero el
copy no, o viceversa.

### Paso 5 · Resumen final

Consolida en un solo reporte:

```markdown
# Auditoría de view: <nombre>

## Resumen ejecutivo

<2-3 líneas con veredicto general>

## Issues de dirección de arte

<del illustrator-specialist · modo 3>

## SVGs propuestos

<del illustrator-specialist · modo 1, si aplica>

## Issues de copy

<del voice-and-copy, si aplica>

## Plan de fixes en orden de prioridad

1. [Alta] <fix> · estimación: <tiempo>
2. [Media] <fix> · estimación: <tiempo>
3. [Baja] <fix> · estimación: <tiempo>

## Reglas

- NO modifiques código tú · solo auditoría y propuestas
- Los SVGs propuestos se entregan listos para guardar, no se aplican
  automáticamente

## Uso
```

/audit-view app/onboarding/manifesto.tsx
/audit-view (sin argumento · te pregunta cuál view)

```

```
