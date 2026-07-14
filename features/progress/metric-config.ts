import { colors } from '@/theme'

/*
 * Config de las 6 métricas de composición (Epic 08 · F1) — compartida por
 * /body-composition (cards) y /metric/[key] (detalle). Hue = identidad de la
 * métrica (mismo color suba o baje, nunca verde/rojo).
 *
 * Los explainers son CONTEXTO COTIDIANO (nunca médico/alarmista): visceral e
 * IMC no llevan rangos ni "zonas sanas" (línea roja del manifiesto); su
 * detalle solo explica qué son y para qué sirve mirarlos en el tiempo.
 */

export type MetricKey = 'peso' | 'grasa' | 'musculo' | 'agua' | 'visceral' | 'imc'

export const METRIC_KEYS: MetricKey[] = ['peso', 'grasa', 'musculo', 'agua', 'visceral', 'imc']

export const METRIC_CONFIG: Record<
  MetricKey,
  { label: string; unit: string; hue: string; question: string; explainer: string | null }
> = {
  peso: {
    label: 'Peso',
    unit: 'kg',
    hue: colors.oroSoft,
    question: 'Hacia dónde va, sin el ruido del día',
    explainer: null,
  },
  grasa: {
    label: 'Grasa corporal',
    unit: '%',
    hue: colors.signal.proteina,
    question: 'De tu primera a tu última medición',
    explainer: null,
  },
  musculo: {
    label: 'Músculo',
    unit: 'kg',
    hue: colors.dimension.cuerpo,
    question: 'Lo que tu cuerpo construye con el tiempo',
    explainer: null,
  },
  agua: {
    label: 'Agua corporal',
    unit: '%',
    hue: colors.signal.agua,
    question: 'La que se mueve todos los días',
    explainer:
      'El agua sube y baja con el ciclo, la sal y el entreno. Cuando el peso salta de un día a otro, casi siempre es agua.',
  },
  visceral: {
    label: 'Grasa visceral',
    unit: '',
    hue: colors.magentaHot,
    question: 'La que no se ve en el espejo',
    explainer:
      'La grasa visceral es la que vive alrededor de tus órganos. Este índice viene de tu báscula de composición; sirve para ver su dirección con el tiempo, no para diagnosticar nada.',
  },
  imc: {
    label: 'IMC',
    unit: '',
    hue: colors.oroSoft,
    question: 'Solo contexto',
    explainer:
      'El IMC solo cruza tu peso con tu estatura. No distingue músculo de grasa, así que cuenta poco de ti. Está aquí como contexto, nada más.',
  },
}
