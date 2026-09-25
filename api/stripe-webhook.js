// POST /api/stripe-webhook — Stripe avisa cuando se paga. Marca el pedido como pagado y envía los emails.
import {
  stripe, json, loadOrder, saveOrder, sendEmail, esc, musicStyle, lyricPrompt, recipientLabel, deliveryDate, NOTIFY_EMAIL,
} from "./_lib.js";

export async function POST(req) {
  const raw = await req.text();
  let event;
  try {
    event = await stripe().webhooks.constructEventAsync(raw, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error("Firma de webhook inválida:", e.message);
    return json({ error: "bad_signature" }, 400);
  }

  const handled = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
  if (!handled.includes(event.type)) return json({ ignored: event.type });

  const session = event.data.object;
  // "no_payment_required" = pedido pagado al 100% con un código de canción gratis
  if (!["paid", "no_payment_required"].includes(session.payment_status)) return json({ waiting: session.payment_status });

  const id = session.metadata?.order_id || session.client_reference_id;
  const order = await loadOrder(id);
  if (!order) {
    console.error("Pedido no encontrado para la sesión", session.id, id);
    return json({ error: "order_not_found" }, 500); // Stripe reintenta
  }
  if (order.status !== "pending_payment") return json({ already: order.status }); // idempotente

  const paidAt = new Date();
  Object.assign(order, {
    status: "paid",
    paidAt: paidAt.toISOString(),
    readyBy: deliveryDate(paidAt),
    stripeSession: session.id,
    amountPaid: session.amount_total,
    promo: session.total_details?.amount_discount ? session.total_details.amount_discount : 0,
  });
  await saveOrder(order);

  await Promise.all([notifyOwner(order), confirmCustomer(order)]);
  return json({ ok: true });
}

function row(k, v) {
  return v ? `<tr><td style="padding:6px 10px;color:#666;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 10px">${esc(v).replace(/\n/g, "<br>")}</td></tr>` : "";
}

async function notifyOwner(o) {
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:680px">
    <h2 style="color:#1B2A4A">🎵 Nuevo pedido GraceSong — ${esc(o.id)}</h2>
    <p><b>Entregar antes de:</b> ${esc(o.readyBy)} · <b>Pagado:</b> $${(o.amountPaid / 100).toFixed(2)}${o.promo ? ` (descuento $${(o.promo / 100).toFixed(2)})` : ""}</p>
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

async function confirmCustomer(o) {
  const who = o.relation === "myself" ? "your" : `${esc(o.name)}'s`;
  const html = `
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2C2C2C">
    <p style="font-size:13px;letter-spacing:.1em;color:#A07830;text-transform:uppercase;font-family:Arial,sans-serif">GraceSong</p>
    <h1 style="color:#1B2A4A;font-size:26px;line-height:1.25">We've started writing ${who} song 🎵</h1>
    <p style="font-size:16px;line-height:1.6">Hi ${esc(o.buyerName)}, thank you for trusting us with your story. Our team is already working on <b>“${esc(o.title)}”</b>.</p>
    <p style="font-size:16px;line-height:1.6">Your song will arrive in this inbox <b>by ${esc(o.readyBy)}</b>, as a private link where you can listen, download it and share it with family.</p>
    <p style="font-size:15px;line-height:1.6;background:#FBF6EA;padding:14px;border-radius:10px">🎥 <b>A little idea:</b> when they hear it for the first time, press record. Send us their reaction and we'll gift you a free GraceSong for someone else you love.</p>
    <p style="font-size:15px;line-height:1.6">Want to add a detail or fix a name? Just reply to this email.</p>
    <p style="font-size:15px">With love,<br>The GraceSong team</p>
    <p style="font-size:12px;color:#888;font-family:Arial,sans-serif">Order ${esc(o.id)} · 7-day “love it” guarantee</p>
  </div>`;
  return sendEmail({ to: o.email, subject: `We're writing ${o.relation === "myself" ? "your" : `${o.name}'s`} GraceSong 🎵`, html, replyTo: NOTIFY_EMAIL });
}
