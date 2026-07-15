import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { useCyclePhase } from '@/features/cycle/useCyclePhase'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { LinkCta } from './LinkCta'

import { useBodyCheckins, useBodyCompositionIsMock, useWearableComposition } from '../hooks'
import {
  compositionSeries,
  compositionSynthesis,
  type CompositionSeriesKey,
  type SeriesPoint,
} from '../logic'
import { Sparkline } from './Sparkline'

/*
 * Composición corporal (F2 · Cuerpo, mockup dueña) — cards POR MÉTRICA con
 * sparkline: la serie completa (check-ins del coach + manual + wearable
 * fusionados en logic.ts/compositionSeries) como forma, y el arco primera →
 * última como números. Solo métricas CON datos (sin cascarones). Delta con el
 * hue de identidad de la métrica, nunca verde/rojo (el cuerpo no se juzga).
 * `muscle_kg` (InBody) y `lean_kg` (HealthKit) son series separadas — honestidad:
 * no son la misma métrica. Evidencia, no veredicto (manifiesto).
 */

// Sin IMC (decisión benchmark + target-user: "sé que 25 es la rayita mala, me
// asusta y no me dice qué hacer"): es el número más cercano a lenguaje clínico
// del tab y no tiene palanca. Vive solo en la Tabla completa, el expediente.
const METRICS: { key: CompositionSeriesKey; label: string; unit: string; hue: string }[] = [
  { key: 'body_fat_pct', label: 'Grasa corporal', unit: '%', hue: colors.signal.proteina },
  { key: 'muscle_kg', label: 'Músculo', unit: 'kg', hue: colors.dimension.cuerpo },
  { key: 'water_pct', label: 'Agua', unit: '%', hue: colors.signal.agua },
  { key: 'lean_kg', label: 'Masa magra', unit: 'kg', hue: colors.dimension.cuerpo },
]

/** Días desde la última medición completa; null sin datos. */
const MESES_LARGO = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** Umbral de frescura: pasado esto, el veredicto en presente ("subió tu
 *  grasa") se degrada a hecho fechado (patrón Apple: fechar y silenciar,
 *  nunca presentar un dato viejo como el hoy). */
const STALE_DAYS = 90

function fmt(v: number, unit: string): string {
  return `${v % 1 === 0 ? v : v.toFixed(1)}${unit ? ` ${unit}` : ''}`
}

export function CompositionCards() {
  const router = useRouter()
  const checkins = useBodyCheckins()
  const wearable = useWearableComposition(null)
  const isMock = useBodyCompositionIsMock()

  // Honestidad: con check-ins REALES, el mock del wearable NO se mezcla en las
  // series (diría "de tus mediciones" con puntos inventados adentro). El mock
  // solo llena el vacío cuando no hay ninguna medición propia.
  const hasCheckins = (checkins.data?.length ?? 0) > 0
  const wearableRows = isMock && hasCheckins ? [] : (wearable.data ?? [])
  const series = useMemo(
    () => compositionSeries(checkins.data ?? [], wearableRows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkins.data, wearable.data, isMock],
  )

  const cards = METRICS.map((m) => ({ ...m, serie: series[m.key] })).filter(
    (c) => c.serie.length > 0,
  )

  // La lectura ANTES de las flechas (misma frase honesta del comparador,
  // sin cierre-rescate: esa frase vive una vez, en el comparador).
  const synthesis = useMemo(() => compositionSynthesis(series), [series])

  // Fecha de la última medición y su edad en días: la frescura manda.
  const last = useMemo(() => {
    const lastDay = Object.values(series)
      .flat()
      .reduce<string | null>((acc, p) => (acc == null || p.day > acc ? p.day : acc), null)
    if (!lastDay) return null
    const [y, m, d] = lastDay.split('-').map(Number) as [number, number, number]
    const [ty, tm, td] = todayInTimezone().split('-').map(Number) as [number, number, number]
    const ageDays = Math.round(
      (new Date(ty, tm - 1, td, 12).getTime() - new Date(y, m - 1, d, 12).getTime()) / 86400000,
    )
    const label = `${MESES_LARGO[m - 1]} ${y}`
    return { day: lastDay, ageDays, label }
  }, [series])

  // Con la medición vieja, el veredicto en presente se calla (la usuaria se
  // sentía "regañada con una foto vieja"): queda el hecho fechado + una
  // invitación sin presión. Nunca push, nunca badge de "vencida".
  const isStale = last != null && last.ageDays > STALE_DAYS

  // Recencia = jerarquía (benchmark): con datos viejos, la sección colapsa a
  // header + fecha por default; los números viven a un tap. No es esconder
  // el baseline (sigue aquí, fechado): es no darle a ago-2025 el mismo peso
  // visual que a lo fresco.
  const [openStale, setOpenStale] = useState(false)
  const collapsed = isStale && !openStale

  // Conexión con el ciclo, SOLO cuando es honesta: la última medición cayó en
  // días de retención (lútea/menstrual) Y es reciente (≤7 días). Conectar el
  // ciclo a un delta de un año sería endulzar el número.
  const cycle = useCyclePhase()
  const cycleNote = useMemo(() => {
    if (!cycle || (cycle.phase !== 'lutea' && cycle.phase !== 'menstrual')) return null
    if (!last || last.ageDays < 0 || last.ageDays > 7) return null
    return 'Tu última medición cayó en días en que el cuerpo retiene agua por el ciclo. El agua y el peso pueden subir sin que nada esté mal.'
  }, [cycle, last])

  if (cards.length === 0) return null

  return (
    <Animated.View entering={FadeIn.duration(360).delay(120)}>
      {/* Divisor propio: solo existe cuando la sección tiene datos. */}
      <View style={styles.divider} />
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Composición corporal
      </EyebrowLabel>
      {/* La fecha SIEMPRE visible: estos números son de cuando te mediste,
          no de hoy (patrón Apple: fechar todo). */}
      {last ? <Text style={styles.dateCaption}>Última medición · {last.label}</Text> : null}

      {collapsed ? (
        <LinkCta
          label="Ver estos números ▸"
          onPress={() => setOpenStale(true)}
          role="button"
          expanded={false}
          accessibilityLabel="Ver tu composición corporal"
        />
      ) : (
        <>
          {isStale ? (
            <Text style={styles.staleNote}>
              Estos números son de {last!.label}. Cuando quieras, los actualizas con una nueva
              medición.
            </Text>
          ) : synthesis ? (
            <Text style={styles.synthesis}>{synthesis}</Text>
          ) : null}
          {cycleNote ? <Text style={styles.cycleNote}>{cycleNote}</Text> : null}
          <View style={styles.grid}>
            {/* Stagger de 60 ms: las cards llegan una a una, no de golpe. */}
            {cards.map((c, i) => (
              <Animated.View
                key={c.key}
                entering={FadeIn.duration(420).delay(i * 60)}
                style={styles.gridItem}
              >
                <MetricCard label={c.label} unit={c.unit} hue={c.hue} serie={c.serie} />
              </Animated.View>
            ))}
          </View>
          <Text style={styles.note}>
            {isMock && !hasCheckins
              ? 'Datos de ejemplo · así se verá cuando conectes tu báscula o salud.'
              : 'De tus mediciones y salud conectada. Evidencia, no veredicto.'}
          </Text>
          {/* Epic 08: el detalle por métrica vive en su pantalla. */}
          <LinkCta
            label="Ver en detalle →"
            onPress={() => router.push('/body-composition')}
            accessibilityLabel="Ver tu composición a detalle"
          />
          {isStale ? (
            /* Acción opuesta a navegar: más apagada y separada (uxui). */
            <LinkCta
              label="Ocultar ▴"
              onPress={() => setOpenStale(false)}
              role="button"
              expanded
              accessibilityLabel="Ocultar tu composición corporal"
              style={styles.hideLink}
              textStyle={styles.hideLinkText}
            />
          ) : null}
        </>
      )}
    </Animated.View>
  )
}

