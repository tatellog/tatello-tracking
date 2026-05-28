# Constellation refactor · Paso 1 · Mapa estructural

Archivo objetivo: `features/tabs/components/LunarConstellation.tsx` (3,667 líneas).
Estrategia: strangler fig — construir piezas nuevas en paralelo, validar
equivalencia, reemplazar al final.

Este documento es el inventario. NO contiene cambios. NO toca código.

---

## 1 · Resumen ejecutivo

`LunarConstellation.tsx` renderiza una constelación zodiacal animada que se
ilumina día por día a lo largo de un ciclo de 28 días. La entrada es un array
boolean `trained[28]` + el índice del día actual + el signo zodiacal del
usuario; la salida es un canvas SVG con cosmos, figura zodiacal, contadores y
efectos de ignición.

Composición:

- **1 export público** (`LunarConstellation`) — orchestrator
- **42 funciones / componentes internos** (8 puras + 34 React components)
- **30 worklets de Reanimated** distribuidos entre los componentes animados
- **12 SharedValues** (4 relojes + 8 driven por estado/commit)
- **4 efectos `withRepeat` infinitos** + 2 efectos transitorios (ignición + canvas-ready)
- **Estado interno**: queue de ignición, ignitingKey, burstId, canvasReady
- **Refs**: prevLitRef, prevCountRef
- **StyleSheet** local de ~135 líneas (3531-3667)

Lo que NO está aquí (pero el componente lo importa):

- `ZODIAC` data + `ZodiacDef`/`ZodiacSign` types desde `../zodiac/`
- `ZodiacEngraving` component (ya está extraído)
- 12 SVG zodiac-art assets desde `@/assets/zodiac-art/`
- `colors`, `typography` desde `@/theme`

---

## 2 · Topología visual (z-order de fondo a frente)

```
┌─ CanvasSkeleton (1500 ms hold)
│   ├─ SkeletonLine ×N   build SV (interno, self-contained)
│   ├─ SkeletonStar ×N
│   └─ BlurView intensity=18
└─ Live SVG (FadeIn 260 ms)
    ├─ SvgGradients (Defs estáticos)
    ├─ DeepField               drift          parallax ultra-far
    ├─ AmbientField            t + drift      5 buckets twinkle
    ├─ StarWinks ×5            t              flashes random
    ├─ ShootingStar ×3         t              streaks staggered
    ├─ AmbientGlow             —              wash magenta estático
    ├─ NebulaPatches           drift+alphaPos 4 patches drift
    ├─ CosmicDust ×7           t              motes rising
    ├─ ZodiacEngraving         breathT+prog   art per-sign (externo)
    ├─ Rect cardVignette       —              frame oscuro
    ├─ Rect cardEdgeFade       —              fade top/bottom
    ├─ FieldStars              t + litKeys    padding stars lit
    ├─ <G transform per-sign>
    │   ├─ LitClusterAura      breathT        radial wash on lit
    │   ├─ LitClusterMotes ×6  t              dust on cluster
    │   ├─ BaseLayer           slowT+radial+t silueta placeholder
    │   │   └─ PlaceholderStar t              + HeroGlow si alpha
    │   ├─ LitLines            litPulse+breathT+t  filamentos
    │   │   └─ LitLineFilament breathT+t+depth
    │   ├─ StarsLayer (dispatcher)
    │   │   ├─ NextStar        t              halo magenta breath
    │   │   └─ LitStar         t+breathT+litPulse+recency+depth+intensity
    │   │       ├─ VolumetricRays  t          8 rayos rotando
    │   │       ├─ HeroGlow        t          halo cream-gold
    │   │       ├─ LitStarFlare    t          anamorphic lens
    │   │       ├─ TodayRing       t          ring si recency=0
    │   │       └─ StarParticles   t          sparks rising
    │   └─ IgnitingOverlay (dispatcher)
    │       ├─ IgnitingStar    igniteT        flash + ring + spikes
    │       │   └─ BurstSpark ×8
    │       └─ IgnitingLine    igniteT        stroke trace A→B
    ├─ StarBurst               radialPulse + burstId + trainedCount
    │   ├─ BurstCore           radialPulse    disco magenta
    │   └─ ParticleBurst       radialPulse
    │       └─ ParticleSpark ×N
    ├─ AnticipationCrown       breathT        días ≥21, no completo
    └─ CompletionRings         t              solo isComplete
CenterNumberOverlay (View RN, fuera del SVG)
                              displayedCount+numberPulse+plusOne
```

