import { useRouter } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import Toast from 'react-native-toast-message'

import { exportMeasurementsCsv, exportMeasurementsPdf } from '@/features/progress/export'
import { useBodyCheckins } from '@/features/progress/hooks'
import { checkinTable } from '@/features/progress/logic'
import { LinkCta } from '@/features/progress/components/LinkCta'
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
// Respiro entre grupos, más alto que una fila (aire asimétrico estilo
// grouped-list: generoso antes del eyebrow). AMBOS lados lo comparten.
const GROUP_H = 52

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

  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null)
  const handleExport = async (kind: 'pdf' | 'csv') => {
    if (exporting) return
    setExporting(kind)
    try {
      const result = kind === 'pdf' ? await exportMeasurementsPdf() : await exportMeasurementsCsv()
      if (result === 'empty') {
        Toast.show({ type: 'info', text1: 'Aún no hay mediciones que exportar' })
      } else if (result === 'unavailable') {
        // Solo pasa en Expo Go (dev): el módulo nativo vive en la build.
        Toast.show({
          type: 'info',
          text1: 'El PDF no está disponible en Expo Go',
          text2: 'En la app instalada sí. Por ahora, usa CSV.',
        })
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'No pudimos preparar el archivo',
        text2: 'Intenta de nuevo.',
      })
    } finally {
      setExporting(null)
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
            <View style={styles.addBtnWrap}>
              <Pressable
                onPress={() => refetch()}
                accessibilityRole="button"
                accessibilityLabel="Intentar de nuevo"
                style={({ pressed }) => pressed && { opacity: 0.7 }}
              >
                <View style={styles.addBtn}>
                  <Text style={styles.addBtnText}>Intentar de nuevo</Text>
                </View>
              </Pressable>
            </View>
          </View>
        ) : table.cols.length === 0 ? (
          <View>
            <Text style={styles.empty}>Aún no hay mediciones que mostrar.</Text>
            <View style={styles.addBtnWrap}>
              <Pressable
                onPress={() => router.push('/log-checkin')}
                accessibilityRole="button"
                accessibilityLabel="Registrar una nueva medición"
                style={({ pressed }) => pressed && { opacity: 0.7 }}
              >
                <View style={styles.addBtn}>
                  <Text style={styles.addBtnText}>＋ Nueva medición</Text>
                </View>
              </Pressable>
            </View>
            {/* Quien llega con historial del coach no debe teclearlo. */}
            <View style={styles.emptyImportWrap}>
              <LinkCta
                label="Importar de foto o PDF →"
                onPress={() => router.push('/import-measurements')}
                accessibilityLabel="Importar mediciones desde una foto o PDF"
              />
            </View>
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
                    <View style={[styles.groupCell, { height: GROUP_H }]}>
                      <Text style={styles.groupText}>{g.title}</Text>
                    </View>
                    {g.rows.map((r, ri) => {
                      // Jerarquía de ESTRUCTURA (no de valor): en Músculo y
                      // Grasa la fila Total es la que se escanea; los
                      // segmentos bajan un tono.
                      const segment =
                        (g.title === 'Músculo' || g.title === 'Grasa') && r.label !== 'Total'
                      return (
                        <View
                          key={r.key}
                          style={[
                            styles.labelCell,
                            { height: ROW_H },
                            ri % 2 === 1 && styles.zebra,
                          ]}
                        >
                          <Text
                            style={[styles.labelText, segment && styles.labelTextSegment]}
                            numberOfLines={1}
                          >
                            {r.label}
                            {r.unit ? <Text style={styles.labelUnit}> {r.unit}</Text> : null}
                          </Text>
                        </View>
                      )
                    })}
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
                  <View style={[styles.valuesRow, styles.headerRow, { height: ROW_H }]}>
                    {table.cols.map((c, i) => (
                      <View
                        key={`${c.day}-${c.source}`}
                        style={[
                          styles.cell,
                          i === lastIdx && styles.cellNow,
                          i === lastIdx && styles.cellNowCap,
                          { height: ROW_H },
                        ]}
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
                      {/* El respiro de grupo repite las FECHAS atenuadas (a
                          media tabla ya no sabías qué columna era cuál) y
                          mantiene la banda dorada CONTINUA. Sin Pressable:
                          solo el header real edita. */}
                      <View style={[styles.valuesRow, { height: GROUP_H }]}>
                        {table.cols.map((c, i) => (
                          <View
                            key={`ghost-${g.title}-${c.day}-${c.source}`}
                            style={[
                              styles.cell,
                              styles.ghostCell,
                              i === lastIdx && styles.cellNow,
                              { height: GROUP_H },
                            ]}
                          >
                            <Text style={styles.ghostDate}>{fmtColDay(c.day)}</Text>
                          </View>
                        ))}
                        <View style={[styles.sparkCell, { height: GROUP_H }]} />
                      </View>
                      {g.rows.map((r, ri) => (
                        <View
                          key={r.key}
                          style={[
                            styles.valuesRow,
                            { height: ROW_H },
                            ri % 2 === 1 && styles.zebra,
                          ]}
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
                              {/* Un hueco no debe brillar como un dato. */}
                              <Text
                                style={[
                                  styles.cellText,
                                  i === lastIdx && styles.cellTextNow,
                                  v == null && styles.cellEmpty,
                                ]}
                              >
                                {fmtCell(v)}
                              </Text>
                            </View>
                          ))}
                          {/* La mejora vs el Excel: la línea es historia, el
                              nodo encendido es hoy (rima con la columna oro). */}
                          <View style={[styles.sparkCell, { height: ROW_H }]}>
                            {r.spark.length >= 2 ? (
                              <Sparkline
                                data={r.spark}
                                hue={colors.oroSoft}
                                width={44}
                                height={14}
                                style={{ marginTop: 0 }}
                                endNode
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

            {/* Quirk-safe (View con layout + Pressable adentro): el label es
                "Nueva medición", consistente con el CTA del tab (una puerta). */}
            <View style={styles.addBtnWrap}>
              <Pressable
                onPress={() => router.push('/log-checkin')}
                accessibilityRole="button"
                accessibilityLabel="Registrar una nueva medición"
                style={({ pressed }) => pressed && { opacity: 0.7 }}
              >
                <View style={styles.addBtn}>
                  <Text style={styles.addBtnText}>＋ Nueva medición</Text>
                </View>
              </Pressable>
            </View>

            {/* Propiedad: la puerta de salida abierta es la confianza para
                quedarse. PDF con el layout de la tabla del coach (pedido
                dueña) + CSV para hojas de cálculo. */}
            <Text style={styles.exportCaption}>
              {exporting ? 'Preparando tu archivo…' : 'Esta tabla es tuya'}
            </Text>
            {/* Entrada Y salida bajo el mismo techo: la tabla del coach
                entra por foto/PDF (scan-measurements) y sale por PDF/CSV. */}
            <View style={styles.exportRow}>
              <LinkCta
                label="Importar de foto o PDF →"
                onPress={() => router.push('/import-measurements')}
                accessibilityLabel="Importar mediciones desde una foto o PDF"
              />
            </View>
            <View style={styles.exportRow}>
              <LinkCta
                label="Exportar PDF →"
                onPress={() => void handleExport('pdf')}
                accessibilityLabel="Exportar esta tabla como PDF"
              />
              <LinkCta
                label="CSV →"
                onPress={() => void handleExport('csv')}
                accessibilityLabel="Exportar esta tabla como CSV"
              />
            </View>

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
  // Segmentos un tono abajo (estructura, no juicio): Total es la fila héroe.
  labelTextSegment: { color: colors.niebla },
  // Zebra al mínimo visible (0.03): seguir la fila a través del rail sin
  // convertir el expediente en hoja de cálculo.
  zebra: { backgroundColor: 'rgba(244,236,222,0.03)' },
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
  // Cap cálido de 1px en el header: la columna se enciende desde arriba.
  cellNowCap: { borderTopColor: colors.oroHairline },
  // El header es la TAPA de la tabla, no una fila más.
  headerRow: { borderBottomWidth: 1, borderBottomColor: 'rgba(244,236,222,0.10)' },
  // Fechas fantasma del respiro de grupo: orientación, no interacción.
  ghostCell: { justifyContent: 'flex-end', paddingBottom: 6 },
  ghostDate: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.niebla,
    opacity: 0.6,
    fontVariant: ['tabular-nums'],
  },
  cellEmpty: { color: colors.bruma, fontFamily: typography.uiMedium },
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
  addBtnWrap: { marginTop: 22, alignSelf: 'center' },
  // El único elemento del pie con SUPERFICIE: gana sin gritar.
  addBtn: {
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  addBtnText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  // Bloque de archivo aparte (entrada/salida), no colgado del botón.
  exportCaption: {
    marginTop: 28,
    alignSelf: 'center',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  exportRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 18,
  },
  emptyImportWrap: { alignSelf: 'center', marginTop: 4 },
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
