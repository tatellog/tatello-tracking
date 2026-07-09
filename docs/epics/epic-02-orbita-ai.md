# Epic 02 · Órbita AI (R2)

**Estado:** En curso · **PRD:** Release 2 · **Depende de:** R1

## Objetivo

Mostrar los hallazgos más importantes del mes como **descubrimiento guiado**, no
dashboard. Contar una historia; priorizar; despertar curiosidad. GPT solo explica.

## Alcance

- Home: "Analicé tus últimos 30 días. Encontré un hallazgo principal. [Descubrir]".
- Flujo: Loading → Hero/Reporte → Chat guiado → Hallazgos secundarios → Mes completo.
- Chat guiado (no libre): GPT recibe `story/facts/confidence/hypothesis/counterFact`,
  nunca la DB. Todo cacheado.

## Estado actual (jul 2026) — mayormente construido en rama

- **Teaser** "He detectado algo · sobre tus días con agua" (`MonthDiscoveryTeaser`).
- **Reporte de evidencia determinístico** (`MonthReport`): veredicto (déficit
  sostenido) → "dónde se te va" (obstáculos) → puerta abierta.
- **Chat fact-led** (`FindingChatView` + edge `orbita_mes_chat`): abre con el
  hecho, responde el contrapunto, mata el relleno, cache por `findingsHash+path`,
  backstop determinístico, cierra al reporte.
- Gate por usuario (`aiEnabledForEmail`), fallback determinístico para la beta.

## Delta vs el PRD (decisión de dueña, jul 2026)

El PRD pedía **un solo hero + secundarios ocultos**. La dueña pivoteó a
**hechos-primero**: el reporte muestra 2-3 hechos a la vista (veredicto +
obstáculos), porque quiere "entender qué pasa", no adivinar tocando. El chat es
el paso opcional de profundizar. Ver `prd-chat-guiado-hallazgos` en memoria.

## Criterios de éxito

- [x] Reporte determinístico con veredicto + obstáculos + cierre
- [x] Chat guiado que explica, no detecta; cacheado; con backstop
- [x] Responde "¿y los días que no?" con el contrapunto real
- [ ] Validado con usuaria (en curso; iteración de tono del chat)
- [ ] Engines de R1 como fuente (hoy `findings.ts` client-side)

## Tasks

Pendiente de desglosar en `../tasks/epic02/` (inline por ahora):

1. Consolidar el reporte sobre los engines de R1 cuando existan.
2. Afinar el prompt del chat con feedback de usuaria (tono, longitud).
3. Métrica de uso (entró / descubrió / profundizó) para medir el loop.
4. Estados vacíos honestos (pocos datos → "aún no alcanza para una lectura").
