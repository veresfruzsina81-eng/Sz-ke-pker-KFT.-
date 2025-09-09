// netlify/functions/send-mail.js
import nodemailer from "nodemailer";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const data = JSON.parse(event.body || "{}");
    const {
      name = "",
      email = "",
      phone = "",
      address = "",
      message = "",
      consent = false,
    } = data;

    if (!name || !email || !message || consent !== true) {
      return { statusCode: 400, body: "Hiányzó mezők vagy nincs elfogadva az adatkezelés." };
    }

    // SMTP beállítások a környezeti változókból
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465, // 465 = SSL
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const to = process.env.MAIL_TO || process.env.SMTP_USER;
    const from = process.env.MAIL_FROM || `Szőke Épker <${process.env.SMTP_USER}>`;

    const subject = "Új ajánlatkérés a weboldalról";
    const text = `
Név: ${name}
E-mail: ${email}
Telefon: ${phone}
Cím: ${address}

Üzenet:
${message}
`.trim();

    const html = `
      <div style="font:14px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif">
        <h2>Új ajánlatkérés</h2>
        <p><b>Név:</b> ${escapeHtml(name)}<br>
           <b>E-mail:</b> ${escapeHtml(email)}<br>
           <b>Telefon:</b> ${escapeHtml(phone)}<br>
           <b>Cím:</b> ${escapeHtml(address)}</p>
        <p><b>Üzenet:</b><br>${nl2br(escapeHtml(message))}</p>
      </div>
    `;

    await transporter.sendMail({ to, from, replyTo: email, subject, text, html });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Mailer hiba" };
  }
};

// segédek
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
const nl2br = (s) => String(s).replace(/\n/g, "<br>");
