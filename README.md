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

## Builds (EAS)

Los builds se generan con **EAS Build** (remoto). El proyecto ya está vinculado
(`slug: tracking-app`, `owner: tatello`, `projectId` en `app.json`). Versionado:
`appVersionSource: remote` — EAS maneja `versionCode`/`buildNumber`; el perfil
`production` los auto-incrementa.

### Prerrequisitos (una vez)

```bash
npm install -g eas-cli      # o usa `npx eas-cli@latest` en cada comando
eas login                   # interactivo
eas whoami                  # confirma sesión
```

iOS para TestFlight requiere **Apple Developer Program ($99/año)** + la app creada
en App Store Connect. Sin la cuenta de paga solo se puede iOS en Simulador
(`--profile simulator`) o Expo Go. Android no requiere nada de esto.

### Android · APK de prueba

```bash
eas build --platform android --profile preview
```

`preview` produce un **APK** (`buildType: apk`, distribución interna). Al terminar,
EAS da un link: ábrelo en el Android y se instala directo.

### iOS · TestFlight

```bash
# 1. Build de tienda (.ipa firmado). La 1ª vez EAS pide credenciales de Apple
#    y crea/gestiona el provisioning por ti.
eas build --platform ios --profile production

# 2. Subir a App Store Connect → TestFlight
eas submit --platform ios --profile production --latest
```

Tras `submit`, el build aparece en **App Store Connect → TestFlight** (procesa
~5-15 min); desde ahí se reparte a los testers. La app debe existir antes en App
Store Connect con el bundle id `com.tatello.stelar`.

### Perfiles disponibles (`eas.json`)

| Perfil        | Para qué                                         | Apple de paga |
| ------------- | ------------------------------------------------ | ------------- |
| `preview`     | APK Android · iOS device ad-hoc                  | iOS sí        |
| `production`  | Tienda (Play Store / TestFlight), auto-increment | iOS sí        |
| `simulator`   | iOS Simulator (`.app`)                           | no            |
| `development` | dev client (internal)                            | iOS sí        |

> Nota: no hace falta `supabase functions deploy` salvo que se toquen las edge
> functions (`supabase/functions/`).

## Convenciones

- Path alias `@/*` → raíz del proyecto
- Commits convencionales (`feat:`, `fix:`, `chore:`, etc.) — enforced por commitlint + husky
- Pre-commit: ESLint + Prettier (`lint-staged`) + `tsc --noEmit`
- Timezone hardcoded: `America/Mexico_City` (cliente y SQL)
- Mensajes y UI en español-MX
