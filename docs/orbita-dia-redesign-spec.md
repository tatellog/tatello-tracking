# Rediseño de Órbita Día (Stelar v1 · Sin IA)

> FUENTE DE VERDAD para Órbita · Día. Sustituye el modelo anterior de DayPresent
> ("¿cómo va mi día?" con héroe/chips/menos-apareció/enfoque). Determinístico,
> sin IA. Nada se inventa: todo sale de la evidencia que la usuaria ya registró.

## Filosofía

> Haz visible lo invisible.

Las calorías, proteínas y pasos ya son visibles. Lo invisible es **el patrón
dominante que ya estaba en tus acciones**. La app NO dice quién eres; dice:

> "Esto es lo que tus datos hicieron visible hoy."

En esta v1 NO existe IA. Toda la experiencia se construye con reglas de negocio
transparentes sobre los datos registrados. Nunca inventar conclusiones.

## Objetivo

Órbita Día NO responde "¿qué comiste?" ni "¿cómo van tus macros?" (eso vive en
otras pantallas). Responde una sola pregunta —**¿Quién fuiste hoy?**— pero NO
desde la personalidad, sino desde el comportamiento observado. Debe sentirse
como un espejo, no como un coach.

## Principio: estados, no arquetipos

NO son personalidad. Representan **qué mostró tu evidencia hoy** — el patrón de
señales que predominó. Por eso el lenguaje es:

> "Hoy predominó la recuperación." (porque el sueño fue la señal más fuerte)

NO "Hoy fuiste disciplinada" (no se puede saber) ni "Eres X" (etiqueta).

## Los 7 estados de Stelar

Cada estado se activa por reglas transparentes sobre las señales del día. Cada
uno tiene un color.

| Estado           | Color   | Se activa cuando…                                                                                                                     |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Constancia**   | Rosa    | La MAYORÍA de las señales del día estuvieron presentes (continuidad). No importa cuáles; importa que hubo continuidad.                |
| **Energía**      | Naranja | Las señales de MOVIMIENTO fueron las más fuertes (entreno, pasos, actividad, FC a futuro).                                            |
| **Recuperación** | Azul    | La señal dominante fue DESCANSAR (sueño, descanso, poca carga). No es flojera: es recuperación.                                       |
| **Nutrición**    | Verde   | Las señales más fuertes vinieron de la COMIDA (déficit logrado, proteína, registro completo, calorías).                               |
| **Equilibrio**   | Blanco  | NINGUNA señal dominó; todo estuvo parejo. Eso también es evidencia.                                                                   |
| **Exploración**  | Morado  | La usuaria registró señales NUEVAS/suaves (emoción, ciclo, energía, hambre, sueño). La app aprendió algo nuevo de ella.               |
| **Presencia**    | —       | NO hubo buenos resultados (entreno ❌, déficit ❌, proteína ❌) PERO sí hubo registro. Apareció. No desapareció. Rompe el "ya fallé". |

**Presencia es el más importante**: protege a la usuaria que no tuvo un buen día
pero fue honesta y registró. "Hoy predominó tu presencia. Porque apareciste."

## Estructura de la pantalla

### Hero — el astro del estado

- Título: **¿Quién fuiste hoy?**
- El héroe es el **astro GRANDE del estado** (su glifo PNG) sobre el cielo Skia
  (aura que respira + glow), tintado a su color. Limpio, sin datos encima.
- Debajo: el estado en palabra, **"Hoy predominó la [estado]."** (en su color),
  una explicación de 1 frase, y un hint: _"Toca el astro para ver por qué ›"_.
- El astro es tappable → abre el modal "Por qué".

### El algoritmo es VISIBLE (transparencia · en el modal)

Al tocar el astro se abre un modal (mismo sistema que el modal de Órbita Mes:
blur + scrim cálido + tarjeta) con los **DATOS REALES** de las señales que
decidieron el día:

- Eyebrow "POR QUÉ" + el estado (con su punto de color) + la regla que lo decidió
  (la explicación: "La mayoría de tus señales estuvieron presentes hoy.").
- **Barras**, una por señal presente, ordenadas por fuerza: etiqueta + barra (su
  peso relativo, la dominante resaltada) + el **valor real registrado** (p. ej.
  "7.8 h", "1 comida", "Energía 3/5") — nunca un puntaje abstracto "x/5".
- Las señales sin registro van abajo como ausencia: "Sueño · Ciclo: aún sin
  registro hoy."

> **Decisión de diseño (v1.2):** la lista de `★★★★★ Señal` en pantalla se retiró
> (se leía como boleta de calificaciones · culpa + ranking). El detalle vive ahora
> en el modal, **a un tap**, con datos reales en barras y la dominante resaltada —
> el héroe queda limpio con el astro. (Se probó una constelación de estrellas en el
> héroe y se descartó: ensuciaba la pantalla.)

Todo transparente. Nada mágico. Nada parece inventado.

### LA EVIDENCIA

Sólo las acciones registradas que respaldan el estado. No interpretar, no
explicar — sólo mostrar:

- ✓ Entrenaste — 42 minutos registrados
- ✓ Permaneciste en déficit — 1280 / 1450 kcal
- ✓ Dormiste — 7.8 horas
- ✓ Registraste tus comidas — 3 comidas
- ✓ Registraste cómo te sentiste — Energía 4/5

### TODAVÍA NO VIMOS

Señales importantes no registradas, como AUSENCIA (no error):

- ○ Agua · ○ Estado de ánimo · ○ Ciclo

### Cierre

Una frase elegante que conecta con Órbita Semana:

- "Cada señal de hoy formará parte de tu órbita semanal."
- "Mañana tu historia continuará."
- "Una señal por sí sola dice poco. Varias comienzan a mostrar un patrón."

## Reglas importantes

- Nunca usar IA. Nunca inventar conclusiones. Nunca lenguaje tipo coach ni
  frases vacías ("Eres increíble", "Vas excelente", "Sigue así").
- Nunca etiquetar a la persona. El estado describe la EVIDENCIA, no a la usuaria.
- Todo debe sentirse científico pero cálido. Elegante. Silencioso. Honesto.

## Estilo visual

Lenguaje visual de Stelar. Fondo espacial. Mucho aire / espacio negativo. UNA
sola tarjeta principal. Tipografía editorial. No saturar. La pantalla transmite
calma — no dashboard, no analytics, no tablas. Como abrir un diario elegante.

## Objetivo UX

Al cerrar la pantalla, la usuaria debe sentir:

> "No solo vi mis datos. Entendí lo que esos datos dijeron sobre mí hoy."
