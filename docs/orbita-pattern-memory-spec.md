# Spec · Memoria de patrones (Órbita → Historia)

Estado: **propuesta / diseño**. No construido. Deriva del manifiesto v3.0 y del
PRD V2. Autoría: jul 2026, a raíz de la pregunta de la dueña "¿por cuánto tiempo
veré este patrón y se guardará en mi historia?".

Specs hermanas: `docs/revelations-system-spec.md` (el sistema donde vive),
`docs/orbita-mes-spec.md` (de dónde nacen los patrones), `docs/PRD-v2.md`
(Reliquias, Alma Celeste). Regla dura heredada: `features/patterns/CLAUDE.md`
(**prohibido contar frecuencia** de un patrón).

---

## 1. El problema

Órbita Mes lee una **ventana rodante de ~31 días** (los patrones profundos, hasta
90). Cada día que pasa, la ventana rueda:

- **El veredicto de déficit** ("12 de 24 días") es permanente: siempre está, sus
  números ruedan. No es un patrón, es el norte.
- **Los patrones** (el rescate "moverte sostiene tu déficit", el día que rompe,
  la señal naciente) son **efímeros**: aparecen cuando el dato los sostiene y
  **desaparecen** sin dejar rastro cuando la ventana rueda y ya no.

Hoy, si un patrón valioso aparece y luego se evapora, **no queda registro** (lo
verificado: nada escribe el hallazgo de Mes en `revelations`/Historia). El único
rastro es si la usuaria toca "Me lo quedo presente" (→ `month_reflections`,
"Lo que fuiste mirando").

**Por qué importa:** la promesa de Stelar es "la IA analiza tus datos y te ayuda a
entender por qué no lo sostienes". Si el entendimiento se evapora, no construye
memoria — y la memoria ES el diferenciador. Un patrón descubierto debería poder
volverse **Historia**, aunque después salga de la ventana.

---

## 2. Principios (línea roja del manifiesto)

1. **Sin culpa, sin rachas rígidas.** Un patrón que sale de la ventana NUNCA se
   presenta como "lo perdiste" / "se rompió tu racha". Sale porque el dato cambió,
   no porque ella falló.
2. **Prohibido contar frecuencia.** La memoria registra "este patrón apareció"
   (un momento), NO "apareció 5 veces este mes" (`features/patterns/CLAUDE.md`).
   La Historia guarda el **descubrimiento**, no un marcador.
3. **Inmutable, no retrocede.** Igual que constelación/transformación/revelaciones
   (ver `immutable-vs-recalculable`): una vez que un patrón entró a Historia, se
   queda. El backfill o la ventana rodando no lo borran ni lo hacen retroceder.
4. **Observación + foco, no receta.** El registro histórico conserva la lectura y
   la palanca del patrón, nunca una orden ni lenguaje clínico.
5. **El veredicto NO es patrón.** El déficit-summary (siempre presente) no se
   "descubre" ni se archiva como hallazgo — es el norte continuo. Solo los
   patrones GENUINOS (rescate, día que rompe, señal naciente, ancla, pausa) tienen
   memoria.

---

## 3. Ciclo de vida de un patrón

Tres estados, sin ninguno que signifique fracaso:

| Estado        | Qué es                                                     | Dónde se ve                              | Voz                                                |
| ------------- | ---------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------- |
| **Naciente**  | El motor lo detecta por primera vez (o tras estar dormido) | Card de Órbita Mes con sello "Nuevo"     | "Estas semanas encontré algo"                      |
| **Presente**  | Sigue sostenido por la ventana                             | Card de Órbita Mes, sin sello de novedad | "Sigue asomando"                                   |
| **En reposo** | Salió de la ventana; el dato ya no lo sostiene             | SOLO en Historia (no en la card)         | "Lo viste el 11 jul" — un recuerdo, no un reproche |

- Un patrón **En reposo que vuelve** a asomar reaparece como **Naciente otra vez**
  con un matiz cálido ("volvió a asomar"), reusando la lógica del tier `'return'`.
- Nunca hay un cuarto estado "perdido/fallido". En reposo = descansa, no muere.

---

## 4. Dónde vive (reusar lo que existe)

### 4.1 Tabla: `revelations`, tier `'pattern'` (YA EXISTE)

`supabase/migrations/20260614070000_revelations.sql` ya define:

- `tier = 'pattern'`, `kind in ('night_eating','protein_consistent', ...)`.
- Rate-limit **1 patrón / 7 días** (índice `revelations_user_tier_shown_idx`).
- RLS por `user_id`. Inmutable por diseño (es un registro de "lo mostrado").

**El gap es solo el productor:** Órbita Mes no inserta ahí. La MVP es **enchufar
los `Finding` de patrón del motor a un writer que inserte en `revelations`** la
primera vez que se detectan (respetando el rate-limit y el de-dup por `kind`).

Nuevos `kind` a registrar (mapean 1:1 con los detectores del motor):

- `rescue` (la dimensión que sostiene el déficit)
- `weekday_diet_break` (el día que rompe)
- `rising_signal` / `emerging` (señal naciente)
- (extensible: cada detector nuevo de `_shared/intelligence` declara su `kind`)

### 4.2 Snapshot: qué se congela al detectar

El registro guarda el hallazgo **tal como se vio**, no una referencia viva (para
que sea inmutable aunque la ventana cambie):

```
{
  tier: 'pattern',
  kind: <detector id>,
  subject: finding.subject,          // "tu movimiento"
  lead: finding.phrase.lead,         // la lectura de ese momento
  support: finding.phrase.support,   // los números de ESE momento (congelados)
  lever: finding.lever,              // la palanca ("muévete los días flojos")
  dimension: finding.category,       // movimiento / sueno / agua / ...
  detected_on: <fecha>,              // cuándo asomó
  window: 'last31' | 'last90'
}
```

