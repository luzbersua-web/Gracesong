// POST /api/second-song — el cliente que compró la 2ª canción (upsell) envía la historia de la otra persona.
// Body: lo mismo que /api/checkout + { prepaid: "<id del pedido original>.<token>" }
import { json, loadOrder, saveOrder, newOrderId, cleanOrder, orderProblem, deliveryDate } from "./_lib.js";
import { notifyOwner, confirmCustomer } from "./_emails.js";

export async function POST(req) {
  let input;
  try { input = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const [mainId, token] = String(input?.prepaid || "").split(".");
  const main = await loadOrder(mainId);
  if (!main || !main.offers?.song2 || !token || main.song2Token !== token) return json({ error: "invalid_link" }, 403);
  if (main.song2Used) return json({ error: "already_used" }, 409);

  const order = cleanOrder(input);
  order.bump = false;
  const problem = orderProblem(order);
  if (problem) return json({ error: "invalid", field: problem }, 400);

  const now = new Date();
  Object.assign(order, {
    id: newOrderId(), status: "paid", createdAt: now.toISOString(), paidAt: now.toISOString(),
    readyBy: deliveryDate(now), amount: 0, amountPaid: 0, prepaidBy: main.id,
  });
  await saveOrder(order);
  main.song2Used = order.id;
  await saveOrder(main);
  await Promise.all([notifyOwner(order), confirmCustomer(order)]);
  return json({ ok: true, readyBy: order.readyBy });
}
