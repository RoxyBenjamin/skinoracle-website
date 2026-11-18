// =============================================================================
// SkinOracle™ Product Pricer — main app logic (pricer v1.0.0)
// Owner, founder, author, designer and architect: Roxanne Benjamin (also Roxy Benjamin; maiden name Roxanne
// Haberland). All hers, no one else's. © 2026 Roxanne Benjamin. See OWNERSHIP.md.
//
// WHY: Founder direction (Roxanne Haberland), 14 Nov 2026: a stand-alone mini website at skinoracle.ai/pricer, with its
//   own launch icon, that photographs any product, finds 3 prices from a few chosen stores, saves the clean pictures on
//   the phone and sends the product facts to SkinOracle.
//
// THE FLOW (one scan)
//   1. capture   up to 3 photos: front (required), ingredients, barcode (optional)
//   2. prepare   shrink photos (drawing on a canvas also drops EXIF/GPS); read the barcode on the phone (barcode.js)
//   3. cut-outs  lift the product off the background ON THE PHONE (cutout.js)
//   4. backend   Edge Function "pricer" (backend/supabase/functions/pricer): cut-outs on white (a photo that couldn't be
//                cut out is sent marked read_only: read by the AI, never stored), a retail
//                barcode, the AREA of the scan (rounded to 0.1 degree, never the spot; images.js deviceArea/photoArea)
//                and the optional "where did you buy it" choice are sent (founder rules, 14 Nov 2026; QR-code text never
//                leaves the phone)
//   5. finish    write product name + prices into each PNG (pngmeta.js), name the files after the product, keep the scan
//                in "My scans" (store.js, this phone only)
//   6. save      "Save to my phone" opens the iPhone/Android share sheet → Save Images (Photos) or Save to Files →
//                "Skin Oracle" folder. (Websites can't write to Photos/Files without this tap: Apple/Google rule.)
// SECURITY (pricer/SECURITY.md): everything the server sends is shown with textContent (never as HTML); price links are
//   shown only when they are https (safeLink); the request carries no account, cookie or referrer.
// HOW TO CHANGE SAFELY: if the server's answer changes shape, update renderResult and the server's logic.ts together.
// =============================================================================
import { CONFIG } from "../config.js";
import { loadImage, toCanvas, turnCanvas, browserTurnsPhotos, readOrientation, canvasToJpegDataUrl, canvasToBlob, nextFrame, photoArea, deviceArea } from "./images.js";
import { loadCutoutModel, removeBackground } from "./cutout.js";
import { readBarcode } from "./barcode.js";
import { addPngMetadata } from "./pngmeta.js";
import { saveScan, listScans, getScan, deleteScan, askPersistentStorage } from "./store.js";

const $ = (id) => document.getElementById(id);
const KINDS = ["front", "ingredients", "barcode"];
const STEP_TEXT = {
  front: { title: "Front label", help: "Fill the frame with the front of the product. Good light, no glare." },
  ingredients: { title: "Ingredients", help: "Turn it around: photograph the ingredient list / back label. Optional." },
  barcode: { title: "Barcode or QR code", help: "Hold the barcode or QR code flat and close. Optional." },
};
const PLATFORM = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)
  ? "ios" : /Android/.test(navigator.userAgent) ? "android" : "other";

// ---- state of the scan in progress ----
let shots = {};            // kind -> File
let stepIndex = 0;         // which of KINDS we're asking for
let current = null;        // the scan shown on the result screen (same shape as stored scans)
let pending = null;        // data kept to retry the price lookup

for (const name of CONFIG.boughtAtChoices) { const o = document.createElement("option"); o.value = name; o.textContent = name; $("bought-at").appendChild(o); }
$("ver").textContent = "v" + CONFIG.version + (CONFIG.demo ? " · demo mode" : "");

// =============================================================================
// Screens
// =============================================================================
function show(id) {
  for (const s of ["home", "capture", "working", "result"]) $(s).classList.toggle("hidden", s !== id);
  scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

function toast(msg, ms = 3200) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), ms);
}

