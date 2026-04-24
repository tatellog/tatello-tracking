import { useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useColors } from '@/design/tokens'
import { Body, Editorial, Headline, Meta, Prose } from '@/design/typography'
import { supabase } from '@/lib/supabase'

type Status = 'idle' | 'sending' | 'sent' | 'error'

/*
 * Magic-link entry point. The user types an email, we call
 * signInWithOtp, and Supabase emails them a deep link back into the
 * app (tracking-app://auth/callback). When they tap it the root
 * layout's useMagicLinkHandler exchanges the tokens in the URL for
 * a session, which flips useSession and redirects them to (tabs).
 *
 * This screen only owns the "send the link" half of the dance.
 */
export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const colors = useColors()

  const trimmed = email.trim()
  const canSubmit = trimmed.length > 0 && status !== 'sending'

  const onSubmit = async () => {
    if (!canSubmit) return
    setStatus('sending')
    setErrorMessage(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: 'tracking-app://auth/callback',
        shouldCreateUser: true,
      },
    })
    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
      return
    }
    setStatus('sent')
  }

  if (status === 'sent') {
    return (
      <SafeAreaView className="flex-1 bg-canvas px-6" edges={['top']}>
        <View className="flex-1 justify-center gap-4">
          <Meta>tracking-app</Meta>
          <Headline>revisá tu email</Headline>
          <Editorial>
            te mandamos un link a {trimmed}. abrilo desde el teléfono y te traemos de vuelta acá.
          </Editorial>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas px-6" edges={['top']}>
      <View className="flex-1 justify-center gap-8">
        <View className="gap-2">
          <Meta>tracking-app</Meta>
          <Headline>entrá con tu email</Headline>
          <Editorial>un link mágico. sin passwords, sin cuentas nuevas.</Editorial>
        </View>

        <View className="gap-3">
          <Meta>email</Meta>
          <TextInput
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={onSubmit}
            placeholder="tu@email.com"
            placeholderTextColor={colors.content.disabled}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            editable={status !== 'sending'}
            returnKeyType="send"
            className="rounded-md border border-muted bg-paper px-4 py-4 text-base text-primary"
          />
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          className={
            canSubmit
              ? 'items-center rounded-md bg-accent-warm px-4 py-4'
              : 'items-center rounded-md bg-raised px-4 py-4'
          }
        >
          <Prose className={canSubmit ? 'text-on-accent' : 'text-disabled'}>
            {status === 'sending' ? 'enviando...' : 'enviarme el link'}
          </Prose>
        </Pressable>

        {errorMessage && <Body className="text-accent-warm-strong">{errorMessage}</Body>}
      </View>
    </SafeAreaView>
  )
}
