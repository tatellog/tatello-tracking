import { useState } from 'react'
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

import {
  FINDING_ARC_LABEL,
  FINDING_ARC_STEPS,
  findingArcIndex,
  type FindingArcStage,
} from '../finding-arc'
import type { Finding } from '../findings'
import { CardAura, CtaStar, FindingGlyph, SealDivider } from './discovery-ornaments'

/*
 * MonthDiscovery — el lead-in de Órbita Mes (rediseño jul 2026).
 *
 * Reemplaza el loop de experimentos (seguir/cerrar/medir/veredicto), que exponía
 * la maquinaria de un laboratorio y generaba culpa ("lo cerraste muy pronto").
 * Aquí solo INVITAMOS: el hallazgo principal del motor como evidencia serena
 * (la lectura + los números) y UN CTA que abre la conversación con la IA.
 *
 * La inteligencia NO se pierde: el chat recibe el mismo `Finding` del motor
 * (lectura, evidencia, contrapunto, hipótesis, conexión con el objetivo). "El
 * motor piensa, la IA comunica" — aquí el motor deja la puerta, la IA la abre.
 *
 * Arte (jul 2026, uxui + illustrator): la card dejó de ser texto plano sobre
 * negro. El glifo firma el hallazgo (estrellas que se conectan), el aura la
 * enciende sobre el cosmos sin encajonarla, el número es DATO (no pie de página)
 * y el CTA es una puerta iluminada. Cuando no hay palanca, un sello cierra con
 * dignidad en vez de cortarse de golpe.
 */

type Props = {
  finding: Finding
  onExplore: () => void
  /** Ya abriste la conversación de este hallazgo (hay transcript guardado). El
   *  CTA deja de INVITAR ("hablémoslo") y ofrece RETOMAR lo ya hablado: pedir
   *  charlar de nuevo, cuando ya lo hiciste, se sentía a que Stelar no recuerda. */
  talked?: boolean
  /** El arco de evidencia (V-10): estado derivado del pipeline (motor
   *  determinístico, SIN ✦). null = no mostrar (p. ej. compute-local sin
   *  hipótesis ni historia con qué derivarlo). */
  arcStage?: FindingArcStage | null
}

export function MonthDiscovery({ finding, onExplore, talked = false, arcStage = null }: Props) {
  // Ya hablado → retomar la charla guardada (se rehidrata al instante), no invitar.
  const ctaLabel = talked ? 'Retomar con Stelar' : 'Hablémoslo con Stelar'

  // Mide la card para pintar el aura detrás (halo, no panel).
  const [size, setSize] = useState({ w: 0, h: 0 })
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    if (Math.abs(width - size.w) > 1 || Math.abs(height - size.h) > 1)
      setSize({ w: width, h: height })
  }

  // El número como DATO (no pie de página): el motor ya lo da estructurado en
  // `metric` ("12 de 24"). Lo partimos para dominar el "12" y atenuar el "/24".
  const statParts = finding.metric.value.split(' de ')
  const hasStat = statParts.length === 2

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <CardAura width={size.w} height={size.h} />

      {/* Eyebrow firmado por el glifo del hallazgo (estrellas que se conectan). */}
      <View style={styles.eyebrowRow}>
        <FindingGlyph size={15} />
        <Text style={styles.eyebrow}>Estas semanas encontré algo</Text>
      </View>

      {/* La lectura (voz del coach) como HÉROE — el QUÉ significa, la conclusión. */}
      <Text style={styles.lead}>{finding.phrase.lead}</Text>

      {/* La evidencia como DATO: el "12" domina, "/24" atenuado, la etiqueta al lado. */}
      {hasStat ? (
        <View style={styles.statRow}>
          <Text style={styles.statNum}>{statParts[0]}</Text>
          <Text style={styles.statTotal}> / {statParts[1]}</Text>
          <Text style={styles.statLabel}>{finding.metric.label}</Text>
        </View>
      ) : finding.phrase.support ? (
        <Text style={styles.support}>{finding.phrase.support}</Text>
      ) : null}

      {/* El arco de evidencia (V-10): observado → encontrado → en seguimiento
          → confirmado. Estado DERIVADO del pipeline, mostrado llano (evidencia,
          no logro); jamás lleva ✦ — el motor no se disfraza de IA. */}
      {arcStage ? <FindingArcRow stage={arcStage} /> : null}

      {/* CTA como CONVERSACIÓN (no acción): la ✦ oro es un umbral iluminado (la
          voz de Stelar), no un ícono pegado. Invita la primera vez; una vez
          hablado, RETOMA (Stelar recuerda). */}
      <Pressable
        style={styles.cta}
        onPress={onExplore}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
      >
        <CtaStar />
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </Pressable>

      {/* La PALANCA del motor (accionable, específica). Si no hay, un SELLO cierra
          la card con dignidad en vez de cortarse tras el CTA. */}
      {finding.lever ? (
        <Text style={styles.keptFoco}>
          <Text style={styles.keptFocoMark}>✦ Tu foco: </Text>
          {finding.lever}
        </Text>
      ) : (
        <View style={styles.seal}>
          <SealDivider />
        </View>
      )}
    </View>
  )
}

