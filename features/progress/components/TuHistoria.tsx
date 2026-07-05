import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import type { BodyMeasurement } from '@/features/brief/api'
import { useTransformProgressAsOf } from '@/features/emblem'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { useProfile } from '@/features/profile/hooks'
import { ZODIAC, zodiacFromDate } from '@/features/tabs/zodiac'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { useAllWorkoutDates, useMeasurements } from '../hooks'

/* Hace `n` días en zona local desde una fecha ISO — numérico (Hermes no parsea
 * 'YYYY-MM-DD' como Date confiable). */
function isoDaysAgo(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d - n, 12)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** Peso SUAVIZADO al cierre de una ventana: media de los pesajes de los 10
 *  días que terminan en `targetIso`. El pesaje crudo más cercano hacía que
 *  un día hinchado/liviano fuera el titular de la card — misma disciplina
 *  que "Tu cuerpo" (media móvil), nunca ruido como historia. */
function smoothedWeightAt(rows: readonly BodyMeasurement[], targetIso: string): number | null {
  const [y, m, d] = targetIso.split('-').map(Number) as [number, number, number]
  const endTs = new Date(y, m - 1, d, 23, 59).getTime()
  const startTs = endTs - 10 * 86_400_000
  let sum = 0
  let n = 0
  for (const r of rows) {
    if (r.weight_kg == null) continue
    const t = new Date(r.measured_at).getTime()
    if (t >= startTs && t <= endTs) {
      sum += r.weight_kg
      n += 1
    }
  }
  return n > 0 ? sum / n : null
}

type Signal = { day?: string | null; protein_g?: number | null }

function avgProtein(rows: readonly Signal[], fromIso: string, toIso: string): number | null {
  let sum = 0
  let n = 0
  for (const r of rows) {
    if (!r.day || r.day <= fromIso || r.day > toIso) continue
    if (r.protein_g != null && r.protein_g > 0) {
      sum += r.protein_g
      n += 1
    }
  }
  return n > 0 ? sum / n : null
}

type Tone = 'growth' | 'neutral'
type Row = {
  key: string
  label: string
  before: string | null
  now: string | null
  unit?: string
  suffix?: string
  delta: { text: string; up: boolean } | null
  tone: Tone
}

/*
 * "Tu Historia" — el hero de Progreso. Responde "¿qué ha cambiado?" con
 * EVIDENCIA, no un dashboard: cada métrica como un salto Antes → Ahora (el
 * pasado tenue, el presente luminoso) + el delta a la derecha.
 *
 * UNA sola regla de lectura (rediseño 5 jul 2026, decisión dueña): TODAS
 * las filas comparan "estos 30 días vs los 30 anteriores" (Apple Trends:
 * una semántica, luego escaneas). Antes convivían cuatro (peso puntual,
 * entrenos/días acumulados de por vida, proteína promedio) y la usuaria
 * tenía que jugar al detective ("¿23 entrenos en un mes?"). El orden
 * cuenta la tesis del producto: lo que HICISTE primero (entrenos,
 * proteína, presencia), el outcome corporal al final — peso SUAVIZADO y
 * "estable" bajo el ruido (nunca un "+0.0 kg" abriendo tu historia). Los
 * deltas son honestos en ambas direcciones: ↑ oro al subir, ↓ niebla al
 * bajar (nunca rojo). La constelación ya no es fila de tabla (error de
 * categoría: la capa simbólica no tabula) — su historia vive en la
 * TransformationCard de esta misma pantalla.
 *
 * Gate por volumen de datos (principio Apple Trends): con pocos días de
 * señales, los saltos rinden comparaciones absurdas. Bajo el umbral la
 * tarjeta promete en vez de comparar.
 */
