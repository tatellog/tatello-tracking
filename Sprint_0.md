# Sprint 0 — Bootstrap + morning brief (mock data)

## Contexto del proyecto

App móvil para tracking personal de recomposición corporal (ganar músculo + perder grasa). El core UX es un "morning brief": una pantalla que se abre cada mañana y muestra la racha de entrenamientos (hero grande), comparativa visual de progreso (foto hace 30d vs hoy + cambio medible), métricas del día, y un alert condicional de patrón de riesgo.

Principio rector: **toda pantalla muestra CAMBIO, no solo datos.** "Bajaste 1.8 kg en 4 semanas" > "Pesas 76.2 kg". Si una pantalla solo muestra un número sin contexto de cambio, está mal hecha.

## Stack decidido (no cambiar sin preguntar)

- Expo SDK 51+ / React Native / TypeScript strict
- Expo Router (file-based navigation)
- NativeWind v4 (Tailwind para RN)
- TanStack Query + persist client (server state + offline-ready)
- Zustand (client state, cuando haga falta)
- pnpm como package manager

Backend Supabase viene en Sprint 1. HealthKit / Health Connect en Sprint 3. Auth en Sprint 1.

## Objetivo del Sprint 0

App corriendo en iOS simulator que renderiza el morning brief con data mockeada. Cero backend, cero auth, cero integraciones nativas. El objetivo es validar el visual y fijar la arquitectura del cliente.

---

## Tareas ordenadas

### Tarea 1 — Bootstrap

- `pnpm create expo-app@latest <project-name> --template blank-typescript`
- Activar TS strict en `tsconfig.json`:
  - `"strict": true`
  - `"noUncheckedIndexedAccess": true`
  - `"noImplicitOverride": true`
- `git init` + primer commit

**Done when:** `pnpm start` abre Metro sin errores y TypeScript compila.

### Tarea 2 — Expo Router + estructura de carpetas

- Instalar: `expo-router`, `react-native-safe-area-context`, `react-native-screens`
- Configurar entry point según docs oficiales de Expo Router
- Crear estructura:

```
/app
  _layout.tsx
  (tabs)/
    _layout.tsx
    index.tsx           # morning brief
    progress.tsx        # placeholder
    settings.tsx        # placeholder
/features/
  streak/
  photos/
  brief/
/components/
/lib/
/hooks/
/types/
/mocks/
  photos/
```

- Path aliases en `tsconfig.json`: `@/*` → root
- Verificar que los aliases funcionen en Metro (puede requerir config en `babel.config.js` o `metro.config.js`)

**Done when:** navegación entre 3 tabs funciona con placeholders vacíos.

### Tarea 3 — NativeWind + theme

- Instalar: `nativewind@^4`, `tailwindcss@^3`
- Configurar según docs oficiales (babel plugin, metro config, `global.css`, types)
- `tailwind.config.js` con paleta neutra mínima (no definir toda la escala Tailwind, solo lo que necesitas):
  - Background: `primary` (blanco), `secondary` (off-white), `tertiary`
  - Text: `primary`, `secondary`, `tertiary`
  - Border: `default`, `muted`
  - Radius: `sm`, `md`, `lg`, `xl`
  - Typography scale: `xs`, `sm`, `base`, `lg`, `xl`, `2xl`, `4xl`, `6xl`
- Dark mode habilitado en config (`darkMode: 'media'`) aunque no lo implementemos aún
- Colores como CSS custom properties donde sea posible, para migrar a dark mode fácil después

**Done when:** un `<View className="bg-white p-4 rounded-lg">` aplica estilos correctos en el simulator.

### Tarea 4 — Tooling

- ESLint con config de Expo (`eslint-config-expo`)
- Prettier compartido con ESLint (evitar conflictos)
- `.editorconfig`
- Scripts en `package.json`:
  - `lint`: `eslint . --ext .ts,.tsx`
  - `typecheck`: `tsc --noEmit`
  - `format`: `prettier --write .`

**Done when:** `pnpm lint && pnpm typecheck` pasa sin errores.

### Tarea 5 — Mock data

Crear `/mocks/briefData.ts`:

```ts
export const mockBriefData = {
  date: '2026-04-23',
  dayOfWeek: 'Sábado',
  time: '8:12',
  streak: {
    days: 14,
  },
  progress: {
    beforePhoto: require('./photos/before.jpg'),
    afterPhoto: require('./photos/after.jpg'),
    beforeLabel: 'hace 30 días',
    afterLabel: 'hoy',
    weightDeltaKg: -1.8,
    waistDeltaCm: -2,
    periodWeeks: 4,
  },
  today: {
    weightKg: 76.2,
    sleepHours: 5.8,
  },
  pattern: {
    detected: true,
    message:
      'Sábado + sueño corto. Las últimas 3 veces rompiste la racha. No dejes que hoy sea la 4.',
  },
  todayWorkoutCompleted: false,
}

export type BriefData = typeof mockBriefData
```

- Colocar 2 imágenes jpg placeholder en `/mocks/photos/before.jpg` y `/mocks/photos/after.jpg` (cualquier imagen genérica con orientación vertical ~3:4).

### Tarea 6 — Componentes del morning brief

Ubicación: `/features/brief/components/`

