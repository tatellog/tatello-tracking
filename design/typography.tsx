import type { ReactNode } from 'react'
import { Text, type TextProps } from 'react-native'

/*
 * Typography primitives — the single mechanism for rendering text in screens.
 *
 *   Display    — serif, 72px.  Hero numbers (streak day count).
 *   Headline   — serif, 28px.  Section heads ('sábado').
 *   Title      — serif, 34px.  Feature numbers (delta '−1.8 kg', '76.2').
 *   Body       — sans, 15px.   Paragraph text (pattern message).
 *   Prose      — serif italic. Conversational UI (button labels).
 *   Editorial  — serif italic, 13px. Section whispers ('una nota para ti').
 *   Meta       — sans uppercase tracked, 11px. Machine labels ('día', 'peso').
 *   Caption    — sans, 11px.   Plain tiny text.
 *
 * `className` is merged after the base — callers can override color or size.
 * Dynamic type is allowed up to 1.3× on display-sized variants to avoid
 * layout break at extreme sizes; body remains fully scalable.
 *
 * Note: React Native loads each font weight/style as its own family, so
 * italic uses `font-serif-italic` (Fraunces_400Regular_Italic) instead of
 * the CSS `italic` property.
 */

type Props = TextProps & { children: ReactNode }

function mergeClass(base: string, extra: string | undefined): string {
  return extra ? `${base} ${extra}` : base
}

export function Display({ className, children, ...rest }: Props) {
  return (
    <Text
      maxFontSizeMultiplier={1.3}
      className={mergeClass('font-serif text-6xl text-primary', className)}
      {...rest}
    >
      {children}
    </Text>
  )
}

export function Headline({ className, children, ...rest }: Props) {
  return (
    <Text
      maxFontSizeMultiplier={1.3}
      className={mergeClass('font-serif text-2xl text-primary', className)}
      {...rest}
    >
      {children}
    </Text>
  )
}

export function Title({ className, children, ...rest }: Props) {
  return (
    <Text
      maxFontSizeMultiplier={1.3}
      className={mergeClass('font-serif text-3xl text-primary', className)}
      {...rest}
    >
      {children}
    </Text>
  )
}

export function Body({ className, children, ...rest }: Props) {
  return (
    <Text className={mergeClass('text-base leading-relaxed text-primary', className)} {...rest}>
      {children}
    </Text>
  )
}

export function Prose({ className, children, ...rest }: Props) {
  return (
    <Text className={mergeClass('font-serif-italic text-base text-primary', className)} {...rest}>
      {children}
    </Text>
  )
}

export function Editorial({ className, children, ...rest }: Props) {
  return (
    <Text className={mergeClass('font-serif-italic text-sm text-tertiary', className)} {...rest}>
      {children}
    </Text>
  )
}

export function Meta({ className, children, ...rest }: Props) {
  return (
    <Text
      className={mergeClass('text-xs uppercase tracking-editorial text-tertiary', className)}
      {...rest}
    >
      {children}
    </Text>
  )
}

export function Caption({ className, children, ...rest }: Props) {
  return (
    <Text className={mergeClass('text-xs text-tertiary', className)} {...rest}>
      {children}
    </Text>
  )
}
