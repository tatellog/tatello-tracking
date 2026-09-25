import { useEffect, useState } from 'react'

/*
 * La hora local (0-23), refrescada cada minuto. Vive en un hook chico para
 * que el paso de franja (11:59 → 12:00 para la pregunta de sueño, 19:59 →
 * 20:00 para el cierre) re-renderice solo a quien la lee, nunca el árbol
 * pesado de la constelación.
 */
export function useLocalHour(): number {
  const [hour, setHour] = useState(() => new Date().getHours())
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000)
    return () => clearInterval(id)
  }, [])
  return hour
}
