import type { ZodiacSign } from '@/features/tabs/zodiac/types'

import { useSoulRevealSync } from '../hooks'

/*
 * Componente sin UI: solo corre el reconciliador del Alma Celeste mientras está
 * montado (típicamente en Tab Hoy). Concilia "por día sostenido" cada vez que
 * cambian las señales del día / la racha. Móntalo SOLO cuando hay signo real
 * (perfil con fecha de nacimiento), nunca con un signo por defecto.
 */
export function SoulRevealSync({ sign }: { sign: ZodiacSign }) {
  useSoulRevealSync(sign)
  return null
}
