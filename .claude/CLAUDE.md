# CLAUDE.md · Stelar

Instrucciones permanentes para Claude Code. Léelo completo antes de tocar
cualquier cosa del repo.

---

## Antes de cualquier cosa

1. Lee `docs/product-manifesto.md` (v3.0). Cualquier sugerencia
   que rompa los 10 principios del final del manifiesto está mal.
2. Muéstrame el diff ANTES de aplicar cambios.
3. NO commitees ni hagas push sin que yo lo apruebe explícitamente.
4. Si algo no está claro, pregunta. No inventes contexto.

---

## Qué es Stelar (en una frase)

**App de pérdida de peso sostenible.**

Trackea calorías, macros, déficit y peso con rigor · pero los pone en el
contexto, no en el centro. Su diferencia es analizar los patrones en tus
propios datos para entender qué impide sostener la constancia (caída los
viernes, abandono en semana 3, días que se rompen) y acompañarte sin
presión ni culpa. Las constelaciones zodiacales son la visualización del
progreso · reemplazan la gráfica de peso fría.

**Scope (peso como norte):** el peso es el objetivo. Sueño, energía,
movimiento, ciclo y emociones son DIMENSIONES que alimentan el motor de
patrones · NO metas de wellness independientes. Stelar NO da dietas, NO da
rutinas de entrenamiento, NO usa lenguaje clínico y NO reemplaza a
nutriólogo, psicólogo ni coach.

(v3.0 retiró el término "inteligencia emocional"; el diferenciador es el
análisis de patrones en tus propios datos. El QUÉ CONSTRUIR vive en
`docs/PRD-v2.md`; el HACIA DÓNDE (visión, métricas norte y orden de fases),
en `docs/product-vision-roadmap.md`; el QUÉ NO hacer / cómo habla, en el
manifiesto.)

NO es: app de wellness sin números, MyFitnessPal con tema oscuro, app de
meditación, horóscopo decorativo, quick-fix de peso.

---

## Stack técnico

- **Framework:** Expo SDK 54 + React Native 0.81 + React 19
- **Routing:** Expo Router
- **Backend:** Supabase (Postgres + Auth + Storage), RLS estricto
- **Data layer:** TanStack Query (React Query) v5
- **Animación:** Reanimated 4
- **Estilos:** NativeWind
- **Validación:** Zod (en los bordes · parsea respuestas Supabase/RPC)
- **Lenguaje:** TypeScript estricto
- **Package manager:** pnpm

---

## Sistema visual

- **Fondo:** `#0A0608` (negro warm)
- **Texto principal:** `leche` `#F4ECDE`
- **Acento:** magenta / fucsia
- **Tipografías:**
  - Cormorant Garamond italic → voz del coach (frases emocionales)
  - Hanken Grotesk → UI general
  - Inter / Geist → números y datos
- **Iconos:** SVG tintables con `currentColor`
- **Tokens:** centralizados en `theme/` (colores, tipografía, spacing,
  motion). Úsalos · no hardcodees valores.
- **Modo:** solo dark por ahora. NO agregar light mode sin pedírmelo.

---

## Estructura del repo

```
app/
  (tabs)/          · 5 tabs: Hoy, Comidas, Órbita, Progreso, Ajustes
                     (nav de producto = 4: Hoy ¿qué hice? · Comidas ¿qué
                     consumí? · Progreso ¿qué cambió? · Órbita ¿qué
                     significa?. Ajustes no es nav conceptual.)
  onboarding/      · 12 pasos (welcome → goal → ... → Day One)
  _layout.tsx      · root layout
features/          · cada feature: api.ts (Zod+Supabase) + hooks.ts
                     (React Query) + logic.ts (puro) + components/
  tabs/            · bottom nav + LunarConstellation.tsx (god file)
  orbit/           · vista Día/Semana/Mes, lee de daily_signals
  progress/        · medidas, fotos, share cards (WIP · congelado)
  macros/          · comidas + meal scan
  brief/           · hub de contexto (cuidado: muchas features dependen)
  cycle/ sleep/ water/ wellbeing/ rest/ streak/ moods/ profile/
lib/
  supabase.ts      · cliente único
  queryClient.ts   · config React Query
  queryKeys.ts     · keys centralizadas (úsalas para invalidación)
theme/             · design tokens
types/
  database.types.ts · generado con `pnpm run types:db`
supabase/
  migrations/      · versionadas · toda tabla nueva necesita RLS
scripts/           · seeds y utilidades
docs/              · specs derivadas del manifiesto (ver "Documentos
                     clave" abajo)
docs/archive/      · docs históricos (sprints, roadmaps viejos) · no usar
                     como fuente de verdad
docs/product-manifesto.md · fuente de verdad (v3.0)
docs/PRD-v2.md     · qué construir (nav, Reliquias, Lecturas, Alma Celeste)
```