**StreakHero.tsx**
- Layout vertical centrado
- Label superior: "RACHA" (11px, uppercase, letter-spacing amplio, text-tertiary)
- Número grande: 56-64px, font-weight 500, text-primary
- Label inferior: "días entrenando seguido" (13px, text-secondary)
- Props: `{ days: number }`

**ProgressComparison.tsx**
- Label superior: "TU PROGRESO" (mismo estilo que el label de StreakHero)
- Grid 2 columnas con gap pequeño, cada foto aspect-ratio 3:4, rounded-md
- Cada foto con un label flotante en bottom-left (fondo semi-transparente blanco, texto oscuro, padding pequeño): "hace 30 días", "hoy"
- Debajo, frase centrada con los deltas: `−1.8 kg · cintura −2 cm · 4 semanas` (formato con emdash "−" no guión "-")
- Props: `{ before: ImageSource, after: ImageSource, beforeLabel: string, afterLabel: string, weightDeltaKg: number, waistDeltaCm: number, periodWeeks: number }`

**MetricPair.tsx**
- Grid 2 columnas con gap
- Cada item: fondo bg-secondary, rounded-md, padding interno
- Dentro: label pequeño (11px, text-secondary), número grande (18px, font-weight 500), unidad inline más pequeña y muted
- Props: `{ items: Array<{ label: string, value: number | string, unit?: string }> }`

**PatternAlert.tsx**
- Fondo ámbar muy suave (ej custom `bg-amber-soft`), texto ámbar oscuro
- Label "PATRÓN" uppercase arriba (11px, letter-spacing)
- Mensaje debajo en 13px, line-height relaxed
- Solo renderiza si `detected === true` (returns null si false)
- Props: `{ detected: boolean, message: string }`

**WorkoutCheckIn.tsx**
- Botón full-width, padding vertical generoso (~14px), rounded-md
- Label: "¿Entrenaste hoy?" cuando `completed === false`
- Label: "✓ Entrenado hoy" cuando `completed === true` (con estilo success visual distinto)
- Usar `Pressable` con feedback al tap
- Props: `{ completed: boolean, onPress: () => void }`

### Tarea 7 — Morning brief screen

En `/app/(tabs)/index.tsx`:

- `SafeAreaView` + `ScrollView` con padding horizontal generoso
- Header sutil arriba: `{dayOfWeek} · {time}` (text-tertiary, 12px)
- Orden vertical de los bloques con separación (margen vertical 20-28px):
  1. StreakHero
  2. ProgressComparison
  3. MetricPair (con peso y sueño)
  4. PatternAlert (condicional, solo si detected)
  5. WorkoutCheckIn
- Consumir `mockBriefData`
- Estado local (`useState`) para el toggle del workout check-in
- La pantalla debe verse bien en iPhone 13/14/15 y SE (dos tamaños de viewport)

### Tarea 8 — README

Crear `README.md` en la raíz con:
- Descripción breve (1-2 líneas)
- Stack
- Prerequisitos (Node 20+, pnpm, Xcode con simulator)
- Cómo correr: `pnpm install`, `pnpm start`, `i` para iOS simulator
- Estructura de carpetas (breve)
- Scripts disponibles

---

## Acceptance criteria (Sprint 0 done)

1. `pnpm install && pnpm start` corre la app en iOS simulator sin warnings rojos
2. Morning brief screen renderiza los 5 bloques visualmente coherentes
3. La racha "14" es visualmente el hero (font-size ≥56px, centrada)
4. El WorkoutCheckIn actualiza estado local al presionarse y cambia label/estilo
5. `pnpm typecheck` y `pnpm lint` pasan sin errores ni warnings
6. Navegación a las tabs Progress y Settings funciona (aunque sean placeholders vacíos)
7. El README permite a alguien nuevo correr el proyecto siguiendo solo sus instrucciones

---

## Lo que NO se hace en Sprint 0

- Supabase / backend / auth / RLS
- HealthKit / Health Connect / integración con Garmin
- Captura real de fotos (mock photos son suficientes)
- Tests unitarios o E2E
- EAS Build, TestFlight, deploy
- Generación dinámica del texto del brief (es Edge Function, Sprint 2)
- Dark mode (estructurar theme para que sea trivial habilitarlo después, pero no implementarlo)
- RevenueCat / IAP / suscripciones
- Analytics

---

## Notas para Claude Code

- **Decisiones micro (naming, padding exacto, estructura interna de un componente):** adelante sin preguntar.
- **Decisiones macro (cambiar stack, agregar dependencia pesada no listada, reorganizar `/features`):** pregunta antes.
- **Compatibilidad Expo SDK 51:** si una lib tiene issues, usa la versión que Expo Compatibility Matrix recomiende y notifícalo.
- **TypeScript strict real:** cero `any`, cero `as any`. Si un tipo externo es malo, wrap con tu propio tipo.
- **Commits atómicos:** al menos un commit por tarea, idealmente más granular. Mensaje convencional (`feat:`, `chore:`, `refactor:`).
- **Al terminar una tarea, valida su "Done when" antes de pasar a la siguiente.**
- **Al terminar el sprint, valida los Acceptance Criteria uno por uno y reporta cualquiera que no se cumpla.**