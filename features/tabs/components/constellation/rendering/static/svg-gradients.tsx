import { Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg'

import { colors } from '@/theme'

import type { ZodiacDef } from '../../../../zodiac/types'
import type { Resolved } from '../../types'

export function SvgGradients({ zodiac, stars }: { zodiac: ZodiacDef; stars: Resolved[] }) {
  return (
    <Defs>
      <RadialGradient id="starLit" cx="35%" cy="35%">
        <Stop offset="0%" stopColor="#FFF6E5" />
        <Stop offset="55%" stopColor="#F4ECDE" />
        <Stop offset="100%" stopColor="#C9B8A5" />
      </RadialGradient>
      <RadialGradient id="starNext" cx="35%" cy="35%">
        <Stop offset="0%" stopColor="#FFB8D4" />
        <Stop offset="55%" stopColor="#E91E63" />
        <Stop offset="100%" stopColor="#7A1737" />
      </RadialGradient>
      {/* Lit-cluster aura — warm cream-pink wash bathing the lit
          half of the constellation. Bright cream at the centre
          fades to transparent magenta at the rim. Centre + mid
          opacities bumped (0.85→0.95, 0.45→0.6) so the lit area
          glows with enough warmth to compete with the bronze
          lion behind it instead of being absorbed by it. */}
      <RadialGradient id="litClusterAura" cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor="#FFE9D6" stopOpacity={0.95} />
        <Stop offset="45%" stopColor="#F4ECDE" stopOpacity={0.6} />
        <Stop offset="100%" stopColor="#D9AE6F" stopOpacity={0} />
      </RadialGradient>
      {/* Card vignette — transparent at the centre, dark at the
          edges. Painted as a full-canvas <Rect fill="url(#cardVignette)" />
          sitting between the atmospheric backdrop (nebula + lion)
          and the focal layer (field stars + constellation). Frames
          the composition without dimming the lit stars. */}
      <RadialGradient id="cardVignette" cx="50%" cy="50%" r="75%">
        <Stop offset="0%" stopColor={colors.bg} stopOpacity={0} />
        <Stop offset="40%" stopColor={colors.bg} stopOpacity={0.14} />
        <Stop offset="70%" stopColor={colors.bg} stopOpacity={0.45} />
        <Stop offset="100%" stopColor={colors.bg} stopOpacity={0.85} />
      </RadialGradient>
      {/* Edge fade — linear vertical gradient that softens
          specifically the top + bottom of the card into the page
          bg. The radial vignette darkens corners; this one
          dissolves the horizontal edges so the lion art bleeds
          into the page above and below instead of starting on a
          hard line. */}
      <LinearGradient id="cardEdgeFade" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor={colors.bg} stopOpacity={1} />
        <Stop offset="6%" stopColor={colors.bg} stopOpacity={0.85} />
        <Stop offset="14%" stopColor={colors.bg} stopOpacity={0.45} />
        <Stop offset="24%" stopColor={colors.bg} stopOpacity={0} />
        <Stop offset="76%" stopColor={colors.bg} stopOpacity={0} />
        <Stop offset="86%" stopColor={colors.bg} stopOpacity={0.45} />
        <Stop offset="94%" stopColor={colors.bg} stopOpacity={0.85} />
        <Stop offset="100%" stopColor={colors.bg} stopOpacity={1} />
      </LinearGradient>
      {/* Per-line gradients for LitLineFilament. Declared globally
          (one per zodiac edge) with stable ids `litLine-${idx}` so
          they don't get reconciled when litKeys changes — the
          previous version had a <Defs><LinearGradient> inside each
          LitLineFilament instance, which forced create/destroy of
          the gradient every time a line lit up or undid. Stops are
          bright at each node and dim at the midpoint — each lit
          line reads as "two stars connected by their own light"
          rather than a uniform stroke. */}
      {zodiac.lines.map(([a, b], idx) => {
        const A = stars[a]
        const B = stars[b]
        if (!A || !B) return null
        return (
          <LinearGradient
            key={`litLine-${idx}`}
            id={`litLine-${idx}`}
            gradientUnits="userSpaceOnUse"
            x1={A.x}
            y1={A.y}
            x2={B.x}
            y2={B.y}
          >
            <Stop offset="0%" stopColor="#FFF6E5" stopOpacity={0.85} />
            <Stop offset="15%" stopColor="#D9AE6F" stopOpacity={0.78} />
            <Stop offset="50%" stopColor="#D9AE6F" stopOpacity={0.4} />
            <Stop offset="85%" stopColor="#D9AE6F" stopOpacity={0.78} />
            <Stop offset="100%" stopColor="#FFF6E5" stopOpacity={0.85} />
          </LinearGradient>
        )
      })}
    </Defs>
  )
}
