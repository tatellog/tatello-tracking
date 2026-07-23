# STELAR

App de pérdida de peso sostenible. Trackea calorías, macros, déficit y peso
con rigor, pero los pone en contexto, no en el centro: un motor
determinístico analiza los patrones en tus propios datos (qué rompe tus
días, qué los sostiene) y te devuelve lecturas honestas — la Lectura del
día en Hoy, la Lectura Semanal, los patrones de Órbita. Las constelaciones
son el lenguaje visual del progreso; no hay countdown, rachas ni culpa. La
IA solo explica lo que el motor ya detectó, nunca detecta ni inventa.

## Documentación

- `docs/product-manifesto.md` — QUÉ es Stelar, su voz y su línea
  roja (v3.0, manda sobre todo).
- `docs/PRD-v2.md` — QUÉ construir.
- `docs/product-vision-roadmap.md` — HACIA DÓNDE: visión, métricas norte y
  roadmap por fases (V-01…V-19) con su estado.
- `docs/` — specs por feature · `docs/archive/` — histórico, no fuente de
  verdad.
- `.claude/CLAUDE.md` — reglas de trabajo del repo.

## Stack

- [Expo](https://expo.dev) SDK 54 · React Native 0.81 · React 19 (React Compiler ON) · TypeScript 5.9 strict
- [Expo Router](https://docs.expo.dev/router/introduction/) — file-based routing
- [TanStack Query v5](https://tanstack.com/query) + AsyncStorage persistence
- [Supabase](https://supabase.com) — auth, Postgres (RLS estricto), Storage, Edge Functions (Deno)
- [Reanimated v4](https://docs.swmansion.com/react-native-reanimated/) + react-native-svg + [Skia](https://shopify.github.io/react-native-skia/) — la constelación viva
- [NativeWind v4](https://www.nativewind.dev) + Tailwind CSS v3
- [Zod](https://zod.dev) en los bordes (respuestas Supabase/RPC/edge)
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
app/                  Expo Router: (tabs) Hoy · Comidas · Órbita · Progreso ·
                      Ajustes + onboarding (12 pasos) + modales/pantallas
features/             una carpeta por feature: api.ts (Zod+Supabase) +
                      hooks.ts (React Query) + logic.ts (puro) + components/
  orbit/              Órbita Día/Semana/Mes · lee de daily_signals
  macros/             comidas + meal scan (IA)
  progress/           Historia + Body + medidas
  tabs/               bottom nav + componentes compartidos (constelación)
hooks/                hooks de plataforma (session, magic-link, etc.)
lib/                  cliente Supabase, queryKeys, featureFlags, analytics
supabase/
  migrations/         schema versionado · toda tabla con RLS
  functions/          edge functions · _shared/intelligence/ = EL motor
                      (corre en server y cliente vía re-export)
theme/                design tokens (colors, spacing, typography, motion)
scripts/              seeds dev/real
```

El detalle completo (convenciones, reglas del motor, glosario) vive en
`.claude/CLAUDE.md`.

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