---

## 3 · Funciones puras (candidatas seguras a extraer primero)

| Fn                      | Líneas    | Firma                                    | Usa                              | Riesgo  |
| ----------------------- | --------- | ---------------------------------------- | -------------------------------- | ------- |
| `starRadius`            | 121-130   | `(mag: number) → number`                 | sólo aritmética                  | Bajo    |
| `recencyHaloMultiplier` | 137-145   | `(days: number) → number`                | sólo aritmética                  | Bajo    |
| `fourPointStarPath`     | 149-158   | `(cx, cy, outer) → string`               | `STAR_INNER_RATIO`, `Math`       | Bajo    |
| `burstHash`             | 1516-1519 | `(a, b) → number`                        | `Math.sin/floor`                 | Bajo    |
| `buildFieldStars`       | 887-917   | `(figureStars, count) → {x,y}[]`         | sólo aritmética + sin            | Bajo    |
| `buildAmbientField`     | 1245-1267 | `() → AmbientStar[][]`                   | `W, H, AMBIENT_*` constantes     | Bajo    |
| `deriveProgress`        | 919-993   | `(trained, todayIdx, zodiac) → {…}`      | `TARGET_DAYS`, `buildFieldStars` | Medio\* |
| `DEEP_STARS` (IIFE)     | 1667-1683 | computa `DeepStar[]` al cargar el módulo | `W, H`                           | Bajo    |

\*`deriveProgress` es bajo riesgo TÉCNICO (es pura), pero es **core business
logic** — todo lo lit/next/field depende de ella. Cualquier diferencia en la
secuencia desplaza qué se ilumina en cada día. Por eso los unit tests deben
cubrirla con varios `trained`/`todayIdx`/`zodiac` antes de moverla.

---

## 4 · Constantes y data estática

**Magic numbers de canvas / animación** (van a `constants.ts`):

- `W = 290`, `H = 290`, `PAD = 18`, `TARGET_DAYS = 28`
- `STAR_INNER_RATIO = 0.32`, `HERO_MAG = 1.7`, `SPARKLE_MAG = 2.8`
- `IGNITE_STAR_MS = 720`, `IGNITE_LINE_MS = 520`, `NUMBER_COUNTUP_MS = 800`
- `AMBIENT_STAR_COUNT = 60`, `AMBIENT_BUCKET_COUNT = 5`
- `AMBIENT_LAYERS = 12`, `AMBIENT_PER_LAYER_ALPHA = 0.022`
- `AMBIENT_RX_MAX/MIN`, `AMBIENT_ASPECT = 1.45`
- `NEBULA_LAYERS = 13`
- `PARTICLE_BASE = 28`, `PARTICLE_REACH = 120`, `SPARK_BASE = 2`

**Layout / scatter data inmutable** (van a `data/scatter.ts`):

- `DUST` (7 motes)
- `WINK_POSITIONS` (5)
- `BUCKET_DRIFT` (5)
- `MOTE_LAYOUT` (6)
- `BURST_ANGLES` (8)
- `SPARK_HUES` (3 colores)
- `DEEP_STARS` (~28 micro-stars, IIFE)

**Sign maps** (van a `data/sign-maps.ts`):

- `ART_BY_SIGN` (importa 12 SVG)
- `SIGN_ENGRAVINGS` (derivado de ART_BY_SIGN)
- `SIGN_CONSTELLATION_TRANSFORM` (12 transforms)

**Animated component aliases** (van a `animation/animated-components.ts`):

- `AnimatedCircle`, `AnimatedG`, `AnimatedLine`, `AnimatedTextInput`, `AnimatedBlurView`

---

## 5 · Tipos (van a `types.ts`)

- `Resolved = { x: number; y: number; mag: number }`
- `SequenceEl = { type: 'star' | 'line' | 'field'; idx: number }`
- `Props = { trained, todayIdx, sign?, committed? }` ← API pública del componente
- `AmbientStar = { x, y, r, baseOp, sparkle }`
- `DustParticle = { x, sway, period, phase, r, opacity }`
- `DeepStar = { x, y, r, op }`

---

## 6 · Hooks usados en main (`LunarConstellation`)

