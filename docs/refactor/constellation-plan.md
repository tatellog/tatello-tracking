# Constellation refactor · Paso 2 · Plan de extracción

Basado en `constellation-map.md`. Define el orden de extracción de menor a
mayor riesgo, cómo validar equivalencia, qué señales mirar.

---

## 0 · Resumen ejecutivo

- **24 fases × 2 commits** (≈ 48 commits) — granularidad para revertir cualquier paso solo.
- **Patrón strangler-fig dual**: cada fase tiene Commit A (construir en paralelo, NO usar) y Commit B (reemplazar uso dentro del original).
- **Riesgo creciente**: puro → estático → animación simple → animación compleja → hooks → contenedor delgado.
- **Hooks van al final**: mover los relojes (t/slowT/breathT/driftT) sólo cuando TODOS los consumidores ya estén extraídos, porque cualquier consumidor in-line quedaría apuntando a un SV distinto.
- **API pública intacta**: `import { LunarConstellation } from '@/features/tabs/components/LunarConstellation'` debe funcionar igual en todo momento.

---

## 1 · Principios que ordenan el plan

1. **Strangler-fig dual por capa**. Una fase = una capa nueva. Cada fase produce 2 commits independientes: A construye la pieza al lado sin usarla, B reemplaza el uso adentro del original. Si B se rompe, revierto sólo B; A queda como código muerto temporal que el siguiente intento puede aprovechar.
2. **Topología de dependencias**. Lo que produce datos antes que lo que los consume. Constantes/types antes que data builders. Data antes que rendering. Rendering antes que hooks compuestos.
3. **SharedValues compartidos al final**. Mientras haya un componente in-line que recibe `t` desde el closure del orchestrator, no se puede mover `t` a un hook. Por eso `useConstellationClocks` es F19, no F1.
4. **API pública intacta**. Cada commit del refactor debe dejar el archivo importable como antes. La carpeta destino re-exporta `LunarConstellation` desde `index.tsx`.
5. **Move, don't improve**. Si al extraer veo código mejorable, lo dejo donde estaba y lo anoto en `dry-candidates.md`. Mejoras van como commits separados DESPUÉS del refactor entero.

---

## 2 · Mapa de validación por tipo de fase

| Tipo de fase                          | Validación primaria                    | Validación secundaria                                              | Device real?  |
| ------------------------------------- | -------------------------------------- | ------------------------------------------------------------------ | ------------- |
| Pure / data (F1-F6)                   | Unit test (Jest) input/output          | Snapshot RNTL del componente sin cambios                           | Opcional      |
| Animated components alias (F7)        | TypeScript compila                     | Snapshot RNTL                                                      | No            |
| Static rendering (F8)                 | Snapshot RNTL                          | visual-diff.sh                                                     | No            |
| Animated rendering simple (F9-F14)    | Snapshot RNTL + visual-diff.sh         | Inspección visual en simulador                                     | Sí (smoke)    |
| Animated rendering complejo (F15-F18) | Snapshot RNTL + visual-diff.sh         | Grabación de video frame-a-frame                                   | **Sí (full)** |
| Hooks de animation (F19-F21)          | Visual smoke + device real iOS+Android | Inspección de performance (Reanimated DevTools si está habilitado) | **Sí (full)** |
| Hooks de data (F22-F23)               | Unit test del hook + snapshot          | Visual smoke                                                       | No            |
| Contenedor delgado (F24)              | Snapshot RNTL + visual-diff.sh         | Device real flujo completo                                         | **Sí (full)** |

"Device real" hoy = Expo Go en simulador iOS + emulador Android (no hay paid
Apple Dev cuenta). Las fases marcadas **Sí (full)** deben probarse en ambos.

---

## 3 · Tabla maestra

