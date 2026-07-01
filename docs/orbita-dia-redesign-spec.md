# Rediseño de Órbita Día (Stelar v2 · Sin IA)

> FUENTE DE VERDAD para Órbita · Día. Sustituye el modelo v1 de "¿Quién fuiste
> hoy?" (7 estados / arquetipo + diagrama orbital). Determinístico, sin IA. Nada
> se inventa: todo sale de la evidencia que la usuaria ya registró.
>
> **ACCIONABLE (cambio dueña, jun 2026).** Órbita ya NO es Observadora pura:
> puede **recomendar un FOCO** desde los propios datos (modo recomendación, no
> orden; nunca receta dieta/rutina/clínico). Se mantienen las líneas rojas.
> Ver manifiesto § "la frontera".

## Filosofía del rediseño

Órbita Día NO es un dashboard. NO es un reporte diario. NO es una pantalla de
estadísticas. Responde UNA sola pregunta:

> **¿Cómo voy hoy?**

Nada más.

La usuaria abrió Stelar porque quiere bajar de peso. No pregunta "¿cuántas cosas
registré?". Pregunta "¿me estoy acercando a mi objetivo hoy?". Órbita Día debe
REDUCIR la incertidumbre, no generar más información.

> Promesa de Stelar: hacer visible lo invisible.

Órbita Día no predice, no motiva, no aconseja, no juzga. Solo muestra:
**¿qué dice la evidencia de hoy?**

## Override consciente del manifiesto (decisión de la dueña)

El manifiesto v3.0 marca como línea roja que el déficit NUNCA domine una
pantalla. Para Órbita Día la dueña anuló esa regla de forma explícita: el héroe
de esta vista es el estado del déficit del día. Se mantiene la voz del
manifiesto (informa, nunca culpa ni celebra) y el resto de líneas rojas siguen
vigentes (sin lenguaje clínico, sin comparaciones, sin presión).

## Regla #1 · nunca contar registros como logro vacío

A la usuaria no le importa "registraste proteína / agua / sueño" como conteo.
Eso son acciones. Órbita revela lo que esas acciones SIGNIFICAN para su
objetivo. Los registros aparecen como evidencia que sostiene (o no) el rumbo del
día, nunca como un marcador de cuántas cosas anotó.

## Estructura de la pantalla

Muy calmada, mucho aire, 3-4 bloques, sin listas largas, sin analytics densos.
Fondo celestial oscuro, tipografía editorial, sensación premium. La UI respira.

Orden de bloques: Hero → Hacia dónde va tu día → La evidencia → Lo que aún no
aparece → Cierre. La síntesis ("Hacia dónde va tu día") va justo después del héroe,
antes del detalle.

### Hero · ¿Cómo va tu objetivo hoy?

La información más importante, inmediata. Un anillo que **se llena hacia la meta**
(metáfora Apple Watch): la traza crece con `consumo / meta`; lleno = llegaste a tu
presupuesto del día (que ya es un déficit, así que llenar es sano y protege contra
comer de menos).

**Dentro del anillo vive un CAMPO DE ESTRELLAS** (sin líneas, no un asterismo):
unas pocas grandes (destello de 4 puntas, con halo) y varias pequeñas de tamaños
variados. Es el "cielo" del día, identidad de Stelar. El número y la palabra viven
DEBAJO del anillo, para que el cielo no compita con el dato.

Bajo el anillo, el estado del objetivo (como el mockup de la dueña):

> HOY ESTÁS EN · **Déficit** · **425 kcal** · _Aún tienes margen para cerrar el día._

El número = `|consumido − meta|`: **SIEMPRE positivo, nunca un negativo** (decisión
de la dueña: ver números negativos no es bueno). La PALABRA da el rumbo ("Déficit"
= vas bajo tu meta = bien · "Sobre tu objetivo" = te pasaste); el número es solo la
magnitud. Sin signo `+` ni `−`.

Tratamiento visual (premium, vivo): traza con gradiente diagonal (magentaDeep →
magentaHot · oro para "sobre objetivo"), una **aura que respira** detrás del anillo
(halo de luz del color del estado, late lento · da profundidad + vida), un **pozo
de luz interior** (lit-from-within detrás de las estrellas), track tintado al
estado, y una **cabeza de cometa** en la punta. La respiración vive en la opacidad
de una View (op de compositor, no re-rasteriza el SVG) y se apaga fuera de pantalla

- reduce-motion. Cross-platform (RNSVG, sin Skia).

* **Déficit** (consumo ≤ meta): palabra "Déficit", número "425 kcal" magenta,
  línea "Aún tienes margen para cerrar el día." Anillo magenta.
* **Sobre tu objetivo** (consumo > meta): anillo completo en oro (cálido, nunca
  rojo) + un arco oro corto que insinúa el excedente. Número "135 kcal" oro,
  línea "Tu ritmo continúa mañana."
* **Aún se revela** (sin comida o sin meta de calorías): sin número, la
  constelación baja su intensidad (a la espera, no "cargando"). Palabra "Tu día
  aún se revela", línea "Cuando registres tu comida, verás cómo va tu objetivo."

Nunca avergonzar. Nunca celebrar. Nunca un número negativo. Solo informar.

