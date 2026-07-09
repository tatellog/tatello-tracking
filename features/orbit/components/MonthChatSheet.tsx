import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SkyBackground } from '@/features/tabs/components'
import { colors, radius, typography } from '@/theme'

import type { ChatTopic, MonthChat } from '../month-chat'
import { MonthConversation, StelarStar } from './MonthChatView'

/*
 * La "sala" de Órbita Mes IA — el sheet full-screen donde vive UNA conversación
 * de tema, con foco (uxui + product: la conversación no compite con el
 * calendario del mes; se abre, conversas, cierras y vuelves a la antesala).
 * Slide-up como los DayLogModal de Órbita Día. El botón cerrar es hijo absoluto
 * directo del sheet (no dentro de un canvas), por el patrón conocido del repo.
 */

type Props = {
  topic: ChatTopic | null
  chat: MonthChat
  topicLabel: string
  onSaveReflection: (questionKey: string, answer: string) => void
  onOpenCalendar: () => void
  onClose: () => void
}

export function MonthChatSheet({
  topic,
  chat,
  topicLabel,
  onSaveReflection,
  onOpenCalendar,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets()
  const open = topic != null

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <SkyBackground />
        {/* Cerrar — hijo absoluto directo del sheet. */}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          hitSlop={12}
          style={[styles.close, { top: insets.top + 8 }]}
        >
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>

        {topic ? (
          <ScrollView
            contentContainerStyle={[
              styles.content,
              { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Cabecera de la sala: quién habla + de qué tema. */}
            <View style={styles.head}>
              <StelarStar size={30} />
              <View style={styles.headText}>
                <Text style={styles.headTopic}>{topicLabel}</Text>
                <Text style={styles.headWho}>Stelar · leyendo tu cielo</Text>
              </View>
            </View>

            <MonthConversation
              chat={chat}
              topic={topic}
              onSaveReflection={onSaveReflection}
              onOpenCalendar={onOpenCalendar}
              onClose={onClose}
            />
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
  },
  close: {
    position: 'absolute',
    right: 18,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
  },
  closeGlyph: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroSoft,
  },
  content: { paddingHorizontal: 22, gap: 22 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headText: { flex: 1 },
  headTopic: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  headWho: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.6,
    color: colors.niebla,
    marginTop: 2,
  },
})
