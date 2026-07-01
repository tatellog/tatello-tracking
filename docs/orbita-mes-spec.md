# STELAR · Órbita Mes — fuente de verdad

> Rediseño completo de la pestaña **Órbita › Mes**. Sin IA. Toda la
> información proviene únicamente de datos reales registrados por la
> usuaria. Promesa de producto: **haz visible lo invisible.**
>
> **ACCIONABLE (cambio dueña, jun 2026).** Órbita dejó de ser Observadora pura:
> ahora **recomienda un FOCO/palanca** desde los propios datos ("este mes, tu
> palanca es sostener el déficit las últimas semanas"). Es accionable en modo
> **recomendación, no orden** — dice en QUÉ enfocarte, no te receta dieta/rutina/
> tratamiento (eso sigue siendo nutrióloga/coach/médico). Se mantienen las líneas
> rojas: sin culpa, sin lenguaje clínico, sin vergüenza, sin comparación. Aplica
> a toda Órbita (Día/Semana/Mes). Ver manifiesto § "la frontera". La sección
> "Así se movió tu déficit" (§8) ya sigue este modelo: conclusión + foco.

Órbita Mes NO es un dashboard de estadísticas. Es el lugar donde la
usuaria entiende **en qué se está transformando** gracias a sus acciones
repetidas.

La pregunta que responde la pantalla:

# ¿En qué me estoy transformando?

Cada pieza debe ayudar a entender:

- qué hizo de forma consistente,
- qué la movió de verdad hacia la pérdida de peso,
- qué patrones emergieron,
- qué le conviene repetir el próximo mes.

**Regla de existencia:** si un dato no revela algo invisible, no debe
existir en esta pantalla.

---

## Dos sistemas, separados a propósito

Internamente, Órbita piensa en dos sistemas que NO se confunden:

- **TRANSFORMACIÓN** — lo que crea cambio físico: **déficit calórico,
  proteína, movimiento, sueño, agua**. Aquí vive el progreso real.
- **PRESENCIA** — abrir la app, registrar, volver. Importa (la constancia
  importa), pero **no es progreso físico** y nunca se presenta como tal.

Mezclar ambos infla la sensación de avance y miente. Por eso Presencia
tiene su propia sección, callada y al final.

---

## Principios

1. **Nunca inventar conclusiones.** Toda afirmación se demuestra con datos
   visibles. Si no hay evidencia suficiente, no se muestra. Sin frases
   motivacionales vacías, sin asumir emociones, personalidad ni causalidad.
2. **Construir alrededor de la evidencia.** Cada tarjeta responde "¿qué
   evidencia sostiene esta conclusión?". "Tus mejores días son lunes y
   sábado" ✗ · "Lunes: déficit 4/4 · ~1650 kcal · ~138 g proteína ·
   entrenaste 4 veces" ✓.
3. **Tono de observador calmo.** Nunca culpa, nunca exageración, nunca
   inventar. Se siente científico, emocional y confiable a la vez. No es un
   coach motivando: es un observador que ayuda a entenderte.

---

## Señales independientes (lo que la usuaria hizo)

Las únicas señales que viven en Órbita Mes:

- **Déficit calórico**
- **Proteína**
- **Movimiento**
- **Sueño**
- **Agua**
- **Presencia** (abrió la app / registró)

**Energía queda FUERA.** No es una señal independiente: es, en el fondo,
calorías consumidas menos calorías gastadas. Mostrarla junto a proteína,
sueño, etc. duplica información y le da demasiado peso visual. Energía sigue
viviendo en la experiencia de **Hoy** (el balance energético del día), pero
no en Órbita Mes.

**Ciclo** tampoco es una señal: es contexto derivado del inicio de período
(decisión de proyecto, ver memoria `ciclo-is-context-not-habit`).

### Definición de "día en déficit" (fuente única)

Un día con comida registrada cuyo consumo (`calories`) cae en
`[0.6 × meta, meta]`, con `meta = macro_targets.calories`. El piso del 60%
evita celebrar restricción extrema (manifiesto). Es la **misma** definición
que usa la experiencia de Día (`healthyDeficit` en
`features/orbit/day-state.ts`): una sola fuente de verdad.

---

## Estructura de la pantalla

### 1 · Hero — ¿En qué me estoy transformando?

La pregunta + la **constelación del signo**, revelada según la evidencia
acumulada (`% revelado`). La constelación representa **evidencia acumulada,
no datos acumulados**: crece porque la usuaria repitió comportamientos que
crean cambio, no porque "registró cosas" (ver "Constelación", abajo). NO es
personalidad, NO es astrología: es un sistema de progreso visual.

### 2 · Días en déficit — el KPI primario

El **primer dato** después de la constelación. Es el objetivo de la app,
hecho visible, con una **lectura de un vistazo: ¿buen mes o no?**

```
Estuviste en déficit casi todo el mes.   ← veredicto (serif, voz Observadora)
19 / 24 días en déficit
79%
─────────────────────────
Proteína en meta       21 de 24 días     ← "¿llegué a mi proteína?"
Por encima de tu meta   3 días           ← "¿me pasé?"
```

- **Veredicto** cualitativo según la tasa de déficit (≥70% / ≥50% / ≥30% /
  resto), siempre en positivo y sin culpa ("Estuviste en déficit casi todo
  el mes" / "Más días en déficit que fuera de él" / "Un mes parejo entre
  déficit y exceso" / "Este mes comiste más cerca de tu mantenimiento").
  NUNCA "mes malo". Se oculta con muy pocos días (sería ruido).
- **Denominador = días con comida registrada**, NO días del mes. Así el
  dato es honesto: un día sin registrar no se cuenta como "fracaso"
  (mezclaría ausencia-de-dato con no-déficit y rozaría la culpa), y mantiene
  Presencia separada de Transformación.
- **Pie honesto** que responde las otras dos preguntas del mes: días que
  llegaste a tu meta de proteína, y días por encima de tu meta de calorías
  ("me pasé"). Factual, sin juicio.
- Si no hay meta de calorías o aún no hay días con comida: la sección no se
  muestra (sin "configura tus metas" agresivo).

### 2.5 · Tu mes de un vistazo — el mapa estelar del mes

Responde de inmediato **"¿en qué días estuviste en déficit?"**. Calendario
full-width del mes en curso (cabecera L-M-M-J-V-S-D, hoy marcado con un aro
tenue), sin números dentro. Mucho espacio, sin tablas, sin barras.

```
TU MES DE UN VISTAZO
¿En qué días estuviste en déficit?

L  M  M  J  V  S  D
·  ✦  ✦  ✦  ✦  ✦  ·
✦  ✦  ∘  ·  ·  ·  ·
·  ·  ·  ·  ·  ·  ·

16 de 25 días en déficit · 64%

✦ Déficit   • Superávit   · Sin datos
```

**Reencuadre de arte (auditoría uxui + illustrator):** NO es "verde=bien /
rosa=malo" (gramática de fitness que roza la culpa), sino **"días ENCENDIDOS
vs cielo en reposo"**. La distinción es por **luminancia + forma**, no por hue
alarmante → coherente con la familia warm-gold y manifiesto-safe (ni premia ni
castiga):

- **Déficit** = el único día que **emite luz**: estrella oro (bloom + glow +
  cuerpo `oroLight` + núcleo) con halo. Tokens `oroGlow` / `oroBloom`.
- **Superávit** = **brasa que descansa**: `magentaDeep` @0.6, sin halo (recede;
  el `magentaHot` se reserva para la voz, no para "te pasaste").
- **Muy bajo** = anillo **cálido** (oro), no niebla fría. Chip condicional.
- **Sin datos** = polvo (`bruma` @0.55); el futuro, @0.25.
- **El número** en leche (sereno): el campo de estrellas oro es la textura.
- **El conteo** (`16 de N días en déficit · %`, caption) y el **KPI de la
  sección 2** usan los MISMOS días del mes en curso (`monthSignals`) → coinciden
  exactamente. El KPI dejó de usar la ventana rodante de 31 días.
- Lógica en `monthCalendar` (month-built.ts); UI en
  `components/MonthGlanceCalendar.tsx`. Se oculta sin meta de calorías o sin
  un solo día con comida este mes.

### 3 · Tus promedios del mes

Reemplaza la vieja lista de "días registrados" (Proteína 27 · Comida 27 ·
Agua 25 — info que la usuaria ya sabe). En su lugar, una **grilla de tiles
visuales**: ícono (familia warm-gold del sistema; la distinción la da la
forma, no el color) + valor grande + un **pie** que depende de si la métrica
tiene una META real:

```
[●] CALORÍAS        [●] PROTEÍNA
1840 kcal           112 g
Meta 1700  +140     Meta 135 g  83%      ← meta + delta/% (color de dimensión)

[●] SUEÑO           [●] AGUA
6.9 h               5.7 vasos
7-8 h es lo         Meta 8 vasos  71%
habitual

[●] ENTRENOS
19 días
~4 por semana
```

- **Con meta real** (calorías, proteína, agua): pie = "Meta X" + delta/%
  en el color de la dimensión. Calorías muestra el **delta** (`+140 kcal`
  magenta si te pasaste, `-340 kcal` oro si vas en déficit) — el déficit
  promedio ya no es una tile aparte, vive aquí. Proteína y agua muestran %.
- **Sin meta real** (sueño, entrenos): el manifiesto los trata como
  DIMENSIONES, no metas de wellness, así que NO llevan score. En su lugar,
  una línea de **contexto callado** (niebla, no color): sueño "7-8 h es lo
  habitual"; entrenos "~N por semana" (el promedio real, no una meta).
- Cada tile solo aparece si tiene dato (no inventamos ceros).

### 4 · Haz visible lo invisible — descubrimientos

Las **constancias positivas demostrables** (proteína / movimiento / sueño,
del motor de consistencia). El problema de una tarjeta que solo afirma ("el
movimiento fue una de tus constantes") es que la usuaria pregunta **"¿de
dónde lo saca?"** y **"¿por qué me importa?"**. Por eso cada tarjeta cierra
ese círculo con **dos secciones rotuladas**:

```
✦ MOVIMIENTO
El movimiento fue una de tus constantes.   ← la conclusión (serif)

LA PRUEBA                                   ← ¿de dónde sale?
████████████░░  19 de 32 días
Continuidad más larga: 11 días · reciente: 2

POR QUÉ IMPORTA                             ← ¿por qué me sirve?
Los días que te moviste se acumularon.
Eso es lo que se ve aquí.
```

- **La prueba**: la barra + el conteo + los promedios/continuidades
  disponibles (proteína → promedio g/día; sueño → promedio h/noche;
  movimiento → continuidad más larga / reciente). Hace transparente el
  origen de la conclusión. **Nunca "racha"** (el manifiesto prohíbe el
  lenguaje de streak / presión): se usa "continuidad".
- **Por qué importa**: una línea por dimensión, voz Observadora que describe
  lo que pasó este mes (NO una máxima de coaching ni una afirmación causal
  sin verificar). Proteína "fue la base de lo que tu cuerpo sostuvo este
  mes"; movimiento "los días que te moviste se acumularon"; sueño "las
  noches que descansaste bien, el resto del día lo sintió".

Solo constancias positivas: lo que faltó lo cuentan "Lo que aún no sabemos"
y "Tu evolución".

### 5 · Tus mejores días — con evidencia

El/los día(s) de la semana con mayor tasa de déficit logrado, **siempre con
la prueba de por qué**:

```
Lunes
• Déficit 4 de 4 días
• 1650 kcal en promedio
• 138 g de proteína
• Entrenaste 4 veces
```

Si ningún día realmente destaca, o no hay meta de calorías, no se muestra.
Nunca una afirmación pelada ("tus mejores días son lunes y sábado") que deje
a la usuaria preguntando "¿por qué?".

### 6 · No sabías que... — hallazgos de astrónomo

Reemplaza "Tus patrones". Correlaciones demostrables presentadas como
**descubrimientos**: como si un astrónomo compartiera hallazgos. Cada uno es
una **tarjeta elegante** (mucho aire, sin gráficas inline) con **emoji + la
frase del hallazgo (serif) + "Ver evidencia →"** (abre el modal de barras).
Se muestran **a lo sumo 4** (el astrónomo no abruma).

```
🌙
Dormir más de 7 horas apareció en 16 de tus 18 días en déficit.
Ver evidencia →
```

El pool de hallazgos (solo los que los datos sostienen, con guarda de
honestidad; conteos del mes en curso para cuadrar con el KPI y el
calendario):

- 🌙 **Sueño en déficit**: "Dormir más de 7 horas apareció en X de tus Y
  días en déficit." (co-ocurrencia; Y ≥ 5 y ≥ 60%).
- 🏃 **Entreno × proteína**: "Tus días de entrenamiento también fueron tus
  días de más proteína."
- 📈 **Segunda mitad**: "La segunda mitad del mes tuvo menos días sobre tu
  meta."
- 📅 **Déficit entre semana**: "Lograste tu déficit en el X% de tus días
  entre semana."
- 🍷 **Superávit en finde**: "El X% de tu superávit aparece en fin de
  semana."

Lógica en `monthDiscoveries` (month-built.ts); UI + modal en
`MonthSegment.tsx`. Si ningún hallazgo se sostiene, la sección no aparece.

**Límite de datos**: el ejemplo "registrar desayuno..." NO se implementa:
`daily_signals` solo expone `meal_count` del día, no el tipo de comida. Jamás
se inventan correlaciones que requieran datos que no tenemos (incl. la hora
del día).

### 6.5 · La combinación que más funcionó — la fórmula

La **fórmula** de la usuaria, como una constelación: una estrella-núcleo y las
señales que más coincidieron irradiando hacia ella por hilos de oro finos
(NO una checklist). Mucho aire, premium.

```
        ✦ Dormiste más de 7 horas
       ╱
  ✦───── ✦ Proteína en meta
   núcleo ╲
           ✦ Entrenaste

Esa combinación apareció 12 veces.
9 terminaron en déficit.
```

- **Qué es**: el subconjunto MÁS GRANDE de buenos hábitos (sueño ≥ 7 h,
  proteína en meta, entrenó, agua completa) que coincidió ≥ 3 veces y con
  MAYORÍA de esos días en déficit (la combinación que "funcionó"). Se elige
  por tamaño, luego por días en déficit, luego por apariciones.
- **"Registrar antes de las 8 pm" NO se implementa** (no hay hora del día);
  se usa "Agua completa" como cuarta señal computable.
- Conteos del mes en curso (cuadran con el KPI/calendario). Lógica en
  `winningCombo` (month-built.ts); UI en `components/WinningCombo.tsx`. Se
  oculta si ninguna combinación funcionó.

### 7 · Lo que aún no sabemos

No castiga, no juzga. Muestra qué dimensiones aún no tienen evidencia
suficiente.

```
Todavía no hay suficiente información para entender:
○ Agua   ○ Proteína
Sigue registrando.
```

### 8 · Así cambió tu mes — Semana 1 vs Semana 4

> Subtítulo: "No empezaste igual que terminaste."

Reemplaza el viejo "Tu evolución" (cielo de puntos) y el carrusel de barras.
Comparación **Semana 1 vs Semana 4** con **cápsulas luminosas tipo GitHub
Contributions** (NO barras, NO gráficas tradicionales). Cada fila es una
dimensión; las cápsulas encendidas = "buenos días" de esa semana, así se ve
de un vistazo cómo subió o bajó. Limpio estilo Apple Health.

```
              Semana 1        Semana 4
Déficit       ▪▪▫▫▫▫▫    →    ▪▪▪▪▪▪▫
Proteína      ▪▪▪▫▫▫▫    →    ▪▪▪▪▫▫▫
Sueño         ▪▫▫▫▫▫▫    →    ▪▪▪▪▪▫▫
Entreno       ▪▪▫▫▫▫▫    →    ▪▪▪▫▫▫▫
Agua          ▪▪▪▫▫▫▫    →    ▪▪▪▪▪▪▪

Al final del mes aparecieron más días en déficit y mejor sueño.
```

- **"Buen día"** por categoría: déficit (consumo en rango), proteína en meta,
  sueño ≥ 7 h, agua cumplida, entrenó (datos de `monthChange`, 4 semanas
  terminando hoy; Semana 1 = la más antigua).
- **Resumen automático** (`monthShiftSummary`): nombra las 1-2 dimensiones que
  MÁS subieron de la semana 1 a la 4 ("Al final del mes aparecieron más días
  en déficit y más noches de buen sueño."), o "Tu mes se mantuvo parejo de
  principio a fin." si nada subió de forma marcada. Voz Observadora.
- Lógica en `monthChange` + `monthShiftSummary` (month-built.ts); UI en
  `components/MonthShift.tsx`. Color de cápsula por dimensión (déficit = sage,
  igual que el calendario).

### 9 · Tu presencia — el final del viaje

La **última** sección de Órbita: debe sentirse como el cierre de un viaje, no
como gamificación, sino como **recompensa emocional**. Fusiona la presencia y
la frase final en **una sola tarjeta ceremonial** (sin gráficos): silencio
visual, muchísimo aire (Apple Fitness Awards · Journey · Sky · Genshin).

```
TU PRESENCIA

Volver también es parte de esto.

31 días presente
27 días registrando comida
31 días de continuidad

           ✦                  ← gran estrella tenue + halo rosado
        (halo)

"La constancia apareció más veces que la perfección."
```

- **Verso emocional** "Volver también es parte de esto." (serif, protagonista).
- **Días** discretos (presente · registrando comida · continuidad =
  `longestStreak`), sin trofeos: presencia importa, pero **no es progreso
  físico**.
- **La estrella**: grande, brillante pero muy tenue, con halo rosado (magenta),
  respiración susurro (gateada por foco + reduce-motion).
- **Frase de cierre** (`finalPhrase`), que la evidencia sostiene.
- Lógica `presenceSummary` + `finalPhrase` (month-built.ts); UI en
  `components/PresenceFinale.tsx`.

---

## La constelación = evidencia acumulada

La constelación ya no debe sentirse como que crece porque la usuaria
"registró cosas". Crece porque **repitió comportamientos que crean cambio**:
déficit, proteína, movimiento, sueño, agua. Representa **evidencia
acumulada, no datos acumulados**.

El motor (`fn_transform_points` + espejo en `features/emblem/logic.ts`) se
re-pondera a evidencia/transformación y retira de la suma los términos de
pura presencia (primera comida, energía subjetiva, check-in). El
`% revelado` nunca retrocede en un dispositivo gracias al high-water-mark
monótono por usuario (`transformProgressForPoints`). Ver
`docs/` + migración `*_fn_transform_points_evidence.sql`.

---

## Reglas

No IA · no inventar patrones, correlaciones ni personalidad · no coaching ·
no juzgar · no dashboards tradicionales · no estadísticas porque sí. Todo
responde "¿qué significa este dato?", no "¿cuál es este dato?". Nuestro
trabajo no es decirle que lo hizo bien: es **hacer visible lo invisible**.

La usuaria debe terminar pensando: **"No sabía que eso estaba pasando."**

---

## Mapeo a la implementación

- **Lógica pura (sin IA):** `features/orbit/month-built.ts`.
  - `daysInDeficit(signals, { calorieTarget })` → sección 2 (KPI: días en
    déficit + `overDays` "me pasé"). Denominador = días con comida; usa la
    definición `healthyDeficit` (piso 60%).
  - `monthVerdict(deficit)` → el veredicto de un vistazo de la sección 2.
  - `proteinAdherence(signals, { proteinTarget })` → "proteína en meta" del pie
    de la sección 2.
  - `monthAverages(signals, { calorieTarget })` → sección 3 (promedios).
  - `detectMonthPatterns(signals, { proteinTarget, calorieTarget })` →
    secciones 4 y 6. `kind 'discovery'` (constancias del motor, con `notes`
    de promedio/continuidad y un `why` "por qué importa") alimenta "Haz
    visible lo invisible"; `kind 'pattern'`
    (déficit-entre-semana, superávit-finde, sueño×déficit, entreno×proteína,
    noches ≥7 h) alimenta "Tus patrones".
  - `bestDayEvidence(signals, { calorieTarget })` → sección 5.
  - `habitReveal(signals)` → sección 7 ("Lo que aún no sabemos", días por
    dimensión, sin Energía). El umbral (`MIN_EVIDENCE_DAYS`) vive en el
    componente: por debajo, la dimensión cae en "aún no sabemos".
  - `monthChange(signals, { today, calorieTarget, proteinTarget,
waterGoalGlasses })` → sección 8 (timeline semanal + conclusión).
  - `presenceSummary(signals)` → sección 9 (sistema Presencia).
  - `finalPhrase(signals)` → sección 10.
- **UI:** `features/orbit/components/MonthSegment.tsx` +
  `components/MonthChangeTimeline.tsx` (sección 8). Cada sección se oculta si
  no hay datos que la sostengan.
- **Motor de la constelación:** `fn_transform_points` /
  `fn_transform_points_as_of` (migración `*_fn_transform_points_evidence`) +
  espejo de pesos en `features/emblem/logic.ts`.
