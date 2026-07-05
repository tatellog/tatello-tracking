import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SkyBackground } from '@/features/tabs/components'
import { colors, radius, typography } from '@/theme'

/*
 * Términos de uso — la contraparte de app/privacy.tsx, mismo lenguaje
 * visual (SkyBackground + cards + eyebrows). Carga el disclaimer que el
 * manifiesto v3.0 exige explícito: Stelar es app de bienestar, NO
 * servicio médico, y no sustituye a profesionales. El onboarding
 * (welcome) linkea aquí antes del primer "Empecemos".
 */

export default function TermsScreen() {
  return (
    <ErrorBoundary screen="terminos">
      <TermsBody />
    </ErrorBoundary>
  )
}

function TermsBody() {
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
          <Text style={styles.title}>Términos de uso</Text>
          <View style={styles.back} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.promise}>
            <Text style={styles.promiseStrong}>Stelar es una app de bienestar.</Text> No es un
            servicio médico y no sustituye a profesionales.
          </Text>

          <Text style={styles.eyebrow}>Qué es Stelar</Text>
          <View style={styles.card}>
            <Text style={styles.body}>
              Una app de bienestar para acompañar una pérdida de peso sostenible. Registra tus
              comidas, tu peso y tus señales del día, y te devuelve tus propios patrones y lecturas.
              Al crear tu cuenta y usarla, aceptas estos términos.
            </Text>
          </View>

          <Text style={styles.eyebrow}>Qué NO es Stelar</Text>
          <View style={styles.card}>
            <View style={styles.point}>
              <Text style={styles.pointGlyph}>✦</Text>
              <Text style={styles.pointText}>
                <Text style={styles.accent}>No es un servicio médico ni clínico.</Text> No
                diagnostica, no ofrece tratamiento médico y no receta dietas ni rutinas.
              </Text>
            </View>
            <View style={styles.point}>
              <Text style={styles.pointGlyph}>✦</Text>
              <Text style={styles.pointText}>
                <Text style={styles.accent}>No sustituye a profesionales.</Text> Stelar no reemplaza
                a tu nutrióloga, médica, psicóloga, terapeuta ni coach.
              </Text>
            </View>
            <View style={styles.point}>
              <Text style={styles.pointGlyph}>✦</Text>
              <Text style={styles.pointText}>
                Si tienes una condición de salud, estás embarazada o tienes dudas sobre tu
                alimentación, consulta a un profesional antes de ajustar lo que comes.
              </Text>
            </View>
          </View>

          <Text style={styles.eyebrow}>Tus datos y tus decisiones</Text>
          <View style={styles.card}>
            <Text style={styles.body}>
              Lo que Stelar te muestra (metas, macros, patrones, lecturas) es una guía general
              calculada desde tus propios registros. Es información, no consejo médico. Las
              decisiones sobre tu cuerpo son tuyas.
            </Text>
            <Text style={styles.body}>
              Stelar es para personas adultas. No está pensada para menores de edad.
            </Text>
          </View>

          <Text style={styles.eyebrow}>Tu cuenta</Text>
          <View style={styles.card}>
            <Text style={styles.body}>
              Tu cuenta es personal. Puedes cerrarla y borrar todos tus datos cuando quieras desde
              Ajustes → Eliminar cuenta. Cómo cuidamos tu información vive en{' '}
              <Text style={styles.link} onPress={() => router.push('/privacy')}>
                Privacidad
              </Text>
              .
            </Text>
          </View>

          <Text style={styles.eyebrow}>Versión beta</Text>
          <View style={styles.card}>
            <Text style={styles.body}>
              Stelar todavía está en beta: puede tener errores y seguir cambiando. Si algo se ve
              raro, cuéntanos desde Ajustes → Feedback.
            </Text>
          </View>

          <Text style={styles.eyebrow}>Cambios a estos términos</Text>
          <View style={styles.card}>
            <Text style={styles.body}>
              Si estos términos cambian de forma importante, te lo diremos dentro de la app antes de
              que el cambio aplique.
            </Text>
          </View>

          <Text style={styles.eyebrow}>Contacto</Text>
          <View style={styles.card}>
            <Text style={styles.body}>
              ¿Dudas sobre estos términos? Escríbenos desde Ajustes → Feedback.
            </Text>
          </View>

          <Text style={styles.note}>Última actualización: julio 2026.</Text>
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
  link: {
    fontFamily: typography.uiMedium,
    color: colors.magenta,
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
