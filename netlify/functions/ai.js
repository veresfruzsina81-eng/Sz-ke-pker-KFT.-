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

// Maradunk a korábbi intent-készletnél
const ALLOWED_INTENTS = ["offer","pricing","timeline","contact","reference","general","non_business","why_us"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SYSTEM_PROMPT = `
Te a Szőke Épker KFT. ügyfélszolgálati asszisztense vagy. Magyarul válaszolj, kedvesen, pozitívan és tárgyilagosan.
Csak üzleti témákra válaszolj: ajánlatkérés, ár/árképzés, határidő/ütemezés, szolgáltatások, referencia, kapcsolat, "miért minket", webshop (szállítás/fizetés).

Hangvétel:
- Köszönésre barátságos, rövid visszaköszönés.
- Köszönetnél udvarias lezárás: "Szívesen! Ha bármi másban segíthetek, írjon nyugodtan."
- Pozitív, megnyugtató megfogalmazás (pl. "gyors, gondmentes folyamat", "megbízható csapat", "sok elégedett visszajelzés").
- Rövid, lényegre törő válaszok, szükség esetén felsorolással.
- Ha információ hiányzik, kérdezz rá és tedd a "needed_fields" mezőbe.

Webshop fix szabályok:
- Szállítás 1490 Ft; 30 000 Ft felett ingyenes.
- Fizetés: csak utánvéttel.
- Rendelésről e-mail visszaigazolás.

Cégadatok (használd, ha releváns):
- Telefon: +36 70 607 067 5
- E-mail: info@szoke-epker.com
- Web: https://szoke-epker.com
- Cím: 4100 Berettyóújfalu, Dózsa György utca 6 1/3
Szolgáltatások: Generálkivitelezés; Homlokzati hőszigetelés; Térkövezés és burkolás; Festés, lakásfelújítás.

Gyakori válasz-irányelvek:
- Szakmai múlt: "Évek óta a szakmában vagyunk, stabil, összeszokott csapattal és sok elégedett ügyfélvisszajelzéssel."
- Garancia: "Gyártói előírások szerint dolgozunk, rendszergaranciával; a kivitelezésre vállalati jótállást adunk."
- Anyagok: "Bevált, prémium rendszerekkel és minőségi anyagokkal dolgozunk."
- Szolgáltatási terület: "Országosan vállalunk munkát egyeztetés alapján."
- Számlázás/ÁFA: "Tételes, átlátható költségvetést és számlát adunk, ÁFA-val."
- Kezdés/ütem: "A pontos kezdés és ütemezés felmérés és kapacitás egyeztetése után adható."
- Szállítási idő (webshop): "A feladást gyorsan intézzük; kiszállítás jellemzően 1–3 munkanap." (ha rákérdeznek)
- Visszaküldés/csere: "Egyedi egyeztetés alapján, a vonatkozó jogszabályok szerint." (ha rákérdeznek)

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
Szállítás/fizetés (webshop): pontosan fogalmazz – **különítsd el** a *fizetés* kérdéseit az *árkéréstől*.
Nem üzleti kérdések (intent=non_business):
- FIX szöveg:
  "Bocsánat, de a chat csak üzleti kérdésekre válaszol. Kérem, tegyen fel üzleti kérdést (ajánlat, ár, határidő, szolgáltatás, referencia, kapcsolat). Megértését köszönjük."
- quick_replies: ["Ajánlatkérés","Kapcsolat"].
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

    // --- Kulcsszó-csoportok a heurisztikához ---
    const KW = {
      payment: /(fizet|fizetés|bankkártya|kártya|kártyával|online fizetés|utalás|utánvét|után vét|cod|cash on delivery)/i,
      shipping: /(szállít|kiszállít|futár|posta|ingyenes szállítás|szállítás)/i,
      price: /(ár|áraj|árlista|költs|mennyi|mibe kerül|mennyibe kerül)/i,
      greet: /(szia|hello|helló|jó napot|üdv)/i,
      thanks: /(köszi|köszönöm|thx|kösz)/i,
      timeline: /(határidő|mikorra|ütem|mennyi idő|kezdés|kezdő idő)/i,
      contact: /(kapcsolat|telefon|email|elérhet)/i,
      reference: /(referencia|galéria|munkáink)/i,
      whyus: /(miért minket|miért ti|miért a szőke)/i,
      nonbiz: /(foci|vicc|időjárás|politika)/i
    };

    // --- Few-shot példák: külön fizetés vs ár ---
    const FEW = [
      // Fizetés (online?)
      { role:"user", content:"tudok online fizetni bankkártyával?" },
      { role:"assistant", content: JSON.stringify({
        intent:"pricing",
        reply:"Jelenleg online fizetés nem elérhető, a webshopban utánvéttel tud fizetni. A rendelésről emailt küldünk.",
        needed_fields:[], quick_replies:["Szállítás","Ajánlatkérés"], summary:"fizetési mód"
      }) },
      // Ár érdeklődés
      { role:"user", content:"mennyibe kerülne?" },
      { role:"assistant", content: JSON.stringify({
        intent:"pricing",
        reply:"Az ár több tényezőtől függ (terület, anyag, határidő). Melyik szolgáltatás áráról szeretne érdeklődni a Szőke Épker KFT.-nél? (térkövezés, szigetelés, festés, generálkivitelezés)",
        needed_fields:["szolgáltatás"], quick_replies:["Térkövezés","Szigetelés","Festés","Generálkivitelezés"], summary:"árérdeklődés"
      }) },
      // Szállítás
      { role:"user", content:"mennyi a szállítás?" },
      { role:"assistant", content: JSON.stringify({
        intent:"pricing",
        reply:"A szállítás 1490 Ft, 30 000 Ft felett ingyenes. Gyors és gondmentes kiszállítással dolgozunk.",
        needed_fields:[], quick_replies:["Fizetés","Ajánlatkérés","Kapcsolat"], summary:"szállítási díj"
      }) },
      // Köszönés
      { role:"user", content:"szia" },
      { role:"assistant", content: JSON.stringify({
        intent:"general",
        reply:"Szia! Örülök, hogy írt. Miben segíthetek? Szolgáltatások, webshop, szállítás/fizetés vagy árajánlat?",
        needed_fields:[], quick_replies:["Szolgáltatások","Szállítás","Fizetés","Ajánlatkérés"], summary:"köszönés"
      }) },
      // Köszönet
      { role:"user", content:"köszi" },
      { role:"assistant", content: JSON.stringify({
        intent:"general",
        reply:"Szívesen! Ha bármi másban segíthetek, írjon nyugodtan.",
        needed_fields:[], quick_replies:["Szolgáltatások","Kapcsolat"], summary:"köszönet"
      }) }
    ];

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: "CÉGADATOK: " + JSON.stringify(CONTACT) + " • SZOLGÁLTATÁSOK: " + SERVICES.join(", ") },
      ...FEW,
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
        temperature: 0.25,
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
    catch { out = fallbackFromPrompt(prompt, KW); }

    if (!out || typeof out !== "object") out = {};
    if (!ALLOWED_INTENTS.includes(out.intent)) out.intent = heuristicIntent(prompt, KW) || "general";

    // Nem üzleti kérdés – fix szöveg
    if (out.intent === "non_business") {
      out.reply = "Bocsánat, de a chat csak üzleti kérdésekre válaszol. Kérem, tegyen fel üzleti kérdést (ajánlat, ár, határidő, szolgáltatás, referencia, kapcsolat). Megértését köszönjük.";
      out.quick_replies = ["Ajánlatkérés","Kapcsolat"];
      out.needed_fields = out.needed_fields || [];
      out.summary = out.summary || "off-topic";
    }

    // "Miért minket?" – biztos kontakt sor
    if (out.intent === "why_us" && typeof out.reply === "string" && !/info@szoke-epker\.com/i.test(out.reply)) {
      out.reply = out.reply.trim() + "\n\nKérjük, vegye fel a kapcsolatot velünk: Telefon: +36 70 607 0675 • E-mail: info@szoke-epker.com";
    }

    out.quick_replies = normalizeQuickReplies(out.quick_replies);

    try { console.log("Q:", prompt, "→", out.intent, "|", out.summary || ""); } catch {}

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

/* ---------------- Segédfüggvények ---------------- */

function normalizeQuickReplies(arr){
  if (!Array.isArray(arr)) return [];
  const clean = [];
  const seen = new Set();
  for (const x of arr) {
    const t = String(x || "").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    clean.push(t);
    if (clean.length >= 4) break;
  }
  return clean;
}

function heuristicIntent(q="", KW){
  const s = q.toLowerCase();
  if (KW.nonbiz.test(s)) return "non_business";
  if (KW.contact.test(s)) return "contact";
  if (KW.reference.test(s)) return "reference";
  if (KW.whyus.test(s)) return "why_us";
  if (KW.timeline.test(s)) return "timeline";
  // pricing ágon belül különböztetjük a payment / shipping / ár érdeklődést
  if (KW.payment.test(s) || KW.shipping.test(s) || KW.price.test(s)) return "pricing";
  if (KW.greet.test(s) || KW.thanks.test(s)) return "general";
  return "general";
}

function fallbackFromPrompt(q="", KW){
  const s = q.toLowerCase();
  const intent = heuristicIntent(s, KW);
  const base = { intent, reply:"", needed_fields:[], quick_replies:[], summary:"" };

  if (intent === "pricing") {
    if (KW.payment.test(s)) {
      base.reply = "Jelenleg online fizetés nem elérhető, a webshopban utánvéttel tud fizetni. A rendelésről emailt küldünk.";
      base.quick_replies = ["Szállítás","Ajánlatkérés"];
      base.summary = "fizetési mód";
    } else if (KW.shipping.test(s)) {
      base.reply = "A szállítás 1490 Ft, 30 000 Ft felett ingyenes. Gyors és gondmentes kiszállítással dolgozunk.";
      base.quick_replies = ["Fizetés","Ajánlatkérés","Kapcsolat"];
      base.summary = "szállítási díj";
    } else {
      base.reply = "Az ár több tényezőtől függ (terület, anyag, határidő). Melyik szolgáltatás áráról szeretne érdeklődni a Szőke Épker KFT.-nél? (térkövezés, szigetelés, festés, generálkivitelezés)";
      base.needed_fields = ["szolgáltatás"];
      base.quick_replies = ["Térkövezés","Szigetelés","Festés","Generálkivitelezés"];
      base.summary = "árérdeklődés";
    }
  } else if (intent === "timeline") {
    base.reply = "A pontos kezdés felmérés és kapacitás egyeztetése után adható. Kérném a munka típusát, helyszínt és a kívánt időablakot.";
    base.needed_fields = ["szolgáltatás","helyszín","időablak"];
    base.quick_replies = ["Ajánlatkérés","Kapcsolat"];
    base.summary = "kezdési idő";
  } else if (intent === "contact") {
    base.reply = `${CONTACT.phone} • ${CONTACT.email} • ${CONTACT.address}`;
    base.quick_replies = ["Telefonhívás","E-mail küldése","Ajánlatkérés"];
    base.summary = "kapcsolat kérés";
  } else if (intent === "reference") {
    base.reply = "Javasoljuk a referencia galériát. Melyik szolgáltatás érdekelné (térkövezés, szigetelés, festés, generálkivitelezés)?";
    base.needed_fields = ["szolgáltatás"];
    base.quick_replies = ["Térkövezés","Szigetelés","Festés","Generálkivitelezés"];
    base.summary = "referencia érdeklődés";
  } else if (intent === "why_us") {
    base.reply = "A Szőke Épker KFT. átlátható költségvetéssel, határidő-követéssel és dokumentált minőség-ellenőrzéssel dolgozik. Kérjük, vegye fel a kapcsolatot velünk: Telefon: +36 70 607 0675 • E-mail: info@szoke-epker.com";
    base.quick_replies = ["Szolgáltatások","Ajánlatkérés","Kapcsolat"];
    base.summary = "miért minket";
  } else if (intent === "non_business") {
    base.reply = "Bocsánat, de a chat csak üzleti kérdésekre válaszol. Kérem, tegyen fel üzleti kérdést (ajánlat, ár, határidő, szolgáltatás, referencia, kapcsolat). Megértését köszönjük.";
    base.quick_replies = ["Ajánlatkérés","Kapcsolat"];
    base.summary = "off-topic";
  } else {
    if (KW.greet.test(s)) {
      base.reply = "Szia! Örülök, hogy írt. Miben segíthetek? Szolgáltatások, webshop, szállítás/fizetés vagy árajánlat?";
      base.quick_replies = ["Szolgáltatások","Szállítás","Fizetés","Ajánlatkérés"];
      base.summary = "köszönés";
    } else if (KW.thanks.test(s)) {
      base.reply = "Szívesen! Ha bármi másban segíthetek, írjon nyugodtan.";
      base.quick_replies = ["Szolgáltatások","Kapcsolat"];
      base.summary = "köszönet";
    } else {
      base.reply = "Szívesen segítek! Megírná röviden, miben tudunk segíteni: szolgáltatás, ár, határidő, referencia vagy kapcsolat?";
      base.quick_replies = ["Ajánlatkérés","Szolgáltatások","Szállítás","Kapcsolat"];
      base.summary = "általános érdeklődés";
    }
  }
  return base;
}
