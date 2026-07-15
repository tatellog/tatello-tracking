// @ts-nocheck — typechecked by Deno (deno.json), not the app tsconfig.
// Edge function: scan-measurements
//
// La tabla del coach → mediciones. La app manda una FOTO (base64) o un PDF
// de la tabla de composición corporal (filas = métricas, columnas = fechas)
// y gpt-4o-mini devuelve JSON estricto: una entrada por fecha con las
// métricas mapeadas a las columnas canónicas de body_checkins. El cliente
// SIEMPRE muestra revisión antes de guardar (datos de salud: la usuaria
// confirma, la IA solo transcribe).
//
// SECURITY MODEL (idéntico a scan-meal)
//   - OPENAI_API_KEY vive SOLO aquí (function secret), jamás en el bundle.
//   - JWT verificado (auth.getUser): sin usuaria autenticada no se quema key.
//   - Errores al cliente: cálidos y genéricos; nada de strings crudos.

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

// Foto (jpg/png) o PDF: exactamente uno.
const ImageRequestSchema = z.object({
  imageBase64: z.string().min(1).max(15_000_000),
  mimeType: z.string().default('image/jpeg'),
})
const PdfRequestSchema = z.object({
  pdfBase64: z.string().min(1).max(20_000_000),
})

// Rangos espejo de los CHECK de body_checkins: un valor fuera de rango se
// DESCARTA (null), nunca tumba la lectura completa.
const bounded = (min: number, max: number) =>
  z
    .number()
    .nullable()
    .optional()
    .transform((v) => (v != null && v >= min && v <= max ? v : null))

const ValuesSchema = z.object({
  weight_kg: bounded(20, 400),
  bmi: bounded(5, 100),
  bmr_kcal: bounded(500, 6000),
  water_pct: bounded(20, 80),
  bone_mass_kg: bounded(0, 10),
  metabolic_age: bounded(10, 120),
  visceral_fat_index: bounded(0, 60),
  muscle_kg: bounded(10, 90),
  muscle_arm_right_kg: bounded(0, 20),
  muscle_arm_left_kg: bounded(0, 20),
  muscle_trunk_kg: bounded(5, 60),
  muscle_leg_right_kg: bounded(1, 30),
  muscle_leg_left_kg: bounded(1, 30),
  body_fat_pct: bounded(3, 70),
  fat_arm_right_pct: bounded(3, 70),
  fat_arm_left_pct: bounded(3, 70),
  fat_trunk_pct: bounded(3, 70),
  fat_leg_right_pct: bounded(3, 70),
  fat_leg_left_pct: bounded(3, 70),
  neck_cm: bounded(10, 100),
  chest_cm: bounded(30, 250),
  waist_cm: bounded(30, 250),
  abdomen_cm: bounded(30, 250),
  hips_cm: bounded(30, 250),
  arm_right_cm: bounded(10, 100),
  arm_left_cm: bounded(10, 100),
  thigh_right_cm: bounded(20, 150),
  thigh_left_cm: bounded(20, 150),
  calf_right_cm: bounded(10, 100),
  calf_left_cm: bounded(10, 100),
})

const ScannedSchema = z.object({
  checkins: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        // false = el día del mes fue estimado (la columna solo decía mes/año).
        dateExact: z.boolean().default(true),
        values: ValuesSchema,
      }),
    )
    .max(8),
  confidence: z.enum(['alta', 'media', 'baja']).default('alta'),
})

const SYSTEM_PROMPT = [
  'Eres un transcriptor de tablas de composición corporal (de coach o báscula de bioimpedancia)',
  'y devuelves SOLO JSON válido. La tabla tiene métricas en filas y fechas en columnas (o al revés).',
  'Devuelve una entrada por COLUMNA de fecha, con las métricas que aparezcan mapeadas a estas claves:',
  'weight_kg (Peso), bmi (IMC), bmr_kcal (TMB/Tmb), water_pct (%Agua), bone_mass_kg (M. ósea),',
  'metabolic_age (Edad metabólica), visceral_fat_index (Visceral), muscle_kg (Muscular/Músculo total kg),',
  'muscle_arm_right_kg / muscle_arm_left_kg (Brazo der/izq kg), muscle_trunk_kg (Tronco kg),',
  'muscle_leg_right_kg / muscle_leg_left_kg (Pierna der/izq kg), body_fat_pct (% Grasa total),',
  'fat_arm_right_pct / fat_arm_left_pct (Brazo der/izq %), fat_trunk_pct (Tronco %),',
  'fat_leg_right_pct / fat_leg_left_pct (Pierna der/izq %), y medidas de cinta en cm:',
  'neck_cm, chest_cm, waist_cm, abdomen_cm, hips_cm, arm_right_cm, arm_left_cm,',
  'thigh_right_cm, thigh_left_cm, calf_right_cm, calf_left_cm.',
  'Fechas en formato "YYYY-MM-DD". Si la columna solo trae mes y año ("Agosto 24"), usa el día 15',
  'y marca "dateExact": false. Años de dos dígitos son 20XX.',
  'Si una celda está vacía o ilegible, omite esa clave. NUNCA inventes valores.',
  'Transcribe números EXACTOS como aparecen (respeta decimales).',
  'Incluye "confidence": "alta" si la tabla se lee con claridad, "media" si hay celdas dudosas,',
  '"baja" si la imagen es difícil de leer. Sé honesto: mejor declarar duda que fingir precisión.',
  'Si la imagen NO contiene una tabla de mediciones corporales, devuelve {"checkins":[],"confidence":"alta"}.',
  'Formato exacto: {"checkins":[{"date":"YYYY-MM-DD","dateExact":true,"values":{...}}],"confidence":"alta"|"media"|"baja"}',
].join(' ')

