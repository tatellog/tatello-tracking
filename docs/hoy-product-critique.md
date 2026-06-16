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
