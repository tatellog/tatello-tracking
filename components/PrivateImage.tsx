/*
 * Una foto guardada en un bucket privado (fotos de comidas, avatares): pide su
 * enlace firmado y la pinta. Mientras el enlace llega, muestra `fallback` (o
 * nada) en el mismo lugar, así el layout no brinca.
 */
import type { ReactNode } from 'react'
import { Image, type ImageStyle, type StyleProp } from 'react-native'

import { type PrivateBucket, useSignedStorageUrl } from '@/lib/storage/signed-url'

type Props = {
  bucket: PrivateBucket
  path: string
  style: StyleProp<ImageStyle>
  resizeMode?: 'cover' | 'contain'
  fallback?: ReactNode
  onError?: () => void
}

export function PrivateImage({
  bucket,
  path,
  style,
  resizeMode = 'cover',
  fallback = null,
  onError,
}: Props) {
  const uri = useSignedStorageUrl(bucket, path)
  if (!uri) return <>{fallback}</>
  return <Image source={{ uri }} style={style} resizeMode={resizeMode} onError={onError} />
}