const MIN_DIAS_HISTORIA = 14
export function TuHistoria() {
  const today = useMemo(() => todayInTimezone(), [])
  const cut30 = useMemo(() => isoDaysAgo(today, 30), [today])
  const cut60 = useMemo(() => isoDaysAgo(today, 60), [today])

  const measurements = useMeasurements(70)
  const workouts = useAllWorkoutDates()
  const signals = useSignalsHistory(95)
  // Solo el % actual (para el modo promesa); el "as of hace 30 días" se fue
  // con la fila de constelación (ya no tabula junto a gramos y kilos).
  const cNow = useTransformProgressAsOf(today)
  const { data: profile } = useProfile()

  const signLabel = useMemo(() => {
    const sign = zodiacFromDate(profile?.date_of_birth)
    const raw = ZODIAC[sign].label
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
  }, [profile?.date_of_birth])

  const loading =
    measurements.isLoading || workouts.isLoading || signals.isLoading || cNow.isLoading

  // Días con al menos una señal — decide si la historia ya puede hablar.
  const diasConSenal = useMemo(
    () => ((signals.data ?? []) as Signal[]).filter((r) => r.day != null).length,
    [signals.data],
  )

  const rows = useMemo<Row[]>(() => {
    const mRows = measurements.data ?? []
    const wDates = workouts.data ?? []
    const sRows = (signals.data ?? []) as Signal[]

    // UNA regla para todas las filas: estos 30 días vs los 30 anteriores.
    // Delta honesto en ambas direcciones (una baja jamás se oculta ni se
    // pinta de alarma); sin cambio → sin chip (silencio, no "+0").
    const growthDelta = (before: number, now: number, unit = '') => {
      const d = now - before
      if (d === 0) return null
      return { text: `${d > 0 ? '+' : '−'}${Math.abs(Math.round(d))}${unit}`, up: d > 0 }
    }

    // Entrenos — conteo por ventana.
    const eBefore = wDates.filter((d) => d > cut60 && d <= cut30).length
    const eNow = wDates.filter((d) => d > cut30 && d <= today).length

    // Proteína — promedio por ventana (solo días con proteína registrada).
    const pBefore = avgProtein(sRows, cut60, cut30)
    const pNow = avgProtein(sRows, cut30, today)
    const proteinDelta =
      pBefore != null && pNow != null
        ? growthDelta(Math.round(pBefore), Math.round(pNow), ' g')
        : null

    // Días con registro — días con señal por ventana.
    const dBefore = sRows.filter((r) => r.day != null && r.day > cut60 && r.day <= cut30).length
    const dNow = sRows.filter((r) => r.day != null && r.day > cut30 && r.day <= today).length

    // Peso — ÚLTIMA fila (el outcome después del hacer), suavizado al cierre
    // de cada ventana, y "estable" bajo el ruido de báscula: un "+0.0 kg"
    // abriendo tu historia era la anti-apertura (decisión dueña 5 jul 2026).
    const wBefore = smoothedWeightAt(mRows, cut30)
    const wNow = smoothedWeightAt(mRows, today)
    const weightDelta = (() => {
      if (wBefore == null || wNow == null) return null
      const d = wNow - wBefore
      if (Math.abs(d) < 0.5) return { text: 'estable', up: false }
      return { text: `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} kg`, up: d > 0 }
    })()

    return [
      {
        key: 'entrenos',
        label: 'Entrenos',
        before: String(eBefore),
        now: String(eNow),
        delta: growthDelta(eBefore, eNow),
        tone: 'growth',
      },
      {
        key: 'proteina',
        label: 'Proteína prom.',
        before: pBefore != null ? String(Math.round(pBefore)) : null,
        now: pNow != null ? String(Math.round(pNow)) : null,
        unit: 'g',
        delta: proteinDelta,
        tone: 'growth',
      },
      {
        key: 'dias',
        label: 'Días con registro',
        before: String(dBefore),
        now: String(dNow),
        delta: growthDelta(dBefore, dNow),
        tone: 'growth',
      },
      {
        key: 'peso',
        label: 'Peso',
        before: wBefore != null ? wBefore.toFixed(1) : null,
        now: wNow != null ? wNow.toFixed(1) : null,
        unit: 'kg',
        delta: weightDelta,
        tone: 'neutral',
      },
    ]
  }, [measurements.data, workouts.data, signals.data, cut30, cut60, today])

  // Modo promesa — todavía no hay historia suficiente para comparar.
  if (!loading && diasConSenal < MIN_DIAS_HISTORIA) {
    const conNow = cNow.progress
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.card}>
        <EyebrowLabel tone="magenta" size={10}>
          Tu Historia
        </EyebrowLabel>
        <Text style={styles.promiseLead}>Tu historia se está escribiendo.</Text>
        <Text style={styles.promiseBody}>
          Con unas dos semanas de registros, aquí aparece tu antes y tu ahora.
        </Text>
        {conNow != null && conNow > 0 ? (
          <View style={styles.promiseAlive}>
            {/* Mismo umbral que el hero de Órbita Mes (Fase 8): bajo 8% el
                número deflaciona; cualitativo hasta que cuente historia. */}
            {Math.round(conNow) < 8 ? (
              <Text style={styles.promiseAliveText}>{signLabel} · empieza a revelarse</Text>
            ) : (
              <Text style={styles.promiseAliveText}>
                {signLabel} <Text style={styles.promiseAliveValue}>{Math.round(conNow)}%</Text>{' '}
                revelado
              </Text>
            )}
          </View>
        ) : null}
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.card}>
      <EyebrowLabel tone="magenta" size={10}>
        Tu Historia
      </EyebrowLabel>
      {/* UNA regla de lectura para toda la card (nunca más el acertijo de
          "¿23 entrenos en un mes?"). */}
      <Text style={styles.subtitle}>Estos 30 días, frente a los 30 anteriores.</Text>

      {loading ? (
        <Text style={styles.loading}>Reuniendo tu historia…</Text>
      ) : (
        <View style={styles.rows}>
          {rows.map((r, i) => (
            <View key={r.key} style={[styles.row, i > 0 && styles.rowDivider]}>
              <Text style={styles.label}>{r.label}</Text>

              <View style={styles.values}>
                <Text style={styles.before}>{r.before ?? '·'}</Text>
                <Text style={styles.arrow}>→</Text>
                <Text style={styles.now} numberOfLines={1}>
                  {r.now ?? '·'}
                  {r.now != null && r.unit ? <Text style={styles.unit}> {r.unit}</Text> : null}
                  {r.now != null && r.suffix ? (
                    <Text style={styles.suffix}> {r.suffix}</Text>
                  ) : null}
                </Text>
              </View>

              {r.delta ? (
                <View style={[styles.delta, r.tone === 'neutral' && styles.deltaNeutral]}>
                  {/* La flecha respeta la DIRECCIÓN real (bug: "↑ −18 g"). Una
                      bajada se dice en calma — flecha ↓ en tono neutro (niebla),
                      nunca rojo ni alarma (Apple Trends + manifiesto). */}
                  <Text
                    style={[
                      styles.deltaText,
                      (r.tone === 'neutral' || !r.delta.up) && styles.deltaTextNeutral,
                    ]}
                  >
                    {r.tone === 'growth' ? (r.delta.up ? '↑ ' : '↓ ') : ''}
                    {r.delta.text}
                  </Text>
                </View>
              ) : (
                <View style={styles.deltaSpacer} />
              )}
            </View>
          ))}
          {/* Ante una baja de la métrica más cuidada: observación en
              pregunta (forma canónica del manifiesto), jamás receta ni
              alarma. Responde el "¿y esto qué significa?" que la tabla
              sola no puede. */}
          {rows.find((r) => r.key === 'proteina')?.delta?.up === false ? (
            <Text style={styles.coachNote}>
              Tu proteína bajó estos 30 días. ¿Cambió algo en tus comidas?
            </Text>
          ) : null}
        </View>
      )}
    </Animated.View>
  )
}

