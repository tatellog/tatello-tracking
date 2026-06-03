# Glifos de dimensión — prompts de generación (Órbita · estado de FOCO)

Prompts afinados para generar 4 glifos-constelación nuevos (CUERPO, SUEÑO,
ENERGÍA, CICLO) que igualen la riqueza de los dos gold-standard ya
existentes: `mind-vect.svg` (MENTE) y `food-vect.svg` (ALIMENTO).

Flujo: la dueña genera el PNG con una herramienta de imagen → vectorizamos a
SVG → recoloreamos por dimensión vía filtro en runtime. Por eso el arte debe
salir **monocromo, un solo tono claro sobre fondo oscuro**, sin gradientes.

---

## 1 · La receta de estilo (extraída de MENTE y ALIMENTO)

Leí los dos archivos canónicos y destilé la fórmula exacta. Todo prompt
nuevo debe reproducir ESTO:

### Anatomía de la pieza

- **Sujeto central como constelación**: el motivo de la dimensión (un
  cerebro en MENTE, una manzana / forma orgánica en ALIMENTO) NO se dibuja
  como ilustración sólida. Se dibuja como un **dibujo a línea estelar**:
  el contorno y la estructura interna se trazan con líneas finísimas que
  laten, y los puntos de inflexión son **nodos luminosos** (pequeños
  círculos/estrellas brillantes).
- **Doble contorno con halo**: el sujeto tiene un contorno principal y un
  segundo contorno paralelo más tenue (efecto de aura / dispersión). En el
  SVG esto aparece como paths con `fill-opacity` decreciente (0.98 → 0.4).
- **Aro punteado que enmarca**: una circunferencia delgada de puntos /
  guiones rodea TODO el sujeto, como marco de carta astral. NO es un
  círculo sólido — es un anillo de pequeños puntos espaciados, con al
  menos un quiebre o asimetría (no perfectamente cerrado).
- **Estrellitas de 4 puntas dispersas**: pequeñas estrellas de cuatro
  brazos (tipo destello/sparkle) salpicadas alrededor del sujeto y sobre
  el aro, de tamaños variados. Son el sello visual de la serie.
- **Líneas conectoras (scrollwork)**: curvas Bézier suaves, nunca rectas
  rígidas, que conectan nodos y fluyen alrededor del sujeto como
  filigrana art-nouveau / sigilo celeste.

### Tratamiento de color y forma

- **Monocromo total**: un único tono rosa pálido `#FFB8B3` sobre
  transparente. CERO segundo color, CERO gradiente. (El tono exacto da
  igual porque se recolorea; importa que sea **un solo tono claro,
  saturación baja, alto contraste contra negro**.)
- **Variación tonal SOLO vía opacidad**: la profundidad se logra con
  `fill-opacity` (nodos al 100%, halos y polvo lejano al 40-60%). Nunca
  con un color distinto.
- **Relleno, no stroke** en el gold-standard (son shapes rellenos muy
  finos). Para vectorizar limpio puede salir como stroke; lo unificamos
  después. Lo importante es **grosor de línea fino y constante** (no
  trazos gruesos, no caligrafía variable).

### Composición

- **Formato cuadrado** (1:1). El sujeto ocupa ~60-70% del lienzo, centrado,
  con margen de respiro alrededor para que el aro no toque el borde.
- **Densidad media-alta**: más rica que un icono, menos que un grabado
  saturado. Densa cerca del centro, más aireada hacia el aro.
- **Asimetría elegante**: el sujeto y la filigrana NO son radialmente
  simétricos (evitar efecto "copo de nieve"). El aro puede ser regular
  pero el scrollwork interno varía por sección.
- **Fondo negro warm / transparente**: nunca un fondo lleno de color ni
  textura. El campo estelar lo pone la app detrás.

### Referencias mentales (para la herramienta)

Genshin Impact constellation page · Honkai Star Rail constellation · carta
astral art-deco (Cellarius / Hevelius) · diagramas editoriales de la NASA ·
line-art de tarot celeste. NUNCA: flat illustration tipo Headspace, clipart,
emoji, render 3D, fotorrealismo.

---

## 2 · Los 4 prompts (uno por dimensión)

Cada bloque trae: el prompt principal (pegar tal cual) + el negative prompt.
Pensados para **Midjourney v6** como base; abajo hay notas para DALL-E 3 /
Imagen.

> **Tip transversal:** generá a 2048×2048, pedí 4 variantes y quedate con la
> de MENOS ruido y líneas más limpias. Stelar es contención: si dudás entre
> dos, elegí la más vacía.

---

### 2.1 · CUERPO — vitalidad corporal

