# Auditoría estática de performance — `features/tabs/components/constellation/`

Convenciones: line refs `path.tsx:NNN`. Caso "trained" = Leo, `elementsLit = 14`,
`todayIdx = 14`, `committed = false`, `trainedCount = 14`, `isComplete = false`.
Leo: 9 stars, 10 lines (figures.ts:189-216). Sequence al k=14:
**5 lit stars + 4 lit lines + 5 lit field stars**. `nextEl` típicamente cae en
field (sequence[14]=field-5) → **0 NextStar en este caso**. Conteos abajo
sobre el caso "sin NextStar".

---

## Sección 1 — Conteos crudos del hot path

Conteo de `useAnimatedProps` instanciados (≈ worklets corriendo cada frame)
con `elementsLit = 14`, Leo, sin overlay igniting activo.

| Capa               | Componente / archivo                                                    |   Worklets | Notas                                                 |
| ------------------ | ----------------------------------------------------------------------- | ---------: | ----------------------------------------------------- |
| Ambient            | `DeepField` (deep-field.tsx:8-14)                                       |          1 | un solo `AnimatedG` envolviendo 30 `Circle` estáticos |
| Ambient            | `AmbientField` → `AmbientBucket` × 5 (ambient-field.tsx:13-19, 33-43)   |          5 | un worklet por bucket, no por estrella                |
| Ambient            | `StarWinks` → `StarWink` × 5 (star-winks.tsx:18-39)                     |          5 | `WINK_POSITIONS` tiene 5                              |
| Ambient            | `ShootingStar` × 3 (LunarConstellation.tsx:128-130), 2 worklets c/u     |          6 | 3 × (cabeza + cola)                                   |
| Ambient            | `CosmicDust` → `DustMote` × 7 (cosmic-dust.tsx:25-46)                   |          7 | `DUST` length=7                                       |
| Ambient            | `NebulaPatches` (nebula-patches.tsx:52-87)                              |          4 | warm + cool + deep + bronze                           |
| Field              | `FieldStars` → 5 `FieldStar` lit (field-stars.tsx:54-58)                |          5 | uno por field-lit                                     |
| Base               | `BaseLayer.linesProps` (figure-base.tsx:38-44)                          |          1 | wrapper de las líneas placeholder                     |
| Base               | `PlaceholderStar` × 9 (figure-base.tsx:144-191)                         |          9 | una por star — **TAMBIÉN las lit** (ver bug #1)       |
| Base               | `HeroGlow` para Regulus (figure-base.tsx:113-128)                       |          1 | el alpha es hero (mag 1.5)                            |
| Lit cluster        | `LitClusterAura` (lit-cluster.tsx:30-40)                                |          1 |                                                       |
| Lit cluster        | `LitClusterMotes` → 6 `ClusterMote` (lit-cluster.tsx:46-83)             |          6 | `MOTE_LAYOUT` length=6                                |
| Lit lines          | group wrapper (lit-lines.tsx:45-52)                                     |          1 |                                                       |
| Lit lines          | `LitLineFilament` × 4 — 3 worklets c/u (filament + 2 beams)             |         12 | 4 × 3                                                 |
| Lit stars (core)   | `LitStar` × 5 — `haloProps`, `starProps`, `outerHaloProps`, `coreProps` |         20 | 5 × 4                                                 |
| Lit stars (extras) | `VolumetricRays` (rotateProps) solo Regulus                             |          1 |                                                       |
| Lit stars (extras) | `HeroGlow` adentro de LitStar                                           |          1 |                                                       |
| Lit stars (extras) | `LitStarFlare.shimmer` × 5 (mag de Leo todos <4.2)                      |          5 |                                                       |
| Lit stars (extras) | `TodayRing` (recency===0)                                               |          1 | la última star marcada hoy                            |
| Lit stars (extras) | `StarParticles` → `StarSpark` × ~14                                     |         14 | hero/today emit=2 (4 c/u); otros emit=1 (2 c/u)       |
| Ignition           | `IgnitingOverlay` — inactivo en steady state                            |          0 | peak: 12 (4 IgnitingStar + 8 BurstSpark)              |
| Burst              | `StarBurst` → `BurstCore` + `ParticleBurst` × ~28 sparks                |         29 | **corre aún con pulse=0** (ver bug #3)                |
| Anticipation       | `AnticipationCrown` — no aplica (trained<21)                            |          0 |                                                       |
| Completion         | `CompletionRings` — no aplica                                           |          0 |                                                       |
| Center overlay     | `CenterNumberOverlay.textProps` + `useDerivedValue` rounded             |          1 |                                                       |
| Center overlay     | `pulseStyle`, `colorStyle`, `ghostStyle` (`useAnimatedStyle`)           | 3 (styles) | distintos de useAnimatedProps                         |
| Canvas reveal      | `revealBlurProps` (use-canvas-reveal.ts:39)                             |          1 | activo durante cold start + 700 ms del fade           |

**Total `useAnimatedProps` activos en steady state:** ≈ **136 worklets** +
3 `useAnimatedStyle`. Si `nextEl` cae en figure → +1 (NextStar.breathProps).
Durante ignition de un line: +12 worklets (overlay). Durante commit: los 136
recalculan opacity/transform porque sus deps leen `litPulse.value`/`radialPulse.value`.

### `useEffect` en orchestrator + hooks

| Archivo                                           | Cuántos | Para qué                                    |
| ------------------------------------------------- | ------: | ------------------------------------------- |
| `LunarConstellation.tsx`                          |       0 |                                             |
| `use-clocks.ts:44-55`                             |       1 | 4 withRepeat + cleanup                      |
| `use-canvas-reveal.ts:30-33, :35-38`              |       2 | timer 1500 ms + fade trigger                |
| `use-ignition-engine.ts:83-85, :90-144, :149-163` |       3 | rayPresence + commit detector + queue drain |
| `use-figure-geometry.ts`                          |       0 |                                             |
| `use-lit-maps.ts`                                 |       0 |                                             |

**Total useEffect = 6.** Ninguno problemático en sí mismo.

### `useMemo` en orchestrator + data hooks

| Archivo:línea                              | Computo                                      |
| ------------------------------------------ | -------------------------------------------- |
| `LunarConstellation.tsx:51`                | deriveProgress                               |
| `LunarConstellation.tsx:56`                | stars resolved                               |
| `use-figure-geometry.ts:36, :48, :59, :83` | alphaIdx, alphaPos, starDepth BFS, lineDepth |
| `use-lit-maps.ts:31, :45, :69`             | litKeys, litCluster, starRecency             |
| `ambient-field.tsx:12`                     | buckets                                      |
| `igniting-line.tsx:25`                     | length                                       |

**Total useMemo = 11** en path crítico.

---

## Sección 2 — Trabajo por render del orchestrator

### `deriveProgress(trained, todayIdx, zodiac)` (data/derive-progress.ts:40-114)

- O(n) sobre `trained.slice(0, todayIdx+1).filter(Boolean)` (línea 55) → trivial.
- Bucle figureSeq build (líneas 62-80): O(stars + lines + stars) = O(28). Trivial.
- `buildFieldStars` (líneas 8-38): bucle while con detección de colisión sobre 9 figureStars; peor caso ~540 candidatos × 9 comparaciones. Determinista pero **no memoizado dentro de la función** (la memoización vive en el `useMemo` que la envuelve).
- Interleave loop (líneas 91-104): O(28). Trivial.

**Veredicto:** `deriveProgress` es estable. **La preocupación real es la referential stability de `trained` desde el padre.** Si el padre re-renderiza con un nuevo array reference (típico `useState`/`zustand` cuando se actualiza), la memo se invalida cada render y se recalcula todo el árbol downstream. ⚠ Verificar el call-site de `<LunarConstellation>` para descartar invalidación falsa.

### `stars: Resolved[]` (LunarConstellation.tsx:56-64)

`zodiac.stars.map` para Leo → 9 elementos, 3 mults c/u. Trivial. Memo
sobre `[zodiac]` → solo cambia si el sign cambia. ✅

### `useFigureGeometry(zodiac, stars)` (data/use-figure-geometry.ts:21-94)

- `alphaIdx`: O(n) sobre stars. Trivial.
- `alphaPos`: O(1).
- `starDepth` BFS (líneas 59-78): O(stars + lines). Memoizado sobre
  `[stars, zodiac.lines, alphaIdx]` — esos no cambian salvo cambio de sign.
  **BFS = 1 vez por sign**, no por render. ✅
- `lineDepth`: O(lines) map. Trivial.

### `useLitMaps` (data/use-lit-maps.ts:31-84)

- `litKeys`: O(elementsLit). Memo sobre `[elementsLit, sequence]`. 1 vez por commit.
- `litCluster`: O(litStars) — un loop + dos reduces. Memo sobre `[stars, litKeys]`.
  **No es O(n²)**. ✅
- `starRecency`: O(todayIdx + elementsLit). Memo sobre `[trained, todayIdx, elementsLit, sequence]`.

### Strings calculadas en JSX cada render

- `lit-lines.tsx:122`: `const gradId = \`litLine-${idx}\``— 1 por lit line por render.
Más relevante: hay **un`<Defs>`por cada`LitLineFilament`\*\* (lit-lines.tsx:164-177).
  Con 4 lit lines → 4 Defs locales además del Defs global. Costo de paint, no
  solo de JS. ⚠ Ver hipótesis #8.
- `figure-base.tsx:59` (`bl-${idx}`), `:73` (`bs-${i}`): keys — trivial.
- `lit-stars.tsx` keys: trivial.
- `igniting-overlay.tsx:33`: `ignitingKey.split('-')` por render del overlay. Trivial.

---

## Sección 3 — Trabajo por tick de cada clock

Los 4 clocks corren simultáneamente a ~60fps en UI thread. Cada tick despierta
a TODOS los worklets que leen ese SV.

### `t` (8 s) — el clock dominante

Lectores: AmbientField×5, CosmicDust×7, StarWinks×5, ShootingStar×6, FieldStar×5,
BaseLayer.PlaceholderStar×9, BaseLayer.HeroGlow×1, LitClusterMotes×6,
LitLines.beams×8 (4×2), LitStar×20, VolRays×1, HeroGlow×1, Flare×5, TodayRing×1,
StarSpark×14, CompletionRings (no aplica).

**Total worklets leyendo `t`**: ~96 de 136.

### `breathT` (16 s)

Lectores: ZodiacEngraving, LitClusterAura, LitLineFilament.filamentProps × 4,
LitStar.haloProps × 5, LitStar.starProps × 5, AnticipationCrown × 2 (no aplica).

**Total worklets leyendo `breathT`**: ~16.

### `slowT` (5 s)

Lectores: **BaseLayer.linesProps** (figure-base.tsx:41) — único.

**Total worklets leyendo `slowT`**: **1**. Mantener un clock dedicado de 5s
para un solo lector es muy poca recompensa, podría reusarse `t` con un factor.

### `driftT` (42 s)

Lectores: DeepField, AmbientBucket × 5 (parallax), Nebula × 4 (warm + cool + deep + bronze).

**Total worklets leyendo `driftT`**: 10.

### Worklets que devuelven OBJETOS NUEVOS cada frame

Todos los `useAnimatedProps` retornan literal nuevo en cada tick — esperado.
Lo importante son objetos con campos costosos:

- `transform` arrays:
  - `AmbientBucket` × 5: 2 transforms (ambient-field.tsx:41).
  - `DeepField` × 1: 2 transforms.
  - Nebula × 4: 2 transforms.
  - `PlaceholderStar` × 9: **5 transforms** (figure-base.tsx:175-181). El más caro: 9 × 5 = 45 objetos transform/frame.
  - `LitStar.starProps` × 5: 5 transforms = 25 objetos.
  - `LitStar.VolumetricRays` × 1: 5 transforms.
  - `LitStarFlare.shimmer` × 5: 5 transforms = 25 objetos.
  - `LitStar.TodayRing` × 1: 5 transforms.
  - `IgnitingStar.starProps`, `spikeProps`: 5 c/u (durante ignition).
- **Total por frame en steady state ≈ 110 objetos transform** → ~6600 alocaciones/segundo. No catastrófico pero presión sobre el GC de JSI.

Más sutil:

- **`BurstCore` y `ParticleSpark` corren con `pulse=0`** (particle-burst.tsx:101-121):
  worklet evalúa, devuelve coords off-screen + opacity:0, **no hay tear-down**.
  28 worklets zombies × 60 fps = ~1.68k ops/s. ⚠ Ver bug #3.
- **`CenterNumberOverlay.textProps`** convierte número a string cada frame
  (center-number-overlay.tsx:45) durante el count-up. El `useDerivedValue` corre
  todo el tiempo, incluso fuera de la ventana de animación. ⚠

---

## Sección 4 — Re-render risk del orchestrator

### `displayedCount` SV → no re-renderiza orchestrator ✅

Es SharedValue (use-ignition-engine.ts:60). Confirmado: pasa como prop sin
tocar React state.

### `setBurstId` re-renderiza orchestrator ⚠

`setBurstId((n) => n + 1)` (use-ignition-engine.ts:124) — setState dentro del
commit detector. **TODO el árbol del Svg se reconcilia** porque ningún
componente está `memo`-izado. Aunque las props sean estables, la comparación
cuesta y el render path es largo. **Probable mayor fuente de jank al marcar día.**

### `ignitingKey` → cascada de re-renders ⚠⚠

Cada cambio de `ignitingKey` (use-ignition-engine.ts:159 y :161) re-renderiza
orchestrator. Ciclo por commit (elementsLit 14 → 15):

1. setState `setIgnitionQueue([...q, newEl])` (línea 130) → render #1.
2. queue effect → `setIgnitingKey(key)` (línea 159) → render #2.
3. después de `duration + 30 ms` → `setIgnitingKey(null)` (línea 161) → render #3.
4. - `setBurstId` (línea 124) dentro del primer dispatch → render adicional.

→ **Cada tap dispara ~4 renders del orchestrator**, cada uno reconcilia ~150 hijos.

`ignitingKey` también pasa como prop a `LitLines`, `StarsLayer`, `IgnitingOverlay`
(LunarConstellation.tsx:195, 206, 216). Estos lo usan para `litKeys.has(...)`
skip-lookup — su render NO es trivial: cada `LitLines.map(zodiac.lines)`
recorre todas las líneas (10), cada `StarsLayer.map(stars)` recorre todas las
stars (9), aun cuando solo cambió un ignitingKey.

### Otros state

- `canvasReady` — 1 transición false→true ~1500ms post-mount.
- `ignitionQueue` — un setState por commit.

---

## Sección 5 — Cold start cost

### `buildAmbientField` (data/scatter.ts:11-33)

60 iteraciones; 2 `Math.sin` c/u + verificación centro + push. Memoizado en
ambient-field.tsx:12. **Costo < 0.5ms.** No es el cuello.

### `DEEP_STARS` (data/scatter.ts:61-77)

**IIFE módulo-level** → computa al cargar el módulo (antes del primer paint).
30 iteraciones con seno + filtro centro. < 0.2ms. Trivial pero **ejecuta
unconditionally** incluso si el usuario nunca abre `/hoy`.

### Costo cold-start real

1. **`canvasReady` espera 1500ms** (use-canvas-reveal.ts:31). Durante este tiempo
   se renderiza `CanvasSkeleton`, que tiene su propio `Svg` con `<BlurView>`
   (skeleton.tsx:153), `withRepeat` clock (skeleton.tsx:121-125), N×SkeletonStar
   - N×SkeletonLine worklets. Después de 1500ms el árbol real se monta. → **dos
     paints completos** del SVG.
2. El primer paint del SVG real instancia ~100 componentes animados a la vez.
   react-native-svg + Reanimated 4 + new arch deben registrar cada Animated
   component con su worklet y arrancar timers.
3. **`<AnimatedBlurView>`** (LunarConstellation.tsx:250) — durante los primeros
   700ms (use-canvas-reveal.ts:37) la `intensity` baja 18 → 0. El BlurView en iOS
   es un layer caro; un blur completo sobre todo el Svg de 290×290 mientras las
   animaciones corren simultáneamente es **un GPU bottleneck conocido en iOS**.
   Probable fuente de "jank al abrir /hoy". ⚠

### SVG `<Defs>` y gradientes

Globales en `<SvgGradients>` (static/svg-gradients.tsx:5-58):

- `RadialGradient#starLit, starNext, litClusterAura, cardVignette`
- `LinearGradient#cardEdgeFade`
- **5 gradientes globales.**

Locales por LitLineFilament: 1 LinearGradient por lit line. Steady state
(14 lit) ≈ 9 gradientes.

`RadialGradient` en react-native-svg en iOS tiene bugs con alpha stops
(referenciado en ambient-glow.tsx:14-25 y nebula-patches.tsx:9-22). Por eso
AmbientGlow tiene **12 Ellipses estáticos** y NebulaPatches **13 layers × 4 patches = 52**.
Decisión consciente pero el costo es renderizar **~64 Ellipses extra** en el
primer paint, cada uno con su propia `opacity` prop.

---

## Sección 6 — Hipótesis priorizadas

Ordenadas por **impacto esperado / effort**.

### 🐛 bug #1 — BaseLayer dibuja TODAS las stars como placeholder, incluso las lit

`figure-base.tsx:72-74`:

```ts
{stars.map((s, i) => (
  <PlaceholderStar key={`bs-${i}`} s={s} i={i} t={t} />
))}
```

No hay `if (litKeys.has(\`star-${i}\`))`check. Mientras tanto`StarsLayer`renderiza`LitStar` para las lit (lit-stars.tsx:55-71). **Las 5 stars lit se
están renderizando DOS veces**: como placeholder (4-point sparkle cream +
HeroGlow para Regulus) **y** como LitStar encima.

- Costo: 5 PlaceholderStar worklets redundantes + 5 sparkle-path SVG nodes
  overdraw cada frame.
- En trained=28: 9 PlaceholderStar redundantes + 9 paths overdraw.

**Hipótesis**: ahorrar 5–9 worklets/frame + 10–18 path renders. Tangible en
mid/end-game.

**Effort**: XS (filtrar por `litKeys.has(\`star-${i}\`)`o un prop`excludeIdx: Set<number>`).

**Riesgo**: Bajo. Visual: el placeholder cream queda absorbido por la halo
magenta del lit; al quitar el placeholder no se ve diferencia. Validar con
screenshot before/after.

**Cómo validar**: `__DEV__ && console.log('placeholder render', i)`
momentáneamente, contar; Reanimated profiler en trained=14.

---

### #2 — Memoizar el subárbol "ambient" detrás de `React.memo`

`<DeepField>`, `<AmbientField>`, `<StarWinks>`, `<ShootingStar>` × 3,
`<AmbientGlow>`, `<NebulaPatches>`, `<CosmicDust>` reciben todos sólo
SharedValues + constantes. **Ninguno necesita re-render cuando cambian
`trained`, `todayIdx`, `ignitingKey`, `burstId`, `canvasReady`.**

Actualmente cada cambio de estado en el orchestrator (≥ 4 renders por commit,
ver §4) re-renderiza estos componentes (React reconcilia aunque emita el mismo
árbol). Reconciliación de ~60-80 componentes ambient innecesaria por commit.

**Por qué no está memoizado ahora**: los exports son `export function X` directos,
sin `memo()`.

**Hipótesis**: memoizar 7 exports con `React.memo` ahorra ~80 reconciliaciones ×
4 renders/commit = 320 reconciles. Más importante: deja libre el thread JS
justo cuando el animator arranca.

**Effort**: S (envolver 7 exports).

**Riesgo**: Bajo (SharedValues son referentialmente estables).

**Validación**: `console.log` en cada componente ambient, contar renders al
marcar día antes/después. React DevTools Profiler con "Highlight updates".

---

### 🐛 bug #3 — `<ParticleBurst>` ejecuta ~28 worklets cada frame con pulse=0

`particle-burst.tsx:101-121`: cada `ParticleSpark` corre en cada frame, leyendo
`pulse.value`. Si `pulse=0`, devuelve coords off-screen + opacity:0 y los
`<Line>` reciben props nuevas → react-native-svg compara y (típicamente) skip,
pero igual hay **28 worklet executions + 28 props diffing/frame** mientras no
hay burst.

Multiplicado por 60fps → **1680 worklet ops/segundo zombies**.

**Hipótesis**: condicionar el render del ParticleBurst a un flag `burstActive`
(setState con setTimeout, o `useAnimatedReaction` sobre `pulse.value` que setea
visibilidad local). Cuando no hay burst → 0 worklets.

**Effort**: S.

**Riesgo**: Bajo. Cuidado con no cortar un burst en vuelo.

**Validación**: counter en cada worklet → debería caer a 0 fuera del commit.

---

### #4 — Reducir worklets por LitStar (4 → 1-2)

Cada LitStar tiene 4 `useAnimatedProps`: `haloProps`, `starProps`,
`outerHaloProps`, `coreProps`. Cada uno calcula `wave = 0.5 + 0.5 * sin(...)`
con el mismo `t.value + phase`. **4 ejecuciones de seno redundantes por
star/frame.**

Opciones:

- (b) `useDerivedValue` compartido para `wave` y `breath`, después leerlos
  desde los 4 worklets. Convierte 4 sin/star → 1 sin/star.
- (c) Pasar el `useDerivedValue(wave)` desde el padre.

**Hipótesis**: 5 stars × 4 worklets × 1-2 sin redundantes = ~30 sin/frame
ahorradas. A 28 lit (end-game) escalaría a ~100 sin/frame solo en LitStars.

**Effort**: M (refactor de hooks de LitStar).

**Riesgo**: Medio (capas dependientes; fácil romper visual).

**Validación**: Reanimated profiler — worklet count, frame budget. A/B visual.

---

### #5 — `<AnimatedBlurView>` y cold-start jank

El `<AnimatedBlurView intensity={revealBlur}>` (LunarConstellation.tsx:250-255)
cubre TODO el Svg y anima `intensity` 18 → 0 durante 700ms. En iOS,
`BlurView` (UIVisualEffectView) animado tiene **costo de paint significativo en
GPU**. La ventana 1500ms+700ms del reveal coincide con el reporte de jank al
abrir `/hoy`.

**Hipótesis**:

- (a) Reemplazar `intensity` por opacity fade del BlurView (intensity fija).
- (b) Saltarse el blur en device de gama media-baja (threshold).
- (c) Reducir intensidad máxima (18 → 8) y duración (700 → 400 ms).
- (d) Si skeleton + cross-fade ya sellan el reveal, **quitar el BlurView entero**.

El comentario (use-canvas-reveal.ts:13-22) justifica como "rack-focus" pero en
device real puede ser el rey del jank.

**Effort**: S (cambio prop) o XS (eliminar).

**Riesgo**: Medio (decisión visual). Pedir UX validation.

**Validación**: A/B en device real con Performance HUD; medir
time-to-interactive.

---

### #6 — `<StarBurst>` re-creación por `setBurstId`

Como noté en §4, `setBurstId` re-renderiza el orchestrator entero. El propósito
de `burstId` es solo seedear `burstHash`. Podemos:

- (a) Reemplazar `burstId` state por `useSharedValue<number>` que el worklet de
  `ParticleSpark` lee directamente y reseedea cuando pulse arranca. Elimina el
  re-render del orchestrator por este efecto.
- (b) Mover `setBurstId` a un `useRef` con counter (no triggers re-render) +
  comunicar el cambio al subárbol burst con un useAnimatedReaction.

**Hipótesis**: eliminar 1 de los 4 renders/commit del orchestrator. Como esos
renders propagan al sub-árbol entero (sin memoización), esto se nota.

**Effort**: S–M.

**Riesgo**: Medio (la `burstHash` debe ver el seed nuevo a tiempo).

**Validación**: counter en cada render del orchestrator.

---

### #7 — `slowT` es un clock dedicado para un solo lector

`use-clocks.ts:46` declara `slowT` (5s loop) usado únicamente por
`BaseLayer.linesProps` (figure-base.tsx:41). Eliminar `slowT` y derivarlo de
`t` dentro del worklet (`Math.sin(t.value * (8/5) * 2 * Math.PI)`) ahorra:

- 1 sharedValue.
- 1 withRepeat cycle en UI thread.
- 1 useEffect dependency.

**Hipótesis**: ahorro marginal (1 timer Reanimated). Limpia el modelo mental:
3 clocks en vez de 4.

**Effort**: XS.

**Riesgo**: Bajo (mismo período efectivo si se computa bien).

**Validación**: A/B visual (la respiración del placeholder no debe cambiar).

---

### #8 — Mover `<Defs>` de `LitLineFilament` al Defs global

Cada `LitLineFilament` define su `<Defs><LinearGradient id={\`litLine-${idx}\`}>`
(lit-lines.tsx:164-177) por instancia. Crea/destruye Defs cada vez que cambian
las lit lines.

Alternativa: definir TODAS las 10 LinearGradients para Leo en `<SvgGradients>`
global con ids estables `litLine-0…litLine-9`. Trade-off: requiere conocer
`zodiac.lines` en SvgGradients (pasar prop) y crear gradients vacíos para no-lit.

**Hipótesis**: estabilidad de Defs entre renders → react-native-svg no
reconcilia gradientes nuevos al cambiar litKeys.

**Effort**: M (refactor SvgGradients + paso de prop).

**Riesgo**: Bajo–Medio (gradient es `userSpaceOnUse` con coordenadas A-B
estables por línea).

**Validación**: profile → tiempo de paint primer frame de lit-line.

---

### #9 — Reducir `NEBULA_LAYERS = 13`

`nebula-patches.tsx` dibuja **52 ellipses estáticas** (4 patches × 13 layers)
con opacidades muy bajas. Visual justificado como "fake radial gradient" pero
el costo de paint es **52 fillRect-equivalent** cada frame que el `AnimatedG`
drift muta su transform.

**Hipótesis**: bajar a 8 layers por patch → 32 nodes (-38%). Si la transición
sigue suave, no se nota. Alternativo: PNG cacheado.

**Effort**: XS (constante) o M (image-based).

**Riesgo**: Medio (visual, requiere ojo de diseño).

**Validación**: screenshot A/B con/sin reducción.

---

### #10 — Memoizar `nextEl`

`LunarConstellation.tsx:79` calcula `nextEl` en cada render. Trivial pero
asignación + lookup cada vez. Memoizable con `useMemo`. Caso típico: `nextEl`
es referencialmente estable porque viene de `sequence[elementsLit]`.

**Hipótesis**: efecto marginal. **Effort**: XS. **Riesgo**: ninguno.
**Validación**: no es necesario; baja prioridad.

---

## Resumen ejecutivo

|   # | Hallazgo                                     | Tipo    | Impacto              | Effort | Prioridad |
| --: | -------------------------------------------- | ------- | -------------------- | ------ | --------: |
|   1 | PlaceholderStar dibuja lit stars también     | 🐛 bug  | Alto en mid/end-game | XS     |        🔥 |
|   2 | Ambient subtree no memoizado                 | Optim   | Alto al marcar día   | S      |        🔥 |
|   3 | ParticleBurst worklets zombies con pulse=0   | 🐛 bug  | Constante 1.6k ops/s | S      |        🔥 |
|   5 | AnimatedBlurView en cold start               | Optim   | Probable jank /hoy   | S–XS   |      Alto |
|   6 | setBurstId fuerza re-render del orchestrator | Optim   | Jank al commit       | M      |      Alto |
|   4 | 4 worklets/LitStar → fusionar                | Optim   | Marginal pero escala | M      |     Medio |
|   8 | Defs locales en LitLineFilament              | Optim   | Cold-paint de líneas | M      |     Medio |
|   9 | NEBULA_LAYERS=13 → 8                         | Optim   | GPU paint cold       | XS–M   |     Medio |
|   7 | slowT clock para 1 lector                    | Cleanup | Marginal             | XS     |      Bajo |
|  10 | useMemo nextEl                               | Trivial | Ninguno              | XS     |      Bajo |

**Recomendación de orden de ataque para los 2 dolores reportados:**

- **Jank al abrir /hoy** → #5 (BlurView), #2 (memoizar ambient para que el
  primer paint no reconcilie todo el sub-tree por segunda vez al subir
  canvasReady), #9 (NEBULA_LAYERS).
- **Jank al marcar día** → #1 (bug PlaceholderStar overdraw), #3 (ParticleBurst
  zombies), #6 (setBurstId re-render), #2 (memoizar ambient).

---

## Notas finales

- Hay un **export sin uso** en `useIgnitionEngine`: retorna `rayPresence`
  (use-ignition-engine.ts:82-85) pero el orchestrator **no lo destructura**
  (LunarConstellation.tsx:84-92). Dead code: 1 useEffect + 1 sharedValue
  innecesarios. Cleanup XS.
- `committed` es prop pero `nextEl` es la única salida que la consume.
- Comentario en lit-lines.tsx:97-99 justifica `LitLineFilament` per-instance.
  **No** consolidar el filament en un solo worklet.
- `igniting-overlay.tsx:33` `ignitingKey.split('-')` por render del overlay;
  cleanup posible pero marginal.

## Archivos críticos para implementación

- `features/tabs/components/constellation/rendering/figure-base/figure-base.tsx` — bug #1
- `features/tabs/components/constellation/rendering/burst/particle-burst.tsx` — bug #3
- `features/tabs/components/constellation/animation/use-canvas-reveal.ts` — fix #5
- `features/tabs/components/constellation/animation/use-ignition-engine.ts` — fix #6
- `features/tabs/components/constellation/rendering/ambient/index.ts` (+ 6 hermanos) — fix #2
