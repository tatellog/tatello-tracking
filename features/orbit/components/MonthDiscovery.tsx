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
  /** Ya está "presente" este mes (la usuaria se lo quedó mirando). */
  kept?: boolean
  keeping?: boolean
  onKeep?: () => void
}

export function MonthDiscovery({ finding, onExplore, kept, keeping, onKeep }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Este mes encontré algo</Text>
      {/* La lectura (voz del coach) — el QUÉ significa, no la coincidencia cruda. */}
      <Text style={styles.lead}>{finding.phrase.lead}</Text>
      {/* La evidencia con números — claridad gratis, sin abrir nada. */}
      {finding.phrase.support ? <Text style={styles.support}>{finding.phrase.support}</Text> : null}
      <Pressable
        style={styles.cta}
        onPress={onExplore}
        accessibilityRole="button"
        accessibilityLabel="Entendamos por qué"
      >
        <Text style={styles.ctaText}>Entendamos por qué</Text>
        <Text style={styles.ctaArrow}> →</Text>
      </Pressable>

      {/* "Me lo quedo presente": compromiso suave, sin ventana ni veredicto. Solo
          Stelar recordando en qué te fijaste. No se puede "fallar". */}
      {onKeep ? (
        kept ? (
          <Text style={styles.keptNote}>✦ Presente este mes</Text>
        ) : (
          <Pressable
            style={styles.keepLink}
            onPress={onKeep}
            disabled={keeping}
            accessibilityRole="button"
            accessibilityLabel="Me lo quedo presente"
          >
            <Text style={styles.keepText}>{keeping ? 'Guardando…' : 'Me lo quedo presente'}</Text>
          </Pressable>
        )
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
  ctaArrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.bg,
  },
  keepLink: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 8 },
  keepText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
    color: colors.bone,
  },
  keptNote: {
    alignSelf: 'center',
    paddingVertical: 8,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
    color: colors.magenta,
  },
})
