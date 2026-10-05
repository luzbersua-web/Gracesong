// Registro de una oferta comprada después del pago (upsell / downsell). Idempotente: si ya estaba, no repite nada.
import { loadOrder, saveOrder, sendMetaPurchase, randomCode, OFFERS } from "./_lib.js";
import { notifyOwnerOffer, confirmCustomerOffer } from "./_emails.js";

export const song2Link = (origin, o) => `${origin}/create?prepaid=${o.id}.${o.song2Token}`;

export async function recordOffer(order, offer, ref, origin) {
  if (!OFFERS[offer]) return order;
  const fresh = (await loadOrder(order.id)) || order; // releer por si el webhook y el clic llegan a la vez
  if (fresh.offers?.[offer]) return fresh;
  fresh.offers = { ...fresh.offers, [offer]: { amount: OFFERS[offer].cents, ref, at: new Date().toISOString() } };
  if (offer === "song2") fresh.song2Token = randomCode(16);
  await saveOrder(fresh);
  const link = offer === "song2" ? song2Link(origin, fresh) : null;
  await Promise.all([
    notifyOwnerOffer(fresh, offer, link),
    confirmCustomerOffer(fresh, offer, link),
    sendMetaPurchase(fresh, { eventId: ref, value: OFFERS[offer].cents / 100, currency: "USD", name: OFFERS[offer].name }, origin),
  ]);
  return fresh;
}