function MetricCard({
  label,
  unit,
  hue,
  serie,
}: {
  label: string
  unit: string
  hue: string
  serie: SeriesPoint[]
}) {
  const first = serie[0]!
  const last = serie[serie.length - 1]!
  const delta = serie.length > 1 ? Number((last.value - first.value).toFixed(1)) : null
  const arrow = delta == null || delta === 0 ? null : delta > 0 ? '↑' : '↓'
  return (
    <View style={styles.card}>
      <Text style={[styles.cardLabel, { color: hue }]}>{label}</Text>
      <View style={styles.valueRow}>
        {serie.length > 1 ? <Text style={styles.prev}>{fmt(first.value, unit)}</Text> : null}
        {serie.length > 1 ? <Text style={[styles.arrowGlyph, { color: hue }]}>→</Text> : null}
        <Text style={styles.curr}>{fmt(last.value, unit)}</Text>
      </View>
      {delta != null && delta !== 0 ? (
        <Text style={[styles.delta, { color: hue }]}>
          {arrow} {delta > 0 ? '+' : '−'}
          {fmt(Math.abs(delta), unit)}
        </Text>
      ) : (
        <Text style={styles.deltaMuted}>
          {serie.length === 1 ? 'primera medición' : 'sin cambio'}
        </Text>
      )}
      <Sparkline data={serie.map((p) => p.value)} hue={hue} />
    </View>
  )
}

const styles = StyleSheet.create({
  // El espacio ES el separador (brief): sin hairline, solo aire.
  divider: { height: 0, marginVertical: 38 },
  eyebrow: { marginBottom: 10 },
  // La lectura en voz del coach — antes de cualquier flecha.
  synthesis: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 24,
    color: colors.leche,
    marginBottom: 12,
  },
  cycleNote: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
    marginBottom: 12,
  },
  dateCaption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.4,
    color: colors.niebla,
    marginBottom: 8,
  },
  hideLink: { marginTop: 4 },
  hideLinkText: { fontSize: typography.sizes.label, color: colors.bruma },
  // La invitación cuando la medición es vieja: hecho fechado, sin presión.
  staleNote: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 24,
    color: colors.leche,
    marginBottom: 12,
  },
  // Grid 2×2: con 30% la 4ª card se estiraba sola a todo el ancho (se leía
  // rota) y los sparklines quedaban decorativos.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { flexGrow: 1, flexBasis: '47%' },
  // Cards que casi desaparecen (brief): borde más tenue, más radio, más
  // aire adentro — el contenido flota, la card solo lo sostiene.
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  cardLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  prev: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  arrowGlyph: { fontFamily: typography.uiMedium, fontSize: typography.sizes.body },
  curr: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  // Identidad por métrica: mismo hue suba o baje. Dirección solo tipográfica.
  delta: {
    marginTop: 3,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    fontVariant: ['tabular-nums'],
  },
  deltaMuted: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
  note: {
    marginTop: 10,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
