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
Non-business: udvarias elutasítás + quick_replies: ["Ajánlatkérés","Kapcsolat"].

"Miért minket?" (intent=why_us):
- Alapértelmezetten ADJ **hosszabb** választ, strukturáltan, a 4 szolgáltatásra külön alfejezettel.
- Minta szerkezet (markdown-szerű, de sima szövegként add vissza):
  1) Nyitó 2–3 mondatos bekezdés, amely kiemeli: átlátható költségvetés, határidő-követés, minőség-ellenőrzés, rendezett átadás.
  2) "Térkövezés és burkolás – miért jó választásunk?" → 3–5 pont a következőkből:
     - rétegrend és fagyálló alapozás, teherbírás és vízelvezetés,
     - ipari minőségű fugázás és szegélyezés,
     - precíz szintezés és vágáskép, egységes hézag,
     - tartósságot növelő anyagválasztás, tiszta átadás.
  3) "Homlokzati hőszigetelés – mitől prémium?" → 3–5 pont:
     - gyártói rendszerben dolgozunk (ragasztó, háló, alapozó, nemesvakolat),
     - hőhídmentes csomópontok és páratechnika,
     - dűbelezési terv és mechanikai rögzítés,
     - rendszergarancia és dokumentált kivitelezés.
  4) "Festés, lakásfelújítás – különbséget jelentő részletek" → 3–5 pont:
     - pormentes takarás, precíz előkészítés (glettelés, csiszolás),
     - prémium festékek, fedőképesség és moshatóság,
     - tiszta munkaterület, gyors, ütemezett kivitelezés,
     - színmintázás és anyagjavaslat.
  5) "Generálkivitelezés – biztos kézben a projekt" → 3–5 pont:
     - tételes, átlátható költségvetés, rejtett tételek nélkül,
     - határidő-követés, ütemterv és rendszeres státuszjelentés,
     - felelős műszaki irányítás, ellenőrzött alvállalkozók,
     - jogszabályi és gyártói előírások betartása.
  6) Záró cselekvésre ösztönzés + **KÖTELEZŐ** kontakt sor:
     "Kérjük, vegye fel a kapcsolatot velünk: Telefon: +36 70 607 0675 • E-mail: info@szoke-epker.com".
- Ha a felhasználó egyetlen szolgáltatásról kérdezi a "miért minket"-et (pl. „miért vagytok jók térkövezésben”), akkor csak az adott alfejezetet írd meg 4–6 erős ponttal, majd a kötelező kontakt sorral zárd.
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

    // Biztonság kedvéért: ha why_us és nincs a kontakt sor a végén, illesszük be.
    if (out?.intent === "why_us" && typeof out.reply === "string") {
      const contactLine = "Kérjük, vegye fel a kapcsolatot velünk: Telefon: +36 70 607 067 5 • E-mail: info@szoke-epker.com";
      const clean = out.reply.replace(/\s+$/,'');
      if (!/info@szoke-epker\.com/i.test(clean)) {
        out.reply = clean + "\n\nKérjük, vegye fel a kapcsolatot velünk: Telefon: +36 70 607 0675 • E-mail: info@szoke-epker.com";
      }
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
