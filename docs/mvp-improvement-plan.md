# Plan de mejoras · Auditoría 4 jul 2026

Origen: auditoría de congruencia (manifiesto v3.0 + specs) sobre capturas
reales del build actual, sesión de target-user (día 1-2 de una usuaria) y
benchmark contra Apple Fitness / YAZIO / MFP.

Diagnóstico en una línea: **el durante y el largo plazo están bien; lo que
falta es que el día 1 pague, que el día 2 tenga gancho, y que los números
nunca se contradigan entre pantallas.**

Regla transversal: todo copy nuevo pasa por `voice-and-copy` (sin emdashes,
sin voz LLM) y los cambios de estado calórico por `manifesto-reviewer`.

---

## Fase 0 · Confianza en los números (fixes de horas, antes de cualquier build)

La usuaria conectó tres números que no cuadran en una sola conclusión:
"ya no sé si creerle a ninguno, incluido mi déficit". Esta fase protege el
activo que "Así se calculan tus macros" ya construyó.

### 0.1 Pill "Aún en déficit" con 0 kcal

- **Qué:** el estado déficit/superávit solo existe con ≥1 comida registrada
  hoy. Antes: sin pill (o "Sin registros todavía", neutro).
- **Por qué:** con cero comidas afirma que no comer es estar bien. Roza la
  línea roja y es countdown-framing invertido (MFP con el signo cambiado).
- **Dónde:** `features/tabs/components/StatSlider.tsx:349-354`
  (`consumedCalories < tdee` sin guard de comidas).
- **Validación:** manifesto-reviewer.

### 0.2 Ventanas de datos contradictorias (7 vs 1)

- **Qué:** Progreso dice "Días registrados 0 → 7" (acumulado 60/30d de
  `daily_signals`) mientras Órbita Mes dice "Llevas 1 día registrado este
  mes". Unificar etiqueta ("en 30 días" explícito) o alinear ventana.
- **Dónde:** `features/progress/components/TuHistoria.tsx:131-133`.

### 0.3 Gate de Progreso por volumen de datos (principio Apple Trends)

- **Qué:** con <14 días de señales, "Tu historia" no muestra deltas
  (76→76 +0.0, "Proteína prom 2 g", dobles ceros). En su lugar, modo
  promesa: qué va a aparecer aquí y cuándo, más lo único vivo temprano
  (constelación creciendo, foto inicial).
- **Por qué:** una comparación absurda destruye la credibilidad de toda la
  superficie de datos. Apple no muestra Trends hasta tener historia.
- **Dónde:** `features/progress/components/TuHistoria.tsx` (gate en el
  mismo memo que arma las rows).

### 0.4 Umbral para "Tus aliados"

- **Qué:** una comida califica como aliado con evidencia mínima (p. ej.
  ≥3 registros o ≥15 g de proteína aportada). Antes: sección en estado de
  promesa. Nada de "+2 g · 1 vez" como "lo que más impulsa tu
  transformación".
- **Por qué:** copy grande sobre evidencia diminuta enseña a descontar la
  voz del coach.
- **Dónde:** `features/macros` (selector de aliados) + copy del header.

### 0.5 Ceros como identidad

- **Qué:** ocultar totales-cero. "0 días entrenados en total" gigante +
  botón "Compartir mi historia" se reemplaza por "Tu historia empieza con
  tu primer registro"; el share CTA se oculta hasta ≥1.
- **Dónde:** modal Tu historia (`features/progress/components/
MovementConstellation.tsx`, `TrainingShareCTA.tsx`).

### 0.6 Un solo idioma de calendario

- **Qué:** Órbita Mes empieza la semana en L; Tu historia empieza en D.
  Unificar a L en toda la app. Revisar también que las dos leyendas usen
  el mismo lenguaje visual (dot styles).
- **Dónde:** calendario de Tu historia (`features/progress/...`) vs
  `features/orbit/components/MonthGlanceCalendar.tsx` (referencia).

### 0.7 Default de comida por franja horaria real

- **Qué:** a las 4pm preselecciona Cena. Ajustar cortes a horario MX:
  desayuno <11, comida <17, cena <22, snack resto.
