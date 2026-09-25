// @ts-nocheck — typechecked by Deno (deno.json), not the app tsconfig.
// Edge function: scan-meal
//
// Vision-based meal scan. The app sends a (resized) meal photo as base64;
// we ask gpt-4o-mini to identify the dish + its main ingredients with
// estimated portions and per-100g protein/kcal, and return strict JSON
// the client maps straight into the confirm form.
//
// SECURITY MODEL
//   - OPENAI_API_KEY lives ONLY here (Supabase function secret), never in
//     the app bundle.
//   - The caller must present a valid anon-key JWT; we verify it
//     (auth.getUser) so a random client can't burn the key. We don't use
//     the user id for anything else — the scan isn't per-user data.
//   - Error messages to the client are warm + generic; raw OpenAI / network
//     strings never reach the app (manifiesto voice + no internal leak).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.23.8'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Two input shapes: a meal PHOTO (base64) OR a TEXT description. Exactly
// one is required; the handler branches on whichever parses. A photo can
// declare mode 'etiqueta' (V-08): the model reads the NUTRITION FACTS
// panel instead of guessing the dish — numbers from HER label, not
// "typical" values.
const PhotoRequestSchema = z.object({
  imageBase64: z.string().min(1).max(15_000_000),
  mimeType: z.string().default('image/jpeg'),
  mode: z.enum(['plato', 'etiqueta']).default('plato'),
})
const TextRequestSchema = z.object({
  text: z.string().trim().min(2).max(500),
})

// What we accept back from the model (and clamp into sane ranges so a
// hallucinated 9000 kcal/100g never reaches the UI).
const IngredientSchema = z.object({
  name: z.string().trim().min(1).max(60),
  grams: z.coerce.number().min(0).max(2000),
  proteinPer100: z.coerce.number().min(0).max(100),
  kcalPer100: z.coerce.number().min(0).max(900),
  // Default 0 so a meal the model reports without sugar still validates.
  sugarPer100: z.coerce.number().min(0).max(100).default(0),
})
const MealSchema = z.object({
  name: z.string().trim().max(80),
  ingredients: z.array(IngredientSchema).max(12),
  // Honestidad de evidencia (M1): el modelo declara cuánto confía en su
  // lectura. 'baja'/'media' → el cliente invita a revisar porciones en vez
  // de fingir precisión. Default 'alta' para no romper respuestas viejas.
  confidence: z.enum(['alta', 'media', 'baja']).default('alta'),
})

// Shared JSON contract appended to both prompts.
const JSON_CONTRACT = [
  'Para cada ingrediente devuelve: name (en español), grams (porción estimada en gramos;',
  'para líquidos usa los mililitros como gramos, p. ej. 1 L = 1000), proteinPer100',
  '(g de proteína por 100 g), kcalPer100 (kcal por 100 g) y sugarPer100 (g de azúcar por 100 g).',
  'Estima porciones de forma realista para una persona.',
  'Para productos embotellados o de marca conocida (refrescos como Coca-Cola o Fanta, jugos, etc.)',
  'usa sus valores nutricionales típicos.',
  'Incluye "confidence": "alta" si identificas el plato y las porciones con claridad,',
  '"media" si identificas el plato pero las porciones son inciertas (foto parcial, plato mixto,',
  'descripción vaga), y "baja" si el plato mismo es ambiguo. Sé honesto: es mejor declarar duda',
  'que fingir precisión.',
  'IMPORTANTE: si la entrada SÍ es comida aunque sea vaga ("algo de pollo con arroz, creo"),',
  'NUNCA devuelvas vacío: estima los ingredientes más razonables y decláralo con confidence',
  '"media" o "baja". El vacío es SOLO para entradas que no son comida ni bebida.',
  'Responde con este formato exacto:',
  '{"name": string, "confidence": "alta"|"media"|"baja", "ingredients": [{"name": string, "grams": number, "proteinPer100": number, "kcalPer100": number, "sugarPer100": number}]}',
].join(' ')

const PHOTO_SYSTEM_PROMPT = [
  'Eres un nutricionista que analiza fotos de comida Y BEBIDAS y devuelve SOLO JSON válido.',
  'Identifica el plato o la bebida (incluye refrescos, jugos y bebidas embotelladas) y sus',
  'ingredientes principales con porciones estimadas.',
  'Si la imagen NO es comida ni bebida, devuelve {"name":"","ingredients":[]}.',
  JSON_CONTRACT,
].join(' ')