> Motivo seguro y neutro: **un corazón anatómico latiendo + una onda de
> pulso**, resuelto como constelación. NO figura humana, NO silueta
> femenina, NO cuerpo. El corazón-pulso comunica vitalidad/movimiento sin
> activar comparación corporal.

```
Ornamental constellation glyph of an anatomical heart with a pulse /
heartbeat waveform flowing out of it, drawn as a celestial star map.
The heart's contours and inner chambers are traced in fine luminous
lines, with bright glowing star-nodes at every junction. A faint second
parallel outline gives a soft aura halo. A thin dotted circular frame of
small spaced dots rings the whole figure like an antique astral chart,
with one decorative break. Small four-pointed sparkle stars of varying
sizes scattered around. Single monochrome pale rose tone (#FFB8B3) on a
deep transparent background, no fills, only fine luminous line art,
depth only through opacity. Art-nouveau scrollwork connecting curves,
graceful asymmetric balance, generous negative space, cosmic editorial
quality in the style of Genshin Impact constellation page and antique
star atlas. --ar 1:1 --v 6 --style raw --s 200
--no human figure, body, silhouette, woman, face, hands, muscles drawn
realistically, color, gradient, photorealism, 3d render, fill, color
blocks, text, watermark, blur, flat illustration, clipart
```

Alternativa de motivo si el corazón no convence: **rama de pulso /
cardiograma como constelación** sola, o **un destello radial de energía
vital** (sin órganos). Variá `anatomical heart` → `heartbeat pulse line` →
`radiant vitality burst`.

---

### 2.2 · SUEÑO — descanso, noche

> Motivo: **luna creciente con fases menores + estrellas nocturnas**, como
> constelación. Sereno, onírico.

```
Ornamental constellation glyph of a crescent moon cradling smaller moon
phases and a soft scatter of night stars, drawn as a celestial star map.
The crescent's edge is traced in fine luminous lines with bright glowing
star-nodes along it, a faint second parallel outline giving a dreamy
aura halo. A thin dotted circular frame of small spaced dots rings the
whole figure like an antique astral chart, with one decorative break.
Small four-pointed sparkle stars of varying sizes scattered around,
denser near the crescent. Single monochrome pale rose tone (#FFB8B3) on
a deep transparent background, no fills, only fine luminous line art,
depth only through opacity. Soft art-nouveau scrollwork connecting
curves, graceful asymmetric balance, generous negative space, calm
oniric mood, cosmic editorial quality in the style of Genshin Impact
constellation page and antique star atlas. --ar 1:1 --v 6 --style raw
--s 200
--no full moon as solid disc, color, gradient, photorealism, 3d render,
fill, color blocks, text, watermark, blur, flat illustration, clipart,
sun, face on moon, cartoon
```

Variá: `crescent moon` → `waning crescent with three phase dots` →
`crescent moon over a sleeping star field`.

---

### 2.3 · ENERGÍA — chispa, vitalidad

> Motivo: **rayo / relámpago dentro de un estallido radiante**, como
> constelación. Es lo que el icono simple ya insinúa (un bolt) pero
> elevado a la riqueza de MENTE.

```
Ornamental constellation glyph of a lightning bolt at the centre of a
radiant starburst, drawn as a celestial star map. The bolt's zigzag and
the radiating rays are traced in fine luminous lines with bright glowing
star-nodes at every angle and ray tip, a faint second parallel outline
giving an energetic aura halo. A thin dotted circular frame of small
spaced dots rings the whole figure like an antique astral chart, with
one decorative break. Small four-pointed sparkle stars of varying sizes
scattered around, radiating outward. Single monochrome pale rose tone
(#FFB8B3) on a deep transparent background, no fills, only fine luminous
line art, depth only through opacity. Art-nouveau scrollwork connecting
curves, dynamic but graceful asymmetric balance, generous negative
space, cosmic editorial quality in the style of Genshin Impact
constellation page and antique star atlas. --ar 1:1 --v 6 --style raw
--s 200
--no neon, electric blue, harsh glow, color, gradient, photorealism, 3d
render, fill, color blocks, text, watermark, blur, flat illustration,
clipart, comic lightning
```

Variá: `lightning bolt + starburst` → `spark with radiating energy lines`
→ `small sun-spark with rays`. Mantené la lectura de "chispa", evitá que
parezca un sol pleno (eso es de SUEÑO/CICLO el círculo).

---

### 2.4 · CICLO — ritmo cíclico, fases

> Motivo: **anillo de fases lunares en círculo** (rueda de fases), como
> constelación. Comunica ciclo/ritmo sin literalidad clínica.

