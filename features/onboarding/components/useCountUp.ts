import { useEffect, useRef, useState } from 'react'

type Options = {
  duration?: number
  startDelay?: number
  decimals?: number | 'auto'
  /** When true the hook releases control and shows `target` literal. */
  paused?: boolean
}

/**
 * requestAnimationFrame-based count-up with ease-out cubic.
 *
 *   const value = useCountUp('75', { duration: 1400 })
 *
 * Returned as a string to preserve decimal precision (`toFixed`).
 */
export function useCountUp(target: string | number | null, opts: Options = {}): string {
  const { duration = 1400, startDelay = 200, decimals = 'auto', paused = false } = opts
  const [value, setValue] = useState<string>('0')
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (paused || target === null || target === '') {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      setValue(target === null ? '0' : String(target))
      return
    }

    const targetStr = String(target)
    const num = parseFloat(targetStr)
    if (!Number.isFinite(num)) {
      setValue(targetStr)
      return
    }

    const dec =
      decimals === 'auto'
        ? targetStr.includes('.')
          ? (targetStr.split('.')[1]?.length ?? 0)
          : 0
        : decimals

    const start = performance.now() + startDelay

    const tick = (t: number) => {
      if (t < start) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue((num * eased).toFixed(dec))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration, startDelay, decimals, paused])

  return value
}
