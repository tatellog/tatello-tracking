# STELAR · PRD — Sistema de Revelaciones

Versión: V1 (Sin IA) · guardado 2026-06-14

> Spec derivada del manifiesto. Define **qué construir** para el sistema de
> Revelaciones. Convive con `features/patterns/CLAUDE.md` (la línea roja de
> la voz de patrones) y `docs/retention-mechanics-spec.md` (anticipación sin
> FOMO). Si esta spec y el manifiesto chocan, **gana el manifiesto** — ver
> "Conflictos conocidos" al final.

---

## Objetivo

Convertir eventos importantes del viaje de la usuaria en momentos memorables.

Las revelaciones **no** son recompensas:

- Las **recompensas** celebran acciones (frecuentes, varias por día → puntos
  de transformación).
- Las **revelaciones** muestran significado (escasas, pocas veces al mes →
  momento narrativo).

|            | Recompensas                                 | Revelaciones                                                 |
| ---------- | ------------------------------------------- | ------------------------------------------------------------ |
| Frecuencia | Varias/día                                  | Pocas/mes                                                    |
| Ejemplos   | registró agua/comida/energía/sueño, entrenó | regresó tras abandonar, nuevo estado de transformación, hito |
| Resultado  | puntos de transformación                    | momento narrativo                                            |

---

## Arquitectura — tres tiers

### TIER 1 · Revelaciones de Transformación

- **Objetivo:** hacer visible la evolución del emblema.
- **Frecuencia:** muy baja — 4 veces por ciclo.
- **Triggers:** transformación revelada ≥ 25% · ≥ 50% · ≥ 75% · = 100%.
- **Experiencia:** overlay full-screen + animación + haptic + CTA.
- **Ejemplo:** "Tu Leo empieza a despertar. Ahora puedes ver sus primeros trazos."
- **Reglas:** nunca se repite · nunca retrocede · nunca desaparece.
- **Tracking:** `revelation_transformation_shown`.

### TIER 2 · Revelaciones de Regreso

- **Objetivo:** eliminar culpa, reforzar el retorno.
- **Frecuencia:** muy baja — máximo una vez por regreso.
- **Trigger:** 3+ días sin abrir Stelar.
- **Experiencia:** overlay full-screen, la primera vez que vuelve.
- **Ejemplo:** "Qué bueno verte otra vez. Todo lo que construiste sigue aquí."
- **Reglas:** nunca mencionar abandono / fracaso / pérdida.
  - ✗ "Llevabas 7 días sin entrar." → ✓ "Qué bueno verte otra vez."
- **Tracking:** `revelation_return_shown`, `revelation_return_dismissed`.

### TIER 3 · Revelaciones de Patrones

- **Objetivo:** mostrar comportamientos repetidos.
- **Importante:** NO son IA · NO explican causas · NO recomiendan · solo
  muestran evidencia.
- **Frecuencia:** máximo 1 cada 7 días.
- **Prioridad de selección:** 1) Regreso · 2) Patrón · 3) Nada.
- **Fuente:** últimos 14 días.

Patrones MVP:

| Patrón                    | Umbral                                      | Ejemplo (ver "Conflictos conocidos")                                 |
| ------------------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| Comida nocturna           | comidas después de 10pm, mín. 5 ocurrencias | "Registraste comida después de las 10pm en 5 de los últimos 7 días." |
| Proteína consistente      | objetivo alcanzado 4+ veces/semana          | "La proteína apareció de forma constante esta semana."               |
| Entrenamiento consistente | 3+ entrenamientos                           | "Esta semana encontraste un ritmo de movimiento."                    |
| Sueño consistente         | 7h+ durante varios días                     | "Tu sueño fue más estable esta semana."                              |

---

## Reglas globales

Las revelaciones: nunca juzgan · nunca corrigen · nunca recomiendan · nunca
diagnostican. **Siempre muestran evidencia, nunca opinión.**

- ✗ "Deberías dormir más." → ✓ "Dormiste más de 7 horas…"

---

## Historial

Toda revelación genera automáticamente una entrada en **Historia**.

- Revelación: "Tu Leo despertó." → Historia: "12 junio 2026 · Leo despertó."

---

## Relación con Órbita

- Órbita muestra **significado continuo**.
- Las revelaciones muestran **momentos excepcionales**.

---

## Definición de éxito

La usuaria debe sentir: _"Stelar solo me interrumpe cuando realmente
descubrió algo importante."_ Si una revelación se vuelve común, debe **bajar
de tier o desaparecer**.

---

## Decisiones de implementación (2026-06-14, owner)