---

## Motor de patrones · fuente de verdad

La lógica de patrones/inteligencia de Órbita vive en
`supabase/functions/_shared/intelligence/` — corre en el **backend** (edge
function `daily-intelligence`) Y en el **cliente** (re-export). Órbita Día ya la
consume. `features/orbit/month-built.ts` es un motor **solo-cliente divergente**
que alimenta Órbita Mes ("Tus patrones") y debe **converger** a la lib
compartida. **NO agregues detectores nuevos a `month-built.ts`** — van a
`_shared/intelligence/` (la key de IA no puede ir en el cliente).

**IA hoy (todo OpenAI gpt-4o-mini · la IA explica, NUNCA detecta):**
`scan-meal` y `scan-measurements` (extracción de foto/texto) + `stelar-insight`
(la voz que explica hallazgos del motor: chat guiado de Mes, chat de Progreso,
voz de Día). Las superficies de IA están gateadas POR USUARIO vía
`aiEnabledForEmail` (`lib/featureFlags.ts`); la beta ve la voz determinista /
mock (`features/orbit/mock.ts`). Regla ✦: el sello solo va en lo que abre chat
con IA real (el motor determinístico jamás se disfraza de IA). La Lectura
Semanal (`weekly-reading`) es 100% determinística, sin IA.

---

## Glosario V2 (vocabulario canónico · usar estos términos)

- **Reliquias Celestes** · patrones (no registros) que viven en Órbita:
  **Brillo** (qué potencia), **Ancla** (qué mantiene constante), **Pausa**
  (qué ayuda a recuperarse), **Señal Naciente** (cambios que emergen).
- **Lecturas** · la IA de Órbita observa tus datos **y recomienda un FOCO /
  palanca** (Diaria / Semanal / Mensual). Puede decir en QUÉ enfocarte
  ("este mes, tu palanca es sostener el finde" ✓) · NUNCA recetar dieta /
  rutina / clínico ("comé menos", "dormí más" ✗) ni diagnosticar.
- **IA de Órbita = Guía observacional** · recomienda un foco desde tus propios
  datos (accionable en modo recomendación, no orden). NO nutrióloga / coach /
  médico: no receta dieta, rutina ni tratamiento. (Cambio dueña jun 2026:
  antes era Observadora pura "nunca aconseja"; ahora sí recomienda un foco.
  Aplica a Día, Semana y Mes. Ver [[orbita-actionable-shift]] y manifiesto §
  "la frontera".)
- **Evolución Celeste / Alma Celeste** · constelación mensual + historial
  de largo plazo. Alma Celeste NO reemplaza la constelación mensual.

---

## Documentos clave (specs derivadas del manifiesto)

El manifiesto (`docs/product-manifesto.md`, v3.0) dice **QUÉ** es
Stelar (identidad, voz, línea roja, qué NO hacer). El **PRD V2**
(`docs/PRD-v2.md`) dice **QUÉ CONSTRUIR** (navegación, Reliquias, Lecturas,
constelación mensual, Alma Celeste). Conviven: el manifiesto pone las
barreras, el PRD describe el producto. Estas specs dicen **CÓMO**:

- `docs/product-vision-roadmap.md` — el HACIA DÓNDE: visión, métricas
  norte (TTFI escalonado, Insights Opened per Week) y el roadmap por fases
  V-01…V-19 con su estado. Consultá ANTES de priorizar o proponer features;
  mucho ya existe detrás de flags (ver "Punto de partida" ahí).
- `docs/weekly-reading-spec.md` — Lectura Semanal (V-05/V-06): motor
  determinístico, tabla inmutable, superficie y pendientes.
- `docs/wearables-integration-spec.md` — wearables: multiring de Hoy,
  ingest-only, nunca eat-back ni TDEE del reloj.
- `docs/roadmap/roadmap.md` + `docs/epics/` — los releases R1-R6 del motor
  de inteligencia (Intelligence Engine, Órbita AI, Progress, Wearables,
  Experiments, Stelar Intelligence) y su estado real.
- `docs/architecture/` y `docs/adr/` — arquitectura (frontend, backend,
  filosofía de IA) y decisiones registradas.
- `docs/PRD-v2.md` — el producto: pilares, navegación por preguntas,
  sistema de constelaciones, Reliquias y Lecturas. Consultá al construir
  features de Órbita, tracking o el loop de progreso.
