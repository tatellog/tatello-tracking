import { useEffect, useState } from 'react'
import { useReducedMotion } from 'react-native-reanimated'

import { CelebrateShockwave } from '@/features/home/components'

import { subscribeCelebrate } from '../celebrate-bus'

/*
 * Celebración full-screen GLOBAL — el flash dorado de "Entrené".
 *
 * Vive en el (tabs) layout, DESPUÉS de <Tabs>, así su absoluteFill cubre toda
 * la pantalla incluyendo la barra de tabs (antes se montaba dentro de Hoy y se
 * cortaba justo arriba de la tab bar — la parte de abajo quedaba sin cubrir).
 *
 * Calienta el Canvas Skia en idle (~1.2 s) para que el primer flash no llegue
 * tarde, igual que antes. Se omite por completo con reduce-motion.
 */
export function CelebrationOverlay() {
  const reducedMotion = useReducedMotion()
  const [celebrateKey, setCelebrateKey] = useState(0)
  // Warmup diferido: monta el Canvas en idle para compilar antes del 1er flash.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setReady(true), 1200)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => subscribeCelebrate(() => setCelebrateKey((k) => k + 1)), [])

  // Reduce-motion: sin flash. Antes del warmup y sin celebración aún: nada.
  if (reducedMotion || (!ready && celebrateKey === 0)) return null

  // CelebrateShockwave ya es absoluteFill + pointerEvents="none"; aquí cubre el
  // root View del layout = pantalla completa con tab bar incluida.
  return <CelebrateShockwave celebrateKey={celebrateKey} />
}
