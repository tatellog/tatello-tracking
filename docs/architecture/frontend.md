# Frontend · Stelar

> Expo SDK 54 + React Native 0.81 + React 19 + Expo Router. Sistema visual y
> convenciones en el `CLAUDE.md` raíz. Este doc mapea la capa cliente.

## Stack

- **Framework/routing:** Expo SDK 54, RN 0.81, React 19, Expo Router.
- **Data:** TanStack Query v5 (keys centralizadas en `lib/queryKeys.ts`).
- **Animación:** Reanimated 4 (+ worklets 0.5.x, newArch), Skia para atmósferas pesadas.
- **Estilos:** NativeWind + tokens en `theme/` (color, tipografía, spacing, motion).
- **Validación:** Zod en los bordes. **Lenguaje:** TypeScript estricto. React Compiler ON.

## Patrón por feature

```
features/<feature>/
  api.ts         Zod + Supabase (valida respuestas)
  hooks.ts       React Query (usa lib/queryKeys)
  logic.ts       puro, testeable (sin side effects)
  components/     UI
```

## Sistema visual (resumen)

- Fondo `#0A0608`; texto `leche #F4ECDE`; acento magenta/fucsia.
- **Tipografías:** Cormorant italic = voz del coach (SOLO poético/cálido);
  Hanken = UI y **dato/números**; Inter/Geist = números crudos.
- Iconos SVG tintables; estrella ✦ = firma de Stelar. Solo dark mode.

## Reglas de animación (memoria dura)

- Nunca animar `colors` de gradiente Skia (crash nativo) — solo opacidad/escala/radio.
- Sin `rotate` en transform-array (bug Android release) — usar props `rotation/originX/originY`.
- `withRepeat` en `useEffect` + `cancelAnimation` en unmount.
- Helpers dentro de worklets llevan `'worklet'` (crash en release APK si no).
- Validar cambios de animación con el agente `reanimated-guardian`.

## Órbita Mes · el flujo de IA (R2, ya construido)

```
Tab Mes (MonthSegmentIA)
  hero emblema
  ▸ teaser "He detectado algo · sobre tus días con agua"  (MonthDiscoveryTeaser)
      └─ Descubrir ─▶ REPORTE (MonthReport, determinístico)
             VEREDICTO   (déficit sostenido, no la balanza)
             DÓNDE SE TE VA  (obstáculos: día que rompe la dieta, gym como ancla)
             puerta abierta (cierre cálido)
                └─ tocar un hecho "Entenderlo →" ─▶ chat fact-led (FindingChatView)
                       turno 0/1/2 con chips · TypingDots · cierra al reporte
  calendario del mes (evidencia, tap→Día)
```

- **El reporte es determinístico** (cero IA). La IA vive solo en el chat.
- `finding-constellations.tsx` — objetos de constelación (relación A↔déficit,
  brazalete de déficit, silueta de semana) reusados en reporte y chat.
- Voz IA cliente: `features/orbit/ai-voice.ts` (`fetchMonthChatTurn`, gate por email).

## Componentes clave (Órbita Mes)

| Archivo                                | Rol                                                               |
| -------------------------------------- | ----------------------------------------------------------------- |
| `MonthSegmentIA.tsx`                   | orquesta: teaser → reporte → dig-in                               |
| `MonthReport.tsx`                      | reporte de evidencia determinístico (veredicto/obstáculos/cierre) |
| `MonthDiscoveryTeaser.tsx`             | teaser híbrido (intriga + dimensión honesta)                      |
| `FindingChatView.tsx`                  | chat guiado con IA (fact-led, fallback determinístico)            |
| `FindingView.tsx`                      | chat scripteado (fallback beta sin IA)                            |
| `finding-constellations.tsx`           | los objetos de constelación                                       |
| `InsightCharts.tsx`                    | gráficas mínimas de evidencia (weekdayBars/dotTimeline)           |
| `TypingDots.tsx` / `DiscoveryWave.tsx` | "escribiendo" / onda ceremonial                                   |

## Degradación grácil

Si la IA está apagada (no `aiEnabledForEmail`) o falla: el reporte determinístico
se muestra igual, y el chat cae al beat determinístico o al `FindingView` scripteado.
