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

const SKIP_SENTINEL = '__skip__'

/*
 * Screen 2 · Lo que te ha costado. Entrena al coach: lo que el
 * usuario marca aquí informa cómo el coach habla después. Está
 * deliberadamente *antes* de pedir datos demográficos.
 *
 * Estado:
 *   - `selected` es un array de strings (las fricciones marcadas)
 *   - "Prefiero no decir" se modela vía el sentinel `__skip__`. Al
 *     prenderlo se vacía todo lo demás; al prender cualquier otro,
 *     se quita el skip.
 *   - El CTA habilita con al menos una opción O el skip prendido.
 *
 * Persistimos a AsyncStorage al "Continuar" porque la tabla
 * `profiles` todavía no tiene columna para esto; el helper
 * `saveFrictions` está en `lib/onboardingFlags` y se reemplazará
 * por una mutación de profile cuando la columna exista.
 */
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