- **Dónde:** `features/tabs/components/QuickLogSheet.tsx:313-320`
  (`defaultMealType`, hoy `h < 16` corta la comida a las 4pm) y el mismo
  helper en `MealComposer.tsx:42` y `MomentsToday.tsx:16` (extraer a un
  helper compartido si están duplicados).

### 0.8 Piso de seguridad del déficit

- **Qué:** verificar que "Marcado (-750)" nunca produzca una meta bajo un
  piso seguro (~1,200 kcal); si el perfil es ligero, capar el slider o el
  resultado. Además el copy "bajas de grasa sin prisa" no aplica a
  Marcado: diferenciar la descripción por nivel.
- **Por qué:** línea roja (restricción extrema) + contradicción de tono
  que la usuaria notó ("¿Marcado no es justo el de prisa?").
- **Dónde:** motor de objetivos (`features/macros` / goal logic) + copy de
  la card en Ajusta tus objetivos.

### 0.9 Micro-copy

- "Sábado; 4 de julio" con punto y coma en Órbita Día (formato de fecha).
- "Lo de siempre" con una comida registrada 1 vez: umbral (≥2 usos) o
  renombrar la sección en frío ("Tus recientes").
- "Día muy bajo" en el calendario necesita explicación de una línea al
  tap (tono cuidado, no clínico, con derivación si es patrón repetido).

**Esfuerzo Fase 0:** 1-2 días. Todo es guard + copy + un helper.

---

## Fase 1 · El pago del día 1 (el "aha" del minuto 1)

### 1.1 Cualquier registro enciende la primera estrella

- **Qué:** hoy el copy dice "Tu primera estrella espera tu «Entrené»". La
  retention-mechanics-spec (Mecánica A) dice que cada registro enciende
  estrella. Alinear: agua, comida, ánimo, sueño y también "Descansé"
  encienden. El descanso es camino de primera clase, no el camino sin
  premio.
- **Por qué:** la primera recompensa debe costar segundos, no un
  entrenamiento en sábado. El sábado es justo el día que Stelar existe
  para rescatar.
- **Dónde:** `features/tabs/components/constellation/rendering/overlay/
center-number-overlay.tsx` (copy) + la lógica de encendido en
  `LunarConstellation` / streak.

### 1.2 Micro-ceremonia del primer registro

