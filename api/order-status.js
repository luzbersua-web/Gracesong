// GET /api/order-status?session_id=... — la página de gracias confirma el pago (y luego dispara el píxel).
import { stripe, json, deliveryDate, loadOrder, siteOrigin } from "./_lib.js";
import { song2Link } from "./_offers.js";

export async function GET(req) {
  const id = new URL(req.url).searchParams.get("session_id") || "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return json({ error: "bad_request" }, 400);
  try {
    const s = await stripe().checkout.sessions.retrieve(id);
    const paid = ["paid", "no_payment_required"].includes(s.payment_status);
    const order = paid ? await loadOrder(s.metadata?.order_id).catch(() => null) : null;
    return json({
      paid,
      eventId: s.id, // mismo ID que usará la API de Conversiones, para que Meta no duplique la compra
      value: (s.amount_total || 0) / 100,
      currency: (s.currency || "usd").toUpperCase(),
      readyBy: deliveryDate(new Date(s.created * 1000)),
      firstName: s.customer_details?.name?.split(" ")[0] || null,
      offers: Object.keys(order?.offers || {}),
      song2Link: order?.song2Token && !order.song2Used ? song2Link(siteOrigin(req), order) : null,
    });
  } catch (e) {
    console.error("order-status:", e.message);
    return json({ error: "not_found" }, 404);
  }
}
