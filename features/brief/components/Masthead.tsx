import { View } from 'react-native'

import { Headline, Meta } from '@/design/typography'
import { formatEditorialDate } from '@/features/brief/format'

type Props = {
  dayOfWeek: string
  date: string
  time: string
  streakDays: number
}

/*
 * Masthead as book chapter: small streak marker at top, day-of-week in serif
 * headline, date + time in small caps below. Reads like 'CAPÍTULO 14 · Sábado'.
 */
export function Masthead({ dayOfWeek, date, time, streakDays }: Props) {
  return (
    <View>
      <Meta>día {streakDays}</Meta>
      <Headline className="mt-2">{dayOfWeek}</Headline>
      <Meta className="mt-2">
        {formatEditorialDate(date)} · {time}
      </Meta>
    </View>
  )
}
