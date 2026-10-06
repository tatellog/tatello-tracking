import { useEffect, useState } from 'react'
import { useReducedMotion } from 'react-native-reanimated'

import { subscribeStardust, type StardustPayload } from '../stardust-bus'
import { StardustCelebration } from './StardustCelebration'

/*
 * El polvo de estrellas GLOBAL (comida registrada → estrellas al emblema).
 * Vive en el (tabs) layout, después de <Tabs>, como CelebrationOverlay: así
 * las estrellas pueden salir de la tarjeta de comidas y viajar al emblema por
 * encima de todo. Solo se monta mientras corre y no bloquea toques (salvo la
 * píldora de "Stelar encontró algo"). Se omite con reduce-motion.
 */
export function StardustOverlay() {
  const reducedMotion = useReducedMotion()
  const [active, setActive] = useState<{ key: number; payload: StardustPayload } | null>(null)

  useEffect(
    () => subscribeStardust((payload) => setActive((a) => ({ key: (a?.key ?? 0) + 1, payload }))),
    [],
  )

  if (reducedMotion || !active) return null
  return (
    <StardustCelebration
      key={active.key}
      payload={active.payload}
      playKey={active.key}
      onDone={() => setActive(null)}
    />
  )
}