| Fase | Carpeta destino                                                    | Contenido                                                                                                | Deps                         | Riesgo   |
| ---- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------- | -------- |
| F1   | `constellation/geometry/`                                          | starRadius, recencyHaloMultiplier, fourPointStarPath, burstHash                                          | —                            | Bajo     |
| F2   | `constellation/types.ts`                                           | Resolved, SequenceEl, Props, AmbientStar, DustParticle, DeepStar                                         | —                            | Bajo     |
| F3   | `constellation/constants.ts`                                       | W, H, PAD, TARGET_DAYS, magic numbers de animación                                                       | —                            | Bajo     |
| F4   | `constellation/data/sign-maps.ts`                                  | ART_BY_SIGN, SIGN_ENGRAVINGS, SIGN_CONSTELLATION_TRANSFORM                                               | —                            | Bajo     |
| F5   | `constellation/data/scatter.ts`                                    | DUST, WINK_POSITIONS, BUCKET_DRIFT, MOTE_LAYOUT, BURST_ANGLES, SPARK_HUES, DEEP_STARS, buildAmbientField | F2, F3                       | Bajo     |
| F6   | `constellation/data/derive-progress.ts`                            | buildFieldStars + deriveProgress                                                                         | F2, F3                       | Medio    |
| F7   | `constellation/animation/animated-components.ts`                   | AnimatedCircle, AnimatedG, AnimatedLine, AnimatedTextInput, AnimatedBlurView                             | —                            | Bajo     |
| F8   | `constellation/rendering/static/`                                  | SvgGradients, AmbientGlow, StarSparkle                                                                   | F3, F7                       | Bajo     |
| F9   | `constellation/rendering/ambient/`                                 | DeepField, AmbientField+Bucket, NebulaPatches, CosmicDust+DustMote, StarWinks+Wink, ShootingStar         | F1, F3, F5, F7               | Medio    |
| F10  | `constellation/rendering/skeleton/`                                | CanvasSkeleton + SkeletonStar + SkeletonLine                                                             | F2, F3, F7                   | Bajo     |
| F11  | `constellation/rendering/field/`                                   | FieldStars + FieldStar                                                                                   | F3, F7                       | Bajo     |
| F12  | `constellation/rendering/figure-base/`                             | BaseLayer + PlaceholderStar + HeroGlow                                                                   | F1, F2, F7, F8 (StarSparkle) | Medio    |
| F13  | `constellation/rendering/lit-cluster/`                             | LitClusterAura + LitClusterMotes + ClusterMote                                                           | F3, F5, F7                   | Bajo     |
| F14  | `constellation/rendering/lit-lines/`                               | LitLines + LitLineFilament                                                                               | F2, F7                       | Medio    |
| F15  | `constellation/rendering/lit-stars/`                               | StarsLayer + NextStar + LitStar + VolumetricRays + TodayRing + StarParticles + StarSpark + LitStarFlare  | F1, F2, F7, F8               | **Alto** |
| F16  | `constellation/rendering/ignition/`                                | IgnitingOverlay + IgnitingStar + BurstSpark + IgnitingLine                                               | F1, F2, F7                   | Medio    |
| F17  | `constellation/rendering/burst/`                                   | StarBurst + BurstCore + ParticleBurst + ParticleSpark                                                    | F1, F5, F7                   | Medio    |
| F18  | `constellation/rendering/overlay/`                                 | CenterNumberOverlay + AnticipationCrown + CompletionRings                                                | F3, F7                       | Medio    |
| F19  | `constellation/animation/use-clocks.ts`                            | useConstellationClocks (t, slowT, breathT, driftT)                                                       | F7                           | **Alto** |
| F20  | `constellation/animation/use-canvas-reveal.ts`                     | useCanvasReveal (canvasReady, revealBlur)                                                                | F7                           | Bajo     |
| F21  | `constellation/animation/use-ignition-engine.ts`                   | useIgnitionEngine (queue, igniteT, pulses, plusOne, displayedCount, rayPresence)                         | F2                           | **Alto** |
| F22  | `constellation/data/use-figure-geometry.ts`                        | useFigureGeometry (alphaIdx, alphaPos, starDepth, lineDepth)                                             | F2                           | Medio    |
| F23  | `constellation/data/use-lit-maps.ts`                               | useLitMaps (litKeys, litCluster, starRecency)                                                            | F2                           | Medio    |
| F24  | `constellation/LunarConstellation.tsx` + `constellation/index.tsx` | Contenedor delgado + re-export + styles                                                                  | TODO                         | Bajo     |

---

## 4 · Detalle por fase

Convención para cada fase: **Commit A** = construir paralelo; **Commit B** = reemplazar uso adentro del original.
En el último commit del refactor (F24) la división se rompe — es un solo commit que termina la rendición.

### F1 — `geometry/`

**Qué se extrae**

- `geometry/star-radius.ts` ← `starRadius` (líneas 121-130)
- `geometry/recency-halo.ts` ← `recencyHaloMultiplier` (líneas 137-145)
- `geometry/four-point-star-path.ts` ← `fourPointStarPath` + `STAR_INNER_RATIO` (líneas 114-158)
- `geometry/burst-hash.ts` ← `burstHash` (líneas 1516-1519)

**Por qué este orden**: 100 % puro, 0 deps de React/Reanimated, 0 closure externa. Es el "hola mundo" del refactor. Si esto falla, el problema NO es el código del refactor sino la infra (tsconfig, jest, paths).

**Commit A**: crear los 4 archivos. Exportar named. Sin uso en `LunarConstellation.tsx`.
**Commit B**: reemplazar las 4 definiciones in-line por imports.

**Validación**

- Unit tests con ≥3 casos por función. Comparar con outputs calculados a mano.
- `pnpm run types:db` no aplica; `npx tsc --noEmit` debe pasar.
- Snapshot RNTL del componente — debe ser idéntico (es el mismo código sólo importado).
- `visual-diff.sh` — 0 diferencias.

**Señales de "se rompió"**

- Unit test rojo en cualquier función: la fórmula extraída no coincide con la in-line.
- Snapshot diff: el componente renderiza distinto, probablemente importó la fn equivocada o el módulo no exporta lo que crees.