const DELTA_W = 74

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  subtitle: {
    marginTop: 5,
    marginBottom: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // Nota del coach al pie (solo ante una baja) — serif italic, en calma.
  coachNote: {
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.oroHairlineSoft,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.bone,
  },
  loading: {
    paddingVertical: 18,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // Modo promesa — voz del coach arriba, mecánica en UI abajo.
  promiseLead: {
    marginTop: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  promiseBody: {
    marginTop: 6,
    marginBottom: 14,
    fontFamily: typography.ui,
    fontSize: typography.sizes.caption,
    lineHeight: 18,
    color: colors.niebla,
  },
  promiseAlive: {
    alignSelf: 'flex-start',
    marginBottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.oroHairline,
  },
  promiseAliveText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    letterSpacing: 0.2,
    color: colors.bone,
  },
  promiseAliveValue: {
    fontFamily: typography.uiBold,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  rows: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.oroHairlineSoft,
  },
  label: {
    width: 104,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    letterSpacing: 0.2,
    color: colors.niebla,
  },
  values: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  // El pasado: tenue. El contraste con el presente luminoso ES la evidencia.
  before: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  arrow: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.oro,
  },
  // El presente: brillante. Es donde el ojo aterriza.
  now: {
    flexShrink: 1,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.heading,
    letterSpacing: -0.3,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  suffix: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  // Delta de crecimiento — chip oro tenue con flecha (más = evidencia).
  delta: {
    width: DELTA_W,
    alignItems: 'flex-end',
  },
  deltaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.caption,
    letterSpacing: 0.2,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  // Peso: sin juicio de "bueno/malo" — el delta va en tono neutro.
  deltaNeutral: {},
  deltaTextNeutral: {
    color: colors.niebla,
  },
  deltaSpacer: {
    width: DELTA_W,
  },
})
