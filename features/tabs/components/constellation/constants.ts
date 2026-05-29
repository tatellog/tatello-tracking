export const W = 290
export const H = 290
// Inner padding around the figure. Lower values let the constellation
// spread closer to the canvas edges so the figure feels less cramped
// against the centre counter. The alpha's diffraction spikes extend
// ~r×7 (≈ 65 px) from its centre, so spikes near a PAD-edge can clip
// slightly — accepted as a "looking out through a porthole" framing
// rather than a layout bug.
export const PAD = 18
export const TARGET_DAYS = 28
// Bumped 22 → 60 for cosmic-depth feel (matches the Genshin-style
// nebula reference where the sky is generously populated, not
// sparse). Five buckets stagger the twinkle so the render cost
// stays one worklet per bucket regardless of star count.
export const AMBIENT_STAR_COUNT = 60
export const AMBIENT_BUCKET_COUNT = 5

// Per-element ignition duration. Stars take longer (flash+settle vs.
// a single stroke trace), and the queue waits this long before
// dequeuing the next element so each ignition gets to breathe.
export const IGNITE_STAR_MS = 720
export const IGNITE_LINE_MS = 520
export const NUMBER_COUNTUP_MS = 800

export const AMBIENT_LAYERS = 12
export const AMBIENT_PER_LAYER_ALPHA = 0.022
export const AMBIENT_RX_MAX = W * 0.6
export const AMBIENT_RX_MIN = W * 0.08
export const AMBIENT_ASPECT = 1.45

// Lowered from 13 → 8 (audit #9). Each nebula patch stacks
// NEBULA_LAYERS ellipses to fake a radial gradient (avoiding the iOS
// alpha-stop bug in <RadialGradient>); 8 keeps the falloff smooth
// enough not to band while cutting paint cost from 4 × 13 = 52 nodes
// to 4 × 8 = 32 nodes per nebula refresh.
export const NEBULA_LAYERS = 8

export const PARTICLE_BASE = 28 // spark count varies ±~20% around this
export const PARTICLE_REACH = 120 // baseline radial reach (px)

// Stars at/below this magnitude are the "hero" of their figure — the
// single brightest star (the anchor, mag 1.5). A figure has exactly
// one. Hero stars get HeroGlow so they read as genuinely *brighter*,
// not just bigger — matching how one star dominates in a real sky.
export const HERO_MAG = 1.7

// Stars at/below this magnitude get the crossed 8-ray "glint" — the
// brighter half of a figure, drawn as a jewel rather than a flat
// asterisk. Fainter stars keep a simple 4-point spark.
export const SPARKLE_MAG = 2.8

export const SPARK_BASE = 2
