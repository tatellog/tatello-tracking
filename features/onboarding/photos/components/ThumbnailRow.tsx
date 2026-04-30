import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

type Props = {
  /** 1-indexed step the user is currently on. 1 means "first slot active". */
  currentStep: number
}

type SlotState = 'done' | 'active' | 'pending'

/*
 * Four-slot status strip placed alongside the capture button. Done
 * slots get the mauve gradient and a tick; the active slot is mauve-
 * tinted with a solid mauve border; pending slots are muted with a
 * dashed border that says "to do".
 */
export function ThumbnailRow({ currentStep }: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4].map((n) => {
        const state: SlotState = n < currentStep ? 'done' : n === currentStep ? 'active' : 'pending'
        return <Slot key={n} state={state} />
      })}
    </View>
  )
}

function Slot({ state }: { state: SlotState }) {
  if (state === 'done') {
    return (
      <View style={styles.slotDone}>
        <LinearGradient
          colors={[colors.mauveLight, colors.mauveDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.checkText}>✓</Text>
      </View>
    )
  }
  if (state === 'active') {
    return <View style={styles.slotActive} />
  }
  return <View style={styles.slotPending} />
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  slotDone: {
    width: 26,
    height: 32,
    borderRadius: 5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotActive: {
    width: 26,
    height: 32,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.mauveDeep,
    backgroundColor: 'rgba(168, 94, 124, 0.15)',
  },
  slotPending: {
    width: 26,
    height: 32,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderColor: colors.borderDashed,
    backgroundColor: colors.pearlMuted,
  },
  checkText: {
    fontFamily: typography.uiSemi,
    fontSize: 14,
    color: colors.pearlBase,
  },
})
