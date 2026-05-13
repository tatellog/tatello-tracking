# Handoff · Norte Onboarding (5 screens)

## Overview

This is the onboarding flow for **Norte** — a body-recomposition tracking app for adult Latin women (target: Mexican/Latin women, 28–42, professional, training 3–5×/week). The product philosophy is anti-fitness-bro, anti-gamification, anti-aspirational. The voice is adult, patient, honest: _"the perfection isn't necessary, the direction is."_

The onboarding takes a user from launch to their first session in **5 screens** (down from 8 in the original design):

1. **Manifiesto** — single-philosophy welcome screen, no signup gate
2. **Lo que te ha costado** — what's blocked her in other apps (this trains the in-app coach)
3. **Cuéntame de ti** — name + age + height + biological sex, combined into one view
4. **Hoy pesas** — initial weight, framed as a starting point with explicit caveat
5. **Tu cita en 28 días** — concrete 28-day appointment, the product's "north star metric"

## About the Design Files

The files in this bundle are **design references created in HTML** — interactive prototypes showing the intended look, behavior, and animation timing. They are **not production code to copy directly**.

**Your task: recreate these HTML designs in the target codebase's existing environment** (React Native, SwiftUI, Flutter, Kotlin, etc.) using its established patterns, component library, and design tokens. If no environment exists yet, choose the most appropriate framework for the project (likely React Native or SwiftUI since this is a mobile app) and implement them there.

The HTML uses React + Babel inline for prototyping speed. In production you should:

- Replace React/Babel inline with proper build tooling for your platform
- Replace the iOS frame chrome (`ios-frame.jsx`) and design canvas (`design-canvas.jsx`) — those are just for the prototype canvas presentation, not part of the app
- Use the platform's native animation primitives (Reanimated, SwiftUI animations, etc.) rather than CSS keyframes

## Fidelity

**High-fidelity.** The mocks are pixel-precise with final colors, typography, spacing, animations, and interaction states. Recreate the UI pixel-perfectly. Every hex value, font weight, and animation duration in this README has been chosen and tested.

## Design Tokens

### Colors

```
/* Surfaces — warm dark "sweat" */
--bg              #0A0608    Base background (warm near-black, never pure black)
--bg-card         #14080B    Card surface (one shade up)
--bg-card-2       #1F0E13    Deeper card surface

/* Foreground (cream tones on dark) */
--leche           #F4ECDE    Primary text (warm cream, never pure white)
--bone            #C9B8A5    Secondary text, body, lede
--niebla          #8A7570    Muted, labels, metadata
--bruma           #4F3A3D    Hairlines, borders, placeholders

/* Accent — magenta (used SPARINGLY) */
--magenta         #E91E63    SOUL accent — CTA, emphasized italic word, lit dot
--magenta-hot     #FF4886    Hover/focus state
--magenta-deep    #A6164A    Pressed state
--magenta-glow    rgba(233, 30, 99, 0.45)    Shadow color for primary CTA
--magenta-tint    rgba(233, 30, 99, 0.10)    Background tint for selected option
--magenta-tint-2  rgba(233, 30, 99, 0.18)    Background tint for active segmented toggle

/* Hairlines */
--hairline        rgba(244, 236, 222, 0.10)
--hairline-strong rgba(244, 236, 222, 0.22)
```

**Discipline rule:** magenta appears at most twice per screen (the emphasized italic word + one CTA). If it spreads, it loses voice. This is non-negotiable.

### Typography

```
--display    'Hanken Grotesk'        (Google Fonts — weights 400/500/600/700/800/900)
--serif      'Cormorant Garamond'    (Google Fonts — weights 500/600 in italic)
--sans       'Hanken Grotesk'        (UI text, all weights)
```

Use Hanken Grotesk for all sans-serif (display + UI). Cormorant Garamond appears **only in italic** for emphasized words and short poetic phrases.

