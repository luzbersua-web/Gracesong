// Página de gracias: confirma el pago con /api/order-status, personaliza el mensaje
// y deja lista la señal de compra para el píxel de Meta (se activa cuando se agregue el píxel).
(async function () {
  const $ = (s) => document.getElementById(s);
  const sessionId = new URLSearchParams(location.search).get("session_id");

  // Nombre de la persona desde lo que se guardó en el cuestionario
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("gs_order_v1")); } catch { /* sin datos */ }

  let st = null;
  if (sessionId) {
    try {
      const r = await fetch("/api/order-status?session_id=" + encodeURIComponent(sessionId));
      if (r.ok) st = await r.json();
    } catch { /* red */ }
  }

  $("loading").hidden = true;
  if (!st || !st.paid) { $("fail").hidden = false; return; }

  $("ok").hidden = false;
  if (saved?.relation === "myself") $("ty-title").textContent = "Thank you! We're writing your song.";
  else if (saved?.name) $("ty-title").textContent = `Thank you! We're writing ${saved.name}'s song.`;
  if (saved?.title) $("ty-lead").textContent = `Your order for “${saved.title}” is confirmed. We just sent a confirmation email to ${saved.email || "you"}.`;
  if (st.readyBy) $("ty-ready").textContent = `Your song will arrive by ${st.readyBy}.`;

  // Compra para el píxel: una sola vez por sesión, con el mismo ID que usará la API de Conversiones
  try {
    const key = "gs_purchase_" + st.eventId;
    if (window.fbq && !localStorage.getItem(key)) {
      window.fbq("track", "Purchase", { value: st.value, currency: st.currency, content_name: "GraceSong" }, { eventID: st.eventId });
      localStorage.setItem(key, "1");
    }
  } catch { /* sin píxel */ }

  // El pedido ya está hecho: limpiamos el borrador del cuestionario
  try { localStorage.removeItem("gs_order_v1"); } catch { /* modo privado */ }
})();