**Riesgo**: Bajo.

---

### F2 — `types.ts`

**Qué se extrae**

- `types.ts` ← `Resolved`, `SequenceEl`, `Props`, `AmbientStar`, `DustParticle`, `DeepStar`

**Por qué este orden**: tipos no afectan runtime; mover types primero permite usar imports tipados en las fases siguientes (F5+ usa `AmbientStar`, F6 usa `SequenceEl`, etc.).

**Commit A**: crear `types.ts` con las definiciones.
**Commit B**: en `LunarConstellation.tsx`, borrar las definiciones in-line y reemplazar por `import type { … } from './constellation/types'`.

**Validación**

- `npx tsc --noEmit` pasa.
- Snapshot RNTL idéntico.
- `visual-diff.sh` 0 diferencias.

**Señales de "se rompió"**

- TS rojo. Re-exportar tipos correctamente desde `types.ts`.

**Riesgo**: Bajo.

---

### F3 — `constants.ts`

**Qué se extrae**

- `constants.ts` ← `W`, `H`, `PAD`, `TARGET_DAYS`, `IGNITE_STAR_MS`, `IGNITE_LINE_MS`, `NUMBER_COUNTUP_MS`, `AMBIENT_STAR_COUNT`, `AMBIENT_BUCKET_COUNT`, `AMBIENT_LAYERS`, `AMBIENT_PER_LAYER_ALPHA`, `AMBIENT_RX_MAX`, `AMBIENT_RX_MIN`, `AMBIENT_ASPECT`, `NEBULA_LAYERS`, `HERO_MAG`, `SPARKLE_MAG`, `PARTICLE_BASE`, `PARTICLE_REACH`, `SPARK_BASE`

**Por qué este orden**: agrupar números mágicos antes que cualquier código que los consume. Asegura que el reemplazo en fases siguientes sea sólo "importa y usa".

**Commit A**: crear archivo con todas las constantes export const.
**Commit B**: reemplazar declaraciones in-line por imports. Cuidado con que NO se dupliquen (el TS lint puede no avisar si declaras + importas con el mismo nombre y le pegás un `as` por error).

**Validación**

- TS pasa.
- Snapshot RNTL idéntico.
- `visual-diff.sh` 0 diferencias.

**Señales de "se rompió"**

- Snapshot diff: cambió algún valor numérico, probablemente al teclear el archivo.

**Riesgo**: Bajo.

---

### F4 — `data/sign-maps.ts`

**Qué se extrae**

- `data/sign-maps.ts` ← `ART_BY_SIGN`, `SIGN_ENGRAVINGS`, `SIGN_CONSTELLATION_TRANSFORM` (líneas 53-109)

**Por qué este orden**: data estática per-signo, sin deps de runtime. Antes de F9 (ambient usa sign-specific transforms) y F15 (lit-stars).

**Commit A**: crear archivo con los 3 maps + sus 12 imports de SVG assets.
**Commit B**: borrar in-line + importar.

**Validación**

- TS pasa.
- Snapshot RNTL para los 12 signos (la red de seguridad del Paso 3 debe cubrir esto).
- Visual: verificar que cada signo sigue mostrando su transform correcto.

**Señales de "se rompió"**

- Un signo aparece mal posicionado (transform incorrecto) → el map no se exportó/importó bien para ese signo.
- Asset que no carga → import path malo en el nuevo archivo.

**Riesgo**: Bajo.

---

### F5 — `data/scatter.ts`

**Qué se extrae**

- `data/scatter.ts` ← `DUST`, `WINK_POSITIONS`, `BUCKET_DRIFT`, `MOTE_LAYOUT`, `BURST_ANGLES`, `SPARK_HUES`, `DEEP_STARS` (IIFE → const), `buildAmbientField`

**Por qué este orden**: data de scatter usada por ambient rendering (F9). Aún no movemos los componentes, sólo la data deterministica.

**Commit A**: crear archivo. `DEEP_STARS` debe quedar como `const` (no IIFE) — la IIFE se ejecuta al importar, lo cual es exactamente lo mismo que tenía en el original.
**Commit B**: borrar in-line + importar.

**Validación**

- Unit test `buildAmbientField()` debe devolver una estructura con 5 buckets sumando 60 (o menos por el filtro central).
- Unit test `DEEP_STARS` debe tener ~28 entradas (post-filtro).
- Snapshot RNTL idéntico.

**Señales de "se rompió"**

- Twinkle del fondo cambia de patrón → el deterministic seed cambió.
- Deep stars cambian de posición → IIFE corrió en otro orden.

**Riesgo**: Bajo.

---

### F6 — `data/derive-progress.ts`

**Qué se extrae**

- `data/derive-progress.ts` ← `buildFieldStars` + `deriveProgress` (líneas 887-993)

**Por qué este orden**: ya tenemos `SequenceEl` (F2), `TARGET_DAYS` (F3). Este es el core business logic — toda la figura depende de su output. Lo movemos solo, en su fase aparte, con tests robustos antes de cualquier componente de rendering que lo consuma.

