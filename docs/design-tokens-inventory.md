# Inventario de tokens · tabla de decisión (C0)

Generado 5 jul 2026 (regenerable con el script de la sesión). Alimenta la
migración C2 y los overrides de lint C3 del plan (mvp-improvement-plan
Parte 3).

Cubetas: **(a)** el hex ES un token existente escrito a mano → migración
mecánica a `colors.*` (en arte: alias local). **(b)** sin token → candidato
o paleta de escena. **(c)** ARTE exento → el hex es pintura; regla: paleta
en const local al inicio del archivo, nunca forzar a theme/. Los archivos
(c) van a los overrides del lint C3.

## Colores por archivo

| Archivo                                                                              | =token (a) | sin token (b) | Cubeta   | Acción                                    |
| ------------------------------------------------------------------------------------ | ---------- | ------------- | -------- | ----------------------------------------- |
| app/onboarding/appointment.tsx                                                       | 46         | 12            | c · arte | exento (lint override); alias/const local |
| app/onboarding/welcome.tsx                                                           | 12         | 12            | c · arte | exento (lint override); alias/const local |
| features/patterns/components/PatternReveal.tsx                                       | 2          | 18            | c · arte | exento (lint override); alias/const local |
| features/orbit/components/MonthSky.tsx                                               | 2          | 17            | c · arte | exento (lint override); alias/const local |
| features/orbit/components/Cosmos.tsx                                                 | 2          | 14            | c · arte | exento (lint override); alias/const local |
| app/onboarding/what-it-does.tsx                                                      | 1          | 13            | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/static/svg-gradients.tsx            | 11         | 3             | c · arte | exento (lint override); alias/const local |
| features/progress/components/MovementConstellation.tsx                               | 3          | 11            | c · arte | exento (lint override); alias/const local |
| features/orbit/components/WeekConstellation.tsx                                      | 4          | 8             | c · arte | exento (lint override); alias/const local |
| app/onboarding/intention.tsx                                                         | 4          | 7             | c · arte | exento (lint override); alias/const local |
| features/progress/share-styles.ts                                                    | 0          | 10            | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/skia-atmosphere/skia-atmosphere.tsx | 4          | 5             | c · arte | exento (lint override); alias/const local |
| features/orbit/components/OrbitalSystem.tsx                                          | 1          | 8             | c · arte | exento (lint override); alias/const local |
| features/orbit/components/log/MoodSky.tsx                                            | 3          | 6             | c · arte | exento (lint override); alias/const local |
| app/onboarding/about-you.tsx                                                         | 1          | 7             | c · arte | exento (lint override); alias/const local |
| app/onboarding/body-base.tsx                                                         | 1          | 7             | c · arte | exento (lint override); alias/const local |
| app/onboarding/baseline.tsx                                                          | 0          | 7             | c · arte | exento (lint override); alias/const local |
| app/onboarding/notifications.tsx                                                     | 2          | 5             | c · arte | exento (lint override); alias/const local |
| app/onboarding/weight.tsx                                                            | 0          | 7             | c · arte | exento (lint override); alias/const local |
| app/onboarding/rhythm.tsx                                                            | 3          | 4             | c · arte | exento (lint override); alias/const local |
| features/orbit/components/DayPresent.tsx                                             | 3          | 4             | a+b      | migrar =token; evaluar resto              |
| features/onboarding/components/StarConfettiBurst.tsx                                 | 3          | 4             | a+b      | migrar =token; evaluar resto              |
| features/tabs/components/constellation/ZodiacArt.tsx                                 | 6          | 0             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/ignition/igniting-star.tsx          | 0          | 6             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/figure-base/figure-base.tsx         | 6          | 0             | c · arte | exento (lint override); alias/const local |
| features/orbit/components/week-dim-visual.tsx                                        | 4          | 2             | a+b      | migrar =token; evaluar resto              |
| features/orbit/components/DayLiveReadings.tsx                                        | 3          | 3             | a+b      | migrar =token; evaluar resto              |
| features/orbit/components/log/SleepMoonSkia.tsx                                      | 2          | 4             | c · arte | exento (lint override); alias/const local |
| features/onboarding/components/WizardBackdrop.tsx                                    | 1          | 5             | a+b      | migrar =token; evaluar resto              |
| app/onboarding/attribution.tsx                                                       | 0          | 5             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/lit-lines/lit-lines.tsx             | 5          | 0             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/lit-stars/lit-star-flare.tsx        | 5          | 0             | c · arte | exento (lint override); alias/const local |
| features/macros/components/NutritionMoon.tsx                                         | 0          | 5             | b        | evaluar token o const                     |
| app/onboarding/cycle.tsx                                                             | 1          | 3             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/skia-figure/skia-figure.tsx         | 3          | 1             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/ambient/nebula-patches.tsx          | 1          | 3             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/lit-stars/lit-star.tsx              | 3          | 1             | c · arte | exento (lint override); alias/const local |
| features/orbit/components/log/WaterDropSkia.tsx                                      | 1          | 3             | c · arte | exento (lint override); alias/const local |
| features/moods/components/MoodSliderInline.tsx                                       | 3          | 1             | a+b      | migrar =token; evaluar resto              |
| app/(tabs)/orbit.tsx                                                                 | 3          | 0             | a        | migrar a colors.\*                        |
| app/onboarding/reading.tsx                                                           | 0          | 3             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/static/star-sparkle.tsx             | 0          | 3             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/AppTabBar.tsx                                               | 0          | 3             | b        | evaluar token o const                     |
| features/orbit/components/dimensionGlyphs.tsx                                        | 0          | 3             | b        | evaluar token o const                     |
| features/orbit/components/PatternRevealCosmos.tsx                                    | 0          | 3             | c · arte | exento (lint override); alias/const local |
| features/orbit/components/PatternConstellation.tsx                                   | 0          | 3             | c · arte | exento (lint override); alias/const local |
| features/progress/components/ProgressShareSheet.tsx                                  | 0          | 3             | b        | evaluar token o const                     |
| features/onboarding/components/HeightSlider.tsx                                      | 0          | 3             | b        | evaluar token o const                     |
| features/onboarding/components/AtmosphericSky.tsx                                    | 0          | 3             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/ambient/shooting-star.tsx           | 0          | 2             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/ignition/igniting-line.tsx          | 1          | 1             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/overlay/anticipation-crown.tsx      | 2          | 0             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/QuickLogSheet.tsx                                           | 0          | 2             | b        | evaluar token o const                     |
| features/home/components/celebrate-shockwave/palette.ts                              | 2          | 0             | c · arte | exento (lint override); alias/const local |
| features/orbit/constants/constellationTheme.ts                                       | 0          | 2             | b        | evaluar token o const                     |
| features/orbit/components/PresenceFinale.tsx                                         | 0          | 2             | b        | evaluar token o const                     |
| features/orbit/components/WinningCombo.tsx                                           | 0          | 2             | b        | evaluar token o const                     |
| features/orbit/components/StateHeroSky.tsx                                           | 2          | 0             | c · arte | exento (lint override); alias/const local |
| features/orbit/components/DaySegment.tsx                                             | 0          | 2             | b        | evaluar token o const                     |
| components/PrimaryCta.tsx                                                            | 0          | 2             | b        | evaluar token o const                     |
| app/(tabs)/settings.tsx                                                              | 0          | 1             | b        | evaluar token o const                     |
| app/(tabs)/meals.tsx                                                                 | 0          | 1             | b        | evaluar token o const                     |
| features/tabs/components/MealCard.tsx                                                | 0          | 1             | b        | evaluar token o const                     |
| features/tabs/components/StreakLine.tsx                                              | 0          | 1             | b        | evaluar token o const                     |
| features/tabs/components/constellation/LunarConstellation.tsx                        | 0          | 1             | b        | evaluar token o const                     |
| features/tabs/components/constellation/rendering/ambient/cosmic-dust.tsx             | 1          | 0             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/ambient/ambient-field.tsx           | 1          | 0             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/ambient/deep-field.tsx              | 1          | 0             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/field/field-stars.tsx               | 0          | 1             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/lit-stars/today-ring.tsx            | 1          | 0             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/lit-stars/volumetric-rays.tsx       | 1          | 0             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/lit-stars/star-particles.tsx        | 1          | 0             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/lit-cluster/lit-cluster.tsx         | 0          | 1             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/rendering/overlay/center-number-overlay.tsx   | 0          | 1             | c · arte | exento (lint override); alias/const local |
| features/tabs/components/constellation/data/scatter.ts                               | 0          | 1             | b        | evaluar token o const                     |
| features/tabs/components/AllyCard.tsx                                                | 0          | 1             | b        | evaluar token o const                     |
| features/tabs/components/SpeedometerRing.tsx                                         | 0          | 1             | b        | evaluar token o const                     |
| features/tabs/components/TodayMealLog.tsx                                            | 0          | 1             | b        | evaluar token o const                     |
| features/orbit/components/WeekOrbitGalaxy.tsx                                        | 0          | 1             | b        | evaluar token o const                     |
| features/orbit/components/PatternDiscovery.tsx                                       | 0          | 1             | b        | evaluar token o const                     |
| features/orbit/components/MonthSegment.tsx                                           | 1          | 0             | a        | migrar a colors.\*                        |
| features/orbit/components/ObservationChart.tsx                                       | 0          | 1             | b        | evaluar token o const                     |
| features/orbit/components/stairs/StairsScene.tsx                                     | 1          | 0             | c · arte | exento (lint override); alias/const local |
| features/progress/components/CycleRing.tsx                                           | 0          | 1             | b        | evaluar token o const                     |
| features/progress/components/ProgressShareCard.tsx                                   | 0          | 1             | c · arte | exento (lint override); alias/const local |
| features/progress/components/TrainingShareCard.tsx                                   | 0          | 1             | c · arte | exento (lint override); alias/const local |
| features/water/components/LiquidDetectionSheet.tsx                                   | 0          | 1             | b        | evaluar token o const                     |
| features/revelations/components/TransformationReveal.tsx                             | 0          | 1             | c · arte | exento (lint override); alias/const local |
| features/macros/components/GoalIcons.tsx                                             | 1          | 0             | a        | migrar a colors.\*                        |
| features/onboarding/components/ManifiestoOrb.tsx                                     | 1          | 0             | a        | migrar a colors.\*                        |
| features/onboarding/components/OptionRow.tsx                                         | 0          | 1             | b        | evaluar token o const                     |
| features/onboarding/components/DateField.tsx                                         | 1          | 0             | a        | migrar a colors.\*                        |
| features/onboarding/photos/components/PhotoCaptureCard.tsx                           | 0          | 1             | b        | evaluar token o const                     |

