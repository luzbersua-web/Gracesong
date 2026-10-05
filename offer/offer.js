// Ofertas después del pago: upsell (2ª canción, $27) y, si lo rechaza, downsell (video con la letra, $12).
// Cobro de un clic con /api/offer; si el banco pide verificación, /api/offer devuelve un Checkout normal.
(async function () {
  const $ = (s) => document.getElementById(s);
  const qs = new URLSearchParams(location.search);
  const sessionId = qs.get("session_id");
  const thanks = () => location.replace("/thanks?session_id=" + encodeURIComponent(sessionId || ""));

  // Nombre y pronombre desde lo que se guardó en el cuestionario
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("gs_order_v1")); } catch { /* sin datos */ }
  const HIM = ["husband", "dad", "son", "grandpa"];
  const myself = saved?.relation === "myself";
  const pron = myself ? "yours" : HIM.includes(saved?.relation) || saved?.pronoun === "him" ? "his" : saved?.pronoun === "them" ? "theirs" : "hers";
  const nameOr = (fallback) => (myself ? "your family" : (saved?.name || "").trim() || fallback);

  let st = null;
  if (sessionId) {
    try {
      const r = await fetch("/api/order-status?session_id=" + encodeURIComponent(sessionId));
      if (r.ok) st = await r.json();
    } catch { /* red */ }
  }
  if (!st || !st.paid) return thanks(); // la página de gracias explica qué pasó

  const bought = new Set(st.offers || []);
  let step = qs.get("step") || "song2";
  if (bought.has("song2") || step === "end") return thanks();
  if (step === "video" && bought.has("video")) return thanks();

  document.querySelectorAll("#song2 .js-name").forEach((el) => el.textContent = myself ? "yours" : pron);
  document.querySelectorAll("#video .js-name").forEach((el) => el.textContent = nameOr(pron === "his" ? "him" : pron === "theirs" ? "them" : "her"));

  function show(which) {
    step = which;
    $("loading").hidden = true;
    $("song2").hidden = which !== "song2";
    $("video").hidden = which !== "video";
    history.replaceState(null, "", `/offer?session_id=${encodeURIComponent(sessionId)}&step=${which}`);
    window.scrollTo({ top: 0 });
  }

  async function buy(offer) {
    const btn = $("yes-" + offer), err = $("err-" + offer);
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Adding it to your order…"; err.hidden = true;
    try {
      const r = await fetch("/api/offer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId, offer }) });
      const res = await r.json().catch(() => ({}));
      if (res.checkout) return location.assign(res.checkout); // el banco pidió verificación: pago normal
      if (!r.ok || !res.ok) throw new Error(res.error || "HTTP " + r.status);
      try {
        const key = "gs_purchase_" + res.eventId;
        if (window.fbq && !localStorage.getItem(key)) {
          window.fbq("track", "Purchase", { value: res.value, currency: "USD", content_name: offer === "song2" ? "Second GraceSong" : "Lyric Video" }, { eventID: res.eventId });
          localStorage.setItem(key, "1");
        }
      } catch { /* sin píxel */ }
      thanks();
    } catch (e) {
      console.error("offer:", e);
      err.textContent = e.message === "expired"
        ? "This offer has expired, but your song order is complete."
        : "We couldn't add it right now. Your song order is complete — you can continue below.";
      err.hidden = false;
      btn.disabled = false; btn.textContent = label;
    }
  }

  $("yes-song2").onclick = () => buy("song2");
  $("no-song2").onclick = () => show("video");
  $("yes-video").onclick = () => buy("video");
  $("no-video").onclick = thanks;
  show(step === "video" ? "video" : "song2");
})();
