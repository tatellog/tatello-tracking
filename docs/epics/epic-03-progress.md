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

- [ ] Tab Resumen con composición corporal + comparaciones — **bloqueado por R4**
      (grasa/músculo/visceral no se capturan; solo peso + fotos hoy). Media Resumen
      ya existe (TuHistoria 30v30, SynthesisCard "Lectura", BeforeAfterPhotos).
- [~] Tab Historia (timeline de hitos) — **motor de hitos listo** (spine); falta
  la UI (tab en vivo, diferida) + encender `MILESTONES_ENABLED`.
- [ ] IA explica progreso sin generar métricas — SynthesisCard ya es el puente
      Progreso↔motor; la IA que explica es fase posterior.

## Tasks (F-R3 spine · convergencia en `revelations`)

**Hecho (spine de hitos determinístico · gated, cero UI en vivo):**

- **T-R3.1** tier `milestone` en `revelations` (CHECK ampliado + índice único
  parcial; rls-auditor limpio, en prod).
- **T-R3.2** `detectMilestones` (\_shared/intelligence/milestones.ts): primer
  déficit, primer mes en déficit (20d acumulados), primer pesaje, primer entreno.
  Puro + tests; títulos revisados (manifiesto + voz).
- **T-R3.3** `recordMilestones` + `useMilestoneSync` (GATED por
  `MILESTONES_ENABLED` OFF, sin montar); `revelationRowSchema` tolerante a
  `milestone` para no romper readers en vivo.

**Diferido:** UI de Historia (tab en vivo) · Resumen-composición (R4) · hitos
`best_streak` (recurre) y `first_wearable` (R4).
