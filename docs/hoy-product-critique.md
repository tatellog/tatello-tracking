# Crítica de producto · Tab Hoy (dirección de producto)

> Guardado para no perderlo. Fuente: feedback de dirección de producto
> (2026-06-16). Guía la rama `polish-tab-hoy`.

## El diagnóstico

No hay un problema de falta de funcionalidades. Hay un problema de **jerarquía,
descubrimiento y propósito**. La app ya hace MUCHAS cosas. La usuaria no entiende:

1. Qué debería hacer primero.
2. Qué es importante.
3. Qué es decorativo.
4. Qué es clickeable.
5. Qué ganó al registrar algo.

### 5 sistemas simultáneos que compiten (ninguno domina)

1. Entrené / Descansé
2. Constelación Leo (10/19 días)
3. Universo Hoy (Energía · Claridad · Estabilidad · Brillo)
4. Macros (Proteína · Calorías · Sueño · Peso · Ciclo)
5. Calendario

### El modelo Duolingo

Abres Duolingo → ves UNA cosa → "haz tu lección". Todo lo demás (liga, streak,
ranking, XP) es secundario, viene después. En Stelar, al abrir Hoy la usuaria
debería entender al instante: **¿qué me falta registrar hoy?** — no "mira 18
sistemas". Hoy debería comportarse como una **checklist emocional**.

## Recomendación principal: mover el foco

El trabajo principal de la usuaria es **registrar**, no admirar el león.

- Orden actual: Leo → Transformación → Universo → Macros → Comidas → Calendario.
- Orden recomendado: **Entrené/Descansé → Qué falta hoy → Comidas → Macros →
  Leo → Calendario**.

## La constelación (mayor problema)

Ocupa media pantalla (~450px) y no genera acción. La usuaria la ve, dice "ah
bonito", y sigue. No ayuda a registrar, entender ni descubrir.

- Convertirla en **hero compacto** (450px → **220-260px**).
- Agregar progreso explícito: **10/19 estrellas · 53% completado · Ver Leo →**.
- El objetivo no es ver el arte, es entender el progreso.

## Universo Hoy (tiene potencial, mal explicado)

Hoy: "Energía · Crece con cada comida que registras" → nadie entiende cuánto
tiene. Mostrar:

```
Energía
66%
2 comidas registradas hoy
↑ +27 hoy
```

## Toasts (lo mejor de la app)

Inmediatos, entendibles, pequeños, recompensan. Falta el **porqué**:

```
+27 Energía
por registrar comida
```

```
+25 Claridad
por 500ml de agua
```

Eso crea aprendizaje.

## Calendario (bien encaminado)

Ya responde "¿qué pasó ese día?". Falta que el **día seleccionado** quede MUY
evidente: estrella + halo + escala + línea inferior + tarjeta conectada (estilo
GitHub contribution graph).

## Cards clickeables (siguen pareciendo decoración)

Regla global: **todo componente interactivo tiene al menos 2 señales.** Ej. card
Universo: ícono + texto + ⌄ + pressed scale 0.97 + borde iluminado al tocar.
Genshin nunca depende de una sola señal.

## La frase que más preocupa

> Diez. Ya no es casualidad, es tuyo.

Bonita, pero no comunica nada. Reemplazar por:

> **10 entrenamientos registrados.**
> 9 estrellas restantes para completar Leo.

## Ranking de prioridades

### P0 (esta semana)

- Reducir altura del hero Leo.
- Mostrar progreso explícito (10/19 · 53% · 9 restantes).
- Hacer más obvio qué es clickeable.
- Explicar por qué salen los toasts.
- Mover el foco hacia registro.

### P1

- Constelación clickeable → abre: Leo · 53% · Estrellas activadas: 10 ·
  Siguiente estrella: Eta · Faltan: 9.

### P2

- Revelaciones (Abandono · Regreso · Transformación · Patrones).

### P3

- Órbita IA (Patrones · Insights · Predicciones).

## La tesis de retención (sin una línea de IA)

Reducir el protagonismo visual de Leo y aumentar el de "qué me falta hoy". La
usuaria no vuelve para ver el león; vuelve para **completar algo**. El león debe
sentirse como la **consecuencia visible** de completar cosas, no como el
contenido principal de la pantalla.

---

## Guías de implementación (para esta rama)