| Hook               | Conteo | Para qué                                                                                                                 |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `useMemo`          | 9      | sequence, stars resolved, alphaIdx, alphaPos, starDepth, lineDepth, litKeys, litCluster, starRecency                     |
| `useSharedValue`   | 12     | t, slowT, breathT, driftT, igniteT, numberPulse, displayedCount, litPulse, radialPulse, plusOne, rayPresence, revealBlur |
| `useEffect`        | 6      | start clocks, canvasReady timer, revealBlur ramp, rayPresence on isComplete, upward-change detector, queue drain         |
| `useRef`           | 2      | prevLitRef, prevCountRef                                                                                                 |
| `useState`         | 4      | canvasReady, ignitionQueue, ignitingKey, burstId                                                                         |
| `useAnimatedProps` | 1      | revealBlurProps                                                                                                          |

**Derivaciones a extraer como hooks compuestos**:

- `useConstellationClocks()` → `{ t, slowT, breathT, driftT }`
- `useIgnitionEngine(elementsLit, trainedCount, sequence)` → `{ ignitingKey, igniteT, queue state, burst SVs }`
- `useFigureGeometry(zodiac, stars)` → `{ alphaIdx, alphaPos, starDepth, lineDepth }`
- `useLitMaps(elementsLit, sequence, trained, todayIdx, stars)` → `{ litKeys, litCluster, starRecency }`
- `useCanvasReveal()` → `{ canvasReady, revealBlur, revealBlurProps }`

---

## 7 · Worklets — mapa de closure deps

Cada worklet captura por closure las variables de su contexto JS. **Romper
esta captura mete bugs silenciosos**. Inventario completo:

| #   | Worklet                                            | Componente            | SharedValues                         | Scalars capturados                                       |
| --- | -------------------------------------------------- | --------------------- | ------------------------------------ | -------------------------------------------------------- |
| 1   | `props`                                            | `SkeletonStar`        | build                                | startT (= idx/total × 0.45)                              |
| 2   | `props`                                            | `SkeletonLine`        | build                                | length, startT                                           |
| 3   | warmDrift/coolDrift/deepDrift/bronzeDrift          | `NebulaPatches`       | drift                                | wx, wy, ccx, ccy, bx, by                                 |
| 4   | `animatedProps`                                    | `DustMote`            | t                                    | particle, baseX                                          |
| 5   | `animatedProps`                                    | `StarWink`            | t                                    | wink                                                     |
| 6   | `animatedProps`, `trailProps`                      | `ShootingStar`        | t                                    | cycleDiv, phase, startY, endY, active                    |
| 7   | `animatedProps`                                    | `ParticleSpark`       | pulse                                | dirX, dirY, reach, cx, cy, flickPhase                    |
| 8   | `animatedProps`                                    | `BurstCore`           | pulse                                | cx, cy                                                   |
| 9   | `animatedProps`                                    | `DeepField`           | drift                                | —                                                        |
| 10  | `animatedProps`                                    | `AmbientBucket`       | t, drift                             | bucketIdx, phase                                         |
| 11  | `starProps`                                        | `FieldStar`           | t                                    | phase, cx, cy                                            |
| 12  | `linesProps`                                       | `BaseLayer`           | slowT, radialPulse                   | —                                                        |
| 13  | `animatedProps`                                    | `PlaceholderStar`     | t                                    | phase, baseR, s, i                                       |
| 14  | `animatedProps`                                    | `HeroGlow`            | t                                    | phase, cx, cy, r                                         |
| 15  | `auraProps`                                        | `LitClusterAura`      | breathT                              | r                                                        |
| 16  | `animatedProps`                                    | `ClusterMote`         | t                                    | phase, cx, cy                                            |
| 17  | `groupProps`                                       | `LitLines`            | litPulse                             | —                                                        |
| 18  | filamentProps                                      | `LitLineFilament`     | breathT                              | breathStart (= 0.85 + depth × 0.02)                      |
| 18  | beamProps + beamProps2                             | `LitLineFilament`     | t                                    | phase, cycle, lineLen                                    |
| 19  | textProps + pulseStyle + colorStyle + ghostStyle   | `CenterNumberOverlay` | displayedCount, numberPulse, plusOne | rounded (useDerivedValue)                                |
| 20  | starProps + ringProps + flashProps + spikeProps    | `IgnitingStar`        | igniteT                              | baseR, s                                                 |
| 21  | `animatedProps`                                    | `BurstSpark`          | igniteT                              | cosA, sinA, cx, cy, distance                             |
| 22  | drawProps + headProps                              | `IgnitingLine`        | igniteT                              | length                                                   |
| 23  | `breathProps`                                      | `NextStar`            | t                                    | baseR, s                                                 |
| 24  | haloProps + starProps + outerHaloProps + coreProps | `LitStar`             | t, breathT, litPulse                 | phase, r, intensity, haloMult, breathStart, s, i, isHero |
| 25  | `rotateProps`                                      | `VolumetricRays`      | t                                    | cx, cy                                                   |
| 26  | `rotateProps`                                      | `TodayRing`           | t                                    | cx, cy, RING_R                                           |
| 27  | `animatedProps`                                    | `StarSpark`           | t                                    | phase, lateral, cx, cy                                   |
| 28  | `shimmer`                                          | `LitStarFlare`        | t                                    | phase, cx, cy                                            |
| 29  | innerProps + outerProps                            | `AnticipationCrown`   | breathT                              | proximity, baseR                                         |
| 30  | innerProps + outerProps                            | `CompletionRings`     | t                                    | cx, cy                                                   |