function setProgress(pct, msg) {
  $("work-bar").style.width = Math.max(3, Math.min(100, pct)) + "%";
  if (msg) $("work-msg").textContent = msg;
}

// =============================================================================
// HOME + gallery
// =============================================================================
const thumbUrls = [];
async function renderGallery() {
  thumbUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  const scans = await listScans().catch(() => []);
  const g = $("gallery");
  g.textContent = "";
  $("gallery-empty").classList.toggle("hidden", scans.length > 0);
  for (const s of scans) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "g-item";
    const file = s.files.find((f) => f.kind === "front") ?? s.files[0];
    const thumb = document.createElement("div");
    thumb.className = "thumb checker";
    if (file) { const img = new Image(); const u = URL.createObjectURL(file.blob); thumbUrls.push(u); img.src = u; img.alt = ""; thumb.appendChild(img); }
    const name = document.createElement("b"); name.textContent = s.product?.display_name ?? "Product";
    const sub = document.createElement("span");
    // 1.1.3: an Amazon row has no number (price null, see renderResult), so only real numbers count for "from".
    const nums = (s.prices ?? []).filter((p) => typeof p.price === "number");
    const low = nums.length ? Math.min(...nums.map((p) => p.price)) : null;
    sub.textContent = new Date(s.createdAt).toLocaleDateString() + (low != null ? ` · from ${money(low, nums[0].currency)}` : "");
    b.append(thumb, name, sub);
    b.addEventListener("click", async () => { const full = await getScan(s.id); if (full) { current = full; pending = null; renderResult(); show("result"); } });
    g.appendChild(b);
  }
}

$("start").addEventListener("click", () => startCapture());
$("home-btn").addEventListener("click", () => { renderGallery(); show("home"); });
$("again").addEventListener("click", () => startCapture());

// =============================================================================
// CAPTURE
// =============================================================================
function startCapture() {
  shots = {};
  $("bought-at").value = "";
  stepIndex = 0;
  for (const el of document.querySelectorAll("#capture .shot")) {
    el.classList.remove("done");
    el.querySelector("img")?.remove();
  }
  renderStep();
  show("capture");
  loadCutoutModel().catch(() => {});      // start downloading the model while the person takes photos
}

function renderStep() {
  const kind = KINDS[stepIndex];
  const done = stepIndex >= KINDS.length;
  $("cap-step").textContent = done ? "All set" : `Photo ${stepIndex + 1} of 3`;
  $("cap-title").textContent = done ? "Ready" : STEP_TEXT[kind].title;
  $("cap-help").textContent = done ? "Tap \"Find prices\". You can also retake any photo by tapping it." : STEP_TEXT[kind].help;
  $("take").classList.toggle("hidden", done);
  $("skip").classList.toggle("hidden", done);
  $("skip").disabled = kind === "front" && !shots.front;   // the front label is required
  $("finish").disabled = !shots.front;
}

let targetKind = null;                     // which slot the next picked photo goes into
function pick(kind, fromLibrary = false) {
  targetKind = kind;
  const input = fromLibrary ? $("lib-input") : $("cam-input");
  input.value = "";
  input.click();
}
$("take").addEventListener("click", () => pick(KINDS[stepIndex]));
$("from-library").addEventListener("click", (e) => { e.preventDefault(); pick(KINDS[Math.min(stepIndex, 2)], true); });
$("skip").addEventListener("click", () => { stepIndex++; renderStep(); if (stepIndex >= KINDS.length) $("finish").focus(); });
$("cancel").addEventListener("click", (e) => { e.preventDefault(); renderGallery(); show("home"); });
for (const el of document.querySelectorAll("#capture .shot")) {
  el.addEventListener("click", () => pick(el.dataset.kind));     // tap a tile to (re)take that photo
}
for (const id of ["cam-input", "lib-input"]) {
  $(id).addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file || !targetKind) return;
    shots[targetKind] = file;
    const tile = document.querySelector(`#capture .shot[data-kind="${targetKind}"]`);
    tile.querySelector("img")?.remove();
    const img = new Image(); img.alt = ""; img.src = URL.createObjectURL(file);
    tile.appendChild(img); tile.classList.add("done");
    // move to the next photo we don't have yet
    if (KINDS[stepIndex] === targetKind) { stepIndex++; while (stepIndex < KINDS.length && shots[KINDS[stepIndex]]) stepIndex++; }
    renderStep();
    if (stepIndex >= KINDS.length) $("finish").focus();   // all three taken: the person can still pick "where bought", then Find prices
  });
}
$("finish").addEventListener("click", () => runScan());