- `docs/retention-mechanics-spec.md` — estrategia de retención
  manifiesto-safe (gamificación suave + anticipación, sin rachas / FOMO /
  culpa). Consultá al tocar retención, constelación-como-progreso, o el
  loop de regreso.
- `docs/cycle-voice-spec.md` — la Voz del ciclo (contextualiza la balanza +
  patrones, sin predecir ni diagnosticar). Cycle sprint.
- `docs/tu-orbita-design.md` — el tab core (Día / Semana / Mes).
- `docs/constellation-art-brief.md` — dirección de arte de la constelación.
- `docs/revelations-system-spec.md` — Sistema de Revelaciones (V1 sin IA):
  3 tiers (Transformación 25/50/75/100 · Regreso 3+ días · Patrones 1/7d) +
  Historia. Consultá al construir momentos full-screen, retorno o patrones.
  OJO: sus ejemplos de copy con conteos chocan con `features/patterns/CLAUDE.md`
  (prohíbe contar frecuencia) — ver "Conflictos conocidos" en la spec.

---

### Sobre el peso

- SÍ se mide. Vive en onboarding (una vez) + Settings + motor de cálculo.
- NUNCA en home, NUNCA en notificaciones ("pésate hoy"), NUNCA en
  gráficas dominantes, NUNCA en metas comparativas ("47% de tu meta").

### Sobre calorías/macros

- SÍ se cuentan. Viven en Tab Comidas como contexto, no como countdown.
- Proteína es la métrica más cuidada (recomposición).
- Ningún número de comida domina la pantalla home.

### Sobre la voz del coach

- Cálida, Cormorant italic, nunca clínica, nunca de culpa.
- "Hoy tu cuerpo pidió más. ¿Algo pasó?" NO "Te pasaste 500 cal".

### Línea roja (territorio clínico)

- Stelar es app de bienestar, NO clínica.
- NO usar lenguaje clínico: "atracón", "trastorno", "disorder".
- Si se detecta restricción extrema o patrón severo diario → derivar a
  profesional, no diagnosticar.

---

## Convenciones de código

- Componentes funcionales con hooks (nada de clases, salvo ErrorBoundary)
- Patrón por feature: `api.ts` + `hooks.ts` + `logic.ts` + `components/`
- `logic.ts` siempre puro y testeable (sin side effects)
- Archivos: kebab-case. Componentes: PascalCase. Funciones: camelCase.
- Tipos de dominio: inferidos de Zod (`z.infer`), no duplicar
- Validar respuestas Supabase/RPC con Zod en `api.ts`
- Usar las query keys de `lib/queryKeys.ts`, no strings sueltos

---

## Permitido / Pedir permiso / Nunca

### Permitido siempre

- Leer cualquier archivo
- Sugerir cambios mostrando diff
- Correr typecheck, lint, tests en local

### Pedir permiso antes de

- Tocar app.json, eas.json, tsconfig, configs raíz

### NUNCA

- Usar lenguaje clínico o de culpa en copy
- Agregar features que presionen, gamifiquen rachas rígidas, o comparen
- Romper RLS · toda tabla nueva lleva policy `auth.uid() = user_id`
- Meter service role key en cliente (solo EXPO*PUBLIC*\* anon)

---

## Estado actual · post-launch, ejecutando la visión

El launch ya ocurrió (beta con usuarias reales). El trabajo se ordena por
las fases de `docs/product-vision-roadmap.md` (prioridad y dependencia, sin
fechas):

1. **Fase 1** (el registro paga de inmediato · V-01…V-04) — construida.
2. **Fase 2** (Lectura Semanal · V-05/V-06) — motor + superficie
   construidos, doble-gateados a dev (`WEEKLY_READING_ENABLED` +
   `aiEnabledForEmail`); faltan N8 (push), entrada desde Hoy y validación.
3. **Siguiente: Fase 3** (integridad de inputs · lookup honesto de
   alimentos, foto-de-etiqueta, modelo de día parcial).

Antes de construir algo nuevo, revisa `lib/featureFlags.ts` y el "Punto de
partida" del roadmap: gran parte del motor ya existe detrás de flags.

---

## Comandos útiles

```bash
pnpm install
pnpm start                    # expo dev server
pnpm run types:db             # regenerar types desde Supabase
npx tsc --noEmit              # typecheck
pnpm lint                     # eslint
eas build --platform ios --profile preview      # build TestFlight
eas build --platform android --profile preview  # build APK
```
