import { Redirect, Stack } from 'expo-router'

import { useDevAllowed } from '@/components/withDevGuard'

/*
 * Gatea la subárbol dev (lista + detalle de signos): solo dev / is_dev. No
 * navegable por deep-link en producción para una usuaria normal. Las
 * pantallas manejan su propio DevBackButton, así que headerShown=false.
 */
export default function DevEmblemSignsLayout() {
  const allowed = useDevAllowed()
  if (allowed === null) return null
  if (!allowed) return <Redirect href="/" />
  return <Stack screenOptions={{ headerShown: false }} />
}