## Valores sin token recurrentes (candidatos vs pintura)

| Hex               | Usos  | Veredicto                                                                                                                                          |
| ----------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| #FFFFFF           | ~102  | Pintura (núcleos de estrella/glints). NO tokenizar; const local `WHITE` por escena.                                                                |
| #FBD7E3           | ~39   | Glow magenta pálido, recurrente ENTRE escenas → candidato a paleta de escena compartida (`theme/scene.ts` o const por archivo). Decisión de dueña. |
| #E8D9DD           | ~19   | Tinte de estrella media (arte). Const local.                                                                                                       |
| #FFE9D6           | ~10   | Flare cálido (arte). Const local.                                                                                                                  |
| #EEDD91 / #DCCC7B | pocos | Oro de ilustración (familia vect). Es pintura de ilustración, exenta.                                                                              |
| resto (<7 usos)   | —     | Pintura puntual de escena. Exentos.                                                                                                                |

## fontSize numérico fuera de la ramp (por archivo, top)

| Archivo                                                | Ocurrencias |
| ------------------------------------------------------ | ----------- |
| features/orbit/components/MonthSegment.tsx             | 20          |
| features/orbit/components/WeekSegment.tsx              | 18          |
| features/tabs/components/calendar/DayDetailContent.tsx | 15          |
| features/orbit/components/DayPresent.tsx               | 10          |
| features/emblem/components/TransformationCard.tsx      | 10          |
| app/(tabs)/settings.tsx                                | 9           |
| app/(tabs)/progress.tsx                                | 9           |
| features/tabs/components/QuickLogSheet.tsx             | 7           |
| features/orbit/components/DaySegment.tsx               | 7           |
| features/tabs/components/DayCheckIn.tsx                | 5           |
| features/tabs/components/DaySky.tsx                    | 5           |
| app/onboarding/day-one.tsx                             | 4           |
| app/onboarding/welcome.tsx                             | 4           |
| features/tabs/components/TodayUniverseRewards.tsx      | 4           |
| features/orbit/components/WinningCombo.tsx             | 4           |
| (total)                                                | 272         |

