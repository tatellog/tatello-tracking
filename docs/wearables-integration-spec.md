# Wearables · spec de integración (Apple Health + Garmin)

**Estado:** plan aprobado por la dueña (jul 2026) · construcción por fases.
**Rama:** `feature/wearables`. **Fuentes:** benchmark de Apple Fitness /
YAZIO / MFP (product-benchmark, 2 rondas) + decisiones de la dueña.

El wearable es **otra pipa hacia el mismo motor** (roadmap por capas): no
crea pantallas nuevas ni metas nuevas; automatiza inputs, enriquece la
evidencia y alimenta patrones. El motor de patrones no cambia ni una
línea: sigue leyendo `daily_signals`.

---

## 1 · Señales (decisión de la dueña)

| Señal                                                    | Fase        | Aterriza en         | Superficie                                                           |
| -------------------------------------------------------- | ----------- | ------------------- | -------------------------------------------------------------------- |
| Entrenos detectados (tipo + duración + kcal del workout) | 1           | `wearable_workouts` | Auto-sella DayCheckIn + aro interior del multiring (ver §3) + Órbita |
| Sueño (duración + bedtime/wake reales)                   | 1           | `wearable_sleep`    | Slide de sueño de Hoy + motor                                        |
| Pasos (agregado diario)                                  | 1 (ingerir) | `wearable_steps`    | Motor-only al inicio; superficie se decide después                   |
| Calorías activas del DÍA (stream completo)               | NUNCA       | —                   | No se pide el permiso (ver §4)                                       |
| HR / HRV                                                 | NO          | —                   | Territorio clínico                                                   |
| Peso de báscula smart                                    | Diferido    | —                   | Rompe "actualiza cuando estés lista"; opt-in futuro aparte           |

Reglas de pasos (condiciones aceptadas): ingerir ya / exhibir con calma;
sin contador en Hoy; sin meta de 10,000; si algún día se muestran, como
patrón semanal en Órbita, no número-contra-target del día.

## 2 · Arquitectura

**Split validado (es el único posible):**

- **Apple Health = device-side.** HealthKit no tiene API de nube: el
  cliente lee local (foreground-first) y empuja a Supabase.
- **Garmin = cloud-side.** Garmin Health API empuja por webhooks → edge
  function receptora + OAuth. **Desacoplado:** solicitar acceso al
  programa Garmin YA (lead time de semanas/meses corre en paralelo),
  construir solo con usuarias Garmin reales.

