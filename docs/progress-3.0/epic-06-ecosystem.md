# Epic 06 · Progress Ecosystem

**Status:** Draft · **Priority:** P2 · **Depende de:** Epic 01–05

---

## Objetivo

Conectar Progress con el resto de Stelar. Progress deja de ser una isla: cada
cambio es una puerta a entenderlo (Órbita), verlo en contexto (Calendario) o
corregir el dato (Hoy).

## Navegación

```
Historia → Insight → Conversación → Calendario → Editar registro → Órbita → Hoy
```

Reutilizar el "mailbox" de navegación que ya usan las notificaciones y las
ceremonias para aterrizar en un segmento (`features/orbit/pending-segment.ts`,
`requestOrbitSegment`). Un insight de Progress puede abrir:

- **Calendario** ("Tu constancia" / `movement-calendar`) en la fecha del cambio.
- **Editar registro** (Hoy en modo "ver día", ya existe el patrón).
- **Órbita** para el porqué (el puente Progress→Órbita).

## Wearables

Progress **muestra** lo que la ingesta trae (no vuelve a integrar): Apple Health
(ya existe, `features/wearables/`), y futuros Health Connect / Garmin / Samsung
Health / Oura alimentan el mismo Facts/Measurement engine. Progress no toca la
capa nativa; solo lee las tablas `wearable_*`.

## Reglas de oro

- **Nunca duplicar información** entre Progress y Órbita.
  - **Progress** muestra: _qué_ cambió.
  - **Órbita** muestra: _qué comportamiento acompañó_ ese cambio.
- El puente es explícito (un CTA), no una repetición del contenido.

## Reutiliza

- `pending-segment` / `requestOrbitSegment` para los aterrizajes.
- El patrón de deep-link de notificaciones (`features/notifications/response.ts`,
  `target: 'orbit-mes' | 'hoy' | ...`).
- La ingesta de wearables ya construida.

## Guardarraíles

- Los puentes no presionan ("míralo cuando quieras"), sin FOMO.
- Editar un registro desde Progress no reescribe la historia inmutable (fotos,
  transformación, revelaciones); recalcula solo lo recalculable (ver
  `immutable-vs-recalculable` en las notas del repo).

## Definition of Done

Desde un insight/card de Progress se navega a Calendario, a Editar-registro y a
Órbita, reusando el mailbox existente, sin duplicar contenido entre módulos.

## KPIs

CTR hacia Órbita · CTR hacia Calendario · ediciones iniciadas desde Progress ·
retención mensual.
