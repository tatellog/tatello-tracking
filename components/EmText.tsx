import { Fragment } from 'react'
import { Text, type TextProps, type TextStyle } from 'react-native'

type Props = TextProps & {
  text: string
  emphasis?: string
  /** Style applied to the emphasised slice. Wrapping <Text> inherits parent style first. */
  emStyle: TextStyle | TextStyle[]
}

export function EmText({ text, emphasis, emStyle, ...rest }: Props) {
  if (!emphasis) return <Text {...rest}>{text}</Text>

  const idx = text.toLowerCase().indexOf(emphasis.toLowerCase())
  if (idx === -1) return <Text {...rest}>{text}</Text>

  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + emphasis.length)
  const after = text.slice(idx + emphasis.length)

  return (
    <Text {...rest}>
      <Fragment>
        {before}
        <Text style={emStyle}>{match}</Text>
        {after}
      </Fragment>
    </Text>
  )
}