**Observación crítica para el refactor:**

Todas las deps de worklet son `SharedValue<number>` + escalares primitivos
(o objetos congelados como `s: Resolved`). **No hay funciones JS capturadas**.
Esto significa que mover el componente entero a otro archivo es seguro
**siempre que las props (SharedValues + escalares) se sigan pasando por props
y no se inyecten desde un módulo externo**. Las worklets se quedan dentro de
sus componentes; no se pueden mover aisladas a otro archivo (perderían el
contexto JS-side del hook que las creó).

---

## 8 · Subcomponentes agrupados por capa target del refactor

### 8.1 · `geometry/` (puro, sin React/Reanimated)

- `starRadius`
- `recencyHaloMultiplier`
- `fourPointStarPath`
- `burstHash`

### 8.2 · `data/` (puro, devuelve datos)

- `buildFieldStars`
- `buildAmbientField`
- `DEEP_STARS` (IIFE → module-level array)
- `deriveProgress` (core business logic)
- sign maps + scatter data + constantes

### 8.3 · `rendering/static/` (sin SharedValue)

- `SvgGradients` (Defs)
- `AmbientGlow`
- `StarSparkle`

### 8.4 · `rendering/ambient/` (background atmosphere)

- `DeepField`
- `AmbientField` + `AmbientBucket`
- `StarWinks` + `StarWink`
- `ShootingStar`
- `NebulaPatches`
- `CosmicDust` + `DustMote`

### 8.5 · `rendering/field/`

- `FieldStars` + `FieldStar`

### 8.6 · `rendering/figure/` (la figura zodiacal viva)

- `BaseLayer` + `PlaceholderStar` + `HeroGlow`
- `LitClusterAura` + `LitClusterMotes` + `ClusterMote`
- `LitLines` + `LitLineFilament`
- `StarsLayer` (dispatcher) + `NextStar`
- `LitStar` (+ `VolumetricRays`, `TodayRing`, `StarParticles`, `StarSpark`, `LitStarFlare`)

### 8.7 · `rendering/ignition/`

- `IgnitingOverlay` + `IgnitingStar` + `BurstSpark` + `IgnitingLine`

### 8.8 · `rendering/burst/`

- `StarBurst` + `BurstCore` + `ParticleBurst` + `ParticleSpark`

### 8.9 · `rendering/overlay/`

- `CenterNumberOverlay` (RN view, no SVG)
- `AnticipationCrown`
- `CompletionRings`
- `CanvasSkeleton` + `SkeletonStar` + `SkeletonLine`

### 8.10 · `animation/` (hooks de Reanimated reutilizables)

- `useConstellationClocks` (t, slowT, breathT, driftT)
- `useCanvasReveal` (canvasReady, revealBlur)
- `useIgnitionEngine` (queue, igniteT, pulses, plusOne, displayedCount)
- `useRayPresence` (isComplete → rayPresence)

### 8.11 · `data/` (hooks derivados, lado React)