// V-08 · foto-de-etiqueta: el camino Stelar para empacados. El producto
// entra como UN ingrediente con la porción del envase; así los chips de
// porción del cliente (½/¾/1/1½) escalan gratis. Números NORMALIZADOS a
// per-100 (las etiquetas MX declaran por 100 g/ml y/o por porción).
const LABEL_SYSTEM_PROMPT = [
  'Eres un nutricionista que LEE ETIQUETAS NUTRIMENTALES (tabla de información',
  'nutricional de un empaque) y devuelve SOLO JSON válido.',
  'Lee los números DE LA ETIQUETA, no valores típicos: kcal (energía), proteína y azúcares.',
  'Devuelve UN solo elemento en "ingredients": el producto.',
  'name = el nombre del producto si se ve en el empaque (si no, describe el tipo de producto).',
  'grams = el contenido de UNA porción declarada en la etiqueta, en gramos (para líquidos usa',
  'los mililitros como gramos). Si la etiqueta solo declara por 100 g/ml, usa 100.',
  'proteinPer100 / kcalPer100 / sugarPer100 = los valores POR 100 g/ml. Si la etiqueta declara',
  'solo por porción, normalízalos a 100 con la porción declarada.',
  'confidence: "alta" SOLO si los números se leen con claridad; "media" si algunos se leen',
  'borrosos o la porción es dudosa; "baja" si apenas se distinguen. Sé honesto: es mejor',
  'declarar duda que inventar un número.',
  'Si la imagen NO es una etiqueta nutrimental (es un plato, u otra cosa), devuelve',
  '{"name":"","ingredients":[]}.',
  'Responde con este formato exacto:',
  '{"name": string, "confidence": "alta"|"media"|"baja", "ingredients": [{"name": string, "grams": number, "proteinPer100": number, "kcalPer100": number, "sugarPer100": number}]}',
].join(' ')

const TEXT_SYSTEM_PROMPT = [
  'Eres un nutricionista que analiza descripciones de comida o bebida escritas y devuelve SOLO JSON válido.',
  'A partir de la descripción, identifica el plato o la bebida (incluye refrescos, jugos y bebidas',
  'embotelladas) y sus ingredientes con porciones estimadas.',
  'Si el texto NO describe comida ni bebida, devuelve {"name":"","ingredients":[]}.',
  JSON_CONTRACT,
].join(' ')

// One gpt-4o-mini completion → validated meal, or null on any failure
// (network / non-OK / bad JSON / schema). The handler maps null to a warm
// generic error so raw model/network strings never reach the client.
async function analyzeMeal(messages: unknown[], openaiKey: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 700,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('scan-meal: OpenAI error', res.status, detail.slice(0, 500))
    return null
  }
  const completion = await res.json()
  const content = completion?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    console.error('scan-meal: no content in completion')
    return null
  }
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    console.error('scan-meal: model did not return valid JSON')
    return null
  }
  const meal = MealSchema.safeParse(raw)
  if (!meal.success) {
    console.error('scan-meal: model JSON failed validation', meal.error.message)
    return null
  }
  return meal.data
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!openaiKey || !supabaseUrl || !anonKey) {
      console.error('scan-meal: missing env (OPENAI_API_KEY / SUPABASE_URL / SUPABASE_ANON_KEY)')
      return json({ error: 'El escaneo no está disponible ahora.' }, 500)
    }

    // Verify the caller is an authenticated user — gate on the JWT so the
    // OpenAI key can't be drained by anonymous requests.
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await authClient.auth.getUser(token)
    if (userErr || !userData?.user) return json({ error: 'No autorizado.' }, 401)

    const body = await req.json().catch(() => undefined)
    const photoReq = PhotoRequestSchema.safeParse(body)
    const textReq = TextRequestSchema.safeParse(body)

    let messages: unknown[]
    if (photoReq.success) {
      const { imageBase64, mimeType, mode } = photoReq.data
      const isLabel = mode === 'etiqueta'
      messages = [
        { role: 'system', content: isLabel ? LABEL_SYSTEM_PROMPT : PHOTO_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: isLabel
                ? 'Lee esta etiqueta nutrimental y devuelve el JSON.'
                : 'Analiza este plato y devuelve el JSON.',
            },
            {
              type: 'image_url',
              // detail high para etiquetas: los números de la tabla son
              // letra chica y en 'low' se pierden (leer mal un 45 como 450
              // es peor que unos tokens extra).
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: isLabel ? 'high' : 'low',
              },
            },
          ],
        },
      ]
    } else if (textReq.success) {
      messages = [
        { role: 'system', content: TEXT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analiza esta comida y devuelve el JSON: "${textReq.data.text}"`,
        },
      ]
    } else {
      return json({ error: 'Entrada inválida.' }, 400)
    }

    const meal = await analyzeMeal(messages, openaiKey)
    if (!meal) return json({ error: 'No pudimos leer tu plato. Intenta de nuevo.' }, 502)

    return json(meal)
  } catch (e) {
    console.error('scan-meal: unhandled', e instanceof Error ? e.message : String(e))
    return json({ error: 'No pudimos leer tu plato. Intenta de nuevo.' }, 500)
  }
})
