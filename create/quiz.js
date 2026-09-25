// GraceSong — cuestionario de pedido.
// Cada pantalla se define en SCREENS; las respuestas viven en `data` y se guardan en localStorage
// para que el cliente no pierda lo escrito si cierra la pestaña.

const STORE_KEY = "gs_order_v1";
const PRICE = 37;

const RELATIONS = [
  { v: "wife", t: "My wife", ico: "💍", p: "her" },
  { v: "husband", t: "My husband", ico: "💍", p: "him" },
  { v: "mom", t: "My mom", ico: "🌷", p: "her" },
  { v: "dad", t: "My dad", ico: "🌿", p: "him" },
  { v: "daughter", t: "My daughter", ico: "🎀", p: "her" },
  { v: "son", t: "My son", ico: "⭐", p: "him" },
  { v: "grandma", t: "My grandma", ico: "🧶", p: "her" },
  { v: "grandpa", t: "My grandpa", ico: "🎣", p: "him" },
  { v: "partner", t: "My partner", ico: "❤️", p: null },
  { v: "friend", t: "A friend", ico: "🤝", p: null },
  { v: "heaven", t: "Someone in heaven", ico: "🕊️", p: null },
  { v: "myself", t: "Myself", ico: "🙏", p: "me" },
];

const OCCASIONS = [
  { v: "anniversary", t: "Anniversary", ico: "💞" },
  { v: "birthday", t: "Birthday", ico: "🎂" },
  { v: "wedding", t: "Wedding / vow renewal", ico: "💒" },
  { v: "mothers-day", t: "Mother's Day", ico: "🌸" },
  { v: "fathers-day", t: "Father's Day", ico: "👔" },
  { v: "christmas", t: "Christmas", ico: "🎄" },
  { v: "memorial", t: "In loving memory", ico: "🕯️" },
  { v: "healing", t: "Healing & strength", ico: "✝️" },
  { v: "just-because", t: "Just because", ico: "💌" },
];

const GENRES = [
  { v: "worship", t: "Worship", d: "Soft, prayerful, like Sunday morning" },
  { v: "country-gospel", t: "Country Gospel", d: "Acoustic guitar, warm & honest" },
  { v: "contemporary", t: "Contemporary Christian", d: "Radio-style, piano & strings" },
  { v: "gospel", t: "Gospel Choir", d: "Big, joyful, full of soul" },
  { v: "ballad", t: "Piano Ballad", d: "Tender, intimate, emotional" },
  { v: "acoustic", t: "Acoustic Folk", d: "Simple, gentle, heartfelt" },
];

const QUALITIES = ["Faithful", "Patient", "Kind", "Strong", "Funny", "Gentle", "Protective", "Generous",
  "Prayer warrior", "Hard-working", "Selfless", "Wise", "Joyful", "Forgiving", "My rock", "Brave"];

const SPARKS = [
  { t: "How we met", s: "The day we met, " },
  { t: "The hardest season", s: "When we went through the hardest season, " },
  { t: "A little habit I love", s: "Every day, you have this little habit: " },
  { t: "Something only we say", s: "We always say to each other: " },
  { t: "When I saw God in you", s: "I saw God's love in you when " },
  { t: "A favorite place", s: "Our favorite place is " },
];

const VERSES = [
  { v: "Jeremiah 29:11", t: "Jeremiah 29:11 — plans to prosper you" },
  { v: "Psalm 23", t: "Psalm 23 — the Lord is my shepherd" },
  { v: "1 Corinthians 13:4-7", t: "1 Corinthians 13 — love is patient" },
  { v: "Isaiah 41:10", t: "Isaiah 41:10 — do not fear" },
  { v: "Proverbs 31", t: "Proverbs 31 — a woman of noble character" },
  { v: "Philippians 4:13", t: "Philippians 4:13 — I can do all things" },
  { v: "Ecclesiastes 4:12", t: "Ecclesiastes 4:12 — a cord of three strands" },
  { v: "Revelation 21:4", t: "Revelation 21:4 — no more tears" },
];