| Role                      | Family                   | Size    | Weight     | Line-height | Letter-spacing | Transform |
| ------------------------- | ------------------------ | ------- | ---------- | ----------- | -------------- | --------- |
| Mega number ("28")        | Hanken Grotesk           | 80px    | 900        | 0.82        | -5.5%          | —         |
| Big number ("75")         | Hanken Grotesk           | 120px   | 900        | 0.9         | -5%            | —         |
| Manifiesto quote          | Hanken Grotesk           | 44px    | 900        | 1.0         | -4.5%          | —         |
| Screen title (.scr-title) | Hanken Grotesk           | 36px    | 900        | 1.0         | -4%            | —         |
| Italic emphasis           | Cormorant Garamond       | 0.92em  | 600 italic | 1.0         | -1%            | —         |
| Italic lede / caveat      | Cormorant Garamond       | 15px    | 500 italic | 1.45        | 0              | —         |
| Body (.scr-sub)           | Hanken Grotesk           | 13px    | 500        | 1.5         | 0              | —         |
| Body meta (manif-meta)    | Hanken Grotesk           | 12.5px  | 500        | 1.55        | 0              | —         |
| Eyebrow / section label   | Hanken Grotesk           | 10–11px | 700        | 1.0         | 22–24%         | UPPERCASE |
| CTA button                | Hanken Grotesk           | 12px    | 700        | 1.0         | 18%            | UPPERCASE |
| Input value               | Hanken Grotesk           | 24px    | 700        | 1.0         | -2%            | —         |
| Input label               | Hanken Grotesk           | 10px    | 700        | 1.0         | 22%            | UPPERCASE |
| Mono caption (img slot)   | SF Mono / JetBrains Mono | 8–9px   | 500        | 1.4         | 18–22%         | UPPERCASE |

### Spacing scale

```
--s-1  4px
--s-2  8px
--s-3  12px
--s-4  16px
--s-5  24px
--s-6  32px
--s-7  48px
--s-8  64px
--s-9  96px
```

### Radius

```
4px    Buttons, cards, option rows, badges, segmented toggle
2px    Pills, ticks, input internal segments, badges
50%    Manifiesto orb, day-1 dot, decorative circles
```

### Shadow / glow

```
Primary CTA:    0 6px 24px -8px var(--magenta-glow), inset 0 1px 0 rgba(255,255,255,0.12)
CTA hover:      0 10px 28px -8px var(--magenta-glow), inset 0 1px 0 rgba(255,255,255,0.12)
Active option:  0 0 0 1px var(--magenta), 0 4px 16px -8px var(--magenta-glow)
Day-1 dot:      0 0 14px var(--magenta-glow)
Magenta pulse (keyframe): box-shadow 0 0 0 0 → 0 0 0 14px transparent
```

(Continued in following sections — Screens, Animations, State, Components, Assets.)

## Screens (detailed)

Each screen is a vertical-flex layout rendered at iPhone proportions (340×720 in the prototype). All screens follow the same scaffold:

```
[Progress bar — 5 segments, 3px tall, gap 4px]
[Back link (uppercase, 10px, niebla) — except screen 1]
[Eyebrow (uppercase, 10.5px, magenta)]
[Title (Hanken Black 36px) — italic accent word in Cormorant magenta]
[Subtitle (Hanken 13px, bone)]
[Body — flex: 1, scrollable if needed]
[Primary CTA — full width, 54px tall, magenta]
```

Screen padding: `60px 24px 32px`.
Progress dots: `active` = magenta with glow; `done` = solid cream (`--leche`); pending = `--bruma`.

### Screen 1 · Manifiesto

**Purpose:** Welcome screen. Communicates the product's philosophy before asking for anything.

**Layout:**

- Eyebrow: `NORTE · EL MANIFIESTO`
- Quote (Hanken 44px, weight 900, line-height 1.0, letter-spacing -4.5%):
  - "La perfección" / "no es necesaria." (cream)
  - "La dirección sí." (italic Cormorant 600, magenta, 0.92em, displayed as block, margin-top 8px)
