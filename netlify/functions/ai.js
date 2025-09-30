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
- Telefon: +36 70 607 0675
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
- "Miért minket?": lásd részletes szerkezet lent.

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
Szállítás/fizetés (webshop): említsd meg a gyors és gondmentes kiszállítást, 1490 Ft díj; 30 000 Ft felett ingyenes; fizetés utánvéttel.

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

    // Few-shot példák – köszönés/köszönet + webshop + szakmai kérdések
    const FEW = [
      // Köszönés
      { role:"user", content:"szia" },
      { role:"assistant", content: JSON.stringify({
        intent:"general",
        reply:"Szia! Örülök, hogy írt. Miben segíthetek? Szolgáltatások, webshop, szállítás/fizetés vagy árajánlat?",
        needed_fields:[],
        quick_replies:["Szolgáltatások","Szállítás","Fizetés","Ajánlatkérés"],
        summary:"köszönés"
      }) },
      // Köszönet
      { role:"user", content:"köszi" },
      { role:"assistant", content: JSON.stringify({
        intent:"general",
        reply:"Szívesen! Ha bármi másban segíthetek, írjon nyugodtan.",
        needed_fields:[], quick_replies:["Szolgáltatások","Kapcsolat"], summary:"köszönet" }) },
      // Webshop szállítás
      { role:"user", content:"mennyi a szállítás?" },
      { role:"assistant", content: JSON.stringify({
        intent:"pricing",
        reply:"A szállítás 1490 Ft, 30 000 Ft felett ingyenes. Gyors és gondmentes kiszállítással dolgozunk.",
        needed_fields:[], quick_replies:["Fizetés","Ajánlatkérés","Kapcsolat"], summary:"szállítási díj"
      }) },
      // Webshop fizetés
      { role:"user", content:"tudok online fizetni?" },
      { role:"assistant", content: JSON.stringify({
        intent:"pricing",
        reply:"Jelenleg online fizetés nem elérhető, a webshopban utánvéttel tud fizetni. A rendelésről emailt küldünk.",
        needed_fields:[], quick_replies:["Szállítás","Ajánlatkérés"], summary:"fizetési mód"
      }) },
      // Mióta vagytok a szakmában?
      { role:"user", content:"mióta vagytok a szakmában?" },
      { role:"assistant", content: JSON.stringify({
        intent:"general",
        reply:"Évek óta a szakmában vagyunk, stabil, összeszokott csapattal és sok elégedett visszajelzéssel. A minőséget dokumentált folyamatokkal biztosítjuk.",
        needed_fields:[], quick_replies:["Szolgáltatások","Referencia","Ajánlatkérés"], summary:"szakmai múlt"
      }) },
      // Garancia?
      { role:"user", content:"vállaltok garanciát?" },
      { role:"assistant", content: JSON.stringify({
        intent:"general",
        reply:"Igen. Gyártói előírások szerint, rendszergaranciával dolgozunk, a kivitelezésre vállalati jótállást adunk. Részleteket ajánlatadáskor pontosítunk.",
        needed_fields:[], quick_replies:["Ajánlatkérés","Kapcsolat"], summary:"garancia"
      }) },
      // Mivel dolgoztok? (anyagok)
      { role:"user", content:"milyen anyagokkal dolgoztok?" },
      { role:"assistant", content: JSON.stringify({
        intent:"general",
        reply:"Bevált, prémium rendszerekkel és minőségi anyagokkal dolgozunk, a gyártói technológiai előírásokat tartva.",
        needed_fields:[], quick_replies:["Miért minket?","Ajánlatkérés"], summary:"anyagminőség"
      }) },
      // Hol vállaltok munkát?
      { role:"user", content:"melyik megyében dolgoztok?" },
      { role:"assistant", content: JSON.stringify({
        intent:"general",
        reply:"Országosan vállalunk munkát egyeztetés alapján. Írja meg a helyszínt, és egyeztetjük a részleteket.",
        needed_fields:["helyszín"], quick_replies:["Ajánlatkérés","Kapcsolat"], summary:"szolgáltatási terület"
      }) },
      // Számla/ÁFA
      { role:"user", content:"áfás számlát adtok?" },
      { role:"assistant", content: JSON.stringify({
        intent:"pricing",
        reply:"Igen, tételes, átlátható költségvetést és ÁFÁ-s számlát adunk.",
        needed_fields:[], quick_replies:["Ajánlatkérés","Kapcsolat"], summary:"számlázás"
      }) },
      // Kezdés/ütem
      { role:"user", content:"mikor tudtok kezdeni?" },
      { role:"assistant", content: JSON.stringify({
        intent:"timeline",
        reply:"A pontos kezdés felmérés és kapacitás egyeztetése után adható. Kérném a munka típusát, helyszínt és a kívánt időablakot.",
        needed_fields:["szolgáltatás","helyszín","időablak"], quick_replies:["Ajánlatkérés","Kapcsolat"], summary:"kezdési idő"
      }) },
      // Visszaküldés/csere (ha felmerül webshopnál)
      { role:"user", content:"ha nem jó, vissza tudom küldeni?" },
      { role:"assistant", content: JSON.stringify({
        intent:"general",
        reply:"Egyedi egyeztetés alapján, a vonatkozó jogszabályok szerint kezeljük a visszaküldést/cserét. Írja meg a rendelési számot és a problémát.",
        needed_fields:["rendelési szám","probléma rövid leírása"], quick_replies:["Kapcsolat","Ajánlatkérés"], summary:"visszaküldés/csere"
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

    // Biztonságos JSON parse – ha nem JSON, kézi fallback
    let out;
    try {
      out = JSON.parse(text);
    } catch {
      out = fallbackFromPrompt(prompt);
    }

    // intent normalizálás
    if (!out || typeof out !== "object") out = {};
    if (!ALLOWED_INTENTS.includes(out.intent)) out.intent = heuristicIntent(prompt) || "general";

    // non_business – fix, pontos szöveg + ajánlott gombok
    if (out.intent === "non_business") {
      out.reply = "Bocsánat, de a chat csak üzleti kérdésekre válaszol. Kérem, tegyen fel üzleti kérdést (ajánlat, ár, határidő, szolgáltatás, referencia, kapcsolat). Megértését köszönjük.";
      out.quick_replies = ["Ajánlatkérés","Kapcsolat"];
      out.needed_fields = out.needed_fields || [];
      out.summary = out.summary || "off-topic";
    }

    // why_us – ha kimaradna a kontakt sor, pótlás
    if (out.intent === "why_us" && typeof out.reply === "string" && !/info@szoke-epker\.com/i.test(out.reply)) {
      out.reply = out.reply.trim() + "\n\nKérjük, vegye fel a kapcsolatot velünk: Telefon: +36 70 607 0675 • E-mail: info@szoke-epker.com";
    }

    // quick replies tisztítás
    out.quick_replies = normalizeQuickReplies(out.quick_replies);

    // log (segít debugolni)
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

/* ---------- Heurisztikus fallbackok ---------- */

function normalizeQuickReplies(arr){
  if (!Array.isArray(arr)) return [];
  const clean = [];
  const seen = new Set();
  for (const x of arr) {
    const t = String(x || "").trim();
    if (!t) continue;
    if (seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    clean.push(t);
    if (clean.length >= 4) break;
  }
  return clean;
}

function heuristicIntent(q=""){
  const s = q.toLowerCase();
  if (/(szia|hello|helló|jó napot|üdv)/.test(s)) return "general";
  if (/(köszi|köszönöm|thx|kösz)/.test(s)) return "general";
  if (/(ár|áraj|költs|mennyibe|árlista|áfás)/.test(s)) return "pricing";
  if (/(határidő|mikorra|ütem|mennyi idő|kezdés)/.test(s)) return "timeline";
  if (/(kapcsolat|telefon|email|elérhet)/.test(s)) return "contact";
  if (/(referencia|galéria|munkáink)/.test(s)) return "reference";
  if (/(miért minket|miért ti|miért a szőke)/.test(s)) return "why_us";
  if (/(foci|vicc|időjárás|politika)/.test(s)) return "non_business";
  // webshop spéci
  if (/(szállít|futár|ingyenes|kiszállítás)/.test(s)) return "pricing";
  if (/(fizet|utánvét|online|kártya|utalás)/.test(s)) return "pricing";
  return "general";
}

function fallbackFromPrompt(q=""){
  const intent = heuristicIntent(q);
  const base = {
    intent,
    reply: "",
    needed_fields: [],
    quick_replies: [],
    summary: ""
  };
  if (intent === "pricing") {
    if (/(szállít|kiszállítás|ingyenes)/.test(q.toLowerCase())) {
      base.reply = "A szállítás 1490 Ft, 30 000 Ft felett ingyenes. Gyors és gondmentes kiszállítással dolgozunk.";
      base.quick_replies = ["Fizetés","Ajánlatkérés","Kapcsolat"];
      base.summary = "szállítási díj";
    } else if (/(fizet|utánvét|kártya|online|utalás)/.test(q.toLowerCase())) {
      base.reply = "Jelenleg online fizetés nem elérhető, a webshopban utánvéttel tud fizetni. A rendelésről emailt küldünk.";
      base.quick_replies = ["Szállítás","Ajánlatkérés"];
      base.summary = "fizetési mód";
    } else {
      base.reply = "Az ár több tényezőtől függ (terület, anyag, állványozás, határidő). Kérjük, vegye fel a kapcsolatot velünk: Telefon: +36 70 607 0675 • E-mail: info@szoke-epker.com";
      base.quick_replies = ["Ajánlatkérés","Kapcsolat","Szolgáltatások"];
      base.needed_fields = ["szolgáltatás"];
      base.summary = "árérdeklődés";
    }
  } else if (intent === "timeline") {
    base.reply = "A pontos kezdés felmérés és kapacitás egyeztetése után adható. Kérem, írja meg a munka típusát, a helyszínt és a kívánt időablakot.";
    base.quick_replies = ["Ajánlatkérés","Kapcsolat"];
    base.needed_fields = ["szolgáltatás","helyszín","időablak"];
    base.summary = "kezdési idő";
  } else if (intent === "contact") {
    base.reply = `${CONTACT.phone} • ${CONTACT.email} • ${CONTACT.address}`;
    base.quick_replies = ["Telefonhívás","E-mail küldése","Ajánlatkérés"];
    base.summary = "kapcsolat kérés";
  } else if (intent === "reference") {
    base.reply = "Javasoljuk a referencia galériát. Melyik szolgáltatás érdekelné (térkövezés, szigetelés, festés, generálkivitelezés)?";
    base.quick_replies = ["Térkövezés","Szigetelés","Festés","Generálkivitelezés"];
    base.needed_fields = ["szolgáltatás"];
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
    const s = q.toLowerCase();
    if (/(szia|hello|helló|jó napot|üdv)/.test(s)) {
      base.reply = "Szia! Örülök, hogy írt. Miben segíthetek? Szolgáltatások, webshop, szállítás/fizetés vagy árajánlat?";
      base.quick_replies = ["Szolgáltatások","Szállítás","Fizetés","Ajánlatkérés"];
      base.summary = "köszönés";
    } else if (/(köszi|köszönöm|thx|kösz)/.test(s)) {
      base.reply = "Szívesen! Ha bármi másban segíthetek, írjon nyugodtan.";
      base.quick_replies = ["Szolgáltatások","Kapcsolat"];
      base.summary = "köszönet";
    } else if (/(mióta|mennyi ideje|régóta|tapasztalat)/.test(s)) {
      base.reply = "Évek óta a szakmában vagyunk, stabil, összeszokott csapattal és sok elégedett visszajelzéssel.";
      base.quick_replies = ["Szolgáltatások","Referencia","Ajánlatkérés"];
      base.summary = "szakmai múlt";
    } else if (/(garancia|jótállás)/.test(s)) {
      base.reply = "Gyártói előírások szerint, rendszergaranciával dolgozunk, a kivitelezésre vállalati jótállást adunk.";
      base.quick_replies = ["Ajánlatkérés","Kapcsolat"];
      base.summary = "garancia";
    } else if (/(anyag|márka|rendszer)/.test(s)) {
      base.reply = "Bevált, prémium rendszerekkel és minőségi anyagokkal dolgozunk, a gyártói technológiai előírásokat tartva.";
      base.quick_replies = ["Miért minket?","Ajánlatkérés"];
      base.summary = "anyagminőség";
    } else if (/(melyik megye|hol dolgoztok|vállaltok-e)/.test(s)) {
      base.reply = "Országosan vállalunk munkát egyeztetés alapján. Kérem, írja meg a helyszínt.";
      base.needed_fields = ["helyszín"];
      base.quick_replies = ["Ajánlatkérés","Kapcsolat"];
      base.summary = "szolgáltatási terület";
    } else {
      base.reply = "Szívesen segítek! Megírná röviden, miben tudunk segíteni: szolgáltatás, ár, határidő, referencia vagy kapcsolat?";
      base.quick_replies = ["Ajánlatkérés","Szolgáltatások","Szállítás","Kapcsolat"];
      base.summary = "általános érdeklődés";
    }
  }
  return base;
}
