// POST /api/checkout — guarda el pedido (aún sin pagar) y devuelve la URL de Stripe Checkout.
import { stripe, json, siteOrigin, newOrderId, saveOrder, cleanOrder, orderProblem, metaContext, PRICE_CENTS, BUMP_CENTS } from "./_lib.js";

export async function POST(req) {
  let input;
  try { input = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  const order = cleanOrder(input);
  const problem = orderProblem(order);
  if (problem) return json({ error: "invalid", field: problem }, 400);

  order.id = newOrderId();
  order.status = "pending_payment";
  order.createdAt = new Date().toISOString();
  order.amount = PRICE_CENTS + (order.bump ? BUMP_CENTS : 0);
  order.meta = metaContext(req); // para la API de Conversiones de Meta

  const origin = siteOrigin(req);
  const who = order.relation === "myself" ? "you" : order.name;
  try {
    await saveOrder(order);
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: PRICE_CENTS,
          product_data: {
            name: `Custom GraceSong for ${who}`,
            description: `“${order.title}” · ready in 24 hours · printable lyric sheet included`,
          },
        },
      }, ...(order.bump ? [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: BUMP_CENTS,
          product_data: { name: "Keepsake Lyric Art", description: "Frame-ready printable design of your song (8×10 and 11×14 PDF)" },
        },
      }] : [])],
      customer_email: order.email,
      customer_creation: "always", // cliente en Stripe con la tarjeta guardada para las ofertas de un clic
      client_reference_id: order.id,
      metadata: { order_id: order.id },
      payment_intent_data: { metadata: { order_id: order.id }, description: `GraceSong ${order.id}`, setup_future_usage: "off_session" },
      allow_promotion_codes: true, // para los códigos de recompensa (20% / canción gratis)
      success_url: `${origin}/offer?session_id={CHECKOUT_SESSION_ID}`, // primero la oferta, luego /thanks
      cancel_url: `${origin}/create?canceled=1`,
    });
    return json({ url: session.url });
  } catch (e) {
    console.error("checkout:", e);
    return json({ error: "server" }, 500);
  }
}
