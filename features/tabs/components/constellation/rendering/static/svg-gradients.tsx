import { Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg'

import { colors } from '@/theme'

export function SvgGradients() {
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
    </Defs>
  )
}
