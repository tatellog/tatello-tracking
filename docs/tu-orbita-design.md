# Tu Órbita — Spec de diseño

El tab core de STELAR: la capa de significado. Donde el motor de órbitas
sale a la superficie. No es "una pantalla de stats" — es el sistema
personal del usuario hecho imagen.

---

## 1. La metáfora — un solo cielo, tres altitudes

STELAR tiene **un solo cielo**, mirado desde tres altitudes. Bajar de
altitud = alejar la cámara del mismo cielo. Las tres altitudes SON los
tres segmentos del tab:

| Segmento   | Altitud     | Qué es                                                                           |
| ---------- | ----------- | -------------------------------------------------------------------------------- |
| **Día**    | El Sistema  | El diagrama orbital — tus 6 dimensiones orbitándote, en luz o lejos, ahora mismo |
| **Semana** | Las Órbitas | Las trayectorias que esas dimensiones repiten — los patrones                     |
| **Mes**    | El Cielo    | La constelación sellándose al cerrar el ciclo + el ciclo menstrual               |

**La constelación no compite con el sistema orbital.** Es el mismo
cielo a la altitud "Mes": lo que el sistema cristaliza cuando cierra un
ciclo de 28 días. "Tu Cielo" (el sprint de ciclo diferido) es la
acumulación de constelaciones selladas — vive aquí, en el segmento Mes.

El sistema orbital es la metáfora **central y viva**; la constelación es
su forma cristalizada. Una sola familia visual: fondo profundo, glow
magenta, destellos. Reusar el vocabulario de `LunarConstellation`.

---

## 2. El tab

- **Nombre:** "Tu Órbita" (label corto en la barra: `Órbita`).
- **Posición:** centro de la tab bar — la posición de honor. Señala que
  es el core. Orden: Hoy · Comidas · **Órbita** · Progreso · Ajustes.
- **3 segmentos** arriba: `Día · Semana · Mes` (segmented control).
  - Recomendación: el segmento se llama **"Día"**, no "Hoy" — ya existe
    un tab "Hoy" (el ritual de registro). "Hoy" registra; "Día" en
    Órbita _lee_ el día. Mismo word, intención distinta = confusión.

---

## 3. Las 6 dimensiones

| Dimensión    | Señal principal                                               | Sub-señales             |
| ------------ | ------------------------------------------------------------- | ----------------------- |
| **CUERPO**   | `body_measurements`                                           | `workouts`, `rest_days` |
| **ENERGÍA**  | `wellbeing_checkins.energy`                                   | —                       |
| **MENTE**    | `mood_checkins` + `wellbeing.stress` + `wellbeing.motivation` | —                       |
| **ALIMENTO** | `meals`                                                       | `water_intake`          |
| **SUEÑO**    | `sleep_logs`                                                  | —                       |
| **CICLO**    | `cycle_events`                                                | —                       |

`workouts`, `rest_days` y `water_intake` no son dimensiones propias —
son sub-señales que alimentan a su dimensión madre. Mantiene el sistema
en 6 cuerpos legibles en vez de 9 apretados.

Todas se leen de la vista `daily_signals`, que ya unifica estas señales
por `(usuario, día local)`.

---

## 4. "En luz / lejos" — la regla

Cada dimensión es un cuerpo que te orbita. Su estado se codifica así:

- **Brillo** = qué tan "en luz" está. Una dimensión está **en luz**
  cuando tiene señal fresca Y esa señal está en buen ritmo. Está
  **lejos** cuando no hay señal reciente, o la señal muestra desgaste.
  El brillo es continuo (0→1), no binario.
- **Órbita fija por dimensión.** Cada dimensión tiene su radio y ángulo
  propios y constantes — como planetas reales. El layout NO cambia día
  a día: el usuario aprende "sueño vive arriba-derecha". La
  recognoscibilidad es más valiosa que la expresividad aquí.
- **Centro = "tú".** Un núcleo suave, no una dimensión. (El mockup pone
  CUERPO al centro; recomendación: el centro es el usuario, así ninguna
  dimensión queda estructuralmente privilegiada — cuál brilla más
  cambia cada día, y eso ya lo dice el brillo, no hace falta moverla.)
