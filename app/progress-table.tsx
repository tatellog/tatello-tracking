import { useRouter } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import Toast from 'react-native-toast-message'

import { exportMeasurementsCsv } from '@/features/progress/export'
import { useBodyCheckins } from '@/features/progress/hooks'
import { checkinTable } from '@/features/progress/logic'
import { Sparkline } from '@/features/progress/components/Sparkline'
import { SkyBackground } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

/*
 * Tabla completa (la tabla del coach, decisión dueña · target-user) — el
 * EXPEDIENTE crudo: filas = métricas, columnas = fechas, con la historia entera
 * de un golpe de vista ("mi 66.8 de en medio es mi prueba de que sí puedo").
 *
 * Reglas de la usuaria: CERO frases dentro, sin suavizar números (el rebote se
 * ve tal cual), sin score, sin flechas por celda, sin semáforo rojo ("reprobada
 * ×4"). Etiquetas de métrica FIJAS (las columnas scrollean); la última columna
 * resaltada (la primera que busca siempre). La única mejora vs el Excel: la
 * mini-tendencia por fila. Sin marcar "zonas sanas" (rango clínico = línea roja
 * del manifiesto; el disclaimer manda al profesional).
 *
 * La tabla también es puerta de captura (decisión dueña): tocar una fecha abre
 * ESA medición en la forma de edición; el botón de abajo agrega una nueva.
 */

