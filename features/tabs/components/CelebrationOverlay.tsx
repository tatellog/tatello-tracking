import { useEffect, useState } from 'react'
import { useReducedMotion } from 'react-native-reanimated'

import { subscribeCelebrate, type CelebratePayload } from '../celebrate-bus'
import { RingCelebration } from './RingCelebration'

/*
 * Celebración full-screen GLOBAL de "Entrené" (RingCelebration: la corona de
 * chispas del anillo del emblema).
 *
 * Vive en el (tabs) layout, DESPUÉS de <Tabs>, así su absoluteFill cubre toda
 * la pantalla incluyendo la barra de tabs. Solo se monta mientras corre (≈3 s)
 * y se desmonta sola; tocar la pantalla la cierra. Se omite con reduce-motion.
 */
export function CelebrationOverlay() {
  const reducedMotion = useReducedMotion()
  const [active, setActive] = useState<{ key: number; payload: CelebratePayload } | null>(null)

  useEffect(
    () => subscribeCelebrate((payload) => setActive((a) => ({ key: (a?.key ?? 0) + 1, payload }))),
    [],
  )

  if (reducedMotion || !active) return null
  return (
    <RingCelebration
      key={active.key}
      payload={active.payload}
      playKey={active.key}
      onDone={() => setActive(null)}
    />
  )
}
