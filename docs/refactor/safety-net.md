# Constellation refactor · Paso 3 · Red de seguridad

Documenta las 3 herramientas que validan equivalencia entre fases del
strangler-fig refactor. Cada una catches cosas distintas; ninguna sola
es suficiente.

---

## 1 · Jest snapshot tests (LA RED CRÍTICA)

**Archivo**: `features/tabs/components/__tests__/LunarConstellation.test.tsx`
**Comando**: `pnpm test -- LunarConstellation`
**Snapshots**: `features/tabs/components/__tests__/__snapshots__/LunarConstellation.test.tsx.snap`

**Qué captura**

48 snapshots (12 signos × 4 estados) del render tree completo. Con
`react-native-reanimated/mock` cargado en `jest.setup.ts`, los
worklets se reducen a stubs y todas las `SharedValue` se materializan
con su valor sincronizado. **El árbol resultante es 100% determinístico**
— el mismo input produce el mismo snapshot byte-a-byte.

Catches:

- Componente extraído mal (faltan layers, sobran layers).
- Prop perdida o renombrada en la cascada de paso.
- Orden del render tree alterado (capas en distinto z-order).
- ID de gradiente SVG cambiado (los strings de fill quedan rotos).
- `deriveProgress.sequence` devuelve algo distinto para los mismos inputs.

**Qué NO captura**

- Diferencias de timing entre worklets (los worklets están mockeados).
- Performance / jank (no se mide).
- Errores que sólo aparecen en Reanimated real (vs el mock).

**Workflow durante el refactor**

```bash
# 1) Antes de empezar la fase F-N, regenera baseline:
pnpm test -- LunarConstellation -u

# 2) Implementa los cambios de la fase.

# 3) Verifica:
pnpm test -- LunarConstellation

# Si hay diff: NO ejecutes `-u` para "arreglar" el snapshot. Revierte
# el cambio que lo rompió y entiende qué cambió.
```

**Cuando hay falso positivo aceptable**

Sólo si el cambio es POR DISEÑO (ej: aceptaste cambiar el orden de
unos elementos durante el refactor — lo cual idealmente NO debería
pasar). En ese caso documentar en el PR description que el snapshot
se regeneró a propósito.

---

## 2 · Pantalla `/refactor-test/[stateId]`

**Archivos**:

- `app/refactor-test/index.tsx` — overview con links a cada estado
- `app/refactor-test/[stateId].tsx` — render single full-canvas

**Cómo se usa**

1. `pnpm start` → presionar `i` para iOS Sim.
2. Navegar a `/refactor-test` en Expo Go (escribir la URL en la
   barra del simulator, o desde el bottom-sheet de DevMenu).
3. Tocar un estado de la lista; carga el canvas full-screen.

**Para qué sirve**

- Inspección manual a ojo de los 12 signos × 4 estados con datos fijos.
- Captura de baseline para `visual-diff.sh`.
- Reproducción determinista de cualquier estado para debug visual.

**Para qué NO sirve**

- No es un test automatizado. Requiere humano + simulator.
- No corre en CI.

---

## 3 · `scripts/visual-diff.sh`

**Comando**: `scripts/visual-diff.sh [capture|capture-all|diff|list|clean]`
**Requiere**: macOS + Xcode command-line tools + `brew install imagemagick`

**Qué captura**

Catástrofes visuales del canvas:

- El canvas quedó negro.
- La constelación se salió del frame.
- Un layer entero desapareció (engraving art, lit cluster aura,
  center number overlay).
- El counter chip se movió de lugar significativamente.

Con tolerancia default de 5% — sobreajustable via
`VISUAL_DIFF_TOLERANCE_PCT=10 scripts/visual-diff.sh diff`.

**Qué NO captura**

- Twinkle / breath / drift desfasados — eso ES ruido aceptable.
- Diferencias por debajo del 5% del canvas. Para precision menor,
  los Jest snapshots son la gate.

**Workflow durante el refactor**

```bash
# UNA VEZ — antes de empezar el refactor:
# 1) Boot simulator + app.
# 2) Navegar manualmente a /refactor-test, ir state por state, y:
scripts/visual-diff.sh capture-all baseline
# (te va a prompttear ENTER después de cada nav)

# DESPUÉS DE CADA FASE F-N:
# 3) Navegar manualmente otra vez por todos los estados:
scripts/visual-diff.sh capture-all current

# 4) Diff:
scripts/visual-diff.sh diff
# (sale tabla STATE | DIFF_% | STATUS, exit 1 si algún FAIL)

# Si un estado puntual falla:
scripts/visual-diff.sh diff leo-halfway
# Inspecciona el diff visual en scripts/visual-diff/diff/leo-halfway.png
```

**¿Qué hacer si el script falla?**

- `SIZE_OR_FORMAT_DIFFERS`: las capturas tienen tamaño distinto.
  Probablemente cambiaste de simulator entre capturas o algún
  status-bar drift. Re-captura en el mismo dispositivo.
- `FAIL` con diff > 5%:
  1. Abrir `diff/<state>.png` — `compare` lo pinta con las
     diferencias en rojo.
  2. Si la diferencia es claramente del twinkle / breath / shooting
     star → re-capturar (puede haber agarrado un frame raro) y
     re-correr el diff.
  3. Si la diferencia es estructural (algo se movió, falta una capa,
     un color es distinto) → REVERTIR la fase del refactor. NO
     "arreglar" el baseline.

---

## ¿Cómo se complementan las tres herramientas?

|                            | Jest snap | /refactor-test | visual-diff.sh        |
| -------------------------- | --------- | -------------- | --------------------- |
| Bit-perfect equivalencia   | ✅        | ❌             | ❌                    |
| Detecta layer perdido      | ✅        | ✅             | ✅                    |
| Detecta wrong prop         | ✅        | ⚠ depende      | ⚠ depende             |
| Detecta wrong z-order      | ✅        | ✅             | ✅                    |
| Detecta timing desfasado   | ❌        | ⚠ ojo humano   | ❌                    |
| Detecta worklet caído      | ❌        | ✅ visible     | ⚠ a veces             |
| Catastrophe (canvas negro) | ✅        | ✅             | ✅                    |
| Automatizable / CI         | ✅        | ❌             | ⚠ semiautomático      |
| Tiempo por iteración       | ~10 s     | ~minutos       | ~3 min (capture+diff) |

**Recomendación de uso por fase del plan**:

- **F1-F8 (Foundation + Static rendering)**: Jest snap basta. Las
  worklets no se tocan, el visual-diff sería redundante.
- **F9-F14 (Animated simple)**: Jest snap + 1-2 estados clave en
  /refactor-test manual.
- **F15 (lit-stars, ALTO)**: Jest snap + capture-all baseline previo
  - visual-diff completo + inspección manual de los 12 signos en
    device real (iOS Sim + Android Emulator).
- **F16-F18**: Jest snap + visual-diff de los estados afectados.
- **F19 (clocks, ALTO)**: Jest snap + visual-diff + 60 segundos
  mirando el canvas en device real verificando que las animaciones
  siguen sincronizadas como antes.
- **F21 (ignition-engine, ALTO)**: Jest snap + visual-diff +
  testing manual de tap-to-mark en /hoy con device real.
- **F24 (cierre)**: Jest snap + visual-diff + flujo completo manual.
