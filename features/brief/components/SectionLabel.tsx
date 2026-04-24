import type { ReactNode } from 'react'
import { Text } from 'react-native'

type Props = {
  children: ReactNode
}

export function SectionLabel({ children }: Props) {
  return (
    <Text className="text-xs uppercase tracking-widest text-tertiary">{children}</Text>
  )
}
