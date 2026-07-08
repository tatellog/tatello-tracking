/*
 * Feature flags centralizados — interruptores de compilación para features
 * en construcción. Un flag apagado significa "el código existe pero no se
 * expone a la usuaria"; encenderlo lo activa sin más cambios.
 *
 * Convención: constantes booleanas simples (mismo espíritu que los flags
 * USE_SKIA_* de la constelación). No es config remota; cambiar un flag
 * requiere rebuild del bundle.
 */

/*
 * AI Foundation (docs/ai-foundation-spec.md) — la voz de IA que EXPLICA los
 * insights determinísticos del motor (nunca los detecta). Con el flag en
 * false, Órbita/Progreso siguen usando la voz determinística de siempre; en
 * true, la capa de IA (Context Engine → Prompt Builder → edge → caché) se
 * enchufa a la estructura VozParte existente.
 *
 * En `true` para PRUEBAS (decisión de la dueña, jul 2026). Apagar para que la
 * beta valide el loop core con la voz determinística.
 */
export const AI_VOICE_ENABLED = true

/*
 * Órbita Mes IA (docs/orbita-mes-ia-spec.md · Release 2) — el rediseño de
 * Mes a descubrimiento guiado (chat con botones). Con el flag en false,
 * Órbita Mes sigue siendo el de 4 tiempos que valida la beta; en true, el
 * nuevo flujo hero → picker → chat → calendario → patrones → presencia.
 *
 * En `true` para PRUEBAS (jul 2026): la dueña valida el rediseño en Expo Go.
 * Apagar para que la beta vea el Mes de 4 tiempos actual.
 */
export const ORBITA_MES_IA_ENABLED = true
