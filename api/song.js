// GET /api/song?id=...&t=... — entrega privada de la canción.
//   (sin más)      → el audio (mp3)        &dl=1 → descarga      &format=json → título, letra y datos para la página /song
// t = token "listen" (cliente, tras la aprobación) o "approve" (Luz, para escuchar antes de aprobar: &who=owner)
import { get } from "@vercel/blob";
import { json, loadOrder, recipientLabel } from "./_lib.js";
import { checkToken, songPath } from "./_produce.js";

const BLOB_ACCESS = process.env.BLOB_ACCESS || "private";

export async function GET(req) {
  const u = new URL(req.url);
  const id = u.searchParams.get("id") || "", t = u.searchParams.get("t") || "";
  const owner = u.searchParams.get("who") === "owner";
  if (!(await checkToken(id, owner ? "approve" : "listen", t))) return json({ error: "forbidden" }, 403);
  const order = await loadOrder(id);
  if (!order || !["awaiting_approval", "delivered"].includes(order.status) || (!owner && order.status !== "delivered")) return json({ error: "not_ready" }, 404);

  if (u.searchParams.get("format") === "json") {
    return json({ title: order.title, lyrics: order.lyrics || "", forName: recipientLabel(order), from: order.buyerName });
  }
  const r = await get(songPath(id), { access: BLOB_ACCESS });
  if (!r || !r.stream) return json({ error: "not_found" }, 404);
  const safe = (order.title || "GraceSong").replace(/[^\w .-]+/g, "").trim().slice(0, 60) || "GraceSong";
  return new Response(r.stream, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, no-store",
      ...(u.searchParams.get("dl") === "1" && { "Content-Disposition": `attachment; filename="${safe}.mp3"` }),
    },
  });
}
