import { Image } from 'react-native'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import { type ZodiacSign } from '@/features/tabs/zodiac'
import { type ZodiacAsset } from '@/features/tabs/components/ZodiacEngraving'
import { ART_BY_SIGN } from './data/sign-maps'

/*
 * ZodiacArt — the sign's pictorial art floating FREE (no card / no ring)
 * over a diffuse golden halo. This is the Día 1 echo of the reveal's
 * RESTING state: arte + aura, sin contenedor. It deliberately does NOT
 * mount the live progress constellation (that lives in the Hoy tab); a
 * second framed-card constellation here read as redundant.
 *
 * Everything is STATIC — no Reanimated, no coin-spin, no opacity ramp,
 * no stars. Just the painted creature and a soft gold glow behind it.
 *
 * The art assets are now RASTERISED PNGs (the .svg originals were ~500 KB of
 * paths — see sign-maps.ts), so `ART_BY_SIGN[sign]` is a bitmap source (a
 * `require()` number), not an SVG component. We render it with a plain RN
 * `<Image>` (this art floats OUTSIDE any <Svg>, so SvgImage can't be used
 * here). The `typeof === 'function'` branch stays for the legacy SVG-component
 * contract, but in practice the bitmap branch is what runs.
 */

// Canonical reveal gold stops, inline (NOT a theme token — these are the
// reveal's aura hexes, kept verbatim so Día 1 reads as the same oro).
const HALO_STOPS = [
  { offset: '0%', color: '#FFF6E5', opacity: 0.18 },
  { offset: '40%', color: '#E8B872', opacity: 0.16 },
  { offset: '72%', color: '#D9AE6F', opacity: 0.1 },
  { offset: '100%', color: '#D9AE6F', opacity: 0 },
] as const

/* Halo SUAVE — caída monótona de 2 stops, SIN núcleo plano: el default
 * mantiene un brillo casi constante hasta el 40 % y luego cae, lo que sobre
 * un fondo oscuro lee como un "domo" con borde. El soft difumina parejo de
 * adentro hacia afuera (ideal para las share cards, donde el borde del domo
 * se notaba). */
const SOFT_HALO_STOPS = [
  { offset: '0%', color: '#E8B872', opacity: 0.12 },
  { offset: '100%', color: '#D9AE6F', opacity: 0 },
] as const

export type ZodiacArtHalo = 'default' | 'soft' | 'none'

function renderArt(asset: ZodiacAsset, size: number) {
  if (typeof asset === 'function') {
    const Component = asset
    return <Component width={size} height={size} />
  }
  // Bitmap (PNG) — the rasterised art. Plain RN <Image>; this art is not
  // nested in an <Svg>, so SvgImage isn't available.
  return <Image source={asset} style={{ width: size, height: size }} resizeMode="contain" />
}

export function ZodiacArt({
  sign,
  size,
  halo = 'default',
}: {
  sign: ZodiacSign
  size: number
  /** 'default' aura de Día 1 · 'soft' difuso parejo (share cards) · 'none'. */
  halo?: ZodiacArtHalo
}) {
  // The halo overflows the art box so the glow can bleed past the edges
  // without ever closing into a ring/diana. Optical centre sits slightly
  // high (cy ≈ 46 %) to break perfect-circle symmetry — same anti-symmetry
  // trick as the reveal's aura. El soft se esparce más (×1.55) para una
  // caída más gradual.
  const soft = halo === 'soft'
  const haloSize = Math.round(size * (soft ? 1.55 : 1.28))
  const haloOffset = (haloSize - size) / 2
  const haloRadius = `${Math.round((size / haloSize) * (soft ? 72 : 62))}%`
  const stops = soft ? SOFT_HALO_STOPS : HALO_STOPS
  // id por variante: si default y soft coexisten, no colisionan.
  const gradId = `zodiac-art-halo-${halo}`

  return (
    <>
      {halo !== 'none' ? (
        <Svg
          width={haloSize}
          height={haloSize}
          viewBox={`0 0 ${haloSize} ${haloSize}`}
          style={{ position: 'absolute', left: -haloOffset, top: -haloOffset }}
          pointerEvents="none"
        >
          <Defs>
            <RadialGradient id={gradId} cx="50%" cy="46%" r={haloRadius}>
              {stops.map((s) => (
                <Stop
                  key={s.offset}
                  offset={s.offset}
                  stopColor={s.color}
                  stopOpacity={s.opacity}
                />
              ))}
            </RadialGradient>
          </Defs>
          <Circle
            cx={haloSize / 2}
            cy={haloSize * 0.46}
            r={haloSize / 2}
            fill={`url(#${gradId})`}
          />
        </Svg>
      ) : null}
      {renderArt(ART_BY_SIGN[sign], size)}
    </>
  )
}