**Commit A**: crear archivo. Exportar `buildFieldStars` (para tests) y `deriveProgress`.
**Commit B**: borrar in-line + importar.

**Validación**

- Unit tests obligatorios:
  - `trained = Array(28).fill(false)` → `trainedCount = 0`, `elementsLit = 0`, `isComplete = false`.
  - `trained = Array(28).fill(true), todayIdx = 27` → `trainedCount = 28`, `isComplete = true`.
  - Aries (zodiac con menos stars) + todayIdx = 14, trained 10 true → sequence tiene field stars interleaved correctamente.
  - Undo: trainedCount baja, sequence se mantiene estable (porque depende de zodiac no de trained).
  - Snapshot del output completo para un caso fijo (aries + 7 true + todayIdx=7).
- Snapshot RNTL del componente con un caso fijo de entrada.

**Señales de "se rompió"**

- Cualquier diff en `trainedCount`/`elementsLit`/`sequence` con los mismos inputs → la fn no es bit-equivalente. REVERTIR INMEDIATAMENTE.
- La figura ilumina elementos en orden distinto.

**Riesgo**: Medio (es pura, fácil de validar, pero el blast radius es enorme).

---

### F7 — `animation/animated-components.ts`

**Qué se extrae**

- `animation/animated-components.ts` ← `AnimatedCircle`, `AnimatedG`, `AnimatedLine`, `AnimatedTextInput`, `AnimatedBlurView` (líneas 160-164)

**Por qué este orden**: estos aliases son hojas de Reanimated reutilizables por TODOS los componentes animados (F8+). Mejor que cada subcarpeta de rendering los re-importe desde un solo lugar.

**Commit A**: crear archivo con los 5 `createAnimatedComponent` calls.
**Commit B**: borrar in-line + importar.

**Validación**

- TS pasa.
- Snapshot RNTL idéntico.

**Señales de "se rompió"**

- Componentes animados dejan de animarse → `createAnimatedComponent` se llamó en mal momento (debe ser module-level, no por render). Verificar que no hay un render que crea uno nuevo cada vez.

**Riesgo**: Bajo (pero verificar que sigue siendo single-instance del wrapper).

---

### F8 — `rendering/static/`

**Qué se extrae**

- `rendering/static/svg-gradients.tsx` ← `SvgGradients` (líneas 995-1048)
- `rendering/static/ambient-glow.tsx` ← `AmbientGlow` (líneas 1064-1091)
- `rendering/static/star-sparkle.tsx` ← `StarSparkle` (líneas 1971-2051)

**Por qué este orden**: 0 SharedValue, 0 worklets. La fase más simple del bloque rendering. Sienta el patrón para las fases siguientes.

**Commit A**: crear los 3 archivos. Export named.
**Commit B**: borrar in-line + importar.

**Validación**

- Snapshot RNTL idéntico.
- `visual-diff.sh` 0 diferencias.

**Señales de "se rompió"**

- Gradientes no aparecen → SvgGradients no se renderiza dentro del Svg padre, o IDs cambiaron.
- AmbientGlow no aparece → centerX/Y mal calculado.

**Riesgo**: Bajo.

---

### F9 — `rendering/ambient/`

**Qué se extrae**

- `rendering/ambient/deep-field.tsx` ← `DeepField`
- `rendering/ambient/ambient-field.tsx` ← `AmbientField` + `AmbientBucket`
- `rendering/ambient/nebula-patches.tsx` ← `NebulaPatches`
- `rendering/ambient/cosmic-dust.tsx` ← `CosmicDust` + `DustMote`
- `rendering/ambient/star-winks.tsx` ← `StarWinks` + `StarWink`
- `rendering/ambient/shooting-star.tsx` ← `ShootingStar`

**Por qué este orden**: primer bloque animado, pero todas las animaciones son ambient (background) — un bug visible no rompe la funcionalidad core, sólo la sensación atmosférica. Buen ground zero para el patrón "mover componente animado".

**Commit A**: 6 archivos en paralelo, sin uso.
**Commit B**: reemplazar 6 declaraciones + sus usos en el JSX del orchestrator.

**Validación**

- Snapshot RNTL idéntico.
- `visual-diff.sh` 0 diferencias.
- Inspección visual en simulador: el twinkle del fondo debe ser indistinguible, las shooting stars cruzan al mismo timing.
- Device smoke: 30 segundos viendo el canvas en iOS Sim — sin jank, sin trabazón.

**Señales de "se rompió"**

- Ambient stars dejan de twinkle → AmbientBucket perdió el SV de t o drift.
- Shooting stars no cruzan → ShootingStar dejó de recibir t.
- Nebula no drift → NebulaPatches recibe ax/ay sin alphaPos resuelto.

**Riesgo**: Medio (primer mover animado, varios componentes).

---

### F10 — `rendering/skeleton/`

**Qué se extrae**

