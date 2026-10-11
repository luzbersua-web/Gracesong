// Utilidades compartidas por las funciones de /api (los archivos con "_" no son rutas en Vercel).
import Stripe from "stripe";
import { put, get } from "@vercel/blob";
import { Resend } from "resend";

export const PRICE_CENTS = 3700;
export const BUMP_CENTS = 1200; // order bump: Keepsake Lyric Art
// Ofertas después del pago: upsell (2ª canción) y downsell (video con la letra)
export const OFFERS = {
  song2: { cents: 2700, name: "Second GraceSong", desc: "A second personalized song for someone else you love" },
  video: { cents: 1200, name: "Lyric Video", desc: "Your song as a lyric video, for phones and TV" },
};
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

export function randomCode(n) {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  return [...crypto.getRandomValues(new Uint8Array(n))].map((b) => abc[b % abc.length]).join("");
}
export const newOrderId = () => "gs_" + randomCode(12);

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
  o.bump = input?.bump === true;
  if (o.bump) o.bumpStyle = input?.bumpStyle === "classic" ? "classic" : "romantic";
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
  worship: "contemporary christian worship, cinematic piano, soft acoustic guitar, gentle strings, prayerful, building intensity",
  "country-gospel": "country gospel, acoustic guitar, warm, heartfelt, congregational chorus",
  contemporary: "contemporary christian worship, cinematic piano, acoustic guitar, gentle strings, building intensity, congregational chorus, similar to Phil Wickham and Chris Tomlin",
  gospel: "gospel choir, soulful, uplifting, building intensity",
  ballad: "piano ballad, cinematic strings, intimate, emotional, building intensity",
  acoustic: "acoustic folk, gentle guitar, heartfelt, warm and hopeful",
};
const VOICE_STYLE = { female: "powerful emotional female vocals, clear diction", male: "powerful male vocals, warm baritone, clear diction", duet: "male and female duet vocals, clear diction" };
const MOOD_STYLE = { tender: "tender, emotional", uplifting: "uplifting, hopeful", joyful: "joyful, celebratory" };

export function musicStyle(o) {
  return [GENRE_STYLE[o.genre], VOICE_STYLE[o.voice], MOOD_STYLE[o.mood], "faith-centered lyrics, professional studio production, radio quality"].filter(Boolean).join(", ");
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
- Structure with labels on their own lines: [Verse 1] [Pre-Chorus] [Chorus] [Verse 2] [Pre-Chorus] [Chorus] [Bridge] [Final Chorus]
- Every detail above must appear in the song. If a detail contains a phrase in quotes, a catchphrase or words in Spanish, sing it EXACTLY as written (do not translate it), woven into the story and again in the Final Chorus or last line
- Name the real places, dates and events from the story; no generic filler
- Verses and Bridge: 4 lines each. Pre-Chorus: 2 lines. Chorus and Final Chorus: 4 lines each. About 32-38 lines in total
- Keep every line short and singable (about 6-12 words) so it can be sung clearly without rushing
- Faith should feel warm and natural, never preachy
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

// ---------- Meta: API de Conversiones ----------
export const META_PIXEL_ID = process.env.META_PIXEL_ID || "4584382561806826";

// Datos del navegador que ayudan a Meta a reconocer al comprador (se guardan con el pedido en /api/checkout).
export function metaContext(req) {
  const cookies = {};
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) cookies[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return {
    fbp: cookies._fbp || null,
    fbc: cookies._fbc || null,
    ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null,
    ua: req.headers.get("user-agent") || null,
  };
}

const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))]
  .map((b) => b.toString(16).padStart(2, "0")).join("");

// Purchase desde el servidor, con el mismo event_id que el píxel del navegador para que Meta no lo cuente dos veces.
// compra = { eventId, value (dólares), currency }
export async function sendMetaPurchase(o, compra, origin) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) { console.warn("META_CAPI_TOKEN no configurado; Purchase no enviado a Meta"); return; }
  const m = o.meta || {};
  const firstName = (o.buyerName || "").trim().split(/\s+/)[0].toLowerCase();
  const user_data = {
    em: [await sha256(o.email.trim().toLowerCase())],
    external_id: [await sha256(o.id)],
    ...(firstName && { fn: [await sha256(firstName)] }),
    ...(m.ip && { client_ip_address: m.ip }),
    ...(m.ua && { client_user_agent: m.ua }),
    ...(m.fbp && { fbp: m.fbp }),
    ...(m.fbc && { fbc: m.fbc }),
  };
  const body = {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: compra.eventId,
      action_source: "website",
      event_source_url: `${origin}/thanks`,
      user_data,
      custom_data: { value: compra.value, currency: compra.currency || "USD", content_name: compra.name || "GraceSong", order_id: o.id },
    }],
    ...(process.env.META_TEST_EVENT_CODE && { test_event_code: process.env.META_TEST_EVENT_CODE }),
    access_token: token,
  };
  try {
    const r = await fetch(`https://graph.facebook.com/v23.0/${META_PIXEL_ID}/events`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!r.ok) console.error("Meta CAPI:", r.status, await r.text());
  } catch (e) {
    console.error("Meta CAPI:", e.message);
  }
}
