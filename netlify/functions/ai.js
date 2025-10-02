// netlify/functions/ai.js
import fetch from "node-fetch";

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { prompt = "", history = [] } = JSON.parse(event.body || "{}");

    // ---- VÉDELEM ----
    if (!process.env.OPENAI_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ reply: "Szerver beállítási hiba." }) };
    }

    // ---- ÜZLETI SZABÁLYOK / VÁLLALATI ADATOK ----
    const BIZ = {
      shipping: "Szállítás: 1490 Ft, 30 000 Ft felett ingyenes.",
      payment: "Fizetés: jelenleg csak utánvét.",
      contact: "+36 70 607 0675 · info@szoke-epker.com · 4100 Berettyóújfalu, Dózsa György utca 6 1/3.",
      quoteRedirect: "Árak több tényezőtől függenek. Kérjük az #ajanlatkeres szekciót használd."
    };

    const system = `
Te a "Szőke Épker KFT." rövid, kedves és segítőkész ÜZLETI asszisztense vagy.
- Nyelv: magyar, tömör és udvarias.
- Témák: szolgáltatások, folyamat, kapcsolat, webshop, szállítás, fizetés, árajánlat.
- Ha árra kérdeznek: magyarázd el, hogy több tényezőtől függ, és irányíts az #ajanlatkeres részhez.
- Off-topic esetén: "Értem a kérdésed, de sajnos csak üzleti témákban válaszolhatok 😚".
- Ne találj ki adatot; a szállítás/fizetés/kapcsolat az alábbi BIZ adatokból jöjjön.
- Adj rövid, jól olvasható választ. Lehetőleg javasolj következő lépést (CTA).
`;

    // A kliens rövid HISTORY-t küld – itt limitáljuk is:
    const shortHistory = history.slice(-6);

    // ---- PROMPT ÖSSZEÁLLÍTÁS ----
    const userMsg = `
Felhasználói kérdés: "${prompt}"

Cégadatok (BIZ):
- ${BIZ.shipping}
- ${BIZ.payment}
- Kapcsolat: ${BIZ.contact}
- Árajánlat: ${BIZ.quoteRedirect}

Válaszformátum (JSON):
{
  "reply": "rövid magyar válasz",
  "quick_replies": ["opcionális", "max 4 rövid gombszöveg"]
}

Ha off-topic: válaszold a guardrail mondatot és adj quick reply-t: ["Szolgáltatások","Ajánlatkérés","Kapcsolat"].
`;

    // ---- OPENAI HÍVÁS (Chat Completions) ----
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: system.trim() },
          ...shortHistory,
          { role: "user", content: userMsg.trim() }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("OpenAI error:", t);
      return {
        statusCode: 200,
        body: JSON.stringify({
          reply: "Sajnálom, most nem érem el a válaszmotort. Közben segíthetek: " + BIZ.contact,
          quick_replies: ["Szolgáltatások","Szállítás","Fizetés","Ajánlatkérés"]
        })
      };
    }

    const data = await resp.json();
    let parsed;
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    } catch {
      parsed = {};
    }

    // Biztonsági alapértelmezés
    const reply = parsed.reply || "Rendben. Miben segíthetek?";
    const quick = Array.isArray(parsed.quick_replies) ? parsed.quick_replies.slice(0,4) : [];

    return {
      statusCode: 200,
      body: JSON.stringify({ reply, quick_replies: quick })
    };
  } catch (e) {
    console.error(e);
    return {
      statusCode: 200,
      body: JSON.stringify({
        reply: "Váratlan hiba történt. Írj nyugodtan az elérhetőségeinkre: " +
               "+36 70 607 0675 · info@szoke-epker.com",
        quick_replies: ["Szolgáltatások","Szállítás","Fizetés","Ajánlatkérés"]
      })
    };
  }
}