- `rendering/skeleton/canvas-skeleton.tsx` ← `CanvasSkeleton` + `SkeletonStar` + `SkeletonLine` (líneas 229-349)

**Por qué este orden**: el skeleton es self-contained (su propio SV interno `build`), no necesita SVs del orchestrator. Otra fase tranquila.

**Commit A**: crear archivo.
**Commit B**: reemplazar in-line + importar.

**Validación**

- Snapshot del estado pre-canvasReady.
- Inspección visual: hold de 1500 ms con el skeleton drawing, después cross-fade al live.

**Señales de "se rompió"**

- El skeleton no se ve → import o JSX mal.
- Cross-fade salta abrupto → revealBlur (que vive en orchestrator) y skeleton se desincronizaron.

**Riesgo**: Bajo.

---

### F11 — `rendering/field/`

**Qué se extrae**

- `rendering/field/field-stars.tsx` ← `FieldStars` + `FieldStar`

**Por qué este orden**: un solo SV (t), uso de litKeys (data prop). Fase chica para mantener el ritmo.

**Commit A** + **B** usuales.

**Validación**: Snapshot + visual.

**Señales de "se rompió"**: field stars (las pequeñas magenta) no aparecen al iluminar días.

**Riesgo**: Bajo.

---

### F12 — `rendering/figure-base/`

**Qué se extrae**

- `rendering/figure-base/base-layer.tsx` ← `BaseLayer` + `PlaceholderStar` + `HeroGlow`

**Por qué este orden**: silueta placeholder. Usa slowT, radialPulse, t. BaseLayer renderiza PlaceholderStar para cada star, y PlaceholderStar usa HeroGlow para alphas. Acoplados — mueven juntos.

**Commit A** + **B**.

**Validación**

- Snapshot con count=0 (todo placeholder).
- Visual: la silueta debe respirar al mismo ritmo que antes; el commit-flash de radialPulse debe seguir disparando la sobrebrillanto del placeholder.

**Señales de "se rompió"**

- Silueta no respira → slowT no llega.
- Commit no produce flash → radialPulse no llega.
- HeroGlow ausente en alphas → mag check falló.

**Riesgo**: Medio.

---

### F13 — `rendering/lit-cluster/`

**Qué se extrae**

- `rendering/lit-cluster/lit-cluster.tsx` ← `LitClusterAura` + `LitClusterMotes` + `ClusterMote`

**Por qué este orden**: chico, consumo de breathT + t, sin sub-trees complejos.

**Validación**: Snapshot con varios niveles de iluminación + visual smoke.

**Señales de "se rompió"**: el wash warm no aparece al iluminar / aparece pero no respira.

**Riesgo**: Bajo.

---

### F14 — `rendering/lit-lines/`

**Qué se extrae**

- `rendering/lit-lines/lit-lines.tsx` ← `LitLines` + `LitLineFilament`

**Por qué este orden**: LitLineFilament es complejo (3-layer filament + 2 beam particles), pero todo vive en un solo componente. Cleanly extractable.

**Validación**

- Snapshot con líneas iluminadas en varios estados.
- Device real: los 2 beams cremas deben deslizarse antipodalmente a la misma velocidad.

**Señales de "se rompió"**

- Beams desaparecen o no se mueven → t no llega o cycle calc mal.
- Filament queda muy bright o muy dim → breathStart depth-shifted mal calculado.

**Riesgo**: Medio.

---

### F15 — `rendering/lit-stars/` ⚠️

**Qué se extrae**

- `rendering/lit-stars/stars-layer.tsx` ← `StarsLayer` (dispatcher)
- `rendering/lit-stars/next-star.tsx` ← `NextStar`
- `rendering/lit-stars/lit-star.tsx` ← `LitStar`
- `rendering/lit-stars/volumetric-rays.tsx` ← `VolumetricRays`
- `rendering/lit-stars/today-ring.tsx` ← `TodayRing`
- `rendering/lit-stars/star-particles.tsx` ← `StarParticles` + `StarSpark`
- `rendering/lit-stars/lit-star-flare.tsx` ← `LitStarFlare`

**Por qué este orden**: zona de riesgo A del mapa. Mover en bloque (LitStar + sus 5 sub-componentes) preserva la composición del worklet → el closure de LitStar sigue capturando `t, breathT, litPulse, phase, r, intensity, haloMult, breathStart, s, i` como antes. Si se intenta extraer LitStar SIN sus sub-componentes, hay que pasar `t` por props a cada sub, lo cual es seguro pero feo. Mejor moverlos todos juntos.

**Cuidados especiales**

- En `LitStar`, `r = baseR * (1 + intensity * 0.18)` — un escalar derivado dentro del componente. Al copiar, mantener EXACTAMENTE esa línea, en el mismo lugar, con el mismo orden.
- `phase = (i * 0.137) % 1`, `breathStart = 0.85 + depth * 0.02`, `haloMult = recencyHaloMultiplier(recency)` — son inputs cruciales para los 4 worklets. Mantenerlos.
- `recencyHaloMultiplier` ya vive en `geometry/` (F1) — importarlo en lugar de redefinirlo.