- Magenta hairline rule (1px tall, 36px wide), 22px below the quote
- Meta paragraph (Hanken 12.5px, weight 500, bone, max-width 240px, line-height 1.55):
  - "Esta app te lee patrones, no perfección."
  - "**En 28 días** verás tu primera comparativa." (the "En 28 días" is Cormorant italic 600 magenta, font-size 14px)
- CTA: "Empezar →"

**Decoration:** `ManifOrb` component anchored bottom-right of the screen (right: -40px, bottom: 60px, 180×180px), absolutely positioned at z-index 0. Three layers:

1. `.core` — radial gradient (rgba(255,72,134,0.45) center → rgba(233,30,99,0) edge), animated with the `breathe` keyframe (5.5s ease-in-out infinite, scale 1 ↔ 1.06, opacity 0.55 ↔ 0.95).
2. `.ring` — 140×140px circle, 1px border at rgba(233,30,99,0.18), centered, animated with `breathe 5.5s ease-in-out infinite reverse` so it contra-pulses.
3. `.satellite` — 6×6px solid magenta dot with magenta box-shadow glow, animated with `orbitalDrift 14s linear infinite` (rotates around center at translateX(28px) radius).

The content layer (`.manif-stage`) sits at z-index 1 above the orb.

### Screen 2 · Lo que te ha costado (Frictions)

**Purpose:** Train the in-app coach by capturing the user's prior failure modes. Critical move: this screen is at **step 2**, before any demographic data — the coach asks before the form.

**Layout:**

- Back link: "‹ Atrás"
- Eyebrow: "Antes de pedirte datos"
- Title: "¿Qué se te _ha atravesado_ antes?" — "ha atravesado" is the italic Cormorant magenta accent
- Subtitle: "Esto entrena a tu coach. Mientras más honesta, mejor te lee."
- Option list (scrollable, `overflow-y: auto`):
  - "No me dan ganas de loguear"
  - "Me obsesiono con números"
  - "Me siento juzgada"
  - "Pereza preparar comida"
  - "No veo cambios, me frustro"
  - "Recaigo en atracones"
  - "Prefiero no decir" (neutral variant, uppercase niebla label, mutually exclusive — selecting it clears all other selections)
- CTA: "Continuar →" (disabled until at least one option OR "Prefiero no decir" is selected)

**Option row spec (`.opt`):**

- Padding: 13px 14px
- Border: 1.5px solid `--bruma`, radius 4px, background `--bg-card`
- Hover: border-color → `--niebla`, transform translateX(3px)
- Selected (`.opt.on`): border + bg → magenta tint, label color → `--leche`, box-shadow described above
- Mark: 18×18px box at left, radius 2px, fills with magenta + ✓ when selected

**Neutral variant (`.opt.neutral`):** label is uppercase 12px niebla (instead of italic 13.5px bone) — visually distinct so it reads as "opt out", not "another option".

### Screen 3 · Cuéntame de ti

**Purpose:** Collect name, age, height, biological sex — combined into one view to avoid the 3-pantalla form fatigue of the original design.

**Layout:**

- Back link, eyebrow ("Para conocerte"), title ("_Cuéntame_ de ti."), subtitle ("Vive en tu teléfono. Nada se comparte.")
- Field: Tu nombre — text input
- Field row (2-col grid, gap 14px): Edad (1–3 digits, numeric) + Altura · cm (1–3 digits, numeric)
- Field: "Para calcular metabolismo" — segmented toggle "Femenino / Masculino", with subtitle below in italic Cormorant niebla: "metabolismo, no identidad" (this softens the binary)
- CTA: "Continuar →" (disabled until all 4 fields filled)

**Input spec (`.fld`):**

- Label: uppercase 10px 700 niebla, 22% tracking
- Input: transparent bg, no border except 2px bottom border in `--bruma`, padding 10px 0, value text is Hanken 24px 700 cream (-2% tracking)
- Focus: bottom border → magenta, caret-color → magenta
- Placeholder: same Hanken display style, color `--bruma`

