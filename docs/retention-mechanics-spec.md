# Mecánicas de retención manifiesto-safe — Spec

Cómo Stelar captura el **efecto conductual** de la gamificación y el FOMO
—las dos palancas de retención más potentes del SaaS— **sin sus daños**
(rachas que castigan, presión, miedo, comparación, culpa). Redirige las
mismas palancas (loss-aversion, logro, anticipación) hacia **identidad y
progreso sin culpa**.

> Estado: spec · estrategia. Varias piezas ya existen en código (se marcan).
> Motor de retención de fondo: **identidad** (ver la estrategia de retención).

---

## 1. La tesis

Gamificación y FOMO retienen por **loss-aversion + logro + urgencia**. Pero
su forma cruda **quema a la usuaria core** (abandonó apps por la racha-culpa,
la ansiedad del streak). Stelar usa las MISMAS palancas, redirigidas:

| Palanca cruda                                  | Daño                                | Redirección Stelar                                 |
| ---------------------------------------------- | ----------------------------------- | -------------------------------------------------- |
| Racha que se rompe (loss-aversion por castigo) | el todo-o-nada abandona al romperla | **"Acumulás, no perdés"** — no hay nada que perder |
| Puntos / badges / niveles (logro extrínseco)   | se agota, motivación hueca          | **Identidad** — "sostuve un ciclo", no un puntaje  |
| FOMO / urgencia (miedo a perderse algo)        | ansiedad, dark pattern              | **Anticipación honesta** — ganas, no miedo         |

La regla rectora: **el efecto sin el filo.** Cada mecánica toma el motor
psicológico comprobado y le quita el componente que daña a una mujer
sensible al juicio.

---

## 2. Mecánica A · La constelación como gamificación suave

**"Encendés estrellas, no las perdés."**

- Cada registro/ritual enciende una estrella; tu signo se completa estrella
  a estrella a lo largo del ciclo de 28 días. (Existe: la constelación del
  Tab Hoy / Órbita + el reveal.)
- **REGLA CRÍTICA:** las estrellas encendidas **NO se apagan ni retroceden
  en un día malo.** Un mal día = una estrella sin encender ESE día, nunca
  borra las anteriores.
- **Por qué funciona (y por qué es superior al streak):** el streak clásico
  (Duolingo, Snapchat) retiene por loss-aversion **castigando** — se rompe y
  vuelve a cero. Esa asimetría invertida (podés ganar, no podés perder)
  entrega el progreso/colección/logro de la gamificación **sin el castigo
  que dispara el abandono del perfil todo-o-nada**. Redirige la loss-aversion:
  no hay nada que perder, solo que ganar. Duolingo te quita la racha; **Stelar
  nunca te quita el cielo.**
- Es **progreso visible no-numérico** — reemplaza la balanza fría. El
  llenado/brillo es la recompensa inmediata mientras los patrones (el
  diferenciador) todavía tardan semanas.

**Falta construir:** hacer explícita y visible la regla "no retrocede" (las
estrellas ganadas persisten día a día y entre ausencias).

---

## 3. Mecánica B · El cierre de ciclo de 28 días (hito de identidad, no puntaje)

- Al completar el ciclo, la constelación se **sella/culmina** con un
  reconocimiento: _"Tu Tauro está completo. Sostuviste 28 días."_
- Es el "level up" / el badge de la gamificación — pero enmarcado como
  **IDENTIDAD** ("sos alguien que sostuvo"), nunca como score, trofeo,
  puntos ni nivel.
- **Conductual:** cierre de loop largo + reformulación de identidad
  ("estoy intentando" → "lo estoy haciendo"). Es el primer gran pago
  no-numérico, y prepara emocionalmente el segundo ciclo (donde pagan los
  patrones).
- **Meta-colección sin competencia:** "Tu Cielo" (la vista multi-ciclo, en
  el cycle sprint diferido) es la acumulación de constelaciones selladas —
  la gamificación de **colección personal**, jamás leaderboard ni comparación.

**Falta construir:** el momento de cierre a los 28 días.

---

## 4. Mecánica C · Anticipación honesta en vez de FOMO

- FOMO = **miedo** a perderse algo. Reemplazo: **anticipación** = ganas de
  ver lo que viene.
- _"A partir del segundo ciclo vas a verte con claridad"_ es un **open loop**
  (efecto Zeigarnik): tensión narrativa que tira hacia adelante, **sin miedo,
  sin pérdida, sin urgencia.** (Existe: en el reveal + day-one.)
- **La diferencia clave:** el FOMO empuja por **evitar dolor**; la
  anticipación tira por **deseo**. Para la escéptica, lo primero la quema; lo
  segundo la engancha. Misma dirección (volver), motivación opuesta.
- **NO:** countdowns, "se acaba", "te lo perdés", "otras ya van por…",
  scarcity. **SÍ:** "lo que viene", "se afina", "tu cielo crece".

