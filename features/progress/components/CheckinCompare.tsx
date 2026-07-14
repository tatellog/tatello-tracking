import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

import type { PhotoAngle } from '../api'
import { PROGRESS_EVENTS } from '../constants'
import { useBodyCheckins, usePhotoTimeline } from '../hooks'
import { compareCheckins, compareSynthesis, photoNear, type CheckinDeltaKey } from '../logic'
import { BeforeAfterSlider } from './BeforeAfterSlider'

/*
 * Comparador rápido (rediseño · feedback usuaria: "útil pero confunde y cansa;
 * mi única victoria escondida entre mis derrotas"):
 *
 * 1. La SÍNTESIS honesta va PRIMERO ("Subió tu peso y tu grasa. También ganaste
 *    músculo: no empiezas de cero") — separa hechos duros de rescates. Las seis
 *    flechas idénticas se leían como "fallaste×6".
 * 2. Fechas como DOS PILLS compactas (Antes ▾ → Después ▾); tocar una despliega
 *    solo sus fechas. Las dos filas de 8 chips eran "un acertijo, no un
 *    comparador".
 * 3. TRES métricas primero (peso/grasa/músculo: el norte, su lectura y la
 *    esperanza) + "Ver más" para agua/visceral/IMC. 26 números cansaban a la
 *    fila 3.
 * 4. Tabla MONOCROMA, deltas en oro: los 6 colores eran "confeti en un funeral"
 *    (decoración que parecía significado — visceral subiendo en verde).
 * 5. Sin párrafo-eco (repetía la tabla). El disclaimer se queda.
 */

const LABEL: Record<CheckinDeltaKey, { name: string; unit: string }> = {
  weight_kg: { name: 'Peso', unit: 'kg' },
  body_fat_pct: { name: 'Grasa corporal', unit: '%' },
  muscle_kg: { name: 'Músculo', unit: 'kg' },
  water_pct: { name: 'Agua', unit: '%' },
  visceral_fat_index: { name: 'Visceral (índice)', unit: '' },
  bmi: { name: 'IMC', unit: '' },
}