async function callOpenAI(payload: unknown, openaiKey: string, path: string) {
  const res = await fetch(`https://api.openai.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('scan-measurements: OpenAI error', res.status, detail.slice(0, 500))
    return null
  }
  return res.json()
}

/** Foto → chat/completions con visión (el camino probado de scan-meal). */
async function analyzeImage(imageBase64: string, mimeType: string, openaiKey: string) {
  const completion = await callOpenAI(
    {
      model: 'gpt-4o-mini',
      max_tokens: 1600,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Transcribe esta tabla de mediciones y devuelve el JSON.' },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' },
            },
          ],
        },
      ],
    },
    openaiKey,
    'chat/completions',
  )
  const content = completion?.choices?.[0]?.message?.content
  return typeof content === 'string' ? content : null
}

/** PDF → Responses API con input_file (los 4o aceptan PDF ahí). */
async function analyzePdf(pdfBase64: string, openaiKey: string) {
  const response = await callOpenAI(
    {
      model: 'gpt-4o-mini',
      max_output_tokens: 1600,
      temperature: 0,
      text: { format: { type: 'json_object' } },
      input: [
        { role: 'system', content: [{ type: 'input_text', text: SYSTEM_PROMPT }] },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Transcribe esta tabla de mediciones y devuelve el JSON.',
            },
            {
              type: 'input_file',
              filename: 'mediciones.pdf',
              file_data: `data:application/pdf;base64,${pdfBase64}`,
            },
          ],
        },
      ],
    },
    openaiKey,
    'responses',
  )
  // Responses API: el texto vive en output[].content[].text.
  const parts = response?.output ?? []
  for (const item of parts) {
    for (const c of item?.content ?? []) {
      if (typeof c?.text === 'string') return c.text
    }
  }
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!openaiKey || !supabaseUrl || !anonKey) {
      console.error('scan-measurements: missing env')
      return json({ error: 'La lectura no está disponible ahora.' }, 500)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await authClient.auth.getUser(token)
    if (userErr || !userData?.user) return json({ error: 'No autorizado.' }, 401)

    const body = await req.json().catch(() => undefined)
    const imageReq = ImageRequestSchema.safeParse(body)
    const pdfReq = PdfRequestSchema.safeParse(body)

    let content: string | null = null
    if (imageReq.success) {
      content = await analyzeImage(imageReq.data.imageBase64, imageReq.data.mimeType, openaiKey)
    } else if (pdfReq.success) {
      content = await analyzePdf(pdfReq.data.pdfBase64, openaiKey)
    } else {
      return json({ error: 'Entrada inválida.' }, 400)
    }

    if (!content) return json({ error: 'No pudimos leer tu tabla. Intenta de nuevo.' }, 502)

    let raw: unknown
    try {
      raw = JSON.parse(content)
    } catch {
      console.error('scan-measurements: model did not return valid JSON')
      return json({ error: 'No pudimos leer tu tabla. Intenta de nuevo.' }, 502)
    }
    const parsed = ScannedSchema.safeParse(raw)
    if (!parsed.success) {
      console.error('scan-measurements: model JSON failed validation', parsed.error.message)
      return json({ error: 'No pudimos leer tu tabla. Intenta de nuevo.' }, 502)
    }

    return json(parsed.data)
  } catch (e) {
    console.error('scan-measurements: unhandled', e instanceof Error ? e.message : String(e))
    return json({ error: 'No pudimos leer tu tabla. Intenta de nuevo.' }, 500)
  }
})
