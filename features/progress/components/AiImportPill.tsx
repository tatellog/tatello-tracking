import type { StyleProp, ViewStyle } from 'react-native'

import { AiCta } from '@/components/AiCta'

/** El acceso a "Importar de foto o PDF" con la piel IA canónica (AiCta).
 *  Un solo nombre y un solo look en todos sus hogares. */
export function AiImportPill({
  onPress,
  style,
}: {
  onPress: () => void
  style?: StyleProp<ViewStyle>
}) {
  return (
    <AiCta
      label="Importar de foto o PDF"
      onPress={onPress}
      accessibilityLabel="Importar mediciones desde una foto o PDF"
      style={style}
    />
  )
}