- El header resume: `3 EN LUZ · 3 LEJOS`.

La regla exacta de qué cuenta como "en luz" la afina el motor de
órbitas; el diseño solo necesita el valor 0→1 por dimensión.

---

## 5. Segmento DÍA — El Sistema

El estado del sistema ahora mismo.

1. **El diagrama orbital** (hero). Las 6 dimensiones orbitando el
   núcleo, cada una con su brillo. Animado, suave — respira como la
   constelación. Header: `TU SISTEMA · DÍA` + `N EN LUZ · N LEJOS`.
2. **Dimensiones de hoy** — grid de 6 celdas. Es el índice tocable: el
   diagrama da el gestalt emocional, el grid da la precisión y el
   acceso al detalle de cada dimensión. Tocar una celda → detalle.
3. **Voz de Stelar · hoy** — tarjeta de coach, itálica serif. Una
   lectura corta del día. (La genera el motor — ver §10.)

---

## 6. Segmento SEMANA — Las Órbitas

Las trayectorias que repites.

1. **Voz de Stelar · esta semana** — la lectura semanal del coach.
2. **Patrones detectados** — lista de tarjetas, cada una un patrón que
   el motor encontró cruzando `daily_signals` de los últimos ~7-21
   días. Título humano + sub-dato:
   - "El jueves te apaga." · 3 SEM SEGUIDAS
   - "Tus lunes brillan." · +30G · 4 DE 5
     Cada tarjeta lleva un mini-visual del patrón (barras, curva).
3. (Opcional) Una tira de 7 días por dimensión — el ritmo de la semana.

---

## 7. Segmento MES — El Cielo

El ciclo y la cristalización.

1. **La constelación** del ciclo en curso — la figura de 28 días
   sellándose. La misma `LunarConstellation`, aquí en su hogar
   conceptual.
2. **El ciclo menstrual** — fase actual ("DÍA 22 · LÚTEA"), patrones
   ligados al ciclo ("Antojos en lútea").
3. **Voz de Stelar · este ciclo** — la lectura del arco del mes.
4. **Tu Cielo** (futuro) — la acumulación de ciclos sellados. Este
   segmento es el hogar del sprint de ciclo diferido.

---

## 8. Estados — de vacío a maduro

Nunca mostrar un vacío triste. El sistema siempre se está _formando_.

- **Día 1:** el diagrama orbital ya está, pero los 6 cuerpos tenues,
  "tomando forma". Grid en gris. Voz de Stelar = bienvenida ("Tu
  sistema empieza a girar"). Sin patrones.
- **Semanas 1-3:** las dimensiones se encienden conforme llega señal.
  Los patrones necesitan repetición (~3 ocurrencias) — aparecen de a
  poco. "Las Órbitas" se siente como un cielo revelándose.
- **Maduro:** la riqueza completa del mockup.

La rampa vacío→maduro es la mitad del trabajo de diseño, no un detalle.

---

## 9. Convivencia con la constelación del tab Hoy

El tab Hoy hoy muestra la `LunarConstellation` de 28 días como ritual
diario. No se toca por ahora: es la misma figura zodiacal, mostrada en
formación. Conceptualmente pertenece a la altitud "Mes/Cielo" — con el
tiempo puede converger ahí. La decisión #1 (un cielo, tres altitudes)
hace que no se peleen mientras tanto: están a altitudes distintas.

---

## 10. Orden de construcción

**Construible YA (sin API key de Anthropic):**

- El shell del tab + los 3 segmentos (segmented control).
- El componente del **diagrama orbital** — lee `daily_signals`,
  reusa el stack de `LunarConstellation` (svg + reanimated).
- El grid de dimensiones + estados vacío→maduro.
- El segmento Mes con la constelación y la fase del ciclo (derivada de
  `cycle_events`).

**Necesita el motor de órbitas (API key de Anthropic):**

- "Voz de Stelar" — el texto narrado del coach (los 3 segmentos).
- "Patrones detectados" — las tarjetas de patrón.

→ El tab es ~70% construible ahora; el motor solo rellena los huecos
narrativos. Se puede armar la estructura y el diagrama orbital sin
esperar la key, y conectar la voz/patrones después.
