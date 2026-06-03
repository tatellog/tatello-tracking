import { BlurView } from 'expo-blur'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Rect, Text as SvgText } from 'react-native-svg'

import { EmText } from '@/components/EmText'
import { colors, typography } from '@/theme'

import type { WeekObservation } from '../week-logic'

/*
 * A within-week observation, as a tappable card — same frosted-glass read
 * as PatternCard, but in the observatory's light: the accent is the
 * observation's color (a WIN burns in its dimension's color, a WATCH in
 * oro — never red). The mini week-glyph lights the days involved; tap
 * opens the detail screen.
 */

const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Seven day-bars (Mon-first); the days the observation is about burn in
 *  the accent color, the rest stay quiet. `days` are Sunday-first (0=Sun). */
function ObsWeekGlyph({ days, color }: { days: number[]; color: string }) {
  const litMon = new Set(days.map((d) => (d + 6) % 7)) // sunday-first → mon-first
  const W = 140
  const H = 46
  const BAR_W = 12
  const GAP = (W - BAR_W * 7) / 6
  const MAX = 26
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {WEEK_LABELS.map((_, i) => {
        const lit = litMon.has(i)
        const x = i * (BAR_W + GAP)
        const h = lit ? MAX : 8
        return (
          <Rect
            key={`b-${i}`}
            x={x}
            y={MAX - h + 2}
            width={BAR_W}
            height={h}
            rx={2}
            fill={lit ? color : colors.bruma}
            opacity={lit ? 1 : 0.55}
          />
        )
      })}
      {WEEK_LABELS.map((lbl, i) => {
        const lit = litMon.has(i)
        const x = i * (BAR_W + GAP) + BAR_W / 2
        return (
          <SvgText
            key={`l-${i}`}
            x={x}
            y={H - 2}
            textAnchor="middle"
            fontFamily={typography.uiBold}
            fontSize={9.5}
            fill={lit ? color : colors.niebla}
            opacity={lit ? 1 : 0.7}
          >
            {lbl}
          </SvgText>
        )
      })}
    </Svg>
  )
}

export function ObservationCard({ obs }: { obs: WeekObservation }) {
  const router = useRouter()
  const accent = obs.state === 'win' ? colors.dimension[obs.dimension] : colors.oro
  return (
    <Pressable
      style={[styles.card, { shadowColor: accent }]}
      onPress={() => router.push(`/orbit/observation/${obs.key}`)}
      accessibilityRole="button"
      accessibilityLabel={obs.title}
    >
      <BlurView intensity={22} tint="dark" style={styles.glass}>
        <View style={styles.tint} pointerEvents="none" />
        <View style={styles.left}>
          <ObsWeekGlyph days={obs.days} color={accent} />
          <Text style={styles.tag}>{obs.tag}</Text>
        </View>
        <View style={styles.right}>
          <EmText
            text={obs.title}
            emphasis={obs.emphasis}
            style={styles.title}
            emStyle={[styles.em, { color: accent }]}
          />
          <Text style={styles.detail}>{obs.detail}</Text>
        </View>
      </BlurView>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 12,
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  glass: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 18,
    borderWidth: 1,
    borderColor: colors.oroHairline,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,7,11,0.42)',
  },
  left: {
    width: 140,
    alignItems: 'flex-start',
  },
  tag: {
    marginTop: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 12.5,
    color: colors.niebla,
  },
  right: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: typography.displaySemi,
    fontSize: 20,
    lineHeight: 24,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  em: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
  },
  detail: {
    marginTop: 9,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.niebla,
  },
})