**Validación**

- Snapshot de los 12 signos × 3 niveles de iluminación (count=0, count=14, count=28).
- Snapshot de "today's star" (recency=0) → TodayRing visible.
- Snapshot de un viejo lit star (recency=21) → halo dim.
- Device real iOS + Android: pulsación de la estrella alpha de cada signo, twinkle asíncrono entre stars, ondas breath cascading desde el alpha.

**Señales de "se rompió"**

- TodayRing ausente → recency check falló.
- VolumetricRays no rotan → t no llega.
- Halo no decae con recency → haloMult no se aplica.
- Animación de halo se sincroniza entre stars → phase no se aplica (closure mal capturado).
- **Trabazón visible al alternar estados** → un worklet se está re-creando cada render. Buscar useMemo perdido o ref no estable.

**Riesgo**: **Alto**. Esta es la fase que requiere más atención y validación más larga (probablemente 1-2 días de testing real).

---

### F16 — `rendering/ignition/`

**Qué se extrae**

- `rendering/ignition/igniting-overlay.tsx` ← `IgnitingOverlay` (dispatcher)
- `rendering/ignition/igniting-star.tsx` ← `IgnitingStar` + `BurstSpark`
- `rendering/ignition/igniting-line.tsx` ← `IgnitingLine`

**Por qué este orden**: cluster cohesivo de ignición. IgnitingOverlay dispatcha al star o line correspondiente. Mueven juntos.

**Validación**

- Visual: tap en Hoy para marcar un día → el next star/line ejecuta su flash (star: white-hot disc + ring + 4-ray spike + 8 BurstSparks; line: stroke trace A→B).
- Device real para verificar timing.

**Señales de "se rompió"**

- Flash no aparece → `ignitingKey` no llega o `igniteT` no avanza.
- Flash es muy lento/rápido → IGNITE_STAR_MS / IGNITE_LINE_MS no se aplicaron.
- BurstSparks no fly out → angle calc o cosA/sinA mal capturados.

**Riesgo**: Medio.

---

### F17 — `rendering/burst/`

**Qué se extrae**

- `rendering/burst/star-burst.tsx` ← `StarBurst` + `BurstCore`
- `rendering/burst/particle-burst.tsx` ← `ParticleBurst` + `ParticleSpark`

**Por qué este orden**: la firework central del commit. Self-contained con radialPulse + burstId + trainedCount. Independent de las otras capas.

**Validación**

- Visual: tap → ronda magenta firework, ~28 sparks volando hacia afuera.
- Test del 5to commit consecutivo siendo "big" (burstId % 5 === 0).
- Test del early-window boost (días 2-12 → más sparks).

**Señales de "se rompió"**

- Sparks no aparecen → count derived de burstId mal.
- Big burst no se distingue → branching big mal.
- Hues monocromos → SPARK_HUES no se aplicó.

**Riesgo**: Medio.

---

### F18 — `rendering/overlay/`

**Qué se extrae**

- `rendering/overlay/center-number-overlay.tsx` ← `CenterNumberOverlay`
- `rendering/overlay/anticipation-crown.tsx` ← `AnticipationCrown`
- `rendering/overlay/completion-rings.tsx` ← `CompletionRings`

**Por qué este orden**: overlays UI que viven afuera o en la última capa del SVG. Tres componentes pequeños no acoplados entre sí.

**Cuidado especial — CenterNumberOverlay**

- Usa el truco AnimatedTextInput.text para animar el number sin re-render. NO reescribir como `Animated.Text`. NO tocar `editable={false}` + `underlineColorAndroid="transparent"`.
- Es RN view (no SVG), vive fuera del Svg padre.

**Validación**

- Snapshot del number en count=0, count=14, count=28.
- Snapshot del "+1 ghost" a mitad de animación.
- Snapshot de AnticipationCrown en day=22 y day=27.
- Snapshot de CompletionRings cuando isComplete=true.

**Señales de "se rompió"**

- Number no se anima → AnimatedTextInput trick perdió.
- "+1" no aparece → plusOne SV no llega.
- Crown no aparece en días 21+ → branch en orchestrator mal.

**Riesgo**: Medio.

---

### F19 — `animation/use-clocks.ts` ⚠️

**Qué se extrae**

- `animation/use-clocks.ts` ← hook compuesto que crea + dispara los 4 relojes infinitos

```typescript
export function useConstellationClocks() {
  const t = useSharedValue(0)
  const slowT = useSharedValue(0)
  const breathT = useSharedValue(0)
  const driftT = useSharedValue(0)
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    slowT.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false)
    breathT.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.linear }), -1, false)
    driftT.value = withRepeat(withTiming(1, { duration: 42000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(t)
      cancelAnimation(slowT)
      cancelAnimation(breathT)
      cancelAnimation(driftT)
    }
  }, [t, slowT, breathT, driftT])
  return { t, slowT, breathT, driftT }
}
```