> **Gráfica de tendencia (retirada en Día).** Se probó un sparkline de ingesta
> acumulada (reconstruido de las horas de las comidas) pero NO respondía "¿cómo
> voy hoy?" (regla de validación) y empujaba a dashboard. La curva que sí valdría
> (déficit hora a hora) necesita gasto calórico intradía → wearables (futuro). La
> tendencia por días vive en Semana/Mes, no en Día.

### Hacia dónde va tu día (Dirección + Por qué)

La sección más importante después del Hero, por eso va PRIMERO (responde "¿cómo
voy?" antes del detalle). Órbita resume la trayectoria de hoy, sin predicciones:

- "La evidencia de hoy se parece a tus días dentro del objetivo."
- "La evidencia de hoy aún está incompleta. Sabremos más conforme avance el día."
- "La evidencia de hoy muestra un día sobre tu objetivo."
- "La evidencia de hoy todavía está tomando forma." (déficit por debajo del piso
  sano: nunca se valida la restricción extrema como "dentro del objetivo").

Toda conclusión lleva su evidencia debajo (**¿Por qué?**), transparente:

> La evidencia de hoy apunta a un día dentro de tu objetivo.
> ¿Por qué? · ✓ Déficit de calorías · ✓ Proteína en objetivo · ✓ Entrenamiento

La usuaria siempre entiende de dónde salió la conclusión.

### La evidencia de hoy

NO rankea dimensiones, NO dice que una ganó. Solo lo que YA apareció hoy, como
respaldo del rumbo, con su dato real. La primera estrella brilla mayor (jerarquía,
no checklist):

- ✓ Proteína en objetivo · 122 / 120 g
- ✓ Entrenaste
- ✓ Dormiste · 7.5 h
- ✓ Agua completa · 8 / 8 vasos
- ✓ Te sentiste bien · Energía alta

NO se repite el déficit (ya es el Hero) NI se cuenta "N comidas" (Regla #1: nunca
contar registros como logro). El bienestar es una frase corta y humana, sin
"calma alta/baja" (suena clínico). Solo lo que apareció. Nada más.

### Lo que aún no aparece

No es un error, no es una advertencia. Solo la evidencia que todavía no llegó,
en lenguaje calmado. Cada una es tappable → lleva a registrarla (sin culpa, sin
"te faltó"):

- ○ Sueño · ○ Ánimo · ○ Agua

(El ciclo se excluye: se ancla cuando el período empieza, no es algo "diario".)

### Cierre

Una frase elegante que conecta con Órbita Semana:

- "Cada señal de hoy formará parte de tu órbita semanal."
- "Mañana tu historia continuará."
- "Una señal por sí sola dice poco. Varias comienzan a mostrar un patrón."

## Qué NO mostrar

- NO mostrar dimensiones en estrellas/puntajes (Movimiento 5★, Proteína 4★…).
  Eso es un dashboard. Órbita no es un dashboard.
- NO rankear dimensiones. Lo único que importa: ¿me acerco al objetivo de hoy?
- NO el diagrama orbital interactivo ni los 7 estados/arquetipo (retirados en v2).

## Movimiento

Todo aparece con fades lentos. El anillo de progreso se anima al entrar. Las
tarjetas de evidencia aparecen una a una. Sin confeti, sin gamificación, sin
celebración. Solo confianza silenciosa.

## Voz

Órbita es una OBSERVADORA, no coach, no nutrióloga, no psicóloga.

- ✓ "La evidencia de hoy es consistente con tu objetivo." · ✗ "¡Buen trabajo!"
- ✓ "Tu proteína ya apareció hoy." · ✗ "¡Increíble! ¡Proteína desbloqueada!"
- ✓ "Hoy todavía se está revelando." · ✗ "¡No te rindas!"

Sin em-dashes en copy visible. Español cálido, sin culpa, sin tecnicismo, sin
lenguaje clínico.

## Regla de validación

Antes de renderizar cualquier tarjeta, pregunta: ¿esto ayuda a responder "cómo
voy hoy"? Si la respuesta es NO, quítalo.

## Sensación final

Al cerrar Órbita Día la usuaria debe pensar: "Sé exactamente dónde estoy hoy."
No "vi más datos." Eso es el propósito de Órbita Día. Lo invisible ahora se
siente visible.

## Notas de implementación

- Lógica pura y testeable en `features/orbit/day-goal.ts` (`buildDayGoal`). La
  capa visual la consume en `components/DayPresent.tsx`.
- El campo de estrellas del anillo es fijo y estático. La única animación continua
  es la opacidad del aura (View envolvente → compositor, no re-rasteriza el SVG;
  apagada fuera de pantalla + reduce-motion). El draw-in del arco es one-shot.
- El déficit "sano" comparte definición con Semana/Mes (`features/orbit/deficit.ts`,
  `isDeficitDay`): solo cuenta como sano dentro de `[0.6×meta, meta]`. El héroe
  muestra el consumo honesto siempre, pero la DIRECCIÓN y el "¿Por qué?" solo
  validan "dentro del objetivo" si el déficit es sano. Por debajo del piso
  (restricción extrema) la lectura es neutral ("todavía está tomando forma") y no
  afirma el déficit como logro (línea roja del manifiesto).
- El modelo v1 (`day-state.ts`, 7 estados) queda retirado de la UI.
