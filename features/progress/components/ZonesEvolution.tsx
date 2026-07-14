import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { colors, typography } from '@/theme'

import { useBodyCheckins } from '../hooks'
import { zoneEvolution, type ZoneKey } from '../logic'

/*
 * Evolución por zona (F4 · mockup dueña; colapsada por decisión benchmark) —
 * el % de grasa de brazos/tronco/piernas entre tu primera y tu última medición
 * con zonas (los check-ins del coach las traen). Target-user: "¿qué hago con
 * brazos 30.9 → 33.7? nada" — es dato de nicho, así que vive PLEGADO como cola
 * de Composición (progressive disclosure estilo Apple: disponible ≠
 * protagonista), no como sección propia con divisor.
 *
 * La observación es un HECHO ("la grasa cambió más en tu tronco"), nunca un
 * elogio direccional — si Stelar felicita cuando baja, su silencio cuando sube
 * se vuelve reproche (benchmark). Se auto-oculta sin ≥2 mediciones con zonas.
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
  const [open, setOpen] = useState(false)
  if (zones.length === 0) return null

  const hl = zones.find((z) => z.key === highlight)

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Ver la grasa por zona"
        style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.toggleText}>Grasa por zona</Text>
        <Text style={styles.toggleCaret}>{open ? '▾' : '▸'}</Text>
      </Pressable>

      {open ? (
        <Animated.View entering={FadeIn.duration(240)}>
          <Text style={styles.sub}>De tu primera a tu última medición con datos de zonas</Text>
          {/* Sin highlight dorado: se leía como PREMIO ("¿me felicitas por subir
              grasa?" · target-user). La observación de abajo dirige la atención. */}
          <View style={styles.grid}>
            {zones.map((z) => {
              const arrow = z.delta === 0 ? null : z.delta > 0 ? '↑' : '↓'
              return (
                <View key={z.key} style={styles.card}>
                  <Text style={styles.zone}>{ZONE_LABEL[z.key]}</Text>
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
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // Cola de Composición: sin divisor propio (leería como sección aparte).
  wrap: { marginTop: 6 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  toggleText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    letterSpacing: 0.2,
  },
  toggleCaret: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
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
  zone: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.5,
    color: colors.niebla,
  },
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
