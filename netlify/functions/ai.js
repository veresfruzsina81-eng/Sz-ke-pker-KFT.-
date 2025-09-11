// netlify/functions/ai.js
// Node 18+ alatt a fetch globális. Ha régebbi runtime-ot használsz,
// telepíts "node-fetch"-et és importáld be.

const BUSINESS_ALLOW = [
  'ajánlat','ára','árak','költség','kalkul','határid','szerződés','garancia',
  'generálkivitelez','szigetel','homlokzat','térkövez','burkol','fest',
  'felújít','referencia','kapcsolat','helyszíni','felmérés','projekt','anyag','munkadíj'
];

function isBusinessQuery(text=''){
  const m = text.toLowerCase();
  return BUSINESS_ALLOW.some(k => m.includes(k));
}

// Opcionális: CORS (általában nem kell, mert ugyanarról a domainről hívod)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Only POST allowed' };
  }

  try {
    const { prompt } = JSON.parse(event.body || '{}');
    if (!prompt || typeof prompt !== 'string') {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Hiányzó prompt.' }) };
    }

    // Szerveroldali üzleti-szűrő
    if (!isBusinessQuery(prompt)) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          answer: 'A chat jelenleg csak üzleti témákra válaszol (ajánlat, ár, határidő, szolgáltatás, referencia, kapcsolat).'
        })
      };
    }

    // 🔑 A kulcsot a Netlify UI-ban add meg: OPENAI_API_KEY
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Nincs beállítva az OPENAI_API_KEY.' }) };
    }

    // Rövid, tárgyilagos üzleti válasz (HU)
    const systemPrompt =
      'Te egy építőipari ügyfélszolgálati asszisztens vagy. Csak üzleti témákra válaszolj ' +
      '(ajánlat, ár, határidő, szolgáltatások, referencia, kapcsolat). Légy rövid, udvarias, ' +
      'pontokba szedve válaszolj, ha lehet. Magyarul válaszolj. Ha valami nem egyértelmű, ' +
      'kérdezz vissza 1-2 célzott kérdéssel.';

    // Chat Completions API (stabil, egyszerű)
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',      // gyors és olcsóbb 4o-ág
        temperature: 0.3,          // tárgyilagosabb
        max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'OpenAI hiba', detail: t }) };
    }

    const data = await resp.json();
    const answer = data?.choices?.[0]?.message?.content?.trim() || 'Nincs válasz.';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ answer })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Szerverhiba', detail: String(err?.message || err) })
    };
  }
}
