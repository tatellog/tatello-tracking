# Emblema Celeste · Prompt de generación de arte

> Spec para generar el arte **ígneo** del Emblema Celeste (el león/criatura
> de brasa que se materializa detrás de la constelación). Reemplaza el
> line-art vectorial plano —que se ve "grabado de moneda"— por arte raster
> con glow horneado. Signo piloto: **Leo**.

---

## 1 · Prompt primario — Midjourney v6

```
Heraldic celestial lion in strict side profile, regal stance, flowing mane,
the entire creature formed from incandescent golden ember and living fire —
its body and mane drawn as flowing lines of molten luminous light and glowing
ash particles, volumetric soft glow, warm bloom, floating sparks and drifting
embers, mystical and alive. Contained within an implied circular boundary,
centered, leaving open negative space in the upper-center where the figure
thins to pure light. Molten gold #D9AE6F core, soft gold #E8B872 mid-light,
pale milk-gold #FFF6E5 brightest highlights, a few deep magenta #E91E63 ember
embers in the darkest recesses. Solid warm near-black #0A0608 void background,
no scene, no ground, no landscape. Ethereal, premium, expensive, cinematic
warm darkness, sacred sigil energy, fine elegant linework softened by glow —
not flat line-art, not engraved coin. Editorial celestial illustration.
--ar 1:1 --style raw --stylize 250 --no text, watermark, signature, human
figure, body, face, hands, photorealistic fur, realistic animal, neon, video
game glow, saturated colors, busy background, scenery, landscape, ground,
border frame, ornate frame, multiple subjects
```

Tuning:

- Demasiado "AI art"/saturado → baja `--stylize` a 100.
- Melena tímida / poco fuego → añade `, dramatic mane of fire, sparks rising` y sube `--stylize` a 400.
- Pide 4 variantes; elige la de melena más viva **con el pecho/centro más vacío** (ahí van las estrellas).
- MJ no da transparencia: genera sobre negro #0A0608 y recorta después (§4).

---

## 2 · Variantes por herramienta

### DALL-E 3

```
A heraldic celestial lion in strict side profile, regal, with a flowing mane,
where the whole creature is made of incandescent golden ember and living fire:
its form rendered as flowing lines of molten luminous light and glowing ash,
with soft volumetric glow, warm bloom, and a few floating sparks and drifting
embers. The lion is centered inside an implied circle, with deliberate open
negative space in the upper-center where the body thins into pure light.
Color palette: molten gold (#D9AE6F), soft gold (#E8B872), pale milk-gold
highlights (#FFF6E5), and a few deep magenta embers (#E91E63) in the darkest
areas only. Solid warm near-black background (#0A0608), absolutely no scene,
no landscape, no ground, no frame. Mood: ethereal, mystical, premium,
cinematic, sacred sigil. This must NOT look like flat line art or an engraved
coin — it should glow and feel alive. Square 1:1 composition. No text, no
human figures, no faces, no hands, no photorealistic fur, no neon.
```

Resolución máx 1024×1024 → upscalear a 2048+ (Topaz Gigapixel / Real-ESRGAN).

### Imagen 3 / Gemini

Positivo:

```
Celestial heraldic lion, side profile, regal, flowing mane, made entirely of
incandescent golden ember and living fire. Body drawn as flowing lines of
molten luminous light and glowing ash particles. Soft volumetric glow, warm
bloom, floating sparks, drifting embers. Centered within an implied circle,
open negative space in the upper-center, the figure thinning to pure light.
Molten gold and pale milk-gold highlights, a few deep magenta embers in the
shadows. Solid warm near-black background (#0A0608), no scene, no landscape,
no frame. Ethereal, mystical, premium, cinematic, sacred. Not flat line art,
not an engraved coin — glowing and alive. Aspect ratio 1:1.
```

Negative prompt (campo aparte): `text, watermark, human figure, body, face, hands, photorealistic fur, neon, saturated colors, busy background, landscape, ground, frame, multiple animals`

---

## 3 · Reveal por etapas → **un master + máscaras de Skia**

Genera **UN master a 100%** (león completo en glow, transparente) y deriva las
etapas en runtime. Coherencia perfecta (no re-rollear seeds) y barato en RN:

- **tenue** → `opacity 0.12`, sin glow
- **forma** → `opacity 0.4` + blur sutil (brasa apagada)
- **completo** → `opacity 0.85`
- **glow** → `opacity 1` + capa de bloom (Skia `BlurMask`/`ColorMatrix`)
- **cósmico** → cross-fade a un segundo master magenta/violeta sobre nebulosa

