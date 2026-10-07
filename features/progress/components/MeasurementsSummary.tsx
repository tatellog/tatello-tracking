import * as Haptics from 'expo-haptics'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { colors, typography } from '@/theme'

import type { BodyCheckin } from '../api'
import { checkinTable } from '../logic'
import { CountUp } from './CountUp'
import { HealthCardHeader } from './HealthCardHeader'
import {
  CalendarGlyph,
  DropGlyph,
  DumbbellGlyph,
  FatGlyph,
  ListGlyph,
  ScaleGlyph,
} from './HealthGlyphs'

/*
 * Mediciones · Resumen (dueña 7 oct 2026: "que la usuaria quiera revisarla",
 * estilo Fitness/Salud). Arriba, tu última medición en cuatro mosaicos (peso,
 * grasa, músculo, agua): ícono de su categoría, número que cuenta y cuánto
 * cambió contra la medición anterior que tenía ese dato; tocar abre su detalle.
 * Debajo, el historial: una fila por fecha con sus números clave; tocarla la
 * despliega con todo lo medido ese día, agrupado, y la opción de editarla.
 * La tabla del coach (expediente) sigue en la otra pestaña.
 */

type TileKey = 'weight_kg' | 'body_fat_pct' | 'muscle_kg' | 'water_pct'
type Tile = {
  key: TileKey
  label: string
  unit: string
  deltaUnit: string
  color: string
  icon: (color: string) => ReactNode
  detail: string
}

const TILES: Tile[] = [
  {
    key: 'weight_kg',
    label: 'Peso',
    unit: 'kg',
    deltaUnit: 'kg',
    color: colors.magenta,
    icon: (c) => <ScaleGlyph size={16} color={c} />,
    detail: '/weight-trend',
  },
  {
    key: 'body_fat_pct',
    label: 'Grasa',
    unit: '%',
    deltaUnit: 'puntos',
    color: colors.signal.grasa,
    icon: (c) => <FatGlyph size={16} color={c} />,
    detail: '/metric/grasa',
  },
  {
    key: 'muscle_kg',
    label: 'Músculo',
    unit: 'kg',
    deltaUnit: 'kg',
    color: colors.dimension.cuerpo,
    icon: (c) => <DumbbellGlyph size={16} color={c} />,
    detail: '/metric/musculo',
  },
  {
    key: 'water_pct',
    label: 'Agua',
    unit: '%',
    deltaUnit: 'puntos',
    color: colors.signal.agua,
    icon: (c) => <DropGlyph size={16} color={c} />,
    detail: '/metric/agua',
  },
]

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDay = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
const fmtShort = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`
const fmtNum = (v: number) => (v % 1 === 0 ? String(v) : v.toFixed(1))
const SOURCE_LABEL: Record<string, string> = { manual: 'Manual', coach: 'Coach' }

export function MeasurementsSummary({
  checkins,
  onEdit,
  onOpen,
}: {
  checkins: readonly BodyCheckin[]
  onEdit: (c: { day: string; source: string }) => void
  onOpen: (route: string) => void
}) {
  const sorted = useMemo(
    () => [...checkins].sort((a, b) => (a.measured_on < b.measured_on ? -1 : 1)),
    [checkins],
  )
  const table = useMemo(() => checkinTable(sorted), [sorted])
  const latest = sorted[sorted.length - 1]
  const [open, setOpen] = useState<string | null>(null)

  if (!latest) return null

  // Cada mosaico: el último valor de ESA métrica y el anterior que la tenía.
  const tiles = TILES.flatMap((t) => {
    const withValue = sorted.filter((c) => typeof c[t.key] === 'number')
    const last = withValue[withValue.length - 1]
    if (!last) return []
    const prev = withValue[withValue.length - 2] ?? null
    return [{ t, last, prev }]
  })

  const newestFirst = [...sorted].reverse()

  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeIn.duration(320)} style={styles.card}>
        <HealthCardHeader
          icon={<CalendarGlyph color={colors.oroSoft} />}
          title="Última medición"
          color={colors.oroSoft}
          right={`${fmtDay(latest.measured_on)} · ${SOURCE_LABEL[latest.source] ?? latest.source}`}
        />
        <View style={styles.grid}>
          {tiles.map(({ t, last, prev }, i) => {
            const value = last[t.key] as number
            const delta = prev ? Math.round((value - (prev[t.key] as number)) * 10) / 10 : null
            return (
              <Animated.View
                key={t.key}
                entering={FadeInDown.duration(380).delay(80 + i * 70)}
                style={styles.tileWrap}
              >
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {})
                    onOpen(t.detail)
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.label}, ${fmtNum(value)} ${t.unit}. Ver detalle`}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <View style={styles.tile}>
                    <View style={styles.tileHead}>
                      {t.icon(t.color)}
                      <Text style={[styles.tileLabel, { color: t.color }]}>{t.label}</Text>
                    </View>
                    <View style={styles.tileValueRow}>
                      <CountUp
                        value={value}
                        decimals={value % 1 === 0 ? 0 : 1}
                        style={styles.tileValue}
                      />
                      <Text style={styles.tileUnit}>{t.unit}</Text>
                    </View>
                    <Text style={styles.tileDelta} numberOfLines={1}>
                      {delta == null
                        ? 'Primera medición'
                        : delta === 0
                          ? 'Sin cambio'
                          : `${delta > 0 ? '↑' : '↓'} ${fmtNum(Math.abs(delta))} ${t.deltaUnit}`}
                    </Text>
                    {prev ? (
                      <Text style={styles.tileStale}>{`vs ${fmtShort(prev.measured_on)}`}</Text>
                    ) : null}
                    {last.measured_on !== latest.measured_on ? (
                      <Text
                        style={styles.tileStale}
                      >{`Medido el ${fmtShort(last.measured_on)}`}</Text>
                    ) : null}
                  </View>
                </Pressable>
              </Animated.View>
            )
          })}
        </View>
      </Animated.View>

      <View style={styles.listHead}>
        <ListGlyph color={colors.bone} />
        <Text style={styles.listTitle}>Historial</Text>
        <Text style={styles.listCount}>{`${sorted.length} mediciones`}</Text>
      </View>

      <Animated.View layout={LinearTransition.duration(240)} style={styles.list}>
        {newestFirst.map((c, i) => {
          const id = `${c.measured_on}-${c.source}`
          const isOpen = open === id
          const colIdx = table.cols.findIndex(
            (col) => col.day === c.measured_on && col.source === c.source,
          )
          const keyNums = [
            c.weight_kg != null ? `${fmtNum(c.weight_kg)} kg` : null,
            c.body_fat_pct != null ? `grasa ${fmtNum(c.body_fat_pct)} %` : null,
            c.muscle_kg != null ? `músculo ${fmtNum(c.muscle_kg)} kg` : null,
          ].filter(Boolean)
          return (
            <Animated.View
              key={id}
              entering={FadeIn.duration(240).delay(Math.min(i, 8) * 40)}
              layout={LinearTransition.duration(240)}
              style={i > 0 && styles.rowDivider}
            >
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {})
                  setOpen(isOpen ? null : id)
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={`Medición del ${fmtDay(c.measured_on)}`}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <View style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowDate}>{fmtDay(c.measured_on)}</Text>
                    <Text style={styles.rowNums} numberOfLines={1}>
                      {keyNums.join('  ·  ') || (SOURCE_LABEL[c.source] ?? c.source)}
                    </Text>
                  </View>
                  <Chevron open={isOpen} />
                </View>
              </Pressable>

              {isOpen && colIdx >= 0 ? (
                <Animated.View entering={FadeIn.duration(260)} style={styles.detail}>
                  {table.groups.map((g) => {
                    const rows = g.rows.filter((r) => r.values[colIdx] != null)
                    if (rows.length === 0) return null
                    return (
                      <View key={g.title} style={styles.group}>
                        <View style={styles.groupHead}>
                          <GroupIcon title={g.title} />
                          <Text style={[styles.groupTitle, { color: groupColor(g.title) }]}>
                            {g.title}
                          </Text>
                        </View>
                        {rows.map((r) => (
                          <View key={r.key} style={styles.detailRow}>
                            <Text style={styles.detailLabel}>{r.label}</Text>
                            <Text style={styles.detailValue}>
                              {`${fmtNum(r.values[colIdx] as number)}${r.unit ? ` ${r.unit}` : ''}`}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )
                  })}
                  <View style={styles.detailFoot}>
                    <Text
                      style={styles.caption}
                    >{`Fuente: ${SOURCE_LABEL[c.source] ?? c.source}`}</Text>
                    <Pressable
                      onPress={() => onEdit({ day: c.measured_on, source: c.source })}
                      accessibilityRole="button"
                      hitSlop={8}
                    >
                      <Text style={styles.edit}>Editar</Text>
                    </Pressable>
                  </View>
                </Animated.View>
              ) : null}
            </Animated.View>
          )
        })}
      </Animated.View>
    </View>
  )
}

