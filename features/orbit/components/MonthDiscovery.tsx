import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

import type { Finding } from '../findings'

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
 */

type Props = {
  finding: Finding
  onExplore: () => void
  /** La palanca concreta que la usuaria ya se quedó como foco este mes ("cuida el
   *  agua el finde"). Si existe, la mostramos como recordatorio accionable. El
   *  "quedárselo" se hace DENTRO del chat (donde la IA aterriza la palanca). */
  keptFoco?: string
}

export function MonthDiscovery({ finding, onExplore, keptFoco }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Este mes encontré algo</Text>
      {/* La lectura (voz del coach) — el QUÉ significa, no la coincidencia cruda. */}
      <Text style={styles.lead}>{finding.phrase.lead}</Text>
      {/* La evidencia con números — claridad gratis, sin abrir nada. */}
      {finding.phrase.support ? <Text style={styles.support}>{finding.phrase.support}</Text> : null}
      {/* CTA como CONVERSACIÓN (no acción): el ✦ es la voz de Stelar; "hablémoslo"
          invita a charlar sobre el hallazgo, no a "guardar/empezar" algo. */}
      <Pressable
        style={styles.cta}
        onPress={onExplore}
        accessibilityRole="button"
        accessibilityLabel="Hablémoslo con Stelar"
      >
        <Text style={styles.ctaMark}>✦ </Text>
        <Text style={styles.ctaText}>Hablémoslo con Stelar</Text>
      </Pressable>

      {/* El foco concreto que se quedó (accionable y específico, no un gesto). */}
      {keptFoco ? (
        <Text style={styles.keptFoco}>
          <Text style={styles.keptFocoMark}>✦ Tu foco: </Text>
          {keptFoco}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 10, paddingHorizontal: 4 },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  lead: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 30,
    color: colors.leche,
  },
  support: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
  },
  cta: {
    marginTop: 6,
    backgroundColor: colors.magenta,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.bg,
  },
  ctaMark: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.bg,
  },
  keptFoco: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.leche,
  },
  keptFocoMark: { fontFamily: typography.uiBold, color: colors.magenta },
})
