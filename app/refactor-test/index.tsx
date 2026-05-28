import { Link } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import {
  LUNAR_CONSTELLATION_STATES,
  type ConstellationState,
} from '@/features/tabs/components/__fixtures__/lunar-constellation-states'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, typography } from '@/theme'

/*
 * Refactor safety-net overview (Paso 3). Each zodiac sign collapses
 * into a row; tap to reveal its 4 deterministic states. Tap a state
 * to navigate to /refactor-test/<state-id> where the full canvas
 * renders.
 *
 * Lifetime: removed at F24.
 */

const STATE_DESCRIPTION: Record<ConstellationState['stateName'], string> = {
  empty: '0/28 · next visible',
  partial: '7/28 · next visible',
  halfway: '14/28 · committed',
  complete: '28/28 · isComplete',
}

type Group = {
  sign: ZodiacSign
  states: ConstellationState[]
}

export default function RefactorTestIndex() {
  const groups = useMemo<Group[]>(() => {
    const map = new Map<ZodiacSign, ConstellationState[]>()
    for (const state of LUNAR_CONSTELLATION_STATES) {
      const bucket = map.get(state.sign) ?? []
      bucket.push(state)
      map.set(state.sign, bucket)
    }
    return Array.from(map.entries()).map(([sign, states]) => ({ sign, states }))
  }, [])

  // Single-expand pattern — tapping a new sign collapses the previous
  // one. Multi-expand would let the list grow tall; single keeps the
  // page tidy while still being one-tap-away from any state.
  const [expanded, setExpanded] = useState<ZodiacSign | null>(null)

  return (
    <View style={styles.screen}>
      <FlatList
        data={groups}
        keyExtractor={(g) => g.sign}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <SignRow
            group={item}
            expanded={expanded === item.sign}
            onToggle={() => setExpanded(expanded === item.sign ? null : item.sign)}
          />
        )}
      />
    </View>
  )
}

function SignRow({
  group,
  expanded,
  onToggle,
}: {
  group: Group
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <View style={styles.signGroup}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.signRow}
      >
        <Text style={styles.signLabel}>{group.sign}</Text>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.stateList}>
          {group.states.map((state) => (
            <Link key={state.id} href={`/refactor-test/${state.id}`} asChild>
              <Pressable accessibilityRole="link" style={styles.stateRow}>
                <Text style={styles.stateName}>{state.stateName}</Text>
                <Text style={styles.stateDetail}>{STATE_DESCRIPTION[state.stateName]}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  signGroup: {
    marginTop: 2,
  },
  signRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(244,236,222,0.16)',
  },
  signLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  chevron: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  stateList: {
    paddingLeft: 8,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(244,236,222,0.08)',
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  stateName: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  stateDetail: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
})
