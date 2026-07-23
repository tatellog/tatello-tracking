# STELAR — Visión de producto y roadmap

> Este documento es el **HACIA DÓNDE** (posicionamiento, visión, métricas
> norte, orden de construcción). Convive con `PRD-v2.md` (**QUÉ CONSTRUIR**)
> y con el manifiesto (`docs/product-manifesto.md`, **QUÉ NO hacer /
> cómo habla**), que manda sobre todo lo escrito aquí.
>
> Sin fechas a propósito: el launch ya ocurrió. El roadmap se ordena por
> **prioridad y dependencia**, no por calendario. Cada fase se abre cuando la
> anterior demostró su métrica, no cuando llega un día del mes.

---

## Visión

**Stelar existe para ayudar a las personas a entender su cuerpo, no solo a
registrar lo que hacen.**

Registrar es el costo. Entender es la recompensa. Cada interacción debe
reducir ese costo o aumentar esa recompensa.

- La IA nunca sustituye la evidencia.
- El motor nunca sustituye a la persona.
- El objetivo no es decirle qué hacer. Es ayudarle a descubrir qué realmente
  funciona para ella.

### El filtro de roadmap

> **Si una funcionalidad ayuda a la usuaria a entender mejor su cuerpo,
> pertenece a Stelar. Si solo añade más datos o más registro, probablemente
> pertenece a otra app.**

Toda propuesta nueva pasa por este filtro antes de discutir esfuerzo.

---

## Posicionamiento

**No competimos contra MyFitnessPal.** Perseguir su base de datos de
alimentos, su comunidad o su catálogo de restaurantes es correr una carrera
que empezó hace 15 años. Lo defendible de Stelar es lo que ellos no tienen:

- El motor determinístico de evidencia (`_shared/intelligence/`).
- Órbita: la app responde "¿está funcionando?" y "¿por qué?", no solo "¿qué
  comiste?".
- La identidad visual (constelaciones, emblema, cielo) como lenguaje de
  progreso.
- Honestidad estructural: null antes que inventar, confianza declarada,
  deltas reales.
- Contexto de ciclo sobre la báscula.

No vendemos "registrar comida". Vendemos **"entender tu cuerpo"**.

### Matiz crítico · integridad de inputs ≠ competir con MFP

Una cosa es no perseguir los 14 millones de alimentos de MFP. Otra es dejar
que el motor coma datos inventados. Hoy un ingrediente agregado a mano
recibe macros placeholder (8 g / 150 kcal por 100 g, `app/scan-meal.tsx`).
Ese número falso entra al déficit del día, al TDEE adaptativo y a los
patrones. **"Entender tu cuerpo" construido sobre números inventados no es
evidencia.**

Por eso la base mínima de alimentos (Open Food Facts + lista LatAm curada) y
el modo foto-de-etiqueta NO son features de registro: son **infraestructura
de integridad del motor**. Con ese framing son 100% coherentes con la visión.

---

## Métricas norte

No medimos el valor central con comidas registradas, sesiones ni DAU (se
siguen instrumentando, pero son combustible, no destino).

### 1. Time to First Insight (TTFI) · escalonado y honesto

El motor no puede encontrar un patrón con 2 días de datos ni estimar gasto
real con menos de ~28. Forzar "insight en 48 h" sin definir la clase de
insight lleva a fabricar descubrimientos, lo único que el manifiesto prohíbe
de verdad. Por eso el TTFI tiene tiers, cada uno con copy honesto de "esto es
lo que ya se puede ver":

| Tier                            | Qué recibe la usuaria                                                                           | Meta       |
| ------------------------------- | ----------------------------------------------------------------------------------------------- | ---------- |
| Primera reflexión con dato real | Comparativa simple de sus propios registros ("2 días registrados · tu proteína promedio fue X") | < 48 horas |
| Primer patrón                   | Hallazgo determinístico del motor (día-tipo, combo, ritmo)                                      | < 14 días  |
| Primera lectura de gasto real   | TDEE adaptativo con calidad declarada                                                           | < 28 días  |

