import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

import { useBodyCheckins } from '../hooks'
import { zoneEvolution, type ZoneKey } from '../logic'

/*
 * Evolución por zona (F4 · mockup dueña) — el % de grasa de brazos/tronco/
 * piernas entre tu primera y tu última medición con zonas (los check-ins del
 * coach las traen). La observación es un HECHO ("tu tronco fue la zona donde
 * más cambió"), nunca un elogio direccional — si Stelar felicita cuando baja,
 * su silencio cuando sube se vuelve reproche (benchmark). Se auto-oculta sin
 * ≥2 mediciones con zonas. La silueta ilustrada llega después (illustrator).
 */

const ZONE_LABEL: Record<ZoneKey, string> = {
  arms: 'Brazos',
  trunk: 'Tronco',
  legs: 'Piernas',
}

/** Evidencia primero, cero concordancia ("La grasa cambió más en tus brazos"). */
const ZONE_IN: Record<ZoneKey, string> = {
  arms: 'tus brazos',
  trunk: 'tu tronco',
  legs: 'tus piernas',
}

export function ZonesEvolution() {
  const { data } = useBodyCheckins()
  const { zones, highlight } = useMemo(() => zoneEvolution(data ?? []), [data])
  if (zones.length === 0) return null

  const hl = zones.find((z) => z.key === highlight)

  return (
    <Animated.View entering={FadeIn.duration(360).delay(150)}>
      <View style={styles.divider} />
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Evolución por zona
      </EyebrowLabel>
      <Text style={styles.sub}>Grasa por zona, de tu primera a tu última medición</Text>

      <View style={styles.grid}>
        {zones.map((z) => {
          const isHl = z.key === highlight
          const arrow = z.delta === 0 ? null : z.delta > 0 ? '↑' : '↓'
          return (
            <View key={z.key} style={[styles.card, isHl && styles.cardHl]}>
              <Text style={[styles.zone, isHl && styles.zoneHl]}>{ZONE_LABEL[z.key]}</Text>
              <View style={styles.valueRow}>
                <Text style={styles.prev}>{z.first.toFixed(1)} %</Text>
                <Text style={styles.arrowGlyph}>→</Text>
                <Text style={styles.curr}>{z.last.toFixed(1)} %</Text>
              </View>
              {arrow ? (
                <Text style={styles.delta}>
                  {arrow} {z.delta > 0 ? '+' : '−'}
                  {Math.abs(z.delta).toFixed(1)} %
                </Text>
              ) : null}
            </View>
          )
        })}
      </View>

      {/* La observación: hecho, sin nota. */}
      {hl ? (
        <Text style={styles.observation}>La grasa cambió más en {ZONE_IN[hl.key]}.</Text>
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', marginVertical: 28 },
  eyebrow: { marginBottom: 2 },
  sub: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
    marginBottom: 12,
  },
  grid: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  // La zona de mayor cambio se marca en ORO (atención, no calificación).
  cardHl: { borderColor: colors.oroHairline, backgroundColor: colors.oroTint },
  zone: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.5,
    color: colors.niebla,
  },
  zoneHl: { color: colors.oroSoft },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  prev: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  arrowGlyph: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.oro,
  },
  curr: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  delta: {
    marginTop: 3,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  observation: {
    marginTop: 12,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.bone,
  },
})
