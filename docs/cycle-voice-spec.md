# La Voz del ciclo — Spec

Cómo Stelar lee el ciclo menstrual y acompaña la pérdida de peso a
través de él. Vive en el **cycle sprint (diferido)** y en el segmento
**Mes** de Tu Órbita. No es una feature nueva suelta: es activar una
capa ya contemplada (la derivación de fase desde `cycle_events`).

> Estado: spec · sin construir. Pendiente del cycle sprint.

---

## 1. La idea en una frase

**Stelar lee tu ciclo y te acompaña a sostener tu progreso a través de
él — observando _tu_ patrón, nunca prediciéndote de un libro, y nunca
con culpa.**

El caso que la disparó (palabras de la fundadora): _"que Stelar me diga,
estás a una semana de tu ciclo, puedes tener mayores antojos o el ánimo
más bajo; y que cuando esté en mi ciclo me contextualice la balanza."_
La idea es correcta. Lo que esta spec fija es **el framing** que la
mantiene del lado Stelar y no del lado "app de salud genérica".

---

## 2. El principio rector (manifiesto v3.0)

Tres reglas no negociables, derivadas del manifiesto:

1. **Patrón en _tus_ datos, no predicción genérica.** El diferenciador
   v3.0 es _"el análisis de los patrones en tus propios datos"_. Decirle
   "vas a tener antojos" (modelo de libro aplicado a ella) es lo
   contrario: puede errarle, roza lo predictivo/médico, y si falla
   pierde confianza en el dato más íntimo. Stelar **observa lo que ya
   pasó en sus registros**; no le dice cómo se sentirá.

2. **Anti-culpa.** El manifiesto entero es que _un mal número no te
   descarrile_. El ángulo de peso del ciclo NO es "aprieta el déficit
   ahora"; es **contextualizar la balanza** para que la subida
   premenstrual no dispare el abandono ("subí 1 kg, ya fracasé").

3. **El ciclo es una variable que correlaciona con la constancia**, no
   un fin en sí, no horóscopo, no diagnóstico. Stelar nunca patologiza
   ni diagnostica (Principio de la línea roja clínica).

---

## 3. Las dos capas

La feature tiene dos capas que se encienden en momentos distintos:

| Capa               | Cuándo                        | De dónde sale                                                                         | Qué puede decir                                                                                                                                           |
| ------------------ | ----------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A · Calendario** | Desde el día 1 (si dio fecha) | Fecha de última menstruación + duración (`cycle_length`, default 28) → fase calculada | El _timing_ y el contexto fisiológico general, en tono **suave y opcional** ("estás entrando en la segunda mitad de tu ciclo") + el anti-culpa de balanza |
| **B · Patrón**     | Tras 1–2 ciclos de registro   | Cruce de _su_ consistencia / antojos / ánimo registrados con la fase                  | Su patrón real, observacional ("las últimas dos veces, esta semana coincidió con más antojos en ti · ¿lo notas?")                                         |

La Capa B es la promesa que ya hicimos en el reveal: _"vas a ver patrones
confirmados a partir del segundo ciclo"_. La Capa A es el puente honesto
hasta que esa data exista — pero **debe sonar a contexto, no a
predicción**.

---

## 4. La Voz, fase por fase

Tono: cálido, Cormorant italic (voz del coach), observacional, opcional.
Nunca determinista ("vas a"), nunca clínico, nunca con culpa. Nota: en
copy visible decimos **"la semana antes de tu ciclo"**, no "fase lútea"
(tecnicismo). La fase se nombra por experiencia, no por su nombre médico.

### Premenstrual (≈ semana antes)

- **Capa A (suave, contextual):**

  > "Estás entrando en la semana antes de tu ciclo. A algunas se les
  > mueve el ánimo o el antojo por acá — si lo sentís, es tu cuerpo, no
  > vos fallando."
  > (Nombra la posibilidad sin afirmarla; valida sin patologizar.)

- **Capa B (su patrón):**
  > "Las últimas dos veces, esta semana coincidió con noches de más
  > antojo en ti. ¿Lo notas?"

### Durante el ciclo (menstrual) — el ángulo balanza (anti-culpa)

