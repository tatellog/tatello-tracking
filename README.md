# tracking-app

App móvil para tracking personal de recomposición corporal. Cada pantalla muestra **cambio**, no solo datos (p.ej. "bajaste 1.8 kg en 4 semanas" en vez de "pesas 76.2 kg").

Sprint 0 renderiza el "morning brief" con datos mockeados: racha, comparativa visual de fotos, métricas del día, alerta condicional de patrón, y check-in de entrenamiento.

## Stack

- [Expo](https://expo.dev) SDK 54 · React Native 0.81 · TypeScript 5.9 strict
- [Expo Router v6](https://docs.expo.dev/router/introduction/) (file-based)
- [NativeWind v4](https://www.nativewind.dev) + Tailwind CSS v3
- pnpm

Próximamente (fuera de Sprint 0): TanStack Query, Zustand, Supabase, HealthKit / Health Connect.

## Prerequisitos

- Node 20+ (ver `.nvmrc`)
- pnpm ≥ 9
- macOS con Xcode y un iOS runtime instalado
  - Xcode → Settings → Platforms → iOS → **Get** en un runtime reciente

## Cómo correr

```sh
pnpm install
pnpm start
```

En el prompt de Expo: `i` para iOS simulator, `a` para Android emulator, `w` para web.

También directo:

```sh
pnpm ios      # abre el simulator iOS
pnpm android  # abre el emulator Android
pnpm web      # abre en el browser
```

## Estructura

```
app/                      Expo Router (_layout + (tabs) con 3 screens)
features/brief/           Feature "morning brief"
  types.ts                Tipos del dominio
  useBriefData.ts         Hook que alimenta la pantalla (mock hoy, API mañana)
  format.ts               Formateo puro de deltas
  components/             Componentes presentacionales del brief
mocks/                    Datos y assets de desarrollo
  briefData.ts
  photos/                 Placeholders before/after
assets/                   Ícono, splash, etc (scaffold Expo)
global.css                Variables CSS del theme
tailwind.config.js        Tokens (bg/text/border/radius/fontSize)
```

## Scripts

| Script                                   | Acción                                                 |
| ---------------------------------------- | ------------------------------------------------------ |
| `pnpm start`                             | Inicia Metro + Expo Dev Server                         |
| `pnpm ios` / `pnpm android` / `pnpm web` | Abre la app en el target                               |
| `pnpm lint`                              | ESLint 9 (flat config)                                 |
| `pnpm typecheck`                         | `tsc --noEmit` con strict + `noUncheckedIndexedAccess` |
| `pnpm format`                            | Prettier con `prettier-plugin-tailwindcss`             |

## Convenciones

- Path alias `@/*` → raíz del proyecto
- Commits convencionales (`feat:`, `chore:`, `refactor:`, `fix:`) y atómicos por tarea
- Dark mode: theme preparado (CSS vars + `darkMode: 'media'`) pero no implementado aún
