// Correos de pedidos: aviso a Luz y confirmación al cliente (pedido principal, ofertas y 2ª canción).
import { sendEmail, esc, musicStyle, lyricPrompt, recipientLabel, NOTIFY_EMAIL, OFFERS } from "./_lib.js";

function row(k, v) {
  return v ? `<tr><td style="padding:6px 10px;color:#666;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 10px">${esc(v).replace(/\n/g, "<br>")}</td></tr>` : "";
}
const money = (cents) => `$${(cents / 100).toFixed(2)}`;

export async function notifyOwner(o) {
  const pago = o.prepaidBy
    ? `<b>2ª canción (upsell ya cobrado en el pedido ${esc(o.prepaidBy)})</b>`
    : `<b>Pagado:</b> ${money(o.amountPaid)}${o.promo ? ` (descuento ${money(o.promo)})` : ""}`;
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:680px">
    <h2 style="color:#1B2A4A">🎵 Nuevo pedido GraceSong — ${esc(o.id)}</h2>
    ${o.bump ? `<p style="background:#FFF3C4;padding:10px;border-radius:8px">🖼️ <b>Incluye Keepsake Lyric Art (+$12):</b> enviar también la lámina diseñada en PDF 8×10 y 11×14.</p>` : ""}
    <p><b>Entregar antes de:</b> ${esc(o.readyBy)} · ${pago}</p>
    <table style="border-collapse:collapse;font-size:14px;background:#faf7ef;border-radius:8px">
      ${row("Para", recipientLabel(o))}${row("Relación", o.relation)}${row("Pronombre", o.pronoun)}
      ${row("Ocasión", o.occasion)}${row("Fecha del regalo", o.giftDate)}${row("Título elegido", o.title)}
      ${row("Género / voz / ánimo", `${o.genre} · ${o.voice} · ${o.mood}`)}
      ${row("Cualidades", (o.qualities || []).join(", "))}${row("En sus palabras", o.traits)}
      ${row("Historia", o.story)}${row("Otros nombres", o.otherNames)}${row("Versículo", o.verse)}
      ${row("Agradece a Dios por", o.thanks)}${row("Mensaje final", o.message)}
      ${row("Cliente", `${o.buyerName} <${o.email}>`)}
    </table>
    <h3 style="color:#1B2A4A;margin-top:24px">Estilo para ElevenLabs / Suno</h3>
    <pre style="background:#0f1e36;color:#F5E6C0;padding:12px;border-radius:8px;white-space:pre-wrap">${esc(musicStyle(o))}</pre>
    <h3 style="color:#1B2A4A">Instrucción para escribir la letra (pegar en Claude)</h3>
    <pre style="background:#f3f3f3;padding:12px;border-radius:8px;white-space:pre-wrap;font-size:12px">${esc(lyricPrompt(o))}</pre>
  </div>`;
  return sendEmail({ to: NOTIFY_EMAIL, subject: `🎵 Nuevo pedido: “${o.title}” — entregar antes de ${o.readyBy}`, html, replyTo: o.email });
}

export async function confirmCustomer(o) {
  const who = o.relation === "myself" ? "your" : `${esc(o.name)}'s`;
  const html = `
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2C2C2C">
    <p style="font-size:13px;letter-spacing:.1em;color:#A07830;text-transform:uppercase;font-family:Arial,sans-serif">GraceSong</p>
    <h1 style="color:#1B2A4A;font-size:26px;line-height:1.25">We've started writing ${who} song 🎵</h1>
    <p style="font-size:16px;line-height:1.6">Hi ${esc(o.buyerName)}, thank you for trusting us with your story. Our team is already working on <b>“${esc(o.title)}”</b>.</p>
    <p style="font-size:16px;line-height:1.6">Your song will arrive in this inbox <b>by ${esc(o.readyBy)}</b>, as a private link where you can listen, download it and share it with family.${o.bump ? " Your <b>Keepsake Lyric Art</b> (frame-ready, 8×10 and 11×14) will arrive with it." : ""}</p>
    <p style="font-size:15px;line-height:1.6;background:#FBF6EA;padding:14px;border-radius:10px">🎥 <b>A little idea:</b> when they hear it for the first time, press record. Send us their reaction and we'll gift you a free GraceSong for someone else you love.</p>
    <p style="font-size:15px;line-height:1.6">Want to add a detail or fix a name? Just reply to this email.</p>
    <p style="font-size:15px">With love,<br>The GraceSong team</p>
    <p style="font-size:12px;color:#888;font-family:Arial,sans-serif">Order ${esc(o.id)} · 7-day “love it” guarantee</p>
  </div>`;
  return sendEmail({ to: o.email, subject: `We're writing ${o.relation === "myself" ? "your" : `${o.name}'s`} GraceSong 🎵`, html, replyTo: NOTIFY_EMAIL });
}

// Compra de una oferta después del pago (upsell o downsell)
export async function notifyOwnerOffer(o, offer, link) {
  const extra = offer === "song2"
    ? `<p>El cliente recibió este enlace para contarnos la historia de la 2ª persona. Cuando lo llene te llegará un pedido nuevo con las 24 h contando desde ese momento:<br><a href="${esc(link)}">${esc(link)}</a></p>`
    : `<p>Hacer el video con la letra (<code>gracesong/video-letra/hacer_video.py</code>) y enviarlo junto con la canción “${esc(o.title)}”.</p>`;
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:680px">
    <h2 style="color:#1B2A4A">💰 Oferta comprada: ${esc(OFFERS[offer].name)} (${money(OFFERS[offer].cents)})</h2>
    <p>Pedido original: <b>${esc(o.id)}</b> · “${esc(o.title)}” para ${esc(recipientLabel(o))} · cliente ${esc(o.buyerName)} &lt;${esc(o.email)}&gt;</p>
    ${extra}
  </div>`;
  return sendEmail({ to: NOTIFY_EMAIL, subject: `💰 ${OFFERS[offer].name} — pedido ${o.id}`, html, replyTo: o.email });
}

export async function confirmCustomerOffer(o, offer, link) {
  const who = o.relation === "myself" ? "your" : `${esc(o.name)}'s`;
  const body = offer === "song2"
    ? `<p style="font-size:16px;line-height:1.6">Thank you for adding a <b>second GraceSong</b>! Whenever you're ready — today or next week — tell us about the person you'd like to bless:</p>
       <p style="text-align:center;margin:24px 0"><a href="${esc(link)}" style="background:#C9A84C;color:#1B2A4A;padding:14px 26px;border-radius:30px;text-decoration:none;font-weight:bold;font-family:Arial,sans-serif">Tell us about them →</a></p>
       <p style="font-size:15px;line-height:1.6">Their song will be ready within 24 hours after you send us their story.</p>`
    : `<p style="font-size:16px;line-height:1.6">Thank you for adding the <b>lyric video</b>! It will arrive together with ${who} song: one version for phones and one for the TV, with every line appearing as it's sung.</p>`;
  const html = `
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2C2C2C">
    <p style="font-size:13px;letter-spacing:.1em;color:#A07830;text-transform:uppercase;font-family:Arial,sans-serif">GraceSong</p>
    <h1 style="color:#1B2A4A;font-size:26px;line-height:1.25">${offer === "song2" ? "Your second song is reserved 🎵" : "Your lyric video is on its way 🎬"}</h1>
    <p style="font-size:16px;line-height:1.6">Hi ${esc(o.buyerName)},</p>
    ${body}
    <p style="font-size:15px">With love,<br>The GraceSong team</p>
    <p style="font-size:12px;color:#888;font-family:Arial,sans-serif">Order ${esc(o.id)} · ${esc(OFFERS[offer].name)} ${money(OFFERS[offer].cents)} · 7-day “love it” guarantee</p>
  </div>`;
  return sendEmail({ to: o.email, subject: offer === "song2" ? "Tell us who your second GraceSong is for 🎵" : "Your GraceSong lyric video is confirmed 🎬", html, replyTo: NOTIFY_EMAIL });
}
