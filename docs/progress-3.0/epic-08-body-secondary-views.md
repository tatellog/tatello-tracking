# Epic 08 · Body — Vistas secundarias

> Brief dueña (jul 2026): diseñar TODAS las pantallas que se abren desde los
> CTAs del segmento Cuerpo. No modificar la pantalla principal. Navegación
> estilo Apple Health + Oura: cada pantalla responde UNA pregunta y profundiza
> en la transformación. "Entendí mi cuerpo, no leí estadísticas."

## Reglas heredadas (no re-litigar)

- Identidad visual intacta (tipografía, colores, espaciados generales); solo
  profundidad, aire, jerarquía, animaciones.
- Un protagonista y UN CTA primario por pantalla.
- ✦ = exclusivamente IA que abre chat ([[ai-visibility-rule]]). Las secciones
  "Lo que Stelar observó" son MOTOR: sin ✦, sin fingir mente, sin promesas de
  futuro ("esto aparece antes de una bajada" = línea roja).
- Frescura fechada, capítulos de fotos, una-ancla de peso, peso nunca
  dominante fuera de Cuerpo, sin countdown/verde-rojo.
- Lenguaje cotidiano, nunca médico/alarmista (visceral, IMC).

## Mapa: brief → estado real

| #    | Pantalla del brief                                                                                 | Estado hoy                                                                                                                         | Acción                                                                                                                                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Historia de la transformación (timeline emocional: pico, inicio del cambio, primer déficit, hoy)   | No existe. El spine de HITOS ya está (Epic 03: `detectMilestones` → revelations tier='milestone', writer gateado) + `recoveryFact` | **NUEVA** `/body-story` (F2) — consume el motor de hitos, cero detección nueva                                                                                                                                                     |
| 2    | Tendencia del peso (hero + gráfica enorme + eventos + interpretación + CTA comparar)               | La gráfica vive inline en el tab                                                                                                   | **NUEVA** `/weight-trend` (F1) — reusa TrajectoryChart + plateau/cycle notes                                                                                                                                                       |
| 3    | Comparador A vs B pantalla completa                                                                | `CheckinCompare` inline + `/progress-analysis` (análisis guiado A→B) ya existen                                                    | **CONSOLIDAR**: el inline se queda como resumen; `/progress-analysis` ES la pantalla completa (ya tiene A/B params) — se le añade el picker de fechas arriba. NO crear una tercera                                                 |
| 4    | Composición corporal (cards con ícono/valor/variación/sparkline, cada una abre detalle)            | Cards inline (sin IMC por decisión). "Ver estos números ▸" hoy expande inline                                                      | **NUEVA** `/body-composition` (F1). El toggle inline se queda; el link navega aquí. IMC: card SOLO en esta pantalla secundaria (no en el tab) — respeta la decisión "IMC no protagonista" y el brief                               |
| 5-10 | Detalle por métrica ×6 (peso/grasa/músculo/agua/visceral/IMC)                                      | No existen                                                                                                                         | **NUEVA** `/metric/[key]` parametrizada (F1): hero + gráfica + historial + interpretación del motor + CTA comparar. Variantes: grasa→zonas+fotos, músculo→entrenos+proteína, agua→ciclo+peso, visceral/IMC→solo contexto cotidiano |
| 11   | Timeline de fotos (capítulos, estrellas, glow)                                                     | EXISTE (`PhotoEvolution` + visor full-screen)                                                                                      | Pulir si hace falta; no duplicar                                                                                                                                                                                                   |
| 12   | Capítulo (foto grande + peso/grasa/músculo + contexto del día: ciclo, déficit, mood + observación) | Visor de foto existe sin contexto                                                                                                  | **NUEVA** `/photo-chapter?day=` (F2) — lee daily_signals/mood/ciclo del día de la foto (read-only, cero detección nueva)                                                                                                           |
| 13   | Mapa corporal (body map por zonas)                                                                 | `ZonesEvolution` (cards) existe; silueta fue diferida con nota "manifesto-review primero"                                          | **DIFERIDA** — requiere dirección de arte (illustrator no dibuja cuerpos femeninos; propuesta: diagrama ABSTRACTO de zonas, no silueta realista) + manifesto-review. Decisión de dueña aparte                                      |
| 14   | Centro de insights (hallazgos + patrones + hipótesis + abrir en Órbita)                            | `/progress-analysis` (determinístico) + ProgressInsightCard/chat (dev-gated) + motor R1 completo                                   | **EXTENDER** `/progress-analysis` (F3): sección de patrones del motor + CTA "Abrir en Órbita". El chat ✦ llega cuando salga de dev (fusión ya especificada)                                                                        |
| 15   | Registro rápido de peso                                                                            | EXISTE (`/log-measurement`)                                                                                                        | Pulido visual solamente (F3)                                                                                                                                                                                                       |
| 16   | Medición corporal completa                                                                         | EXISTE (`/log-checkin`, editable) + `/log-photos`                                                                                  | Añadir sección de fotos como link al final (F3); sin cambiar el form                                                                                                                                                               |
| 17   | "Lo que Stelar observa" (solo interpretación, máx 5 cards, como capítulo de libro)                 | Las observaciones viven regadas (plateau, síntesis, Lectura)                                                                       | **NUEVA** `/stelar-observes` (F2): junta las observaciones del MOTOR ya existentes, fechadas, sin ✦, sin gráficas. Máx 5                                                                                                           |

## Fases propuestas

- **F1 · El loop de números** (pregunta: "¿cómo voy?"): `/weight-trend`,
  `/body-composition`, `/metric/[key]` ×6. Todo motor existente.
- **F2 · La historia** (pregunta: "¿quién he sido?"): `/body-story` (hitos),
  `/photo-chapter`, `/stelar-observes`.
- **F3 · Consolidación**: picker en `/progress-analysis`, patrones + puente a
  Órbita, pulido de `/log-measurement`, fotos en `/log-checkin`.
- **Diferida**: mapa corporal (#13) — decisión de arte + manifiesto.

## Guardrails de build

- Cero detectores nuevos en cliente (todo insight sale de `_shared/intelligence/`
  o de lógica pura ya testeada); pantallas = lectura + composición.
- Cada pantalla: eyebrow + hero + un CTA primario; estados isPending/isError
  siempre (nunca falso vacío); rutas con push de página completa.
- Copy nuevo → voice-and-copy; visceral/IMC/capítulo → manifesto-reviewer.
- Animaciones: patrón animatedProps probado; loops con cancelAnimation;
  validar en release build.
