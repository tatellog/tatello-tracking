import { useEffect, useState } from 'react'
import { Text, type TextProps } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'

/*
 * Un número que llega a su valor al aparecer (como Fitness): ~0.7 s, ease-out,
 * con los decimales fijos. Reduce-motion: el valor final de una.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 700,
  ...rest
}: { value: number; decimals?: number; duration?: number } & TextProps) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(reduce ? value : 0)
  useEffect(() => {
    if (reduce) {
      setShown(value)
      return
    }
    let raf = 0
    const start = Date.now()
    const tick = () => {
      const k = Math.min(1, (Date.now() - start) / duration)
      const eased = 1 - Math.pow(1 - k, 3)
      setShown(value * eased)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, reduce])
  return <Text {...rest}>{shown.toFixed(decimals)}</Text>
}
