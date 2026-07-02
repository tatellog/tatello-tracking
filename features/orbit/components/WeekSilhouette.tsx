import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

import type { WeekSilhouetteCell } from '../week-orbit-logic'

/*
 * §S · La silueta de tus 7 días — el ritmo del tramo hecho imagen (ver
 * docs/orbita-semana-spec.md §S). Lo único que solo la semana muestra: la FORMA
 * ("empecé fuerte y me caí el jueves"). Columnas de luz suaves (no barras de
 * dashboard): finas, redondeadas, sin ejes ni grilla. Altura = plenitud del día.
 *
 * Gramática de LUZ (nunca hue de alarma), en rima con el calendario de Mes:
 *   · Día en DÉFICIT = columna ORO ENCENDIDA — cuerpo `oroLight` + capas
 *     `oroGlow`/`oroBloom` detrás (mismo stack que la estrella de Mes; funciona
 *     en Android, que ignora shadowRadius).
 *   · Día presente sin déficit = columna magenta suave (brillo por plenitud).
 *   · Día pasado en silencio = brasa apagada (dot cálido tenue).
 *   · Día futuro = polvo por venir (dot más pequeño y frío) — nunca falla.
 * HOY lleva su propio marcador (dot) además de la letra: "aquí estás".
 *
 * Eje HORIZONTAL (forma del tiempo) — complementa la galaxia (eje VERTICAL: qué
 * hábitos). Se queda un peldaño por debajo en brillo para no competir con ella.
 */

const TRACK_H = 70
const MIN_BAR = 6

export function WeekSilhouette({
  cells,
  selectedDate,
  onSelectDay,
}: {
  cells: readonly WeekSilhouetteCell[]
  /** Día seleccionado (para resaltar la columna). El detalle emerge en un panel
   *  abajo (WeekSegment), no navega directo — misma gramática que la galaxia. */
  selectedDate?: string | null
  /** Selecciona/deselecciona un día. Los futuros no son seleccionables. */
  onSelectDay?: (date: string | null) => void
}) {
  const hasGold = cells.some((c) => c.deficit)
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel="La forma de tu semana: la altura de cada columna es cuánto registraste ese día; en oro, tus días en déficit."
    >
      <View style={styles.row}>
        {cells.map((c) => {
          const isDust = c.state === 'future' || (c.fullness <= 0 && !c.deficit)
          const h = isDust ? 0 : Math.max(MIN_BAR, Math.round(c.fullness * TRACK_H))
          const tappable = !!onSelectDay && c.state !== 'future'
          const isSelected = c.date === selectedDate
          return (
            <Pressable
              key={c.date}
              style={styles.col}
              disabled={!tappable}
              onPress={tappable ? () => onSelectDay!(isSelected ? null : c.date) : undefined}
              hitSlop={{ top: 6, bottom: 6 }}
              accessibilityRole={tappable ? 'button' : undefined}
              accessibilityState={tappable ? { selected: isSelected } : undefined}
              accessibilityLabel={tappable ? 'Ver este día' : undefined}
            >
              <View style={styles.track}>
                {c.state === 'future' ? (
                  <View style={styles.dustFuture} />
                ) : c.fullness <= 0 && !c.deficit ? (
                  <View style={styles.dustSilent} />
                ) : c.deficit ? (
                  <View style={styles.barWrap}>
                    <View style={[styles.goldBloom, { height: h + 12 }]} />
                    <View style={[styles.goldGlow, { height: h + 5 }]} />
                    <View style={[styles.bar, styles.goldBar, { height: h }]} />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.bar,
                      styles.magentaBar,
                      { height: h, opacity: 0.4 + c.fullness * 0.5 },
                    ]}
                  />
                )}
              </View>
              <View style={styles.markerRow}>
                {isSelected ? (
                  <View style={[styles.todayDot, styles.selectedDot]} />
                ) : c.state === 'today' ? (
                  <View style={styles.todayDot} />
                ) : null}
              </View>
              <Text
                style={[
                  styles.letter,
                  c.state === 'past' && styles.letterPast,
                  c.state === 'today' && styles.letterToday,
                ]}
              >
                {c.letter}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {hasGold ? <Text style={styles.caption}>El oro son tus días en déficit.</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  // La columna crece desde abajo (silueta = perfil de montañas).
  track: {
    height: TRACK_H,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barWrap: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: 7,
    borderRadius: 999,
  },
  magentaBar: {
    backgroundColor: colors.magenta,
  },
  // El día ENCENDIDO: cuerpo oro claro + shadow (iOS). Las capas de glow/bloom
  // detrás dan el halo también en Android.
  goldBar: {
    backgroundColor: colors.oroLight,
    shadowColor: colors.oro,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  goldGlow: {
    position: 'absolute',
    bottom: 0,
    width: 14,
    borderRadius: 999,
    backgroundColor: colors.oroGlow,
  },
  goldBloom: {
    position: 'absolute',
    bottom: 0,
    width: 24,
    borderRadius: 999,
    backgroundColor: colors.oroBloom,
  },
  // Día pasado en silencio: brasa apagada, cálida (no es "aún no llega").
  dustSilent: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.bruma,
    opacity: 0.6,
  },
  // Día futuro: polvo por venir, más chico y frío que la brasa apagada.
  dustFuture: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.bruma,
    opacity: 0.3,
  },
  // Reserva de espacio bajo la columna; solo hoy pinta el dot ("aquí estás").
  markerRow: {
    height: 9,
    justifyContent: 'center',
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.leche,
  },
  // El día seleccionado (su panel está abierto abajo): dot magenta.
  selectedDot: {
    width: 6,
    height: 6,
    backgroundColor: colors.magenta,
  },
  letter: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
  letterPast: {
    color: colors.bone,
  },
  letterToday: {
    fontFamily: typography.uiSemi,
    color: colors.leche,
  },
  caption: {
    marginTop: 12,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
})