Los números quedan **congelados en el momento del descubrimiento** — la Historia
dice "cuando lo vi, era 11 de 11", no recalcula. (Regla de inmutabilidad.)

### 4.3 Presentación: Historia (Progreso) + Reliquias (Órbita)

- **Historia** (timeline de Progreso, tier-agnóstico): el patrón aparece como un
  hito de descubrimiento, junto a transformación (25/50/75/100) y regreso.
- **Reliquias Celestes** (Órbita, glosario V2): un patrón archivado se clasifica
  como su Reliquia — **Brillo** (qué potencia), **Ancla** (qué mantiene constante),
  **Pausa** (qué ayuda a recuperarse), **Señal Naciente** (lo que emerge). El
  rescate = Ancla; el día que rompe NO es Reliquia (es obstáculo, no se celebra
  como reliquia — vive en Historia como observación, no como Reliquia).
- **Alma Celeste** (largo plazo): las Reliquias acumuladas alimentan la vista de
  evolución. Fuera de MVP.

---

## 5. UI: qué cambia en la card

1. **Sello de frescura** en la card de descubrimiento: cuando el patrón mostrado
   es Naciente (recién insertado en `revelations`), un micro-marcador "Nuevo"
   junto al glifo. Cuando es Presente, sin marcador. (Hoy la card no distingue.)
   OJO: aplica a patrones, no al veredicto de déficit (que nunca es "nuevo").
2. **"Lo viste antes"**: si el patrón abierto ya está en Historia, un enlace
   discreto "ya lo viste el <fecha>" que abre la entrada de Historia. Continuidad:
   Stelar recuerda (empata con el CTA "Retomar con Stelar" ya construido).

---

## 6. De-dup, rate-limit, ruido

- **Rate-limit 1/7d** (ya existe): evita que un patrón que oscila en el borde del
  umbral spamee Historia día tras día. Un `kind` solo re-entra si estuvo **En
  reposo** un mínimo (p. ej. 14 días fuera) antes de re-revelarse.
- **De-dup por `kind`**: un mismo patrón no se archiva dos veces seguidas; se
  archiva su PRIMERA aparición y, si vuelve tras reposo, su REAPARICIÓN (con matiz
  de regreso).
- **Umbral de dignidad**: solo se archivan patrones con la confianza que el motor
  ya exige (obstáculo ≥55, palanca ≥60) — no borradores. La `Señal Naciente`
  (`emerging`) se archiva como naciente, con su copy tentativo, no como sello.

---

## 7. Interacción con "poca data / primera semana"

Sin cambios respecto a hoy (ya está bien resuelto): con <14 días activos, la card
muestra el estado vacío honesto y **no se archiva nada** (no hay patrón que
recordar). La memoria empieza a construirse cuando el motor cruza el umbral. La
Historia de una usuaria nueva está legítimamente vacía — y eso es una promesa
("aquí se irá guardando lo que descubramos"), no un vacío triste.

---

## 8. Fases

- **Fase 1 (MVP, sin migración nueva):** writer que inserta los `Finding` de
  patrón en `revelations` tier `'pattern'` al detectarlos (rate-limit + de-dup ya
  existen). Entrada mínima en Historia. Sello "Nuevo" en la card. — Esto es lo que
  cierra el gap de "se evapora sin rastro".
- **Fase 2:** estado "En reposo" + reaparición con matiz de regreso; enlace "ya
  lo viste el <fecha>" en la card.
- **Fase 3:** clasificación a Reliquias Celestes en Órbita + alimentar Alma
  Celeste (largo plazo).

---

## 9. Decisiones de la dueña (resueltas jul 2026)

1. **¿Dónde vive la memoria?** → **Reusar superficies actuales**: marcadores en
   "Tu constancia" (calendario, ya consume `useRevelationHistory`) + re-ver en
   Órbita. Sin UI/timeline nuevo. (No existe un timeline navegable de revelaciones;
   "Tu Historia" de Progreso es la transformación antes/ahora, otra cosa.)
2. **Reposo antes de re-revelar:** → **14 días fuera** de la ventana antes de que
   un patrón pueda volver a asomar como "regreso" (evita el yo-yo).
3. **Números (snapshot vs vivo):** → **Congelar el momento + capa viva "sigue
   presente" SOLO si el patrón aún está en la ventana.** El registro guarda fijo
   ("cuando lo vi: 11 de 11"); si sigue presente hoy, se puede mostrar un vivo
   "sigue asomando"; si ya se fue, NUNCA "lo perdiste". Concilia inmutabilidad +
   sensación de vivo.
4. **Obstáculos (el día que rompe):** SIN decisión explícita. **Default MVP: NO se
   archivan** — un marcador de "día malo" en el calendario roza la culpa. Solo se
   archivan patrones que POTENCIAN (rescate, señal naciente). Revisable.
5. **Timing/alcance:** → **Ahora (pre-freeze), mínimo: solo el writer**, reusando
   los marcadores del calendario. OJO — corrección a esta spec: **SÍ requiere una
   migración** (extender el CHECK de `revelations.kind` para los kinds nuevos). No
   toca RLS, pero pasa por `rls-auditor` igual (regla de `supabase/CLAUDE.md`).

---

## 10. Qué NO hacer (guardarraíl)

- NO contar cuántas veces apareció un patrón.
- NO decir "perdiste" / "se rompió" un patrón que salió de la ventana.
- NO recalcular los números de una entrada histórica (inmutable).
- NO archivar el veredicto de déficit como si fuera un descubrimiento.
- NO archivar borradores por debajo del umbral de confianza del motor.
- NO lenguaje clínico ni comparativo en las entradas de Historia.
