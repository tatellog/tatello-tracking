import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'

import { OptionRow, StepHeader, WizardLayout } from '@/features/onboarding/components'
import { readFrictions, saveFrictions } from '@/lib/onboardingFlags'

const FRICTIONS = [
  'No me dan ganas de loguear',
  'Me obsesiono con números',
  'Me siento juzgada',
  'Pereza preparar comida',
  'No veo cambios, me frustro',
  'Recaigo en atracones',
] as const

// "Prefiero no decir" is mutually exclusive with the option list.
// Modelled as a sentinel inside the same array so persistence stays
// one shape (until `profiles` grows a column for it).
const SKIP_SENTINEL = '__skip__'

export default function FrictionsScreen() {
  const router = useRouter()
  const [selected, setSelected] = useState<readonly string[]>([])
  const [skipped, setSkipped] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    readFrictions()
      .then((fr) => {
        if (fr.includes(SKIP_SENTINEL)) {
          setSkipped(true)
          setSelected([])
        } else {
          setSelected(fr)
        }
      })
      .catch(() => {
        // Lectura best-effort — un fallo deja todo en falso/empty.
      })
  }, [])

  const toggle = (item: string) => {
    if (skipped) setSkipped(false)
    setSelected((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]))
  }

  const toggleSkip = () => {
    setSkipped((prev) => !prev)
    setSelected([])
  }

  const canContinue = skipped || selected.length > 0

  const handleContinue = async () => {
    if (!canContinue) return
    setSaving(true)
    setError(null)
    try {
      await saveFrictions(skipped ? [SKIP_SENTINEL] : selected)
      router.push('/onboarding/about-you')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar tu respuesta.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WizardLayout
      step={2}
      canContinue={canContinue}
      loading={saving}
      errorMessage={error}
      onContinue={handleContinue}
    >
      <StepHeader
        eyebrow="Antes de pedirte datos"
        eyebrowColor="magenta"
        question="¿Qué se te ha atravesado antes?"
        questionEmphasis="ha atravesado"
        hint="Esto entrena a tu coach. Mientras más honesta, mejor te lee."
      />

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {FRICTIONS.map((f) => (
          <OptionRow key={f} label={f} selected={selected.includes(f)} onPress={() => toggle(f)} />
        ))}
        <OptionRow label="Prefiero no decir" selected={skipped} onPress={toggleSkip} neutral />
      </ScrollView>
    </WizardLayout>
  )
}

const styles = StyleSheet.create({
  list: {
    marginTop: 18,
  },
  listContent: {
    paddingBottom: 8,
  },
})
