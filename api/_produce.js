// Etapa 2: producción automática de la canción.
// pago → letra (API de Claude) → música (ElevenLabs Music) → archivo privado en Blob → email a Luz para aprobar.
// Nada llega al cliente hasta que Luz aprueba (api/approve.js).
import { put } from "@vercel/blob";
import { loadOrder, saveOrder, lyricPrompt, musicStyle, sendEmail, esc, NOTIFY_EMAIL, recipientLabel } from "./_lib.js";

const BLOB_ACCESS = process.env.BLOB_ACCESS || "private";
export const songPath = (id) => `songs/${id}.mp3`;

// La automatización solo corre si Luz la enciende (AUTO_PRODUCE=1) y están las dos claves.
export function autoEnabled() {
  return process.env.AUTO_PRODUCE === "1" && !!process.env.ANTHROPIC_API_KEY && !!process.env.ELEVENLABS_API_KEY;
}

// ---------- enlaces firmados (sin base de datos) ----------
const secret = () => process.env.AUTOMATION_SECRET || process.env.STRIPE_WEBHOOK_SECRET || "";

export async function signToken(id, purpose) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}:${purpose}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
export async function checkToken(id, purpose, token) {
  if (!secret() || !token) return false;
  const good = await signToken(id, purpose);
  if (good.length !== String(token).length) return false;
  let diff = 0;
  for (let i = 0; i < good.length; i++) diff |= good.charCodeAt(i) ^ String(token).charCodeAt(i);
  return diff === 0;
}

// ---------- letra ----------
// Convierte "[Verse 1]\nlínea\nlínea\n\n[Chorus]..." en [{name, lines}]
export function parseLyrics(text) {
  const sections = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^\[(.+?)\]$/);
    if (m) { sections.push({ name: m[1].trim(), lines: [] }); continue; }
    if (!sections.length) sections.push({ name: "Verse 1", lines: [] });
    sections[sections.length - 1].lines.push(line);
  }
  return sections.filter((s) => s.lines.length);
}

export async function generateLyrics(order) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: lyricPrompt(order) }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  // Si la respuesta se cortó por límite de tokens, la letra queda incompleta: mejor fallar que mandar media canción.
  if (data.stop_reason === "max_tokens") throw new Error("La letra se cortó por límite de tokens (stop_reason=max_tokens)");
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  const sections = parseLyrics(text);
  const lineCount = sections.reduce((n, s) => n + s.lines.length, 0);
  if (sections.length < 4 || lineCount < 14) throw new Error("La letra generada es demasiado corta o sin estructura");
  return { text, sections };
}

// ---------- música ----------
const NEGATIVE = ["rap", "electronic", "distorted", "shouting"];

export function buildPlan(order, sections) {
  const male = order.voice === "male";
  const female = order.voice === "female";
  const negative = [...NEGATIVE, ...(male ? ["female vocals"] : female ? ["male vocals"] : [])];
  return {
    positive_global_styles: musicStyle(order).split(",").map((s) => s.trim()).filter(Boolean),
    negative_global_styles: negative,
    sections: sections.map((s) => ({
      section_name: s.name,
      duration_ms: Math.min(32000, Math.max(20000, s.lines.length * 6500)),
      positive_local_styles: [],
      negative_local_styles: [],
      lines: s.lines,
    })),
  };
}

export async function composeSong(order, sections) {
  const r = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192", {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ model_id: "music_v1", composition_plan: buildPlan(order, sections) }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}

// ---------- flujo completo ----------
// Se llama con waitUntil() desde el webhook (el pago responde rápido; la canción se hace en segundo plano).
export async function produceOrder(orderId, origin) {
  let order;
  try {
    order = await loadOrder(orderId);
    if (!order) throw new Error("Pedido no encontrado");
    if (order.status === "delivered") return;
    order.status = "producing";
    order.attempts = (order.attempts || 0) + 1;
    await saveOrder(order);

    const lyrics = await generateLyrics(order);
    const audio = await composeSong(order, lyrics.sections);
    await put(songPath(order.id), audio, { access: BLOB_ACCESS, contentType: "audio/mpeg", addRandomSuffix: false, allowOverwrite: true });

    order = (await loadOrder(orderId)) || order;
    Object.assign(order, {
      status: "awaiting_approval",
      lyrics: lyrics.text,
      songReadyAt: new Date().toISOString(),
      autoError: null,
    });
    await saveOrder(order);
    await notifyApproval(order, origin);
  } catch (e) {
    console.error("produceOrder:", e);
    try {
      order = (await loadOrder(orderId)) || order;
      if (order) { order.status = "paid"; order.autoError = String(e.message || e).slice(0, 300); await saveOrder(order); }
    } catch {}
    await sendEmail({
      to: NOTIFY_EMAIL,
      subject: `⚠️ Falló la producción automática — pedido ${orderId}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px"><h2>⚠️ La canción NO se pudo hacer sola</h2>
        <p>Pedido <b>${esc(orderId)}</b>. Hazla a mano con el email del pedido (tiene la letra y el estilo).</p>
        <p style="color:#a00">${esc(String(e.message || e))}</p></div>`,
    });
  }
}

export async function notifyApproval(order, origin) {
  const t = await signToken(order.id, "approve");
  const link = `${origin}/api/approve?id=${order.id}&t=${t}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px">
    <h2 style="color:#1B2A4A">🎵 Canción lista para aprobar</h2>
    <p>“${esc(order.title)}” para ${esc(recipientLabel(order))} · cliente ${esc(order.buyerName)} &lt;${esc(order.email)}&gt; · entregar antes de <b>${esc(order.readyBy)}</b></p>
    <p style="margin:22px 0"><a href="${link}" style="background:#C9A84C;color:#1B2A4A;padding:14px 26px;border-radius:30px;text-decoration:none;font-weight:bold">Escuchar y aprobar</a></p>
    <p style="font-size:13px;color:#666">Ahí escuchas la canción, lees la letra y eliges <b>Aprobar y enviar</b> o <b>Hacer otra versión</b>. El cliente no recibe nada hasta que aprobes.</p>
    ${order.bump ? `<p style="background:#FFF3C4;padding:10px;border-radius:8px">🖼️ Incluye Keepsake Lyric Art: la lámina sigue siendo manual (comando en el correo del pedido).</p>` : ""}
    </div>`;
  return sendEmail({ to: NOTIFY_EMAIL, subject: `🎵 Aprobar: “${order.title}” — ${order.buyerName}`, html });
}