1. **Conteos en patrones (T3): SÍ se muestran** (PRD literal). Esto **anula
   conscientemente** la regla anti-conteo de `features/patterns/CLAUDE.md`
   SOLO para las Revelaciones de Patrones. Mitigación obligatoria: el copy se
   mantiene en **marco de evidencia neutral** — el sujeto es el dato/registro
   ("Registraste comida después de las 10pm en 5…"), NUNCA la usuaria ("comes
   de más"), sin juicio/corrección/recomendación. Si `manifesto-reviewer`
   marca el conteo, citar ESTA decisión (no revertir sin el owner).
2. **T1 coexiste** con el reveal gradual: el emblema sigue revelándose frame
   a frame; al CRUZAR 25/50/75/100 por primera vez dispara una ceremonia
   full-screen (una vez c/u). Alinear etapas 26/51/76 → 25/50/75.
3. **T2 unificado**: el reveal full-screen (hoy `abandonment`) es LA
   Revelación de Regreso canónica. Se **retira** el `ReturnMoment` inline.
4. **Historia**: persistir ahora (tabla `revelations` con RLS, las 3 tiers
   escriben ahí). La **UI de Historia se fasea** (semilla: el detalle de
   patrón de Órbita `app/orbit/pattern/[id].tsx`).

## Decisiones de Stage C (behavioral-specialist, 2026-06-14)

5. **Prioridad entre patrones — los POSITIVOS ganan al noticing.** Si en una
   ventana califica ≥1 patrón positivo (proteína/entreno/sueño) Y la comida
   nocturna, gana el positivo. El noticing (comida nocturna) solo emerge
   cuando NO hay ningún positivo. Razón: el sesgo de negatividad hace que un
   "te vi cenar tarde" pese 2-3× un elogio; que un buen día no se gaste la
   cuota en lo que falló. Entre positivos, desempate por volición:
   **entreno > proteína > sueño**.
6. **Umbrales:** proteína 4/7 · entreno 3/7 · sueño **6.5h** (390 min, NO 7h —
   7h casi nunca dispara y el copy promete "estabilidad", no estándar médico)
   en 4/7 · comida nocturna 5/7 **días distintos** (no comidas) después de
   las 22:00. 5/7 es el TECHO sano del noticing.
7. **Cadencia del noticing ≥ 14 días** (propia, además del 1/7 global): la
   repetición del noticing en ventanas seguidas roza "me cuenta las noches"
   (verbo de observación sostenida, prohibido). El silencio es feature: no se
   fuerza una revelación semanal para llenar cuota.
8. **Conteos por tono:** en positivos el número va al frente y enmarca "hacia
   arriba" (5/7 = constancia; NUNCA "te faltaron 2"). En el noticing el número
   va al PIE como contexto del dato, nunca al titular; sujeto = "las noches".
9. **Línea roja (pendiente de construir):** comida nocturna ~diaria sostenida
   (7/7 en varias ventanas) NO es un reveal con conteo → debe enrutar a
   `severe_signals` + mensaje suave de derivación (ver features/patterns/
   CLAUDE.md "patrón severo"). Definir el umbral-techo de escalado. MVP: el
   reveal de night-eating se cap­ea; el flujo severo se fasea.

## Celebración ("la fiesta") — quién celebra y con qué intensidad

> uxui + illustrator (2026-06-14). Regla física: la luz NACE y ASCIENDE desde
> el emblema, NUNCA cae como confeti. Solo oro/leche, magenta como acento.
> Partículas nativas (`RevealParticles`), graduadas por tier. reduce-motion
> apaga la fiesta. **El noticing (comida nocturna) NUNCA celebra** — es
> observación, no logro (línea roja).

| Momento              | Celebra            | Tier    | Intensidad                              |
| -------------------- | ------------------ | ------- | --------------------------------------- |
| T1 · 25%             | sí, leve           | whisper | susurro de polvo dorado                 |
| T1 · 50%             | sí                 | stream  | corriente de chispas                    |
| T1 · 75%             | sí                 | rise    | ascenso + destellos                     |
| T1 · 100%            | sí, máxima         | bloom   | estallido + 8-puntas + onda + 2º haptic |
| T2 · Regreso         | cálido, NO festivo | return  | envuelve (lento, leche), no estalla     |
| T3 · Positivos       | sí, media          | stream  | constancia merece brillo                |
| T3 · Comida nocturna | **NUNCA**          | —       | cero fiesta, cero haptic de éxito       |

## Conflictos conocidos con lo ya construido

> Los ejemplos de copy del PRD con conteos de frecuencia chocan con
> `features/patterns/CLAUDE.md`. Resuelto por el owner en la Decisión #1
> (arriba): los conteos GANAN para T3, con marco de evidencia neutral.

Estado actual relevante:

- **Tier 3 ya existe parcialmente:** `features/patterns/` con `night_eating`
  (umbral actual 2, el PRD pide 5) y `abandonment` — pero el PRD reclasifica
  `abandonment` como **Tier 2 (Regreso)**, no patrón.
- **Tier 2 hoy vive en dos lados:** el reveal `abandonment` (PatternReveal,
  "rooted") + el componente inline `ReturnMoment` en Hoy. Hay que unificar.
- **Tier 1 NO existe** como ceremonia full-screen; el emblema hoy revela
  gradual (frames) + líneas de etapa (`EMBLEM_STAGES` en 0/26/51/76/100) +
  `TransformationCard`. Los umbrales del PRD son 25/50/75/100.
- **Historia NO existe** como feature/tabla — es nuevo.
- El **high-water-mark** del emblema (junio 2026) ya garantiza "nunca
  retrocede" para Tier 1.
