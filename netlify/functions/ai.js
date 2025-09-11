// netlify/functions/ai.js
// Netlify env: OPENAI_API_KEY
// Visszatérés: JSON { intent, reply, needed_fields, quick_replies, summary }

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
Te a Szőke Épker KFT. ügyfélszolgálati asszisztense vagy. Magyarul válaszolj, udvariasan és tárgyilagosan.
Csak üzleti témákra válaszolj: ajánlatkérés, ár/árképzés, határidő/ütemezés, szolgáltatások, referencia, kapcsolat, valamint "miért minket" jellegű kérdések.

Cégadatok (használd, ha releváns):
- Telefon: +36 70 607 0675
- E-mail: info@szoke-epker.com
- Web: https://szoke-epker.com
- Cím: 4100 Berettyóújfalu, Dózsa György utca 6 1/3
Szolgáltatások: Generálkivitelezés; Homlokzati hőszigetelés; Térkövezés és burkolás; Festés, lakásfelújítás.

Kimenet MINDIG kizárólag JSON legyen, magyarázat nélkül, pontosan ebben a sémában:
{
  "intent": "offer|pricing|timeline|contact|reference|general|non_business|why_us",
  "reply": "rövid vagy hosszabb magyar válasz (a feladat szerint)",
  "needed_fields": ["ha hiányzik adat: külön mezők (pl. 'helyszín', 'terület (m²)', 'anyag', 'határidő')"],
  "quick_replies": ["max 4 javasolt gomb"],
  "summary": "1 mondatos összegzés leadhez (ha értelmezhető)"
}

Árkérés:
- Ha NEM derül ki a szolgáltatás: kérdezd meg: "Melyik szolgáltatás áráról szeretne érdeklődni a Szőke Épker KFT.-nél? (térkövezés, szigetelés, festés, generálkivitelezés)" és tedd a "needed_fields"-be: ["szolgáltatás"].
- Ha meg van nevezve a szolgáltatás: rövid tájékoztatás a fő tényezőkről, majd ZÁRJ ezzel a fix sorral:
  "Kérjük, vegye fel a kapcsolatot velünk: Telefon: +36 70 607 0675 • E-mail: info@szoke-epker.com".

Kapcsolat: adj tömör kontaktot; quick_replies: ["Telefonhívás","E-mail küldése","Ajánlatkérés"].
Határidő: jelezd, hogy pontos ütem felmérés után adható; kérd be a kívánt időablakot.
Referencia: javasold a galériát; kérdezd meg, melyik szolgáltatás érdekli.

Nem üzleti kérdések (intent=non_business):
- Válasz szövege legyen PONTOSAN ez:
  "Bocsánat, de a chat csak üzleti kérdésekre válaszol. Kérem, tegyen fel üzleti kérdést (ajánlat, ár, határidő, szolgáltatás, referencia, kapcsolat). Megértését köszönjük."
- Adj quick_replies-t: ["Ajánlatkérés","Kapcsolat"].

"Miért minket?" (intent=why_us):
- Alapértelmezetten ADJ **hosszabb** választ, strukturáltan, a 4 szolgáltatásra külön alfejezettel.
- Szerkezet:
  1) Nyitó 2–3 mondatos bekezdés (átlátható költségvetés, határidő-követés, minőség-ellenőrzés, rendezett átadás).
  2) "Térkövezés és burkolás – miért jó választásunk?" → 3–5 pont: rétegrend és fagyálló alap, vízelvezetés, ipari fugázás, precíz szintezés/vágáskép, tartós anyagválasztás, tiszta átadás.
  3) "Homlokzati hőszigetelés – mitől prémium?" → 3–5 pont: gyártói rendszer, hőhídmentes csomópontok, dűbelezési terv, páratechnika, rendszergarancia, dokumentált kivitelezés.
  4) "Festés, lakásfelújítás – különbséget jelentő részletek" → 3–5 pont: pormentes takarás, precíz előkészítés, prémium festékek, moshatóság, tiszta munkaterület, ütemezett kivitelezés.
  5) "Generálkivitelezés – biztos kézben a projekt" → 3–5 pont: tételes költségvetés, határidő-követés, felelős műszaki irányítás, ellenőrzött alvállalkozók, jogszabályi/gyártói előírások.
  6) Záró cselekvésre ösztönzés + **KÖTELEZŐ** kontakt sor:
     "Kérjük, vegye fel a kapcsolatot velünk: Telefon: +36 70 607 0675 • E-mail: info@szoke-epker.com".
- Ha a felhasználó egyetlen szolgáltatásról kérdezi a "miért minket"-et, akkor csak az adott alfejezetet írd meg 4–6 erős ponttal, majd a kötelező kontakt sorral zárd.
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
        max_tokens: 900,
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

    // why_us esetén, ha kimaradna, fűzzük hozzá a kontakt sort
    if (out?.intent === "why_us" && typeof out.reply === "string" && !/info@szoke-epker\.com/i.test(out.reply)) {
      out.reply = out.reply.trim() + "\n\nKérjük, vegye fel a kapcsolatot velünk: Telefon: +36 70 607 0675 • E-mail: info@szoke-epker.com";
    }

    // non_business legyen pontosan a kért szöveg
    if (out?.intent === "non_business") {
      out.reply = "Bocsánat, de a chat csak üzleti kérdésekre válaszol. Kérem, tegyen fel üzleti kérdést (ajánlat, ár, határidő, szolgáltatás, referencia, kapcsolat). Megértését köszönjük.";
      out.quick_replies = ["Ajánlatkérés","Kapcsolat"];
    }

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
