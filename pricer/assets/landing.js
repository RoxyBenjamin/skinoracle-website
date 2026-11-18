// =============================================================================
// SkinOracle™ Product Pricer — install page behaviour (pricer v1.1.3)
// Owner, founder, author, designer and architect: Roxanne Benjamin (also Roxy Benjamin; maiden name Roxanne
// Haberland). All hers, no one else's. © 2026 Roxanne Benjamin. See OWNERSHIP.md.
//
// WHY: Founder direction (Roxanne Haberland), 14 Nov 2026: "the web app should know if it's being called by safari or
//   chrome... and use the appropriate install instructions" · "majority of iPhone users use safari by default".
// WHAT IT DOES
//   1. Opened from the installed Home-Screen icon → goes straight to the app (/pricer/app/).
//   2. Works out the phone and browser (detectBrowser) and fills the "Install on this phone" card (index.html
//      #install-here) with the exact steps for it: iPhone Safari, iPhone Chrome, iPhone Firefox/Edge, an app's built-in
//      browser (Instagram, Facebook, Gmail, the Google app… which can't install: "open in Safari" + Copy the link),
//      Android Chrome (one-tap Install button when Chrome offers it), Samsung Internet, other Android browsers, computer.
//   3. Registers the service worker (fast opening, makes it installable).
// HOW TO CHANGE SAFELY: the step texts are in STEPS below (plain words; **bold** marks button names). Everything is put
//   on the page with textContent (no HTML), so the strict security policy stays happy. The full instructions for every
//   phone stay in index.html under "Instructions for other phones and browsers".
// =============================================================================
import { CONFIG } from "../config.js";

const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
if (standalone) location.replace("/pricer/app/");

document.getElementById("ver").textContent = "v" + CONFIG.version;

/** Which phone and browser this is. Exported for the browser test. */
export function detectBrowser(ua, maxTouchPoints = 0) {
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const inApp = /FBAN|FBAV|Instagram|Line\/|GSA\/|Snapchat|Pinterest|LinkedInApp|TikTok|musical_ly|Twitter|MicroMessenger|GmailApp|\bwv\b/.test(ua);
  if (ios) {
    if (inApp) return "ios-inapp";
    if (/CriOS/.test(ua)) return "ios-chrome";
    if (/FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua)) return "ios-other";
    return "ios-safari";
  }
  if (android) {
    if (inApp) return "android-inapp";
    if (/SamsungBrowser/.test(ua)) return "android-samsung";
    if (/Chrome\//.test(ua) && !/EdgA|OPR|Firefox/.test(ua)) return "android-chrome";
    return "android-other";
  }
  return "computer";
}

