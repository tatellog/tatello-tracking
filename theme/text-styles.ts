import type { TextStyle } from 'react-native'

import { typography } from './typography'

/*
 * ROLES DE TEXTO COMPUESTOS (contrato C1 · 5 jul 2026, modelo Apple).
 *
 * Apple no elige tamaño y familia por separado: elige un text style
 * (Headline, Body, Caption) que empaqueta familia + tamaño + tracking +
 * interlineado JUNTOS. Este archivo es ese mecanismo para Stelar: quien
 * construye una pantalla elige UN rol, no cuatro props.
 *
 * Reglas:
 *   · OBLIGATORIO en código nuevo; el viejo migra por superficie (C2).
 *   · El COLOR no vive aquí: es un rol aparte (ver mapeo en colors.ts).
 *     Un rol de texto + un rol de color = un elemento del sistema.
 *   · coachLine es LA ÚNICA italic del sistema (serif = voz del coach,
 *     regla canónica del manifiesto). Si algo más pide italic, la
 *     respuesta es no.
 *   · ¿Falta un rol? Se agrega AQUÍ con justificación, nunca inline.
 */
export const textStyles = {
  /** Título de pantalla — el hero tipográfico (TabHeader). Uno por vista. */
  screenTitle: {
    fontFamily: typography.displayHeavy,
    fontSize: 36,
    lineHeight: 42, // 42, no menos: la tilde de "Ó" se recorta (bug jul 2026)
    letterSpacing: -1.6,
  },
  /** Título de sección/pregunta (las preguntas de Órbita, 9.2). */
  sectionTitle: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displaySm,
    lineHeight: 30,
    letterSpacing: -0.8,
  },
  /** Título de card — presente sin competir con la sección. */
  cardTitle: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.title,
    letterSpacing: -0.3,
  },
  /** La voz del coach — Cormorant italic. LA ÚNICA italic del sistema. */
  coachLine: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    lineHeight: typography.sizes.ui * typography.lineHeight.statement,
  },
  /** Número héroe (52pt): la meta de agua, el peso en Progreso. */
  heroNumber: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.heroNum,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  /** Número de dato dentro de una card/fila (18pt, tabular). */
  statNumber: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.heading,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  /** Cuerpo de texto estándar. */
  body: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: typography.sizes.body * typography.lineHeight.body,
  },
  /** Etiqueta de UI (labels de filas, hints). */
  label: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
  },
  /** Eyebrow/overline — MAYÚSCULAS con tracking (encabezados de sección). */
  overline: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  /** Caption — la letra chica honesta (notas, leyendas, mecanismos). */
  caption: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.caption,
    lineHeight: 18,
  },
} as const satisfies Record<string, TextStyle>

export type TextStyleRole = keyof typeof textStyles
