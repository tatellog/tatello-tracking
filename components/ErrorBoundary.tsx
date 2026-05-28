import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { supabase } from '@/lib/supabase'
import { colors, radius, spacing, typography } from '@/theme'

/*
 * ErrorBoundary — last-resort crash protection. If any descendant
 * throws during render / lifecycle, we swallow the exception, show
 * a calm Stelar-themed fallback, and (best-effort) log the error
 * to public.error_logs.
 *
 * Beta-grade: NOT a full observability layer. No retries with
 * backoff, no Sentry, no breadcrumbs. Just enough to stop a single
 * crash from kicking a user out of the app.
 *
 * Per-tab usage: each tab file wraps its exported screen with this
 * boundary (passing `screen={tabName}`) so a crash in Hoy doesn't
 * take Mes / Progreso / Comidas with it. The root boundary in
 * app/_layout.tsx is the global net for everything outside the tabs
 * (auth, onboarding, modal sheets).
 */

type Props = { children: ReactNode; screen: string }
type State = { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Fire-and-forget log. Wrap in a promise so any failure
    // (offline, RLS, schema drift) can't re-throw into the
    // boundary's own lifecycle.
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const userId = data.session?.user?.id
        if (!userId) return // pre-auth crashes: no owner, skip
        await supabase.from('error_logs').insert({
          user_id: userId,
          error_message: error.message || 'unknown error',
          stack: error.stack ?? info.componentStack ?? null,
          screen: this.props.screen,
        })
      } catch {
        // Logging must NEVER throw — it would loop the boundary.
      }
    })()
  }

  handleReset = () => this.setState({ hasError: false })

  override render() {
    if (!this.state.hasError) return this.props.children
    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          Algo se desalineó por un momento. Tu información está a salvo.
        </Text>
        <Pressable
          onPress={this.handleReset}
          accessibilityRole="button"
          accessibilityLabel="Volver a tu cielo"
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonLabel}>Volver a tu cielo</Text>
        </Pressable>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.s5,
  },
  message: {
    fontFamily: typography.serif,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    textAlign: 'center',
    lineHeight: typography.sizes.headingLg * typography.lineHeight.statement,
    maxWidth: 320,
    marginBottom: spacing.s5,
  },
  button: {
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.s5,
    paddingVertical: spacing.s3,
  },
  buttonPressed: { opacity: 0.6 },
  buttonLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    letterSpacing: typography.letterSpacing.uppercaseTight,
  },
})
