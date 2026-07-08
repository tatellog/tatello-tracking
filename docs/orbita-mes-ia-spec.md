# Stelar Release 2 · Órbita Mes IA — spec

**Estado:** aprobado por la dueña (jul 2026) · construcción por fases, bajo
flag. **Rama:** `context-engine`. **Objetivo:** Órbita Mes deja de sentirse
como dashboard y se vuelve **descubrimiento guiado**. La pregunta que responde:
**¿qué aprendí sobre mí este mes?** El resultado buscado: "Stelar encontró algo
sobre mí", no "Stelar me mostró estadísticas".

## Reglas duras

- NO ChatGPT libre. NO input de texto. La usuaria interactúa con **botones
  predefinidos**.
- Árboles de conversación DETERMINÍSTICOS: la estructura y los datos salen del
  motor (`month-built.ts`); la IA (Voz del Release 1) solo REDACTA con calidez.
  Nunca inventa conclusiones (línea roja del manifiesto + spec de Mes).
- Usa el Context Engine + AI Cache del Release 1. No llama IA si el insight ya
  existe (context_hash).
- Todo bajo flag `ORBITA_MES_IA_ENABLED` → el Mes actual (4 tiempos) sigue
  siendo el de la beta hasta que este rediseño se valide aparte.

## Estructura nueva (orden)

1. **Hero de constelación** — se REUSA tal cual (`RevealedEmblem` + emblema +
   "% revelado" + signo). "46% revelado · No es una meta. Es lo que tus
   acciones empezaron a construir."
2. **Lo que aprendimos este mes** — el topic picker: Stelar abre ("Encontré N
   cosas que no eran evidentes. ¿Con cuál quieres empezar?") + botones (Mi
   déficit / Mi alimentación / Mi rutina / Sorpréndeme).
3. **Chat guiado** — cada botón abre un árbol de conversación basado en datos.
4. **Tu mes de un vistazo** — el calendario (evidencia), DESPUÉS del chat.
5. **Indicadores mensuales** — los agregados clave.
6. **Patrones descubiertos** — ya no tarjetas estáticas: cada patrón abre
   conversación (CTA "Explorar").
7. **Presencia** — se REUSA (`PresenceFinale`), cierre callado al final.

## Árboles de conversación (7)

déficit · alimentación · rutina · sueño · entrenamiento · agua · sorpréndeme.
Cada árbol: nodos con burbujas de Stelar + una pregunta con botones que ramifica
(sí/no/ver calendario/…). Los números se llenan del motor. Ejemplo déficit:

> Elegiste déficit. → Tuviste déficit 18 días este mes. → Pero eso no fue lo más
> interesante. → Dormiste más de 7 horas en 14 de esos días. → ¿Quieres ver qué
> pasó los días que rompiste el déficit? [Sí · No · Ver calendario]

## Metacognición

La IA hace pensar a la usuaria y GUARDA la respuesta:

> Los viernes fueron distintos al resto del mes. ¿También lo habías notado?
> [Sí · No · Nunca me había dado cuenta]

Se persiste en la tabla nueva `month_reflections` (una respuesta por
(usuaria, mes, pregunta); upsert). Alimenta futuras conversaciones ("la vez
pasada no lo habías notado…").

## Calendario (evidencia)

Después del chat. Estados: déficit · superávit · mantenimiento · sin registro.
Tap en un día → abre ese día en vista Hoy (ya funciona: `onPickDay` en
`orbit.tsx`). REUSA `MonthGlanceCalendar` (ya tiene 4 estados + tap→Día).

## Estados vacíos

Datos insuficientes → "Todavía estoy aprendiendo. Cuando tenga más registros
podré mostrarte patrones más claros." Mínimos sugeridos: 14 días activos · 10
comidas · 5 registros de sueño o actividad.

## UX

Conversación **premium**, no WhatsApp: burbujas suaves, estrellas, glow sutil,
mucho espacio. Voz Stelar (Cormorant italic para el coach). Copy por
voice-and-copy + manifesto-reviewer antes de mostrar a usuarias.

## Arquitectura

- **Reusa tal cual:** todo `month-built.ts` (motor + tests), el emblema
  (`RevealedEmblem`/`features/emblem`), `MonthGlanceCalendar`, `PresenceFinale`,
  `PatternRevealModal`, la tabla `revelations`, el enrutamiento de `orbit.tsx`.
- **Nuevo:** motor de conversación puro (`features/orbit/month-chat.ts` — tipos
  - builder de árboles desde los datos del mes, testeable), tabla
    `month_reflections` (metacognición), UI del chat (burbujas + botones), cableado
    de la Voz de IA (`ai-voice.ts`, `feature:'orbita_mes'`, cacheada).
- **Reemplaza:** el chasis narrativo actual de `MonthSegment.tsx` (los 4 tiempos)
  por el flujo hero → picker → chat → calendario → patrones → presencia.
- **Huérfanos a borrar (legado):** `MonthSky`, `MonthShift`, `WinningCombo`,
  `ObservationCard`, `ObservationChart`, `PatternCard`, `PatternConstellation`
  (nadie los importa).

## Orden de construcción (fases)

1. ✅ Motor de conversación puro (`month-chat.ts`: tipos + árbol de déficit +
   topic picker) + tests. Tabla `month_reflections` (RLS, antes del freeze). Flag.
2. Los otros 6 árboles (alimentación, rutina, sueño, entreno, agua, sorpréndeme)
   - metacognición.
3. UI del chat (burbujas + botones premium) + nuevo chasis de MonthSegment tras
   el flag.
4. Cablear la Voz de IA (redacción cálida cacheada) + calendario/patrones
   tappables al chat.
5. Estados vacíos + copy final (voice-and-copy + manifesto-reviewer) + borrar
   huérfanos.

**Constraint:** freeze de schema el 19 jul → la tabla `month_reflections` entra
en la fase 1 (ahora). El resto es TS/UI, sin schema.
