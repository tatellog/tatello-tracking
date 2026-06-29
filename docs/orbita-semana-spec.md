# STELAR — Órbita Semana (v1 sin IA)

> Fuente de verdad para la pestaña **Órbita › Semana**. Deriva del
> manifiesto (`features/docs/product-manifesto.md`) y convive con
> `docs/PRD-v2.md` y `docs/tu-orbita-design.md`. Si algo aquí choca con el
> manifiesto, gana el manifiesto.

## Objetivo

Rediseñar completamente la pestaña **Órbita › Semana**.

La pantalla ya no debe sentirse como un dashboard de hábitos. Debe sentirse
como un lugar donde la usuaria **descubre evidencia sobre ella misma**.

La filosofía de Stelar es: **Haz visible lo invisible.**

- No interpretamos.
- No diagnosticamos.
- No inventamos.
- Solo mostramos patrones reales que emergen de los datos.

La pregunta que responde esta pantalla es:

> ¿Qué descubrí sobre mí esta semana?

## Filosofía

Stelar no felicita. No juzga. No dice que alguien fue disciplinado. No dice
que alguien fue flojo. Solo dice:

> Esto fue lo que tus datos hicieron visible.

Todo debe poder explicarse con evidencia. Si la usuaria toca cualquier
conclusión debe poder responder _"¿Por qué dices eso?"_ y la app debe mostrar
exactamente de dónde salió.

---

## Layout

### Hero

- **Título:** ¿Qué descubriste esta semana?
- **Subtítulo:** Estas son las huellas que dejaron tus hábitos.

No usar frases mágicas. No usar IA. Todo proviene de registros.

### 1. Descubrimiento principal

Solo UNO. El patrón más fuerte.

Ejemplo:

> Esta semana predominó
> **CONSTANCIA**
>
> Estuviste presente
> 6 de 7 días.
>
> No fue perfecto.
> Pero sí consistente.

Este texto cambia según la evidencia.

- **Al lado izquierdo:** el símbolo del arquetipo (no una ilustración grande).
- **Abajo:** botón **¿Por qué?**

Al tocar **¿Por qué?** aparece un bottom sheet:

- **Título:** La evidencia
- Lista (ejemplo):
  - ✓ Registraste comida 6 días
  - ✓ Entrenaste 5 días
  - ✓ Dormiste más de 7 h en 4 días
  - ✓ Estuviste en déficit 5 días
  - ✓ Registraste emociones 6 días

Todo totalmente transparente.

### 2. El cielo semanal

Aquí sí aparece la galaxia. **No decorativa. Representa evidencia.**

Cada planeta representa una señal: Movimiento, Comida, Proteína, Sueño, Agua,
Energía, Ciclo.

Cada planeta tiene **tamaño, brillo e intensidad** según cuántos días estuvo
presente.

Ejemplo:

- Movimiento 5/7 → planeta brillante.
- Agua 2/7 → planeta pequeño.
- Proteína 7/7 → el más brillante.

Al tocar cualquier planeta aparece un panel. Ejemplo:

> **PROTEÍNA**
> 5 de 7 días
>
> L ✔ M ✔ M ✕ J ✔ V ✔ S ✔ D ✕
>
> La proteína apareció la mayor parte de la semana.

Nada más. Sin interpretar.

### 3. Lo que apareció menos

Nueva sección. Muy importante.

- **Título:** Lo más silencioso

Ejemplo:

> Agua
> 2 de 7 días
>
> Esta fue la señal menos presente.

No decir _"deberías tomar más agua"_. Eso pertenece al futuro IA.

### 4. Tus ritmos

No habla de cantidad. Habla de **distribución**. Todo sale únicamente de
timestamps.

Ejemplos:

> Tus mejores días fueron martes, jueves, sábado.

> Tus registros suelen aparecer por la noche.

> Entrenaste más al inicio de la semana.

> Dormiste mejor en fin de semana.

### 5. Lo que se mantuvo

- **Título:** Lo constante

Ejemplos:

> Dormiste entre 7 y 8 horas durante 5 días.

> Tu energía se mantuvo estable.

> Tu horario de comida cambió muy poco.

Todo basado en datos.

### 6. La ausencia también cuenta

Esto diferencia a Stelar. Si algo nunca apareció, también es evidencia.

Ejemplos:

> No encontramos registros de agua. Eso también forma parte de tu semana.

> No registraste emociones. Todavía no podemos descubrir ese patrón.

Nunca culpabilizar. Nunca regañar.

### 7. Tu órbita cambia

Al final. Una transición. Todo esto construye tu mes. Cada semana deja una
huella. Con una pequeña galaxia que lentamente se transforma.

---

## Animaciones

**Cuando entra la pantalla:**

- Las órbitas se dibujan lentamente.
- Los planetas aparecen uno por uno.
- Las líneas de conexión se iluminan.

**Al tocar un planeta:**

- El resto baja su opacidad.
- El planeta seleccionado viaja ligeramente hacia el centro.
- El panel emerge desde abajo.

Nada brusco. Todo elegante.

## Sensación que debe dejar

Al cerrar la pantalla la usuaria debe pensar:

> Nunca había visto mis datos de esta manera.

No es un dashboard. No es un reporte. Es **evidencia convertida en
descubrimiento**. Ese es el verdadero significado de _Haz visible lo
invisible_.
