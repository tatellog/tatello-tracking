# Órbita por madurez de datos · Spec

> Estado: propuesta (26 sep 2026, rama `orbita-patrones`). Decisión de
> dirección de la dueña: "en una semana no tendré patrones, pero en un mes sí,
> en 3 meses algo diferente, y así; quiero cubrir todos los edge cases".
> Complementa `docs/orbita-pattern-memory-spec.md` (memoria de patrones) y
> `docs/revelations-system-spec.md` (momentos full-screen).

## La idea en una frase

Órbita responde **"¿qué descubrió Stelar de mí?"**, y lo que puede responder
honestamente depende de **cuántos datos tiene**, no del calendario. Cada etapa
promete solo lo que sus datos sostienen, y siempre hay algo que mostrar.

## Principios

1. **Se mide en días con datos, no en días desde el registro.** Una usuaria que
   volvió tras un mes fuera no está en "mes 3".
2. **Cada dimensión madura por separado.** Con reloj y sin comidas, los
   patrones de sueño y movimiento maduran; los de déficit no.
3. **Nunca fingir.** Sin evidencia suficiente, se dice lo que falta. Sin
   sorpresa, se dice "este mes tus días se parecieron entre sí".
4. **Sorpresa sobre frecuencia.** El protagonista es lo que ella no sabía, no
   lo que más se repite ("entrenar coincide con déficit" ya lo sabe).
5. **La IA solo explica.** El motor detecta; la IA pone en palabras hechos que
   ya existen. Sin hallazgo confirmado, no hay chat (no hay qué explicar).
6. **Lo descubierto no retrocede.** Un patrón que se desvanece pasa a tu
   Historia; no se borra (memoria `immutable-vs-recalculable`).

## Las etapas

`D` = días con datos útiles en la ventana. "Útil" depende de la dimensión:
comida = día completo (modelo de día parcial, `day-quality.ts`); sueño = noche
registrada o del reloj; movimiento = entreno o pasos.

| Etapa                | Umbral     | Pregunta que responde        | Qué muestra                                                                              | IA                    |
| -------------------- | ---------- | ---------------------------- | ---------------------------------------------------------------------------------------- | --------------------- |
| 0 · Llegando         | D < 3      | "¿Qué va a pasar aquí?"      | Hoy + lo que Stelar podrá encontrar, sin contar días                                     | No                    |
| 1 · Primeras señales | D 3 a 7    | "¿Qué se ve de mis días?"    | Observaciones **descriptivas** de sus propios días (nunca correlaciones)                 | No                    |
| 2 · Señal naciente   | D 8 a 20   | "¿Qué empieza a repetirse?"  | Correlaciones con muestra chica, marcadas como tentativas                                | No                    |
| 3 · Tu mes           | D 21 a 59  | "¿Qué no sabía de mí?"       | Hallazgo sorpresa + patrones confirmados + palanca de la semana                          | Sí, sobre el hallazgo |
| 4 · Tus temporadas   | D 60 a 179 | "¿Qué cambió en mí?"         | Mes contra mes, patrones que se sostienen (Ancla) o se desvanecen, lo que ayuda a volver | Sí                    |
| 5 · Tu historia      | D ≥ 180    | "¿Quién me estoy volviendo?" | Estacionalidad, recaídas y regresos, Alma Celeste                                        | Sí                    |

### 0 · Llegando (D < 3)

- Anillos de hoy (compactos) y veredicto.
- "Todavía te estoy conociendo. Un patrón aparece cuando algo se repite en tus
  días." + qué podrá encontrar (siluetas, sin conteo de días).
- Nunca "llevas N días"; nunca countdown.

### 1 · Primeras señales (D 3 a 7)

- Motor: `early-readings.ts` (ya existe). Solo **describe**: "Tu noche más larga
  fue el martes: 8 h 10." "Tus comidas con más proteína fueron las cenas."
- Etiqueta: "Primera señal". Nunca "patrón", nunca causa ni correlación.
- Una a la vez, rota por día.

### 2 · Señal naciente (D 8 a 20)

- Motores: `month-built` (mínimo 8 días con comida) y `findings` (10 a 12 filas)
  con `emerging = true` cuando la muestra es chica.
- Etiqueta: "Empieza a asomar". Copy tentativo: "Parece que…", "Lo sigo
  mirando".
- Guarda de ambos lados: toda comparación exige ≥ 3 días en cada lado (el bug
  del "100% de tu superávit" era un lado vacío).

### 3 · Tu mes (D 21 a 59)

- **Protagonista: "Lo que no sabías de tu mes"**, elegido por el ranker de
  sorpresa (ver abajo). Uno solo.
- Debajo: "Lo que te sostiene" (el combo, con "Ver la revelación") y "También
  encontré" (lista ligera).
- "✦ Quiero entenderlo" sobre el protagonista: apertura fija con el hallazgo y
  sus números, 2 o 3 preguntas generadas por IA sobre el **paquete de hechos**,
  metacognición fija, cierre fijo con el foco de la semana.
- Candidatos a sorpresa (detectores, todos en `_shared/intelligence/`):
  - **Efecto de un día al siguiente:** noche corta (< 6 h) → calorías del día
    siguiente. _Nuevo._
  - **Día de la semana que se rompe** (`findings.weekday-calories`,
    `month-built.deficit-daytype`). Existe.
  - **Proteína en días con y sin entreno.** _Nuevo._
  - **Pasos contra déficit.** _Nuevo_ (hoy solo `stepsRhythm` descriptivo).
  - **Rescate tras un día alto** (`findings.rescue`). Existe, sin superficie.
  - **Cena contra resto del día** (`night-eating`). Existe; pasa por
    `manifesto-reviewer` antes de salir (terreno sensible).

### 4 · Tus temporadas (D 60 a 179)