/** El norte, su lectura y la esperanza — lo que la usuaria lee de verdad. */
const PRIMARY: CheckinDeltaKey[] = ['weight_kg', 'body_fat_pct', 'muscle_kg']

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDay = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`

const ANGLES: { key: PhotoAngle; label: string }[] = [
  { key: 'front', label: 'Frente' },
  { key: 'back', label: 'Espalda' },
  { key: 'side_left', label: 'Perfil izq' },
  { key: 'side_right', label: 'Perfil der' },
]

const fmtVal = (v: number, unit: string) =>
  `${v % 1 === 0 ? v : v.toFixed(1)}${unit ? ` ${unit}` : ''}`

/**
 * Fusión "detalle de medición" (decisión benchmark): NO hay pantalla de detalle
 * de una fecha — tocar una estrella del timeline preselecciona esa fecha AQUÍ
 * (vs la última). Misma necesidad, siempre en lenguaje de cambio.
 */
export function CheckinCompare({ presetA }: { presetA?: string | null }) {
  const { data } = useBodyCheckins()
  const photosQ = usePhotoTimeline()
  const photos = useMemo(() => photosQ.data ?? [], [photosQ.data])
  const checkins = useMemo(() => data ?? [], [data])
  const dates = useMemo(() => checkins.map((c) => c.measured_on), [checkins])

  const [dayA, setDayA] = useState<string | null>(null)
  const [dayB, setDayB] = useState<string | null>(null)
  const [picking, setPicking] = useState<'a' | 'b' | null>(null)
  const [photoAngle, setPhotoAngle] = useState<PhotoAngle | null>(null)
  // Recencia = jerarquía: con la última medición vieja (>90 días), el
  // comparador colapsa a su header por default — que el scroll del domingo no
  // termine en "+5.3 kg" de hace un año (peak-end · benchmark). Tocar una
  // estrella del historial lo abre.
  const [openStale, setOpenStale] = useState(false)
  const router = useRouter()

  // El timeline preselecciona el "antes" (esa fecha vs la última) y abre la
  // sección si estaba colapsada.
  useEffect(() => {
    if (presetA) {
      setDayA(presetA)
      setDayB(null)
      setPicking(null)
      setOpenStale(true)
    } else {
      // El padre limpió el preset (salida del segmento): vuelve el default.
      setDayA(null)
      setDayB(null)
    }
  }, [presetA])

  // Default: medición ANTERIOR → actual ("¿qué cambió desde la última vez que
  // me medí?", el ancla de Apple/YAZIO). Primera→última respondía lo que ya
  // responde el hero, y con un rebote en medio servía "mejor momento vs peor
  // momento" de bienvenida (benchmark + target-user).
  const a = dayA && dates.includes(dayA) ? dayA : dates[dates.length - 2]
  const b = dayB && dates.includes(dayB) ? dayB : dates[dates.length - 1]

  if (checkins.length < 2 || !a || !b || a === b) return null

  const checkinA = checkins.find((c) => c.measured_on === a)!
  const checkinB = checkins.find((c) => c.measured_on === b)!
  const rows = compareCheckins(checkinA, checkinB)
  if (rows.length === 0) return null

  // Última medición vieja → colapsado por default.
  const lastDay = checkins[checkins.length - 1]?.measured_on
  const stale =
    lastDay != null &&
    Date.now() - new Date(`${lastDay}T12:00:00`).getTime() > 90 * 24 * 60 * 60 * 1000

  if (stale && !openStale) {
    return (
      <Animated.View entering={FadeIn.duration(360).delay(140)}>
        <View style={styles.divider} />
        <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
          Comparador rápido
        </EyebrowLabel>
        <Pressable
          onPress={() => setOpenStale(true)}
          accessibilityRole="button"
          accessibilityState={{ expanded: false }}
          accessibilityLabel={`Comparar ${fmtDay(a)} contra ${fmtDay(b)}`}
          style={({ pressed }) => [styles.collapsedRow, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.collapsedText}>
            {fmtDay(a)} → {fmtDay(b)}
          </Text>
          <Text style={styles.collapsedCaret}>Ver ▸</Text>
        </Pressable>
      </Animated.View>
    )
  }

  const synthesis = compareSynthesis(rows)
  // Tres métricas (el norte, su lectura y la esperanza) — el resto vive en
  // "Ver análisis detallado" y en la Tabla completa (dieta de puertas: UNA
  // entrada al detalle, no tres).
  const visible = rows.filter((r) => PRIMARY.includes(r.key))

  const pick = (side: 'a' | 'b', d: string) => {
    if (side === 'a') setDayA(d)
    else setDayB(d)
    setPicking(null)
    track(PROGRESS_EVENTS.compare, { kind: 'checkin' })
  }

  return (
    <Animated.View entering={FadeIn.duration(360).delay(140)}>
      <View style={styles.divider} />
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Comparador rápido
      </EyebrowLabel>

      {/* Fechas: dos pills. Tocar una abre SOLO sus opciones (nunca 8 chips). */}
      <View style={styles.pillRow}>
        <DatePill
          label={fmtDay(a)}
          open={picking === 'a'}
          onPress={() => setPicking(picking === 'a' ? null : 'a')}
          a11y="Cambiar la fecha inicial"
        />
        <Text style={styles.pillArrow}>→</Text>
        <DatePill
          label={fmtDay(b)}
          open={picking === 'b'}
          onPress={() => setPicking(picking === 'b' ? null : 'b')}
          a11y="Cambiar la fecha final"
        />
      </View>
      {picking ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsRow}>
          <View style={styles.options}>
            {dates
              .filter((d) => (picking === 'a' ? d !== b : d !== a))
              .map((d) => {
                const on = d === (picking === 'a' ? a : b)
                return (
                  <Pressable
                    key={d}
                    onPress={() => pick(picking, d)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.option, on && styles.optionOn]}
                  >
                    <Text style={[styles.optionText, on && styles.optionTextOn]}>{fmtDay(d)}</Text>
                  </Pressable>
                )
              })}
          </View>
        </ScrollView>
      ) : null}
      {/* Atajo a la comparación larga (la del hero), sin picker. */}
      {!picking && a !== dates[0] ? (
        <Pressable
          onPress={() => pick('a', dates[0]!)}
          accessibilityRole="button"
          accessibilityLabel="Comparar desde tu primera medición"
          style={({ pressed }) => [styles.fromStart, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.fromStartText}>Desde el inicio →</Text>
        </Pressable>
      ) : null}

      {/* La síntesis honesta PRIMERO: hechos duros + rescates, de su lado. */}
      {synthesis ? <Text style={styles.synthesis}>{synthesis}</Text> : null}

      {/* CAMBIO VISUAL: la foto ES la evidencia; los números son contexto
          (benchmark: sin esto, comparar fechas es la tabla de MFP). Un ángulo a
          la vez; solo ángulos con foto en AMBAS fechas. Auto-oculto sin fotos. */}
      <VisualChange photos={photos} a={a} b={b} angle={photoAngle} onAngle={setPhotoAngle} />

      <View style={styles.table}>
        {visible.map((r, i) => {
          const meta = LABEL[r.key]
          const arrow = r.delta === 0 ? null : r.delta > 0 ? '↑' : '↓'
          return (
            <View key={r.key} style={[styles.row, i > 0 && styles.rowDivider]}>
              <Text style={styles.rowLabel}>{meta.name}</Text>
              <View style={styles.rowValues}>
                <Text style={styles.rowA}>{fmtVal(r.a, meta.unit)}</Text>
                <Text style={styles.rowArrow}>→</Text>
                <Text style={styles.rowB}>{fmtVal(r.b, meta.unit)}</Text>
                {arrow ? (
                  <Text style={styles.rowDelta}>
                    {arrow} {r.delta > 0 ? '+' : '−'}
                    {fmtVal(Math.abs(r.delta), meta.unit)}
                  </Text>
                ) : null}
              </View>
            </View>
          )
        })}
      </View>

      {/* D · el análisis guiado determinista (la película del tráiler ✦). */}
      <Pressable
        onPress={() => {
          track(PROGRESS_EVENTS.openInsight, { from: 'compare' })
          router.push({ pathname: '/progress-analysis', params: { a, b } })
        }}
        accessibilityRole="button"
        accessibilityLabel="Ver análisis detallado"
        style={({ pressed }) => [styles.analysisCta, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.analysisCtaText}>Ver análisis detallado →</Text>
      </Pressable>

      {/* La protección del manifiesto. */}
      <Text style={styles.disclaimer}>
        Stelar solo interpreta tus registros. No sustituye a un profesional de la salud.
      </Text>
    </Animated.View>
  )
}

/** Las fotos de las dos fechas comparadas, con el slider de arrastre. Fechas
 *  como etiquetas SOBRE la foto (hechos, no "Antes/Ahora" — juicio de estado).
 *  photoNear ±3 días: la sesión de fotos del día siguiente al check-in cuenta. */
function VisualChange({
  photos,
  a,
  b,
  angle,
  onAngle,
}: {
  photos: Parameters<typeof photoNear>[0]
  a: string
  b: string
  angle: PhotoAngle | null
  onAngle: (k: PhotoAngle) => void
}) {
  // Solo ángulos con foto cerca de AMBAS fechas (contra un hueco no se compara).
  const usable = ANGLES.filter(
    (x) => photoNear(photos, x.key, a)?.signed_url && photoNear(photos, x.key, b)?.signed_url,
  )
  const active = angle && usable.some((u) => u.key === angle) ? angle : usable[0]?.key
  if (!active) return null
  const pA = photoNear(photos, active, a)!
  const pB = photoNear(photos, active, b)!

  return (
    <View style={styles.visual}>
      <Text style={styles.visualLabel}>CAMBIO VISUAL</Text>
      {usable.length > 1 ? (
        <View style={styles.visualAngles}>
          {usable.map((x) => {
            const on = x.key === active
            return (
              <Pressable
                key={x.key}
                onPress={() => onAngle(x.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.visualChip, on && styles.visualChipOn]}
              >
                <Text style={[styles.visualChipText, on && styles.visualChipTextOn]}>
                  {x.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}
      <BeforeAfterSlider
        beforeUrl={pA.signed_url!}
        afterUrl={pB.signed_url!}
        leftLabel={fmtDay(a)}
        rightLabel={fmtDay(b)}
      />
    </View>
  )
}

function DatePill({
  label,
  open,
  onPress,
  a11y,
}: {
  label: string
  open: boolean
  onPress: () => void
  a11y: string
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ expanded: open }}
      style={[styles.pill, open && styles.pillOpen]}
    >
      <Text style={styles.pillText}>{label}</Text>
      <Text style={[styles.pillCaret, open && styles.pillCaretOpen]}>▾</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', marginVertical: 28 },
  eyebrow: { marginBottom: 12 },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard2,
  },
  pillOpen: { borderColor: colors.magentaGlow, backgroundColor: colors.magentaTint },
  pillText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  pillCaret: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
  pillCaretOpen: { color: colors.magentaHot },
  pillArrow: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.oro,
  },
  optionsRow: { marginTop: 8 },
  options: { flexDirection: 'row', gap: 6 },
  fromStart: { alignSelf: 'flex-start', paddingVertical: 6, marginTop: 2 },
  fromStartText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    letterSpacing: 0.2,
  },
  option: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bruma,
  },
  optionOn: { backgroundColor: colors.magentaTint2, borderColor: colors.magentaGlow },
  optionText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  optionTextOn: { color: colors.magentaHot, fontFamily: typography.uiBold },
  // La frase de su lado — voz del coach, antes de cualquier número.
  synthesis: {
    marginTop: 14,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 24,
    color: colors.leche,
  },
  table: {
    marginTop: 14,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  row: { paddingVertical: 11 },
  rowDivider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  // Monocromo: labels niebla, números leche, delta ORO — un solo lenguaje.
  rowLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 5,
  },
  rowValues: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  rowA: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.ui,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  rowArrow: { fontFamily: typography.uiMedium, fontSize: typography.sizes.body, color: colors.oro },
  rowB: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.anchor,
    color: colors.leche,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  rowDelta: {
    marginLeft: 'auto',
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  visual: { marginTop: 16 },
  visualLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.6,
    color: colors.niebla,
    marginBottom: 10,
  },
  visualAngles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  visualChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard2,
  },
  visualChipOn: { backgroundColor: colors.magentaTint2, borderColor: colors.magentaGlow },
  visualChipText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  visualChipTextOn: { color: colors.magentaHot },
  // Fila colapsada (datos viejos): las fechas como resumen, a un tap.
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  collapsedText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  collapsedCaret: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  analysisCta: {
    marginTop: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.magentaTint,
    borderWidth: 1.5,
    borderColor: colors.magentaGlow,
  },
  analysisCtaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.magentaHot,
  },
  disclaimer: {
    marginTop: 10,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
})