**Por qué este orden — y por qué F19, no F1**:

- Si extraés clocks ANTES de F9-F18, los consumidores in-line (LitStar, AmbientField, etc.) NO existen aún como módulos separados — siguen siendo declaraciones dentro del orchestrator que toman `t` por closure local. Para que importen del hook, tendrían que ser extraídos antes. Pero extraerlos antes los obliga a tomar `t` por props (no por closure). Resultado: para mover clocks bien, todos los consumidores ya deben estar extraídos y recibiendo SVs por props.
- F19 cambia el orchestrator para llamar `useConstellationClocks()` en vez de declarar in-line los 4 SVs + el useEffect.

**Commit A**: crear el hook.
**Commit B**: en orchestrator, reemplazar las 4 declaraciones + el useEffect por una sola llamada al hook. Re-validar que TODOS los consumidores siguen recibiendo el mismo SV.

**Validación**

- TS pasa.
- Snapshot RNTL idéntico.
- **Device real obligatorio**: 60 segundos viendo el canvas → todas las animaciones siguen sincronizadas como antes. El twinkle no salta. El breath cascada sigue ondulando hacia afuera del alpha.
- Si hay 2 sesiones de la app abiertas (antes y después del refactor), las animaciones deben verse idénticas.

**Señales de "se rompió"**

- Cualquier desincronización visible → un consumidor está usando un SV diferente al hook.
- Animaciones más lentas/rápidas → otro `withRepeat` corriendo al mismo tiempo (el viejo no se canceló).

**Riesgo**: **Alto**. Es el paso más sensible al timing.

---

### F20 — `animation/use-canvas-reveal.ts`

**Qué se extrae**

- `animation/use-canvas-reveal.ts` ← hook que encapsula `canvasReady` state + `revealBlur` SV + `revealBlurProps`

**Por qué este orden**: aislado de los clocks. Self-contained.

**Validación**

- Visual: el reveal sigue siendo idéntico (skeleton 1500ms → real Svg con blur 18 → blur 0 en 700ms).

**Señales de "se rompió"**

- Reveal salta abrupto → blur no se anima, se renderiza 0 directo.
- Reveal nunca termina → setTimeout no se llama.

**Riesgo**: Bajo.

---

### F21 — `animation/use-ignition-engine.ts` ⚠️

**Qué se extrae**

- `animation/use-ignition-engine.ts` ← hook que encapsula:
  - state: `ignitionQueue`, `ignitingKey`, `burstId`
  - refs: `prevLitRef`, `prevCountRef`
  - SVs: `igniteT`, `numberPulse`, `displayedCount`, `litPulse`, `radialPulse`, `plusOne`, `rayPresence`
  - 3 efectos: rayPresence-on-isComplete, upward-change detector, queue drain

**Signature**

```typescript
export function useIgnitionEngine(opts: {
  trainedCount: number
  elementsLit: number
  sequence: SequenceEl[]
  isComplete: boolean
}): {
  ignitingKey: string | null
  igniteT: SharedValue<number>
  numberPulse: SharedValue<number>
  displayedCount: SharedValue<number>
  litPulse: SharedValue<number>
  radialPulse: SharedValue<number>
  plusOne: SharedValue<number>
  rayPresence: SharedValue<number>
  burstId: number
}
```

**Por qué este orden — y por qué F21, no antes**:

- F18 ya movió CenterNumberOverlay (consumidor de displayedCount/numberPulse/plusOne).
- F16 ya movió IgnitingOverlay (consumidor de igniteT + ignitingKey).
- F17 ya movió StarBurst (consumidor de radialPulse + burstId).
- F15 ya movió LitStar (consumidor de litPulse).
- F12 ya movió BaseLayer (consumidor de radialPulse).
- Sólo queda el orchestrator como locus del state machine — extraerlo es un encapsulamiento limpio.

**Commit A**: crear el hook.
**Commit B**: reemplazar el state + refs + SVs + efectos del orchestrator por una llamada al hook que devuelve los outputs.

**Validación**

- Tests unit del hook (testing-library/react-hooks) con casos de jump +1, +2, undo.
- Visual: secuencia completa de tap (haptic + flash + +1 ghost + number count-up + radial wave) sigue siendo idéntica.
- Device real iOS + Android.

**Señales de "se rompió"**

- Tap no ignita → la queue no se llena o la drain effect no corre.
- Múltiples ignitiones simultáneas → el state machine perdió su lock con ignitingKey.
- "+1" no aparece → plusOne no llega al overlay.

**Riesgo**: **Alto**. State machine timing.

---

### F22 — `data/use-figure-geometry.ts`

**Qué se extrae**

- `data/use-figure-geometry.ts` ← hook con los 4 useMemo: alphaIdx, alphaPos, starDepth (BFS), lineDepth

**Signature**