- `useFigureGeometry(zodiac, stars)` → alphaIdx/alphaPos/starDepth/lineDepth
- `useLitMaps(elementsLit, sequence, trained, todayIdx, stars)` → litKeys/litCluster/starRecency

### 8.12 · contenedor delgado

- `LunarConstellation.tsx` final (~150 líneas): un componente que compone hooks +
  render tree, sin lógica.

---

## 9 · Gráfico de dependencias

```
                           ┌─────────────────────────────┐
                           │   LunarConstellation (orq)  │
                           └────────────┬────────────────┘
                                        │
   ┌────────────────────────────────────┼────────────────────────────────────┐
   ▼                                    ▼                                    ▼
clocks hooks                  derivations (memos)                  render tree (SVG)
 t,slowT,                      sequence,fieldStars                  Skeleton | Background |
 breathT,driftT,               alphaIdx,alphaPos,                   Field | Figure |
 igniteT,pulses                starDepth,lineDepth,                 Ignition | Burst |
                               litKeys,litCluster,                  Overlay
                               starRecency

   Derivations USE:
     · deriveProgress  ← (trained, todayIdx, zodiac)  [PURE]
     · buildFieldStars ← (figureStars, count)         [PURE]
     · BFS from alphaIdx through zodiac.lines         [in useMemo]

   Render tree CONSUMES:
     · clocks (SharedValues) → all animated subcomponents
     · litKeys/litCluster/starRecency → figure layer
     · sequence + nextEl → StarsLayer dispatcher
     · ignitingKey + igniteT → IgnitingOverlay
     · radialPulse + burstId + trainedCount → StarBurst
     · displayedCount/numberPulse/plusOne → CenterNumberOverlay
```

**Acoplamiento crítico** (lo que NO se puede separar sin coordinación):

1. `t` × `breathT` × `litPulse` viven juntos en `LitStar` + `LitLines` + `LitClusterAura`. Si extraés el clock pero olvidás un consumidor, ese consumidor queda con el SV original mientras el resto usa uno nuevo — desincronización inmediata.
2. `sequence` (de `deriveProgress`) es consumida por 4 lugares: `litKeys`, `starRecency`, `nextEl`, ignition effect. Cambiar la forma del retorno requiere actualizar todos a la vez.
3. `stars` (resolved) es consumida por 7+ componentes. Cambiar de array a Map o reordenar deps rompe BFS depth.
4. `ignitingKey` es leído por `LitLines`, `StarsLayer` y `IgnitingOverlay` para evitar render duplicado. Si lo movés a otro state container debe seguir bypaseando los tres.

---

## 10 · Zonas de mayor riesgo

### A · `LitStar` (líneas 2938-3143)

- 4 worklets en un componente
- 9+ deps por closure (t, breathT, litPulse, phase, r, intensity, haloMult, breathStart, s, i)
- Sub-componentes anidados: VolumetricRays, HeroGlow, LitStarFlare, TodayRing, StarParticles
- **Mitigación**: extraer LitStar EN BLOQUE (con sus sub-componentes) a su propio archivo. NO intentar mover los worklets aisladamente. Snapshot test debe cubrir: lit alpha + lit non-alpha + lit recency=0 (TodayRing) + lit recency>21 (halo decay).

### B · Ignition state machine (líneas 552-695)

- `useState<SequenceEl[]>` queue + `useState<string|null>` ignitingKey + `useRef` prevs
- 2 efectos timing-sensibles que dependen de cada cambio en `trainedCount` / `elementsLit`
- Si re-extraemos a hook (`useIgnitionEngine`), debe preservar el orden exacto de:
  1. detectar upward change
  2. fire animations + push to queue
  3. drain queue 1 a la vez con setTimeout
- **Mitigación**: extraer como hook completo, no piezas. Test: simular `trainedCount` jumps de +1, +2, undo, etc. y verificar que la queue se procesa secuencialmente.

### C · Relojes paralelos múltiples (líneas 518-534)

- 4 `withRepeat(withTiming(…), -1, …)` en un solo effect
- Cualquier remount los reinicia → toda la escena se desincroniza visiblemente
- **Mitigación**: si extraemos a `useConstellationClocks()`, debe ser un hook estable (sin deps que cambien) llamado EXACTAMENTE UNA VEZ en el contenedor. Validar con: renderizar la app, ver que el twinkle + breath se mantienen continuos al alternar estados (no hay "salto" visible).