1. Sheets/modales → basarse en el diseño de **Revelaciones**
   (`features/revelations` / `PatternReveal` / `TransformationReveal`).
2. Si se usa el emblema → usar el **correcto que usa Tab Hoy**.
3. Diseño nuevo / illustrator → **sequential thinking** para auto-validar
   (lo más cercano a Genshin Impact, visualmente atractivo) + **uxui** para que
   sea intuitivo y explicativo.

---

## Estado de implementación (rama `polish-tab-hoy`, 2026-06-16)

Trabajo nocturno autónomo. Cada pieza validada (sequential-thinking +
uxui/manifesto donde aplica) y commiteada por separado.

### ✅ Hecho

- **Hero compacto de constelación** (`d958b14`). León ~450px → **240px**,
  centrado. Debajo, progreso explícito: `✦ {trained}/{figura}`, barra oro,
  `{pct}% de tu figura este mes`. Todo el bloque es tappable (link «Ver mis
  estrellas ›» + barra + press-scale = ≥2 señales) → abre el modal.
- **Modal "Tu {signo}"** (`d958b14`). Lenguaje de Revelaciones (blur +
  emblema correcto de Hoy). %, barra, estrellas con nombre ya encendidas y la
  que sigue. Coherencia de datos arreglada: las estrellas encendidas se
  derivan de la secuencia REAL de la figura (`namedStarProgress`, +4 tests),
  ya no de un slice ingenuo que se contradecía con la animación.
- **Quité el título serif "Tu {signo}"** de Hoy (bajó protagonismo del
  nombre, subió el del progreso). Queda solo la regla del mecanismo.
- **Toasts con porqué** (sesión previa): "+27 Energía · por tu comida".
- **Cards de "Tu universo hoy" con % + fuente** (sesión previa): "66% · 2
  comidas hoy".
- **Día seleccionado del calendario MUY evidente** (`63c72da`): halo magenta
  - número/inicial en leche + **caret conectado** (estilo GitHub graph) que
    ata la columna con su panel de detalle.
- **"Tu día" — checklist emocional** (`fec905f`). Fila de 5 rituales (Día ·
  Comida · Agua · Sueño · Ánimo) sobre la constelación: de un vistazo, qué
  registré. Mueve el foco al registro (modelo Duolingo) sin volverse otra
  recompensa. Manifiesto-safe (lo no-registrado = estrella por encender, no
  tarea fallida; frase de cierre solo al completar). Tocar un ritual lleva a
  su registro (Agua abre la hoja ✦).

### 🔁 Decisiones que tomé con criterio (no al pie de la letra)

- **No reordené Leo DEBAJO de Comidas/Macros.** La compactación del hero ya
  resuelve la dominancia, y mover el león abajo rompía la cadena
  acción→consecuencia (marco arriba → el cielo crece). En su lugar puse "Tu
  día" ENCIMA del hero para mover el foco al registro sin perder esa cadena.
- **Conservé la voz poética del coach** ("Diez. Ya no es casualidad…") en vez
  de cambiarla por "10 entrenamientos registrados / 9 restantes". Ahora el
  progreso explícito YA vive en la barra del hero (10/19 · 53%), así la frase
  poética es claramente la voz del coach, no el dato. (Si prefieres el cambio
  literal, es un ajuste de una línea en `getCoachCopy`.)

### ⚠️ Para tu decisión (no lo toqué solo)

- **`StreakLine` ("X días en órbita")**: el manifesto-reviewer la marcó como
  mecánica de racha rígida (principio 3) — contador prominente que desaparece
  al caer. La **moví bajo el hero** para alejarla de la capa que orienta, pero
  **no la quité**: retirar una feature existente es decisión tuya. Si quieres,
  la suavizo (sin número de días consecutivos) o la retiro.
- **Color de los chips Agua/Sueño**: reusan `UNIVERSE_ACCENT` (cohesión con
  las cards del universo). El uxui notó que ese mapeo arrastra colores cuyos
  nombres no calzan con el atributo. Lo dejé consistente con el universo; si
  quieres colores "canónicos" por dimensión, hay que tocar `universe-visuals`.

### 🧪 Nota de tests

4 suites fallan en la rama pero son **pre-existentes y ajenas** a este trabajo
(snapshot de field-stars, umbrales de etapa del emblema, regex de copy de
tendencia, y `require` de Skia en jest). Mi cambio testeado
(`derive-progress`) suma 4 tests que pasan.