**Regla de cada tier: microlectura con dato o silencio.** Nada de "esta
comida cambió tu lectura" si el motor no computó qué cambió. La
personalización fabricada ya se rechazó una vez (fallback de "Tu foco") y
queda rechazada para siempre.

### 2. Insights Opened per Week

No cuántos insights genera el motor: cuántos la usuaria **abre y lee**. Ahí
vive el valor percibido. Instrumentable hoy con `analytics_events`.

### Métrica de combustible (diagnóstico, no norte)

Comidas registradas por usuaria por día, **por método**. Si el método
dominante a la semana 2 no es "frecuente 2-taps", el compounding no prendió
y todo lo demás (lecturas, patrones, constelación) se queda sin datos.

---

## Punto de partida · el motor ya existe

Este roadmap NO es "construir capacidades nuevas". La mayoría ya vive en el
repo detrás de flags. Es **encender, ensamblar y hacer visible lo
construido**:

| Capacidad                                                               | Estado real en el repo                                                        |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Pipeline de evidencia (facts → findings → story → ranking → hypothesis) | Construido (R1 / Epic 01) · flip tras `USE_PERSISTED_MONTH_REPORT`            |
| Chat guiado de descubrimiento (Órbita Mes)                              | Construido y funcional · gateado por flag                                     |
| Experimentos personales                                                 | Spine construido (R5 / Epic 05) · tabla + edge + lógica; falta UI             |
| Timeline de hitos / capítulos                                           | `body-story.tsx` ("Tus capítulos") en producción · milestones spine (Epic 03) |
| Ingesta de wearables (workouts / sueño / pasos)                         | R4 Fase 1 construida · composición corporal gated                             |
| TDEE adaptativo                                                         | Cálculo serio con guardas honestas · hoy solo visible en el editor de metas   |

El costo dominante del roadmap es **ensamble + visibilidad**, no invención.

---

## Roadmap por fases y épicas

Orden de prioridad y dependencia. Una fase se abre cuando la anterior movió
su métrica. Las épicas usan numeración **V-xx** (visión) para no chocar con
las Epic 01-06 existentes (`docs/epics/`), que se referencian donde aplica.

| Épica | Nombre                              | Fase | Prioridad | Estado (jul 2026)      |
| ----- | ----------------------------------- | ---- | --------- | ---------------------- |
| V-01  | Microlecturas post-registro         | 1    | Crítica   | Construida (ver nota)  |
| V-02  | La lectura del día en Hoy           | 1    | Crítica   | Construida             |
| V-03  | Registro sin fricción               | 1    | Crítica   | Construida             |
| V-04  | Instrumentación TTFI                | 1    | Alta      | Construida (ver nota)  |
| V-05  | Lectura Semanal · motor             | 2    | Crítica   | Construida · gated dev |
| V-06  | Lectura Semanal · superficie + push | 2    | Crítica   | Parcial · gated dev    |
| V-07  | Lookup honesto de alimentos         | 3    | Crítica   | Pendiente              |
| V-08  | Foto-de-etiqueta nutricional        | 3    | Alta      | Pendiente              |
| V-09  | Modelo de día parcial               | 3    | Alta      | Pendiente              |
| V-10  | Personal Evidence (flip R1)         | 4    | Alta      | Flip ON (solo dev)     |
| V-11  | Timeline de descubrimientos         | 4    | Media     | Pendiente              |
| V-12  | Experimentos · UI                   | 4    | Media     | Pendiente (spine ✓)    |
| V-13  | Hero vivo                           | 4    | Media     | Pendiente              |
| V-14  | Apple Health + Health Connect       | 5    | Alta      | Pendiente (R4 F1 ✓)    |
| V-15  | Smart Recovery                      | 5    | Media     | Pendiente              |
| V-16  | Insights predictivos                | 6    | Baja      | Pendiente              |
| V-17  | Memoria mensual (R6)                | 6    | Baja      | Pendiente              |
| V-18  | Comunidad de descubrimientos        | 6    | Explorat. | Pendiente              |
| V-19  | Monetización                        | 6    | Decisión  | Pendiente              |

---

