import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'

import { colors, typography } from '@/theme'

import { daysAhead as computeDaysAhead, type WeekDirection } from '../week-orbit-logic'
import { StairsCinematic } from './stairs/StairsCinematic'
import { StairsClimbLoop } from './stairs/StairsClimbLoop'

/*
 * §0 · Todavía puedo + dirección — el hero de Órbita Semana (ver
 * docs/orbita-semana-spec.md §0). Lo que SOLO Semana da:
 *   (a) la VENTANA ABIERTA — los días que faltan como lienzo por delante,
 *       nunca una cuota a alcanzar (referente: el anillo de Apple "aún puedes
 *       cerrarlo hoy").
 *   (b) la DIRECCIÓN — el rumbo de la semana vs la MISMA ventana de la pasada
 *       (subiendo / sostenido / más suave), un MOVIMIENTO, no un conteo
 *       (referente: Apple Trends, flechas contra tu propio promedio, sin
 *       regaño si baja). Mes da la foto; Semana da el movimiento.
 * Sin countdown, sin cuota, sin número-a-alcanzar. Copy revisado por
 * voice-and-copy + manifesto-reviewer.
 */

/** La frase-marco (voz de coach) según dónde estás en la semana. */
function frameLine(ahead: number): string {
  if (ahead >= 5) return 'Tu semana apenas empieza.'
  if (ahead >= 2) return 'Vas a media semana.'
  if (ahead === 1) return 'Tu semana está por terminar.'
  return 'Hoy se completa tu semana.'
}

const DIR: Record<WeekDirection['state'], { word: string; color: string }> = {
  // "Subiendo" en magenta (acento de marca). "Constante"/"Más suave" en leche
  // (no niebla: el veredicto debe leerse como conclusión, no fundirse con el
  // subtexto), NUNCA rojo ni alarma — un rumbo más bajo se dice en calma
  // (manifiesto). La dirección la cuenta la esfera que construye su camino
  // (StairsClimbLoop), teñida por el estado.
  rising: { word: 'Subiendo', color: colors.magenta },
  steady: { word: 'Constante', color: colors.leche },
  softer: { word: 'Más suave', color: colors.leche },
}

function directionSubline(dir: WeekDirection, ahead: number): string {
  if (dir.state === 'rising') {
    return dir.topRise
      ? `Esta semana llevas más ${dir.topRise.label.toLowerCase()} que la pasada.`
      : 'Esta semana llevas más ritmo que la pasada.'
  }
  if (dir.state === 'steady') return 'Tu ritmo se mantiene esta semana.'
  // "Más suave" → reencuadrado a la ventana abierta, sin cuota ni regaño. El
  // domingo (sin días por delante) cierra reconociendo la forma, no en downer.
  return ahead > 0
    ? 'Vas más suave que la semana pasada. La semana sigue abierta.'
    : 'Esta semana fue más suave. Cada semana tiene su forma.'
}

export function WeekProgressHero({
  todayIso,
  direction,
}: {
  todayIso: string
  /** Rumbo vs la semana pasada, o null si no hay con qué comparar (primera
   *  semana medible) → solo se muestra la ventana abierta. */
  direction: WeekDirection | null
}) {
  const ahead = computeDaysAhead(todayIso)
  const dir = direction ? DIR[direction.state] : null
  const { width } = useWindowDimensions()
  const sceneW = Math.max(200, width - 40)
  const [showCinematic, setShowCinematic] = useState(false)

  return (
    <View style={styles.wrap}>
      {/* (a) La ventana abierta */}
      <Text style={styles.frame}>{frameLine(ahead)}</Text>
      {ahead > 0 ? (
        <Text style={styles.daysLine}>
          <Text style={styles.daysNum}>{ahead}</Text>
          {ahead === 1 ? ' día por delante' : ' días por delante'}
        </Text>
      ) : null}

      {/* (b) La dirección vs la semana pasada — la esfera que CONSTRUYE su camino
          de luz reemplaza la flecha y le da protagonismo a §0. El estado
          (rising/steady/softer) tiñe la escena. La pausa (softer) no es fracaso:
          es perspectiva. */}
      {direction && dir ? (
        <Pressable
          style={styles.dirBlock}
          onPress={() => setShowCinematic(true)}
          accessibilityRole="button"
          accessibilityLabel={`Tu semana va ${dir.word.toLowerCase()}. Toca para ver tu camino.`}
        >
          <StairsClimbLoop state={direction.state} width={sceneW} height={116} />
          <Text style={[styles.dirWord, { color: dir.color }]}>{dir.word}</Text>
          <Text style={styles.dirSub}>{directionSubline(direction, ahead)}</Text>
        </Pressable>
      ) : null}

      {/* Capa 2 · el cine full-screen del camino, al tocar la dirección. */}
      {direction ? (
        <Modal
          visible={showCinematic}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCinematic(false)}
        >
          <StairsCinematic state={direction.state} onClose={() => setShowCinematic(false)} />
        </Modal>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 24,
  },
  // Frase-marco = voz de coach → serif italic. `fontStyle: 'italic'` es
  // OBLIGATORIO junto a typography.serif (patrón canónico de la app, p.ej.
  // DayCard.vozFuture / DayPresent): sin él, iOS cae a un serif de fallback.
  frame: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 22,
    lineHeight: 28,
    color: colors.leche,
  },
  daysLine: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // El número es el dato ancla (Hanken heavy), NO el héroe: la dirección es el
  // veredicto. Por eso baja a ~anchor, para no competir ni leerse como cuota.
  daysNum: {
    fontFamily: typography.displayHeavy,
    fontSize: 22,
    color: colors.leche,
  },
  dirBlock: {
    marginTop: 18,
  },
  dirWord: {
    marginTop: 6,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.heading,
    letterSpacing: 0.2,
  },
  dirSub: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
