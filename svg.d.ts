declare module '*.svg' {
  import type { FC } from 'react'
  import type { SvgProps } from 'react-native-svg'
  const content: FC<SvgProps>
  export default content
}

declare module '*.png' {
  const content: number
  export default content
}
declare module '*.jpg' {
  const content: number
  export default content
}
declare module '*.jpeg' {
  const content: number
  export default content
}
