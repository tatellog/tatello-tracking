# STELAR — Órbita Semana (v2.2 · la ventana abierta · sin IA)

> Fuente de verdad para la pestaña **Órbita › Semana**. Deriva del
> manifiesto (`features/docs/product-manifesto.md`, v3.0) y convive con
> `docs/PRD-v2.md` y `docs/tu-orbita-design.md`. Si algo aquí choca con el
> manifiesto, gana el manifiesto.
>
> **ACCIONABLE (cambio dueña, jun 2026).** Órbita ya NO es Observadora pura:
> puede **recomendar un FOCO** desde los propios datos (accionable en modo
> recomendación, no orden; nunca receta dieta/rutina/clínico). Esto matiza la
> filosofía "solo observa / nunca explica" de abajo: la evidencia sigue primero,
> pero se permite cerrar con una recomendación de foco ("para la próxima semana,
> tu palanca es…"). Se mantienen las líneas rojas (sin culpa/clínico/vergüenza/
> comparación). Ver manifiesto § "la frontera".
>
> Esta v2 reemplaza la v1 (galaxia + arquetipo etiquetado). El cambio de
> fondo: el centro de Semana ya no es una _etiqueta_ ("predominó la
> constancia") sino la **evidencia que empezó a repetirse**. Decisiones de
> producto vigentes (acordadas con la dueña):
>
> 1. **Hero híbrido.** El descubrimiento principal conserva el arte de
>    estado como adorno, pero su TEXTO pasa a ser una OBSERVACIÓN de
>    co-ocurrencia ("Movimiento apareció junto a tu proteína 4 veces"), no
>    una palabra-etiqueta de arquetipo.
> 2. **La galaxia se conserva en el centro.** "El cielo semanal"
>    (`WeekOrbitGalaxy`) sigue siendo una sección visual fuerte; las
>    secciones de evidencia de v2 se construyen alrededor de ella.
> 3. **Déficit y calorías entran, con guardas.** Solo con el piso sano
>    (0.6×target, nunca celebrar restricción), framing neutro de evidencia,
>    sin "los findes son difíciles para ti", y solo si hay meta calórica
>    configurada.
>
> **Actualización v2.2 (jul 2026 · 2ª sesión target-user + product-benchmark).**
> Con Día y Mes a la vista, la v2.1 se **sobre-corrigió**: su §0 "veredicto de
> déficit N de M días" y su palanca "tu finde te sostiene" **repetían Mes casi
> textual** (Mes ya dice "Déficit constante 15 de 27 días" y "Tu fin de semana te
> sostiene, entre semana margen"), y el número de déficit ya vive en Día. Semana
> se estaba volviendo un **mini-Mes**. v2.2 le da a Semana un trabajo PROPIO.
>
> **La identidad de Semana: la pestaña del "TODAVÍA PUEDO".** Es el único tramo
> de tiempo aún abierto y modificable. **Día** = el ahora (un punto: "Déficit 653
> kcal hoy"). **Mes** = la foto casi terminada (un %: constelación + "15/27
> días" + patrones). **Semana** = lo que aún se está moviendo y ella puede
> terminar bien. Reparto sin solape:
>
> - **Día** posee el número de déficit de HOY y la evidencia de hoy.
> - **Mes** posee la constancia mensual (conteo N/M), el calendario de déficit,
>   la constelación del signo, los patrones multi-semana y la palanca estructural.
> - **Semana** posee tres cosas que NADIE más da: (a) la **ventana abierta**
>   (días que faltan, "todavía puedo"), (b) la **silueta** de los 7 días (la
>   forma: dónde subí, dónde caí), (c) el **movimiento vs la semana pasada**
>   (dirección: subiendo / plano / más suave). Mes da una FOTO; Semana da un
>   MOVIMIENTO.
>
> Decisiones v2.2:
>
> 4. **Fuera el veredicto-conteo de déficit (mata la §0 de v2.1).** Ningún
>    `N/M` estático de déficit en Semana — eso es Mes. El déficit se transmuta en
>    **dirección** (vs la semana pasada) y en **forma** (la silueta), no en conteo.
> 5. **Hero = "todavía puedo" + dirección.** "Vas a media semana · Quedan 3 días
>    por delante" + veredicto de dirección **Subiendo / Sostenido / Más suave**
>    (reusa `risingSignal`, que YA compara esta semana vs la pasada en la misma
>    ventana). Sin countdown, sin cuota, sin número-a-alcanzar colgado.
> 6. **La silueta de los 7 días es el héroe visual** (lo único genuinamente
>    semanal). La galaxia (eje "qué hábitos") se conserva intacta debajo; la
>    silueta (eje "forma del tiempo") es su complemento horizontal.
> 7. **Energía sale de la galaxia** (coherente con Mes) y **los "X/3" no son
>    calificación** (denominador humano, sin hue de alarma). [se mantiene de v2.1]
> 8. **Palanca del FINDE cercano**, distinta de la estructural de Mes; y **fuera**
>    de Semana: la coda de presencia (vive en Día + Mes) y cualquier eco de la
>    constelación del signo (es de Mes). `confirmedFacts` como lista de conteos
>    también sale (solapa Mes).

## La promesa

> **Haz visible lo invisible.**

Semana no es una pantalla de estadísticas. No es un reporte semanal. Es el
lugar donde la usuaria empieza a **descubrir patrones que emergen de sus
propios datos**.

Responde una pregunta con dos tiempos — porque la semana es el único tramo aún
abierto (v2.2):

> ¿Qué forma lleva mi semana… y todavía puedo darle?

Mira atrás (qué se movió, qué forma tiene) para poder mirar adelante (todavía
quedan días). No es un reporte cerrado como el mes: es un tramo vivo.

## Qué es y qué no es Órbita

Órbita **NO** es:

- nutrióloga
- psicóloga
- consejera de salud
- una IA que pretende saber POR QUÉ pasó algo

Órbita **ES**:

- una observadora
- un espejo
- un motor de evidencia

Su trabajo es **revelar**. Nunca explicar, nunca diagnosticar, nunca
suponer, nunca especular.

## Filosofía

Semana nunca le dice a la usuaria:

> "Esto pasó porque…"

En cambio dice:

> "Esto apareció en tus datos."

La usuaria llega a sus propias conclusiones. Eso construye confianza. Esa es
nuestra ventaja competitiva: **no es la IA, es la confianza.**

### Toda observación necesita evidencia

Cada tarjeta que se muestra debe poder responder:

> "¿Qué evidencia la respalda?"

Si la evidencia no se puede mostrar, la observación **no debe existir**.

| ❌ Mal (sin evidencia)                | ✔ Bien (evidencia visible)                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| Duermes mejor cuando entrenas.        | 4 de tus 5 días de entreno fueron también días en que alcanzaste tu proteína. |
| Los fines de semana se te dificultan. | 2 de tus 3 días por encima de tu meta calórica cayeron en fin de semana.      |

Evidencia primero. Conclusión después.

### Nunca insinuar causalidad

Órbita no puede saber POR QUÉ pasó algo. Solo sabe QUÉ pasó.

**Palabras prohibidas** (causalidad / interpretación):

> porque · gracias a · por lo tanto · mejora · reduce · causa · provoca ·
> ayuda a · hace que

**Palabras permitidas** (observación):

> apareció · coincidió · ocurrió · estuvo presente · sucedió · se repitió ·
> se observó · junto a · el mismo día que

| ❌ Causal                        | ✔ Observacional                                                  |
| -------------------------------- | ---------------------------------------------------------------- |
| Dormir más mejoró tu déficit.    | 4 de tus 5 días en déficit ocurrieron tras noches de más de 7 h. |
| Entrenar te ayuda a comer mejor. | Tu proteína apareció junto a tus entrenos 4 de 5 veces.          |

### Regla de validación (antes de renderizar CUALQUIER observación)

Pregúntate:

> ¿Esta afirmación se sostiene directamente con los propios datos de la usuaria?

- Si la respuesta es **NO** → no la muestres.
- Si la respuesta es **SÍ** → muestra la evidencia que la respalda
  inmediatamente debajo.

La evidencia siempre va antes que la interpretación.

---

## Layout

Orden de la pantalla (v2.2 · la ventana abierta, no un mini-Mes):

1. Hero (título + subtítulo forward)
2. **§0 · Todavía puedo + dirección** — "Vas a media semana · Quedan 3 días" +
   veredicto **Subiendo / Sostenido / Más suave** vs la semana pasada. UNA mirada
   glanceable: dónde estoy en la semana y hacia dónde voy. (NUEVO; reemplaza el
   veredicto-conteo de déficit de v2.1)
3. **§S · La silueta de tus 7 días** — el ritmo/forma del tramo como héroe visual
   (NUEVO; lo único genuinamente semanal)
4. §2 · El cielo semanal (galaxia · intacta · **sin Energía**)
5. §1 · Una observación de la semana (co-ocurrencia **demovida** a apoyo, sin
   conteos; los patrones profundos son de Mes)
6. §6 · La semana día por día (detalle detrás de la silueta · tappable → Día)
7. §7 · La ausencia también cuenta (ligera)
8. §5 · Lo que aún necesita más evidencia (**susurro**, una línea)
9. §8 · Tu palanca para los próximos días (finde cercano + transición a Mes)

> **Regla de jerarquía (v2.2).** Semana = ventana abierta + forma + movimiento.
> Arriba, lo que solo Semana da (todavía-puedo + dirección + silueta). Nada de
> conteos `N/M` de déficit (es Mes), nada de coda de presencia (Día + Mes), nada
> de constelación del signo (Mes). La galaxia queda intacta en medio.
>
> **Eliminado de v2.1 por redundar con Mes/Día:** §0 veredicto-conteo de déficit,
> §4 "Lo que podemos confirmar" (lista de conteos), §P coda de presencia, y las
> líneas de conteo de déficit en §3/§4.

### Hero

- **Título:** ¿Qué descubriste esta semana?
- **Subtítulo (v2.2, forward/abierto):** Tu semana todavía se está escribiendo.
  (revisado por `voice-and-copy`: "a medio hacer / puedes darle forma" sonaba a
  tarea/cuota; "se está escribiendo" es lienzo abierto sin presión.)

No usar frases mágicas. No usar IA. Todo proviene de registros.

### §0 · Todavía puedo + dirección · NUEVO (reemplaza el veredicto-conteo)

El **primer dato** tras el título. Una sola mirada glanceable que responde lo que
SOLO Semana puede: **¿dónde estoy en la semana y hacia dónde voy?** Son dos
piezas juntas:

```
Vas a media semana.        ← ventana abierta (serif italic, voz de coach)
Quedan 3 días por delante. ← días restantes (Inter, número héroe) — lienzo, no cuota
↗ Subiendo                 ← dirección vs la semana pasada (glyph + palabra en el acento)
Esta semana llevas más ritmo que la pasada, a la misma altura.
```

**(a) La ventana abierta ("todavía puedo").** Referente: Apple Fitness — el
anillo a media tarde dice "aún puedes cerrarlo hoy": el tiempo restante es
oportunidad, no reporte. Los días que faltan (`7 − isoWeekday(today)`) se
enmarcan como **espacio por delante**, NUNCA como cuota. Sáb/dom el copy muta a
cierre cálido ("Tu semana casi cierra. Un fin de semana por delante.").

- **Prohibido countdown/cuota:** nada de "te faltan 3 días para tu meta de
  déficit" ni "cierra tu semana". Los días restantes son lienzo abierto, sin
  número-a-alcanzar colgado. → `manifesto-reviewer` (frontera countdown).

**(b) La dirección vs la semana pasada.** Referente: Apple Trends — flechas ↑↓
**contra tu propio promedio**, nunca contra otros; cuando baja, lo dice neutro,
sin regaño. Es el motivador que la usuaria dijo que **nadie más le da** ("esta
semana vas mejor que la pasada… me motiva muchísimo").

- Reusa `risingSignal()` (YA existe en `week-orbit-logic.ts:186`), que compara
  **esta semana vs la pasada en la MISMA ventana** (lun→hoy vs lun→mismo-día).
  Se convierte en un **veredicto cualitativo de dirección**, no un conteo:
  **Subiendo** (mejor que la ventana equivalente) · **Constante** · **Más suave**
  (peor). Glyph ↗ / → / ↘ en el acento, **sin números enfrentados**. ("Constante",
  no "Sostenido": `voice-and-copy` lo marcó frío/técnico; "Constante" es on-brand
  con constancia/Ancla. El domingo en "Más suave" cierra con "Cada semana tiene
  su forma.", no en downer.)
- Es genuinamente semanal: Día no compara semanas; Mes compara Semana1 vs
  Semana4 DENTRO del mes; esto es "esta semana rodante vs la anterior, en vivo".
- **Si la dirección es peor:** copy sin regaño, reencuadrado al "todavía puedo"
  ("Vas más suave que la semana pasada. Aún quedan 3 días por delante."), nunca
  "bajaste el ritmo, cuidado". Sin comparación tóxica, sin culpa. →
  `voice-and-copy` + `manifesto-reviewer`.

**Por qué NO un conteo de déficit:** "N de M días en déficit" es el KPI de Mes
(una FOTO). Semana da un MOVIMIENTO (dirección). El déficit no desaparece: se
transmuta en dirección (aquí) y en forma (§S).

### §S · La silueta de tus 7 días · NUEVO (héroe visual)

El ritmo del tramo hecho imagen: lo único que solo la semana puede mostrar. La
usuaria quiere **ver** la forma ("¿empecé fuerte y me caí el jueves?"), no que se
la cuenten. Referente: la vista semanal de barras de Apple + la claridad de
YAZIO (una silueta legible de un vistazo).

```
L   M   M   J   V   S   D
▓   ▓   ▒   ·   ·   ·   ·      ← altura/luz = plenitud del día; futuro = polvo tenue
```

- **Una banda de 7 celdas** (L-M-M-J-V-S-D). Altura/luminancia de cada celda =
  "plenitud del día hacia su objetivo" (reusa la riqueza de señales que
  `dayTimeline`/`signalCount` ya calculan). **Día en déficit = celda que emite
  luz oro** (misma gramática "encendido vs en reposo" del calendario de Mes → los
  tres tabs hablan el mismo lenguaje de luz, coherencia visual).
- **Los días futuros = polvo tenue** (nunca falla, nunca cuota): refuerza el
  "todavía puedo" del §0.
- **Relación con la galaxia (que NO se toca):** la silueta es el eje HORIZONTAL
  (la forma del tiempo, día a día); la galaxia es el eje VERTICAL (qué hábitos,
  por masa de planeta). Preguntas distintas, se complementan. Silueta arriba como
  héroe semanal; galaxia debajo intacta.
- **Build:** nueva fn de silueta sobre `dayTimeline`/`signalCount` en
  `week-orbit-logic.ts`; UI nueva en `WeekSegment.tsx`. La lista de texto
  día-por-día (§6) baja a "detalle" tappable detrás de la silueta.

### §1 · Una observación de la semana (co-ocurrencia · DEMOVIDA a apoyo)

> **v2.2 · ya NO es el héroe.** La co-ocurrencia era el hero de v2, pero
> **la co-ocurrencia es el motor de Mes** ("Tus patrones", `WinningCombo`, "No
> sabías que" — `orbita-mes-spec.md` §6/§6.5), y a una sola semana es frágil
> (exige ≥3 días y degrada). Tenerla de héroe volvía Semana un mini-Mes. Ahora el
> héroe es §0 (todavía puedo + dirección) + §S (silueta); la co-ocurrencia baja a
> **UNA sola observación de apoyo**, sin lista de conteos, y solo insinúa la más
> fuerte de la semana en curso. Los patrones profundos multi-semana viven en Mes.

UNA sola observación de apoyo (no el hero). La co-ocurrencia más fuerte de la
semana: dos señales que aparecieron juntas varios días.

- **Lado izquierdo:** el arte de estado (las ilustraciones de Día) como
  ADORNO del descubrimiento. No es una etiqueta de arquetipo; es textura
  visual coherente con Día.
- **Texto (voz de coach, serif italic):** la observación de co-ocurrencia.
  Sin la palabra-etiqueta "constancia/movimiento". Ejemplo:

  > Tu movimiento apareció junto a tu proteína **4 veces** esta semana.

- **Debajo:** la **línea de evidencia** (timeline), una marca por día para
  cada una de las dos señales:

  ```
  L ✔ ✔
  M ✔ ✔
  X ✖ ✖
  J ✔ ✔
  V ✔ ✔
  ```

  Simple, visual, objetivo.

- **Botón ¿Por qué?** → bottom sheet "La evidencia" con la lista
  transparente de la que salió el descubrimiento.

**Selección del descubrimiento principal.** Se elige determinísticamente la
co-ocurrencia más fuerte entre pares relevantes (movimiento×proteína,
déficit×sueño>7h, déficit×movimiento, comida×proteína). "Más fuerte" =
mayor número de días en que ambas señales coincidieron, con un mínimo de
co-ocurrencia (≥3 días) para no celebrar ruido. Si ninguna co-ocurrencia
llega al mínimo, el hero degrada a una observación de presencia simple
("Apareciste 5 de 7 días") con su propio timeline. Con muy poca evidencia,
un comienzo cálido (nunca un puntaje bajo).

### §2 · El cielo semanal (galaxia · conservada)

Aquí aparece la galaxia. **No decorativa: representa evidencia.** La usuaria la
ama; se conserva intacta. Los cambios de v2.1 son de coherencia, no de arte.

Cada planeta es una señal: **Movimiento · Comida · Proteína · Sueño · Agua**.
(v2.1: **Energía SALE de la galaxia** — queda en Hoy, igual que Mes ya la retiró
por ser calorías consumidas − gastadas; era el planeta que más confundió a la
usuaria, "Energía 1/3 en naranja" leído como reprobar. El ciclo tampoco es
planeta: contexto de la balanza, vive en Mes; ver `docs/cycle-voice-spec.md`.)

Cada planeta tiene **tamaño, brillo e intensidad** según cuántos días estuvo
presente. Movimiento 5/7 → planeta brillante; Agua 2/7 → planeta pequeño;
Proteína 7/7 → el más brillante.

> **La frecuencia se codifica por MASA/BRILLO, nunca por hue de alarma (v2.1).**
> Un conteo bajo se ve _tenue/pequeño_, del mismo color de identidad — nunca se
> tiñe de coral/naranja (eso reintroduce la gramática de calificación que el
> planeta evita). Referente: el anillo de Apple sin cerrar es _menos lleno_, no
> rojo. Regla: ningún planeta cambia de color por tener pocos días. (Fix
> concreto: el color base de Energía era `#FF8A5C` warning; al salir Energía, ya
> no aplica, pero la regla vale para todos en `week-dim-visual.tsx`.)

Al tocar un planeta emerge su panel. El conteo NO es un score "1/3": lleva
denominador humano y lenguaje de aparición neutral:

> **PROTEÍNA**
> 5 de los 7 días registrados
>
> L ✔ M ✔ X ✖ J ✔ V ✔ S ✔ D ✖
>
> La proteína apareció la mayor parte de la semana.

Nada más. Sin interpretar. Las señales que nunca aparecieron NO se pintan
como planeta de 0 días (se leería como falla): bajan a §7 "La ausencia".

### §3 · Evidencia emergente

De 2 a 4 tarjetas máximo. **Observaciones, no consejos.** Cada una es un
hecho con su número. Ejemplos:

> • Tu proteína apareció en días de entreno 4 de 5 veces.
> • El agua apareció solo 2 días.

Se eligen las de mayor señal (mayor conteo / mayor contraste) y se
descartan las que no se sostienen con datos. **Sin "deberías", sin causa.**

> **v2.2 · fuera la línea de conteo de déficit.** La observación `deficit`
> ("El déficit apareció en 5 de 7 días") se **retira** de `emergingEvidence()`
> (`week-orbit-logic.ts:1015`): es un conteo N/M = Mes en chiquito. El déficit ya
> vive como **dirección** en §0 y como **forma** en §S. Aquí quedan solo
> observaciones NO de déficit (co-ocurrencias, apariciones de otras señales).

> **Guarda de déficit/calorías.** El "déficit" usa el piso sano
> (`healthyDeficit`, 0.6×target; misma definición que Día/Mes). Nunca se
> celebra comer por debajo del piso. Estas tarjetas solo existen si hay meta
> calórica configurada.
>
> **v2.1 · "El día de más calorías" NO va suelto.** La usuaria reportó que
> "El lunes fue tu día de más calorías" la deja con **culpa vaga sin salida**:
> le señala el mal día pero no le dice si aun así cerró en déficit. La
> observación `hi-cal` de `emergingEvidence` se **retira del set por defecto**;
> el veredicto de §0 ya hace ese trabajo en positivo. Si alguna vez se muestra,
> DEBE resolverse con el balance ("…y aun así cerraste la semana en déficit 4 de
> tus días"), nunca cortar en el señalamiento. → `voice-and-copy` +
> `manifesto-reviewer`.

### §4 · Lo que podemos confirmar · ELIMINADA en v2.2

Era una lista de **conteos estáticos** ("Entrenaste 4 veces / 5 días terminaron
en déficit"). Solapa el KPI-conteo de Mes y es una FOTO, no el MOVIMIENTO que
Semana debe dar. **Se retira** (quitar `confirmedFacts()` como sección;
`week-orbit-logic.ts:1083`). Si algún logro merece reconocimiento emocional, se
funde como una línea cálida junto al hero de dirección (§0) — reconocimiento, no
lista de conteos. El "Award" ceremonial de presencia ya vive en Mes (§9).

### §5 · Lo que aún necesita más evidencia

Una de las secciones más importantes de Órbita: **la honestidad**. Nunca
fingir confianza. Ejemplo:

> Todavía no tenemos suficientes datos para descubrir si tu agua se
> relaciona con tu déficit. Sigue registrando.

Esto crea curiosidad y refuerza la confianza. Se dispara cuando una
correlación candidata tiene muy pocos puntos para afirmarse (ej: <3 días con
ambas señales). Marco temporal: "todavía", "aún no", "sigue registrando".

> **v2.1 · susurro, no sección.** La usuaria sintió que este bloque, con el
> mismo peso de titular que los hallazgos, se lee como _"la app no sabe nada,
> sigue haciendo tarea"_ (le devuelve la pelota). Baja de sección con eyebrow
> uppercase a **una sola línea tenue** (niebla, sin eyebrow), o coda al pie de
> §3. Se conserva la humildad y la curiosidad; se disuelve el "no sé nada". Por
> eso en el nuevo orden va casi al final, después de Presencia.

### §6 · La semana día por día

Cada día resumido con sus **etiquetas de evidencia**. La usuaria entiende la
semana en 10 segundos.

```
Lunes      ✓ Déficit  ✓ Proteína  ✓ Entreno
Martes     ✓ Déficit
Miércoles  Por encima de tu meta calórica
Jueves     Entreno
Viernes    Proteína
Sábado     Por encima de tu meta calórica
Domingo    Sin registros
```

Cada fila abre ese día en Órbita Día (la tira de fechas tappable). "Sin
registros" es neutro, nunca reproche. "Por encima de tu meta" es evidencia,
no culpa.

### §7 · La ausencia también cuenta

Si algo nunca apareció, también es evidencia. Tono neutro (aro hueco, no
estrella). Tope de 2 para no leerse como regaño. Ejemplos:

> No encontramos registros de agua. Eso también es parte de tu semana.
> No registraste cómo te sentiste. Todavía no podemos descubrir ese patrón.

Excluye el ciclo (su ausencia significa "no estás en tu periodo", no un
registro faltante). Nunca culpabilizar, nunca regañar.

### §P · Tu presencia · ELIMINADA de Semana en v2.2

La coda de presencia **NO va en Semana**. La v2.1 proponía bajarla desde arriba,
pero la app **ya cierra con presencia en Mes** ("Tu presencia · Volver también es
parte de esto." — `orbita-mes-spec.md` §9, el `PresenceFinale`) y la evidencia de
presencia de hoy vive en **Día** ("La evidencia de hoy"). Ponerla también en
Semana sería la **tercera coda de presencia** de la app: la usuaria ya entendió
que volver cuenta; no repetírselo tres veces. Una app, un cierre de presencia
(Mes). Ver `orbita-presence-coda`.

### §8 · Tu palanca para los PRÓXIMOS DÍAS (cierre accionable, cercano)

UNA palanca/foco, en voz de coach. Alineado al cambio de dueña (jun 2026): Órbita
recomienda un foco (recomendación, no orden). La usuaria pidió salir sabiendo QUÉ
ajustar, y que sea **usable el sábado**, no una abstracción de mes.

> Tu palanca para los próximos días:
> _"Esta semana el finde fue el más alto en calorías. Ese es el espacio que
> tienes ahora."_ (revisado por voice-and-copy + manifesto-reviewer: sin
> "exceso"/"margen" — el 1º era etiqueta de juicio, el 2º vocabulario de la
> palanca mensual de Mes; anclado a dato "más alto en calorías".)

**Anti-redundancia crítica (v2.2).** La palanca de **Mes** es el agregado
ESTRUCTURAL ("Tu fin de semana te sostiene. Entre semana es donde tienes
margen." — `orbita-mes-spec.md`). La de **Semana** es **el sábado que viene**,
derivada de la forma de ESTA semana en curso. Se reusa `weekInvitations()` (ya
detecta la concentración del finde), pero:

- El framing es **temporalmente próximo** ("los próximos días", "este finde"), no
  el patrón mensual. Foco cercano, no estructura de largo plazo.
- **`voice-and-copy` debe garantizar que la palanca de Semana y la de Mes NUNCA
  sean textualmente iguales.** Si el dato apunta a lo mismo, el copy de Semana lo
  dice en clave "ahora/este finde" y el de Mes en clave "tu mes". → también
  `manifesto-reviewer` (recomendación vs receta; nunca "comé menos"/"dormí más").

Cierra con la transición: cada semana deja una huella en tu mes, con la pequeña
galaxia que se transforma y el link "Ver cómo se transforma tu mes ›".

---

## Mapa de implementación (v2.2 · para cuando se construya)

Todo esto es **plan**; no se ha construido código (decisión: "solo el plan por
ahora"). Buena noticia: **casi toda la materia prima ya existe** en
`week-orbit-logic.ts`, solo está mal jerarquizada o sin usar.

- `features/orbit/week-orbit-logic.ts`
  - **Activar `risingSignal()` (:186)** como el veredicto de DIRECCIÓN de §0 (ya
    compara esta semana vs la pasada en la misma ventana; hoy está sin usar).
  - **Nueva fn de silueta** (§S) sobre `dayTimeline`/`signalCount` (:1149).
  - **Quitar** la línea `deficit` de `emergingEvidence()` (:1015) y **retirar
    `confirmedFacts()`** como sección de conteos (:1083) — solapan Mes.
  - **Reframe de `weekInvitations()` (:1188)** a palanca del finde CERCANO (§8),
    distinta textualmente de la palanca estructural de Mes.
  - **NO construir** `weekDeficitVerdict` (era la §0 de v2.1; se descarta).
- `features/orbit/components/WeekSegment.tsx` — reorden a la jerarquía v2.2: hero
  §0 (todavía-puedo + dirección) → §S silueta → galaxia → §1 co-ocurrencia
  demovida → día-por-día (detalle) → ausencia → susurro → palanca. Sin coda de
  presencia.
- `features/orbit/components/week-dim-visual.tsx` — retirar Energía de la galaxia
  (§2); regla "sin hue de alarma por bajo conteo".
- `features/orbit/components/WeekOrbitGalaxy.tsx` — panel del planeta con
  denominador humano ("X de los N días registrados"), no score "X/3".
- `docs/orbita-semana-spec.md` — este documento (fuente de verdad).

Cada string nuevo (hero §0, dirección "Más suave", palanca §8, subtítulo) pasa
por `voice-and-copy` + `manifesto-reviewer` antes de escribirse final. Guardas
clave: el "quedan N días" no es cuota; la dirección "peor" no regaña; la palanca
de Semana ≠ textual a la de Mes.

---

## Voz

Órbita es **calmada, honesta, humilde**. Nunca exagera, nunca inventa, solo
revela. Al cerrar la pantalla la usuaria debe sentir:

> "Yo descubrí esto."

No:

> "La app me lo dijo."

Reglas de copy heredadas del proyecto:

- Sin em-dashes (—) ni voz que suene a LLM en strings visibles.
- Serif italic = voz de coach (frases del descubrimiento, invitaciones).
  Todo lo demás en Hanken upright.
- Sin lenguaje clínico ni de culpa. Sin "atracón", "trastorno", "disorder".
- Sin comparación ("47% de tu meta") ni rachas rígidas / FOMO.

## Animaciones

**Al entrar:** las órbitas se dibujan lentamente, los planetas aparecen uno
por uno, las líneas de conexión se iluminan.

**Al tocar un planeta:** el resto baja su opacidad, el planeta seleccionado
viaja ligeramente al centro, el panel emerge desde abajo.

Nada brusco. Todo elegante.

## Sensación que debe dejar

> Nunca había visto mis datos de esta manera.
> Entiendo un poco mejor cómo soy que ayer.

No es un dashboard. No es un reporte. Es **evidencia convertida en
descubrimiento**. Ese es el verdadero significado de _Haz visible lo
invisible_.
