/*
 * Contrato "esto fue un registro" para las mutations de React Query.
 *
 * Las mutations que escriben un registro del día (comida, agua, ánimo, sueño)
 * declaran `meta: logMeta('agua')`. Quien quiera REACCIONAR a cualquier
 * registro (V-13 Hero vivo: el emblema de Hoy) se suscribe al mutation cache
 * y lee esta meta — sin que features/water tenga que conocer al hero ni
 * importar un bus de features/tabs. La meta viaja con la mutation; el
 * reactor decide qué hacer con ella.
 *
 * `guard` acota los casos donde el éxito de la mutation NO es un registro
 * "hacia arriba" (bajar un vaso de agua también es un `useSetWater` exitoso):
 *   - 'glasses-up': variables es el total nuevo; cuenta solo si supera
 *     context.prev (el snapshot optimista del hook).
 *   - 'delta-up':   variables.delta > 0.
 * Sin guard, todo éxito cuenta.
 */

export type LogKind = 'comida' | 'agua' | 'animo' | 'sueno'

export type LogGuard = 'glasses-up' | 'delta-up'

export const LOG_META_KEY = 'log' as const
export const LOG_GUARD_KEY = 'logGuard' as const

export type LogMeta = {
  [LOG_META_KEY]: LogKind
  [LOG_GUARD_KEY]?: LogGuard
}

export function logMeta(kind: LogKind, guard?: LogGuard): LogMeta {
  return guard ? { [LOG_META_KEY]: kind, [LOG_GUARD_KEY]: guard } : { [LOG_META_KEY]: kind }
}
