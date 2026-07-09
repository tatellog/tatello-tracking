# Task 005 · Ranking Engine · modelo de score

**Epic:** 01 · **Estado:** Parcial · **Depende de:** task003

## Descripción

Formalizar el score que ordena los hallazgos. Hoy `buildFindings` usa
`confidence + (northLink ? 15 : 0)` + prioriza obstáculos. Esta task lo vuelve un
modelo explícito con las variables del PRD.

## Variables (PRD)

confianza · frecuencia · impacto · repetición · cantidad de evidencia.

## Alcance

- Función pura `score(finding, facts): number`.
- Orden del reporte: verdicto → obstáculos (por score) → palancas → cierre.
- Cap configurable (hoy 4).

## Criterios de aceptación

- [ ] Un obstáculo de ruptura con confianza alta no queda sepultado bajo palancas.
- [ ] Tests jest del orden con datos sintéticos.
- [ ] Sin falsos-precisos: N chico → "señal naciente", no sello lleno.

## Notas

Ver el fix histórico: un hallazgo de N chico con 100% no debe robar el titular al
veredicto (regresión ya resuelta en `findings.ts`).