### Fase 1 · El registro empieza a pagar de inmediato · CONSTRUIDA

Objetivo de fase: subir el retorno de cada registro sin construir sistemas
nuevos. Métrica que abre la Fase 2: comidas/usuaria/día por método + primer
tier de TTFI.

> **Estado (jul 2026, rama `vision-fase-1`, commit `e0e8a44`):** V-01…V-04
> construidas. Restos: microlectura aún no insertada en los modales de
> Órbita Día (solo reveal del scan) y faltan las queries/reporte de TTFI.

#### V-01 · Microlecturas post-registro

**Prioridad:** Crítica · **Depende de:** nada.

**Objetivo.** Que a veces hable el _motor_ después de registrar, no solo el
emblema. Hoy el reveal (estrella + delta de atributo) recompensa; la
microlectura además **informa**.

**Alcance.**

- Catálogo determinístico de microlecturas con cómputo real detrás, p. ej.:
  - tras comida: qué cambió en la lectura del día (déficit/proteína,
    derivado de `day-goal`), o "con esto tu día quedó completo para el motor";
  - tras agua/sueño: la dimensión ya cuenta como evidencia de hoy;
  - tras el 2º-3º día: la primera comparativa simple (tier 1 de TTFI).
- Prioridad de una sola microlectura por registro (sin listas).
- Punto de inserción: el reveal existente de scan/QuickLog y el cierre de
  los modales de registro de Órbita Día.
- Selector puro y testeable en `logic.ts` (qué microlectura aplica y cuándo
  callar).

**Fuera de alcance.** IA generativa; patrones nuevos; tocar el motor
compartido con detectores nuevos (van a `_shared/intelligence/`).

**Ya existe.** El reveal post-registro, `day-goal.ts` (lectura del día),
los agregados de `daily_signals`.

**Criterios de éxito.**

- [ ] Toda microlectura muestra un dato computado; cero frases genéricas.
- [ ] Con datos insuficientes: silencio (solo reveal actual), nunca relleno.
- [ ] % de registros con microlectura real, instrumentado.

**Gates.** `voice-and-copy` (todas las frases) · `manifesto-reviewer`
(sin culpa, sin conteo prohibido) · regla "con dato o silencio".

#### V-02 · La lectura del día en Hoy

**Prioridad:** Crítica · **Depende de:** nada.