/** Chevron que gira al desplegar (como las filas de Salud). */
function Chevron({ open }: { open: boolean }) {
  const reduce = useReducedMotion()
  const r = useSharedValue(open ? 1 : 0)
  useEffect(() => {
    r.value = reduce ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: 220 })
  }, [open, reduce, r])
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 90}deg` }] }))
  return <Animated.Text style={[styles.chevron, style]}>›</Animated.Text>
}

function groupColor(title: string): string {
  if (title === 'Músculo') return colors.dimension.cuerpo
  if (title === 'Grasa') return colors.signal.grasa
  return colors.magenta
}

function GroupIcon({ title }: { title: string }) {
  const color = groupColor(title)
  if (title === 'Músculo') return <DumbbellGlyph size={14} color={color} />
  if (title === 'Grasa') return <FatGlyph size={14} color={color} />
  return <ScaleGlyph size={14} color={color} />
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: { borderRadius: 20, backgroundColor: colors.bgCard, padding: 16, gap: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tileWrap: { width: '48%', flexGrow: 1 },
  tile: { borderRadius: 16, backgroundColor: colors.bgCard2, padding: 12, gap: 4, minHeight: 104 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: { fontFamily: typography.uiBold, fontSize: typography.sizes.label },
  tileValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  tileValue: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.macroNum,
    letterSpacing: -0.8,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  tileUnit: { fontFamily: typography.uiBold, fontSize: typography.sizes.body, color: colors.bone },
  tileDelta: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  tileStale: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
  pressed: { opacity: 0.7 },
  listHead: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  listTitle: {
    flex: 1,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
  },
  listCount: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  list: { borderRadius: 20, backgroundColor: colors.bgCard, overflow: 'hidden' },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  rowText: { flex: 1, gap: 2 },
  rowDate: { fontFamily: typography.uiBold, fontSize: typography.sizes.ui, color: colors.leche },
  rowNums: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  chevron: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.headingLg,
    color: colors.niebla,
  },
  detail: { paddingHorizontal: 16, paddingBottom: 14, gap: 12 },
  group: { gap: 2 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  groupTitle: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  detailLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  detailValue: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  detailFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  caption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  edit: { fontFamily: typography.uiBold, fontSize: typography.sizes.body, color: colors.magenta },
})
