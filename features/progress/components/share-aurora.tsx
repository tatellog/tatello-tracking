import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import { colors, typography } from '@/theme'

import type { ShareCardStyle } from '../share-styles'

/*
 * La cama de las tarjetas para compartir (rediseño dueña 5 oct 2026: "lo más
 * instagrameable posible"). Tres manchas de aurora (los colores del estilo)
 * sobre la base, grano fino que la vuelve foto y un campo de estrellas.
 * `centered`: una sola luz al centro (la tarjeta Constelación, limpia).
 * Glows radiales de 2 stops + grano: la misma técnica anti-banding de siempre.
 */

type Dot = { x: number; y: number; r: number; o: number }

/** Puntos sembrados en coordenadas 0..1 (se escalan al tamaño de la tarjeta).
 *  A nivel de módulo: 700 granos no se recalculan en cada render. */
function seeded(seed: number, n: number, make: (r: () => number) => Dot): Dot[] {
  let s = seed
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  return Array.from({ length: n }, () => make(rand))
}

const STARS = seeded(40213, 48, (r) => {
  const bright = r() > 0.88
  return {
    x: r(),
    y: r(),
    r: bright ? 1.4 + r() * 0.7 : 0.5 + r() * 0.6,
    o: bright ? 0.5 + r() * 0.2 : 0.12 + r() * 0.2,
  }
})
const GRAIN = seeded(88117, 700, (r) => ({
  x: r(),
  y: r(),
  r: 0.4 + r() * 0.5,
  o: 0.02 + r() * 0.05,
}))

export function AuroraBed({
  width,
  height,
  cardStyle,
  centered = false,
}: {
  width: number
  height: number
  cardStyle: ShareCardStyle
  centered?: boolean
}) {
  const [a, b, c] = cardStyle.aurora
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
      <Defs>
        <RadialGradient
          id="au-a"
          cx={centered ? '50%' : '12%'}
          cy={centered ? '36%' : '10%'}
          r={centered ? '62%' : '60%'}
        >
          <Stop offset="0" stopColor={a} stopOpacity={centered ? 0.3 : 0.55} />
          <Stop offset="1" stopColor={a} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="au-b" cx="96%" cy="58%" r="62%">
          <Stop offset="0" stopColor={b} stopOpacity={0.6} />
          <Stop offset="1" stopColor={b} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="au-c" cx="18%" cy="100%" r="55%">
          <Stop offset="0" stopColor={c} stopOpacity={0.35} />
          <Stop offset="1" stopColor={c} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill={cardStyle.bg} />
      <Rect width={width} height={height} fill="url(#au-a)" />
      {centered ? null : (
        <>
          <Rect width={width} height={height} fill="url(#au-b)" />
          <Rect width={width} height={height} fill="url(#au-c)" />
        </>
      )}
      {GRAIN.map((g, i) => (
        <Circle
          key={`g${i}`}
          cx={g.x * width}
          cy={g.y * height}
          r={g.r}
          fill={colors.leche}
          opacity={g.o}
        />
      ))}
      {STARS.map((st, i) => (
        <Circle
          key={`s${i}`}
          cx={st.x * width}
          cy={st.y * height}
          r={st.r}
          fill={colors.leche}
          opacity={st.o}
        />
      ))}
    </Svg>
  )
}

/** La firma de abajo: "✦ STELAR" (dueña 5 oct 2026; un @ o dominio va aquí). */
export function ShareSignature({ label = 'STELAR' }: { label?: string }) {
  return (
    <View style={styles.signature}>
      <Text style={styles.signatureText}>{`✦  ${label}`}</Text>
    </View>
  )
}

/** Fila de arriba: marca a la izquierda, fecha corta a la derecha ("OCT ’26"). */
export function ShareTopRow({ right, accent }: { right: string; accent: string }) {
  return (
    <View style={styles.topRow}>
      <View style={styles.topBrand}>
        <View style={[styles.topRing, { borderColor: accent }]} />
        <Text style={styles.topText}>STELAR</Text>
      </View>
      <Text style={styles.topText}>{right}</Text>
    </View>
  )
}

/** Chip translúcido ("186 entrenos", "Próxima estrella: día 7"). */
export function SharePill({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  )
}

const MONTHS_SHORT = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
]

/** 'YYYY-MM-DD' → "OCT ’26". */
export function shortMonthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number) as [number, number]
  return `${MONTHS_SHORT[m - 1]} ’${String(y).slice(2)}`
}

const styles = StyleSheet.create({
  signature: { alignItems: 'center' },
  signatureText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 4,
    color: colors.leche,
    opacity: 0.85,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topBrand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topRing: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  topText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 3,
    color: colors.leche,
  },
  pill: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(244, 236, 222, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244, 236, 222, 0.22)',
  },
  pillText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.leche,
  },
})
