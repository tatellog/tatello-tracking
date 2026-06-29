# STELAR · Órbita Mes — fuente de verdad

> Rediseño completo de la pestaña **Órbita › Mes**. Sin IA. Toda la
> información proviene únicamente de datos reales registrados por la
> usuaria. Filosofía: **haz visible lo invisible.**

Órbita Mes NO es un dashboard de estadísticas. Es el lugar donde la
usuaria descubre **quién se está convirtiendo** gracias a sus acciones
repetidas.

La pregunta que responde la pantalla:

# ¿En qué me estoy transformando?

- ❌ No responde "¿cuántas veces entrené?"
- ❌ No responde "¿cuántas calorías consumí?"
- ✔ Responde "¿qué identidad empieza a construirse con la evidencia de
  este mes?"

---

## Principios

1. **Nunca inventar conclusiones.** Toda afirmación debe poder demostrarse
   con datos. Si no hay evidencia suficiente, no se muestra. Nunca frases
   motivacionales falsas, nunca asumir emociones, personalidad ni
   causalidad.
2. **Mostrar evidencia.** Cada descubrimiento está respaldado por datos
   visibles. "No entrenaste suficiente" ✗ · "Entrenaste 18 de 31 días" ✓.
3. **Hablar de identidad emergente.** La identidad no se calcula: se
   construye mostrando qué acciones aparecieron constantemente. "No eres
   disciplinada" ✗ · "El movimiento apareció durante gran parte del mes" ✓.

---

## Estructura

### 1 · Hero — ¿En qué me estoy transformando?

- Título: **¿En qué me estoy transformando?**
- Subtítulo: "No es una meta. Es lo que tus acciones empezaron a
  construir."
- Debajo: la **constelación del signo**, revelada según la consistencia
  acumulada. Mostrar el **% realmente revelado** (p. ej. "Escorpio · 84%
  revelado").
- La constelación representa SOLO cuánto del signo ha sido descubierto. NO
  personalidad, NO astrología. Es un sistema de progreso visual.

### 2 · Así revelaste tu constelación

Lista de hábitos registrados con su conteo de días. Cada categoría ilumina
una parte distinta de la constelación; mientras más evidencia, mayor parte
se revela. Solo se listan las categorías con evidencia suficiente.

```
Movimiento   21 días
Sueño        19 días
Registro     25 días
Proteína     18 días
Energía      20 días
Agua         12 días
```

Las 6 dimensiones de presencia son: movimiento, sueño, registro de comida,
proteína, energía, agua. **El ciclo NO es una dimensión de presencia/hábito**
(es contexto derivado del inicio de período): no se cuenta como "días
registrados" ni cae en "Lo que aún no sabemos". Decisión de proyecto.

### 3 · Haz visible lo invisible

Sección principal: **identidad emergente** (en quién te conviertes). Solo
constancias POSITIVAS demostrables. Tiene más peso visual que las demás:
cada descubrimiento vive en una tarjeta con cuerpo, con una **estrella
encendida** en el color de su dimensión (la misma chispa del emblema, con
halo: "se encendió una parte del cielo") y la **evidencia SIEMPRE visible**
(barra + "20 de 32 días"). Ver la prueba ES la revelación, no se esconde
tras un tap. La frase serif (voz de coach) es la protagonista.

```
✦ MOVIMIENTO
El movimiento fue una de tus constantes.
████████████░░  20 de 32 días
```

Si no hay evidencia suficiente para un descubrimiento, no se muestra.
NO se incluye aquí ninguna "señal más silenciosa" / carencia: lo que faltó
lo cuentan "Lo que aún no sabemos" y "Tu evolución".

### 4 · Modal de evidencia (solo "Tus patrones")

Las constancias muestran su evidencia inline. **Tus patrones** (formas
temporales) sí abren, al tocar "Ver evidencia", un modal pequeño (nunca
texto largo) con los datos que respaldan la afirmación: conteo por día de
la semana ("18 / 31 días") o barras comparativas. La evidencia habla por sí
sola.

### 5 · Tus patrones

Solo patrones demostrables con los datos que existen (presencia por día de
la semana, noches con ≥ 7 h de sueño, entre semana vs. fin de semana).
NUNCA inventar correlaciones que requieran datos que no tenemos
(`daily_signals` no guarda hora del día). Si no hay datos suficientes, no
se muestra.

### 6 · Lo que aún no sabemos

No castiga, no juzga. Muestra qué dimensiones aún no tienen evidencia
suficiente.

```
Todavía no hay suficiente información para entender:
○ Agua   ○ Energía   ○ Proteína
Sigue registrando.
```

### 7 · Tu evolución — el cielo sembrado

La MISMA data de la sección 2 (días por dimensión), pero sentida como
**construcción**, no como número. Cada día registrado es un **punto de luz**;
el último, una **estrella-frontera** (la chispa del emblema); los días que aún
faltan, **puntos apagados** (cielo por sembrar, sin culpa). Sin números (los
tiene la sección 2): aquí es pura sensación de algo que se acumula.

```
Movimiento  · · ✦ · · · ✧ · · ✦ · ✧        ∘ ∘ ∘
Sueño       · ✦ · · ✧ · · ✦ · · ✧          ∘ ∘ ∘ ∘
Registro    · · ✦ · · ✧ · · ✦ · · ✧ · ✦    ∘ ∘
Agua        ✦ · ✧ · ∘ ∘ ∘ ∘ ∘ ∘ ∘ ∘ ∘ ∘ ∘ ∘
```

Reglas de honestidad:

- **Denominador = días del mes transcurridos** (no `daysAppeared`, que inflaba
  todo al ~100%). Así los huecos son reales y las dimensiones diferencian.
- No barras de progreso redondeadas (se leen como dashboard/gamificación) y no
  rejilla tipo "contribution graph" (jitter vertical determinista la rompe).
- Label compacto ("Registro") para no truncar.

### 8 · Frase final

Una sola frase basada en evidencia. Ejemplos válidos:

- "La constancia apareció más veces que la perfección."
- "Lo que repetiste comenzó a definir este mes."
- "La evidencia empieza a contar una historia."

Nunca mostrar frases que no puedan sostenerse con datos.

---

## Reglas

No IA · no inventar patrones, correlaciones ni personalidad · no coaching ·
no juzgar · no dashboards tradicionales · no estadísticas porque sí. Todo
responde "¿qué significa este dato?", no "¿cuál es este dato?".

La usuaria debe terminar pensando: **"No sabía que eso estaba pasando."**

---

## Mapeo a la implementación

- **Lógica pura (sin IA):** `features/orbit/month-built.ts`.
  - `habitReveal(signals)` → secciones 2 y 7 (conteo de días por
    dimensión, ordenado).
  - `detectMonthPatterns(signals, { proteinTarget })` → secciones 3 y 5.
    Cada patrón lleva `kind` (`'discovery'` | `'pattern'`), `label`,
    `title` y `evidence` (barras + caption). Las `discovery` alimentan
    "Haz visible lo invisible"; las `pattern`, "Tus patrones".
  - `finalPhrase(signals)` → sección 8.
  - El umbral de evidencia mínima por dimensión vive en el componente
    (`MIN_EVIDENCE_DAYS`): por debajo, la dimensión cae en "Lo que aún no
    sabemos".
- **UI:** `features/orbit/components/MonthSegment.tsx`. Reutiliza el hero
  de constelación (`EmblemHero` + `RevealedEmblem`) y el modal de
  evidencia (`EvidenceModal`). Cada sección se oculta si no hay datos que
  la sostengan.
  </content>
  </invoke>
