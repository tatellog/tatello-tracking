# STELAR

App móvil para hábitos de recomposición corporal. Marcás tu día y tu constelación zodiacal se ilumina una estrella a la vez, hasta completar los 28 días. Cada pantalla muestra **cambio**, no solo datos (p.ej. "bajaste 1.8 kg en 4 semanas" en vez de "pesás 76.2 kg").

## Stack

- [Expo](https://expo.dev) SDK 54 · React Native 0.81 · TypeScript 5.9 strict
- [Expo Router v6](https://docs.expo.dev/router/introduction/) — file-based routing
- [TanStack Query v5](https://tanstack.com/query) + AsyncStorage persistence
- [Zustand v5](https://zustand-demo.pmnd.rs) — client state
- [Supabase](https://supabase.com) — auth, Postgres, Storage
- [Reanimated v4](https://docs.swmansion.com/react-native-reanimated/) + react-native-svg — la constelación viva
- [NativeWind v4](https://www.nativewind.dev) + Tailwind CSS v3
- pnpm

## Prerequisitos

- Node 20+ (ver `.nvmrc`)
- pnpm ≥ 10
- macOS con Xcode y un iOS runtime instalado
  - Xcode → Settings → Platforms → iOS → **Get** en un runtime reciente
- Supabase CLI para regenerar tipos: `brew install supabase/tap/supabase`

## Cómo correr

```sh
pnpm install
pnpm start
```

En el prompt de Expo: `i` para iOS simulator, `a` para Android emulator, `w` para web.

También directo (builds del dev client nativo):

```sh
pnpm ios       # build + run en iOS simulator
pnpm android   # build + run en Android emulator
pnpm web       # abre en el navegador
```

### Seeds para dev

```sh
pnpm seed:dev          # dev user con 14 días de workouts/meals/measurements
pnpm seed:dev --fresh  # dev user 100% virgen — testear wizard + Día 1
```

Requiere `.env.local` con `SUPABASE_SERVICE_ROLE_KEY` y `DEV_USER_ID`.

## Estructura

```
app/                  Expo Router (auth + onboarding + tabs)
features/
  brief/              get_brief_context RPC + zod schema
  home/               Home screen + cadencia de entrada + grid 28 días
  macros/             Targets de macros + meal log + sugerencias
  moods/              Mood checkins
  onboarding/         Wizard 5 pasos + captura de fotos
  profile/            Datos del usuario
  progress/           Body measurements + charts (d3-shape)
  streak/             Toggle de workout (hoy o cualquier día del grid)
  tabs/               Componentes compartidos (LunarConstellation, etc.)
hooks/                Hooks de plataforma (magic-link, session, etc.)
lib/                  Supabase client, query keys, briefCache, time helpers
supabase/migrations/  Schema versionado (16 migraciones)
theme/                Tokens Pearl Mauve (colors, spacing, typography, motion)
scripts/              Seeds dev/real
```

## Scripts

| Script                                   | Acción                                             |
| ---------------------------------------- | -------------------------------------------------- |
| `pnpm start`                             | Inicia Metro + Expo Dev Server                     |
| `pnpm ios` / `pnpm android` / `pnpm web` | Build + run en el target                           |
| `pnpm lint`                              | ESLint 9 (flat config)                             |
| `pnpm typecheck`                         | `tsc --noEmit` strict + `noUncheckedIndexedAccess` |
| `pnpm format`                            | Prettier con `prettier-plugin-tailwindcss`         |
| `pnpm test` / `pnpm test:watch`          | Jest (`jest-expo`)                                 |
| `pnpm types:db`                          | Regenera `types/database.types.ts` desde Supabase  |
| `pnpm seed:dev [--fresh]`                | Resetea data del dev user                          |

## Convenciones

- Path alias `@/*` → raíz del proyecto
- Commits convencionales (`feat:`, `fix:`, `chore:`, etc.) — enforced por commitlint + husky
- Pre-commit: ESLint + Prettier (`lint-staged`) + `tsc --noEmit`
- Timezone hardcoded: `America/Mexico_City` (cliente y SQL)
- Mensajes y UI en español-MX
