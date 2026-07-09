# Epic 03 · Progress (R3)

**Estado:** Parcial (WIP congelado) · **PRD:** Release 3 · **Depende de:** R1

## Objetivo

Mostrar la **evolución completa** del usuario, no solo peso: toda la
transformación. Que la usuaria vea **evidencia** de progreso.

## Alcance

Dos tabs:

- **Resumen** — peso, fotos, body scan, composición corporal, comparaciones.
- **Historia** — timeline de hitos: primer déficit, primer mes, primer cambio,
  primer wearable, nueva mejor racha.

Datos: peso, IMC, grasa, músculo, agua, visceral, fotos, circunferencias.

## Regla de producto (dueña)

**El peso NO es buen indicador por sí solo** (puede subir por músculo). El marco
es composición/transformación, no la balanza. Coherente con el veredicto de
Órbita anclado en déficit, no en peso.

## IA

No genera métricas. Solo **explica** (ej. "Perdiste grasa sin perder masa
muscular"). Sujeta a la filosofía de `../architecture/ai-philosophy.md`.

## Estado actual

`features/progress/` existe (medidas, fotos, share cards) marcado WIP congelado.
Card "MI TRANSFORMACIÓN" (antes/ahora + delta) aprobada por dueña. Pantalla
"Tu constancia" (calendario de movimiento) + card 30v30 en Progreso.

## Criterios de éxito

- [ ] Tab Resumen con composición corporal + comparaciones
- [ ] Tab Historia (timeline de hitos)
- [ ] IA explica progreso sin generar métricas

## Tasks

Pendiente de desglosar en `../tasks/epic03/`.
