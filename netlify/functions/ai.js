// netlify/functions/ai.js
// Netlify env: OPENAI_API_KEY
// Visszatérés: KIZÁRÓLAG JSON { intent, reply, needed_fields, quick_replies, summary }

const CONTACT = {
  company: "Szőke Épker KFT.",
  phone: "+36 70 607 0675",
  email: "info@szoke-epker.com",
  web: "https://szoke-epker.com",
  address: "4100 Berettyóújfalu, Dózsa György utca 6 1/3"
};

const SERVICES = [
  "Generálkivitelezés",
  "Homlokzati hőszigetelés",
  "Térkövezés és burkolás",
  "Festés, lakásfelújítás"
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SYSTEM_PROMPT = `
Te a Szőke Épker KFT. ügyfélszolgálati asszisztense vagy. Mindig magyarul válaszolj, röviden, udvariasan, tárgyilagosan.
Csak üzleti témákra válaszolj: ajánlatkérés, ár/árképzés, határidő/ütemezés, szolgáltatások, referencia, kapcsolat.
Ha a kérdés nem üzleti, udvariasan jelezd, hogy a chat üzleti kérdésekre válaszol.

Cégadatok (használd a válaszban, ha releváns):
- Telefon: +36 70 607 0675
- E-mail: info@szoke-epker.com
- Web: https://szoke-epker.com
- Cím: 4100 Berettyóújfalu, Dózsa György utca 6 1/3
Szolgáltatások: Generálkivitelezés; Homlokzati hőszigetelés; Térkövezés és burkolás; Festés, lakásfelújítás.

Kimenet MINDIG kizárólag JSON legyen, magyarázat nélkül, pontosan ebben a sémában:
{
  "intent": "offer|pricing|timeline|contact|reference|general|non_business",
  "reply": "rövid, közérthető magyar válasz",
  "needed_fields": ["ha hiányzik adat: külön mezők (pl. 'helyszín', 'terület (m²)', 'anyag', 'határidő')"],
  "quick_replies": ["max 4 javasolt gomb"],
  "summary": "1 mondatos összegzés leadhez (ha értelmezhető)"
}

Irányelvek:
- Stílus: rövid bekezdés vagy max. 3 bullet; felesleges sallang nélkül.
- Ha hiányzik info az ajánlathoz, kérd be célzottan a "needed_fields"-ben.
- Kapcsolat kérésnél add vissza tömören a telefont és e-mailt; quick_replies: ["Telefonhívás","E-mail küldése","Ajánlatkérés"].
- Árkérésnél ha NEM derül ki a szolgáltatás: kérdezd meg: "Melyik szolgáltatás áráról szeretne érdeklődni a Szőke Épker KFT.-nél? (térkövezés, szigetelés, festés, generálkivitelezés)" és tedd a "needed_fields"-be: ["szolgáltatás"].
- Ha a szolgáltatás meg van nevezve árkérésnél: rövid magyarázat után ZÁRJ ezzel a fix sorral:
  "Kérjük, vegye fel a kapcsolatot velünk: Telefon: +36 70 607 0675 • E-mail: info@szoke-epker.com".
- Határidőnél jelezd, hogy pontos ütem a felmérés után adható; kérd be a kívánt időablakot.
- Referenciánál javasold a galéria megtekintését; kérdezd meg, melyik szolgáltatás érdekli.
- Non-business témát udvariasan utasítsd el és adj quick_replies-t: ["Ajánlatkérés","Kapcsolat"].
`;

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "Only POST" };

  try {
    const { prompt, history = [] } = JSON.parse(event.body || "{}");
    if (!prompt || typeof prompt !== "string") {
      return json({ error: "Hiányzó prompt." }, 400);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return json({ error: "OPENAI_API_KEY hiányzik" }, 500);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: "CÉGADATOK: " + JSON.stringify(CONTACT) + " • SZOLGÁLTATÁSOK: " + SERVICES.join(", ") },
      ...history.slice(-6),
      { role: "user", content: prompt }
    ];

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 400,
        messages
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      return json({ error: "OpenAI hiba", detail: t }, 502);
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || "";
    let out;
    try { out = JSON.parse(text); }
    catch { out = { intent: "general", reply: text, needed_fields: [], quick_replies: [], summary: "" }; }

    return json(out, 200);

  } catch (err) {
    return json({ error: "Szerverhiba", detail: String(err?.message || err) }, 500);
  }
}

function json(obj, code = 200) {
  return {
    statusCode: code,
    headers: { "Content-Type": "application/json", ...cors },
    body: JSON.stringify(obj)
  };
}