- **Capa A:**
  > "Estos días tu cuerpo retiene más agua. Si la balanza sube, no es
  > grasa — es tu ciclo. No dejes que el número te diga cómo vas."
  > (Este es el mensaje **más on-brand de todos**: corta el abandono por
  > un número malo, que es el patrón #1 que Stelar quiere romper.)

### Folicular / post-ciclo

- **Capa A:** opcional, mínima. Puede quedar en silencio — no todo
  momento del ciclo necesita voz. Si acaso, un tono de "vuelve la
  energía" SOLO como observación, sin convertirlo en "aprovecha para
  apretar".

### Ovulación

- Generalmente silencio. No hay un mensaje anti-culpa ni de
  acompañamiento necesario. Evitar llenar el calendario de voz por
  llenarlo.

**Regla de densidad:** la Voz del ciclo es un susurro ocasional, no un
horóscopo diario. Mejor 2–3 momentos significativos por ciclo que un
mensaje por fase.

---

## 5. El ángulo peso / balanza (detalle)

La reformulación clave del pedido original. "Recomendaciones para bajar
de peso durante el ciclo" se reformula de prescripción → contexto:

- **NO:** "Es tu mejor semana para el déficit, aprovéchala." (presión +
  prescripción + culpa si no rinde.)
- **SÍ:** "Tu peso puede subir 1–2 kg premenstrual por agua. Es normal y
  se va. No te peses en guerra con tu ciclo." (contextualiza, desactiva
  el abandono.)

Stelar puede, como mucho, **suavizar la lectura del dato** esos días (en
Progreso / la balanza): marcar que el rango es esperable por el ciclo,
no graficar la subida como retroceso. Eso es ayuda real sin prescribir
dieta (el manifiesto prohíbe dietas y presión).

---

## 6. Gating · a quién y cuándo

- **Aplica** a `cycle_situation = menstruates` (y, con matices,
  `irregular`) **que además dieron la fecha** de última menstruación
  (es opcional en onboarding).
- **No aplica / muy atenuado** para `contraception` (el sangrado puede no
  reflejar fase real), `irregular` sin fecha confiable, y nunca para
  "no tengo ciclo" / sin fecha.
- **Opcional y calmo.** Vive como Voz dentro de la app (segmento Mes /
  Hoy). Si alguna vez se vuelve notificación, debe ser **opt-in** y
  capada — nunca un push que presione ("pésate", "aprovecha").
- **Sin fecha → sin Capa A.** Sin predicción inventada. (Coherente con
  la decisión de onboarding: la fecha es opcional, "puedes decírmelo más
  adelante" — esta feature es justo el _por qué_ vale darla.)

---

## 7. Datos · qué tenemos / qué falta

**Ya existe:**

- `cycle_situation` (paso de ciclo del onboarding).
- Última menstruación → `cycle_events` (`event_type = 'period_start'`),
  opcional.
- `cycle_length_days` (default 28).

**Falta (cycle sprint):**

- **Derivación de fase** desde `cycle_events` (la spec del sprint ya lo
  contempla: _"derive phase / length / predictions from this table"_).
  Habilita la Capa A.
- **Señales diarias cruzables** para la Capa B: qué registra ella que se
  pueda correlacionar con la fase — antojo, ánimo, consistencia del
  déficit, registro nocturno. Revisar `daily_signals` / lo que el motor
  de órbitas ya captura. La Capa B es tan buena como las señales que
  tenga para cruzar.

---

## 8. Líneas rojas (qué NUNCA)

- **No diagnóstico:** nada de "tienes ansiedad/depresión premenstrual",
  "esto es SPM". Nombrar experiencia, no patología.
- **No predicción determinista:** "vas a estar triste" → "a algunas se
  les mueve el ánimo · ¿lo sentís?".
- **No prescripción con culpa:** nada de "aprovecha para apretar el
  déficit" ni "deberías".
- **No tecnicismo clínico en copy visible:** "fase lútea" → "la semana
  antes de tu ciclo".
- **No horóscopo:** el ciclo es fisiología real y propia, distinto del
  zodiaco (que es visualización de progreso). No mezclar "tu signo dice"
  con "tu ciclo".
- **No llenar de voz:** silencio es una opción válida en las fases sin
  mensaje significativo.

---

## 9. Dónde vive / dependencias

- **Sprint:** cycle sprint (diferido).
- **Superficie:** segmento **Mes** de Tu Órbita (donde vive el ciclo) +
  posible susurro en Hoy / contextualización en Progreso (la balanza).
- **Depende de:** derivación de fase desde `cycle_events`; inventario de
  señales diarias para la Capa B; la Voz de Stelar como canal.

---

## 10. Fasing sugerido

- **v1 (lo más barato y on-brand):** Capa A + SOLO el anti-culpa de
  balanza + un toque de timing premenstrual suave. Gated a quien
  menstrúa y dio fecha. Es el 80% del valor emocional con el menor
  riesgo de framing.
- **v2:** Capa B (patrón en sus datos) cuando haya señales acumuladas
  cruzables — la promesa del "segundo ciclo".

---

## Antes de construir

Pasar el copy final por **behavioral-specialist** (riesgo de
predicción/culpa), **manifesto-reviewer** (línea roja clínica + foco de
peso) y **voice-and-copy** (voz, español neutro, "fase lútea" →
lenguaje de experiencia). El framing de esta spec es la guía; los
strings exactos los firma esa cadena.