Materialización "por partes": exportar el master con máscara de gradiente, o
pintar una máscara radial en Skia que crece. No hace falta arte extra.

**Entregar 2 masters por signo, no 5:**

1. `emblem-leo-gold.png` — estado dorado/brasa (principal)
2. `emblem-leo-cosmic.png` — misma pose, melena de constelación magenta/violeta

Cósmico = mismo prompt, cambiando la paleta a:

```
...formed from a constellation of magenta and violet starlight, fine luminous
lines connecting bright nodes like a star map, over faint deep-violet nebula
dust. Magenta #E91E63 / hot magenta #FF4886 / soft violet, with cream-white
star nodes #F4ECDE...
```

Misma pose: usar el dorado como `--cref`/image prompt (MJ) o "exact same pose
as the reference" (DALL-E/Imagen).

No usar el approach linework/glow separado: el glow debe venir horneado en el
raster, no reconstruido con strokes SVG (ese es justo el problema actual).

---

## 4 · Formato / output

| Campo       | Valor                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formato     | PNG-24 con alpha (transparente)                                                                                                                                           |
| Resolución  | ≥ 2048×2048 (generar a 2048, no downscalear)                                                                                                                              |
| Aspect      | 1:1 exacto                                                                                                                                                                |
| Fondo       | Transparente. Si la tool da negro: `magick in.png -fuzz 8% -transparent "#0A0608" out.png` (recorte suave, conservar el bloom de bordes)                                  |
| Composición | León centrado, base ~75% del alto, melena hacia arriba sin tocar borde. ~10% margen. **Zona muerta superior-central** (~40%×35%) de baja densidad → ahí van las estrellas |
| Color       | sRGB. Oros #D9AE6F→#FFF6E5, embers magenta #E91E63 (no naranja-rojo ni amarillo)                                                                                          |
| Peso        | `pngquant`/`oxipng`, <800 KB por master                                                                                                                                   |

Naming: `assets/emblems/emblem-{sign}-{gold|cosmic}.png`
`{sign}` = slug inglés (`aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces`).

---

## 5 · Extender a los 11 signos

**Idéntico** (lo que hace que los 12 sean una colección): la frase de material
(`incandescent golden ember... flowing lines of molten luminous light...`), la
paleta, la composición (centrado, círculo implícito, zona muerta, transparente,
sin frame), los params y el negative prompt, y el doble master gold+cosmic.

**Solo cambia el sujeto** (primera cláusula):

| Signo       | Sujeto                                                                      |
| ----------- | --------------------------------------------------------------------------- |
| Aries       | heraldic ram with bold curved horns, side profile                           |
| Tauro       | heraldic bull, powerful, side profile                                       |
| Géminis     | two mirrored twin flames / pillars of ember rising (sin cuerpos)            |
| Cáncer      | heraldic crab / celestial shell, symmetrical                                |
| Leo         | heraldic lion, side profile _(piloto)_                                      |
| Virgo       | luminous wheat sheaf / ear of grain sigil (la espiga, no la doncella)       |
| Libra       | celestial balance scale of light, symmetrical                               |
| Escorpio    | heraldic scorpion, tail raised, side profile                                |
| Sagitario   | celestial drawn bow and arrow of fire (el arco, no el centauro)             |
| Capricornio | heraldic sea-goat, side profile                                             |
| Acuario     | celestial vessel pouring a stream of water-light (la vasija, no el aguador) |
| Piscis      | two mirrored celestial fish circling, symmetrical                           |

> **Línea roja Stelar:** Virgo, Acuario, Géminis y Sagitario usan el
> símbolo/objeto, NUNCA la figura humana (ni femenina). Sigilario de luz, no de
> personas.

**Workflow del set:** validar Leo (gold + cosmic) primero. Luego usar
`emblem-leo-gold.png` como referencia de estilo (`--sref` en MJ, o "match the
lighting/glow/rendering of this reference" en DALL-E/Imagen) para los otros 11
→ fuerza que el material/glow case en los 12.

---

## Nota de capas (no chocan)

El **oro vivo** es del Emblema (la criatura, atrás). El **magenta** es de la
constelación natal (estrellas + líneas que la app dibuja encima). Dos capas
distintas: dorado detrás, estrellas magenta delante. El art-brief que prohíbe
oro en la constelación sigue vigente — aplica a la capa de estrellas, no al
emblema.