**Estrategia de API: DIRECTO, sin agregador (decisión jul 2026).**
Evaluados Terra / Rook / Junction (ex-Vital) / Spike: para la fase 1 no
ahorran nada (HealthKit no tiene nube: el agregador solo mete SU SDK en
tu app y te cobra el rodeo), sus mínimos mensuales son absurdos para la
beta, y meten un tercero en el flujo de datos de salud (rompe "tus
datos son tuyos" + lock-in a su esquema vs nuestras tablas crudas).
MFP nunca usó agregador (se volvió uno); YAZIO fue directo y frugal.

- **HealthKit ES el agregador gratuito en iOS:** Garmin Connect y
  Strava escriben workouts/sueño a Apple Health si la usuaria activa el
  write-through en sus apps → la fase 1 captura usuarias de Garmin y
  Strava POR REBOTE, sin integrarlas; la provenance puede decir la app
  fuente (viene en el metadata de HealthKit).
- **Strava directo: fuera del roadmap.** Perfil no coincide (red social
  de performance, skew competitivo) y sus términos de API (nov 2024)
  restringen el análisis de datos por terceros — chocan con el motor de
  patrones. Si una usuaria de Strava llega, entra vía HealthKit.
- **Trigger para reabrir lo del agregador (las TRES juntas):** ≥3
  fuentes cloud pedidas por usuarias de pago · el mínimo mensual del
  plan <5% del MRR · el agregador entrega passthrough crudo a nuestras
  tablas `wearable_*`. Realistamente a 12+ meses del lanzamiento.

**Librería HealthKit (fase 1, pendiente de permiso de la dueña):**
`@kingstinct/react-native-healthkit` (TS de primera, new-arch vía Nitro
Modules — agrega peer `react-native-nitro-modules` —, config plugin
para prebuild, anchored queries + background delivery, workouts con
`totalEnergyBurned`, HKStatisticsQuery para pasos pre-deduplicados).
Descartadas: `react-native-health` (mantenimiento degradado, API de
callbacks) y variantes expo-healthkit (cobertura parcial). Android
futuro: `react-native-health-connect`. Verificar versión/compat SDK 54
en npm antes de instalar. Estructura: `features/wearables/` con
`healthkit.ts` (única import de la lib) + `api.ts` + `hooks.ts` +
`logic.ts` puro (normalización agnóstica de fuente) + `components/`.

**Aterrizaje: tablas crudas propias, NUNCA las tablas manuales.**
`daily_signals` es una VIEW (no escribible) y `sleep_logs`/`workouts`
tienen semántica manual que no se contamina. Nuevas tablas:

- `wearable_workouts` (user_id, source, external_id, started_at,
  ended_at, workout_type, duration_min, energy_kcal, …)
- `wearable_sleep` (user_id, source, external_id, sleep_date,
  bedtime_at, wake_at, asleep_minutes, …)
- `wearable_steps` (user_id, source, day_date, steps, …)
- UNIQUE `(user_id, source, external_id)` → upsert idempotente (Garmin
  reenvía summaries corregidos; los re-sync nunca duplican).
- RLS estricta `auth.uid() = user_id` en todas (rls-auditor antes de
  aplicar).
- Timestamps crudos SE PRESERVAN (primera fuente de bedtime/wake reales;
  futuros patrones de hora salen de aquí, no de `daily_signals`).

**Merge en la view `daily_signals` — regla "manual gana, el reloj
rellena":**

- Sueño: si hay `sleep_logs` de esa fecha → manual gana; si no, el reloj
  llena el hueco.
- Entreno: `trained` = OR de ambas fuentes; `workout_type` prefiere el
  manual.
- Una corrección manual de un dato del reloj se vuelve registro manual y
  el re-sync no la pisa (por construcción).
- Una sola fuente primaria por señal si algún día coexisten Apple +
  Garmin (v1: bloquear conexión dual).

**Día y timezone:** sueño se atribuye al día en que despertó
(`sleep_date`, convención existente); workouts al día local del fin del
entreno; todo normalizado vía `profiles.timezone` (patrón ya resuelto en
la view). Garmin trae su propio "día local" → normalizar SIEMPRE al del
perfil.

**Backfill:** el dato tardío del reloj solo SUMA señal; jamás hace
retroceder constelación / transformación / revelaciones (regla inmutable
vs recalculable). El motor nunca cierra un día como "sin sueño"
definitivo: el dato que llega a las 3pm completa, no corrige un juicio.

## 3 · El multiring de Órbita Día (decisión de la dueña · jul 2026)

El multiring **YA EXISTE**: es `GoalRing` dentro de
`features/orbit/components/DayPresent.tsx` (el segmento Día de Órbita,
"¿Cómo voy hoy?"), 3 aros concéntricos SVG+Reanimated:

- **Aro exterior · Calorías/déficit** — `fill = consumido/meta`,
  overflow oro, color por GoalStatus.
- **Aro medio · Proteína** — `fill = g/meta`, rampa coral.
- **Aro interior · Entreno** — binario: `fill = trained ? 1 : 0`. **Ya
  "nace lleno al entrenar"**, apagado en reposo sin culpa.

La mejora decidida: el aro interior (hoy check binario) pasa a mostrar
las **calorías quemadas del wearable**. El cambio es de DATO + LEYENDA,
no de dibujo:

- View `daily_signals` gana `workout_kcal` (suma de `energy_kcal` de
  los workouts del día del reloj; `null` si el entreno fue manual —
  nunca `0` como deuda) y `workout_source`.
- `features/orbit/day-goal.ts` (lógica pura + tests): `GoalHero` gana
  `workoutKcal`/`workoutSource`.
- `LegendStat` en DayPresent: renglón Entreno pasa de `Sí / Aún no` a
  `~342 kcal` + caption `tu reloj` cuando el dato es del wearable;
  manual queda `Sí` como hoy. Copy final por voice-and-copy.
- El aro NO gana cometa ni fill proporcional: sin meta de quema no hay
  progreso que animar (decisión explícita de la dueña: nace lleno).
- El DayCheckIn de Hoy sigue siendo el input manual; el aro es display.
- NO cruza con la migración Skia (USE_SKIA_ORBIT vive en OrbitalSystem,
  que ya no se renderiza en la tab Órbita).
- Las RingCards de Hoy (Proteína/Calorías del slider) NO se tocan en
  esta fase.

**Frontera dura (aritmética, no solo manifiesto):**

- La quema **NO** modifica `caloriesTarget` ni "Te quedan X kcal" (el
  eat-back de MFP). El presupuesto de comida no se infla nunca.
- La quema **NO** entra a `adaptive-tdee.ts`: el TDEE por balance
  energético ya contiene el efecto de los entrenos vía el delta de peso;
  sumar la kcal del reloj cuenta el ejercicio dos veces e inyecta error
  de ±20-90% a una fórmula auto-calibrante. La kcal del entreno se
  muestra JUNTO al TDEE como contexto si hace falta, nunca dentro.
- Sin meta diaria de quema en ninguna superficie (el Move ring de Apple
  presiona por diseño; su estado vacío a las 8pm es el regaño).

**Experiencia post-entreno (la parte que la dueña quiere sentir):**
entrenas con el reloj → al abrir Stelar el DayCheckIn ya está sellado con
provenance ("desde tu Apple Watch") + tipo + duración + kcal, y el aro
interior del multiring nace lleno con tu quema. Cero notificaciones disparadas
por datos del wearable (regla del canal de push: los datos del reloj
alimentan patrones de semanas, no juicios del minuto).

## 4 · Permisos y privacidad

- Pedir SOLO: workouts + sueño (+ pasos). **NO pedir "Active Energy"
  diaria**: la kcal del entreno viene dentro del propio workout. El
  eat-back queda bloqueado por arquitectura: el dato que no entra no se
  puede mal-usar.
- iOS no distingue "lectura denegada" de "sin datos": la UX del estado
  vacío es amable y sin culpa ("aún no encontramos registros; revisa el
  permiso en Salud → Stelar").
- Background delivery de HealthKit es promesa, no contrato: ninguna
  feature DEPENDE de dato fresco en background. Foreground-first
  (anchored queries + ventana de re-consulta de 7 días en cada apertura);
  background como mejora best-effort en fase 2.

## 5 · UX de conexión

- **Hogar canónico:** Ajustes → sección "Conexiones" (estado, fuente,
  último sync, desconectar en un toque + qué pasa con lo sincronizado).
- **Paso de onboarding (decisión de la dueña, jul 2026 — anula el "NO
  en onboarding" del benchmark):** paso 11b tras notificaciones
  (`app/onboarding/health-connect.tsx`), referencia visual YAZIO
  traducida a voz Stelar (sin hype ni stats infladas). Priming completo
  antes del prompt; "Ahora no" avanza sin re-asks; en Android/Expo Go el
  CTA es solo "Continuar" (sin botón que promete y truena).
- **Invitación contextual (fase 2, la que convierte):** en el lugar que
  automatiza (slide de sueño / DayCheckIn): "¿Entrenas con tu reloj?
  Stelar puede anotarlo por ti."
- **Priming antes del prompt del OS** (lección de notificaciones): qué
  lee · qué NO hace ("no te va a avisar, no te va a medir; solo te
  ahorra escribir") · reversible en un toque. Copy por voice-and-copy;
  frame completo por manifesto-reviewer.
- **Provenance sutil estilo Apple Health:** caption "desde tu Apple
  Watch" junto al dato, en el mismo lugar del manual. Editable siempre.

## 6 · Premium

Wearables-como-premium validado (precedente YAZIO PRO), pero **sync y
paywall no se validan juntos**: beta founders gratis de por vida; el
cobro llega cuando el sync ya es confiable (fase 2, con trial).

## 7 · Roadmap

| Fase                         | Gate                                                            | Qué                                                                                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 · Groundwork               | ya                                                              | Encuesta de reloj a las 4 usuarias · migración de tablas crudas + RLS · priming + copy · ~~solicitar programa Garmin~~ (programa suspendido, ver §8.2)                                                 |
| 1 · Apple Health             | dev build (cuenta Apple ya existe)                              | ✅ CONSTRUIDA. Sueño + workouts (tipo/duración/kcal) + pasos ingest · view manual-gana · kcal del reloj en el multiring de Órbita Día · Conexiones en Ajustes + paso de onboarding · gratis para betas |
| 2 · Health Connect (Android) | demanda real de usuarias Android                                | Espejo de fase 1 con `react-native-health-connect` (§8.1) · +`'health_connect'` al source · minSdkVersion 26 · superficie de pasos · paywall con trial                                                 |
| 3 · Garmin directo           | BLOQUEADO (§8.2): programa suspendido + entidad legal + demanda | Diferido indefinidamente. Cobertura de Garmin HOY = rebote por Apple Health / Health Connect, costo cero.                                                                                              |

**Pendiente técnico de fase 1:** elegir librería HealthKit para Expo
(candidatas a evaluar con backend-specialist; requiere expo prebuild /
dev client, nunca correrá en Expo Go). — RESUELTO: fase 1 construida con
`@kingstinct/react-native-healthkit` (ver §2).

## 8 · Análisis de Android (Health Connect) y Garmin (jul 2026)

### 8.1 · Health Connect (Android) — la fase 2 es un clon limpio de la 1

Health Connect ES el "Apple Health de Android" (el agregador de
plataforma, gratis, device-side). La integración es el ESPEJO de la de
HealthKit: misma arquitectura, misma regla "manual gana", mismas tablas
crudas — solo cambia el archivo wrapper.

- **Librería:** `react-native-health-connect` (matinzd) v3.5.3, mantenida
  (último publish may 2026), TypeScript, new architecture, con config
  plugin para prebuild (`expo-health-connect`, mismo autor). Es la única
  recomendable; la lógica de `features/wearables/logic.ts` ya es agnóstica
  de fuente, así que enchufa sin refactor.
- **Caveats de build (todos de config, ninguno de arquitectura):**
  - `minSdkVersion = 26` (Health Connect lo exige); hoy el proyecto está
    por debajo → subirlo vía `expo-build-properties` en `app.json`.
  - No corre en Expo Go (igual que HealthKit): dev/preview build.
  - Requiere que Health Connect esté instalado en el teléfono (Android 14+
    lo trae de fábrica; Android 13 es una app de Play Store) → la UX del
    estado "no disponible" ya existe y cubre este caso.
- **Cambio de schema mínimo:** el CHECK de `source` hoy es
  `('apple_health', 'garmin')`. Health Connect es una fuente nueva:
  agregar `'health_connect'` al CHECK de las 3 tablas y al type
  `WearableSource` (una micro-migración + una línea). El `workout_source`
  de la view sigue devolviendo 'manual'/'wearable' — la fuente concreta
  del reloj no cambia la leyenda del multiring, solo la provenance.
- **Estructura:** `features/wearables/health-connect.ts` (espejo de
  `healthkit.ts`, la única import de la lib Android) + un `hooks.ts`
  extendido con `useHealthConnectSync` que decide plataforma. Los mapeos
  de tipo de entreno / etapas de sueño de Health Connect difieren de los
  de HK y se normalizan en `logic.ts` (funciones nuevas, mismos tests).
- **Cuándo:** fase 2, gated en demanda real de usuarias Android (la beta
  es toda iPhone hoy — validar con la encuesta antes de invertir).

### 8.2 · Garmin directo — BLOQUEADO por Garmin, no por nosotros

⚠ Hallazgo que cambia el plan: **el Garmin Connect Developer Program está
SUSPENDIDO** (jul 2026). No acepta nuevas altas; el formulario de acceso
está "under construction". Además, cuando reabra, exige aplicar como
ENTIDAD LEGAL (empresa/universidad/hospital), no uso personal, con cuota
administrativa de setup. Stelar hoy no califica ni podría aplicar aunque
quisiera.

Consecuencias para el roadmap:

- **"Solicitar el programa Garmin ya" (fase 0) es imposible hoy.** La
  puerta está cerrada por Garmin; no hay lead-time que correr en paralelo.
- **La única vía directa hoy sería un agregador (Terra)** — y ya se
  evaluó y descartó (§2): costo, tercero en datos de salud, lock-in. El
  bloqueo de Garmin no cambia ese veredicto.
- **La vía que SÍ funciona ya: rebote por la plataforma.** Garmin Connect
  escribe workouts/sueño a Apple Health (iOS) y a Health Connect (Android)
  si la usuaria activa el write-through en su app Garmin. Stelar captura a
  la usuaria de Garmin SIN integrar Garmin — la card de Conexiones ya lo
  explica. La provenance mostrará "Garmin Connect" desde el metadata.

**Decisión: Garmin directo sale del roadmap** hasta que se cumplan TRES
condiciones (todas): (a) Garmin reabra el programa, (b) Stelar sea una
entidad legal que califique, (c) haya demanda real de usuarias Garmin que
el rebote no cubra bien. Mientras tanto, el rebote por Apple Health /
Health Connect es la cobertura de Garmin, a costo cero.
