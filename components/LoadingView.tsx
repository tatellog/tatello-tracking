import { BlurView } from 'expo-blur'
import { StyleSheet, View } from 'react-native'

import { colors } from '@/theme'

import { StarLoader } from './StarLoader'

/*
 * Full-page loading — a silhouette of the screen's layout, blurred so
 * it reads as the app itself out of focus, with the loader resolving
 * into focus on top. Drop it inside a screen's content area.
 */
export function LoadingView() {
  return (
    <View style={styles.root}>
      {/* A rough silhouette of the page — surfaces, not faint ghosts;
          the blur is what softens it. */}
      <View style={styles.skeleton}>
        <View style={[styles.block, styles.header]} />
        <View style={[styles.block, styles.cta]} />
        <View style={[styles.block, styles.label]} />
        <View style={[styles.block, styles.hero]} />
        <View style={[styles.block, styles.line]} />
        <View style={[styles.block, styles.strip]} />
      </View>
      <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.center} pointerEvents="none">
        <StarLoader size={48} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  skeleton: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  block: {
    backgroundColor: colors.bgCard2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  header: {
    width: '52%',
    height: 30,
  },
  // The CTA — magenta-tinted so the blur carries the app's accent.
  cta: {
    width: '100%',
    height: 58,
    marginTop: 22,
    backgroundColor: colors.magentaTint2,
    borderColor: colors.magenta,
  },
  label: {
    width: '34%',
    height: 14,
    marginTop: 26,
  },
  hero: {
    width: '100%',
    height: 158,
    marginTop: 12,
  },
  line: {
    width: '82%',
    height: 15,
    marginTop: 18,
  },
  strip: {
    width: '100%',
    height: 60,
    marginTop: 22,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
