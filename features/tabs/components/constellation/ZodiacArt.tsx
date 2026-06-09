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

function renderArt(asset: ZodiacAsset, size: number) {
  if (typeof asset === 'function') {
    const Component = asset
    return <Component width={size} height={size} />
  }
  // Bitmap (PNG) — the rasterised art. Plain RN <Image>; this art is not
  // nested in an <Svg>, so SvgImage isn't available.
  return <Image source={asset} style={{ width: size, height: size }} resizeMode="contain" />
}

export function ZodiacArt({ sign, size }: { sign: ZodiacSign; size: number }) {
  // The halo overflows the art box so the glow can bleed past the edges
  // without ever closing into a ring/diana. Optical centre sits slightly
  // high (cy ≈ 46 %) to break perfect-circle symmetry — same anti-symmetry
  // trick as the reveal's aura.
  const haloSize = Math.round(size * 1.28)
  const haloOffset = (haloSize - size) / 2
  const haloRadius = `${Math.round((size / haloSize) * 62)}%`

  return (
    <>
      <Svg
        width={haloSize}
        height={haloSize}
        viewBox={`0 0 ${haloSize} ${haloSize}`}
        style={{ position: 'absolute', left: -haloOffset, top: -haloOffset }}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id="zodiac-art-halo" cx="50%" cy="46%" r={haloRadius}>
            {HALO_STOPS.map((s) => (
              <Stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
            ))}
          </RadialGradient>
        </Defs>
        <Circle
          cx={haloSize / 2}
          cy={haloSize * 0.46}
          r={haloSize / 2}
          fill="url(#zodiac-art-halo)"
        />
      </Svg>
      {renderArt(ART_BY_SIGN[sign], size)}
    </>
  )
}