// ---------- estado ----------
let data = load() || { qualities: [], step: 0 };
let step = Math.min(data.step || 0, 6);

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; }
}
function save() {
  data.step = step;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* modo privado: seguimos sin guardar */ }
}
function track(event, params) {
  // Píxel de Meta si está cargado en la página
  try { if (window.fbq) window.fbq("track", event, params || {}); } catch { /* sin píxel */ }
}

// ---------- utilidades ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const name = () => (data.name || "").trim() || "them";
const rel = () => RELATIONS.find((r) => r.v === data.relation);
function pronoun() {
  const p = rel()?.p ?? data.pronoun;
  return p === "him" ? { sub: "he", obj: "him", pos: "his" } : p === "me" ? { sub: "I", obj: "me", pos: "my" } : p === "them" ? { sub: "they", obj: "them", pos: "their" } : { sub: "she", obj: "her", pos: "her" };
}
function deliveryDate() {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function songTitles() {
  const n = name();
  const byRel = {
    wife: [`${n}, You Are My Grace`, `The Answer to My Prayers`, `Every Road Led Me to You`],
    husband: [`${n}, My Covering`, `The Man God Sent Me`, `Every Road Led Me to You`],
    partner: [`${n}, You Are My Grace`, `The Answer to My Prayers`, `Every Road Led Me to You`],
    mom: [`Mama, You Showed Me Jesus`, `${n}'s Hands`, `She Prayed Me Through`],
    dad: [`Daddy, You Showed Me Jesus`, `${n}'s Hands`, `He Prayed Me Through`],
    daughter: [`${n}, God's Gift to Me`, `Little Light of Mine`, `He Wrote Your Name`],
    son: [`${n}, God's Gift to Me`, `My Boy, His Plan`, `He Wrote Your Name`],
    grandma: [`Grandma's Porch Prayers`, `${n}, Our Foundation`, `A Legacy of Grace`],
    grandpa: [`Grandpa's Quiet Faith`, `${n}, Our Foundation`, `A Legacy of Grace`],
    friend: [`${n}, Sent by God`, `A Friend Like You`, `Heaven Knew I'd Need You`],
    heaven: [`See You in Glory, ${n}`, `${n}, Safe in His Arms`, `Until We Meet Again`],
    myself: [`Still Standing by His Grace`, `He Carried Me`, `My Breakthrough Song`],
  };
  return byRel[data.relation] || [`${n}, You Are My Grace`, `A Song for ${n}`, `Grace Found Me Through You`];
}

// ---------- pantallas ----------
// render() devuelve el HTML; bind() conecta eventos; valid() devuelve un mensaje de error o null.
const SCREENS = [
  {
    hint: "About 3 minutes",
    render: () => `
      <div class="eyebrow">Let's begin</div>
      <h1 class="q">Who is this song for?</h1>
      <p class="sub">Every GraceSong is written from scratch for one person.</p>
      <div class="block"><div class="cards compact">${RELATIONS.map((r) => `
        <button type="button" class="card ${data.relation === r.v ? "on" : ""}" data-rel="${r.v}">
          <span class="card-ico">${r.ico}</span><span class="card-t">${r.t}</span></button>`).join("")}
      </div></div>
      <div class="block" id="pron-block" ${rel() && rel().p === null ? "" : "hidden"}>
        <span class="label">Should the song say…</span>
        <div class="chips">${[["her", "She / her"], ["him", "He / him"], ["them", "Their name only"]].map(([v, t]) =>
          `<button type="button" class="chip ${data.pronoun === v ? "on" : ""}" data-pron="${v}">${t}</button>`).join("")}</div>
      </div>
      <div class="block" id="name-block" ${data.relation && data.relation !== "myself" ? "" : "hidden"}>
        <label class="label" for="f-name">What's their first name?</label>
        <input type="text" id="f-name" maxlength="40" autocomplete="off" placeholder="e.g. Linda" value="${esc(data.name)}">
        <label class="label" for="f-pron" style="margin-top:14px">How do you say it? <span class="opt">(optional)</span></label>
        <input type="text" id="f-pron" maxlength="60" placeholder="e.g. Alicia: ah-LEE-sha" value="${esc(data.pronunciation)}">
        <p class="help">We sing the name several times, so we want to get it exactly right.</p>
      </div>`,
    bind: (root) => {
      root.querySelectorAll("[data-rel]").forEach((b) => b.onclick = () => {
        data.relation = b.dataset.rel;
        if (data.relation === "myself") data.name = "";
        root.querySelectorAll("[data-rel]").forEach((x) => x.classList.toggle("on", x === b));
        $("#pron-block").hidden = !(rel().p === null);
        $("#name-block").hidden = data.relation === "myself";
        if (data.relation !== "myself") { $("#name-block").scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => $("#f-name")?.focus({ preventScroll: true }), 350); }
        save();
      });
      root.querySelectorAll("[data-pron]").forEach((b) => b.onclick = () => {
        data.pronoun = b.dataset.pron;
        root.querySelectorAll("[data-pron]").forEach((x) => x.classList.toggle("on", x === b));
        save();
      });
      bindText(root, "#f-name", "name");
      bindText(root, "#f-pron", "pronunciation");
    },
    valid: () => {
      if (!data.relation) return "Choose who the song is for.";
      if (rel().p === null && !data.pronoun) return "Choose how the song should refer to them.";
      if (data.relation !== "myself" && !(data.name || "").trim()) return ["Please write their first name.", "#f-name"];
      return null;
    },
  },
  {
    hint: "The moment",
    render: () => `
      <div class="eyebrow">The moment</div>
      <h1 class="q">What's the occasion?</h1>
      <p class="sub">This shapes the feeling of the whole song.</p>
      <div class="block"><div class="chips">${OCCASIONS.map((o) =>
        `<button type="button" class="chip ${data.occasion === o.v ? "on" : ""}" data-occ="${o.v}">${o.ico} ${o.t}</button>`).join("")}</div></div>
      <div class="block">
        <label class="label" for="f-date">When will you give it? <span class="opt">(optional)</span></label>
        <input type="date" id="f-date" value="${esc(data.giftDate)}">
        <div class="promise"><span>⏱️</span><span>Your song will be ready by <b>${deliveryDate()}</b> — 24-hour delivery is always included, never an extra fee.</span></div>
        <p class="err-msg" id="date-warn" hidden></p>
      </div>`,
    bind: (root) => {
      root.querySelectorAll("[data-occ]").forEach((b) => b.onclick = () => {
        data.occasion = b.dataset.occ;
        root.querySelectorAll("[data-occ]").forEach((x) => x.classList.toggle("on", x === b));
        save();
      });
      const d = $("#f-date");
      d.min = new Date().toISOString().slice(0, 10);
      const check = () => {
        const warn = $("#date-warn");
        const soon = d.value && new Date(d.value + "T23:59") < new Date(Date.now() + 24 * 3600 * 1000);
        warn.hidden = !soon;
        warn.textContent = soon ? "That's very soon! Order now and we'll do everything we can to have it ready in time." : "";
      };
      d.onchange = () => { data.giftDate = d.value; save(); check(); };
      check();
    },
    valid: () => (data.occasion ? null : "Choose the occasion."),
  },
  {
    hint: "The sound",
    render: () => `
      <div class="eyebrow">The sound</div>
      <h1 class="q">How should ${esc(name())}'s song sound?</h1>
      <p class="sub">Pick the style that feels most like ${pronoun().obj}.</p>
      <div class="block"><div class="cards">${GENRES.map((g) => `
        <button type="button" class="card ${data.genre === g.v ? "on" : ""}" data-genre="${g.v}">
          <span class="card-t">${g.t}</span><span class="card-d">${g.d}</span></button>`).join("")}</div></div>
      <div class="block">
        <span class="label">Singer's voice</span>
        <div class="chips">${[["female", "Female voice"], ["male", "Male voice"], ["duet", "Duet"]].map(([v, t]) =>
          `<button type="button" class="chip ${data.voice === v ? "on" : ""}" data-voice="${v}">${t}</button>`).join("")}</div>
      </div>
      <div class="block">
        <span class="label">Mood</span>
        <div class="chips">${[["tender", "Tender & emotional"], ["uplifting", "Uplifting & hopeful"], ["joyful", "Joyful & celebratory"]].map(([v, t]) =>
          `<button type="button" class="chip ${data.mood === v ? "on" : ""}" data-mood="${v}">${t}</button>`).join("")}</div>
      </div>`,
    bind: (root) => {
      pickOne(root, "genre");
      pickOne(root, "voice");
      pickOne(root, "mood");
    },
    valid: () => (!data.genre ? "Choose a style." : !data.voice ? "Choose the singer's voice." : !data.mood ? "Choose a mood." : null),
  },
  {
    hint: "Who they are",
    render: () => `
      <div class="eyebrow">Who ${pronoun().sub === "I" ? "you are" : pronoun().sub + (pronoun().sub === "they" ? " are" : " is")}</div>
      <h1 class="q">${data.relation === "myself" ? "How would you describe yourself?" : `What makes ${esc(name())} special?`}</h1>
      <p class="sub">Tap up to 5 words — then add your own if you like.</p>
      <div class="block"><div class="chips">${QUALITIES.map((q) =>
        `<button type="button" class="chip ${data.qualities.includes(q) ? "on" : ""}" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div></div>
      <div class="block">
        <label class="label" for="f-traits">In your own words <span class="opt">(optional)</span></label>
        <textarea id="f-traits" maxlength="600" placeholder="e.g. She hums hymns while she cooks and never lets anyone leave hungry.">${esc(data.traits)}</textarea>
      </div>`,
    bind: (root) => {
      root.querySelectorAll("[data-q]").forEach((b) => b.onclick = () => {
        const q = b.dataset.q, i = data.qualities.indexOf(q);
        if (i >= 0) data.qualities.splice(i, 1);
        else if (data.qualities.length < 5) data.qualities.push(q);
        b.classList.toggle("on", data.qualities.includes(q));
        save();
      });
      bindText(root, "#f-traits", "traits");
    },
    valid: () => (data.qualities.length || (data.traits || "").trim() ? null : "Pick at least one word, or describe them in your own words."),
  },
  {
    hint: "Your story",
    render: () => `
      <div class="eyebrow">Your story</div>
      <h1 class="q">${data.relation === "myself" ? "What has God brought you through?" : `Share a few memories with ${esc(name())}`}</h1>
      <p class="sub">The more real details you share, the more the song will sound like <i>your</i> story. Tap an idea to get started.</p>
      <div class="sparks">${SPARKS.map((s, i) => `<button type="button" class="spark" data-spark="${i}">+ ${s.t}</button>`).join("")}</div>
      <textarea id="f-story" maxlength="2000" style="min-height:170px" placeholder="Names, places, dates, inside jokes, hard seasons you walked through together…">${esc(data.story)}</textarea>
      <div class="counter" id="story-counter"></div>
      <div class="block" style="margin-top:18px">
        <label class="label" for="f-names">Other names to include <span class="opt">(optional)</span></label>
        <input type="text" id="f-names" maxlength="200" placeholder="e.g. our kids Emma & Josh, our dog Buddy" value="${esc(data.otherNames)}">
      </div>`,
    bind: (root) => {
      const ta = $("#f-story");
      const count = () => {
        const n = (ta.value || "").trim().length, c = $("#story-counter");
        c.textContent = n < 60 ? `A little more, please (${n}/60)` : n < 250 ? "Good — every extra detail makes it more personal" : "Beautiful. This is going to be special.";
        c.classList.toggle("good", n >= 60);
      };
      ta.oninput = () => { data.story = ta.value; save(); count(); };
      count();
      root.querySelectorAll("[data-spark]").forEach((b) => b.onclick = () => {
        const s = SPARKS[b.dataset.spark].s;
        ta.value = (ta.value.trim() ? ta.value.trim() + "\n\n" : "") + s;
        data.story = ta.value; save(); count();
        ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      });
      bindText(root, "#f-names", "otherNames");
    },
    valid: () => ((data.story || "").trim().length >= 60 ? null : ["Please share a little more — at least a couple of sentences.", "#f-story"]),
  },
  {
    hint: "Faith",
    render: () => `
      <div class="eyebrow">Faith</div>
      <h1 class="q">Is there a verse that speaks to ${data.relation === "myself" ? "you" : "your story"}?</h1>
      <p class="sub">We'll weave it gently into the lyrics.</p>
      <div class="block"><div class="chips">${VERSES.map((v) =>
        `<button type="button" class="chip ${data.verse === v.v ? "on" : ""}" data-verse="${esc(v.v)}">${esc(v.t)}</button>`).join("")}
        <button type="button" class="chip ${data.verse === "none" ? "on" : ""}" data-verse="none">Surprise me</button></div>
        <input type="text" id="f-verse" maxlength="80" style="margin-top:10px" placeholder="Or type another verse or hymn…" value="${esc(VERSES.some((v) => v.v === data.verse) || data.verse === "none" ? "" : data.verse)}">
      </div>
      <div class="block">
        <label class="label" for="f-thanks">${data.relation === "myself" ? "What are you most thankful to God for?" : `What do you thank God for about ${esc(name())}?`} <span class="opt">(optional)</span></label>
        <textarea id="f-thanks" maxlength="600" placeholder="e.g. I thank God she never gave up on me.">${esc(data.thanks)}</textarea>
      </div>`,
    bind: (root) => {
      const input = $("#f-verse");
      root.querySelectorAll("[data-verse]").forEach((b) => b.onclick = () => {
        data.verse = b.dataset.verse; input.value = "";
        root.querySelectorAll("[data-verse]").forEach((x) => x.classList.toggle("on", x === b));
        save();
      });
      input.oninput = () => {
        data.verse = input.value.trim() || null;
        root.querySelectorAll("[data-verse]").forEach((x) => x.classList.remove("on"));
        save();
      };
      bindText(root, "#f-thanks", "thanks");
    },
    valid: () => null,
  },
  {
    hint: "Last question",
    render: () => `
      <div class="eyebrow">From your heart</div>
      <h1 class="q">${data.relation === "myself" ? "What do you need to hear most right now?" : data.relation === "heaven" ? `If ${esc(name())} could hear one thing from you, what would it be?` : `If this song could tell ${esc(name())} one thing, what would it be?`}</h1>
      <p class="sub">This becomes the final line of the song — the one ${data.relation === "myself" ? "you'll" : pronoun().sub === "they" ? "they'll" : pronoun().sub + "'ll"} remember.</p>
      <textarea id="f-message" maxlength="400" placeholder="e.g. You were my answered prayer, and I'd choose you again in every lifetime.">${esc(data.message)}</textarea>`,
    bind: (root) => bindText(root, "#f-message", "message"),
    valid: () => ((data.message || "").trim().length >= 10 ? null : ["Write a short message — even one sentence is perfect.", "#f-message"]),
  },
  {
    hint: "Your song plan",
    render: () => {
      const titles = songTitles();
      if (!titles.includes(data.title)) data.title = titles[0];
      const occ = OCCASIONS.find((o) => o.v === data.occasion);
      const genre = GENRES.find((g) => g.v === data.genre);
      const weave = [
        data.qualities.length ? `${data.qualities.slice(0, 3).join(", ")}` : null,
        firstSentence(data.story),
        data.verse && data.verse !== "none" ? `${data.verse}` : null,
        data.otherNames ? `${data.otherNames}` : null,
        `Final line: "${truncate(data.message, 70)}"`,
      ].filter(Boolean);
      return `
      <div class="eyebrow">Your song plan is ready</div>
      <h1 class="q">Here's what we'll create for ${data.relation === "myself" ? "you" : esc(name())}</h1>
      <p class="sub">Choose your favorite title — our songwriters start as soon as you order.</p>
      <div class="blueprint">
        <div class="bp-label">GraceSong for ${data.relation === "myself" ? "you" : esc(name())}</div>
        <div class="bp-title" id="bp-title">“${esc(data.title)}”</div>
        <div class="bp-row"><span>Occasion</span><span>${occ ? esc(occ.t) : ""}</span></div>
        <div class="bp-row"><span>Style</span><span>${genre ? esc(genre.t) : ""} · ${data.voice === "duet" ? "Duet" : data.voice === "male" ? "Male voice" : "Female voice"}</span></div>
        <div class="bp-row"><span>Ready by</span><span>${deliveryDate()}</span></div>
        <ul class="bp-weave">${weave.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
      </div>
      <div class="block"><span class="label">Song title</span><div class="titles">${titles.map((t) =>
        `<button type="button" class="title-opt ${data.title === t ? "on" : ""}" data-title="${esc(t)}">${esc(t)}</button>`).join("")}</div></div>
      <div class="sample">
        <button type="button" class="sample-play" id="sample-play" aria-label="Play sample">▶</button>
        <div><div class="sample-t">Hear a sample: “Brenda, You Are My Grace”</div><div class="sample-d">An example of a GraceSong made from a story like yours</div></div>
        <audio id="sample-audio" src="/samples/brenda-you-are-my-grace.mp3" preload="none"></audio>
      </div>`;
    },
    bind: (root) => {
      root.querySelectorAll("[data-title]").forEach((b) => b.onclick = () => {
        data.title = b.dataset.title;
        root.querySelectorAll("[data-title]").forEach((x) => x.classList.toggle("on", x === b));
        $("#bp-title").textContent = `“${data.title}”`;
        save();
      });
      const a = $("#sample-audio"), p = $("#sample-play");
      p.onclick = () => { if (a.paused) { a.play(); p.textContent = "❚❚"; } else { a.pause(); p.textContent = "▶"; } };
      a.onended = () => { p.textContent = "▶"; };
    },
    valid: () => null,
    next: "Continue to order →",
  },
  {
    hint: "Almost done",
    render: () => `
      <div class="eyebrow">Last step</div>
      <h1 class="q">Where should we send ${data.relation === "myself" ? "your" : esc(name()) + "'s"} song?</h1>
      <p class="sub">We'll email you a private link to listen, download and share.</p>
      <div class="block">
        <label class="label" for="f-buyer">Your first name</label>
        <input type="text" id="f-buyer" maxlength="40" autocomplete="given-name" value="${esc(data.buyerName)}">
      </div>
      <div class="block">
        <label class="label" for="f-email">Your email</label>
        <input type="email" id="f-email" maxlength="120" autocomplete="email" inputmode="email" placeholder="you@example.com" value="${esc(data.email)}">
        <p class="help">We'll only send it to you — so the surprise stays a surprise.</p>
      </div>
      <div class="order">
        <div class="order-row"><span>Custom song “${esc(truncate(data.title, 34))}”</span><span>$${PRICE}</span></div>
        <div class="order-row"><span>24-hour delivery</span><span class="incl">Included</span></div>
        <div class="order-row"><span>Printable lyric sheet</span><span class="incl">Included</span></div>
        <div class="order-row total"><span>Total</span><span>$${PRICE}</span></div>
        <ul class="perks">
          <li>Written from your story — never a template</li>
          <li>Ready by ${deliveryDate()}</li>
          <li>Private link to play & share on any device</li>
          <li>Free to play at church & family events</li>
          <li>🎥 Film their reaction and get your next song free</li>
        </ul>
        <button type="button" class="edit-link" id="edit">Review or edit your answers</button>
      </div>
      <div class="guarantee"><span style="font-size:26px">🛡️</span><div><b>7-day “love it” guarantee</b>If the song doesn't touch your heart, email us within 7 days of delivery and we'll refund you in full.</div></div>
      <p class="fine">Our songwriters use modern AI-assisted music production tools to bring your lyrics to life. Secure payment by Stripe. By ordering you agree to our <a href="/terms" target="_blank">Terms</a> and <a href="/privacy" target="_blank">Privacy Policy</a>.</p>`,
    bind: (root) => {
      bindText(root, "#f-buyer", "buyerName");
      bindText(root, "#f-email", "email");
      $("#edit").onclick = () => go(0);
    },
    valid: () => {
      if (!(data.buyerName || "").trim()) return ["Please write your first name.", "#f-buyer"];
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((data.email || "").trim())) return ["Please check your email address.", "#f-email"];
      return null;
    },
    next: `Create My Song — $${PRICE}`,
    buy: true,
  },
];

function firstSentence(s) {
  const t = (s || "").trim().split(/(?<=[.!?])\s|\n/)[0] || "";
  return t ? `“${truncate(t, 120)}”` : null;
}
function truncate(s, n) { s = (s || "").trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; }

function bindText(root, sel, key) {
  const el = root.querySelector(sel);
  if (el) el.oninput = () => { data[key] = el.value; el.classList.remove("field-err"); save(); };
}
function pickOne(root, key) {
  root.querySelectorAll(`[data-${key}]`).forEach((b) => b.onclick = () => {
    data[key] = b.dataset[key];
    root.querySelectorAll(`[data-${key}]`).forEach((x) => x.classList.toggle("on", x === b));
    save();
  });
}

// ---------- navegación ----------
const app = $("#app"), btnNext = $("#btn-next"), btnBack = $("#btn-back");
const COMPOSE_AT = 7; // antes del plano de la canción mostramos la animación "componiendo"

function render() {
  const s = SCREENS[step];
  app.innerHTML = `<section class="screen">${s.render()}<p class="err-msg" id="err" hidden></p></section>`;
  s.bind(app);
  const pct = Math.round(((step + 1) / SCREENS.length) * 100);
  $("#progress-fill").style.width = pct + "%";
  $("#progress-step").textContent = `Step ${step + 1} of ${SCREENS.length}`;
  $("#progress-hint").textContent = s.hint;
  btnBack.hidden = step === 0;
  btnNext.textContent = s.next || "Next →";
  btnNext.classList.toggle("buy", !!s.buy);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function go(n) {
  step = n; save();
  if (n === COMPOSE_AT) return composing();
  render();
}

function composing() {
  const nav = $("#nav");
  nav.hidden = true;
  app.innerHTML = `<section class="screen composing"><div class="notes">♪ ♫ ♪</div>
    <p>Reading ${data.relation === "myself" ? "your" : esc(name()) + "'s"} story…</p><small id="c-step">Finding the heart of your song</small></section>`;
  const msgs = ["Finding the heart of your song", "Choosing the melody", "Preparing your song plan"];
  let i = 0;
  const t = setInterval(() => { i++; if (msgs[i]) $("#c-step").textContent = msgs[i]; }, 900);
  setTimeout(() => { clearInterval(t); nav.hidden = false; render(); }, 2800);
}

btnBack.onclick = () => { if (step > 0) { step--; save(); render(); } };
btnNext.onclick = () => {
  const s = SCREENS[step];
  const problem = s.valid();
  if (problem) {
    const [msg, sel] = Array.isArray(problem) ? problem : [problem];
    const err = $("#err"); err.textContent = msg; err.hidden = false;
    if (sel) { const f = $(sel); f.classList.add("field-err"); f.focus(); }
    else err.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (step === 0) track("Lead");
  if (s.buy) return checkout();
  go(step + 1);
};

async function checkout() {
  track("InitiateCheckout", { value: PRICE, currency: "USD" });
  btnNext.disabled = true;
  btnNext.textContent = "Preparing secure checkout…";
  const order = { ...data, email: data.email.trim(), createdAt: new Date().toISOString() };
  delete order.step;
  try {
    // /api/checkout guarda el pedido y devuelve la URL de Stripe Checkout
    const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const { url } = await r.json();
    window.location.href = url;
  } catch (e) {
    console.error("checkout:", e);
    const err = $("#err");
    err.textContent = "Something went wrong opening the secure checkout. Please try again — your answers are saved.";
    err.hidden = false;
    btnNext.disabled = false;
    btnNext.textContent = SCREENS[step].next;
  }
}

// Si volvió de Stripe sin pagar (?canceled=1), lo dejamos directo en el último paso con sus respuestas
(function resumeCanceled() {
  if (new URLSearchParams(location.search).get("canceled") !== "1" || !data.email) return;
  step = SCREENS.length - 1;
  save();
  history.replaceState(null, "", location.pathname);
  setTimeout(() => {
    const err = $("#err");
    if (err) { err.textContent = "Your payment wasn't completed. Your answers are saved — you can try again whenever you're ready."; err.hidden = false; }
  }, 0);
})();

// Desde la landing llega ?for=wife (etc.): dejamos esa opción marcada en el primer paso
(function preselect() {
  const f = new URLSearchParams(location.search).get("for");
  if (!f || !RELATIONS.some((r) => r.v === f) || data.relation === f) return;
  data = { qualities: [], relation: f };
  step = 0;
  save();
})();

render();