**Segmented toggle (`.seg`):**

- Container: 1.5px border in `--bruma`, radius 4px, padding 3px, gap 3px, bg `--bg-card`
- Buttons: equal flex, height 40px, transparent until selected
- Selected: bg → `--magenta-tint-2`, color → `--leche`, inset 0 0 0 1px `--magenta`

### Screen 4 · Hoy pesas

**Purpose:** Capture starting weight. Critical move: the number is framed as **a starting point, not a verdict**.

**Layout:**

- Back, eyebrow ("El punto de partida"), title ("Hoy _pesas_…"), subtitle ("No es un veredicto. Es solo de dónde empezamos.")
- Weight input block (`.wt`): centered, baseline-aligned
  - Input (`.wt-num`): Hanken 120px 900 cream, right-aligned 180px wide, tabular numerals, letter-spacing -5%
  - Unit: "kg" in italic Cormorant 600 magenta, 26px
- Ruler (`.wt-ruler`): decorative horizontal row of 21 vertical ticks, opacity 0.35, positioned absolutely (left: 20px, right: 20px, bottom: 130px). Every 5th tick is taller (14px) and magenta colored; others are 6px tall and bone.
- Caveat (italic Cormorant 15px bone, centered, max-width 240px): "Es solo el punto de partida. / No es tu valor."
- Skip link (uppercase 11px 700 magenta): "No tengo báscula · registrar después" — toggles to "Sí tengo báscula · anotar peso" when active, and disables/clears the number input
- CTA: "Continuar →" (enabled if weight > 0 OR skipWeight is true)

**Number animation:** On mount, the input value counts from 0 to the target value (e.g., 75) over 1.4s with ease-out cubic, starting 350ms after mount. Once the user starts typing, the animation is cancelled and the typed value is shown.

### Screen 5 · Tu cita en 28 días

**Purpose:** Replace the original "Listo ✓" success screen with a concrete appointment. The product's "north star metric" is _don't abandon_ — so the final move is to plant a calendar date 28 days out, with a real weekday/day/month visible.

**Layout:**

- Back, eyebrow ("Tu cita")
- Number block:
  - "28" (Hanken 80px 900 magenta, tabular numerals, line-height 0.82) — animated counter
  - Caption: "días para tu primera comparativa." (italic Cormorant 16px bone)
- Timeline28 component (full width, 48px tall) — see Animations section below
- Date block (`.const-date-block`): top + bottom hairline borders, padding 8px 0
  - Label: "NOS VEMOS" (uppercase 10px 700 niebla)
  - Value: "[WEEKDAY-3-LETTER] [day, italic Cormorant magenta 26px] [MONTH-3-LETTER]" (Hanken 22px 900 cream surrounding the italic day). E.g., "SÁB _10_ JUN".
  - Use the user's locale; for Spanish abbreviated: DOM/LUN/MAR/MIÉ/JUE/VIE/SÁB and ENE/FEB/MAR/ABR/MAY/JUN/JUL/AGO/SEP/OCT/NOV/DIC.
- Preview row (`.preview-row`, 2-col grid, gap 8px):
  - `<ImgSlot>` placeholder #1: caption "**DÍA 1** tu foto de hoy" (the "DÍA 1" is uppercase 8.5px 700 magenta on its own line, the rest is mono niebla)
  - `<ImgSlot>` placeholder #2: caption "**DÍA 28** tu foto en 4 semanas"
  - Each slot is 72px tall, dashed border `--bruma` 1px, radius 4px, diagonal hatching background (see ImgSlot component below). They are placeholders for **real photographic content the app should support uploading** later — at the end of day 1 the user takes a "before" photo into slot #1; at day 28 the app prompts for slot #2 and reveals a comparison view.
- Poetic line (italic Cormorant 13.5px bone, line-height 1.45): "{name}, vuelves a esta pantalla. / Verás _lo que cambió_." (with name from state, and "lo que cambió" in italic Cormorant magenta).
- CTA: "Empezar mi día 1 →"