/* El arco como camino de 4 pasos: puntos unidos por un hairline, lo andado
 * encendido en oro suave, el paso activo con su nombre. Discreto a propósito:
 * es una línea de estado, no una barra de progreso que presiona. */
function FindingArcRow({ stage }: { stage: FindingArcStage }) {
  const active = findingArcIndex(stage)
  return (
    <View style={styles.arcWrap} accessibilityLabel={`Estado: ${FINDING_ARC_LABEL[stage]}`}>
      <View style={styles.arcSteps}>
        {FINDING_ARC_STEPS.map((step, i) => (
          // El primer paso no crece (solo su punto); los demás estiran su
          // línea para repartir el camino a lo ancho de la card.
          <View key={step} style={[styles.arcStep, i === 0 && styles.arcStepFirst]}>
            {i > 0 ? <View style={[styles.arcLine, i <= active && styles.arcLineDone]} /> : null}
            <View
              style={[
                styles.arcDot,
                i < active && styles.arcDotDone,
                i === active && styles.arcDotActive,
              ]}
            />
          </View>
        ))}
      </View>
      <Text style={styles.arcLabel}>{FINDING_ARC_LABEL[stage]}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', paddingHorizontal: 6, paddingVertical: 8 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  // Héroe: la voz del coach es la masa tipográfica dominante de la card.
  lead: {
    marginTop: 12,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    lineHeight: 30,
    color: colors.leche,
  },
  // Dato, no oración: el numeral pesa, el total se atenúa, la etiqueta acompaña.
  statRow: { marginTop: 16, flexDirection: 'row', alignItems: 'baseline' },
  statNum: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.deltaNum,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  statTotal: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.headingLg,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    marginLeft: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    letterSpacing: 0.3,
    color: colors.bone,
  },
  // Fallback si el hallazgo no expone "X de Y" (otros findings que no sean déficit).
  support: {
    marginTop: 14,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
  },
  // Puerta celeste, no botón de submit: tinte + borde magenta con glow, y la ✦
  // oro como umbral iluminado adelante. Invita, no convierte.
  cta: {
    marginTop: 22,
    backgroundColor: colors.magentaTint,
    borderWidth: 1.5,
    borderColor: colors.magentaGlow,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.magenta,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  ctaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.magentaHot,
  },
  keptFoco: {
    marginTop: 16,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.leche,
  },
  keptFocoMark: { fontFamily: typography.uiBold, color: colors.magenta },
  seal: { marginTop: 18, alignItems: 'center' },
  // ── El arco de evidencia (V-10) ──
  arcWrap: {
    marginTop: 16,
    gap: 7,
  },
  arcSteps: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arcStep: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
  },
  arcStepFirst: {
    flexGrow: 0,
  },
  arcLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairlineStrong,
    marginHorizontal: 5,
  },
  arcLineDone: {
    backgroundColor: colors.oroSoft,
  },
  arcDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1,
    borderColor: colors.bruma,
  },
  arcDotDone: {
    borderColor: colors.oroSoft,
    backgroundColor: colors.oroSoft,
  },
  arcDotActive: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderColor: colors.oroLight,
    backgroundColor: colors.oroLight,
  },
  arcLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
})
