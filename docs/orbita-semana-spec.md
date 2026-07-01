# STELAR — Órbita Semana (v2 · evidencia sin IA)

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

## La promesa

> **Haz visible lo invisible.**

Semana no es una pantalla de estadísticas. No es un reporte semanal. Es el
lugar donde la usuaria empieza a **descubrir patrones que emergen de sus
propios datos**.

Responde UNA sola pregunta:

> ¿Qué empezó a repetirse esta semana?

Nada más.

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

Orden de la pantalla:

1. Hero
2. §1 · Descubrimiento principal (híbrido: co-ocurrencia + timeline)
3. §2 · El cielo semanal (galaxia · conservada en el centro)
4. §3 · Evidencia emergente (2 a 4 tarjetas)
5. §4 · Lo que podemos confirmar (hechos)
6. §5 · Lo que aún necesita más evidencia
7. §6 · La semana día por día (timeline con etiquetas)
8. §7 · La ausencia también cuenta
9. §8 · Repetir la próxima semana (cierre + tu órbita cambia)

### Hero

- **Título:** ¿Qué descubriste esta semana?
- **Subtítulo:** Tu semana deja huellas. Algunas empiezan a repetirse.

No usar frases mágicas. No usar IA. Todo proviene de registros.

### §1 · Descubrimiento principal (híbrido)

UNA sola observación. La evidencia más fuerte y repetida de la semana:
preferentemente una **co-ocurrencia** (dos señales que aparecieron juntas
varios días).

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

Aquí aparece la galaxia. **No decorativa: representa evidencia.**

Cada planeta es una señal: Movimiento, Comida, Proteína, Sueño, Agua,
Energía. (El ciclo NO es planeta: es contexto de la balanza, vive en Mes;
ver `docs/cycle-voice-spec.md`.)

Cada planeta tiene **tamaño, brillo e intensidad** según cuántos días estuvo
presente. Movimiento 5/7 → planeta brillante; Agua 2/7 → planeta pequeño;
Proteína 7/7 → el más brillante.

Al tocar un planeta emerge su panel:

> **PROTEÍNA**
> 5 de 7 días
>
> L ✔ M ✔ X ✖ J ✔ V ✔ S ✔ D ✖
>
> La proteína apareció la mayor parte de la semana.

Nada más. Sin interpretar. Las señales que nunca aparecieron NO se pintan
como planeta de 0 días (se leería como falla): bajan a §7 "La ausencia".

### §3 · Evidencia emergente

De 2 a 4 tarjetas máximo. **Observaciones, no consejos.** Cada una es un
hecho con su número. Ejemplos:

> • El déficit apareció en 5 de 7 días.
> • Tu proteína apareció en días de entreno 4 de 5 veces.
> • El sábado fue tu día de más calorías.
> • El agua apareció solo 2 días.

Se eligen las de mayor señal (mayor conteo / mayor contraste) y se
descartan las que no se sostienen con datos. **Sin "deberías", sin causa.**

> **Guarda de déficit/calorías.** El "déficit" usa el piso sano
> (`healthyDeficit`, 0.6×target; misma definición que Día/Mes). Nunca se
> celebra comer por debajo del piso. "Tu día de más calorías" se enuncia
> como evidencia neutra de distribución, NUNCA como reproche ni como "los
> findes son difíciles para ti". Estas tarjetas solo existen si hay meta
> calórica configurada.

### §4 · Lo que podemos confirmar

Una sección de **hechos puros**, sin interpretación. Ejemplos:

> ✓ Entrenaste cuatro veces.
> ✓ Alcanzaste tu proteína tres veces.
> ✓ Registraste cada día.
> ✓ Cinco días terminaron en déficit.

Son conteos directos de la semana. Cero lectura, cero adjetivos de juicio
("disciplinada", "floja" están prohibidos por el manifiesto).

### §5 · Lo que aún necesita más evidencia

Una de las secciones más importantes de Órbita: **la honestidad**. Nunca
fingir confianza. Ejemplo:

> Todavía no tenemos suficientes datos para descubrir si tu agua se
> relaciona con tu déficit. Sigue registrando.

Esto crea curiosidad y refuerza la confianza. Se dispara cuando una
correlación candidata tiene muy pocos puntos para afirmarse (ej: <3 días con
ambas señales). Marco temporal: "todavía", "aún no", "sigue registrando".

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

### §8 · Repetir la próxima semana (cierre)

Nunca decir "deberías…". En cambio, **invitaciones a observar** ("esto
apareció varias veces"):

> Movimiento y proteína aparecieron juntos casi toda la semana.
> El fin de semana concentró la mayoría de las calorías extra.
> Entre semana te mantuviste cerca de tu meta calórica.

Son invitaciones a observar, no instrucciones. Cierra con la transición:
cada semana deja una huella en tu mes, con la pequeña galaxia que se
transforma y el link "Ver cómo se transforma tu mes ›".

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
