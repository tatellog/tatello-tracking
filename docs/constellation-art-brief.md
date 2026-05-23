# Brief — Día constellation art

The Órbita tab's Día segment hero. One piece of ornamental constellation
art that represents the user's six-dimension "system" (Cuerpo, Mente,
Energía, Alimento, Sueño, Ciclo). Same piece for every user, every day —
the engine animates the brightness of each star but the art itself is
static and shared.

Visual reference: Genshin Impact's character Constellation page. The
ornamental scrollwork weaving between the stars; smooth curves instead
of straight lines; a faint circular frame containing the whole figure;
each star a luminous node within the drawing. Search "Genshin Impact
constellation Xiangling / Keqing / Sucrose / Chiori" for the style.

---

## Specs

| Field          | Value                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------- |
| **Format**     | SVG (vector)                                                                                  |
| **viewBox**    | `0 0 372 382` (matches the canvas the app already renders into)                               |
| **Background** | None (transparent — the app renders the deep field + nebula behind it)                        |
| **Strokes**    | All paths stroke-based, `fill="none"`, stroke width ~1.5–2.5 units                            |
| **Color**      | `currentColor` so the app can tint at runtime, or `#E91E63` (STELAR magenta) as default       |
| **Effects**    | NO `filter`, NO `feGaussianBlur`, NO embedded gradients — the app applies layered glow on top |
| **Nodes**      | Max ~150 anchor points total (simplify after vectorizing)                                     |
| **Layers**     | One `<g>` per logical part (frame, scrollwork, connecting curves) for easy tweaking           |

## Star anchor positions

The six dimension stars sit at fixed coordinates. The ornament must
respect them — the lines/curves between them, and the scrollwork should
flow _around_ these points (the app renders luminous stars on top at
exactly these spots).

| Dimension | x   | y   |
| --------- | --- | --- |
| CUERPO    | 45  | 130 |
| MENTE     | 194 | 26  |
| ENERGÍA   | 79  | 284 |
| ALIMENTO  | 293 | 284 |
| SUEÑO     | 325 | 130 |
| CICLO     | 185 | 325 |

(Coordinates are in the SVG's user space. The viewBox is 372×382.)

## Composition rules

1. **Smooth curves, not straight lines.** Bézier curves connecting the
   six stars in a graph that feels like a mandala / sigil rather than
   a polygon.
2. **Ornamental flourishes around each star** — curls, spirals, small
   geometric details. Each star reads as "engaged" with the ornament,
   not pasted onto a separate drawing.
3. **A circular containing frame** — a thin ornamented ring around the
   whole figure, with at least one decorative break so it doesn't read
   as a flat circle.
4. **Asymmetric but balanced** — the figure should not be radially
   symmetric (avoid the "snowflake" feel); each section can differ in
   its scrollwork as long as the whole composition feels balanced.
5. **Negative space matters.** Empty parts of the canvas are part of
   the design — they let the starfield breathe through.
6. **Visual density**: more ornament near the centre, sparser toward
   the frame. Mid-density overall — readable, not busy.

## Palette (STELAR Norte)

If using colour inline (vs `currentColor`):

| Use                   | Hex                    |
| --------------------- | ---------------------- |
| Primary line          | `#E91E63` magenta      |
| Bright highlight      | `#FF4886` magenta hot  |
| Deep accent           | `#A6164A` magenta deep |
| Cream                 | `#F4ECDE` leche        |
| Pale pink (very soft) | `#FBD7E3`              |

The piece should read as **magenta over a dark warm background, with
cream accents and a subtle pink in the brightest sections**. No blues,
no clinical reds, no gold/yellow.

## Deliverables

1. `dia-constellation.svg` — single file, ready to drop into
   `assets/constellations/`.
2. `dia-constellation.png` — a 1024×1024 PNG preview for the readme.
3. (Optional) The Figma/Illustrator source.

---

## If sourcing via AI (Midjourney / DALL-E)

Generate at high resolution (2048×2048 transparent PNG), then vectorize
with Illustrator's Image Trace or Inkscape's Trace Bitmap. Clean up the
paths (simplify, unify stroke widths) before exporting SVG.

### Prompt — start here

```
Ornamental constellation diagram in the style of Genshin Impact's
character constellation page. Six glowing magenta stars connected by
smooth flowing Bezier curves, with intricate art-nouveau scrollwork
and decorative flourishes weaving between them. A thin ornamental
circular frame contains the whole figure with one decorative break.
Drawn in a single luminous magenta line on a transparent background.
No fills, only line art. Cosmic, celestial, ornate but not busy,
graceful and balanced asymmetric composition. Glowing magenta and
soft pink on transparent.

--ar 1:1 --no background, fill, color blocks, photorealism, characters,
text, watermark, blurry
```

### Iterate by varying

- `art-nouveau` → `mandala` → `sacred geometry` → `astrological sigil`
- `magenta` → `rose gold` → `cream and magenta`
- `intricate` → `minimalist` → `dense filigree`
- `Genshin Impact constellation` → `Honkai Star Rail constellation` →
  `tarot card line art`

### Reject prompts where

- The result is filled-in (we need line art).
- Stars are drawn explicitly (the app draws those).
- There are characters or recognisable figures.
- The figure is radially symmetric (looks like a snowflake).
- The line weights vary wildly (we want consistent stroke).
