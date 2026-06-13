import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EmText } from '@/components/EmText'
import { colors, typography } from '@/theme'

import { useCycleEnabled } from '@/features/cycle/useCycleEnabled'
import { useMacroTargets } from '@/features/macros/hooks'

import { useHasAnySignals, useWeekSignals } from '../hooks'
import { buildArquetipoSemana } from '../mock'
import {
  buildEnLuzSemana,
  buildVozSemanaReal,
  buildWeekDaysReal,
  buildWeekObservations,
  buildWeekRecap,
  enLuzSentence,
} from '../week-logic'
import { EmptySegmentCard } from './EmptySegmentCard'
import { LiveDot } from './LiveDot'
import { StelarVoice } from './StelarVoice'
import { WeekConstellation } from './WeekConstellation'
import { ObservationCard } from './ObservationCard'
import { LuzStar, RecapDust, SectionDivider } from './WeekRecapArt'

/*
 * The Semana segment — "Las Órbitas". Mirrors Día's anatomy: the
 * week's archetype names the seven days at once, the constellation
 * hero places them around a luminous star with today as its own
 * little orbital system inside, the DayCard adapts to whichever day
 * is selected (today by default), and the Voz de Stelar closes the
 * week with confidence + scope. MOCK content (../mock.ts).
 */