// =============================================================================
// PROCESS ONE SCAN
// =============================================================================
async function runScan() {
  if (!shots.front && !shots.ingredients && !shots.barcode) return;
  show("working");
  $("work-title").textContent = "Working on it…";
  setProgress(5, "Preparing your photos");
  await nextFrame();

  const scanId = crypto.randomUUID();
  const kinds = KINDS.filter((k) => shots[k]);
  const boughtAt = $("bought-at").value || null;
  // Where (founder direction, 14 Nov 2026): the phone's location if allowed, else the photo's own tag; only the AREA
  // (0.1 degree) ever leaves the phone. Asked in parallel so it never slows the scan.
  const areaPromise = deviceArea().then(async (a) => a ?? (shots.front ? await photoArea(shots.front) : null)).catch(() => null);
  try {
    // ---- 2. prepare: upright, shrunk canvases (drawing on a canvas also drops the photo's EXIF/GPS) ----
    const work = {};
    // 1.1.1: a browser that doesn't turn photos upright by itself gets the photo's own EXIF turn applied here.
    const selfTurn = !(await browserTurnsPhotos());
    for (const k of kinds) {
      const img = await loadImage(shots[k]);
      work[k] = toCanvas(img, CONFIG.cutoutMaxSide, selfTurn ? await readOrientation(shots[k]) : 1);
      URL.revokeObjectURL(img.src);
      await nextFrame();
    }
    setProgress(12, "Reading the barcode");
    const bc = await readBarcode([work.barcode, work.ingredients, work.front]);

    // ---- 3. cut-outs on the phone (founder rule, 14 Nov 2026: product photos are always the cut-out) ----
    const cut = {};
    let i = 0;
    for (const k of kinds) {
      setProgress(18 + i * 16, `Lifting the product off the background (${i + 1} of ${kinds.length})`);
      await nextFrame();
      try { cut[k] = await removeBackground(work[k]); }
      catch (e) { console.warn("cut-out failed", e); cut[k] = { canvas: work[k], cutOut: false }; }
      i++;
    }

    // ---- 4. only clean cut-outs, on white, go to SkinOracle ("no clear cut-out = no photo sent") ----
    // A photo that couldn't be cut out cleanly is still sent so the AI can READ the label (otherwise no prices), marked
    // "read_only": the server never stores it (founder report, 14 Nov 2026: "price does not show up").
    const photos = {}, readOnly = [];
    for (const k of kinds) {
      // 1.1.2 (security fix, founder go-ahead 14 Nov 2026: "make the fix please"): the barcode photo is sent too, so the
      // AI reads the digits ITSELF; the server keeps the phone's barcode only when the two agree.
      // RETIRED: `if (k === "barcode" && bc) continue;` (the barcode number alone was thought to be enough).
      const jpeg = await cutoutOnWhiteJpeg(cut[k].canvas);
      if (!jpeg) continue;
      photos[k] = jpeg;
      if (!cut[k].cutOut) readOnly.push(k);
    }
    const gtin = bc && /^\d{8}$|^\d{12,14}$/.test(bc.text) ? bc.text : null;   // QR-code text is never sent
    // Security review L4: QR-code text (a web address or personal details) is not kept or written into the pictures
    // either; only a retail barcode number is.
    const keptCode = gtin ? { text: gtin, format: bc.format } : null;
    let answer = null, backendError = null;
    if (!Object.keys(photos).length && !gtin) {
      backendError = "We couldn't read this photo. Please try again in good light, with the label filling the frame.";
    } else {
      pending = { scanId, photos, readOnly, gtin, area: await areaPromise, boughtAt };
      setProgress(70, gtin ? `Barcode ${gtin} found. Finding prices at the stores (up to 30 seconds)` : "Finding prices at the stores (up to 30 seconds)");
      const tick = setInterval(() => { const w = parseFloat($("work-bar").style.width); if (w < 94) setProgress(w + 1); }, 900);
      try { answer = await callBackend(pending); } catch (e) { backendError = e.message || String(e); }
      clearInterval(tick);
    }

    // ---- 5. finish: files named after the product, kept in My scans ----
    setProgress(96, "Saving on your phone");
    const product = answer?.product ?? { display_name: "Product", brand: null, product_name: null };
    const prices = (answer?.prices ?? []).filter((p) => safeLink(p.url));
    // Founder report (Roxanne Haberland), 14 Nov 2026: "The picture is correctly masked but it's presented sideways.
    // Please fix this." The AI says how far each photo must turn (clockwise) for the brand name to read upright; a
    // photo taken looking down at a counter often carries the wrong rotation. The "Turn" button on the result is the
    // fallback when the AI didn't say (or got it wrong).
    const turns = answer?.turns && typeof answer.turns === "object" ? answer.turns : {};
    for (const k of kinds) cut[k].canvas = turnCanvas(cut[k].canvas, turns[k]);
    const pngs = {};
    for (const k of kinds) pngs[k] = await canvasToBlob(cut[k].canvas, "image/png");
    current = {
      id: scanId,
      createdAt: new Date().toISOString(),
      product, prices,
      barcode: keptCode,
      cutOut: Object.fromEntries(kinds.map((k) => [k, cut[k].cutOut])),
      rawPngs: pngs,                       // kept so a later price retry can rebuild the files
      files: await buildFiles(product, prices, keptCode, pngs),
      backendError,
    };
    await saveScan(current).catch((e) => console.warn("could not keep scan", e));
    setProgress(100);
    renderResult();
    show("result");
  } catch (e) {
    console.error(e);
    toast("Something went wrong. Please try again.", 6000);
    show("capture");
  }
}