---

## 5. Mecánica D · El gancho del día 2 (bucle abierto concreto)

- En vez de un push de urgencia (FOMO), un **bucle abierto concreto**: una
  pieza incompleta que solo se cierra volviendo. _"Mañana enciende tu próxima
  estrella"_ / _"el segundo día es donde Stelar empieza a verte"_. (Parcial:
  day-one ya dice "vuelve mañana"; falta atarlo a la constelación como bucle.)
- Atado a la **constelación** (la siguiente estrella sin encender = la razón
  concreta de volver). Es el equivalente **sano del streak-trigger**: te tira
  a volver sin amenazar con quitarte nada.
- La **notificación** (opt-in, ubicada DESPUÉS del reveal) es el disparador,
  framed como invitación: _"tu cielo está acá cuando quieras"_, nunca "no
  pierdas…". Disparador ético, no deuda.

**Falta:** atar la notificación + el copy del día 2 a la constelación como
bucle abierto (mover/conectar con la Mecánica A).

---

## 6. Mecánica E · El regreso sin culpa (win-back sano)

- **Ya existe en código** (`features/patterns/messages.ts`, detector
  `abandonment`): _"Volviste. Tu cielo te esperó."_
- Es la versión sana del win-back / del FOMO de re-engagement: la usuaria que
  faltó 3 días vuelve **sin reproche, sin "empezar de cero".** Las estrellas
  ganadas la esperan (refuerza directamente la asimetría de la Mecánica A).
- **Es la palanca de retención más diferenciadora de Stelar** — define si la
  usuaria que dudaba en volver, vuelve. Protegerlo: **nunca** convertirlo en
  push de culpa ("llevas 3 días sin entrar").

---

## 7. Qué EVITAR (las formas crudas) y por qué quema a ESTA usuaria

- **Rachas que se rompen / castigan** → el todo-o-nada lee la racha rota como
  fracaso total → abandono. Es literalmente lo que la sacó de otras apps.
- **Puntos / badges / niveles / leaderboards** → motivación extrínseca que se
  agota; la comparación hiere a la perfeccionista.
- **FOMO real (countdown, scarcity, "te lo perdés", social proof de presión)**
  → ansiedad, dark pattern, erosiona la confianza de la escéptica (huele la
  manipulación), y roza regulación (UE/California).
- **Optimizar "tiempo en app" / aperturas** → induce diseño compulsivo, lo
  contrario del loop sano. Optimizá **"vuelve sin culpa"**, no "vuelve
  compulsivamente".

---

## 8. Fundamento conductual (las mismas palancas, redirigidas)

- **Loss-aversion** → redirigida: no hay pérdida posible (las estrellas no se
  apagan) → solo ganancia. El sesgo más fuerte de la gamificación, sin su filo.
- **SDT (competencia + autonomía)** → progreso y logro sin recompensa
  extrínseca que se agote ni presión.
- **Zeigarnik / open loop** → anticipación (Mecánica C/D) en vez de urgencia.
- **Identidad (James Clear)** → cada estrella es un voto por la persona que
  quiere ser; el cierre de ciclo reformula la identidad.

---

## 9. Qué ya existe · qué falta · prioridad MVP

**Ya existe:** la constelación (Tab Hoy/Órbita), el reveal (Mecánica A
sembrada), el mensaje "Volviste" (Mecánica E, `patterns/messages.ts`),
day-one + la promesa "segundo día/ciclo" (Mecánicas C/D parciales).

**Falta:**

1. La regla **"no retrocede en día malo"** explícita y visible (Mecánica A) —
   las estrellas encendidas persisten día a día y entre ausencias.
2. El **cierre de los 28 días** como hito de identidad (Mecánica B).
3. **Atar la notificación + el copy del día 2 a la constelación** como bucle
   abierto (Mecánica D).

**Prioridad para el MVP de validación (3–4 usuarias):**

1. Constelación que **crece y no retrocede** (Mecánica A) — núcleo del puente.
2. **Proteger** el mensaje "Volviste" (Mecánica E) — costo casi cero, impacto
   en la métrica más diferenciadora (regreso post-ausencia).
3. La **promesa honesta del segundo ciclo** (Mecánica C) — solo copy.
4. El **cierre de 28 días** (Mecánica B) — construir antes de que la primera
   usuaria llegue al día 28.

**Métricas (para vos, nunca visibles como presión):** D1/D7/**D28**,
**tasa de regreso post-ausencia**, recuperación tras día malo. NO "minutos
en app".

---

## Antes de construir

Todo copy de hitos / regreso / anticipación pasa por **behavioral-specialist
→ manifesto-reviewer → voice-and-copy** antes de mergear. El framing de esta
spec es la guía; los strings exactos los firma esa cadena.
