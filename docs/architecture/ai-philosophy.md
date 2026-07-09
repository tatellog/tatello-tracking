# Filosofía de IA · Stelar

> El contrato de cómo (y cómo NO) se usa la IA. Deriva del manifiesto v3.0 y de
> los PRDs. Toda feature con IA lo respeta.

## El principio

> **La IA no piensa. La IA comunica. Quien piensa es Stelar.**

La **detección** es determinística (motores de R1). La **IA (gpt-4o-mini) solo
pone en palabras** lo ya detectado. Razón: el diferenciador de Stelar es
"analizo TUS datos reales". Si la IA detectara, podría **inventar** un número o
un patrón inexistente → fraude. La DB es cuadrada; los hechos vienen de ella.

## Qué SÍ / qué NO hace la IA

| SÍ                                         | NO                                             |
| ------------------------------------------ | ---------------------------------------------- |
| Reformular un hallazgo en voz cálida       | Detectar patrones                              |
| Explicar / conversar sobre un hecho        | Ver registros crudos (`daily_signals`, tablas) |
| Responder con el `contrast` que se le pasa | Inventar números (backstop rechaza dígitos)    |
| Sugerir un foco (recomendación)            | Recetar dieta/rutina, diagnosticar, ordenar    |

## Qué recibe la IA (y nada más)

`story`, `facts`, `confidence`, `hypothesis`, `counterFact` (el contrapunto).
**Nunca la DB.** En el chat de Órbita Mes hoy: `subject`, `lead`, `support`
(números), `northLink`, `hypothesis`, `contrast`.

## El gate por usuario

`aiEnabledForEmail()` (`lib/featureFlags.ts`) → hoy solo `dev@local.test`. Hay
kill-switch global `AI_MASTER_ENABLED`. La beta ve el determinístico + fallback.
Cero GPT, cero costo, cero riesgo para quien no está habilitado.

## Caché (por qué NO es una llamada a GPT cada vez)

1. **Por contenido** (`ai_insights`): fila por (usuario, feature, periodo);
   llave de frescura = `context_hash` / `findingsHash` + `prompt_version`.
   Mismos datos → cacheado, cero GPT.
2. **`findingsHash`**: si los hallazgos visibles no cambian, no regenera.
3. **`PROMPT_VERSION`**: al mejorar el prompt se sube (invalida caché viejo).
4. **Costo:** solo si la usuaria entra a la conversación, solo una vez por
   historia/ruta, luego cache.

## El backstop (la IA no puede salirse del manifiesto)

Toda respuesta de IA pasa por validación determinística antes de llegar al
usuario. Si falla algo → error → el cliente cae al **beat determinístico**
(el hecho tal cual). La IA nunca puede producir algo off-manifiesto visible.

Rechaza: dígitos (número inventado), exclamaciones, emojis, léxico clínico
(`atracón`, `trastorno`, `ansiedad`, `TCA`…), prescriptivo (`debes`, `intenta`,
`come menos`, `duerme más`…), culpa (`tu problema`, `culpa`), relleno
(`interesante`, `cada día cuenta`, `algo especial`), y mensajes que **no anclan**
en un dato concreto del hallazgo.

## Quién controla la conversación

El **cliente** controla el conteo de turnos y el cierre (gpt-4o-mini no cierra
confiable). Cada elección del usuario **siempre** recibe respuesta; sin loop,
sin preguntas repetidas.

## Evolución por release

- **R1–R2:** IA solo explica un hallazgo del mes.
- **R5:** IA redacta experimentos (nunca inventa la hipótesis).
- **R6:** la IA por fin **conecta meses** (memoria histórica), sin dejar de ser
  comunicadora: los patrones cross-mes también los detecta el motor.

## Seguridad

JWT del usuario → cliente RLS-scoped (solo sus datos). Anon key; **nunca**
service role en cliente. `OPENAI_API_KEY` solo como secret del edge. Errores
genéricos, sin filtrar datos.