## Components

### Primary CTA (`.scr-cta`)

- Height 54px, radius 4px, background `--magenta`, color #fff
- Hanken Grotesk 700, 12px, letter-spacing 18%, UPPERCASE
- Shadow: `0 6px 24px -8px var(--magenta-glow), inset 0 1px 0 rgba(255,255,255,0.12)`
- Hover: background → `--magenta-hot`, transform translateY(-1px), shadow stronger
- Active (pressed): transform back to 0, background → `--magenta-deep`
- Disabled: background → `--bg-card-2`, color → `--niebla`, no shadow

### Ghost button (`.scr-cta.ghost`)

- Same dimensions but transparent background, 1.5px border in `--bruma`, color `--leche`, no uppercase, no letter-spacing, font weight 500

### Image placeholder (`<ImgSlot>`)

- Striped diagonal hatching background (45° lines, 6px stripe rgba(244,236,222,0.025) / 6px gap)
- 1px dashed border in `--bruma`, radius 4px
- Padding 4–8px, centered content
- Top-left corner has a 4×4px magenta dot at opacity 0.6 (registration mark)
- Caption is mono uppercase 8–9px, 18–22% tracking, niebla color
- The "**DÍA 1**"-style prefix is rendered as a separate `<strong>` in magenta uppercase, font weight 700

These are **placeholders for real user-uploaded photos in production**. In code, they should be replaced with: an empty state CTA ("Toma tu foto del día 1") that opens the camera, then the captured image, then a comparison-view trigger.

## Animations

| Name           | Used by                          | Duration | Easing                         | Notes                                                                                                                                                                              |
| -------------- | -------------------------------- | -------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fadeUp`       | All `[data-anim]` elements       | 0.7s     | cubic-bezier(0.2, 0.7, 0.2, 1) | opacity 0→1 + translateY 8px→0. `animation-fill-mode: forwards`. Stagger delays: 0.05s / 0.20s / 0.35s / 0.50s / 0.65s / 0.80s / 0.95s / 1.10s (use `data-anim="0"` through `"7"`) |
| `breathe`      | Manifiesto orb core + ring       | 5.5s     | ease-in-out infinite           | scale 1↔1.06, opacity 0.55↔0.95. The ring runs `reverse` so it contra-breathes.                                                                                                    |
| `orbitalDrift` | Manifiesto orb satellite         | 14s      | linear infinite                | rotate(0→360) translateX(28px) rotate(0→-360) — the dot orbits the center at 28px radius while keeping its own rotation neutral                                                    |
| `pulseGlow`    | Day-1 dot in Timeline28          | 2.6s     | ease-out infinite, delay 1.2s  | box-shadow 0 0 0 0 → 0 0 0 14px transparent (single-direction pulse)                                                                                                               |
| `ringSpin`     | Day-28 dashed ring in Timeline28 | 18s      | linear infinite                | rotate 0→360                                                                                                                                                                       |
| `scanline`     | Timeline28 scan light            | 6s       | ease-in-out infinite, delay 2s | translateX -10%→110%, opacity 0→1 (at 10–90%)→0                                                                                                                                    |
| `dotPop`       | Each Timeline28 dot              | 0.4s     | ease-out backwards             | scale 0→1, opacity 0→1. Stagger via inline `animation-delay: 0.4 + i * 0.04s` so dots illuminate sequentially                                                                      |
| Counter (JS)   | Weight number, "28" number       | 1.4s     | cubic ease-out (1 - (1-p)^3)   | requestAnimationFrame-based, see `useCounter` hook in screens-final.jsx. Cancels and shows real value the moment the user starts typing                                            |

**Reduced-motion:** wrap all animations in `@media (prefers-reduced-motion: no-preference)` in production. The prototype doesn't do this.

## State management

A single `state` object lives at the App level; each screen receives `state` and `set` (a patch-merge setter):

```js
const initialState = {
  name: '',
  age: '', // string, 1–3 digits, numeric
  height: '', // string, 1–3 digits, cm
  sex: '', // 'F' | 'M' | ''
  frictions: [], // array of selected friction strings
  skipFrictions: false, // true if "Prefiero no decir" selected
  weight: '', // string, decimal allowed (e.g. "75.0")
  skipWeight: false, // true if "No tengo báscula" toggled on
}