const LABEL_W = 112
const CELL_W = 62
const ROW_H = 40

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
// Día + mes / año en dos líneas: dos mediciones del mismo mes ("SEP 24" x2)
// eran columnas idénticas y podías editar la equivocada (uxui).
const fmtColDay = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`
const fmtColYear = (iso: string): string => iso.slice(2, 4)

const fmtCell = (v: number | null): string => {
  if (v == null) return '·'
  return v % 1 === 0 ? `${v}` : v.toFixed(1)
}

export default function ProgressTableScreen() {
  const router = useRouter()
  const { data, isPending, isError, refetch } = useBodyCheckins()
  const table = useMemo(() => checkinTable(data ?? []), [data])
  const lastIdx = table.cols.length - 1
  const railRef = useRef<ScrollView>(null)

  const openCheckin = (col: { day: string; source: string }) =>
    router.push({ pathname: '/log-checkin', params: { day: col.day, source: col.source } })

  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      await exportMeasurementsCsv()
    } catch {
      Toast.show({
        type: 'error',
        text1: 'No pudimos preparar el archivo',
        text2: 'Intenta de nuevo.',
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Tabla completa</Text>
            <Text style={styles.sub}>Tus mediciones, tal cual · toca una fecha para editarla</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke={colors.bone}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>

        {isPending ? (
          /* Cargando NO es "no tienes nada": filas fantasma en vez del falso
             vacío (uxui: el mensaje más frío posible para una veterana). */
          <View style={styles.skeleton}>
            {Array.from({ length: 7 }, (_, i) => (
              <View key={i} style={styles.skeletonRow} />
            ))}
          </View>
        ) : isError ? (
          <View>
            <Text style={styles.empty}>No pudimos cargar tus mediciones.</Text>
            <Pressable
              onPress={() => refetch()}
              accessibilityRole="button"
              accessibilityLabel="Intentar de nuevo"
              style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.addBtnText}>Intentar de nuevo</Text>
            </Pressable>
          </View>
        ) : table.cols.length === 0 ? (
          <View>
            <Text style={styles.empty}>Aún no hay mediciones que mostrar.</Text>
            <Pressable
              onPress={() => router.push('/log-checkin')}
              accessibilityRole="button"
              accessibilityLabel="Registrar una medición completa"
              style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.addBtnText}>＋ Medición completa</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.tableRow}>
              {/* Columna FIJA de métricas (si las fechas scrollean, los nombres
                  se quedan — "si 'Peso' desaparece me pierdo en dos segundos"). */}
              <View>
                <View style={[styles.cornerCell, { height: ROW_H }]} />
                {table.groups.map((g) => (
                  <View key={g.title}>
                    <View style={[styles.groupCell, { height: ROW_H }]}>
                      <Text style={styles.groupText}>{g.title}</Text>
                    </View>
                    {g.rows.map((r) => (
                      <View key={r.key} style={[styles.labelCell, { height: ROW_H }]}>
                        <Text style={styles.labelText} numberOfLines={1}>
                          {r.label}
                          {r.unit ? <Text style={styles.labelUnit}> {r.unit}</Text> : null}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>

              {/* Columnas de fechas (scroll horizontal) + tendencia al final.
                  Arranca al FINAL: "la de ahora" es lo primero que buscas; el
                  peek parcial queda del lado del pasado. */}
              <ScrollView
                ref={railRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                onContentSizeChange={() => railRef.current?.scrollToEnd({ animated: false })}
              >
                <View>
                  {/* Encabezado de fechas — la última es "la de ahora"; tocar
                      una abre esa medición para editarla. El ancho vive en el
                      View (mismo estilo que las celdas de valores: header y
                      columnas no pueden divergir); el Pressable solo rellena. */}
                  <View style={[styles.valuesRow, { height: ROW_H }]}>
                    {table.cols.map((c, i) => (
                      <View
                        key={`${c.day}-${c.source}`}
                        style={[styles.cell, i === lastIdx && styles.cellNow, { height: ROW_H }]}
                      >
                        <Pressable
                          onPress={() => openCheckin(c)}
                          hitSlop={{ top: 4, bottom: 4 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Editar la medición del ${c.day}`}
                          style={({ pressed }) => [styles.headPress, pressed && { opacity: 0.6 }]}
                        >
                          <Text style={[styles.headText, i === lastIdx && styles.headTextNow]}>
                            {fmtColDay(c.day)}
                          </Text>
                          <Text style={[styles.headYear, i === lastIdx && styles.headTextNow]}>
                            {fmtColYear(c.day)}
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                    <View style={[styles.sparkCell, { height: ROW_H }]} />
                  </View>

                  {table.groups.map((g) => (
                    <View key={g.title}>
                      <View style={{ height: ROW_H }} />
                      {g.rows.map((r) => (
                        <View
                          key={r.key}
                          style={[styles.valuesRow, { height: ROW_H }]}
                          accessible
                          accessibilityLabel={`${r.label}: ${r.values.map((v) => fmtCell(v)).join(', ')}${r.unit ? ` ${r.unit}` : ''}`}
                        >
                          {r.values.map((v, i) => (
                            <View
                              key={`${r.key}-${table.cols[i]?.day}-${table.cols[i]?.source}`}
                              style={[
                                styles.cell,
                                i === lastIdx && styles.cellNow,
                                { height: ROW_H },
                              ]}
                            >
                              <Text style={[styles.cellText, i === lastIdx && styles.cellTextNow]}>
                                {fmtCell(v)}
                              </Text>
                            </View>
                          ))}
                          {/* La mejora vs el Excel: hacia dónde va la fila. */}
                          <View style={[styles.sparkCell, { height: ROW_H }]}>
                            {r.spark.length >= 2 ? (
                              <Sparkline
                                data={r.spark}
                                hue={colors.oroSoft}
                                width={44}
                                height={14}
                                style={{ marginTop: 0 }}
                              />
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>

            <Pressable
              onPress={() => router.push('/log-checkin')}
              accessibilityRole="button"
              accessibilityLabel="Registrar una medición completa"
              style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.addBtnText}>＋ Medición completa</Text>
            </Pressable>

            {/* Propiedad: la puerta de salida abierta es la confianza para
                quedarse. Mata las "cinco capturas incómodas refunfuñando". */}
            <Pressable
              onPress={() => void handleExport()}
              accessibilityRole="button"
              accessibilityLabel="Exportar esta tabla como archivo"
              style={({ pressed }) => [styles.exportLink, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.exportLinkText}>
                {exporting ? 'Preparando tu archivo…' : 'Esta tabla es tuya · exportar →'}
              </Text>
            </Pressable>

            <Text style={styles.disclaimer}>
              Stelar solo interpreta tus registros. No sustituye a un profesional de la salud.
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.5,
  },
  sub: {
    marginTop: 2,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  empty: {
    marginTop: 30,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    textAlign: 'center',
  },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  tableRow: { flexDirection: 'row' },
  cornerCell: { width: LABEL_W },
  groupCell: { width: LABEL_W, justifyContent: 'flex-end', paddingBottom: 6 },
  groupText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  labelCell: {
    width: LABEL_W,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  labelText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  labelUnit: { color: colors.niebla, fontSize: typography.sizes.micro },
  valuesRow: { flexDirection: 'row' },
  // flexShrink 0 + minWidth: blindaje contra celdas encogidas (el header de la
  // captura de la dueña salió amontonado; header y valores comparten ESTE
  // estilo para que no puedan divergir).
  cell: {
    width: CELL_W,
    minWidth: CELL_W,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  // "La de ahora": la columna que siempre busca primero.
  cellNow: { backgroundColor: colors.oroTint },
  headPress: { flex: 1, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'flex-end' },
  headText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.4,
    color: colors.niebla,
    textTransform: 'uppercase',
  },
  headYear: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 0.4,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  headTextNow: { color: colors.oroLeche },
  cellText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  cellTextNow: { fontFamily: typography.uiBold, color: colors.oroLeche },
  sparkCell: { width: 56, justifyContent: 'center', alignItems: 'center' },
  addBtn: {
    marginTop: 22,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  addBtnText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  exportLink: { marginTop: 14, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 8 },
  exportLinkText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    letterSpacing: 0.2,
  },
  // Filas fantasma mientras carga (nunca el falso "no tienes nada").
  skeleton: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  skeletonRow: {
    height: ROW_H - 8,
    borderRadius: 10,
    backgroundColor: colors.bgCard,
    opacity: 0.6,
  },
  // Discreto y centrado: no compite con el botón de captura (uxui).
  disclaimer: {
    marginTop: 14,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    textAlign: 'center',
  },
})
