import { useEffect, useRef, useState } from 'react'

type Options = {
  /** Total duration in ms. Default 1400. */
  duration?: number
  /** Delay before the count starts, in ms. Default 200. */
  startDelay?: number
  /** Decimals to show (matches the target's intrinsic precision by default). */
  decimals?: number | 'auto'
  /** When true, the counter ignores `target` and shows nothing. */
  paused?: boolean
}

/*
 * Norte count-up — ease-out cubic, requestAnimationFrame-based.
 *
 *   const value = useCountUp('75', { duration: 1400 })
 *
 * Equivalente al `useCounter` del prototype HTML. El valor regresado
 * es un string para preservar precisión decimal (.toFixed(decimals)).
 * Pasar `paused = true` (p.e. cuando el usuario empieza a escribir)
 * detiene la animación y deja el `target` literal en pantalla.
 */
export function useCountUp(target: string | number | null, opts: Options = {}): string {
  const { duration = 1400, startDelay = 200, decimals = 'auto', paused = false } = opts
  const [value, setValue] = useState<string>('0')
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (paused || target === null || target === '') {
      // El consumer toma control — devolvemos el target literal y
      // cancelamos cualquier rAF pendiente.
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
      // ease-out cubic: 1 − (1 − p)³
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