```
Ornamental constellation glyph of a circular wheel of moon phases — a
ring of small moons cycling from new to full and back — drawn as a
celestial star map. Each phase is a luminous line-traced node, connected
around the ring by fine flowing curves, with bright glowing star-nodes
between them and a faint second parallel ring giving a soft aura halo.
A thin dotted circular frame of small spaced dots encloses the whole
figure like an antique astral chart, with one decorative break. Small
four-pointed sparkle stars of varying sizes scattered around. Single
monochrome pale rose tone (#FFB8B3) on a deep transparent background, no
fills, only fine luminous line art, depth only through opacity.
Art-nouveau scrollwork connecting curves, cyclical rhythmic composition,
balanced but not rigidly symmetric, generous negative space, cosmic
editorial quality in the style of Genshin Impact constellation page and
antique star atlas. --ar 1:1 --v 6 --style raw --s 200
--no clinical diagram, calendar, numbers, blood, red, color, gradient,
photorealism, 3d render, fill, color blocks, text, watermark, blur, flat
illustration, clipart
```

Variá: `wheel of moon phases` → `cyclical ring of a seed-to-bloom flower`
→ `concentric phase rings`. Si "rueda de fases" se confunde con SUEÑO,
empujá el motivo flor/semilla cíclica para diferenciarlo.

---

## 3 · Notas para otras herramientas

- **DALL-E 3 / Imagen**: quitar los `--flags` de Midjourney y reescribir el
  negative como frase ("...with absolutely no color, no gradients, no human
  figures, on a plain black background"). Pedir explícitamente
  "transparent or solid black background, single pale-pink line color".
- **Stable Diffusion XL**: usar el bloque principal como positive y el
  bloque `--no` como negative prompt directo. Subir CFG moderado (~7),
  sampler limpio. Un LoRA de "line art" / "constellation" ayuda mucho.

---

## 4 · Post-proceso para vectorizar a SVG recolorable

El arte tiene que terminar como **un SVG de un solo color tintable**. Para
que vectorice limpio:

1. **Aislar a alto contraste**: llevar el PNG a blanco-puro sobre
   negro-puro (curvas/niveles) antes de trazar. Las líneas deben ser nítidas;
   eliminar cualquier halo borroso que el modelo haya metido — el glow lo
   pone la app, no el asset.
2. **Sin gradientes ni semitonos**: si el modelo metió degradado, aplanarlo
   a un solo tono. El SVG final NO debe tener `linearGradient` ni `filter`
   ni `feGaussianBlur` (la app aplica el glow por capas encima).
3. **Trazar**: Illustrator Image Trace ("Black & White Logo", umbral alto) o
   Inkscape Trace Bitmap (single scan, brightness cutoff). Apuntar a líneas
   limpias, no a manchas.
4. **Simplificar nodos**: reducir paths/anclas hasta que respire (los gold
   tienen muchos paths pero cada uno es deliberado; eliminar basura del
   trazado automático). Unificar grosor de línea.
5. **Un solo fill, recolorable**: dejar todos los paths con
   `fill="currentColor"` (o reemplazá `#FFB8B3` por `currentColor` con
   find-and-replace) para que el filtro de dimensión recoloree en runtime.
   Conservar las variaciones de `fill-opacity` — son las que dan la
   profundidad de halo de la serie.
6. **Coherencia de viewBox/tamaño** con los gold-standard (cuadrado, sujeto
   centrado con margen). Sin metadatos sobrantes: nada de `<title>`,
   `<desc>`, ni `clip-path` innecesario.
7. **Prueba de fuego**: poné el SVG nuevo al lado de `mind-vect.svg` y
   `food-vect.svg` recoloreados al mismo tono. Deben leerse como **la misma
   familia**: mismo aro punteado, mismas estrellitas de 4 puntas, misma
   sensación de halo. Si uno se ve más "plano" o más "grueso", no entró.

---

## 5 · Línea roja (manifiesto Stelar)

Aplica a TODOS los glifos, especialmente CUERPO:

- **CUERPO nunca** lleva figura humana, silueta, cuerpo, rostro, manos, ni
  pose de ejercicio. El motivo vive en lo anatómico-abstracto
  (corazón/pulso) o en energía pura, jamás en la figura.
- Sin balanzas, cintas métricas, mancuernas, manzanas-como-dieta, números
  grandes, badges, trofeos, "antes/después".
- CICLO sin lenguaje ni iconografía clínica (sangre, rojo, diagrama médico,
  calendario con números). Es ritmo celeste, no ficha médica.
- Tono general: observatorio íntimo, no gimnasio. Si una variante se ve
  "fitness" o "cute flat illustration", descartala.
