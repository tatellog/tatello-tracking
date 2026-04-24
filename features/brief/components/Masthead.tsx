import { View } from 'react-native'

import { Headline, Meta } from '@/design/typography'

type Props = {
  dayOfWeek: string
  time: string
}

export function Masthead({ dayOfWeek, time }: Props) {
  return (
    <View>
      <Headline>{dayOfWeek.toLowerCase()}</Headline>
      <Meta className="mt-1">brief matutino · {time}</Meta>
    </View>
  )
}