/**
 * The cut-out placed on white as a JPEG of at most ~380 KB (the server refuses more than 400 KB) and 1024 px.
 * Drawing on a fresh canvas means the file carries no EXIF, GPS or other metadata.
 */
async function cutoutOnWhiteJpeg(canvas) {
  for (const [side, q] of [[1024, 0.82], [900, 0.72], [768, 0.62]]) {
    const scale = Math.min(1, side / Math.max(canvas.width, canvas.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(canvas.width * scale)); c.height = Math.max(1, Math.round(canvas.height * scale));
    const x = c.getContext("2d");
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(canvas, 0, 0, c.width, c.height);
    const url = canvasToJpegDataUrl(c, q);
    if (url.length < 500_000) return url;    // base64 of ~375 KB
  }
  return null;
}

/** Friendly words for the server's short error codes. */
const ERROR_WORDS = {
  rate_limited: "You've reached today's limit of price checks. Please try again later.",
  disabled: "The Pricer is resting right now. Please try again later.",
  ai_unavailable: "The price finder didn't answer. Please try again in a minute.",
  origin_not_allowed: "Please open the Pricer from skinoracle.ai/pricer.",
  too_large: "Those photos were too large. Please try again.",
  photo_too_large: "Those photos were too large. Please try again.",
  nothing_to_price: "We need a clear photo of the label or a barcode.",
};

/** Calls the pricer Edge Function (or a canned answer in ?demo=1 mode). */
async function callBackend({ scanId, photos, readOnly = [], gtin, area, boughtAt }) {
  if (CONFIG.demo) return demoAnswer(gtin);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 95_000);
  try {
    const res = await fetch(`${CONFIG.supabaseUrl}/functions/v1/${CONFIG.functionName}`, {
      method: "POST",
      signal: ctrl.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { "content-type": "application/json", apikey: CONFIG.supabasePublishableKey },
      body: JSON.stringify({ scan_id: scanId, app_version: CONFIG.version, platform: PLATFORM, gtin, photos, read_only: readOnly, area, bought_at: boughtAt }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(ERROR_WORDS[data.error] || "Something went wrong finding prices. Please try again.");
    return data;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("The price lookup took too long. Please try again.");
    if (e instanceof TypeError) throw new Error("No internet connection, or the server could not be reached.");
    throw e;
  } finally { clearTimeout(timer); }
}

/** Only real https links are ever shown (a price link can never be javascript: or http:). */
function safeLink(u) {
  try { const x = new URL(u); return x.protocol === "https:" && !x.username && !x.password; } catch { return false; }
}

// "Try prices again" after a failed lookup
$("retry").addEventListener("click", async () => {
  if (!pending || !current) return;
  $("retry").disabled = true;
  $("retry").textContent = "Finding prices…";
  try {
    const answer = await callBackend(pending);
    current.product = answer.product; current.prices = (answer.prices ?? []).filter((p) => safeLink(p.url)); current.backendError = null;
    current.files = await buildFiles(current.product, current.prices, current.barcode, current.rawPngs);
    await saveScan(current).catch(() => {});
    renderResult();
  } catch (e) { toast(e.message || String(e), 5000); }
  $("retry").disabled = false;
  $("retry").textContent = "Try prices again";
});

// =============================================================================
// FILES: names + metadata
// =============================================================================
const KIND_LABEL = { front: "front", ingredients: "ingredients", barcode: "barcode" };

/** "CeraVe Moisturizing Cream (16 oz)" → "CeraVe-Moisturizing-Cream-16-oz" (safe on every phone). */
function fileBase(product) {
  const name = [product.display_name, product.size_text].filter(Boolean).join(" ");
  const slug = name.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  return slug || "Product";
}

async function buildFiles(product, prices, barcode, pngs) {
  const date = new Date().toISOString().slice(0, 10);
  const base = fileBase(product);
  const priceText = prices.length
    ? `Prices on ${date}: ` + prices.map((p) => `${p.store} ${p.price == null ? "(see the price on " + p.store + ")" : money(p.price, p.currency)}`).join("; ") + "."
    : "No prices found.";
  const description = [product.display_name, product.size_text, priceText, barcode ? `Barcode ${barcode.text}.` : "", "Saved with SkinOracle Product Pricer."]
    .filter(Boolean).join(" · ");
  const files = [];
  for (const [kind, blob] of Object.entries(pngs)) {
    const withMeta = await addPngMetadata(blob, {
      title: `${product.display_name} (${KIND_LABEL[kind]})`,
      description,
      keywords: ["Skin Oracle", "SkinOracle", "Product Pricer", product.brand, product.category].filter(Boolean),
    });
    files.push({ kind, name: `${base}_${KIND_LABEL[kind]}_${date}.png`, blob: withMeta });
  }
  return files;
}

// =============================================================================
// RESULT screen
// =============================================================================
const resultUrls = [];
/** Turns one saved picture of the current scan a quarter clockwise, rebuilds its files and keeps the scan. */
async function turnPicture(kind, btn) {
  if (!current?.rawPngs?.[kind]) return;
  btn.disabled = true;
  try {
    const img = await loadImage(current.rawPngs[kind]);
    const c = turnCanvas(toCanvas(img, 4096), 90);
    URL.revokeObjectURL(img.src);
    current.rawPngs[kind] = await canvasToBlob(c, "image/png");
    current.files = await buildFiles(current.product, current.prices, current.barcode, current.rawPngs);
    await saveScan(current).catch((e) => console.warn("could not keep scan", e));
    renderResult();
  } catch (e) {
    console.warn("turn failed", e);
    toast("Couldn't turn this picture. Please try again.");
    btn.disabled = false;
  }
}

function renderResult() {
  const s = current;
  resultUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  $("res-name").textContent = s.product?.display_name ?? "Product";
  $("res-sub").textContent = [s.product?.size_text, s.barcode ? `Barcode ${s.barcode.text}` : null].filter(Boolean).join(" · ");

  const pills = $("res-pills"); pills.textContent = "";
  const addPill = (t, cls = "") => { const p = document.createElement("span"); p.className = "pill " + cls; p.textContent = t; pills.appendChild(p); };
  if (s.product?.category) addPill(s.product.category);
  if (s.product?.is_skincare === true) addPill("skin care", "good");
  if (s.product?.confidence != null && s.product.confidence < 0.6) addPill("best guess, please check", "warn");

  const shotsEl = $("res-shots"); shotsEl.textContent = "";
  for (const f of s.files) {
    const d = document.createElement("div"); d.className = "shot done checker";
    const img = new Image(); const u = URL.createObjectURL(f.blob); resultUrls.push(u); img.src = u; img.alt = f.kind;
    const tag = document.createElement("span"); tag.className = "pill tag"; tag.textContent = f.kind;
    // "Turn" (1.1.1, founder report 14 Nov 2026 "presented sideways"): turns this picture a quarter clockwise and
    // rebuilds the saved files, so the person can always put it upright.
    const turn = document.createElement("button"); turn.type = "button"; turn.className = "turn";
    turn.setAttribute("aria-label", `Turn the ${f.kind} picture`); turn.title = "Turn"; turn.textContent = "↻";
    turn.addEventListener("click", () => turnPicture(f.kind, turn));
    d.append(img, tag, turn); shotsEl.appendChild(d);
  }
  const notCut = Object.entries(s.cutOut ?? {}).filter(([, v]) => !v).map(([k]) => k);
  $("res-cutnote").textContent = notCut.length
    ? `We kept the original background for: ${notCut.join(", ")} (the cut-out didn't look clean enough). A plain background helps.`
    : "";

  $("save-help").textContent = PLATFORM === "ios"
    ? `Then tap "Save Images" for Photos, or "Save to Files" and choose your "${CONFIG.folderName}" folder.`
    : PLATFORM === "android"
      ? `Then choose where to keep them, for example Photos/Gallery, or Files → a "${CONFIG.folderName}" folder.`
      : "The pictures will download to this computer.";

  const list = $("res-prices"); list.textContent = "";
  if (!s.prices?.length) {
    const p = document.createElement("p"); p.className = "muted";
    p.textContent = s.backendError ? `Couldn't get prices: ${s.backendError}` : "No prices found online for this exact product.";
    list.appendChild(p);
  }
  for (const pr of s.prices ?? []) {
    const row = document.createElement("div"); row.className = "price";
    // 1.1.3 (founder direction, Roxanne Haberland, 14 Nov 2026: "pricer should be also tied to amazon... obviously"):
    // Amazon's rules allow its prices only from Amazon's own feed, so the server sends an Amazon row with no number
    // (price null) and Roxy's Associates link; the row says "See price" instead. In the saved pictures' text too.
    const amt = document.createElement("div"); amt.className = "amt"; amt.textContent = pr.price == null ? "See price" : money(pr.price, pr.currency);
    const st = document.createElement("div"); st.className = "store";
    const b = document.createElement("b"); b.textContent = pr.store + (pr.verified ? "" : " · unverified");
    const sp = document.createElement("span"); sp.textContent = pr.title || hostOf(pr.url);
    st.append(b, sp);
    if (!safeLink(pr.url)) continue;
    const go = document.createElement("a"); go.className = "go"; go.href = pr.url; go.target = "_blank"; go.rel = "sponsored noopener noreferrer"; go.textContent = pr.price == null ? `On ${pr.store} ›` : "View ›";   // 1.1.3: sponsored (affiliate link); RETIRED rel "noopener noreferrer"
    row.append(amt, st, go); list.appendChild(row);
  }
  $("retry").classList.toggle("hidden", !(s.backendError && pending && pending.scanId === s.id));
  $("res-checked").textContent = s.prices?.length
    ? `Checked ${new Date(s.prices[0].checked_at || s.createdAt).toLocaleString()}. Prices change. Always confirm on the store's page.` +
      (s.prices.some((p) => /amazon/i.test(p.store)) ? " As an Amazon Associate, SkinOracle earns from qualifying purchases." : "")   // 1.1.3: Amazon's required sentence
    : "";

  const ing = s.product?.ingredients_text;
  $("res-ingredients-box").classList.toggle("hidden", !ing);
  $("res-ingredients").textContent = ing || "";
}

// "Save to my phone": share sheet (iPhone/Android) or downloads (computer)
$("save").addEventListener("click", async () => {
  if (!current?.files?.length) return;
  const files = current.files.map((f) => new File([f.blob], f.name, { type: "image/png" }));
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, title: current.product?.display_name ?? "Product" });
      toast("Saved. Look in Photos or in Files → " + CONFIG.folderName + ".");
    } catch (e) {
      if (e.name !== "AbortError") toast("Couldn't open the save menu: " + e.message, 5000);
    }
    return;
  }
  for (const f of files) {                    // computer / older browser: plain downloads
    const a = document.createElement("a");
    a.href = URL.createObjectURL(f); a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    await new Promise((r) => setTimeout(r, 350));
  }
  toast("Downloaded " + files.length + " picture" + (files.length > 1 ? "s" : "") + ".");
});

