// /api/approve?id=...&t=... — página privada de Luz para escuchar, aprobar o rehacer una canción.
// GET muestra la canción (no cambia nada, así los escáneres de correo no aprueban solos).
// POST con action=approve envía la canción al cliente; action=redo genera otra versión.
import { waitUntil } from "@vercel/functions";
import { loadOrder, saveOrder, siteOrigin, esc, recipientLabel } from "./_lib.js";
import { checkToken, signToken, produceOrder } from "./_produce.js";
import { deliverSong } from "./_emails.js";

const page = (body, status = 200) => new Response(
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Aprobar canción — GraceSong</title>
  <style>body{font-family:Arial,sans-serif;background:#FBF6EA;color:#222;margin:0;padding:24px}main{max-width:620px;margin:0 auto;background:#fff;border-radius:14px;padding:22px;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  h1{color:#1B2A4A;font-size:22px}pre{white-space:pre-wrap;background:#f6f3ea;padding:14px;border-radius:10px;font-family:Georgia,serif;font-size:15px;line-height:1.6}
  button{border:0;border-radius:30px;padding:14px 22px;font-weight:bold;font-size:15px;cursor:pointer;margin:6px 6px 6px 0}.ok{background:#C9A84C;color:#1B2A4A}.redo{background:#e8e4d8;color:#333}
  audio{width:100%;margin:10px 0}.muted{color:#666;font-size:13px}</style></head><body><main>${body}</main></body></html>`,
  { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

async function view(order, id, t) {
  const listen = await signToken(id, "approve");
  return page(`<h1>🎵 “${esc(order.title)}”</h1>
    <p class="muted">Para ${esc(recipientLabel(order))} · cliente ${esc(order.buyerName)} &lt;${esc(order.email)}&gt; · estado: <b>${esc(order.status)}</b></p>
    ${order.status === "delivered" ? `<p>✅ Ya se envió al cliente el ${esc(order.deliveredAt)}.</p>` : ""}
    <audio controls preload="auto" src="/api/song?id=${id}&t=${listen}&who=owner"></audio>
    <h3>Letra</h3><pre>${esc(order.lyrics || "(sin letra)")}</pre>
    ${["awaiting_approval", "delivered"].includes(order.status) ? `<form method="post">
      <input type="hidden" name="id" value="${id}"><input type="hidden" name="t" value="${esc(t)}">
      <button class="ok" name="action" value="approve">✅ ${order.status === "delivered" ? "Reenviar al cliente" : "Aprobar y enviar al cliente"}</button>
      <button class="redo" name="action" value="redo">🔄 Hacer otra versión (letra y música nuevas)</button>
      <h3>Editar la letra</h3>
      <textarea name="lyrics" rows="16" style="width:100%;box-sizing:border-box;font-family:Georgia,serif;font-size:15px;padding:10px;border-radius:10px;border:1px solid #ccc">${esc(order.lyrics || "")}</textarea>
      <button class="redo" name="action" value="redo_same">🎼 Misma letra (con mis cambios), otra música</button></form>
      <p class="muted">Al aprobar, el cliente recibe un enlace privado para escuchar y descargar su canción.</p>` : `<p>⏳ La canción se está produciendo o falló; mira tu correo. Si pasaron más de 10 minutos desde el pago, se trabó: reintenta.</p>
    <form method="post"><input type="hidden" name="id" value="${id}"><input type="hidden" name="t" value="${esc(t)}">
      <button class="redo" name="action" value="${order.lyrics ? "redo_same" : "redo"}">🔄 Reintentar producción${order.lyrics ? " (misma letra)" : ""}</button>
      ${order.lyrics ? `<input type="hidden" name="lyrics" value="${esc(order.lyrics)}">` : ""}</form>`}`);
}

export async function GET(req) {
  const u = new URL(req.url);
  const id = u.searchParams.get("id") || "", t = u.searchParams.get("t") || "";
  if (!(await checkToken(id, "approve", t))) return page("<h1>Enlace no válido</h1>", 403);
  const order = await loadOrder(id);
  if (!order) return page("<h1>Pedido no encontrado</h1>", 404);
  return view(order, id, t);
}

export async function POST(req) {
  const form = await req.formData();
  const id = String(form.get("id") || ""), t = String(form.get("t") || ""), action = String(form.get("action") || "");
  if (!(await checkToken(id, "approve", t))) return page("<h1>Enlace no válido</h1>", 403);
  const order = await loadOrder(id);
  if (!order) return page("<h1>Pedido no encontrado</h1>", 404);
  const origin = siteOrigin(req);

  if (action === "redo") {
    waitUntil(produceOrder(id, origin));
    return page(`<h1>🔄 Haciendo otra versión</h1><p>Te llegará un correo nuevo cuando esté lista (unos minutos). El cliente no ha recibido nada.</p>`);
  }
  if (action === "redo_same") {
    const lyrics = String(form.get("lyrics") || "").slice(0, 6000);
    if (lyrics.trim().length < 200) return page("<h1>La letra está vacía o es muy corta</h1>", 400);
    waitUntil(produceOrder(id, origin, { lyrics }));
    return page(`<h1>🎼 Rehaciendo la música</h1><p>Se conserva la letra (con tus cambios) y se hace otra música. Te llegará un correo nuevo en unos minutos. El cliente no ha recibido nada.</p>`);
  }
  if (action === "approve") {
    if (!["awaiting_approval", "delivered"].includes(order.status)) return page("<h1>Esta canción aún no está lista</h1>", 409);
    const link = `${origin}/song?id=${id}&t=${await signToken(id, "listen")}`;
    await deliverSong(order, link);
    order.status = "delivered";
    order.deliveredAt = new Date().toISOString();
    await saveOrder(order);
    return page(`<h1>✅ Enviada</h1><p>El cliente (${esc(order.email)}) ya recibió el enlace privado de su canción.</p>`);
  }
  return page("<h1>Acción no válida</h1>", 400);
}
