// GraceSong — formulario de reseña y video de reacción.
// El envío va a /api/share (se conecta junto con el backend); mientras no exista, avisa que está en modo prueba.

const MAX_MB = 500;
const $ = (s) => document.querySelector(s);
let rating = 0;

// Si llega desde el email de entrega: /share/?email=...
try {
  const e = new URLSearchParams(location.search).get("email");
  if (e) $("#s-email").value = e;
} catch { /* sin parámetros */ }

document.querySelectorAll("#stars button").forEach((b) => b.onclick = () => {
  rating = +b.dataset.v;
  document.querySelectorAll("#stars button").forEach((x) => x.classList.toggle("on", +x.dataset.v <= rating));
});

const video = $("#s-video");
video.onchange = () => {
  const f = video.files[0];
  const has = !!f;
  $("#drop").classList.toggle("has", has);
  $("#drop-t").textContent = has ? `✓ ${f.name} (${Math.round(f.size / 1e6)} MB)` : "Tap to choose a video";
  // Con video pedimos también el permiso de las personas que aparecen
  $("#c-video-txt").hidden = !has;
  $("#c-people-row").hidden = !has;
};

function fail(msg, sel) {
  const err = $("#s-err");
  err.textContent = msg; err.hidden = false;
  if (sel) { const f = $(sel); f.classList.add("field-err"); f.focus(); f.oninput = () => f.classList.remove("field-err"); }
}

$("#share-form").onsubmit = async (ev) => {
  ev.preventDefault();
  $("#s-err").hidden = true;
  const email = $("#s-email").value.trim(), name = $("#s-name").value.trim(), story = $("#s-story").value.trim();
  const f = video.files[0];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail("Please check your email address.", "#s-email");
  if (!name) return fail("Please write your first name.", "#s-name");
  if (!rating) return fail("Please choose a rating.");
  if (story.length < 20) return fail("Please tell us a little more about your experience.", "#s-story");
  if (f && f.size > MAX_MB * 1e6) return fail(`The video is larger than ${MAX_MB} MB. Please trim it or send a shorter clip.`);
  if (!$("#c-use").checked) return fail("Please check the permission box so we can share your story.");
  if (f && !$("#c-people").checked) return fail("Please confirm that everyone in the video agreed to be shared.");

  const btn = $("#s-submit");
  btn.disabled = true; btn.textContent = f ? "Uploading your video…" : "Sending…";
  const body = new FormData();
  body.append("email", email); body.append("name", name); body.append("city", $("#s-city").value.trim());
  body.append("rating", rating); body.append("story", story);
  body.append("consentShare", "yes"); body.append("consentPeople", f ? "yes" : "n/a");
  if (f) body.append("video", f);

  try {
    const r = await fetch("/api/share", { method: "POST", body });
    if (!r.ok) throw new Error("HTTP " + r.status);
    $("#share-form").hidden = true;
    $("#done").hidden = false;
    $("#done-t").textContent = f
      ? "We received your story and the reaction video. Your code for a free GraceSong will arrive by email within 48 hours."
      : "We received your story. Your 20% off code will arrive by email within 48 hours.";
    window.scrollTo({ top: $("#done").offsetTop - 80, behavior: "smooth" });
  } catch (e) {
    console.info("Envío (backend aún no conectado):", Object.fromEntries([...body].map(([k, v]) => [k, v instanceof File ? v.name : v])));
    fail("Sending isn't connected yet (test mode).");
    btn.disabled = false; btn.textContent = "Send my story";
  }
};