$("delete-scan").addEventListener("click", async (e) => {
  e.preventDefault();
  if (!current) return;
  await deleteScan(current.id).catch(() => {});
  toast("Deleted from this phone.");
  renderGallery(); show("home");
});

// =============================================================================
// Helpers
// =============================================================================
function money(v, cur = "USD") {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD" }).format(v); }
  catch { return "$" + Number(v).toFixed(2); }
}
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } }

/** Canned answer for ?demo=1 (tests and offline tries). Never used in normal mode. */
async function demoAnswer(gtin) {
  await new Promise((r) => setTimeout(r, 1200));
  const now = new Date().toISOString();
  return {
    product: { brand: "Demo Brand", product_name: "Gentle Hydrating Cleanser", variant: null, size_text: "16 fl oz", category: "cleanser",
      is_skincare: true, ingredients_text: "Aqua, Glycerin, Ceramide NP, Hyaluronic Acid", confidence: 0.92, contains_personal_info: false,
      display_name: "Demo Brand Gentle Hydrating Cleanser" },
    prices: [
      { store: "Target", price: 15.99, currency: "USD", url: "https://www.target.com/", title: "Demo listing", verified: true, checked_at: now },
      // 1.1.3: shown as the server shows Amazon (no number, Roxy's Associates tag). RETIRED: price 14.49, url https://www.amazon.com/
      { store: "Amazon", price: null, currency: "USD", url: "https://www.amazon.com/?tag=roxybenjamin-20", title: "Demo listing", verified: true, checked_at: now },
      { store: "Ulta Beauty", price: 17.0, currency: "USD", url: "https://www.ulta.com/", title: "Demo listing", verified: false, checked_at: now },
    ],
    cached: false, saved: true,
    demo_barcode_seen: gtin,
  };
}

// =============================================================================
// Start-up
// =============================================================================
askPersistentStorage();
renderGallery();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/pricer/sw.js", { scope: "/pricer/" }).catch(() => {});
// Warm up the cut-out model in the background so the first scan is faster.
$("model-status").textContent = "Preparing the background remover (first time only)…";
loadCutoutModel()
  .then(() => { $("model-status").textContent = "Ready."; setTimeout(() => $("model-status").textContent = "", 2500); })
  .catch(() => { $("model-status").textContent = "The background remover couldn't load; photos will keep their background."; });
