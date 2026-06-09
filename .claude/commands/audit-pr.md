---
description: Audita el PR actual contra todas las reglas del proyecto · ejecutar antes de cualquier merge a main. Alineado a manifiesto v3.0.
---

Estoy por mergear el PR actual. Audítalo a fondo.

## Proceso

### 1. Scope del cambio

```bash
git diff main...HEAD --stat
```

Resume:

- Cuántos archivos cambian
- Qué carpetas tocan
- Si parece un cambio atómico o si mezcla refactor + feature + fix (mezclar = bandera)
- Si toca foto-con-IA (que tiene fecha límite especial: 3 de julio 2026)

### 2. Validación por carpeta

Para cada carpeta tocada que sea una feature (`features/*`, `app/*`, `components/*`), invoca `/validate-feature <carpeta>`.

Acumula los resultados.

### 3. Higiene de código

Revisa el diff en busca de:

- `console.log` sin remover · BLOQUEA
- `console.error` SIN contexto (sin string descriptivo) · REPORTA
- `TODO` o `FIXME` nuevos sin link a issue · REPORTA
- Código comentado (más de 3 líneas) · BLOQUEA · borrar o explicar por qué se queda
- `any` en TypeScript donde se podría tipar · REPORTA
- `@ts-ignore` o `@ts-expect-error` sin comentario explicando · BLOQUEA
- Imports relativos profundos (más de `../../`) · REPORTA · usar path aliases

### 4. Higiene de commits

```bash
git log main..HEAD --oneline
```

Verifica:

- Mensajes de commit descriptivos (no "wip", "fix", "stuff") · REPORTA
- Commits atómicos · si un solo commit mezcla refactor + feature + tests, REPORTA
- No commits de "merge main" innecesarios · REPORTA

### 5. Archivos sensibles intocados

Verifica que NO se modificaron sin razón explícita:

- `features/docs/product-manifesto.md` (si se tocó, REPORTA y pide justificación)
- `CLAUDE.md` raíz (si se tocó, REPORTA)
- `STELAR_COMPROMISO_LANZAMIENTO.md` (si se tocó, BLOQUEA · ese documento NO se cambia hasta el 27 jul)
- `app.json` (si se tocó, REPORTA bundleIdentifier, name, version)
- `package.json` dependencies (si se agregó algo, REPORTA y pide justificación)
- `eas.json` (si se tocó, REPORTA)

### 7. Tests

```bash
pnpm tsc --noEmit
```

Reporta resultado. Si hay errores nuevos de tipo, BLOQUEA.

```bash
pnpm test 2>&1 | tail -20
```

Reporta resultado. Si hay tests rotos, BLOQUEA.

### 8. Linting

```bash
pnpm lint 2>&1 | tail -20
```

Reporta. Errores nuevos = BLOQUEA. Warnings nuevos = REPORTA.

## Output final

```
Auditoría de PR

## Scope
<resumen de archivos / carpetas / tipo de cambio>

## Validaciones por feature
<tabla de validate-feature por cada carpeta>

## Higiene de código
- console.log: <N encontrados o "limpio">
- TODOs nuevos: <N o "limpio">
- ts-ignore sin comentario: <N o "limpio">
- código comentado: <N o "limpio">

## Higiene de commits
- Commits totales: N
- Mensajes problemáticos: N
- Commits atómicos: sí / no

## Archivos sensibles
<lista de archivos sensibles modificados, si los hay>

## Cumplimiento del compromiso de lanzamiento
- Regla 2 (cero pulido visual): ✓ / VIOLACIÓN
- Regla 3 (cero features nuevas): ✓ / VIOLACIÓN
- Regla 4 (feature freeze): ✓ / N/A (antes del 19 jul)

## Build & tests
- tsc: pasa / N errores
- tests: N pasaron / N fallaron
- lint: pasa / N errores / N warnings

## Veredicto
[MERGE-READY / FIX-REQUIRED / BLOCKED]

## Issues bloqueantes (si los hay)
<lista>

## Issues no bloqueantes (si los hay)
<lista>
```

## Reglas

- BLOQUEADO si: tests rotos, ts errors nuevos, console.log, código comentado sin justificar, archivos sensibles tocados sin razón,
- FIX-REQUIRED si: warnings nuevos, commits no atómicos, TODOs sin link.
- MERGE-READY si: todo limpio.

## Uso típico

```
/audit-pr
```

Inmediatamente antes de `git push` y abrir el PR, o antes de mergear si ya está abierto.