Acción C2: mapear al rol más cercano de `theme/text-styles.ts` al migrar
cada superficie. Los tamaños hero de arte/escena (52, 36 display) pueden
ganar rol (`heroNumber`, `screenTitle`) o quedar exentos si son escena.

## Duplicados de ramp detectados (decisión C1)

- `deltaNum` (28) = `tilePlus` (28): mismo valor → fusionar en uno (rename
  sin cambio visual).
- `micro` (11) vs `caption` (11.5): fusión CAMBIA visuales 0.5px en muchos
  sitios → decisión de dueña, no automática.
- `title` (16) vs `anchor` (17): evaluar en C2.

## Iconos (censo 5 jul)

- Feather (chrome utilitario, legítimo): chevron-left ×5, x ×2, camera,
  arrow-right, chevron-right, eye (auth). Regla: nunca conceptos de producto.
- Familia line-art currentColor: assets/icons (\*-tint, orbits, food-vect,
  north-star-tint NUEVO). Huecos cerrados: water (4 jul), north-star (5 jul).
- Ilustraciones vect (fills horneados): NO son iconos; tamaño hero solamente.
- Unicode: ✦ = marca (constante santificada). › ‹ ✓ ↑ funcionales (~26
  sitios) → migración gradual en C2.
- Back: TRES lenguajes (Feather ‹ / "‹ ATRÁS" wizard / "‹ Volver a...") →
  unificar al patrón de Agua en C2.
