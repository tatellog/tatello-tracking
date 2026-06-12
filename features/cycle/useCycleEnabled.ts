import { useProfile } from '@/features/profile/hooks'

import { isCycleActive } from './phase'

/*
 * ¿Este perfil tiene ciclo? — la regla de negocio única (cycle-gate.ts)
 * leída desde el perfil. `false` para hombres y para mujeres sin
 * menstruación activa (embarazo, postmenopausia, "no tengo ciclo").
 *
 * Mientras el perfil carga devuelve `false`: preferimos ocultar primero
 * y aparecer después, nunca mostrar ciclo y quitarlo en un parpadeo.
 */
export function useCycleEnabled(): boolean {
  const { data: profile } = useProfile()
  return isCycleActive(profile?.biological_sex, profile?.cycle_situation)
}
