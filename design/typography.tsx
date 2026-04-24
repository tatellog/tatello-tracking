import type { ReactNode } from 'react'
import { Text, type TextProps } from 'react-native'

/*
 * Typography primitives — the single mechanism for rendering text in screens.
 *
 *   Display    — Fraunces Medium, 72px. Hero numbers/words (streak count).
 *   Headline   — Fraunces Regular, 28px. Section heads ('sábado').
 *   Title      — Fraunces Regular, 34px. Feature numbers (delta '−1.8 kg').
 *   Body       — Geist Regular, 15px.  Paragraph text (pattern message).
 *   Prose      — Fraunces Italic, 15px. Conversational UI (button labels).
 *   Editorial  — Fraunces Italic, 13px. Section whispers ('una nota para ti').
 *   Meta       — Geist Medium uppercase tracked, 11px. Machine labels.
 *   Caption    — Geist Regular, 11px.  Plain tiny text.
 *
 * `className` is merged after the base — callers can override color or size.
 * Dynamic type is allowed up to 1.3× on display-sized variants to avoid
 * layout break at extreme sizes; body remains fully scalable.
 *
 * Font weight mapping approximates the optical-size axis we'd otherwise get
 * from Fraunces variable (opsz). Display uses 500 for more presence at big
 * sizes; smaller sizes use 400 for a lighter stroke at small caps.
 *
 * React Native loads each weight/style as its own family, so italic uses the
 * dedicated `font-serif-italic` family (not the CSS `italic` property).
 */

type Props = TextProps & { children: ReactNode }

function mergeClass(base: string, extra: string | undefined): string {
  return extra ? `${base} ${extra}` : base
}

export function Display({ className, children, ...rest }: Props) {
  return (
    <Text
      maxFontSizeMultiplier={1.3}
      className={mergeClass('font-serif-medium text-6xl text-primary', className)}
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
    <Text
      className={mergeClass('font-sans text-base leading-relaxed text-primary', className)}
      {...rest}
    >
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
      className={mergeClass(
        'font-sans-medium text-xs uppercase tracking-editorial text-tertiary',
        className,
      )}
      {...rest}
    >
      {children}
    </Text>
  )
}

export function Caption({ className, children, ...rest }: Props) {
  return (
    <Text className={mergeClass('font-sans text-xs text-tertiary', className)} {...rest}>
      {children}
    </Text>
  )
}