const set = (patch) => setState((s) => ({ ...s, ...patch }))
```

The prototype pre-fills realistic values (`name: 'Anahí'`, `age: '36'`, etc.) so the canvas looks live; in production, the initial state should be all empty.

**Validation rules per screen:**

- Screen 1 (Manifiesto): no validation, CTA always enabled
- Screen 2 (Frictions): CTA enabled if `frictions.length > 0 || skipFrictions === true`. Selecting "Prefiero no decir" clears `frictions` and sets `skipFrictions: true`; selecting any other option clears `skipFrictions` and toggles inclusion in `frictions`.
- Screen 3 (Cuéntame): CTA enabled if `name.trim().length > 0 && age && height && sex`
- Screen 4 (Hoy pesas): CTA enabled if `skipWeight || parseFloat(weight) > 0`
- Screen 5 (Día 28): CTA always enabled

**Date calculation (screen 5):** use the user's local date and add 28 days. Format weekday/month in the user's locale (Spanish abbreviations in the prototype). The date string updates if the user opens the screen on different days — it's always "today + 28."

## Assets

The prototype contains **no proprietary imagery**. All visual elements are CSS/SVG-generated:

- The manifiesto orb is pure CSS gradients + box-shadows
- The Timeline28 is pure CSS dots + keyframes
- Image placeholders are diagonal-hatching backgrounds (CSS) + mono captions

**In production you will need:**

1. Real photographic UI for the Día 1 / Día 28 photo slots (camera capture flow + photo storage + later comparison-view)
2. A real font loader for Hanken Grotesk + Cormorant Garamond (Google Fonts or self-hosted) — both are open-source/free
3. Empty/error states for the form fields (the prototype has none — focus is on happy path)

## Files in this bundle

| File                       | Purpose                                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Norte Onboarding v3.html` | Entry point. Open this in a browser to interact with the prototype.                                                                                                           |
| `norte-final.css`          | All design tokens (CSS custom properties), component styles, and animation keyframes. Read this first — it's the source of truth for colors, type, and spacing.               |
| `screens-final.jsx`        | The 5 screen components (ScreenManifiesto, ScreenFrictions, ScreenAboutYou, ScreenWeight, ScreenAppointment) + helpers (Progress, ManifOrb, Timeline28, ImgSlot, useCounter). |
| `app-final.jsx`            | Composition: shared state, design-canvas wrapper, iOS frame wrapper, hero header. The hero and canvas/frame chrome are presentation-only — strip them in production.          |
| `ios-frame.jsx`            | Decorative iPhone frame for the prototype. **Do not port** — your platform has its own status bar / home indicator.                                                           |
| `design-canvas.jsx`        | Pan/zoom canvas for presenting the 5 screens side-by-side. **Do not port** — strip.                                                                                           |

## Implementation checklist for the developer

1. Load Hanken Grotesk + Cormorant Garamond fonts in your platform
2. Define the design tokens (colors, type, spacing, radius, shadows) as platform-native constants
3. Build the screen scaffold (progress bar + back + eyebrow + title + body + CTA)
4. Build the reusable components: Primary CTA, Ghost button, Underlined input, Segmented toggle, Option row, ImgSlot
5. Implement each screen 1–5 with the documented copy + validation
6. Add the animations using your platform's animation library (Reanimated, SwiftUI, etc.) — don't try to port CSS keyframes directly
7. Wire up the shared state and the screen-to-screen navigation
8. Add reduced-motion handling
9. Replace ImgSlot placeholders with real camera capture flow + photo storage
10. Add empty/error states for the form fields

Questions? The HTML files are the source of truth — if anything in this README is ambiguous, the prototype's rendered output is what to match.