```typescript
export function useFigureGeometry(
  zodiac: ZodiacDef,
  stars: Resolved[],
): {
  alphaIdx: number
  alphaPos: { x: number; y: number }
  starDepth: Map<number, number>
  lineDepth: number[]
}
```

**Validación**

- Unit tests del hook con varios zodiac defs.
- Snapshot del componente con los outputs.

**Riesgo**: Medio.

---

### F23 — `data/use-lit-maps.ts`

**Qué se extrae**

- `data/use-lit-maps.ts` ← hook con los 3 useMemo: litKeys, litCluster, starRecency

**Signature**

```typescript
export function useLitMaps(opts: {
  elementsLit: number
  sequence: SequenceEl[]
  trained: readonly boolean[]
  todayIdx: number
  stars: Resolved[]
}): {
  litKeys: Set<string>
  litCluster: { cx: number; cy: number; r: number; count: number } | null
  starRecency: Map<number, number>
}
```

**Validación**: Unit tests + snapshot.

**Riesgo**: Medio.

---

### F24 — Contenedor delgado + index

**Qué se entrega**

- `constellation/LunarConstellation.tsx` final (~150 líneas):
  - imports de todos los módulos creados
  - llamadas a los 4 hooks compuestos (`useConstellationClocks`, `useCanvasReveal`, `useIgnitionEngine`, `useFigureGeometry`, `useLitMaps`)
  - llamadas a `deriveProgress` + `stars resolved` memo
  - JSX del render tree (zócalo de subcomponentes)
  - `StyleSheet` local
- `constellation/index.tsx` ← `export { LunarConstellation } from './LunarConstellation'`

**Y FINALMENTE**: en `features/tabs/components/LunarConstellation.tsx` original — borrar TODO el contenido y reemplazar por `export { LunarConstellation } from './constellation'`. Una línea.

**Commit** (único, no A/B): el del cambio del original. Es el momento final del strangler.

**Validación**

- TS pasa.
- Snapshot RNTL para los 12 signos × 3 niveles de iluminación.
- `visual-diff.sh` 0 diferencias.
- Device real iOS + Android: probar el flujo Hoy completo — abrir, ver el reveal, marcar 1 día, ver la firework + +1 ghost, undo, marcar varios días, llegar al day 21 (anticipation crown), llegar al day 28 (completion rings + COMPLETO).
- Comparar contra una build anterior del archivo viejo (último commit antes del refactor) con app real.

**Señales de "se rompió"**

- CUALQUIER diferencia visible o de timing.

**Riesgo**: Bajo TÉCNICAMENTE (es sólo borrar el original y dejar el re-export). Pero es el cierre — si llegaste acá con red en verde, es un commit ceremonial.

---

## 5 · Tablero de invariantes (cosas que no deben cambiar nunca)

1. La API pública: `import { LunarConstellation } from '@/features/tabs/components/LunarConstellation'` y sus props (trained, todayIdx, sign, committed) NO cambian.
2. La timing de las animaciones: 8s/5s/16s/42s para los 4 relojes; 720/520/800 ms para las ignitiones; 1500 ms para el canvas-ready hold.
3. Los IDs de gradientes SVG (starLit, starNext, litClusterAura, cardVignette, cardEdgeFade) — son referenciados por strings dentro de fills. Si cambian, los fills quedan vacíos.
4. La firma + retorno de `deriveProgress` — todo el render tree depende de la forma del output.
5. La estabilidad de referencias en los componentes con worklets — toda función pasada a useAnimatedProps debe ser estable entre renders.

---

## 6 · Hitos donde parar y revisar el visual completo

No basta con validar fase a fase. Hay puntos donde el costo de un error acumulado se dispara. Parar acá y hacer una revisión visual full (12 signos × ≥3 estados, device real iOS+Android):

- **Después de F8** (static rendering): la base atmosférica está extraída. Si algún gradiente quedó roto acá, todas las fases siguientes lo arrastran.
- **Después de F15** (lit-stars — la fase Alto). Es el corazón visual. Si pasa esta, el resto es accesorio.
- **Después de F18** (overlays). Toda la UI visible ya está extraída.
- **Después de F19** (clocks). El sistema entero de animación ya está encapsulado en un hook.
- **F24** (cierre). Comparación final contra la versión original archivada.

---

## 7 · Apéndice — qué NO está en este plan

- **Mejoras de código**: no consolidamos funciones similares, no renombramos variables, no simplificamos condicionales. Eso va a `dry-candidates.md` y a commits posteriores al refactor.
- **Tests E2E**: no agregamos Detox / Maestro. La validación es snapshot + visual + device manual. E2E queda para una fase posterior si la app se mantiene.
- **CI/CD**: no integramos el visual-diff.sh a un workflow de GitHub Actions. Corre local.
- **Type guards**: no agregamos Zod schemas a deriveProgress output. Sigue siendo confianza TS.
- **Storybook**: tentador para ver los 12 signos lado a lado, pero el costo de set-up para Reanimated 4 en Storybook RN es alto. Mejor el `/__refactor-test` screen del Paso 3.
