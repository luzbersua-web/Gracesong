// POST /api/stripe-webhook — Stripe avisa cuando se paga. Marca el pedido como pagado y envía los emails.
import { stripe, json, siteOrigin, loadOrder, saveOrder, deliveryDate, sendMetaPurchase } from "./_lib.js";
import { notifyOwner, confirmCustomer } from "./_emails.js";
import { recordOffer } from "./_offers.js";
import { waitUntil } from "@vercel/functions";
import { autoEnabled, produceOrder } from "./_produce.js";

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
  // Oferta pagada con Checkout normal (cuando el cobro de un clic no fue posible)
  if (order && session.metadata?.kind === "offer") {
    await recordOffer(order, session.metadata.offer, session.payment_intent || session.id, siteOrigin(req));
    return json({ ok: true, offer: session.metadata.offer });
  }
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

  await Promise.all([notifyOwner(order), confirmCustomer(order), sendMetaPurchase(order, { eventId: session.id, value: (session.amount_total || 0) / 100, currency: (session.currency || "usd").toUpperCase() }, siteOrigin(req))]);
  if (autoEnabled()) waitUntil(produceOrder(order.id, siteOrigin(req))); // canción en segundo plano; Luz la aprueba antes de enviarla
  return json({ ok: true });
}