**Objetivo.** El hook diario honesto: la respuesta de Órbita Día ("Déficit
485 · aún tienes margen") asomada en Hoy, donde la usuaria ya está. Lectura,
no countdown; estado del día, no presupuesto que castiga.

**Alcance.**

- Elemento compacto en Hoy que reusa los readers de `day-goal.ts` (misma
  fuente de verdad que Órbita Día; cero lógica duplicada).
- Estados: sin registros aún (invitación, no cero punitivo) · con lectura ·
  día cerrado.
- Tap → Órbita Día (el "por qué" completo vive allá).
- Coordinación visual con el multiring planeado de Hoy (3 aros, ver
  `docs/wearables-integration-spec.md`) para no duplicar mensajes.

**Fuera de alcance.** Countdown, barra de "te quedan X kcal" dominante,
metas comparativas, cualquier número de comida dominando el home
(línea del CLAUDE.md).

**Ya existe.** Toda la lectura en `features/orbit/day-goal.ts` y su UI en
Órbita Día.

**Criterios de éxito.**

- [ ] La usuaria puede responder "¿cómo voy hoy?" sin cambiar de tab.
- [ ] Aperturas Hoy → Órbita Día suben (instrumentado).
- [ ] Ningún número de comida domina visualmente el home.

**Gates.** `manifesto-reviewer` (peso/números en home) · `target-user`
(¿motiva o presiona?).

#### V-03 · Registro sin fricción

**Prioridad:** Crítica · **Depende de:** nada.

**Objetivo.** Recortar el camino caro de la semana 1-2. No registrar
cualquier alimento del mundo: registrar TU comida, rápido.

**Alcance.**

- **Cámara directa:** "Con foto" en ✦ abre `/capture-meal` (que ya trae
  galería + texto adentro); muere el action sheet intermedio.
- **"Como ayer" en ✦:** la lógica ya vive en `MealComposer`; se reusa en
  QuickLog, donde la usuaria realmente está.
- **Promover "Con texto"** en el empty state de frecuentes: "escríbelo como
  lo dirías". Es el arma principal contra "me cuesta loguear todo".
- **Guardar directo con confianza alta:** si el scan declara `alta`,
  ofrecer registrar sin formulario, con undo global (ya existe
  `emitMealUndo`). La revisión sigue disponible, deja de ser peaje.
- **Borrador automático** del composer (no perder lo tecleado al salir).

**Fuera de alcance.** Barcode, base de datos de alimentos (Fase 3), voz
(módulo nativo nuevo; se evalúa post-Fase 3).

**Ya existe.** `/capture-meal` completo, "Como ayer" en Comidas, frecuentes
2-taps con foto, undo global, "Con texto".

**Criterios de éxito.**

- [ ] Comida nueva con foto: ≤4 taps hasta el obturador → ≤3.
- [ ] p50 de time-to-log baja, medido por método (`meal_logged`).
- [ ] A la semana 2, el método dominante es frecuente/texto, no scan
      completo.

**Gates.** `target-user` (¿de verdad se siente más ligero?) ·
`reanimated-guardian` si se tocan sheets animados.

#### V-04 · Instrumentación TTFI

**Prioridad:** Alta · **Depende de:** V-01 (emite los insights que se miden).

**Objetivo.** Poder medir las dos métricas norte sin adivinar.

**Alcance.**

- Eventos: `insight_shown` / `insight_opened` con tier y fuente
  (microlectura, patrón, lectura de gasto) en `analytics_events`.
- Queries/reporte de TTFI por tier y de Insights Opened per Week.
- Completar el embudo por método de registro que ya existe
  (`meal_logged`, `quick_add_pressed`).

**Fuera de alcance.** Dashboards visuales; herramientas externas.

**Criterios de éxito.**

- [ ] TTFI por tier calculable con una query por usuaria.
- [ ] Insights Opened per Week calculable semanalmente.

**Gates.** RLS en cualquier tabla/columna nueva (`rls-auditor`).

---

### Fase 2 · Lectura Semanal — EL feature · EN VALIDACIÓN (dev)

Objetivo de fase: el momento recurrente donde el motor TE DEVUELVE algo.
Confirmado dos veces de forma independiente (panel de competencia +
propuesta de visión). Es la compensación estructural de lo que el manifiesto
decide no hacer (countdown, rachas, presión).

> **Estado (jul 2026, commit `1e2d9eb` + fixes):** V-05 construida completa;
> V-06 parcial (pantalla `/weekly-reading` + card en Órbita Semana). Todo
> doble-gateado a dev (`WEEKLY_READING_ENABLED` + `aiEnabledForEmail`).
> Migración `weekly_readings` aplicada (inmutable vía trigger, advisor
> sellado). **Faltan de V-06:** N8 push, entrada desde Hoy, redacción IA
> gated, y abrir a beta tras validar. Detalle en
> `docs/weekly-reading-spec.md`.

#### V-05 · Lectura Semanal · motor

**Prioridad:** Crítica · **Depende de:** V-04 (para medirla); se beneficia
de V-09.

**Objetivo.** Generar, cada semana y para cada usuaria con datos
suficientes, una lectura determinística: gasto real observado + ritmo de
ingesta + trayectoria estimada + UNA palanca.

**Alcance.**

- `weekly-reading.ts` en `_shared/intelligence/` (los detectores nuevos van
  ahí, nunca a `month-built.ts`): ensambla `adaptive-tdee`, trayectoria de
  déficit, `risingSignal`/dirección y la palanca que Semana ya calcula.
- Tabla `weekly_readings` (RLS `auth.uid() = user_id`) escrita por edge
  function programada; una lectura por usuaria-semana, inmutable una vez
  emitida (regla: lo histórico no recalcula).
- Grados de lectura honestos según datos: completa (con gasto real) ·
  parcial (sin TDEE aún, con trayectoria) · silencio con invitación (sin
  datos suficientes; nunca lectura fabricada).
- Redacción IA **opcional y gated** (la IA explica lo ya detectado, patrón
  de `stelar-insight`); la lectura funciona 100% sin IA.

**Fuera de alcance.** Detección con IA; targets prescritos ("come X");
comparación entre usuarias.

**Ya existe.** `adaptive-tdee.ts` con guardas y tests, `deficit.ts`,
palanca de Semana, pipeline R1, patrón de writer (`compute-findings`).

**Criterios de éxito.**

- [ ] 100% de usuarias con ≥ N días reciben lectura (completa o parcial).
- [ ] Cero lecturas con datos inventados; el grado se declara.
- [ ] La palanca es foco recomendado, nunca orden ni receta.

**Gates.** `rls-auditor` (migración) · `manifesto-reviewer` (frontera
foco/receta) · imports `.ts` explícitos en la edge (regla Deno 2).

#### V-06 · Lectura Semanal · superficie + notificación ganada

**Prioridad:** Crítica · **Depende de:** V-05.

**Objetivo.** Que la lectura llegue: una superficie de conversación breve y
el canal de regreso que la anuncia. Sin esto, la lectura es un regalo en un
cajón.

**Alcance.**

- Superficie tipo chat guiado con botones (mismo patrón del chat de Mes,
  reusando su plomería), no dashboard: "esta semana aprendimos algo → … →
  lo seguimos observando".
- Entrada desde Órbita Semana + Hoy cuando hay lectura nueva sin abrir.
- **N8 "tu lectura está lista"** integrada al catálogo N1-N7 y su arbitraje
  de 1/día: notificación ganada (existe contenido real), nunca recordatorio
  vacío. Deep link a la lectura.
- Sello ✦ solo si la redacción IA está activa (regla de visibilidad IA:
  ✦ = abre conversación con IA real).
- `insight_opened` al abrir (alimenta la métrica norte).

**Fuera de alcance.** Chat libre con teclado; más de una notificación por
lectura.

**Ya existe.** Chat guiado de Mes (funcional, gated), sistema de push con
arbitraje, `AiCta`.

**Criterios de éxito.**

- [ ] % de lecturas abiertas ≥ 60% en beta.
- [ ] Insights Opened per Week se convierte en la métrica reportable
      principal.
- [ ] La notificación solo dispara cuando la lectura existe.

**Gates.** `voice-and-copy` (lectura + push) · `manifesto-reviewer` ·
regla ✦-solo-IA-real.

---

### Fase 3 · Integridad de inputs

Objetivo de fase: que el motor coma verdad. Prerequisito duro para que las
fases 4+ no amplifiquen basura.

#### V-07 · Lookup honesto de alimentos

**Prioridad:** Crítica · **Depende de:** nada (paraleliza con Fase 2).

**Objetivo.** Matar el placeholder 8 g/150 kcal: ningún ingrediente manual
vuelve a entrar al motor con macros inventados.

**Alcance.**

- Fuente mínima: Open Food Facts (empacados) + lista curada de ~2-3k
  alimentos frescos/preparados LatAm-MX (tabla propia o bundle versionado).
- Se conecta en DOS lugares: `addIngredient` del scan (reemplaza el
  placeholder) y "Buscar" de Comidas (deja de buscar solo en historial de
  90 días).
- Procedencia visible por ingrediente: etiqueta/base vs estimado por IA vs
  manual — la honestidad del scan extendida a todo el pipeline.
- Si no hay match: pedir los 2 números que Stelar ya maneja (kcal +
  proteína) con ayuda contextual, nunca inventar en silencio.

**Fuera de alcance.** Millones de items, restaurantes, comunidad de
alimentos (decidido: no se construye). Carbos/grasas como columnas nuevas
(decisión de schema separada, post-validación).

**Ya existe.** El pipeline de ingredientes del scan, `MealInputSchema`,
búsqueda de frecuentes.

**Criterios de éxito.**

- [ ] Cero ingredientes guardados con el placeholder (verificable en datos).
- [ ] "Buscar" devuelve resultados útiles el día 1 (no vacío).
- [ ] Cada ingrediente conserva su procedencia.

**Gates.** `rls-auditor` si hay tabla nueva · `backend-specialist` patterns
(Zod en bordes, keys centralizadas).

#### V-08 · Foto-de-etiqueta nutricional

**Prioridad:** Alta · **Depende de:** V-07 (procedencia).

**Objetivo.** El camino Stelar para empacados: una foto del panel
nutricional en vez de barcode. Casi gratis: un modo más del scan existente.

**Alcance.**

- Extensión del prompt/flujo de `scan-meal` (o modo dedicado) que reconoce
  el panel de información nutricional y extrae kcal/proteína por porción,
  con confianza declarada.
- Porciones sobre la base extraída (chips ½/¾/1/1½ ya existentes).
- Barcode queda explícitamente **condicional**: solo si la etiqueta
  demuestra no bastar en uso real.

**Criterios de éxito.**

- [ ] Empacados registrables con números de SU etiqueta, no "típicos".
- [ ] Confianza declarada como en el resto del scan.

**Gates.** los del scan (key solo en edge, Zod, errores cálidos).

#### V-09 · Modelo de día parcial

**Prioridad:** Alta · **Depende de:** nada; desbloquea valor de V-05 para
usuarias irregulares.

**Objetivo.** Que un día con 1 comida registrada no envenene promedios ni
castigue con silencio a la usuaria irregular — la queja real de la beta.

**Alcance.**

- Definición única de "día suficiente / parcial / vacío" en
  `_shared/intelligence/` que consumen TDEE adaptativo, trayectoria y
  promedios (hoy cada uno decide solo).
- El TDEE adaptativo pondera o excluye días parciales sin volverse `null`
  eterno para quien registra 4-5 días/semana.
- Copy de cierre de día sin exigencia implícita de día completo.

**Fuera de alcance.** Inferir comidas no registradas (nunca inventar).

**Criterios de éxito.**

- [ ] Usuaria con 4-5 días/semana registrados desbloquea lectura de gasto
      real (hoy: nunca).
- [ ] Promedios declaran su base ("con tus días completos").

**Gates.** tests en `logic.ts` puro · `manifesto-reviewer` (sin culpa por
hueco).

---

### Fase 4 · Hacer visible el motor

Objetivo de fase: que la usuaria vea el proceso de evidencia, no "IA dice".

#### V-10 · Personal Evidence (flip R1)

**Prioridad:** Alta · **Depende de:** Epic 01 (construido) · validación en
device.

**Objetivo.** Encender el pipeline persistido y mostrar el arco
**observamos → encontramos → estamos investigando → confirmamos** como
estado visible de cada hallazgo.

**Alcance.**

- Flip de `USE_PERSISTED_MONTH_REPORT` tras validación (jul 2026: el flag
  ya está ON, pero solo impacta la superficie IA gateada a dev; el resto de
  V-10 sigue pendiente).
- Estado del arco en la UI de patrones/hallazgos (Órbita + Progreso),
  derivado de findings/hypothesis del pipeline — sin sello ✦ (motor
  determinístico jamás se disfraza de IA).
- Convergencia `month-built.ts` → `_shared/intelligence/` (task 010 del
  Epic 01, deuda declarada).

**Referencias.** `docs/epics/epic-01-intelligence-engine.md`,
`epic-02-orbita-ai.md`.

**Criterios de éxito.**

- [ ] Un hallazgo se puede seguir de "observando" a "confirmado".
- [ ] `month-built.ts` deja de ser motor divergente.

**Gates.** `manifesto-reviewer` · regla ✦-solo-IA.

#### V-11 · Timeline de descubrimientos

**Prioridad:** Media · **Depende de:** V-10.

**Objetivo.** Timeline de aprendizaje, no de peso: "dormir empezó a
mejorar" · "volviste a entrenar" · "confirmamos tu primer patrón". Genera
apego porque acumula historia propia.

**Alcance.**

- Vista unificada sobre `revelations` (tiers pattern/milestone/regreso) +
  capítulos de `body-story` — converge, no duplica.
- Inmutable: lo descubierto no se recalcula ni retrocede (regla existente).
- Entrada desde Progreso · Historia.

**Referencias.** `docs/epics/epic-03-progress.md`,
`docs/orbita-pattern-memory-spec.md`.

**Criterios de éxito.**

- [ ] Cada patrón confirmado deja huella permanente visible.
- [ ] Cero regresiones de historia al backfillear.

#### V-12 · Experimentos · UI

**Prioridad:** Media · **Depende de:** V-10 (el arco da contexto) · spine
R5 (construido).

**Objetivo.** Del "estamos investigando" a la acción voluntaria: "durante 7
días, desayuna antes de las 9" → el motor responde "cambió / no cambió".

**Alcance.**

- UI sobre el spine existente (tabla `experiments` + edge
  `experiment-lifecycle` + lógica pura): proponer desde una hipótesis,
  aceptar, ver estado, recibir veredicto del motor.
- Reglas duras ya decididas: 1 activo máximo, ≤2 semanas, reversible,
  nunca clínico/dieta/rutina. El resultado lo decide el motor; la IA solo
  redacta (gated).
- "No cambió nada" es un resultado válido y se comunica sin fracaso.

**Referencias.** `docs/epics/epic-05-experiments.md`.

**Criterios de éxito.**

- [ ] Un experimento completo (propuesta → veredicto) sin tocar al equipo.
- [ ] Cero experimentos que prescriban dieta/ejercicio/clínica.

**Gates.** `manifesto-reviewer` (el más estricto del roadmap) ·
`voice-and-copy`.

#### V-13 · Hero vivo

**Prioridad:** Media · **Depende de:** V-01 (comparten disparadores).

**Objetivo.** El emblema reacciona a información nueva (una estrella vibra,
la aurora cambia, una línea aparece). Recompensa sensorial de "el sistema te
recibió", no desbloqueo ni progreso falso.

**Alcance.**

- Reacciones sutiles por tipo de registro, sobre la arquitectura
  Skia/atmósfera existente (`USE_SKIA_ATMOSPHERE`).
- Presupuesto de performance: nada de esto puede costar jank en Hoy.

**Criterios de éxito.**

- [ ] Registrar produce reacción visible < 1 s, sin caída de FPS.
- [ ] Validado en release build (regla worklets/Android).

**Gates.** `reanimated-guardian` obligatorio · validación en device
release · sin animar `colors` de gradientes Skia (crash conocido).

---

### Fase 5 · Reducir el registro manual

Objetivo de fase: no hacer el registro más complejo — hacerlo innecesario
donde el teléfono ya sabe.

> **Mantra: no hagas escribir a la usuaria algo que el teléfono ya sabe.**

#### V-14 · Apple Health + Health Connect

**Prioridad:** Alta · **Depende de:** decisiones ya tomadas en
`docs/wearables-integration-spec.md`.

**Objetivo.** Sueño, entrenos y pasos entran solos como pipes al motor; la
usuaria deja de transcribir su reloj.

**Alcance.**

- Apple Health (device-side) + Health Connect (Android). Nada más por
  ahora; Garmin/Fitbit/Oura solo si la demanda existe (eran R4 extendido).
- Ingesta a las tablas existentes (R4 Fase 1 ya construida:
  workouts/sueño/pasos); composición corporal detrás de su flag.
- Reglas inamovibles: pasos ingest-only · **nunca eat-back** · nunca TDEE
  del wearable (el gasto real lo estima NUESTRO motor).
- Requiere dev build (Expo Go no trae los módulos nativos — regla
  conocida: lazy import + fallback).

**Referencias.** `docs/epics/epic-04-wearables.md`,
`docs/wearables-integration-spec.md`.

**Criterios de éxito.**

- [ ] Sueño/entreno del reloj aparecen en Órbita sin registro manual.
- [ ] El motor no distingue la fuente (pipe es pipe).

**Gates.** `rls-auditor` · permisos de salud con copy claro
(`voice-and-copy`).

#### V-15 · Smart Recovery

**Prioridad:** Media · **Depende de:** V-14.

**Objetivo.** Si el reloj ya dijo "entrenaste" o "dormiste", Stelar no
pregunta: QuickLog y Hoy dejan de ofrecer lo que ya llegó solo.

**Alcance.**

- Dedupe manual-vs-wearable por día y dimensión (prioridad: dato del
  dispositivo; el manual complementa, no duplica).
- "Lo que aún no aparece" de Órbita Día excluye lo ya ingerido.
- Microlectura (V-01) reconoce el dato recibido ("tu entreno de hoy ya está
  en tu evidencia").

**Criterios de éxito.**

- [ ] Cero preguntas por datos que ya llegaron del dispositivo.
- [ ] Cero dobles conteos en `daily_signals`.

---

### Fase 6 · Anticipación y largo plazo

Objetivo de fase: el producto empieza a conocerte, siempre desde evidencia.
Épicas exploratorias: se especifican al llegar, con lo aprendido de las
fases 1-5.

#### V-16 · Insights predictivos

**Prioridad:** Baja. Anticipación basada en historia propia: "los viernes
suelen romper tu rutina" ✓ · "hoy comerás mucho" ✗ (humo). Se monta sobre
patrones confirmados (V-10) con ≥ 2-3 meses de datos; aparece como
observación de calendario, nunca como profecía. Gate duro:
`manifesto-reviewer`.

#### V-17 · Memoria mensual (R6)

**Prioridad:** Baja. La IA conecta meses ("esto ya te pasó en mayo; aquello
que funcionó fue…") sobre los `monthly_reports` persistidos. Éxito =
entender mejor, no chatear más. **Referencia:**
`docs/epics/epic-06-stelar-intelligence.md`.

#### V-18 · Comunidad de descubrimientos (exploratorio)

**Prioridad:** Exploratoria. Compartir "mi cuerpo descubrió esto", nunca
"perdí 4 kg". Sin feed, sin likes, sin retos. Punto de partida: las share
cards existentes. Solo se especifica si las usuarias lo piden.

#### V-19 · Monetización

**Prioridad:** Decisión de negocio, no de código. "Entender tu cuerpo" es
la capa premium natural (p. ej. Lectura Semanal resumida gratis / completa
de pago · wearables premium · cuota de IA en free). Se decide con datos de
las fases 2-4 (qué insights se abren de verdad), no antes. Incluye
RevenueCat/billing cuando la decisión exista.

---

## Lo que este roadmap NO construye (decidido)

1. **Grafo causal.** Demasiado pronto; el motor de hipótesis basta.
2. **Probabilidades visibles ("83%").** Confianza sin porcentajes; ya es
   regla del chat guiado.
3. **Capa enorme de IA nueva.** Ya hay suficiente IA; primero se hace
   visible el motor determinístico. La IA explica, nunca detecta ni inventa.
4. **Base de datos de alimentos estilo MFP** (millones de items, comunidad,
   restaurantes). Solo el mínimo de integridad de la Fase 3.
5. **Countdown / presupuesto punitivo en el home.** El hook diario de Stelar
   es la lectura honesta del día, no una cuenta regresiva.

---

## Trade-offs del manifiesto · asumidos como decisiones de negocio

Estas decisiones tienen precio en retención y se sostienen con los ojos
abiertos. Cada una tiene su compensación estructural en este roadmap:

| Decisión de marca                   | Precio                                                    | Compensación                                                             |
| ----------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| Peso fuera del home                 | Menos pesajes → input más ruidoso para el TDEE adaptativo | Tiers de TTFI honestos + calidad declarada ("sólida/temprana")           |
| Sin countdown ni presupuesto diario | Se cede el hook diario más probado de la categoría        | Lectura del día asomada en Hoy (Fase 1) + Lectura Semanal (Fase 2)       |
| Notificaciones sin presión          | Canal de regreso de bajo volumen                          | Notificación **ganada** con contenido real (lectura lista, patrón nuevo) |

Si alguna compensación no se construye, el trade-off correspondiente queda
sin red — en particular: **sin Lectura Semanal, el registro es un depósito
sin intereses.**
