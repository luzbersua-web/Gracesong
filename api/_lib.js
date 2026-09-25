// Utilidades compartidas por las funciones de /api (los archivos con "_" no son rutas en Vercel).
import Stripe from "stripe";
import { put, get } from "@vercel/blob";
import { Resend } from "resend";

export const PRICE_CENTS = 3700;
export const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "gracesongofficial@gmail.com";
export const EMAIL_FROM = process.env.EMAIL_FROM || "GraceSong <hello@getgracesong.com>";
const BLOB_ACCESS = process.env.BLOB_ACCESS || "private";

export const stripe = () => new Stripe(process.env.STRIPE_SECRET_KEY);

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export function siteOrigin(req) {
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || u.host;
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export function newOrderId() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return "gs_" + [...bytes].map((b) => abc[b % abc.length]).join("");
}

// ---------- pedidos en Vercel Blob (privados) ----------
const orderPath = (id) => `orders/${id}.json`;

export async function saveOrder(order) {
  await put(orderPath(order.id), JSON.stringify(order, null, 2), {
    access: BLOB_ACCESS, contentType: "application/json", addRandomSuffix: false, allowOverwrite: true,
  });
}

export async function loadOrder(id) {
  if (!/^gs_[a-z0-9]{12}$/.test(id || "")) return null;
  const r = await get(orderPath(id), { access: BLOB_ACCESS });
  if (!r || !r.stream) return null;
  return JSON.parse(await new Response(r.stream).text());
}

// ---------- limpieza de lo que manda el cuestionario ----------
const FIELDS = {
  relation: 20, pronoun: 10, name: 40, pronunciation: 60, occasion: 30, giftDate: 10,
  genre: 30, voice: 10, mood: 20, traits: 600, story: 2000, otherNames: 200, verse: 80,
  thanks: 600, message: 400, title: 80, buyerName: 40, email: 120,
};

export function cleanOrder(input) {
  const o = {};
  for (const [k, max] of Object.entries(FIELDS)) {
    const v = input?.[k];
    if (typeof v === "string") o[k] = v.trim().slice(0, max);
  }
  o.qualities = Array.isArray(input?.qualities) ? input.qualities.filter((q) => typeof q === "string").slice(0, 5).map((q) => q.slice(0, 30)) : [];
  return o;
}

export function orderProblem(o) {
  if (!o.relation) return "relation";
  if (o.relation !== "myself" && !o.name) return "name";
  if (!o.occasion || !o.genre || !o.voice || !o.mood) return "style";
  if (!o.story || o.story.length < 60) return "story";
  if (!o.message) return "message";
  if (!o.buyerName) return "buyerName";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(o.email || "")) return "email";
  return null;
}

// ---------- textos para producir la canción ----------
const GENRE_STYLE = {
  worship: "acoustic worship, soft piano, prayerful",
  "country-gospel": "country gospel, acoustic guitar, warm",
  contemporary: "contemporary christian, piano and strings, radio ballad",
  gospel: "gospel choir, soulful, uplifting",
  ballad: "piano ballad, intimate, emotional",
  acoustic: "acoustic folk, gentle guitar, heartfelt",
};
const VOICE_STYLE = { female: "female vocals", male: "male vocals, warm baritone", duet: "male and female duet vocals" };
const MOOD_STYLE = { tender: "tender, emotional", uplifting: "uplifting, hopeful", joyful: "joyful, celebratory" };

export function musicStyle(o) {
  return [GENRE_STYLE[o.genre], VOICE_STYLE[o.voice], MOOD_STYLE[o.mood], "radio quality"].filter(Boolean).join(", ");
}

export function recipientLabel(o) {
  return o.relation === "myself" ? "the buyer (a song for themselves)" : `${o.name}${o.pronunciation ? ` (pronounced: ${o.pronunciation})` : ""}`;
}

// Instrucción para escribir la letra (se usará con la API de Claude en la etapa 2; mientras, va en el email)
export function lyricPrompt(o) {
  return `You are a professional Christian songwriter. Write a complete, deeply personal song using ONLY these real details.

FOR: ${recipientLabel(o)} — relationship to buyer: ${o.relation}${o.pronoun ? ` (refer to them as ${o.pronoun})` : ""}
FROM: ${o.buyerName}
OCCASION: ${o.occasion}
SONG TITLE: ${o.title || ""}
QUALITIES: ${[...(o.qualities || []), o.traits].filter(Boolean).join("; ")}
STORY & MEMORIES: ${o.story}
OTHER NAMES TO INCLUDE: ${o.otherNames || "none"}
BIBLE VERSE TO WEAVE IN: ${o.verse && o.verse !== "none" ? o.verse : "your choice, subtle"}
WHAT THEY THANK GOD FOR: ${o.thanks || "—"}
FINAL LINE (end the song with this idea): ${o.message}
MOOD: ${o.mood}

RULES:
- Use the name in the chorus at least twice, naturally${o.relation === "myself" ? " (for a song to oneself, use 'I'/'me' instead of a name)" : ""}
- Every line must feel like it could ONLY be about this person; use the concrete details above
- Structure with labels on their own lines: [Verse 1] [Chorus] [Verse 2] [Chorus] [Bridge] [Chorus]
- Faith should feel warm and natural, never preachy
- 20-26 lines of lyrics total
- Output ONLY the lyrics with section labels.`;
}

export function deliveryDate(from = new Date()) {
  return new Date(from.getTime() + 24 * 3600 * 1000).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" });
}

// ---------- email ----------
export async function sendEmail({ to, subject, html, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY no configurada; email no enviado:", subject);
    return { skipped: true };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html, replyTo });
  if (error) console.error("Error de Resend:", error);
  return { error };
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
