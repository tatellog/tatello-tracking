import { Feather } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SkyBackground } from '@/features/tabs/components'
import { colors, radius, typography } from '@/theme'

// Versión actual de la app — refleja app.json. Si cambia, actualizar aquí.
const APP_VERSION = '1.0.0'

type Block =
  | { kind: 'lead'; text: string }
  | { kind: 'section'; eyebrow: string; body: string }
  | { kind: 'list'; eyebrow: string; items: string[] }
  | { kind: 'qa'; items: { q: string; a: string }[] }
  | { kind: 'version'; tag: string; items: string[] }

type Doc = { title: string; blocks: Block[] }

const DOCS: Record<string, Doc> = {
  'how-it-works': {
    title: 'Cómo funciona Stelar',
    blocks: [
      {
        kind: 'lead',
        text: 'Stelar cuenta calorías y macros, pero no se queda en el número. Acompaña tu constancia, sin presión ni culpa.',
      },
      {
        kind: 'section',
        eyebrow: 'Dos cielos',
        body: 'Tu constelación responde al movimiento: crece cuando entrenas y empieza de nuevo cada mes. Tu emblema es transformación: escucha todos tus hábitos y nunca se reinicia.',
      },
      {
        kind: 'section',
        eyebrow: 'Todo suma',
        body: 'Cada registro (movimiento, comida, sueño, agua, cómo te sentiste) alimenta tu universo. El peso es el norte, pero no domina la pantalla. Vive en contexto.',
      },
      {
        kind: 'list',
        eyebrow: 'Las reglas de tu universo',
        items: [
          'Cada registro te transforma.',
          'Nada se resta: aquí solo se suma.',
          'Lo revelado nunca se esconde.',
          'Tu transformación no se reinicia: es tuya.',
        ],
      },
    ],
  },
  orbit: {
    title: 'Cómo se construye tu Órbita',
    blocks: [
      {
        kind: 'lead',
        text: 'Tu Órbita se teje con lo que registras, día a día. No predice ni diagnostica: observa y te devuelve tus propios patrones.',
      },
      {
        kind: 'section',
        eyebrow: 'Las dimensiones',
        body: 'Sueño, energía, movimiento, ciclo y emociones alimentan el motor de patrones. No son metas aparte. Son las señales que explican qué sostiene tu constancia, y qué la rompe.',
      },
      {
        kind: 'section',
        eyebrow: 'Las lecturas',
        body: 'Tu Órbita observa y describe (Diaria, Semanal, Mensual). Nunca aconseja ni prescribe: te muestra lo que se repite, para que tú decidas.',
      },
      {
        kind: 'section',
        eyebrow: 'Tu transformación',
        body: 'El emblema se revela por etapas con todo lo que sostienes a lo largo del tiempo. Despacio, sin retroceder. Lo que construyes, queda.',
      },
    ],
  },
  faq: {
    title: 'Preguntas frecuentes',
    blocks: [
      {
        kind: 'qa',
        items: [
          {
            q: '¿Stelar me va a poner a dieta?',
            a: 'No. Stelar no da dietas ni rutinas de entrenamiento. Trackea y contextualiza tus propios datos, sin sustituir a un profesional.',
          },
          {
            q: '¿Por qué casi no veo mi peso?',
            a: 'El peso es el objetivo, pero no domina la pantalla. Vive en Progreso y en tu perfil, como un indicador más, nunca como un número que te juzga cada día.',
          },
          {
            q: '¿Qué pasa si fallo un día?',
            a: 'Nada se castiga. Tu transformación nunca retrocede y un día distinto es un dato a entender, no una falla.',
          },
          {
            q: '¿Para qué sirve la constelación?',
            a: 'Es tu progreso hecho visible: reemplaza la gráfica de peso fría por un cielo que crece contigo.',
          },
          {
            q: '¿Mis datos están seguros?',
            a: 'Sí. Viven en tu cuenta y nadie más los lee. Puedes ver más en Ajustes → Privacidad.',
          },
        ],
      },
    ],
  },
  changelog: {
    title: 'Novedades',
    blocks: [
      {
        kind: 'version',
        tag: `Versión ${APP_VERSION}`,
        items: [
          'Primera versión de Stelar.',
          'Tu cielo: constelación mensual y emblema de transformación.',
          'Hoy, Comidas, Progreso y Órbita.',
          'Registro de comida por búsqueda, foto y texto.',
          'Tu Historia, cambio visual y consistencia en Progreso.',
        ],
      },
    ],
  },
}

export default function AboutDocScreen() {
  return (
    <ErrorBoundary screen="acerca">
      <DocBody />
    </ErrorBoundary>
  )
}

function DocBody() {
  const router = useRouter()
  const { doc } = useLocalSearchParams<{ doc?: string }>()
  const data = doc ? DOCS[doc] : undefined

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={styles.back}
          >
            <Feather name="chevron-left" size={24} color={colors.leche} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {data?.title ?? 'Acerca de Stelar'}
          </Text>
          <View style={styles.back} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {data ? (
            data.blocks.map((b, i) => <BlockView key={i} block={b} />)
          ) : (
            <Text style={styles.lead}>Esta página aún no existe.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'lead':
      return <Text style={styles.lead}>{block.text}</Text>
    case 'section':
      return (
        <View style={styles.block}>
          <Text style={styles.eyebrow}>{block.eyebrow}</Text>
          <Text style={styles.body}>{block.body}</Text>
        </View>
      )
    case 'list':
      return (
        <View style={styles.block}>
          <Text style={styles.eyebrow}>{block.eyebrow}</Text>
          <View style={styles.card}>
            {block.items.map((it) => (
              <View key={it} style={styles.point}>
                <Text style={styles.pointGlyph}>✦</Text>
                <Text style={styles.pointText}>{it}</Text>
              </View>
            ))}
          </View>
        </View>
      )
    case 'qa':
      return (
        <View style={styles.qaList}>
          {block.items.map((it) => (
            <View key={it.q} style={styles.card}>
              <Text style={styles.qaQ}>{it.q}</Text>
              <Text style={styles.qaA}>{it.a}</Text>
            </View>
          ))}
        </View>
      )
    case 'version':
      return (
        <View style={styles.block}>
          <Text style={styles.versionTag}>{block.tag}</Text>
          <View style={styles.card}>
            {block.items.map((it) => (
              <View key={it} style={styles.point}>
                <Text style={styles.pointGlyph}>✦</Text>
                <Text style={styles.pointText}>{it}</Text>
              </View>
            ))}
          </View>
        </View>
      )
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.title,
    color: colors.leche,
    letterSpacing: 0.2,
  },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 },
  lead: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 24,
    color: colors.bone,
    marginBottom: 26,
  },
  block: { marginBottom: 24 },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 10,
  },
  body: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 23,
    color: colors.bone,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 16,
    gap: 12,
  },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  pointGlyph: { fontSize: 11, lineHeight: 20, color: colors.magenta },
  pointText: {
    flex: 1,
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.bone,
  },
  qaList: { gap: 12 },
  qaQ: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    marginBottom: 6,
  },
  qaA: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.niebla,
  },
  versionTag: {
    fontFamily: typography.displayHeavy,
    fontSize: 20,
    letterSpacing: -0.4,
    color: colors.leche,
    marginBottom: 12,
  },
})
