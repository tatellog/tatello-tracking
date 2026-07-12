# Epic 04 · Guided Insight Conversations

**Status:** Draft · **Priority:** P1 · **Depende de:** Epic 03 (los insights) +
la infra de chat de Órbita

---

## Objetivo

Permitir **explorar** un insight de Progress mediante una **conversación
guiada**. **No hay chat libre** — solo elecciones guiadas (chips), como el chat
de Órbita Mes.

## Flujo

```
Insight → [Explorar] → Conversación (IA explica) → Datos → Calendario → Órbita
```

La conversación **explica** el cambio y ofrece puentes (ver los días, ver el
calendario, profundizar en Órbita). No es un dashboard: es la experiencia.

## IA

**GPT únicamente EXPLICA. Nunca detecta. Nunca calcula.** Mismo backstop que
Órbita: prohibido inventar números (solo cita los que el motor le pasó en el
`support`), prohibido inventar relaciones, sin culpa, sin lenguaje clínico.

## Backend · Edge Function

- `supabase/functions/progress-insight-chat/` (NUEVO) **o** extender
  `stelar-insight` con un `feature: 'progress_chat'`. Recomendado: **reutilizar
  `stelar-insight`** (ya tiene cache `ai_insights`, `PROMPT_VERSION`, los
  backstops `unsafeMessage`/`hasUngroundedNumber`/anti-hedge). Añadir el prompt
  y el mapeo de turnos de Progress.
- **Cache** por `hashProgressInsights` (invalida cuando cambia lo que se muestra).
- **Prompt version** espejo en el cliente (patrón `CHAT_PROMPT_VERSION` +
  tripwire test, ver `features/orbit/chat-transcript.ts`).
- **Feature flag** + gate a dev (`aiEnabledForEmail`) hasta validar.
- **Backstop** obligatorio: `hasUngroundedNumber` sobre el `ProgressInsight`.

## Cliente

- `ConversationView` — reusar `features/orbit/components/FindingChatView.tsx`
  (chat guiado + persistencia de transcript que rehidrata sin red + fallback
  determinístico si la IA falla). Generalizar `Finding` → `ProgressInsight`.
- `EvidenceCard` — la evidencia con números (del motor).
- `ReflectionCard` — enganche a Epic 05 (metacognición).
- `GuidedChoices` — los chips (reacciones/preguntas, nunca acción).
- Persistencia del transcript: reusar el patrón `chat-transcript.ts` (cache de
  React Query, keyed por `uid + insightId + hash + promptVersion`).

## Reutiliza

**Toda la infraestructura de Órbita.** Idealmente el `Finding` de Órbita y el
`ProgressInsight` comparten forma suficiente para que `FindingChatView` y
`stelar-insight` sirvan a ambos con mínima ramificación.

## Guardarraíles

- Sin chat libre — solo chips guiados.
- La IA no cruza a "por qué" causal ni a territorio de Órbita; explica el cambio
  y ofrece el **puente** a Órbita para el porqué.
- Números solo del motor. Rechazo → cae al beat determinístico.

## Definition of Done

Abrir un insight lanza la conversación guiada (IA explica, con fallback), el
transcript se rehidrata al reabrir sin red, y el backstop bloquea números
inventados (verificado por curl como en Órbita). Gateado a dev.

## KPIs

CTR "Explorar" · turnos completados · CTR a Órbita/Calendario desde el chat.