- **Qué:** al encender la primera estrella: glow en vivo sobre el emblema
  - haptic + una línea del coach en Cormorant ("Tu primera estrella. Así
    empieza un cielo."). Grande la primera vez, sereno después: no confetti
    por registro.
- **Por qué:** convierte "probé la app" en "la app me respondió". Es el
  momento-Apple del primer anillo cerrado.
- **Cómo:** reusar el lenguaje ceremonial existente de patrones
  (`features/patterns`) para que sea una sola familia visual. No es un
  sistema nuevo, es un momento.
- **Cuidado:** validar con reanimated-guardian (toca LunarConstellation,
  god file, y hay memoria de crashes de worklets en release).

**Esfuerzo Fase 1:** 1-2 días. El riesgo está en tocar la constelación.

---

## Fase 2 · El cierre del día (feature nueva, la que une tres gaps)

- **Qué:** un veredicto nocturno de una línea en Hoy (y/o Órbita Día):
  "Hoy comiste 1,400 de tus 1,546. Día en déficit: se enciende uno
  dorado." Y el equivalente sin culpa cuando no: "Hoy tu cuerpo pidió
  más. Mañana el cielo sigue aquí." Registrado el veredicto, el día se
  pinta en el calendario de Órbita Mes.
- **Por qué (3 gaps en 1):**
  1. Resuelve el pill de déficit de raíz: el déficit deja de ser semáforo
     intradía y se vuelve veredicto de cierre.
  2. Es el pago diario del calendario dorado, el gancho que la usuaria ya
     pidió con esas palabras exactas.
  3. Es el puente de las semanas 1-2 hasta que los patrones paguen.
- **Diseño:** aparece a partir de cierta hora (p. ej. 20:00) o al abrir la
  app al día siguiente para el día anterior. Nunca notificación de culpa.
  El "no déficit" jamás usa rojo ni resta nada.
- **Dónde:** nueva card/estado en Hoy (`features/tabs`), leyendo lo mismo
  que Órbita Día (`daily_signals` vía `_shared/intelligence`, NO lógica
  nueva en `month-built.ts`).
- **Validación:** manifesto-reviewer + voice-and-copy + target-user con el
  flujo día completo.

**Esfuerzo Fase 2:** 2-3 días (diseño del momento + estados + copy).

---

## Fase 3 · El gancho del día 2 (Mecánica D de retention-mechanics-spec)

- **Qué:** al cerrar la sesión del día 1 (o en el hero del día 2), la
  siguiente estrella visible sin encender, tenue e identificable, con
  copy de invitación: "Mañana, tu segunda estrella." Notificación opt-in
  como invitación, nunca como deuda ("tu cielo está acá cuando quieras").
- **Por qué:** open loop concreto (sabes qué te espera y qué lo
  desbloquea). Sin esto, el retorno del día 2 depende de la memoria de la
  usuaria; Apple/YAZIO/MFP jamás dependen de eso. La spec ya lo tiene
  diseñado y está marcado como faltante.
- **Qué NO:** trigger de racha ("no rompas tu cadena"). El bucle tira por
  deseo.
- **Dónde:** LunarConstellation (estrella siguiente insinuada) + sistema
  de notificaciones (nuevo, mínimo: una local programada).

**Esfuerzo Fase 3:** 2 días.

---

## Fase 4 · Anticipación honesta y pulido

### 4.1 Open loop en "Tus patrones"

- **Qué:** "Aún no emerge un patrón claro" se vuelve promesa con forma:
  "Con unas 2 semanas de registros, tus primeros patrones aparecen aquí"
  - 2-3 siluetas de ejemplo del tipo de descubrimiento ("qué días son
    distintos en tu rutina", "qué acompaña tus mejores días"). Umbral
    aproximado, sin countdown.
- **Dónde:** empty state de Tus patrones en Órbita Mes. Solo copy + arte
  (illustrator-specialist para las siluetas).

### 4.2 Emblema: evaluar estrellas contadas vs porcentaje

- **Qué:** "1% revelado" hace el viaje sentirse infinito en el primer
  tramo. Evaluar "1 estrella encendida" como label temprano (colección,
  suena a comienzo) y pasar a % cuando haya tracción. Decisión de dueña,
  no urgente.

### 4.3 Estados vacíos que abren loops distintos

- **Qué:** hoy seis superficies repiten "aún no hay nada". Cada empty
  state debe pedir UNA acción distinta o abrir una promesa distinta
  (Órbita Día ya lo hace bien con las pills: usar ese patrón como
  referencia).

**Esfuerzo Fase 4:** 1-2 días.

---

## Validación final (antes del build de beta)

1. `manifesto-reviewer` sobre todo el diff de Fases 0-2.
2. `voice-and-copy` sobre cada string nuevo.
3. Re-run de `target-user` con el flujo completo día 1 → cierre del día →
   día 2, dándole los datos exactos del perfil (edad, peso) para evitar
   falsos positivos.
4. `/pre-beta-check` antes del `eas build`.

## Orden y dependencias

```
Fase 0 (1-2d)  → independiente, primero siempre
Fase 1 (1-2d)  → independiente de 0
Fase 2 (2-3d)  → depende de 0.1 (el pill muere cuando nace el cierre)
Fase 3 (2d)    → depende de 1 (la estrella siguiente asume encendido por registro)
Fase 4 (1-2d)  → independiente, se puede intercalar
```

Total estimado: 7-11 días de trabajo enfocado. Fases 0+1 solas ya dejan
un build de beta defendible; 2 y 3 son las que deciden la retención D2-D7
de las 4 usuarias.

---

# Parte 2 · Órbita (auditoría 4 jul 2026, tarde)

Origen: segunda ronda con capturas reales de Órbita (Día/Semana/Mes, día 2
de usuaria) — target-user + product-benchmark + uxui-specialist. Los tres
convergieron sin leerse entre sí en los mismos 4 puntos: la contradicción
de Semana en día 2, el tap del día que no paga, el "1%" que desmotiva, y
el desierto de promesas de las semanas 1-3.

Diagnóstico en una línea: **la arquitectura D/S/M está validada (Apple en
tres capas, mejorada con preguntas), pero le faltan las 2 condiciones que
hacen REGRESAR: la respuesta del tab nunca puede ser "nada todavía", y la
semana necesita sellarse (la cita del lunes).**

Estado de Fases 0-4: COMPLETADAS (más Términos + disclaimer +
runtimeVersion + StreakLine alineado + acento de "Tu Órbita" corregido).

---

## Fase 5 · Fixes de confianza del día 2 en Órbita (horas)

Los "números fantasma" de Órbita: juicios retroactivos y taps vacíos que
enseñan a desconfiar del tab justo en la ventana frágil.

### 5.1 Frame de Semana gateado por edad de cuenta

- **Qué:** "Tu semana está por terminar / 1 día por delante" en el día 2
  de uso dice "ya perdiste esta semana antes de empezar". En la primera
  semana de uso: "Tu primera semana empieza donde estés. Cada día que
  registres deja huella." Sin conteo de días restantes. Y nunca convivir
  "todavía se está escribiendo" con "está por terminar" (contradicción).
- **Dónde:** `features/orbit/components/WeekProgressHero.tsx:25-30`
  (frameLine solo mira weekday, no antigüedad de datos).

### 5.2 Denominadores sin días pre-instalación

- **Qué:** "2 de 6 días" cuenta lunes-jueves cuando la app no existía en
  su vida: 4 fallas retroactivas. Primera semana: ventana desde
  `max(lunes, primer día con señal)`, o conteo puro sin denominador
  ("Apareció 2 días"); los días pre-registro se pintan como el futuro
  (aún-no), no como ausencia.
- **Dónde:** `features/orbit/components/WeekSegment.tsx` (card de
  planeta), silueta y sus conteos.

### 5.3 Guard del "Muy bajo" en el arranque

- **Qué:** el día de instalación (registro parcial vespertino) no debe
  clasificar "low" ni disparar su nota: falso positivo de arranque.
  Exigir ≥2 comidas registradas ese día antes de inferir "muy poco", o
  excluir el primer día con señal de la clasificación low.
- **Dónde:** clasificación de día en `features/orbit/month-built.ts`
  (usa `isDeficitDay`; el guard va en el sitio de clasificación del
  calendario, NO en `deficit.ts` que comparten Día/Semana/Mes — evaluar
  con cuidado para no divergir la definición).

### 5.4 Tap del día con evidencia inline

- **Qué:** el panel del día tocado entrega "Registro" (la etiqueta más
  vaga) + link. Debe pagar en sitio: qué señales hubo + estado del día
  ("Miércoles · Comida ✦ Sueño ✦ · déficit suave") y ENTONCES el link.
  Si el día solo tiene una señal genérica, saltar el panel y abrir Día
  directo. Un nivel inline + un nivel de navegación (regla YAZIO).
- **Dónde:** `WeekSegment.tsx:602-610` (TAG_COLOR "Registro") + el panel
  del tap.

### 5.5 Micro-fixes

- Leyenda del calendario de Mes oculta hasta ≥5 días registrados (mismo
  umbral que el %): no enseñar gramática de 4 estados con 1 punto.
- Pills de Día vacío con eyebrow ancla ("Empieza por aquí").
- "Reintentar" de Día como Pressable pill de 44pt
  (`DayPresent.tsx:700-708`, hoy es Text con onPress).
- "El oro son tus días en déficit" se enseña 3 veces: en Mes basta la
  leyenda; en Semana se queda el caption (primera vez que se ve oro).

**Esfuerzo Fase 5:** 1 día.

---

## Fase 6 · La lectura garantizada n=2 (mata el desierto de las semanas 1-3)

- **Qué:** regla de producto nueva: **la respuesta a la pregunta del tab
  nunca es "nada todavía"; es "esto es lo poco que ya se ve"**.
  Micro-observaciones deterministas que funcionan desde el día 2, contra
  ayer o contra el primer día: "Dos días seguidos con sueño registrado:
  eso ya es una señal." / "Hoy tu proteína apareció antes que ayer."
- **Reglas duras:** (a) solo de datos reales de ella — sin relleno tipo
  horóscopo; si no hay nada honesto que decir, promesa honesta; (b) tono
  neutro o a favor, NUNCA comparación en clave de caída ("hoy menos que
  ayer" ✗); (c) deterministas, viven en
  `supabase/functions/_shared/intelligence/` (NUNCA en month-built.ts).
- **Dónde aparecen:** el vacío de Día (además del puente "ayer quedaste
  así" que pidió la usuaria) y la respuesta mínima de Semana.
- **Horizonte en promesas (GAP 5 del benchmark):** las siluetas y "ALGO
  POR DESCUBRIR" nombran el descubrimiento MÁS CERCANO y qué lo revela
  ("los patrones aparecen cuando algo se repite unas 3 veces; el primero
  que suele verse: tu ritmo de sueño"). Ventana que se abre con el uso,
  jamás cuota con fecha.
- **Validación:** manifesto-reviewer + voice-and-copy (copy de retención,
  zona sensible).

**Esfuerzo Fase 6:** 1-2 días.

---

## Fase 7 · El sello de semana (la cita del lunes)

- **Qué:** la semana se SELLA. Lunes por la mañana, Semana abre con el
  artefacto de la semana pasada: silueta final de los 7 días + UNA
  observación ("La comida apareció 5 de 7 días; tu día más encendido fue
  el jueves") + el puente ("Una semana nueva se abre"). La semana se
  sella con lo que hubo, siempre — sin "lo lograste / no lo lograste".
- **Por qué:** de las 4 condiciones de regreso semanal (cita con novedad,
  titular, identidad, artefacto), Órbita cumple 2. Esta fase agrega la
  cita y el artefacto. Es la razón estructural de volver cada lunes.
- **Dirección vs semana pasada (GAP 4):** subir de prioridad el hero de
  la spec v2.2 (`risingSignal` → Subiendo / Sostenido / Más suave). Es el
  insight más barato y temprano; "Más suave" con la misma temperatura
  visual que "Subiendo", nunca alarma.
- **Notificación:** invitación opt-in del lunes ("Tu semana quedó
  escrita, cuando quieras verla") reusando `features/notifications/`
  (scheduler ya construido en Fase 3); un solo slot, jamás deuda.
- **No choca con el cierre del día** (Hoy, 20:00): ese sella el DÍA;
  este sella la SEMANA en Órbita. Alturas distintas.
- **Validación:** behavioral-specialist (mecánica) → manifesto-reviewer →
  voice-and-copy, como manda retention-mechanics-spec.

**Esfuerzo Fase 7:** 2 días. Depende de 5.1/5.2 (el sello asume ventana
honesta).

---

## Fase 8 · El frame del emblema (resuelve el 4.2 pendiente)

- **Qué:** "Acuario 1% REVELADO" en día 2 es honesto pero dice "esto es
  una montaña". Bajo un umbral (p. ej. <8%): cualitativo ("Empezando a
  revelarse" / "Tus primeras luces ya están encendidas") en vez del
  número; el % aparece cuando ya cuenta una historia (misma regla que el
  calendario con ≥5 días). Además: hacer visible qué lo hace subir (la
  usuaria no lo sabe) y "lo que enciendes no se apaga" explícito.
- **Qué NO:** "te faltan 99" ni restante-para-completar (countdown
  invertido). No acelerar el reveal: se ajusta el FRAME, no la
  honestidad.
- **Dónde:** hero de Mes (`MonthSegment.tsx`), label del emblema.
- **Validación:** voice-and-copy.

**Esfuerzo Fase 8:** medio día.

---

## Fase 9 · Pulido Apple (navegación y consistencia)

### 9.1 Back con memoria de segmento

- Calendario de Mes → "abrir en Día" → "‹ Volver" debe regresar a MES,
  no a Día-hoy. Igual desde la silueta de Semana. Opción A: recordar
  segmento de origen en `orbit.tsx` (plumbing pequeño). Opción B (más
  Apple): día pasado como push de stack y el back del sistema resuelve.

### 9.2 Un solo título grande por vista

- Hoy compiten "Tu Órbita" (36pt) + pregunta (30pt) + frames serif. La
  pregunta debería ser el único título grande y "Tu Órbita" encogerse al
  hacer scroll (patrón large-title de iOS), o la pregunta demoverse a
  subtítulo. Elegir UN nivel. Además la pregunta se adapta al estado:
  primera semana → "Tu semana empieza a escribirse" (no prometer
  descubrimientos que aún no puede cumplir).

### 9.3 Tint fijo de navegación

- Los links de Semana cambian de color con el arquetipo
  (`WeekSegment.tsx:151`). Acento dinámico solo decorativo; links de
  navegación siempre en UN color fijo en todo el tab.

### 9.4 Estados de carga y error en Semana y Mes

- Semana cargando = pantalla en blanco y sin rama de error
  (`WeekSegment.tsx:153-155`). Replicar el par "Mirando tu día…" +
  Reintentar de `DayPresent.tsx:682-712`.

### 9.5 La galaxia semanal, on demand

- Dos gramáticas interactivas maestras en una vista (silueta + galaxia),
  cada una con su hint. Jerarquizar: galaxia colapsada a resumen con
  "Ver el cielo semanal", o diferida hasta ≥2 dimensiones con ≥3 días.

### 9.6 Mes en 2 beats durante la primera semana

- Cuatro promesas de "aún se forma" apiladas = pasillo de puertas
  cerradas. Primera semana: emblema (con Fase 8) + UNA tarjeta "Lo que
  verás aquí" que fusione las promesas (las siluetas de patrones como
  base). Las secciones aparecen cuando se ganan su contenido.

**Esfuerzo Fase 9:** 2-3 días.

---

## Orden y dependencias (Parte 2)

```
Fase 5 (1d)     → primero: protege la confianza del día 2
Fase 6 (1-2d)   → independiente de 5; el mayor impacto de retención
Fase 7 (2d)     → depende de 5.1/5.2; reusa scheduler de Fase 3
Fase 8 (0.5d)   → independiente; cierra el 4.2 pendiente
Fase 9 (2-3d)   → independiente; intercalable
```

Total Parte 2: 6-9 días. Para el build de las betas del 27 jul, el corte
recomendado es Fases 5+6+8 (protegen día 2 y semanas 1-3); 7 y 9 pueden
llegar en el primer update OTA.

Ganchos declarados por la usuaria a proteger en todo cambio: el
calendario dorado, la silueta "qué combinación te sostiene en déficit"
("lo abriría cada domingo"), y "Tu presencia" ("volver sin drama").

---

# Parte 3 · Sistema de coherencia visual (auditoría 5 jul 2026)

Origen: barrido técnico del repo + product-benchmark ("cómo lo hace Apple").

La lección Apple: su consistencia NO es disciplina, es diseño de API — el
camino fácil ES el camino consistente. Cuatro piezas: roles semánticos (no
hex sueltos), type ramp congelada (eliges un rol, no un tamaño), UNA
familia de iconos emparejada al texto, y lint que hace imposible regresar.

## Estado real del repo (barrido 5 jul)

- **Fuentes: 100% tokenizadas.** Cero `fontFamily` con string directo. ✓
- **Colores:** 477 hex sueltos fuera de theme/, PERO la gran mayoría son
  ESCENAS DE ARTE (atmósferas de onboarding, Cosmos, MonthSky, Skia,
  gradientes de constelación) donde el hex es pintura, no UI — exentas.
  Fugas reales del sistema: duplicados literales de tokens
  (MovementConstellation y PatternReveal redefinían MAGENTA/GOLD como hex
  → CORREGIDO: ahora alias de tokens) y el naranja de entreno #FF9E57
  copiado en Semana/Mes sin token → CORREGIDO: `colors.signal.entreno`.
- **Tipografía:** la ramp existe (18 escalones, con duplicados: deltaNum
  = tilePlus = 28; micro 11 vs caption 11.5). 272 `fontSize:` numéricos
  fuera de la ramp (top: MonthSegment 20, WeekSegment 18,
  DayDetailContent 15).
- **Iconos: la regla de tres niveles YA CASI se cumple:**
  1. `assets/icons/` line-art currentColor = familia canónica de producto
     (huecos: north-star no tintable; water-tint creado el 4 jul).
  2. Feather = chrome utilitario (14 archivos, solo verbos de interfaz:
     chevron-left ×5, x ×2, camera, arrow-right) — legítimo. Regla:
     Feather NUNCA representa un concepto de producto.
  3. "vect" con fills horneados = ILUSTRACIONES, no iconos: prohibido
     usarlas a tamaño icono o esperar que tinten.
  - Glifos unicode: ✦ es voz de marca (se queda); › ‹ ✓ ↑ como iconos en
    Text (~26 sitios) renderizan distinto iOS/Android → migración gradual.
  - Inconsistencia real de navegación: TRES lenguajes de back (Feather ‹,
    "‹ ATRÁS" eyebrow de wizard, "‹ Volver a...").

## Fases

### C0 · Inventario con tabla de decisión (1 sesión, sin tocar código)

Clasificar los hex de features/ en 3 cubetas: (a) token existe → migración
mecánica; (b) token falta → candidato a theme/ con justificación; (c)
exento (arte). Lo mismo con los fontSize → rol más cercano. La lista de
exentos queda ESCRITA (alimenta el lint de C3). Sin la tabla, cada PR se
vuelve juicio caso por caso.

### C1 · Consolidar el contrato

- `theme/colors.ts`: header que declare la paleta CERRADA ("hex nuevo =
  token nuevo + justificación") + documentar el mapeo de roles (leche =
  texto primario, bone = secundario, niebla = muted, bruma = disabled,
  hairline = separador, magenta = acción/acento, oro = ceremonial) +
  eliminar los alias legacy Pearl Mauve (migrar usos restantes; una
  paleta cerrada con puerta trasera deprecated no está cerrada).
- `theme/typography.ts`: fusionar duplicados de la ramp y crear
  `theme/text-styles.ts` con ~10 roles COMPUESTOS (familia + tamaño +
  tracking + lineHeight juntos, estilo Apple): coachLine (la única
  italic), heroNumber, statNumber, screenTitle, sectionTitle, cardTitle,
  body, label, overline, caption. Obligatorio en código nuevo,
  incremental en el viejo.
- Iconos: barrel `components/ui/icons/` con la familia custom + un
  `Chrome` que re-exporta SOLO el subconjunto Feather sancionado
  (chevron-left/right, x, camera, eye). La regla de tres niveles
  documentada ahí mismo. Encargar la estrella line-art tintable (el
  hueco que queda en Tu camino).

### C2 · Migrar por SUPERFICIE, no por tipo de archivo

Orden por exposición: Hoy → Comidas → Órbita → Ajustes/auth → onboarding
(Progreso congelado, al final). Por superficie: hex→token, fontSize→rol,
glifo funcional→icono, y unificar el back a UN lenguaje (el patrón de
Agua: chevron icónico + título). PRs chicos con screenshot antes/después
(ojo al caché de bundle de Expo Go al comparar).

### C3 · Guardrail de lint (el paso Apple de verdad)

- ESLint `no-restricted-syntax`: prohíbe `#hex`/`rgba(` y `fontSize:`
  numérico fuera de theme/\*_, con la lista de exentos de C0 explícita en
  overrides (skia-_, _Sky_, Cosmos, ZodiacArt, …).
- `no-restricted-imports` para @expo/vector-icons salvo el wrapper de
  iconos: un Feather nuevo se agrega al subconjunto sancionado y se ve en
  el diff.
- warn → error por carpeta, solo cuando su superficie ya migró.

## Qué NO perseguir (variedad intencional)

Escenas de arte Skia/SVG (el hex es pintura; solo centralizar la paleta
en un const local por legibilidad), ilustraciones vect y arte de
onboarding, share cards de Progreso (congelado), el rename semántico
completo (leche→text.primary: costo/beneficio malo en MVP; el mapeo
documentado compra el 90%), purga total de unicode (✦ es marca), Dynamic
Type y light mode (fuera de alcance; light requiere permiso de dueña).

## Secuencia con el MVP

C0+C1 caben ANTES del build de las betas (baratas, frenan la deuda
nueva). C2 completa y C3-error pueden ir después de validar: no bloquear
el loop core por esto.

Hecho ya (5 jul): dedupe de literales (MovementConstellation,
PatternReveal → alias de tokens), `signal.entreno` tokenizado y sus 4
usos migrados, `water-tint.svg` (4 jul).

---

# Parte 4 · Plan de mercado (5 jul 2026) — bajo el marco "haz visible lo invisible"

Origen: pregunta de dueña ("¿qué le falta a Stelar para tomarse en serio y
competir?") + corrección de marco de dueña: Stelar NO es app de tracking;
no compite en la guerra de bases de datos (ahí MFP gana por diseño y
ganarla sería construir "MFP con tema oscuro", prohibido por manifiesto).

**El principio que gobierna este plan:** lo que Órbita hace visible tiene
que ser VERDAD. La evidencia se calcula desde lo registrado, así que la
pregunta de mercado no es "¿trackeamos mejor?" sino "¿qué calidad de input
necesita nuestra inferencia?". Respuesta: CONSISTENCIA sobre precisión.
Los patrones sobreviven al error sistemático (si siempre subestima 15%,
el patrón relativo sigue siendo cierto); los mata el día faltante — y la
completitud es un problema de RETENCIÓN (resuelto en Partes 1-2).

## Descartado a propósito

- **Barcode + base de datos de alimentos**: la mejora del juego viejo.
  Cal AI validó que el mercado no la exige (ganó sin base de datos, con
  foto + IA, quitando la fricción que la base impone). No construir.

## Las líneas, en orden

### M1 · Scan excepcional (la única puerta de entrada de comida)

Hoy: gpt-4o-mini estima sin loop de corrección. Objetivo: porciones
editables post-scan; corrección de un tap ("¿le atiné?") que además
entrena la consistencia de la usuaria; manejo de confianza explícito
(cuando la IA duda, lo dice — honestidad de evidencia, nunca fingir
precisión). Es la forma Cal AI del rigor, no la forma MFP.

### M2 · TDEE adaptativo (lo invisible #1 hecho visible)

El gasto real del cuerpo, despejado de sus propios datos por balance
energético: TDEE real = kcal promedio comidas + (Δkg suavizado × 7700 /
días), re-estimado semanal con ventana rodante. Por qué es LA feature:
(a) responde el "¿esto está funcionando?" textual de la usuaria (peso
plano + 19 entrenos = tu gasto real es menor; ajustamos tu meta) con
matemática honesta, sin culpa; (b) captura la adaptación metabólica que
causa los estancamientos que hacen abandonar; (c) es ROBUSTO al estilo de
registro (un sesgo consistente se absorbe en la calibración — por eso no
necesita barcode); (d) es el sello de seriedad (MacroFactor) que nadie
hace en español. Guardas: mínimo de datos antes de re-estimar, jamás
bajo MIN_CALORIES, comunicado como observación ("tu cuerpo gasta ~1,900
según tus últimas 4 semanas"), nunca sentencia. Función pura + tests,
sobre daily_signals + pesajes suavizados que ya existen.

### M3 · La Voz real + Lecturas (Fase B)

Anthropic en las Lecturas (Diaria/Semanal/Mensual) reemplazando el mock;
los patrones profundos server-side en \_shared/intelligence. Es el
producto en sí; va DESPUÉS de M2 (la Lectura más valiosa cita el gasto
real).

### M4 · Apple Health, solo peso (lectura)

La báscula sincronizada = pesajes frecuentes sin ritual = mejor input
para M2. No es tracking: es quitar fricción a lo invisible. (La
integración completa de wearables sigue siendo premium futuro, plan
aparte.)

### M5 · Plomería sin bando

Sentry (crash reporting: hoy un crash en producción es invisible),
RevenueCat + paywall (sin precio no hay negocio; el paywall sube la
percepción de valor), presencia de App Store (screenshots que venden el
diferenciador, ASO es-MX, página de soporte).

### M6 · Posicionamiento anti-horóscopo

Riesgo real: signo zodiacal como portada → el shopper de 3 segundos la
clasifica con Co-Star, no con las apps de peso. El posicionamiento
público abre con el rigor (déficit, patrones, tus datos) y revela la
capa celeste como recompensa, no como portada. Marketing, no producto —
pero mal jugado invalida el resto.

## Secuencia

1. M1 scan + M4 Health-peso + Sentry (4-6 semanas).
2. Después: M2 TDEE adaptativo → M5 cobro → M3 Voz real.
3. En paralelo (barato): M6 posicionamiento.

(El dato "retengo X% a D7 sin rachas ni culpa" que salga de la validación
con las betas sigue siendo el argumento de mercado más fuerte; la
secuencia de arriba no depende de esperarla.)

La tesis en una línea: Stelar no necesita trackear mejor que MFP —
necesita que lo poquito que trackea sea suficientemente consistente para
que lo invisible que revela sea verdad. Consistencia = retención (hecha),
robustez = TDEE adaptativo, puerta de entrada = scan excelente.
