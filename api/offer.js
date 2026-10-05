// POST /api/offer — compra de un clic de una oferta después del pago: { session_id, offer: "song2" | "video" }.
// Cobra con la tarjeta guardada en el pago principal. Si el banco pide verificación (o no hay tarjeta guardada),
// devuelve la URL de un Checkout normal solo por la oferta; el webhook la registra al pagarse.
import { stripe, json, siteOrigin, loadOrder, OFFERS } from "./_lib.js";
import { recordOffer, song2Link } from "./_offers.js";

const VENTANA_HORAS = 6; // la oferta solo vale poco después del pago principal

export async function POST(req) {
  let input;
  try { input = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const { session_id: sid, offer } = input || {};
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sid || "") || !OFFERS[offer]) return json({ error: "bad_request" }, 400);

  const st = stripe();
  let s;
  try { s = await st.checkout.sessions.retrieve(sid, { expand: ["payment_intent"] }); } catch { return json({ error: "not_found" }, 404); }
  if (s.metadata?.kind === "offer" || !["paid", "no_payment_required"].includes(s.payment_status)) return json({ error: "not_paid" }, 400);
  if (Date.now() / 1000 - s.created > VENTANA_HORAS * 3600) return json({ error: "expired" }, 410);

  const origin = siteOrigin(req);
  let order = await loadOrder(s.metadata?.order_id);
  if (!order) return json({ error: "order_not_found" }, 404);
  const done = (o, eventId) => json({ ok: true, eventId, value: OFFERS[offer].cents / 100, ...(offer === "song2" && { link: song2Link(origin, o) }) });
  if (order.offers?.[offer]) return done(order, order.offers[offer].ref);

  // 1) Un clic: tarjeta guardada
  const pm = s.payment_intent?.payment_method;
  if (s.customer && pm) {
    try {
      const pi = await st.paymentIntents.create({
        amount: OFFERS[offer].cents, currency: "usd", customer: s.customer, payment_method: pm,
        off_session: true, confirm: true,
        description: `GraceSong ${order.id} · ${OFFERS[offer].name}`,
        metadata: { order_id: order.id, offer },
      }, { idempotencyKey: `offer-${s.id}-${offer}` });
      if (pi.status === "succeeded") {
        order = await recordOffer(order, offer, pi.id, origin);
        return done(order, pi.id);
      }
    } catch (e) {
      console.warn("offer: cobro de un clic no posible:", e.code || e.message);
    }
  }

  // 2) Plan B: Checkout normal solo por la oferta
  try {
    const back = `${origin}/offer?session_id=${s.id}&step=${offer === "song2" ? "video" : "end"}`;
    const c = await st.checkout.sessions.create({
      mode: "payment",
      ...(s.customer ? { customer: s.customer } : { customer_email: order.email }),
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: OFFERS[offer].cents, product_data: { name: OFFERS[offer].name, description: OFFERS[offer].desc } } }],
      metadata: { kind: "offer", order_id: order.id, offer, main_session: s.id },
      payment_intent_data: { metadata: { order_id: order.id, offer }, description: `GraceSong ${order.id} · ${OFFERS[offer].name}` },
      success_url: `${origin}/thanks?session_id=${s.id}`,
      cancel_url: back,
    });
    return json({ checkout: c.url });
  } catch (e) {
    console.error("offer checkout:", e);
    return json({ error: "server" }, 500);
  }
}