/** The steps for each phone + browser. **text** = shown in bold (a button or menu name). */
const STEPS = {
  "ios-safari": {
    label: "iPhone · Safari",
    steps: [
      "Tap the **Share** button ⬆︎ at the bottom of the screen (on some iPhones it's at the top right).",
      "Scroll down and tap **Add to Home Screen**. If you see **Open as Web App**, leave it switched on.",
      "Tap **Add**. The **SO Pricer** icon appears on your Home Screen.",
      "Open **SO Pricer** from the icon. It runs full-screen, like an app. The first time, allow the **camera**.",
    ],
    note: "Works on iPhone XS and newer with a current iOS.",
  },
  "ios-chrome": {
    label: "iPhone · Chrome",
    steps: [
      "Tap the **Share** button ⬆︎ at the top right, inside the address bar.",
      "Tap **Add to Home Screen** (scroll down if you don't see it).",
      "Tap **Add**. The **SO Pricer** icon appears on your Home Screen.",
      "Open **SO Pricer** from the icon and allow the **camera**.",
    ],
    note: "If Chrome doesn't show Add to Home Screen, open skinoracle.ai/pricer in Safari instead (Copy the link below, then paste it in Safari).",
    copy: true,
  },
  "ios-other": {
    label: "iPhone · this browser",
    steps: [
      "Open this browser's **Share** menu ⬆︎ (or its **⋯** menu, then **Share**).",
      "Tap **Add to Home Screen**, then **Add**.",
      "Open **SO Pricer** from your Home Screen and allow the **camera**.",
    ],
    note: "The simplest way is Safari: Copy the link below, open Safari, paste it, then Share › Add to Home Screen.",
    copy: true,
  },
  "ios-inapp": {
    label: "iPhone · opened inside an app",
    steps: [
      "This page is open inside another app (like Instagram, Facebook, Gmail or Google), which can't install the Pricer.",
      "Tap **Copy the link** below, open **Safari**, paste it in the address bar and go.",
      "In Safari, tap **Share** ⬆︎ › **Add to Home Screen** › **Add**.",
    ],
    note: "Or look for this app's **⋯** menu and choose **Open in Safari** (or Open in browser).",
    copy: true,
  },
  "android-chrome": {
    label: "Android · Chrome",
    steps: [
      "Tap **Install on this phone** above, then **Install**.",
      "No button? Tap Chrome's **⋮** menu (top right) › **Install app** (or **Add to Home screen** › **Install**).",
      "Open **SO Pricer** from your Home screen or app drawer and allow the **camera**.",
    ],
  },
  "android-samsung": {
    label: "Android · Samsung Internet",
    steps: [
      "Tap the **menu** ☰ (bottom right) › **Add page to** › **Home screen**.",
      "Tap **Add**.",
      "Open **SO Pricer** from your Home screen and allow the **camera**.",
    ],
  },
  "android-other": {
    label: "Android · this browser",
    steps: [
      "Open this browser's menu and look for **Install app** or **Add to Home screen**.",
      "Open **SO Pricer** from your Home screen and allow the **camera**.",
    ],
    note: "Chrome gives the smoothest install: Copy the link below and open it in Chrome.",
    copy: true,
  },
  "android-inapp": {
    label: "Android · opened inside an app",
    steps: [
      "This page is open inside another app, which can't install the Pricer.",
      "Tap **Copy the link** below, open **Chrome**, paste it and go.",
      "In Chrome, tap **⋮** › **Install app**.",
    ],
    copy: true,
  },
  computer: {
    label: "On a computer",
    steps: [
      "Product Pricer is made for phones: open **skinoracle.ai/pricer** on your iPhone (in Safari) or Android phone (in Chrome).",
      "You can also try it here with your computer's camera or photos: **Open Product Pricer** above.",
    ],
  },
};

/** Puts "text with **bold** parts" into an element safely (no HTML). */
function fill(el, text) {
  el.textContent = "";
  text.split(/(\*\*[^*]+\*\*)/).forEach((part) => {
    if (part.startsWith("**") && part.endsWith("**")) { const b = document.createElement("b"); b.textContent = part.slice(2, -2); el.appendChild(b); }
    else if (part) el.appendChild(document.createTextNode(part));
  });
}

const kind = detectBrowser(navigator.userAgent, navigator.maxTouchPoints);
document.documentElement.dataset.browser = kind;
const plan = STEPS[kind];
document.getElementById("install-here-label").textContent = plan.label;
const list = document.getElementById("install-here-steps");
for (const step of plan.steps) { const li = document.createElement("li"); fill(li, step); list.appendChild(li); }
fill(document.getElementById("install-here-note"), plan.note ?? "");
if (plan.copy) {
  document.getElementById("copy-row").classList.remove("hidden");
  document.getElementById("copy-link").addEventListener("click", async (e) => {
    const url = "https://skinoracle.ai/pricer/";
    try { await navigator.clipboard.writeText(url); e.target.textContent = "Link copied"; }
    catch { e.target.textContent = url; }
  });
}

// Chrome on Android offers a real one-tap install; we keep it for our own button.
let deferredPrompt = null;
const installBtn = document.getElementById("install-android");
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove("hidden");
});
installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice.catch(() => null);
  deferredPrompt = null;
  installBtn.classList.add("hidden");
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/pricer/sw.js", { scope: "/pricer/" }).catch(() => { /* app still works without it */ });
}
