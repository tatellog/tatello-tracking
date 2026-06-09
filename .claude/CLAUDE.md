# CLAUDE.md · Stelar

Instrucciones permanentes para Claude Code. Léelo completo antes de tocar
cualquier cosa del repo.

---

## Antes de cualquier cosa

1. Lee `features/docs/product-manifesto.md` (v3.0). Cualquier sugerencia
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
`docs/PRD-v2.md`; el QUÉ NO hacer / cómo habla, en el manifiesto.)

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
features/docs/     · product-manifesto.md · fuente de verdad (v3.0)
docs/PRD-v2.md     · qué construir (nav, Reliquias, Lecturas, Alma Celeste)
```

---

## Glosario V2 (vocabulario canónico · usar estos términos)

- **Reliquias Celestes** · patrones (no registros) que viven en Órbita:
  **Brillo** (qué potencia), **Ancla** (qué mantiene constante), **Pausa**
  (qué ayuda a recuperarse), **Señal Naciente** (cambios que emergen).
- **Lecturas** · la IA de Órbita OBSERVANDO (Diaria / Semanal / Mensual).
  Observa y describe, NUNCA aconseja ni prescribe ("tu energía fue más
  estable cuando dormiste más de 7h" ✓ · "deberías dormir más" ✗).
- **IA de Órbita = Observadora.** No coach, no terapeuta, no nutrióloga.
- **Evolución Celeste / Alma Celeste** · constelación mensual + historial
  de largo plazo. Alma Celeste NO reemplaza la constelación mensual.

---

## Documentos clave (specs derivadas del manifiesto)

El manifiesto (`features/docs/product-manifesto.md`, v3.0) dice **QUÉ** es
Stelar (identidad, voz, línea roja, qué NO hacer). El **PRD V2**
(`docs/PRD-v2.md`) dice **QUÉ CONSTRUIR** (navegación, Reliquias, Lecturas,
constelación mensual, Alma Celeste). Conviven: el manifiesto pone las
barreras, el PRD describe el producto. Estas specs dicen **CÓMO**:

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

## Estado actual · fase MVP de validación

Estoy cerrando el MVP para validar con 3 usuarias + yo. La prioridad
es pulir lo visual y es que el loop core funcione y poder medir uso.

Foco actual (ver STELAR_MVP_PROMPTS.md):

1. Goal + onboarding alineado a Stelar C
2. ErrorBoundary global
3. Analytics de comportamiento (tabla analytics_events)
4. Detección mínima de patrones (el diferenciador)
5. Feedback in-app + build distribuible

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

---

```

```
