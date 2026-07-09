import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

import type { ChatBubble } from '../month-chat'

/*
 * Piezas compartidas de la antesala de Órbita Mes IA:
 *   · StelarSpeaks — la apertura como ENCABEZADO (título + subtítulo), no chat.
 *   · StelarStar — la estrella emisora ✦ (firma de Stelar), reusada en el
 *     header del detalle.
 */

/* ── Apertura: "Stelar habla" (título + subtítulo) ───────────────────── */

export function StelarSpeaks({ bubbles }: { bubbles: readonly ChatBubble[] }) {
  const title = bubbles[0]?.text ?? ''
  const subtitle = bubbles[1]?.text ?? ''
  const caption = bubbles[2]?.text ?? ''
  return (
    <View style={styles.intro}>
      <View style={styles.introBrandRow}>
        <StelarStar size={16} />
        <Text style={styles.introBrand}>STELAR · leyendo tu cielo</Text>
      </View>
      {title ? <Text style={styles.introTitle}>{title}</Text> : null}
      {subtitle ? <Text style={styles.introSubtitle}>{subtitle}</Text> : null}
      {caption ? <Text style={styles.introCaption}>{caption}</Text> : null}
    </View>
  )
}

/* ── La estrella emisora (asset stelar-voice-star, inline para tinte) ─── */

export const StelarStar = memo(function StelarStar({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={11} fill={colors.oroVect} opacity={0.05} />
      <Circle cx={12} cy={12} r={7.5} fill={colors.oroVect} opacity={0.1} />
      <Path
        d="M12 5 Q12.7 10.4 17 12 Q12.7 13.6 12 19 Q11.3 13.6 7 12 Q11.3 10.4 12 5 Z"
        fill={colors.oroVect}
      />
      <Path d="M17.4 5.4 L18.6 6.9 L17.4 8.4 L16.2 6.9 Z" fill={colors.oroVect} opacity={0.65} />
      {/* Núcleo cálido fijo — punto de luz vivo (pintura de escena del asset). */}
      {/* eslint-disable-next-line no-restricted-syntax */}
      <Circle cx={12} cy={11.7} r={1.5} fill="#FFF6E5" />
    </Svg>
  )
})

const styles = StyleSheet.create({
  intro: { gap: 8 },
  introBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  introBrand: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.oroSoft,
  },
  introTitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.displaySm,
    lineHeight: 30,
    color: colors.leche,
  },
  introSubtitle: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.ui,
    lineHeight: 22,
    color: colors.bone,
  },
  introCaption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    marginTop: 2,
  },
})