export function WeekSegment({ onOpenDia }: { onOpenDia: () => void }) {
  // The whole week is built procedurally from the real day-of-week —
  // days, archetype, counts and prose all stay in sync regardless
  // of which day the user opens the app. JS Date.getDay() returns
  // 0 for Sunday, matching the Sunday-first template layout.
  const todayIdx = useMemo(() => new Date().getDay(), [])

  // ALWAYS real — no mock. With no signals the week simply renders its
  // honest "forming" state (every day at the dim floor, the voice says
  // the week's just starting). `hasRealData` only decides whether to
  // show the "leído por Stelar" credit, never whether the data is real.
  const { data: weekSignals } = useWeekSignals()
  // Macro targets make `alimento` deficit-aware (see deriveDimensions).
  const macros = useMacroTargets()
  const calorieTarget = macros.data?.calories ?? null
  const proteinTarget = macros.data?.protein_g ?? null
  // Gate de ciclo: sin ciclo activo, la dimensión `ciclo` no entra a las
  // notas ni a los conteos de la semana.
  const cycleEnabled = useCycleEnabled()
  const dimCtx = useMemo(
    () => ({ calorieTarget, proteinTarget, cycleEnabled }),
    [calorieTarget, proteinTarget, cycleEnabled],
  )
  const hasRealData = (weekSignals?.length ?? 0) > 0
  const days = useMemo(
    () => buildWeekDaysReal(weekSignals ?? [], todayIdx, dimCtx),
    [weekSignals, todayIdx, dimCtx],
  )
  const arquetipo = useMemo(() => buildArquetipoSemana(days, todayIdx), [days, todayIdx])
  // Voz + "En Luz" — ambos describen REPETICIONES de los días reales (PRD V1).
  const voz = useMemo(
    () => buildVozSemanaReal(weekSignals ?? [], todayIdx, dimCtx),
    [weekSignals, todayIdx, dimCtx],
  )
  const enLuz = useMemo(
    () => buildEnLuzSemana(weekSignals ?? [], todayIdx, dimCtx),
    [weekSignals, todayIdx, dimCtx],
  )

  const [selectedIdx, setSelectedIdx] = useState<number>(todayIdx)
  const { data: hasAny } = useHasAnySignals()

  // Conteo de calidad para el recap ("N de tus M días, con buena señal").
  const livedCount = arquetipo.daysRead
  const daysEnLuz = arquetipo.daysEnLuz

  // "Esta semana, en números" — this week's log totals, computed locally
  // from the same shared rules (the Día/Mes engine lives in the BE; this
  // recap is a pure read over the week's signals).
  const recap = useMemo(() => buildWeekRecap(weekSignals ?? [], todayIdx), [weekSignals, todayIdx])
  // Within-week micro-observations ("el lunes y el miércoles tu comida pasó
  // tu objetivo") — day-named facts of THIS week, deficit-aware via dimCtx.
  const observations = useMemo(
    () => buildWeekObservations(weekSignals ?? [], todayIdx, dimCtx),
    [weekSignals, todayIdx, dimCtx],
  )

  // "Lo que viene" se RETIRÓ: predecía el futuro ("el viernes suele pedir
  // más de ti") — viola el PRD de Semana ("no predicciones") y roza la
  // línea roja (anticipar fallo). Semana responde "¿qué se repitió?"
  // (pasado), no "¿qué viene?".

  // Empty-state branch: el mapa con los 7 días en silencio (signalCount 0
  // → anillos punteados), sin patrón ni voz hasta que haya registros.
  if (hasAny === false) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        <View style={styles.header}>
          <EmText
            text="tu primera semana"
            emphasis="primera semana"
            style={styles.archetype}
            emStyle={styles.archetypeEm}
          />
        </View>
        <View style={styles.diagram}>
          <WeekConstellation
            days={days.map((d) => ({ ...d, brightness: 0, archetype: '', dimEnLuz: 0, drift: 0 }))}
            selectedIdx={todayIdx}
            onSelect={() => {}}
            onOpenDia={onOpenDia}
          />
        </View>
        <EmptySegmentCard
          eyebrow="La galaxia se enciende con la data"
          body="Por ahora todos los días están en silencio. Registra desde Hoy y los días brillan según lo que pasó."
          hint="Cuando algo se repita tres días, aparece aquí lo que más repites."
        />
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {/* Header — solo el crédito honesto "leído por Stelar · N días". El
          arquetipo poético ("la semana de vaivén") se retiró: describía la
          FORMA del brillo, no respondía "¿qué se repite?" — atmósfera, no
          información. La respuesta vive en "En Luz" + la Voz, abajo. */}
      {hasRealData ? (
        <View style={styles.header}>
          <View style={styles.metaRow}>
            <LiveDot />
            <Text style={styles.meta}>
              <Text>leído por </Text>
              <Text style={styles.metaStelar}>Stelar</Text>
              <Text>{` · ${arquetipo.daysRead} días`}</Text>
            </Text>
          </View>
        </View>
      ) : null}

      {/* Hero — la constelación de los 7 días (la galaxia). Tap a un halo
          abre su HaloBubble con la info del día. */}
      <View style={styles.diagram}>
        <WeekConstellation
          days={days}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
          onOpenDia={onOpenDia}
        />
      </View>

      {/* En Luz — la RESPUESTA del PRD: el comportamiento más repetido de la
          semana (≥3 días). Solo se muestra si hay repetición real; si no,
          la Voz de abajo dice "aún no se repite nada con fuerza". */}
      {enLuz ? (
        <View style={styles.enLuz}>
          <Text style={styles.enLuzEyebrow}>Lo que más se repitió</Text>
          <View style={styles.enLuzRow}>
            <View style={[styles.enLuzDot, { backgroundColor: colors.dimension[enLuz.key] }]} />
            <Text style={[styles.enLuzLabel, { color: colors.dimension[enLuz.key] }]}>
              {enLuz.label}
            </Text>
          </View>
          <Text style={styles.enLuzCount}>{enLuzSentence(enLuz, 'semana')}</Text>
        </View>
      ) : null}

      {/* Voz de Stelar — describe REPETICIONES (PRD): "Te moviste 4 veces",
          "incluso en días sin entreno", "el registro bajó el finde". */}
      <StelarVoice
        parts={voz.parts}
        tag={todayIdx === 6 ? 'Cierre de semana' : 'Hasta ahora'}
        signature={hasRealData ? voz.signature : undefined}
      />

      {/* Esta semana, en números — the four log counts in a 2×2, with "días
          en luz" pulled out below as a quality read (not a raw count). The
          card sits in the observatory's light (oro): a faint star-dust wash,
          an oro hairline, the tiles igniting in a soft cascade. Honest:
          sleep/water recede to "—" when nothing's logged, never a 0. */}
      <View style={styles.recap}>
        <Text style={styles.recapEyebrow}>Esta semana, en números</Text>
        <View style={styles.recapCard}>
          <RecapDust />
          <View style={styles.recapGrid}>
            <Stat index={0} value={String(recap.entrenos)} label="Entrenos" />
            <Stat
              index={1}
              value={recap.sleepAvgMin != null ? (recap.sleepAvgMin / 60).toFixed(1) : '—'}
              unit={recap.sleepAvgMin != null ? 'h' : undefined}
              label="Sueño prom."
              empty={recap.sleepAvgMin == null}
            />
            <Stat index={2} value={String(recap.meals)} label="Comidas" />
            <Stat
              index={3}
              value={recap.waterAvg != null ? String(recap.waterAvg) : '—'}
              unit={recap.waterAvg != null ? 'vasos' : undefined}
              label="Agua prom."
              empty={recap.waterAvg == null}
            />
          </View>
          {/* Días con buena señal — lectura de calidad (NO "en luz", para
              no chocar con el comportamiento "En Luz" de arriba). */}
          <View style={styles.luzRow}>
            <LuzStar />
            <Text style={styles.luzText}>
              <Text style={styles.luzNum}>{daysEnLuz}</Text>
              <Text>{` de tus ${livedCount} ${livedCount === 1 ? 'día' : 'días'}, con buena señal`}</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* Lo que noté esta semana — within-week micro-observations. Each is a
          catalogued star: a WIN burns in its dimension's color (haloed), a
          WATCH in oro (no halo, never red). The eyebrow goes oro — this is
          Stelar's read, the differentiator, lifted above the gray chrome. */}
      {observations.length > 0 ? (
        <>
          <SectionDivider />
          <View style={styles.obs}>
            <Text style={styles.obsEyebrowLit}>Lo que noté esta semana</Text>
            {observations.map((o, i) => (
              <Animated.View key={o.key} entering={FadeIn.duration(420).delay(i * 90)}>
                <ObservationCard obs={o} />
              </Animated.View>
            ))}
          </View>
        </>
      ) : null}
    </Animated.View>
  )
}