### D · `deriveProgress.sequence` (líneas 919-993)

- Core business logic. Toda la figura depende del orden de la secuencia.
- Pad con field stars + interleave evenly: 3 fases (build figureSeq → buildFieldStars → interleave).
- **Mitigación**: unit tests con casos representativos:
  - `trained = [false×28]` → `elementsLit = 0`
  - `trained = [true×28]` → `elementsLit = 28`, `isComplete = true`
  - aries (11 elementos) vs leo (más) → verifica que la secuencia interleavea correctamente
  - undo: `trained` con true→false → `trainedCount` baja, `sequence` se mantiene estable

### E · Closure capture al extraer

- Riesgo de pérdida de memoización: si extraés un componente y olvidás el `useMemo` que computaba `r = baseR * (1 + intensity * 0.18)` ANTES del worklet, el worklet va a recibir un valor diferente cada render y la animación se traba.
- **Mitigación**: regla — al extraer un componente, copia EXACTAMENTE la misma forma del cuerpo (mismas const declarations, mismo orden, mismos useMemo si los hay). "Move, don't improve".

### Riesgos menores que vale la pena registrar

- `AnimatedTextInput` text trick en `CenterNumberOverlay` — patrón no-obvio para animar texto en RN. Mover el componente entero, no intentar reescribir con `Animated.Text`.
- `BlurView` con `useAnimatedProps({intensity})` — el cross-fade skeleton→live depende de que tanto el skeleton como el live usen BlurView con el mismo intensity en su primer frame. No optimizar quitando uno.

---

## 11 · Anexo · ranges del archivo original

| Pieza                                    | Líneas    |
| ---------------------------------------- | --------- |
| Imports                                  | 1-51      |
| Sign maps (ART, ENGRAVINGS, TRANSFORM)   | 53-109    |
| Constantes geom (STAR_INNER_RATIO, etc.) | 111-145   |
| `fourPointStarPath`                      | 149-158   |
| Animated aliases + canvas constants      | 160-188   |
| Types (Resolved, SequenceEl, Props)      | 190-213   |
| `SkeletonStar`                           | 229-255   |
| `SkeletonLine`                           | 257-295   |
| `CanvasSkeleton`                         | 297-349   |
| **`LunarConstellation` main**            | 351-882   |
| `buildFieldStars`                        | 887-917   |
| `deriveProgress`                         | 919-993   |
| `SvgGradients`                           | 995-1048  |
| `AmbientGlow`                            | 1064-1091 |
| `NebulaPatches`                          | 1111-1234 |
| `buildAmbientField`                      | 1245-1267 |
| `CosmicDust` + `DustMote`                | 1309-1343 |
| `StarWinks` + `StarWink`                 | 1362-1391 |
| `ShootingStar`                           | 1404-1470 |
| `StarBurst` + helpers                    | 1484-1640 |
| `BurstCore`                              | 1646-1659 |
| `DEEP_STARS` IIFE + `DeepField`          | 1665-1700 |
| `AmbientField` + `AmbientBucket`         | 1702-1763 |
| `FieldStars` + `FieldStar`               | 1774-1822 |
| `BaseLayer`                              | 1826-1890 |
| `PlaceholderStar`                        | 2053-2100 |
| `LitLines` + `LitLineFilament`           | 2104-2359 |
| `LitClusterAura`                         | 2373-2398 |
| `LitClusterMotes` + `ClusterMote`        | 2414-2451 |
| `HeroGlow`                               | 1924-1966 |
| `StarSparkle`                            | 1971-2051 |
| `CenterNumberOverlay`                    | 2471-2541 |
| `StarsLayer`                             | 2545-2606 |
| `IgnitingOverlay`                        | 2619-2647 |
| `IgnitingStar` + `BurstSpark`            | 2653-2839 |
| `IgnitingLine`                           | 2841-2899 |
| `NextStar`                               | 2906-2936 |
| `LitStar`                                | 2938-3143 |
| `VolumetricRays`                         | 3148-3201 |
| `TodayRing`                              | 3208-3248 |
| `StarParticles` + `StarSpark`            | 3255-3322 |
| `LitStarFlare`                           | 3334-3425 |
| `AnticipationCrown`                      | 3436-3493 |
| `CompletionRings`                        | 3495-3529 |
| `styles`                                 | 3531-3667 |