- "Este mes contra el anterior": qué cambió en su conducta (solo contra ella
  misma, nunca contra otras).
- **Ancla:** un patrón que se sostuvo 3 meses. **Pausa:** lo que la ayuda a
  volver tras una semana difícil. **Señal naciente:** lo nuevo de este mes.
  (Vocabulario de Reliquias del PRD V2.)
- Patrones que se desvanecieron pasan a Historia con su fecha.
- Peso: solo como tendencia y solo en Progreso ("tus semanas en déficit
  coinciden con tu tendencia a la baja"), nunca el número diario en Órbita.

### 5 · Tu historia (D ≥ 180)

- Estacionalidad (diciembre, vacaciones), recaídas y regresos ("después de tus
  semanas difíciles, sueles volver en 5 días").
- Alma Celeste: la evolución de largo plazo.

## El ranker de sorpresa

Puro, en `_shared/intelligence/`. Recibe todos los hallazgos candidatos de la
ventana y devuelve **un** protagonista y hasta dos secundarios.

`puntaje = efecto × evidencia × novedad`

- **Efecto:** tamaño normalizado (380 kcal pesa más que 40; 25 puntos de tasa
  pesan más que 8).
- **Evidencia:** muestra de cada lado; se castiga el lado chico.
- **Novedad:**
  - Se castiga lo **esperado** (lista explícita: entrenar ↔ déficit, dormir ↔
    déficit, proteína alta ↔ déficit).
  - Se premian los efectos **con retraso** (ayer → hoy) y los que contradicen una
    creencia común ("no es el fin de semana, es el jueves").
  - Se castiga lo **ya mostrado** como protagonista (tabla `revelations`).
- **Deduplicación:** cuatro detectores dicen "tu fin de semana es distinto";
  gana uno (`deficit-daytype` > `surplus-concentration` > `weekday-calories` >
  `weekend-food`).
- Sin candidato que supere el umbral: "Este mes tus días se parecieron entre sí;
  no encontré algo nuevo." Nunca se fuerza.

## Edge cases

| Caso                                          | Qué pasa                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Solo reloj, sin comidas**                   | Maduran sueño y movimiento; los patrones de déficit quedan bloqueados con una razón clara: "Para ver qué mueve tu déficit necesito tus comidas." |
| **Solo comidas, sin reloj**                   | Patrones de déficit, día de la semana, proteína. Sueño y pasos no aparecen (sin datos, no se mencionan).                                         |
| **Comidas en pocos días** (< 50% de los días) | Solo cuentan los días completos (`day-quality.ts`); el copy dice "con tus días completos".                                                       |
| **Días parciales**                            | Excluidos del déficit y del TDEE (decisión Fase 3).                                                                                              |
| **Regreso tras 2+ semanas fuera**             | No se compara con datos viejos; se muestra el momento de Regreso (revelations T2) y se reanuda la etapa.                                         |
| **Días muy parecidos** (poca varianza)        | "Este mes tus días se parecieron entre sí." Sin hallazgo forzado.                                                                                |
| **Un lado de la comparación vacío**           | Ninguna comparación se publica sin ≥ 3 días por lado.                                                                                            |
| **Cambio de meta o de enfoque**               | El déficit de cada día se mide contra la meta vigente ese día (pendiente: hoy usa la meta actual para toda la ventana).                          |
| **Ingesta muy baja sostenida**                | Nunca se celebra ni se vuelve patrón positivo; si se sostiene, derivar a profesional (línea roja del manifiesto).                                |
| **Ciclo**                                     | Contexto de la báscula, nunca patrón ni hábito.                                                                                                  |
| **Sync del reloj atrasado**                   | Lo que llega tarde completa días pasados; los hallazgos se recalculan (son recalculables), lo descubierto no retrocede.                          |
| **Hallazgo que se desvanece**                 | Pasa a Historia con su fecha (memoria de patrones), no se borra.                                                                                 |
| **Muestra chica con porcentaje extremo**      | Sin porcentajes en títulos con muestra chica; los números viven en las barras.                                                                   |

## Qué ya existe y qué falta

**Existe:** `early-readings` (etapa 1), `month-built` y `findings` con
`emerging` (etapa 2), combo y palanca semanal, `revelations` (novedad y
Regreso), memoria de patrones, `day-quality.ts`, chat guiado con backstops.

**Falta:**

1. `dataMaturity()` puro: días útiles por dimensión y etapa resultante.
2. Tres detectores nuevos: noche corta → día siguiente, proteína con y sin
   entreno, pasos contra déficit.
3. El ranker de sorpresa con deduplicación y memoria de lo ya mostrado.
4. La superficie por etapa en el feed de Órbita.
5. ~~El chat con paquete de hechos~~ **construido (26 sep 2026) sobre el patrón
   dominante**: `combo-facts.ts` (hechos, apertura, foco, semana, día tocado),
   rama `orbita_combo_chat` del edge `stelar-insight` (v13: chips atados a un
   hecho + respuesta con SU hecho; backstops de temas no medidos, causalidad y
   números), `ComboChatView` y memoria en AsyncStorage (`combo-transcript.ts`).
   Falta moverlo al protagonista cuando exista el ranker.
6. Meta vigente por día para el déficit histórico.

## Orden de construcción

1. `dataMaturity()` + superficie por etapa con lo que ya existe (etapas 0 a 2).
2. Detectores nuevos + ranker de sorpresa (etapa 3).
3. Chat con paquete de hechos sobre el protagonista.
4. Mes contra mes y Anclas (etapa 4).
5. Historia de largo plazo (etapa 5).

Validación: cuenta de dev con datos de prueba por etapa (7, 15, 30, 90 días),
generados con un script de semilla con correlaciones plantadas y conocidas.