/* One recap tile (half-width, 2×2) — a datum over a quiet label, igniting
 * in a soft cascade. An empty metric ("—") recedes to bruma so what's real
 * keeps the light. The optional unit rides small next to the value. */
function Stat({
  index,
  value,
  unit,
  label,
  empty,
}: {
  index: number
  value: string
  unit?: string
  label: string
  empty?: boolean
}) {
  return (
    <Animated.View entering={FadeIn.duration(380).delay(index * 80)} style={styles.stat}>
      <Text style={[styles.statValue, empty ? styles.statValueEmpty : null]}>
        {value}
        {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
  },
  // ── Header — compressed, archetype as the only hero ──────────
  header: {
    alignItems: 'center',
  },
  archetype: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 24,
    lineHeight: 30,
    color: colors.leche,
    textAlign: 'center',
  },
  archetypeEm: {
    color: colors.magenta,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  meta: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  metaStelar: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 12.5,
    color: colors.magenta,
  },
  // ── En Luz — el comportamiento más repetido (hero del PRD) ───────
  enLuz: {
    alignItems: 'center',
    marginTop: 22,
  },
  enLuzEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 10,
  },
  enLuzRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  enLuzDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  enLuzLabel: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 26,
    lineHeight: 30,
  },
  enLuzCount: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  enLuzNum: {
    fontFamily: typography.uiBold,
    color: colors.bone,
  },
  // ── Diagram — la galaxia de 7 días, centrada ──────────────────
  diagram: {
    width: '72%',
    alignSelf: 'center',
    marginTop: 10,
  },
  // ── Esta semana, en números — the recap stat grid ──────────────
  recap: {
    marginTop: 24,
  },
  recapEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 12,
    marginLeft: 2,
  },
  // The card — in the observatory's light: oro hairline, star-dust wash
  // behind (overflow-hidden clips it to the rounded corners).
  recapCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  recapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stat: {
    width: '50%',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  statValue: {
    fontFamily: typography.uiBold,
    fontSize: 24,
    color: colors.leche,
  },
  statValueEmpty: {
    color: colors.bruma,
  },
  statUnit: {
    fontFamily: typography.uiMedium,
    fontSize: 12,
    color: colors.niebla,
  },
  statLabel: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginTop: 4,
  },
  // Días en luz — its own line below the grid, divided by an oro hairline.
  luzRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 2,
    marginHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.oroHairlineSoft,
  },
  luzText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  luzNum: {
    color: colors.oroLight,
  },
  // ── Lo que noté esta semana — the micro-observation list ───────
  obs: {},
  // The differentiator's eyebrow — oro, lifted above the gray chrome.
  obsEyebrowLit: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.oro,
    marginBottom: 14,
    marginLeft: 2,
  },
})
