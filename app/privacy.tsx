import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SkyBackground } from '@/features/tabs/components'
import { colors, radius, typography } from '@/theme'

export default function PrivacyScreen() {
  return (
    <ErrorBoundary screen="privacidad">
      <PrivacyBody />
    </ErrorBoundary>
  )
}

function PrivacyBody() {
  const router = useRouter()
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
          <Text style={styles.title}>Privacidad</Text>
          <View style={styles.back} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* La promesa — el centro de la privacidad de Stelar. */}
          <Text style={styles.promise}>
            <Text style={styles.promiseStrong}>Tus datos son tuyos.</Text> Viven en tu cuenta y
            nadie más los lee.
          </Text>

          <Text style={styles.eyebrow}>Qué datos guardamos</Text>
          <View style={styles.card}>
            <View style={styles.point}>
              <Text style={styles.pointGlyph}>✦</Text>
              <Text style={styles.pointText}>
                <Text style={styles.accent}>Tu cuenta:</Text> tu correo y tu nombre.
              </Text>
            </View>
            <View style={styles.point}>
              <Text style={styles.pointGlyph}>✦</Text>
              <Text style={styles.pointText}>
                <Text style={styles.accent}>Tu seguimiento:</Text> peso y medidas, comidas y
                nutrición, sueño, agua, movimiento, ánimo, energía y, si lo activas, tu ciclo.
              </Text>
            </View>
            <View style={styles.point}>
              <Text style={styles.pointGlyph}>✦</Text>
              <Text style={styles.pointText}>
                <Text style={styles.accent}>Tus fotos:</Text> de perfil, de comidas y de progreso,
                si decides agregarlas.
              </Text>
            </View>
            <View style={styles.point}>
              <Text style={styles.pointGlyph}>✦</Text>
              <Text style={styles.pointText}>
                <Text style={styles.accent}>Uso de la app:</Text> eventos básicos para entender qué
                funciona y corregir errores.
              </Text>
            </View>
          </View>

          <Text style={styles.eyebrow}>Cómo los usamos</Text>
          <View style={styles.card}>
            <Text style={styles.body}>
              Solo para darte Stelar: registrar tu día, encontrar tus patrones y escribir tus
              lecturas de Tu Órbita. Nada más.
            </Text>
          </View>

          <Text style={styles.eyebrow}>Qué NO hacemos</Text>
          <View style={styles.card}>
            <View style={styles.point}>
              <Text style={styles.pointGlyph}>✦</Text>
              <Text style={styles.pointText}>No vendemos ni compartimos tus datos con nadie.</Text>
            </View>
            <View style={styles.point}>
              <Text style={styles.pointGlyph}>✦</Text>
              <Text style={styles.pointText}>
                No usamos tu información para publicidad de terceros.
              </Text>
            </View>
            <View style={styles.point}>
              <Text style={styles.pointGlyph}>✦</Text>
              <Text style={styles.pointText}>
                Puedes borrar todo cuando quieras desde Eliminar cuenta.
              </Text>
            </View>
          </View>

          <Text style={styles.eyebrow}>Con quién se comparten</Text>
          <View style={styles.card}>
            <Text style={styles.body}>
              Tus datos viven en <Text style={styles.accent}>Supabase</Text>, nuestra
              infraestructura, cifrados y protegidos para que solo tú los veas.
            </Text>
            <Text style={styles.body}>
              Cuando escaneas una comida con foto, esa foto se envía a{' '}
              <Text style={styles.accent}>OpenAI</Text> solo para identificar el platillo y estimar
              sus datos. No se usa para entrenar sus modelos ni queda asociada a ti.
            </Text>
            <Text style={styles.body}>Nadie más recibe tu información.</Text>
          </View>

          <Text style={styles.eyebrow}>Cuánto tiempo</Text>
          <View style={styles.card}>
            <Text style={styles.body}>
              Mientras tengas tu cuenta. Cuando la eliminas (Ajustes → Eliminar cuenta), se borra
              todo: tus datos y tus fotos, en todos nuestros sistemas. No hay vuelta atrás.
            </Text>
          </View>

          <Text style={styles.eyebrow}>Tus derechos</Text>
          <View style={styles.card}>
            <Text style={styles.body}>
              Puedes ver y editar tus datos dentro de la app, y borrarlos por completo cuando
              quieras. Stelar es para personas adultas; no está pensada para menores de edad.
            </Text>
          </View>

          <Text style={styles.eyebrow}>Contacto</Text>
          <View style={styles.card}>
            <Text style={styles.body}>
              ¿Dudas sobre tus datos o esta política? Escríbenos desde Ajustes → Feedback.
            </Text>
          </View>

          <Text style={styles.note}>Última actualización: junio 2026.</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
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
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.title,
    color: colors.leche,
    letterSpacing: 0.2,
  },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 },
  promise: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 24,
    color: colors.bone,
    marginBottom: 28,
  },
  promiseStrong: {
    fontStyle: 'normal',
    fontFamily: typography.uiBold,
    color: colors.leche,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  body: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.bone,
  },
  accent: {
    fontFamily: typography.uiMedium,
    color: colors.leche,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pointGlyph: {
    fontSize: typography.sizes.micro,
    lineHeight: 20,
    color: colors.magenta,
  },
  pointText: {
    flex: 1,
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.bone,
  },
  note: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
    textAlign: 'center',
  },
})
