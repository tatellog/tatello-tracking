# Task 010 · Convergencia `month-built.ts` → `_shared/intelligence`

**Epic:** 01 · **Estado:** Todo · **Depende de:** task004

## Descripción

`features/orbit/month-built.ts` es un motor **solo-cliente divergente** que
alimenta partes de Órbita Mes. Debe **converger** a `_shared/intelligence/` (la
fuente de verdad server+cliente) para que server y cliente produzcan lo mismo.

## Alcance

- Auditar qué detectores/lógica viven solo en `month-built.ts`.
- Moverlos a `_shared/intelligence/` (o al Findings Engine formal, task004).
- NO agregar detectores nuevos a `month-built.ts` (regla vigente).

## Criterios de aceptación

- [ ] Sin lógica de detección exclusiva de `month-built.ts`.
- [ ] Paridad de resultados server vs cliente (hash dorado estable).
- [ ] Sin regresión visible en Órbita Mes.

## Notas

Deuda técnica conocida (ver memoria `orbita-intelligence-source-of-truth`). Es la
condición para que R1 sea "un motor", no dos divergentes.
